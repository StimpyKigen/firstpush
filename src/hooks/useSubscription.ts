import { useEffect } from 'react';
import { useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';
import { useSubscriptionStore, checkHasPremiumAccess } from '../lib/subscriptionStore';

export function useSubscription() {
  const currentUser = useCurrentUser();
  const openAuthWall = useAuthWallStore((s) => s.openAuthWall);

  const subscription = useSubscriptionStore((s) => s.subscription);
  const history = useSubscriptionStore((s) => s.history);
  const isPaywallOpen = useSubscriptionStore((s) => s.isPaywallOpen);
  const featureContext = useSubscriptionStore((s) => s.featureContext);
  const isLoading = useSubscriptionStore((s) => s.isLoading);
  const isProcessingPayment = useSubscriptionStore((s) => s.isProcessingPayment);
  const error = useSubscriptionStore((s) => s.error);

  const openPaywall = useSubscriptionStore((s) => s.openPaywall);
  const closePaywall = useSubscriptionStore((s) => s.closePaywall);
  const loadSubscription = useSubscriptionStore((s) => s.loadSubscription);
  const startTrial = useSubscriptionStore((s) => s.startTrial);
  const verifyPayment = useSubscriptionStore((s) => s.verifyPayment);
  const restoreSubscription = useSubscriptionStore((s) => s.restoreSubscription);

  // Automatically load subscription when user logs in
  const userId = currentUser?.phone || null;

  useEffect(() => {
    if (userId) {
      void loadSubscription(userId);
    }
  }, [userId, loadSubscription]);

  const hasPremiumAccess = checkHasPremiumAccess(subscription);

  /**
   * Unified entitlement checker for premium actions
   * - If not logged in -> Opens AuthWall
   * - If logged in and subscribed/trial -> Executes onGranted callback
   * - If logged in and NOT subscribed -> Opens PremiumPaywall
   */
  const checkAccess = (onGranted?: () => void, featureName?: string): boolean => {
    if (!currentUser) {
      openAuthWall({
        title: 'Sign In Required',
        message: 'Sign up or log in to access this premium feature on MshindiRoom.',
        actionType: 'details',
      });
      return false;
    }

    if (hasPremiumAccess) {
      onGranted?.();
      return true;
    }

    openPaywall(featureName || 'premium_feature');
    return false;
  };

  return {
    currentUser,
    subscription,
    history,
    hasPremiumAccess,
    isPaywallOpen,
    featureContext,
    isLoading,
    isProcessingPayment,
    error,
    openPaywall,
    closePaywall,
    startTrial: (meta?: { phone?: string; username?: string }) => {
      if (!userId) return Promise.resolve({ ok: false, error: 'User not signed in.' });
      return startTrial(userId, { phone: currentUser?.phone, username: currentUser?.username, ...meta });
    },
    verifyPayment: (params: { plan: 'weekly' | 'monthly'; mpesaCode: string; amountKsh?: number }) => {
      if (!userId) return Promise.resolve({ ok: false, error: 'User not signed in.' });
      return verifyPayment(userId, {
        phone: currentUser?.phone,
        username: currentUser?.username,
        ...params,
      });
    },
    restoreSubscription: () => {
      if (!userId) return Promise.resolve(false);
      return restoreSubscription(userId);
    },
    checkAccess,
  };
}
