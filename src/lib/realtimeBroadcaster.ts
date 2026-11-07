/**
 * Real-Time Event Broadcaster & SSE Stream Manager
 *
 * Implements an authoritative push distribution layer over Server-Sent Events (SSE).
 * Features:
 * - Zero-polling push delivery to all connected browser clients
 * - Monotonic sequence IDs with circular replay buffer (Last-Event-ID catch-up on reconnect)
 * - Immediate initial `live_snapshot` push on client connection so clients immediately sync live/finished states
 * - Automatic deduplication of identical consecutive fixture events
 * - Keep-alive heartbeats every 15s to prevent proxy / CDN idle drops
 * - Graceful connection renewal before serverless execution limits (48s)
 * - Full connection and delivery metrics
 */

export type RealtimeEventType =
  | 'connected'
  | 'live_snapshot'
  | 'score_update'
  | 'status_change'
  | 'incident'
  | 'fixture_upsert'
  | 'odds_update'
  | 'heartbeat'
  | 'ping'
  | 'SCORE_UPDATE'
  | 'STATUS_CHANGE'
  | 'INCIDENT'
  | 'FIXTURE_UPSERT'
  | 'ODDS_UPDATE';

export interface RealtimeEventPayload {
  id: number;
  sequence: number;
  type: RealtimeEventType;
  timestamp: string;
  fixtureId?: string;
  providerId?: string;
  matchSlug?: string;
  data: any;
}

export type RealtimeDeltaEvent = RealtimeEventPayload;

interface ConnectedClient {
  id: string;
  res: any;
  connectedAt: number;
  heartbeatTimer: NodeJS.Timeout;
  renewalTimer?: NodeJS.Timeout;
}

export interface BroadcasterMetrics {
  activeConnections: number;
  totalConnectionsServed: number;
  totalEventsDispatched: number;
  totalEventsEmitted: number;
  totalDeliveriesSent: number;
  duplicateEventsIgnored: number;
  lastEventDispatchedAt: string | null;
  lastDeliverySentAt: string | null;
  bufferSize: number;
  currentSequenceId: number;
}

const MAX_BUFFER_SIZE = 500;
const HEARTBEAT_INTERVAL_MS = 15_000;
const SERVERLESS_RENEWAL_MS = 25_000;

function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as Partial<T>;
}

class RealtimeBroadcaster {
  private clients = new Map<string, ConnectedClient>();
  private eventBuffer: RealtimeEventPayload[] = [];
  private lastSignatureByKey = new Map<string, string>();
  /**
   * Event IDs are wall-clock based (ms epoch, strictly increasing per instance) rather than a
   * per-process counter starting at a constant. On serverless hosting every cold start / extra
   * instance would otherwise restart at the same number, so a client reconnecting to a different
   * instance would drop genuinely new frames as "old" (id <= lastEventId). Time-based IDs stay
   * monotonic across instances, restarts and deployments (within normal clock skew).
   */
  private sequenceId = Date.now();
  private totalConnectionsServed = 0;
  private totalEventsDispatched = 0;
  private totalDeliveriesSent = 0;
  private duplicateEventsIgnored = 0;
  private lastEventDispatchedAt: string | null = null;
  private lastDeliverySentAt: string | null = null;
  private snapshotProvider: (() => any[]) | null = null;
  private onClientConnectHook: (() => void | Promise<void>) | null = null;

  /**
   * Registers a callback that returns the current authoritative live + today's finished fixtures
   * to send immediately when a new SSE client connects.
   */
  public setSnapshotProvider(provider: () => any[]): void {
    this.snapshotProvider = provider;
  }

  /**
   * Registers a callback invoked whenever an SSE client connects (e.g. to ensure live polling is active).
   */
  public setOnClientConnect(hook: () => void | Promise<void>): void {
    this.onClientConnectHook = hook;
  }

  /**
   * Convenience wrapper for registering a response stream directly.
   */
  public addClient(res: any, lastEventId?: string): string {
    const fakeReq = {
      headers: lastEventId ? { 'last-event-id': lastEventId } : {},
      query: {},
      on: () => {},
    };
    return this.registerClient(fakeReq, res);
  }

  /**
   * Registers an incoming HTTP response stream as an SSE subscriber.
   */
  public registerClient(req: any, res: any): string {
    const clientId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.totalConnectionsServed++;

    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    };

