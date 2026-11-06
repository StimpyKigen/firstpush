import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import {
  recordRouteNavigation,
  saveWindowScrollForEntry,
  saveContainerScrollForEntry,
  getSavedScrollForEntry,
  setScrollRecordingFrozen,
  persistNavigationSnapshotNow,
} from '../lib/navigationHistory';

/**
 * MSHINDIROOM — CENTRALIZED SCROLL RECORDING & CONTENT-AWARE RESTORATION
 *
 * Responsibilities:
 * 1. Enforce `window.history.scrollRestoration = 'manual'` so mobile/desktop browsers
 *    never fight our deterministic per-history-entry scroll restoration.
 * 2. Record window scroll (`window.scrollY`) and nested `[data-scroll-restore-id]` container
 *    scroll positions per `location.key` while the user scrolls.
 * 3. Freeze scroll recording during route transitions (`<AnimatePresence mode="wait">`, 180ms)
 *    so unmount layout collapse to `scrollY = 0` NEVER overwrites the saved scroll position.
 * 4. On `POP` (Back/Forward), wait for the incoming route to mount AND wait for asynchronous
 *    content (fixtures, feed cards, leaderboards) to expand `document.documentElement.scrollHeight`
 *    before completing exact scroll restoration.
 * 5. On `PUSH` to a new route, scroll cleanly to top (or to `#hash` anchor if present) after
 *    the exiting route finishes its transition.
 */
