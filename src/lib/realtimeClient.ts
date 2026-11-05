/**
 * Browser-Side Real-Time Event Stream Client (SSE + Resilient Auto-Recovery)
 *
 * Connects to `/api/sports/stream` via native EventSource.
 * Features:
 * - Instant push reception for score_update, status_change, incident, fixture_upsert, live_snapshot, and odds_update
 * - Automatic Last-Event-ID tracking and server-restart sequence reset for zero missed events
 * - Exponential backoff reconnection with jitter on network interruptions
 * - Connection state & data-freshness telemetry
 */

export type RealtimeEventType =
  | 'connected'
  | 'live_snapshot'
  | 'score_update'
  | 'status_change'
  | 'incident'
  | 'fixture_upsert'
  | 'odds_update'
  | 'heartbeat';

export interface RealtimeEventPayload {
  id: number;
  type: RealtimeEventType;
  timestamp: string;
  fixtureId?: string;
  providerId?: string;
  matchSlug?: string;
  data: any;
}

export type RealtimeEventHandler = (payload: RealtimeEventPayload) => void;
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

class RealtimeClient {
  private eventSource: EventSource | null = null;
  private listeners = new Map<RealtimeEventType | '*', Set<RealtimeEventHandler>>();
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private state: ConnectionState = 'disconnected';
  private lastEventId = 0;
  private reconnectAttempts = 0;
  private totalReconnects = 0;
  private reconnectTimer: any = null;
  private watchdogTimer: any = null;
  private lastPingTime = 0;
  private lastDataEventTime = 0;
  private seenEventIds = new Set<number>();

  /**
   * Starts the SSE connection if not already active.
   */
  public start(): void {
    this.connect();
  }

  /**
   * Stops the SSE connection and cleans up timers.
   */
  public stop(): void {
    this.disconnect();
  }

  /**
   * Initializes the persistent SSE connection in browser environments.
   */
  public connect(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    if (this.eventSource && (this.state === 'connected' || this.state === 'connecting')) {
      return;
    }

    this.cleanupSocket();
    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const streamUrl =
      this.lastEventId > 0
        ? `/api/sports/stream?lastEventId=${this.lastEventId}`
        : `/api/sports/stream`;

    try {
      const es = new EventSource(streamUrl);
      this.eventSource = es;

      es.onopen = () => {
        this.reconnectAttempts = 0;
        this.lastPingTime = Date.now();
        this.setState('connected');
        this.startWatchdog();
      };

      const handleRawEvent = (e: MessageEvent) => {
        this.lastPingTime = Date.now();
        try {
          const payload: RealtimeEventPayload = JSON.parse(e.data);
          this.dispatchEvent(payload);
        } catch {
          // Ignore malformed event frames
        }
      };

      // Subscribe to all named SSE event types
      const namedTypes: RealtimeEventType[] = [
        'connected',
        'live_snapshot',
        'score_update',
        'status_change',
        'incident',
        'fixture_upsert',
        'odds_update',
      ];

      for (const t of namedTypes) {
        es.addEventListener(t, handleRawEvent as EventListener);
      }

      // Graceful serverless window renewal event
      es.addEventListener('reconnect', () => {
        this.scheduleReconnect(200);
      });

      es.onmessage = handleRawEvent;

      es.onerror = () => {
        this.cleanupSocket();
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  /**
   * Subscribes to a specific real-time event type or '*' for all events.
   */
  public on(type: RealtimeEventType | '*', handler: RealtimeEventHandler): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);

    if (this.state === 'disconnected') {
      this.connect();
    }

    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  /**
   * Subscribes to connection state transitions.
   */
  public onStateChange(cb: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(cb);
    cb(this.state);
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public isConnected(): boolean {
    return this.state === 'connected';
  }

  public getLastDataEventTime(): number {
    return this.lastDataEventTime;
  }

  public getTelemetry() {
    return {
      state: this.state,
      lastEventId: this.lastEventId,
      lastPingTime: this.lastPingTime,
      lastDataEventTime: this.lastDataEventTime,
      totalReconnects: this.totalReconnects,
    };
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    for (const cb of this.stateListeners) {
      try {
        cb(next);
      } catch {
        // Ignore listener error
      }
    }
  }

  private dispatchEvent(payload: RealtimeEventPayload): void {
    if (!payload) return;

    // On 'connected', sync sequence number if server restarted with a lower sequenceId
    if (payload.type === 'connected') {
      const serverSeq = Number(payload.data?.sequenceId || payload.id || 0);
      if (serverSeq > 0 && serverSeq < this.lastEventId) {
        this.lastEventId = serverSeq;
        this.seenEventIds.clear();
      } else if (serverSeq > this.lastEventId) {
        this.lastEventId = serverSeq;
      }
    } else if (payload.type === 'live_snapshot') {
      this.lastDataEventTime = Date.now();
    } else if (typeof payload.id === 'number') {
      if (payload.id <= this.lastEventId || this.seenEventIds.has(payload.id)) {
        return; // Duplicate or out-of-order frame dropped
      }
      this.lastEventId = payload.id;
      this.seenEventIds.add(payload.id);
      if (this.seenEventIds.size > 500) {
        const first = this.seenEventIds.values().next().value;
        if (first !== undefined) this.seenEventIds.delete(first);
      }
      this.lastDataEventTime = Date.now();
    }

    const typeHandlers = this.listeners.get(payload.type);
    if (typeHandlers) {
      for (const fn of typeHandlers) {
        try {
          fn(payload);
        } catch {
          // Isolate handler exceptions
        }
      }
    }

    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers) {
      for (const fn of wildcardHandlers) {
        try {
          fn(payload);
        } catch {
          // Isolate handler exceptions
        }
      }
    }
  }

  private startWatchdog(): void {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    // If no frame or activity is observed for 45 seconds, recycle the stream
    this.watchdogTimer = setInterval(() => {
      if (this.state === 'connected' && Date.now() - this.lastPingTime > 45_000) {
        this.cleanupSocket();
        this.scheduleReconnect(500);
      }
    }, 15_000);
  }

  private scheduleReconnect(overrideDelayMs?: number): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.setState('reconnecting');
    this.totalReconnects++;

    const baseDelay =
      overrideDelayMs !== undefined
        ? overrideDelayMs
        : Math.min(15_000, 1000 * Math.pow(1.6, this.reconnectAttempts));
    const jitter = Math.floor(Math.random() * 400);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, baseDelay + jitter);
  }

  private cleanupSocket(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {
        // Ignore close errors
      }
      this.eventSource = null;
    }
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
    this.setState('disconnected');
  }
}

export const realtimeClient = new RealtimeClient();
