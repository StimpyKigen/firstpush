/**
 * Mshindi Server-Sent Events (SSE) Real-Time Broadcaster
 * 
 * Provides centralized, highly efficient, low-latency one-way data distribution
 * for live football scores, match clock ticks, incidents (goals/cards), and market odds.
 * 
 * Invariants & Architecture:
 * 1. Single centralized ingestion layer: prevents individual clients from hammering
 *    upstream provider APIs.
 * 2. Lightweight delta events: sends only changed fields (score, clock, incident)
 *    rather than complete 100KB fixture objects (>98% bandwidth reduction).
 * 3. Monotonic sequence numbering & circular replay buffer: supports seamless catch-up
 *    when clients reconnect via `Last-Event-ID`.
 * 4. Automatic dead-connection pruning & 15s heartbeat pings to keep cellular/proxy connections alive.
 * 5. Environment-adaptive: supports long-lived connections (Node/Express) and bounded sessions (Vercel serverless).
 */

import type { Request, Response } from 'express';
import type { MatchStatus, MatchPeriod } from './matchStatus.js';
import type { MatchIncidentItem } from './freeMatches.js';

export type RealtimeEventType =
  | 'SCORE_UPDATE'
  | 'INCIDENT'
  | 'STATUS_CHANGE'
  | 'ODDS_UPDATE'
  | 'FIXTURE_UPSERT'
  | 'SYNC_REQUIRED'
  | 'HEARTBEAT';

export interface BaseRealtimeEvent {
  id: string; // e.g. "evt_1730718000000_1"
  sequence: number; // strictly monotonic integer: 1, 2, 3...
  timestamp: number; // Unix ms
  type: RealtimeEventType;
}

export interface ScoreUpdatePayload {
  type: 'SCORE_UPDATE';
  fixtureId: string;
  providerId?: string;
  homeScore: number | null;
  awayScore: number | null;
  displayClock?: string;
  period?: MatchPeriod;
  latestGoalscorer?: string;
}

export interface IncidentPayload {
  type: 'INCIDENT';
  fixtureId: string;
  providerId?: string;
  incident: MatchIncidentItem;
}

export interface StatusChangePayload {
  type: 'STATUS_CHANGE';
  fixtureId: string;
  providerId?: string;
  status: MatchStatus;
  period?: MatchPeriod;
  displayClock?: string;
  result?: '1' | 'X' | '2';
}

export interface OddsUpdatePayload {
  type: 'ODDS_UPDATE';
  fixtureId: string;
  providerId?: string;
  bookmaker: string;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
}

export interface FixtureUpsertPayload {
  type: 'FIXTURE_UPSERT';
  fixtureId: string;
  providerId?: string;
  fixture: Record<string, any>;
}

export interface SyncRequiredPayload {
  type: 'SYNC_REQUIRED';
  reason: 'buffer_overflow' | 'initial_connect' | 'authoritative_reset';
  latestSequence: number;
}

export interface HeartbeatPayload {
  type: 'HEARTBEAT';
}

export type RealtimeEventPayload =
  | ScoreUpdatePayload
  | IncidentPayload
  | StatusChangePayload
  | OddsUpdatePayload
  | FixtureUpsertPayload
  | SyncRequiredPayload
  | HeartbeatPayload;

export type RealtimeDeltaEvent = BaseRealtimeEvent & RealtimeEventPayload;

interface ConnectedClient {
  id: string;
  res: Response;
  ip: string;
  userAgent?: string;
  connectedAt: number;
  lastActive: number;
  closed: boolean;
  serverlessTimer?: NodeJS.Timeout;
}

export interface BroadcasterMetrics {
  activeConnections: number;
  totalConnectionsServed: number;
  totalEventsEmitted: number;
  currentSequence: number;
  bufferSize: number;
  oldestBufferedSequence: number | null;
  uptimeSeconds: number;
}