export default function ScrollToTop() {
  const location = useLocation();
  const navType = useNavigationType();
  const activeKeyRef = useRef<string>(location.key || 'default');
  const activePathnameRef = useRef<string>(location.pathname);

  // Disable browser's built-in scroll restoration once on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      try {
        window.history.scrollRestoration = 'manual';
      } catch {}
    }
  }, []);

  // Continuously record window and nested container scroll positions for the active history entry
  useEffect(() => {
    const handleWindowScroll = () => {
      const currentY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      saveWindowScrollForEntry(activeKeyRef.current, currentY);
    };

    const handleContainerScroll = (e: Event) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const restoreId = target.getAttribute('data-scroll-restore-id');
      if (restoreId) {
        saveContainerScrollForEntry(activeKeyRef.current, restoreId, target.scrollTop, target.scrollLeft);
      }
    };

    const handlePageHide = () => {
      persistNavigationSnapshotNow();
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    document.addEventListener('scroll', handleContainerScroll, { passive: true, capture: true });
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      document.removeEventListener('scroll', handleContainerScroll, { capture: true });
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  // Handle route changes: freeze scroll recording during transition, then restore on POP or reset on PUSH
  useEffect(() => {
    const currentKey = location.key || 'default';
    const currentPathname = location.pathname;

    // Immediately freeze scroll recording so exiting route unmount cannot overwrite saved scrollY with 0
    setScrollRecordingFrozen(true);

    activeKeyRef.current = currentKey;
    activePathnameRef.current = currentPathname;

    recordRouteNavigation(location, navType);

    let cancelled = false;
    let rafId: number | null = null;
    let timeoutIds: Array<ReturnType<typeof setTimeout>> = [];
    let resizeObserver: ResizeObserver | null = null;

    const cleanup = () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      timeoutIds.forEach((id) => clearTimeout(id));
      timeoutIds = [];
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
    };

    const scheduleTimeout = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        if (!cancelled) fn();
      }, ms);
      timeoutIds.push(id);
    };

    if (navType === 'POP') {
      const saved = getSavedScrollForEntry(currentKey, currentPathname);
      const targetY = saved?.scrollY ?? 0;
      const targetContainers = saved?.containerScrolls ?? {};

      const applyContainerScrolls = () => {
        const containerEntries = Object.entries(targetContainers);
        if (containerEntries.length === 0) return;
        containerEntries.forEach(([id, pos]) => {
          const el = document.querySelector<HTMLElement>(`[data-scroll-restore-id="${id}"]`);
          if (el) {
            if (Math.abs(el.scrollTop - pos.top) > 1) el.scrollTop = pos.top;
            if (Math.abs(el.scrollLeft - pos.left) > 1) el.scrollLeft = pos.left;
          }
        });
      };

      const attemptScrollRestore = (): boolean => {
        if (cancelled) return false;
        applyContainerScrolls();

        if (targetY <= 0) {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
          return true;
        }

        const docHeight = Math.max(
          document.documentElement.scrollHeight,
          document.body?.scrollHeight || 0
        );
        const maxScrollableY = Math.max(0, docHeight - window.innerHeight);

        window.scrollTo({ top: targetY, left: 0, behavior: 'instant' as ScrollBehavior });

        const currentY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        const reachedTarget = Math.abs(currentY - targetY) <= 4 || maxScrollableY >= targetY - 4;
        return reachedTarget;
      };

      // `<AnimatePresence mode="wait">` takes ~180ms to unmount the old route and mount the new one.
      // We attempt restoration across the transition window and observe DOM height expansion
      // for up to 1,200ms so async fixtures/feed items render before we unfreeze scroll recording.
      const startTime = Date.now();
      const maxWaitMs = 1200;

      const finishRestoration = () => {
        if (cancelled) return;
        if (resizeObserver) {
          resizeObserver.disconnect();
          resizeObserver = null;
        }
        // Unfreeze scroll recording only after restoration is complete
        setScrollRecordingFrozen(false);
      };

      const checkAndRestore = () => {
        if (cancelled) return;
        const elapsed = Date.now() - startTime;
        const reached = attemptScrollRestore();

        // Wait at least 220ms (past the 180ms AnimatePresence exit/enter transition)
        // before considering restoration settled.
        if (elapsed >= 220 && reached) {
          // One final confirmation frame in case images/cards shift layout slightly
          scheduleTimeout(() => {
            attemptScrollRestore();
            finishRestoration();
          }, 60);
          return;
        }

        if (elapsed >= maxWaitMs) {
          attemptScrollRestore();
          finishRestoration();
          return;
        }
      };

      // Poll across the AnimatePresence transition & initial data hydration checkpoints
      [0, 50, 120, 190, 230, 320, 450, 650, 900, 1150].forEach((delayMs) => {
        scheduleTimeout(checkAndRestore, delayMs);
      });

      // Also attach a ResizeObserver to document.body after the incoming route mounts (~190ms)
      // so the instant async fixture cards or feed posts expand the page, we snap to `targetY`.
      scheduleTimeout(() => {
        if (cancelled || typeof ResizeObserver === 'undefined' || !document.body) return;
        resizeObserver = new ResizeObserver(() => {
          checkAndRestore();
        });
        resizeObserver.observe(document.body);
      }, 185);

      // Stop handling if the user manually touches or wheels the page during restoration
      const stopOnUserInteraction = () => {
        finishRestoration();
      };
      window.addEventListener('wheel', stopOnUserInteraction, { passive: true, once: true });
      window.addEventListener('touchmove', stopOnUserInteraction, { passive: true, once: true });

      return () => {
        window.removeEventListener('wheel', stopOnUserInteraction);
        window.removeEventListener('touchmove', stopOnUserInteraction);
        cleanup();
      };
    } else {
      // PUSH or REPLACE navigation
      const scrollNewPage = () => {
        if (cancelled) return;
        if (location.hash) {
          const targetEl = document.querySelector(location.hash);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
            return;
          }
        }
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      };

      // Scroll immediately and again right after the 180ms AnimatePresence swap
      rafId = requestAnimationFrame(scrollNewPage);
      scheduleTimeout(scrollNewPage, 195);
      scheduleTimeout(() => {
        scrollNewPage();
        setScrollRecordingFrozen(false);
      }, 240);

      return cleanup;
    }
  }, [location.key, location.pathname, location.search, location.hash, navType]);

  return null;
}
