import { useSyncExternalStore } from 'react';

interface ClockBucket {
  now: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
  visibilityHandler: (() => void) | null;
}

const clockBuckets = new Map<number, ClockBucket>();

function ensureClockStarted(intervalMs: number, bucket: ClockBucket): void {
  if (bucket.timer !== null || typeof window === 'undefined') return;

  const notify = () => {
    bucket.now = Date.now();
    bucket.listeners.forEach((cb) => cb());
  };

  bucket.timer = setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    notify();
  }, intervalMs);

  if (typeof document !== 'undefined') {
    bucket.visibilityHandler = () => {
      if (!document.hidden) notify();
    };
    document.addEventListener('visibilitychange', bucket.visibilityHandler);
  }
}

function stopClockIfUnused(intervalMs: number, bucket: ClockBucket): void {
  if (bucket.listeners.size > 0) return;
  if (bucket.timer !== null) {
    clearInterval(bucket.timer);
    bucket.timer = null;
  }
  if (bucket.visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', bucket.visibilityHandler);
    bucket.visibilityHandler = null;
  }
  clockBuckets.delete(intervalMs);
}

/**
 * Shared singleton clock hook so N mounted rows (e.g. CompactPickRow) reuse a single
 * visibility-aware timer instead of spawning N independent `setInterval` timers.
 */
export function useSharedNow(intervalMs = 5000): number {
  let bucket = clockBuckets.get(intervalMs);
  if (!bucket) {
    bucket = {
      now: Date.now(),
      listeners: new Set(),
      timer: null,
      visibilityHandler: null,
    };
    clockBuckets.set(intervalMs, bucket);
  }

  return useSyncExternalStore(
    (onStoreChange) => {
      const targetBucket = clockBuckets.get(intervalMs) || bucket!;
      targetBucket.listeners.add(onStoreChange);
      ensureClockStarted(intervalMs, targetBucket);
      return () => {
        targetBucket.listeners.delete(onStoreChange);
        stopClockIfUnused(intervalMs, targetBucket);
      };
    },
    () => (clockBuckets.get(intervalMs) || bucket!).now,
    () => (clockBuckets.get(intervalMs) || bucket!).now
  );
}

export function getActiveSharedClockCountForTests(): number {
  return clockBuckets.size;
}