    if (typeof res.setHeader === 'function') {
      for (const [k, v] of Object.entries(headers)) {
        res.setHeader(k, v);
      }
    }
    if (typeof res.writeHead === 'function' && !res.headersSent) {
      res.writeHead(200, headers);
    }
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    // Instruct browser EventSource to retry after 2000ms if disconnected
    this.writeRaw(res, `retry: 2000\n\n`);

    // Send initial connection confirmation
    const welcomeEvent: RealtimeEventPayload = {
      id: this.sequenceId,
      sequence: this.sequenceId,
      type: 'connected',
      timestamp: new Date().toISOString(),
      data: {
        clientId,
        sequenceId: this.sequenceId,
        activeConnections: this.clients.size + 1,
      },
    };
    this.writeEvent(res, welcomeEvent);

    // Check Last-Event-ID header or query param for seamless catch-up replay
    const lastEventIdRaw =
      req?.headers?.['last-event-id'] ||
      req?.query?.lastEventId ||
      req?.query?.last_event_id;
    const cleanedLastId = lastEventIdRaw ? String(lastEventIdRaw).replace(/^seq_/, '') : '';
    const lastEventId = cleanedLastId ? parseInt(cleanedLastId, 10) : NaN;

    if (!Number.isNaN(lastEventId) && lastEventId < this.sequenceId) {
      const missedEvents = this.eventBuffer.filter((ev) => ev.id > lastEventId);
      for (const ev of missedEvents) {
        this.writeEvent(res, ev);
      }
    }

    // Send an initial authoritative live_snapshot when a client connects so live/finished states are immediately synced
    let initialSnapshotSent = false;
    if (this.snapshotProvider) {
      try {
        const snapshotFixtures = this.snapshotProvider();
        if (Array.isArray(snapshotFixtures) && snapshotFixtures.length > 0) {
          const snapEvent: RealtimeEventPayload = {
            id: this.sequenceId,
            sequence: this.sequenceId,
            type: 'live_snapshot',
            timestamp: new Date().toISOString(),
            data: {
              count: snapshotFixtures.length,
              fixtures: snapshotFixtures,
            },
          };
          this.writeEvent(res, snapEvent);
          initialSnapshotSent = true;
        }
      } catch {
        // Non-fatal snapshot error
      }
    }

    // Periodic heartbeat to keep connection alive through load balancers
    const heartbeatTimer = setInterval(() => {
      try {
        if (res.writableEnded) {
          this.removeClient(clientId);
          return;
        }
        this.writeRaw(res, `: heartbeat ${Date.now()}\n\n`);
      } catch {
        this.removeClient(clientId);
      }
    }, HEARTBEAT_INTERVAL_MS);

