import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './authStore';
import { registerSessionLifecycleListener } from './sessionLifecycle';

function getSubscriptionAuthHeaders(userId: string, includeContentType = false): Record<string, string> {
  const headers: Record<string, string> = {
    'x-user-uid': userId,
  };
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const token = useAuth.getState().userSessionToken;
  if (token) {
    headers['x-user-token'] = token;
  }
  return headers;
}

export type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'none';
export type SubscriptionPlan = 'weekly' | 'monthly' | 'trial';

export interface UserSubscription {
  userId: string;
  phone?: string;
  username?: string;
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  trialClaimed: boolean;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  nextPaymentDate: string | null;
  lastPaymentRef: string | null;
  amountKsh: number | null;
  updatedAt: string;
}

export interface SubscriptionHistoryItem {
  id: string;
  userId: string;
  phone?: string;
  username?: string;
  plan: SubscriptionPlan;
  type: 'subscription' | 'trial';
  amountKsh: number;
  transactionRef: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'completed';
  createdAt: string;
}

interface SubscriptionStoreState {
  subscription: UserSubscription | null;
  history: SubscriptionHistoryItem[];
  isPaywallOpen: boolean;
  featureContext: string | null;
  isLoading: boolean;
  isProcessingPayment: boolean;
  error: string | null;
  activeUserId: string | null;