class RealtimeBroadcaster {
  private clients = new Map<string, ConnectedClient>();
  private recentEvents: RealtimeDeltaEvent[] = [];
  private readonly maxBufferSize = 500;
  private sequenceCounter = 0;
  private totalConnectionsServed = 0;
  private totalEventsEmitted = 0;
  private readonly startedAt = Date.now();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeatTimer();
  }

  /**
   * Start 15-second heartbeat ping interval to prevent TCP socket drops
   */
  private startHeartbeatTimer() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 15_000);

    // Prevent unref error in non-Node environments
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Register a new client SSE response stream
   */
  public registerClient(req: Request, res: Response): string {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] as string | undefined;

    // Establish SSE Headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Critical: disables NGINX reverse-proxy buffering
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Last-Event-ID',
    });

    // Flush headers immediately if supported
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const client: ConnectedClient = {
      id: clientId,
      res,
      ip,
      userAgent,
      connectedAt: Date.now(),
      lastActive: Date.now(),
      closed: false,
    };

    // If running under Vercel serverless (max duration 60s), schedule clean close at 48s
    // Browser EventSource will instantly reconnect with Last-Event-ID without missing events
    if (process.env.VERCEL === '1') {
      client.serverlessTimer = setTimeout(() => {
        if (!client.closed) {
          this.writeSSE(client, 'serverless_renew', {
            message: 'Serverless execution window expired. Reconnecting automatically.',
            latestSequence: this.sequenceCounter,
          });
          this.unregisterClient(clientId);
        }
      }, 48_000);
    }

    this.clients.set(clientId, client);
    this.totalConnectionsServed++;

    // Initial greeting event
    this.writeSSE(client, 'connected', {
      clientId,
      serverTime: new Date().toISOString(),
      currentSequence: this.sequenceCounter,
      heartbeatIntervalMs: 15_000,
    });

    // Handle Last-Event-ID catchup replay
    const lastEventIdHeader = req.headers['last-event-id'] || (req.query.lastEventId as string);
    if (lastEventIdHeader) {
      const match = String(lastEventIdHeader).match(/seq_(\d+)/) || String(lastEventIdHeader).match(/(\d+)/);
      if (match) {
        const lastSeq = parseInt(match[1], 10);
        if (!isNaN(lastSeq)) {
          this.replayCatchupEvents(client, lastSeq);
        }
      }
    }

    // Handle connection closure
    const cleanup = () => {
      this.unregisterClient(clientId);
    };

    req.on('close', cleanup);
    req.on('end', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    return clientId;
  }

  /**
   * Unregister client and cleanly close socket
   */
  public unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.closed = true;
    if (client.serverlessTimer) {
      clearTimeout(client.serverlessTimer);
    }

    try {
      if (!client.res.writableEnded) {
        client.res.end();
      }
    } catch {
      // socket already destroyed
    }

    this.clients.delete(clientId);
  }

  /**
   * Replay missed events from circular buffer if available, or signal full sync
   */
  private replayCatchupEvents(client: ConnectedClient, lastClientSequence: number): void {
    if (lastClientSequence >= this.sequenceCounter) {
      return; // Client is already up to date
    }

    const oldestBuffered = this.recentEvents.length > 0 ? this.recentEvents[0].sequence : null;

    if (oldestBuffered === null || lastClientSequence < oldestBuffered - 1) {
      // Replay buffer overflowed: Client was disconnected too long; request fresh sync
      this.writeSSE(client, 'sync_required', {
        type: 'SYNC_REQUIRED',
        reason: 'buffer_overflow',
        latestSequence: this.sequenceCounter,
      });
      return;
    }

    // Replay all events since client's last seen sequence
    const missed = this.recentEvents.filter((e) => e.sequence > lastClientSequence);
    for (const event of missed) {
      this.writeEventToClient(client, event);
    }
  }

  /**
   * Broadcast a delta event to all active clients
   */
  public broadcastDelta(payload: RealtimeEventPayload): RealtimeDeltaEvent {
    this.sequenceCounter++;
    this.totalEventsEmitted++;

    const event: RealtimeDeltaEvent = {
      ...(payload as any),
      id: `evt_${Date.now()}_seq_${this.sequenceCounter}`,
      sequence: this.sequenceCounter,
      timestamp: Date.now(),
    };

    // Store in circular replay buffer (skip HEARTBEAT)
    if (payload.type !== 'HEARTBEAT') {
      this.recentEvents.push(event);
      if (this.recentEvents.length > this.maxBufferSize) {
        this.recentEvents.shift();
      }
    }

    // Broadcast to all active clients
    const deadClients: string[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      if (client.closed || client.res.writableEnded) {
        deadClients.push(clientId);
        continue;
      }

      const success = this.writeEventToClient(client, event);
      if (!success) {
        deadClients.push(clientId);
      }
    }

    // Clean up dead connections
    for (const deadId of deadClients) {
      this.unregisterClient(deadId);
    }

    return event;
  }

  /**
   * Broadcast lightweight score update
   */
  public broadcastScoreUpdate(
    fixtureId: string,
    homeScore: number | null,
    awayScore: number | null,
    displayClock?: string,
    period?: MatchPeriod,
    latestGoalscorer?: string,
    providerId?: string
  ): RealtimeDeltaEvent {
    return this.broadcastDelta({
      type: 'SCORE_UPDATE',
      fixtureId,
      providerId,
      homeScore,
      awayScore,
      displayClock,
      period,
      latestGoalscorer,
    });
  }

  /**
   * Broadcast match incident (card / goal / var)
   */
  public broadcastIncident(
    fixtureId: string,
    incident: MatchIncidentItem,
    providerId?: string
  ): RealtimeDeltaEvent {
    return this.broadcastDelta({
      type: 'INCIDENT',
      fixtureId,
      providerId,
      incident,
    });
  }

  /**
   * Broadcast match status transition (e.g. pre -> in, in -> post)
   */
  public broadcastStatusChange(
    fixtureId: string,
    status: MatchStatus,
    period?: MatchPeriod,
    displayClock?: string,
    result?: '1' | 'X' | '2',
    providerId?: string
  ): RealtimeDeltaEvent {
    return this.broadcastDelta({
      type: 'STATUS_CHANGE',
      fixtureId,
      providerId,
      status,
      period,
      displayClock,
      result,
    });
  }

  /**
   * Broadcast market odds change
   */
  public broadcastOddsUpdate(
    fixtureId: string,
    bookmaker: string,
    homeOdds?: number,
    drawOdds?: number,
    awayOdds?: number,
    providerId?: string
  ): RealtimeDeltaEvent {
    return this.broadcastDelta({
      type: 'ODDS_UPDATE',
      fixtureId,
      providerId,
      bookmaker,
      homeOdds,
      drawOdds,
      awayOdds,
    });
  }

  /**
   * Send heartbeat to all clients
   */
  public sendHeartbeat(): void {
    if (this.clients.size === 0) return;

    const deadClients: string[] = [];
    const pingPayload = JSON.stringify({
      t: Date.now(),
      seq: this.sequenceCounter,
      clients: this.clients.size,
    });

    for (const [clientId, client] of this.clients.entries()) {
      if (client.closed || client.res.writableEnded) {
        deadClients.push(clientId);
        continue;
      }

      try {
        client.res.write(`event: ping\ndata: ${pingPayload}\n\n`);
        client.lastActive = Date.now();
        if (typeof (client.res as any).flush === 'function') {
          (client.res as any).flush();
        }
      } catch {
        deadClients.push(clientId);
      }
    }

    for (const deadId of deadClients) {
      this.unregisterClient(deadId);
    }
  }

  /**
   * Write an event to a single client
   */
  private writeEventToClient(client: ConnectedClient, event: RealtimeDeltaEvent): boolean {
    const eventName = event.type.toLowerCase();
    const payload = JSON.stringify(event);

    try {
      client.res.write(`id: ${event.id}\nevent: ${eventName}\ndata: ${payload}\n\n`);
      client.lastActive = Date.now();
      if (typeof (client.res as any).flush === 'function') {
        (client.res as any).flush();
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write raw SSE message to client
   */
  private writeSSE(client: ConnectedClient, eventName: string, data: any): void {
    try {
      client.res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      if (typeof (client.res as any).flush === 'function') {
        (client.res as any).flush();
      }
    } catch {
      // write failure
    }
  }

  /**
   * Get operational diagnostics and telemetry metrics
   */
  public getMetrics(): BroadcasterMetrics {
    return {
      activeConnections: this.clients.size,
      totalConnectionsServed: this.totalConnectionsServed,
      totalEventsEmitted: this.totalEventsEmitted,
      currentSequence: this.sequenceCounter,
      bufferSize: this.recentEvents.length,
      oldestBufferedSequence: this.recentEvents.length > 0 ? this.recentEvents[0].sequence : null,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  /**
   * Close all connections and stop intervals (useful for graceful shutdown or tests)
   */
  public destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    for (const clientId of Array.from(this.clients.keys())) {
      this.unregisterClient(clientId);
    }
  }
}

// Global singleton instance across server process
export const realtimeBroadcaster = new RealtimeBroadcaster();

