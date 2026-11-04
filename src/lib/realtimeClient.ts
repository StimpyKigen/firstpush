/**
 * Mshindi Real-Time EventSource Client
 * 
 * Manages client-side Server-Sent Events (SSE) connection with:
 * 1. Automatic exponential backoff + jitter reconnection.
 * 2. Monotonic sequence deduplication and catch-up recovery via `Last-Event-ID`.
 * 3. 45-second stale heartbeat watchdog to detect silent cellular/NAT drops.
 * 4. Visibility & online/offline awareness (immediate wake-up on tab refocus).
 * 5. Direct store patching hooks for high-performance zero-re-render delta updates.
 */

import type {
  RealtimeDeltaEvent,
  ScoreUpdatePayload,
  IncidentPayload,
  StatusChangePayload,
  OddsUpdatePayload,
  FixtureUpsertPayload,
} from './realtimeBroadcaster';

export type RealtimeConnectionState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';

type EventListenerCallback<T> = (data: T) => void;

class RealtimeClient {
  private eventSource: EventSource | null = null;
  private state: RealtimeConnectionState = 'DISCONNECTED';
  private lastReceivedSequence = 0;
  private lastPingTime = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private isStarted = false;

  private stateListeners = new Set<(state: RealtimeConnectionState) => void>();
  private listeners: {
    score_update: Set<EventListenerCallback<ScoreUpdatePayload>>;
    incident: Set<EventListenerCallback<IncidentPayload>>;
    status_change: Set<EventListenerCallback<StatusChangePayload>>;
    odds_update: Set<EventListenerCallback<OddsUpdatePayload>>;
    fixture_upsert: Set<EventListenerCallback<FixtureUpsertPayload>>;
    sync_required: Set<() => void>;
  } = {
    score_update: new Set(),
    incident: new Set(),
    status_change: new Set(),
    odds_update: new Set(),
    fixture_upsert: new Set(),
    sync_required: new Set(),
  };

  constructor() {
    this.setupWindowListeners();
  }

  public getConnectionState(): RealtimeConnectionState {
    return this.state;
  }

  public isConnected(): boolean {
    return this.state === 'CONNECTED';
  }

  public getLastSequence(): number {
    return this.lastReceivedSequence;
  }