    // If running in a serverless environment (e.g. Vercel), gracefully close before hard timeout
    // so the browser EventSource cleanly reconnects with Last-Event-ID
    let renewalTimer: NodeJS.Timeout | undefined;
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      renewalTimer = setTimeout(() => {
        try {
          this.writeRaw(res, `event: reconnect\ndata: {"reason":"serverless_window_renewal"}\n\n`);
          res.end();
        } catch {
          // Ignore close errors
        } finally {
          this.removeClient(clientId);
        }
      }, SERVERLESS_RENEWAL_MS);
    }

    const client: ConnectedClient = {
      id: clientId,
      res,
      connectedAt: Date.now(),
      heartbeatTimer,
      renewalTimer,
    };

    this.clients.set(clientId, client);
    this.lastSignatureByKey.clear();

    // Trigger onClientConnectHook asynchronously so the newly connected client gets fresh upstream updates
    if (this.onClientConnectHook) {
      Promise.resolve(this.onClientConnectHook())
        .then(() => {
          if (!initialSnapshotSent && !res.writableEnded && this.clients.has(clientId) && this.snapshotProvider) {
            try {
              const freshFixtures = this.snapshotProvider();
              if (Array.isArray(freshFixtures) && freshFixtures.length > 0) {
                const snapEvent: RealtimeEventPayload = {
                  id: this.sequenceId,
                  sequence: this.sequenceId,
                  type: 'live_snapshot',
                  timestamp: new Date().toISOString(),
                  data: {
                    count: freshFixtures.length,
                    fixtures: freshFixtures,
                  },
                };
                this.writeEvent(res, snapEvent);
              }
            } catch {
              // Non-fatal snapshot error
            }
          }
        })
        .catch(() => {});
    }

    const cleanup = () => {
      this.removeClient(clientId);
    };

    if (req && typeof req.on === 'function') {
      req.on('close', cleanup);
      req.on('error', cleanup);
    }
    if (res && typeof res.on === 'function') {
      res.on('close', cleanup);
      res.on('error', cleanup);
    }

    return clientId;
  }

  /**
   * Emits an active heartbeat ping to all connected clients and prunes closed sockets.
   */
  public sendHeartbeat(): void {
    const now = Date.now();
    const frame = `event: ping\ndata: ${JSON.stringify({ t: now })}\n\n`;
    for (const [clientId, client] of this.clients.entries()) {
      if (client.res.writableEnded) {
        this.removeClient(clientId);
        continue;
      }
      try {
        this.writeRaw(client.res, frame);
      } catch {
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Removes and cleans up a disconnected SSE client.
   */
  public removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    clearInterval(client.heartbeatTimer);
    if (client.renewalTimer) {
      clearTimeout(client.renewalTimer);
    }
    this.clients.delete(clientId);
  }

  /**
   * Broadcasts a delta event immediately to all connected clients and stores it in the replay buffer.
   * Deduplicates identical consecutive events for the same fixtureId + event type unless force=true.
   */
  public emit(
    type: RealtimeEventType,
    data: any,
    meta?: { fixtureId?: string; providerId?: string; matchSlug?: string; force?: boolean }
  ): RealtimeEventPayload {
    const wireType = String(type).toLowerCase() as RealtimeEventType;
    const cleanData = data && typeof data === 'object' ? stripUndefined(data) : data;

    // Deduplicate identical consecutive events per fixture + type
    if (!meta?.force && meta?.fixtureId && wireType !== 'heartbeat' && wireType !== 'ping' && wireType !== 'connected') {
      const dedupeKey = `${wireType}:${meta.fixtureId}`;
      const sig = JSON.stringify(cleanData);
      if (this.lastSignatureByKey.get(dedupeKey) === sig) {
        this.duplicateEventsIgnored++;
        const existing = [...this.eventBuffer].reverse().find((e) => e.fixtureId === meta.fixtureId && String(e.type).toLowerCase() === wireType);
        if (existing) {
          return Object.assign({}, existing, { duplicateSuppressed: true });
        }
      }
      this.lastSignatureByKey.set(dedupeKey, sig);
      if (this.lastSignatureByKey.size > 2000) {
        const firstKey = this.lastSignatureByKey.keys().next().value;
        if (firstKey) this.lastSignatureByKey.delete(firstKey);
      }
    }

    this.sequenceId = Math.max(this.sequenceId + 1, Date.now());
    this.totalEventsDispatched++;
    const nowIso = new Date().toISOString();
    this.lastEventDispatchedAt = nowIso;

    const payload: RealtimeEventPayload = stripUndefined({
      id: this.sequenceId,
      sequence: this.sequenceId,
      type: wireType,
      timestamp: nowIso,
      fixtureId: meta?.fixtureId,
      providerId: meta?.providerId,
      matchSlug: meta?.matchSlug,
      data: cleanData,
    }) as RealtimeEventPayload;

    // Append to circular replay buffer
    if (wireType !== 'heartbeat' && wireType !== 'ping' && wireType !== 'connected' && wireType !== 'live_snapshot') {
      this.eventBuffer.push(payload);
      if (this.eventBuffer.length > MAX_BUFFER_SIZE) {
        this.eventBuffer.shift();
      }
    }

    // Fan-out immediately to all active SSE streams
    for (const [clientId, client] of this.clients.entries()) {
      if (client.res.writableEnded) {
        this.removeClient(clientId);
        continue;
      }
      try {
        this.writeEvent(client.res, payload);
        this.totalDeliveriesSent++;
        this.lastDeliverySentAt = nowIso;
      } catch {
        this.removeClient(clientId);
      }
    }

    return payload;
  }

  /**
   * Convenience helper to broadcast a score update event.
   */
  public broadcastScoreUpdate(
    fixtureId: string,
    homeScore: number | null | undefined,
    awayScore: number | null | undefined,
    displayClock?: string,
    period?: string,
    latestGoalscorer?: any,
    providerId?: string,
    status?: string,
    homeHtScore?: number | null,
    awayHtScore?: number | null,
    matchSlug?: string,
    home?: string,
    away?: string,
    kickoffIso?: string,
    updateVersion?: number
  ): RealtimeEventPayload {
    const force = typeof latestGoalscorer === 'boolean' ? latestGoalscorer : false;
    const scorer = typeof latestGoalscorer === 'boolean' ? undefined : latestGoalscorer;
    const evt = this.emit(
      'score_update',
      {
        homeScore,
        awayScore,
        homeHtScore,
        awayHtScore,
        displayClock,
        period,
        status: status || period,
        latestGoalscorer: scorer,
        home,
        away,
        kickoffIso,
        updateVersion,
      },
      { fixtureId, providerId, matchSlug, force }
    );
    return { ...evt, type: 'SCORE_UPDATE' };
  }

  /**
   * Convenience helper to broadcast a match status / period / clock transition.
   */
  public broadcastStatusChange(
    fixtureId: string,
    status: string,
    period?: string,
    displayClock?: string,
    result?: '1' | 'X' | '2',
    providerId?: string,
    homeScore?: number | null,
    awayScore?: number | null,
    matchSlug?: string,
    home?: string,
    away?: string,
    kickoffIso?: string,
    updateVersion?: number
  ): RealtimeEventPayload {
    const evt = this.emit(
      'status_change',
      {
        status,
        period,
        displayClock,
        result,
        homeScore,
        awayScore,
        home,
        away,
        kickoffIso,
        updateVersion,
      },
      { fixtureId, providerId, matchSlug }
    );
    return { ...evt, type: 'STATUS_CHANGE' };
  }

  /**
   * Convenience helper to broadcast a new match incident (goal, red card, etc.).
   */
  public broadcastIncident(
    fixtureId: string,
    incident: any,
    providerId?: string,
    latestGoalscorer?: any,
    matchSlug?: string
  ): RealtimeEventPayload {
    const evt = this.emit(
      'incident',
      {
        incident,
        latestGoalscorer,
      },
      { fixtureId, providerId, matchSlug }
    );
    return { ...evt, type: 'INCIDENT' };
  }

  /**
   * Convenience helper to broadcast an odds update.
   */
  public broadcastOddsUpdate(
    fixtureId: string,
    bookmaker: string,
    homeOdds: number,
    drawOdds: number,
    awayOdds: number,
    providerId?: string
  ): RealtimeEventPayload {
    const evt = this.emit(
      'odds_update',
      {
        bookmaker,
        homeOdds,
        drawOdds,
        awayOdds,
      },
      { fixtureId, providerId }
    );
    return { ...evt, type: 'ODDS_UPDATE' };
  }

  /**
   * Convenience helper to broadcast a fixture upsert.
   */
  public broadcastDelta(delta: {
    type?: string;
    fixtureId: string;
    providerId?: string;
    matchSlug?: string;
    fixture: any;
  }): RealtimeEventPayload {
    const evt = this.emit(
      'fixture_upsert',
      {
        fixture: delta.fixture,
      },
      { fixtureId: delta.fixtureId, providerId: delta.providerId, matchSlug: delta.matchSlug }
    );
    return { ...evt, type: 'FIXTURE_UPSERT' };
  }

  private writeEvent(res: any, payload: RealtimeEventPayload): void {
    const wireEventName = String(payload.type).toLowerCase();
    const wireBody =
      payload.data && typeof payload.data === 'object'
        ? { ...payload.data, ...payload, type: wireEventName }
        : { ...payload, type: wireEventName };
    const serialized = JSON.stringify(wireBody);
    const frame = `id: ${payload.id}\nevent: ${wireEventName}\ndata: ${serialized}\n\n`;
    this.writeRaw(res, frame);
  }

  private writeRaw(res: any, raw: string): void {
    res.write(raw);
    if (typeof res.flush === 'function') {
      res.flush();
    }
  }

  /**
   * Returns current operational metrics for monitoring and diagnostics.
   */
  public getMetrics(): BroadcasterMetrics {
    return {
      activeConnections: this.clients.size,
      totalConnectionsServed: this.totalConnectionsServed,
      totalEventsDispatched: this.totalEventsDispatched,
      totalEventsEmitted: this.totalEventsDispatched,
      totalDeliveriesSent: this.totalDeliveriesSent,
      duplicateEventsIgnored: this.duplicateEventsIgnored,
      lastEventDispatchedAt: this.lastEventDispatchedAt,
      lastDeliverySentAt: this.lastDeliverySentAt,
      bufferSize: this.eventBuffer.length,
      currentSequenceId: this.sequenceId,
    };
  }
}

export const realtimeBroadcaster = new RealtimeBroadcaster();
