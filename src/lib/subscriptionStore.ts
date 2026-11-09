import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

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
  loadSubscription: (userId: string) => Promise<void>;
  startTrial: (userId: string, meta?: { phone?: string; username?: string }) => Promise<{ ok: boolean; error?: string }>;
  verifyPayment: (
    userId: string,
    params: { plan: 'weekly' | 'monthly'; mpesaCode: string; amountKsh?: number; phone?: string; username?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  restoreSubscription: (userId: string) => Promise<boolean>;
  hasPremiumAccess: () => boolean;
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

      loadSubscription: async (userId: string) => {
        if (!userId) return;
        const cleanUserId = userId.trim();

        // Attach real-time Firestore listener if user changed
        if (get().activeUserId !== cleanUserId) {
          if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            firestoreUnsubscribe = null;
          }

          set({ activeUserId: cleanUserId, isLoading: true });

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

        // Authoritative fetch from server
        try {
          const res = await fetch(`/api/subscription/status?userId=${encodeURIComponent(cleanUserId)}`, {
            headers: {
              'x-user-uid': cleanUserId,
            },
          });
          const data = await res.json();
          if (data && data.success) {
            set({
              subscription: data.subscription,
              history: data.history || [],
              isLoading: false,
            });
          }
        } catch (err) {
          console.warn('[subscriptionStore] Failed to fetch server status:', err);
          set({ isLoading: false });
        }
      },

      startTrial: async (userId: string, meta) => {
        const cleanUserId = userId.trim();
        set({ isLoading: true, error: null });

        try {
          const res = await fetch('/api/subscription/trial', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-uid': cleanUserId,
            },
            body: JSON.stringify({
              userId: cleanUserId,
              phone: meta?.phone,
              username: meta?.username,
            }),
          });
          const data = await res.json();

          if (data && data.success) {
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
            headers: {
              'Content-Type': 'application/json',
              'x-user-uid': cleanUserId,
            },
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
            headers: { 'x-user-uid': cleanUserId },
          });
          const data = await res.json();

          if (data && data.success) {
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
    }),
    {
      name: 'mshindi_subscription_store_v1',
      partialize: (state) => ({
        subscription: state.subscription,
        history: state.history,
      }),
    }
  )
);
