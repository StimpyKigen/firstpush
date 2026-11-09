import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Classic } from '../loading-ui/classic';
import { SuccessCheck } from '../transitions/SuccessCheck';
import { refreshHomepageFeed } from '../../lib/homepageFeedStore';
import { refreshFreeMatches } from '../../lib/freeMatches';
import { useAuth } from '../../lib/authStore';
import { useSubscriptionStore } from '../../lib/subscriptionStore';
import { useWallet } from '../../lib/store';

type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'success' | 'error';

const PULL_THRESHOLD = 80;
const MAX_PULL = 115;

/**
 * Detects if the app is currently running as an installed PWA.
 * As requested, the custom pull-to-refresh gesture only activates in standalone PWA mode
 * so standard browser tabs retain native browser mechanics without conflict.
 */
function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

export function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [state, setState] = useState<PullState>('idle');

  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isTracking = useRef(false);
  const isEligible = useRef(false);
  const stateRef = useRef<PullState>('idle');

  // Keep stateRef up to date for touch event handlers
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const executeRefresh = useCallback(async () => {
    setState('refreshing');
    setPullDistance(62);

    try {
      // 1. Authoritative data revalidation without remounting or page reload
      const promises: Promise<unknown>[] = [
        refreshHomepageFeed().catch(() => {}),
        refreshFreeMatches(true).catch(() => {}),
      ];

      const currentUser = useAuth.getState().getCurrentUser();
      if (currentUser?.phone) {
        promises.push(useSubscriptionStore.getState().loadSubscription(currentUser.phone).catch(() => {}));
        promises.push(useWallet.getState().syncAuthoritativeTokens(currentUser).catch(() => {}));
      }

      // 2. Broadcast event for any page-specific listeners
      window.dispatchEvent(new CustomEvent('mshindi:pull-to-refresh'));

      // Ensure a comfortable minimal duration (~650ms) so user perceives the feedback
      await Promise.all([
        Promise.all(promises),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);

      setState('success');
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([15, 30, 15]);
      }

      // Display the transitions.dev animated Success Check before smoothly retracting
      setTimeout(() => {
        setPullDistance(0);
        setTimeout(() => {
          setState('idle');
        }, 300);
      }, 700);
    } catch {
      setState('error');
      setTimeout(() => {
        setPullDistance(0);
        setTimeout(() => {
          setState('idle');
        }, 300);
      }, 500);
    }
  }, []);

  useEffect(() => {
    // Only bind in installed PWA standalone mode
    if (!isPwaStandalone()) return;

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      if (stateRef.current === 'refreshing' || stateRef.current === 'success') return;

      // Must be at the absolute top of the page
      if (window.scrollY > 0) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ignore interactive form controls
      if (target.closest('input, textarea, select, [contenteditable="true"], button')) {
        return;
      }

      // Ignore open modals, drawers, dialogs, or active live chatroom overlay
      if (target.closest('[role="dialog"], [aria-modal="true"], .live-chat-room-overlay, .modal-open')) {
        return;
      }

      // Check if user is scrolling inside a nested container that is not scrolled to top
      let parent: HTMLElement | null = target;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        if (parent.scrollTop > 0) {
          return;
        }
        parent = parent.parentElement;
      }

      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
      isTracking.current = true;
      isEligible.current = true;
    }

    function handleTouchMove(e: TouchEvent) {
      if (!isTracking.current || !isEligible.current) return;
      if (stateRef.current === 'refreshing' || stateRef.current === 'success') return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - touchStartY.current;
      const deltaX = currentX - touchStartX.current;

      // If user swipes horizontally, immediately cancel to allow carousels and back navigation
      if (Math.abs(deltaX) > Math.abs(deltaY) && pullDistance === 0) {
        isEligible.current = false;
        isTracking.current = false;
        return;
      }

      // If user scrolls up or page moves down, cancel
      if (deltaY <= 0 || window.scrollY > 0) {
        setPullDistance(0);
        if (stateRef.current !== 'idle') setState('idle');
        return;
      }

      // Apply natural resistance curve: damped pull distance
      const dampedDistance = Math.min(MAX_PULL, Math.pow(deltaY, 0.88) * 2.2);

      // Prevent native rubber-band overscroll while pulling
      if (e.cancelable && dampedDistance > 5) {
        e.preventDefault();
      }

      setPullDistance(dampedDistance);

      if (dampedDistance >= PULL_THRESHOLD) {
        if (stateRef.current !== 'ready') {
          setState('ready');
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.(10);
          }
        }
      } else {
        if (stateRef.current !== 'pulling') {
          setState('pulling');
        }
      }
    }

    function handleTouchEnd() {
      if (!isTracking.current) return;
      isTracking.current = false;
      isEligible.current = false;

      if (stateRef.current === 'ready') {
        void executeRefresh();
      } else if (stateRef.current === 'pulling') {
        // Elastic snap back
        setPullDistance(0);
        setState('idle');
      }
    }

    function handleTouchCancel() {
      isTracking.current = false;
      isEligible.current = false;
      if (stateRef.current === 'pulling' || stateRef.current === 'ready') {
        setPullDistance(0);
        setState('idle');
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [executeRefresh, pullDistance]);

  // Don't render anything if completely idle and retracted
  if (pullDistance === 0 && state === 'idle') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={
        state === 'refreshing'
          ? 'Refreshing content'
          : state === 'success'
          ? 'Content refreshed'
          : 'Pull to refresh'
      }
      className={cn(
        'fixed left-1/2 -translate-x-1/2 z-[9999] pointer-events-none transition-transform ease-out',
        state === 'idle' || state === 'refreshing' || state === 'success'
          ? 'duration-300'
          : 'duration-75'
      )}
      style={{
        top: `max(14px, env(safe-area-inset-top, 14px))`,
        transform: `translate(-50%, ${pullDistance > 0 ? pullDistance - 42 : -65}px) scale(${
          state === 'ready'
            ? 1.08
            : state === 'refreshing' || state === 'success'
            ? 1
            : Math.max(0.7, Math.min(1, pullDistance / PULL_THRESHOLD))
        })`,
        opacity: pullDistance > 8 || state === 'refreshing' || state === 'success' ? 1 : 0,
      }}
    >
      {/* Floating Island Capsule */}
      <div className="w-10 h-10 rounded-full bg-white dark:bg-[#202522] border border-[#E6E6D2] dark:border-[#414A43] shadow-lg flex items-center justify-center transition-colors">
        {state === 'refreshing' ? (
          <Classic className="size-5.5 text-[#006C54] dark:text-emerald-400" />
        ) : state === 'success' ? (
          <SuccessCheck active={true} size={20} className="text-[#006C54] dark:text-emerald-400" />
        ) : (
          <Classic
            className={cn(
              'size-5.5 transition-colors duration-150',
              state === 'ready'
                ? 'text-[#006C54] dark:text-emerald-400'
                : 'text-slate-400 dark:text-slate-500'
            )}
            style={{
              transform: `rotate(${pullDistance * 3.5}deg)`,
            }}
          />
        )}
      </div>
    </div>
  );
}

export default PullToRefresh;