  /**
   * Register state change observer
   */
  public onStateChange(listener: (state: RealtimeConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Register listener for specific event types
   */
  public on<K extends keyof typeof this.listeners>(
    eventType: K,
    callback: any
  ): () => void {
    this.listeners[eventType].add(callback);
    return () => {
      this.listeners[eventType].delete(callback);
    };
  }

  private setState(newState: RealtimeConnectionState) {
    if (this.state === newState) return;
    this.state = newState;
    this.stateListeners.forEach((listener) => {
      try {
        listener(newState);
      } catch (err) {
        console.error('[RealtimeClient] Error in state listener:', err);
      }
    });
  }

  /**
   * Initialize and connect to SSE stream
   */
  public start(): void {
    if (typeof window === 'undefined') return;
    if (this.isStarted) return;
    this.isStarted = true;
    this.connect();
    this.startWatchdog();
  }

  /**
   * Stop connection and cleanup
   */
  public stop(): void {
    this.isStarted = false;
    this.clearTimers();
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.setState('DISCONNECTED');
  }

  private connect(): void {
    if (!this.isStarted || typeof window === 'undefined') return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setState(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    const url = new URL('/api/sports/stream', window.location.origin);
    if (this.lastReceivedSequence > 0) {
      url.searchParams.set('lastEventId', `seq_${this.lastReceivedSequence}`);
    }

    try {
      const es = new EventSource(url.toString());
      this.eventSource = es;

      es.onopen = () => {
        this.reconnectAttempts = 0;
        this.lastPingTime = Date.now();
        this.setState('CONNECTED');
      };

      // Server ping (heartbeat)
      es.addEventListener('ping', (e: MessageEvent) => {
        this.lastPingTime = Date.now();
        try {
          const data = JSON.parse(e.data);
          if (data.seq && data.seq > this.lastReceivedSequence) {
            // Server has progressed while idle, keep sequence aligned
            this.lastReceivedSequence = Math.max(this.lastReceivedSequence, data.seq);
          }
        } catch {}
      });

      // Greeting upon connection
      es.addEventListener('connected', (e: MessageEvent) => {
        this.lastPingTime = Date.now();
        try {
          const data = JSON.parse(e.data);
          if (data.currentSequence && this.lastReceivedSequence === 0) {
            this.lastReceivedSequence = data.currentSequence;
          }
        } catch {}
      });

      // Serverless execution duration limit renewal
      es.addEventListener('serverless_renew', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.latestSequence) {
            this.lastReceivedSequence = Math.max(this.lastReceivedSequence, data.latestSequence);
          }
        } catch {}
        // Close current and reconnect seamlessly
        this.reconnect(0);
      });

      // Buffer overflow notification: requires fresh HTTP synchronization
      es.addEventListener('sync_required', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.latestSequence) {
            this.lastReceivedSequence = data.latestSequence;
          }
        } catch {}
        this.listeners.sync_required.forEach((cb) => {
          try {
            cb();
          } catch {}
        });
      });

      // Delta event: SCORE_UPDATE
      es.addEventListener('score_update', (e: MessageEvent) => {
        this.processDeltaEvent<ScoreUpdatePayload>(e, (payload) => {
          this.listeners.score_update.forEach((cb) => cb(payload));
        });
      });

      // Delta event: INCIDENT
      es.addEventListener('incident', (e: MessageEvent) => {
        this.processDeltaEvent<IncidentPayload>(e, (payload) => {
          this.listeners.incident.forEach((cb) => cb(payload));
        });
      });

      // Delta event: STATUS_CHANGE
      es.addEventListener('status_change', (e: MessageEvent) => {
        this.processDeltaEvent<StatusChangePayload>(e, (payload) => {
          this.listeners.status_change.forEach((cb) => cb(payload));
        });
      });

      // Delta event: ODDS_UPDATE
      es.addEventListener('odds_update', (e: MessageEvent) => {
        this.processDeltaEvent<OddsUpdatePayload>(e, (payload) => {
          this.listeners.odds_update.forEach((cb) => cb(payload));
        });
      });

      // Delta event: FIXTURE_UPSERT
      es.addEventListener('fixture_upsert', (e: MessageEvent) => {
        this.processDeltaEvent<FixtureUpsertPayload>(e, (payload) => {
          this.listeners.fixture_upsert.forEach((cb) => cb(payload));
        });
      });

      es.onerror = () => {
        if (!this.isStarted) return;
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private processDeltaEvent<T>(e: MessageEvent, dispatch: (payload: T) => void): void {
    this.lastPingTime = Date.now();
    try {
      const event: RealtimeDeltaEvent = JSON.parse(e.data);
      if (!event) return;

      // Deduplication: ignore events we have already processed
      if (event.sequence && event.sequence <= this.lastReceivedSequence) {
        return;
      }

      if (event.sequence) {
        this.lastReceivedSequence = event.sequence;
      }

      dispatch(event as unknown as T);
    } catch (err) {
      console.warn('[RealtimeClient] Failed to parse delta event:', err);
    }
  }

  /**
   * Schedule reconnection with exponential backoff and jitter
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.setState('RECONNECTING');

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {}
      this.eventSource = null;
    }

    this.reconnectAttempts++;
    // Exponential backoff: base 1s, factor 1.5, max 20s
    const baseDelay = Math.min(20_000, 1000 * Math.pow(1.5, this.reconnectAttempts - 1));
    // Jitter: +/- 20%
    const jitter = baseDelay * (0.8 + Math.random() * 0.4);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, jitter);
  }

  private reconnect(delayMs = 0): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (delayMs <= 0) {
      this.connect();
    } else {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, delayMs);
    }
  }

  /**
   * Watchdog checking every 10s for stale connection (no heartbeat for 45s)
   */
  private startWatchdog(): void {
    if (this.watchdogTimer) return;
    this.watchdogTimer = setInterval(() => {
      if (!this.isStarted) return;

      if (this.state === 'CONNECTED' && this.lastPingTime > 0) {
        const elapsed = Date.now() - this.lastPingTime;
        if (elapsed > 45_000) {
          console.warn('[RealtimeClient] Heartbeat timed out (>45s). Forcing reconnection.');
          this.reconnect(500);
        }
      }
    }, 10_000);
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private setupWindowListeners(): void {
    if (typeof window === 'undefined') return;

    // Instant recovery when returning to tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isStarted) {
        const isStale = Date.now() - this.lastPingTime > 30_000;
        if (this.state !== 'CONNECTED' || isStale) {
          this.reconnect(100);
        }
      }
    });

    // Instant recovery on network restore
    window.addEventListener('online', () => {
      if (this.isStarted) {
        this.reconnectAttempts = 0;
        this.reconnect(200);
      }
    });

    // Set state to disconnected when network is lost
    window.addEventListener('offline', () => {
      this.setState('DISCONNECTED');
    });
  }
}

// Global frontend singleton client
export const realtimeClient = new RealtimeClient();