  // Actions
  openPaywall: (featureContext?: string) => void;
  closePaywall: () => void;
  setSubscription: (sub: UserSubscription | null) => void;
  setHistory: (history: SubscriptionHistoryItem[]) => void;
  loadSubscription: (userId: string, options?: { force?: boolean }) => Promise<void>;
  startTrial: (userId: string, meta?: { phone?: string; username?: string }) => Promise<{ ok: boolean; error?: string }>;
  verifyPayment: (
    userId: string,
    params: { plan: 'weekly' | 'monthly'; mpesaCode: string; amountKsh?: number; phone?: string; username?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  restoreSubscription: (userId: string) => Promise<boolean>;
  hasPremiumAccess: () => boolean;
  resetSubscription: () => void;
}

/**
 * Checks whether the given subscription record grants valid access right now
 */
export function checkHasPremiumAccess(sub: UserSubscription | null | undefined): boolean {
  if (!sub) return false;
  const now = Date.now();

  if (sub.status === 'trial') {
    if (!sub.trialExpiresAt) return false;
    const expiresMs = Date.parse(sub.trialExpiresAt);
    return Number.isFinite(expiresMs) && now < expiresMs;
  }

  if (sub.status === 'active') {
    if (!sub.expiresAt) return false;
    const expiresMs = Date.parse(sub.expiresAt);
    return Number.isFinite(expiresMs) && now < expiresMs;
  }

  return false;
}

let firestoreUnsubscribe: (() => void) | null = null;
const SUBSCRIPTION_TTL_MS = 60_000;
const inFlightSubscriptionLoads = new Map<string, Promise<void>>();
const lastSubscriptionLoadedAt = new Map<string, number>();

export function clearSubscriptionFetchCacheForTests(): void {
  inFlightSubscriptionLoads.clear();
  lastSubscriptionLoadedAt.clear();
}

export const useSubscriptionStore = create<SubscriptionStoreState>()(
  persist(
    (set, get) => ({
      subscription: null,
      history: [],
      isPaywallOpen: false,
      featureContext: null,
      isLoading: false,
      isProcessingPayment: false,
      error: null,
      activeUserId: null,

      openPaywall: (featureContext?: string) => {
        set({ isPaywallOpen: true, featureContext: featureContext || null, error: null });
      },

      closePaywall: () => {
        set({ isPaywallOpen: false, featureContext: null, error: null });
      },

      setSubscription: (sub) => {
        set({ subscription: sub });
      },

      setHistory: (history) => {
        set({ history });
      },

      hasPremiumAccess: () => {
        return checkHasPremiumAccess(get().subscription);
      },

      loadSubscription: async (userId: string, options?: { force?: boolean }) => {
        if (!userId) return;
        const cleanUserId = userId.trim();
        if (!cleanUserId) return;

        // Attach real-time Firestore listener if user changed
        if (get().activeUserId !== cleanUserId) {
          if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            firestoreUnsubscribe = null;
          }
          lastSubscriptionLoadedAt.delete(cleanUserId);

          set({
            activeUserId: cleanUserId,
            subscription: null,
            history: [],
            error: null,
            isLoading: true,
          });

          try {
            const subDocRef = doc(db, 'subscriptions', cleanUserId);
            firestoreUnsubscribe = onSnapshot(
              subDocRef,
              (docSnap) => {
                if (docSnap.exists()) {
                  const data = docSnap.data() as UserSubscription;
                  set({ subscription: data });
                }
              },
              (err) => {
                console.warn('[subscriptionStore] Firestore subscription listener notice:', err);
              }
            );
          } catch (err) {
            console.warn('[subscriptionStore] Could not attach listener:', err);
          }
        }

        // Skip redundant network fetches if fresh within TTL and already populated
        const lastLoaded = lastSubscriptionLoadedAt.get(cleanUserId) || 0;
        if (
          !options?.force &&
          get().activeUserId === cleanUserId &&
          get().subscription !== null &&
          Date.now() - lastLoaded < SUBSCRIPTION_TTL_MS
        ) {
          if (get().isLoading) set({ isLoading: false });
          return;
        }

        const existingInFlight = inFlightSubscriptionLoads.get(cleanUserId);
        if (existingInFlight) {
          return existingInFlight;
        }

        const task = (async () => {
          try {
            const signal = typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
              ? AbortSignal.timeout(8000)
              : undefined;
            const res = await fetch(`/api/subscription/status?userId=${encodeURIComponent(cleanUserId)}`, {
              headers: getSubscriptionAuthHeaders(cleanUserId),
              credentials: 'include',
              signal,
            });
            const data = await res.json();
            if (data && data.success) {
              lastSubscriptionLoadedAt.set(cleanUserId, Date.now());
              set({
                subscription: data.subscription,
                history: data.history || [],
                isLoading: false,
              });
            } else {
              set({ isLoading: false });
            }
          } catch (err) {
            console.warn('[subscriptionStore] Failed to fetch server status:', err);
            set({ isLoading: false });
          } finally {
            inFlightSubscriptionLoads.delete(cleanUserId);
          }
        })();

        inFlightSubscriptionLoads.set(cleanUserId, task);
        return task;
      },

      startTrial: async (userId: string, meta) => {
        const cleanUserId = userId.trim();
        set({ isLoading: true, error: null });

        try {
          const res = await fetch('/api/subscription/trial', {
            method: 'POST',
            headers: getSubscriptionAuthHeaders(cleanUserId, true),
            credentials: 'include',
            body: JSON.stringify({
              userId: cleanUserId,
              phone: meta?.phone,
              username: meta?.username,
            }),
          });
          const data = await res.json();

          if (data && data.success) {
            lastSubscriptionLoadedAt.set(cleanUserId, Date.now());
            set({
              subscription: data.subscription,
              history: data.history || get().history,
              isLoading: false,
              isPaywallOpen: false,
              error: null,
            });
            return { ok: true };
          } else {
            const err = data?.error || 'Failed to start free trial.';
            set({ isLoading: false, error: err });
            return { ok: false, error: err };
          }
        } catch (err: any) {
          const errMsg = err?.message || 'Network error while starting trial.';
          set({ isLoading: false, error: errMsg });
          return { ok: false, error: errMsg };
        }
      },

      verifyPayment: async (userId: string, params) => {
        const cleanUserId = userId.trim();
        set({ isProcessingPayment: true, error: null });

        try {
          const res = await fetch('/api/subscription/verify-payment', {
            method: 'POST',
            headers: getSubscriptionAuthHeaders(cleanUserId, true),
            credentials: 'include',
            body: JSON.stringify({
              userId: cleanUserId,
              plan: params.plan,
              mpesaCode: params.mpesaCode,
              amountKsh: params.amountKsh || (params.plan === 'weekly' ? 20 : 75),
              phone: params.phone,
              username: params.username,
            }),
          });
          const data = await res.json();

          if (data && data.success) {
            lastSubscriptionLoadedAt.set(cleanUserId, Date.now());
            set({
              subscription: data.subscription,
              history: data.history || get().history,
              isProcessingPayment: false,
              isPaywallOpen: false,
              error: null,
            });
            return { ok: true };
          } else {
            const err = data?.error || 'Payment verification failed.';
            set({ isProcessingPayment: false, error: err });
            return { ok: false, error: err };
          }
        } catch (err: any) {
          const errMsg = err?.message || 'Network error while verifying payment.';
          set({ isProcessingPayment: false, error: errMsg });
          return { ok: false, error: errMsg };
        }
      },

      restoreSubscription: async (userId: string) => {
        const cleanUserId = userId.trim();
        set({ isLoading: true, error: null });

        try {
          const res = await fetch(`/api/subscription/restore?userId=${encodeURIComponent(cleanUserId)}`, {
            headers: getSubscriptionAuthHeaders(cleanUserId),
            credentials: 'include',
          });
          const data = await res.json();

          if (data && data.success) {
            lastSubscriptionLoadedAt.set(cleanUserId, Date.now());
            set({
              subscription: data.subscription,
              history: data.history || [],
              isLoading: false,
            });
            return checkHasPremiumAccess(data.subscription);
          }
          set({ isLoading: false });
          return false;
        } catch (err) {
          console.warn('[subscriptionStore] Restore failed:', err);
          set({ isLoading: false });
          return false;
        }
      },

      resetSubscription: () => {
        if (firestoreUnsubscribe) {
          firestoreUnsubscribe();
          firestoreUnsubscribe = null;
        }
        inFlightSubscriptionLoads.clear();
        lastSubscriptionLoadedAt.clear();
        set({
          subscription: null,
          history: [],
          activeUserId: null,
          isLoading: false,
          isProcessingPayment: false,
          isPaywallOpen: false,
          featureContext: null,
          error: null,
        });
      },
    }),
    {
      name: 'mshindi_subscription_store_v1',
      partialize: (state) => ({
        activeUserId: state.activeUserId,
        subscription: state.subscription,
        history: state.history,
      }),
      merge: (persistedState: any, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return currentState;
        }
        const activePhone = useAuth.getState().currentPhone;
        const persistedOwner =
          typeof persistedState.activeUserId === 'string' && persistedState.activeUserId.trim()
            ? persistedState.activeUserId.trim()
            : null;
        if (!activePhone || !persistedOwner || persistedOwner !== activePhone) {
          return {
            ...currentState,
            activeUserId: null,
            subscription: null,
            history: [],
          };
        }
        return {
          ...currentState,
          activeUserId: persistedOwner,
          subscription: persistedState.subscription || null,
          history: Array.isArray(persistedState.history) ? persistedState.history : [],
        };
      },
    }
  )
);

registerSessionLifecycleListener((nextUserPhone) => {
  const sub = useSubscriptionStore.getState();
  if (!nextUserPhone || sub.activeUserId !== nextUserPhone) {
    sub.resetSubscription();
  }
});
