/**
 * Leaf session lifecycle event bus connecting `authStore` with client-side
 * stores (`useWallet`, `useSubscriptionStore`) without circular imports.
 */

export type SessionLifecycleListener = (nextUserPhone: string | null) => void;

const listeners = new Set<SessionLifecycleListener>();

export function registerSessionLifecycleListener(listener: SessionLifecycleListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySessionChanged(nextUserPhone: string | null): void {
  const normalized = typeof nextUserPhone === 'string' && nextUserPhone.trim()
    ? nextUserPhone.trim()
    : null;
  for (const listener of Array.from(listeners)) {
    try {
      listener(normalized);
    } catch {
      // Never block auth state transitions if a downstream listener throws
    }
  }
}

