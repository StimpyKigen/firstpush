import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType, type NavigateFunction, type Location } from 'react-router-dom';

/**
 * MSHINDIROOM — CENTRALIZED NAVIGATION HISTORY, PAGE STATE & SCROLL RESTORATION ENGINE
 *
 * Core Principles:
 * 1. "GO BACK TO WHERE YOU CAME FROM — NOT SOMEWHERE ELSE."
 * 2. Track every visited history entry (`location.key`) with its route path, scroll positions
 *    (window + nested `[data-scroll-restore-id]` containers), and interactive page state.
 * 3. Persist history entries in `sessionStorage` (`mshindi_nav_history_v1`) so scroll positions,
 *    active tabs, selected filters, and history depth survive reloads, iOS Safari tab suspension,
 *    and installed standalone PWA lifecycle transitions.
 * 4. Coordinate an ordered LIFO Overlay / Modal / Drawer stack so pressing Back closes ONLY the
 *    topmost active overlay first without corrupting React Router's `window.history.state.idx`.
 */

const STORAGE_KEY = 'mshindi_nav_history_v1';
const MAX_HISTORY_ENTRIES = 60;

export interface NavigationHistoryEntry {
  key: string;
  pathname: string;
  search: string;
  hash: string;
  scrollY: number;
  containerScrolls: Record<string, { top: number; left: number }>;
  pageState: Record<string, unknown>;
  updatedAt: number;
}

export interface NavigationHistorySnapshot {
  /** Ordered list of visited location keys in this session */
  stackKeys: string[];
  /** Current active index in `stackKeys` */
  currentIndex: number;
  /** Map of location.key -> NavigationHistoryEntry */
  entries: Record<string, NavigationHistoryEntry>;
  /** Map of pathname -> latest location.key (fallback lookup when key changes) */
  latestKeyByPath: Record<string, string>;
}

interface OverlayStackItem {
  id: string;
  close: () => void;
  pushedHistoryState: boolean;
}

// ── Module-Level Singleton State ──────────────────────────────────────────────

let snapshot: NavigationHistorySnapshot = loadSnapshotFromStorage();

/** Active LIFO stack of open modals, drawers, reels, and dropdowns */
const overlayStack: OverlayStackItem[] = [];

/**
 * When true, scroll events are temporarily ignored so route exit transitions,
 * modal scroll locks (`position: fixed`), or unmount DOM collapses to `scrollY = 0`
 * NEVER overwrite the user's actual saved scroll position.
 */
let isScrollRecordingFrozen = false;
let freezeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Flag set when an overlay is closed programmatically (e.g., clicking X or backdrop)
 * and we call `window.history.back()` to pop the synthetic overlay history entry.
 * While `suppressNextPopStateCount > 0`, the resulting `popstate` event is consumed
 * without closing another overlay or triggering route scroll jumps.
 */
let suppressNextPopStateCount = 0;

function createEmptySnapshot(): NavigationHistorySnapshot {
  return {
    stackKeys: [],
    currentIndex: -1,
    entries: {},
    latestKeyByPath: {},
  };
}

function loadSnapshotFromStorage(): NavigationHistorySnapshot {
  if (typeof window === 'undefined') {
    return createEmptySnapshot();
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptySnapshot();
    const parsed = JSON.parse(raw) as Partial<NavigationHistorySnapshot>;
    if (
      !parsed ||
      !Array.isArray(parsed.stackKeys) ||
      typeof parsed.currentIndex !== 'number' ||
      typeof parsed.entries !== 'object' ||
      parsed.entries === null
    ) {
      return createEmptySnapshot();
    }
    return {
      stackKeys: parsed.stackKeys,
      currentIndex: parsed.currentIndex,
      entries: parsed.entries as Record<string, NavigationHistoryEntry>,
      latestKeyByPath: (parsed.latestKeyByPath as Record<string, string>) || {},
    };
  } catch {
    return createEmptySnapshot();
  }
}

let persistScheduled = false;

function schedulePersistSnapshot(): void {
  if (typeof window === 'undefined' || persistScheduled) return;
  persistScheduled = true;
  const persist = () => {
    persistScheduled = false;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage quota errors in private browsing
    }
  };
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(persist);
  } else {
    setTimeout(persist, 16);
  }
}

export function persistNavigationSnapshotNow(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage errors
  }
}

// ── Scroll Recording Freeze Controls ──────────────────────────────────────────

/**
 * Freeze scroll position recording for `durationMs` so layout shifts during
 * route exit/entry transitions or modal scroll locks cannot overwrite the saved scrollY.
 */
export function freezeScrollRecording(durationMs = 350): void {
  isScrollRecordingFrozen = true;
  if (freezeTimer) clearTimeout(freezeTimer);
  freezeTimer = setTimeout(() => {
    isScrollRecordingFrozen = false;
    freezeTimer = null;
  }, durationMs);
}

export function setScrollRecordingFrozen(frozen: boolean): void {
  isScrollRecordingFrozen = frozen;
  if (!frozen && freezeTimer) {
    clearTimeout(freezeTimer);
    freezeTimer = null;
  }
}

export function isScrollRecordingCurrentlyFrozen(): boolean {
  return isScrollRecordingFrozen;
}

// ── History Entry Management ──────────────────────────────────────────────────

export function getOrCreateHistoryEntry(
  key: string,
  pathname: string,
  search = '',
  hash = ''
): NavigationHistoryEntry {
  const existing = snapshot.entries[key];
  if (existing) {
    existing.pathname = pathname;
    existing.search = search;
    existing.hash = hash;
    existing.updatedAt = Date.now();
    return existing;
  }

  const created: NavigationHistoryEntry = {
    key,
    pathname,
    search,
    hash,
    scrollY: 0,
    containerScrolls: {},
    pageState: {},
    updatedAt: Date.now(),
  };
  snapshot.entries[key] = created;
  return created;
}

/**
 * Record a route transition in the centralized navigation history stack.
 * Called automatically by `<ScrollToTop />` whenever `location.key` changes.
 */
export function recordRouteNavigation(
  location: Pick<Location, 'key' | 'pathname' | 'search' | 'hash'>,
  navigationType: 'POP' | 'PUSH' | 'REPLACE'
): NavigationHistoryEntry {
  const key = location.key || 'default';
  const entry = getOrCreateHistoryEntry(key, location.pathname, location.search, location.hash);

  const existingIndex = snapshot.stackKeys.indexOf(key);

  if (navigationType === 'POP') {
    if (existingIndex !== -1) {
      snapshot.currentIndex = existingIndex;
    } else {
      // Browser/PWA popped to an entry from before sessionStorage was initialized
      snapshot.stackKeys.unshift(key);
      snapshot.currentIndex = 0;
    }
  } else if (navigationType === 'REPLACE') {
    if (snapshot.currentIndex >= 0 && snapshot.currentIndex < snapshot.stackKeys.length) {
      snapshot.stackKeys[snapshot.currentIndex] = key;
    } else {
      snapshot.stackKeys = [key];
      snapshot.currentIndex = 0;
    }
  } else {
    // PUSH navigation
    if (existingIndex !== -1) {
      snapshot.currentIndex = existingIndex;
    } else {
      const nextStack = snapshot.stackKeys.slice(0, Math.max(0, snapshot.currentIndex + 1));
      nextStack.push(key);
      if (nextStack.length > MAX_HISTORY_ENTRIES) {
        const removed = nextStack.shift();
        if (removed && removed !== key) {
          delete snapshot.entries[removed];
        }
      }
      snapshot.stackKeys = nextStack;
      snapshot.currentIndex = snapshot.stackKeys.length - 1;
    }
  }

  snapshot.latestKeyByPath[location.pathname] = key;
  schedulePersistSnapshot();
  return entry;
}

// ── Scroll Position Saving & Retrieval ────────────────────────────────────────

export function saveWindowScrollForEntry(key: string, scrollY: number): void {
  if (isScrollRecordingFrozen) return;
  if (typeof document !== 'undefined' && document.body?.style.position === 'fixed') {
    // Never overwrite saved scroll while body is fixed-locked by a modal/menu
    return;
  }
  const entry = snapshot.entries[key];
  if (!entry) return;
  if (scrollY < 0 || !Number.isFinite(scrollY)) return;
  entry.scrollY = Math.round(scrollY);
  entry.updatedAt = Date.now();
  schedulePersistSnapshot();
}

export function saveContainerScrollForEntry(
  key: string,
  containerId: string,
  top: number,
  left: number
): void {
  if (isScrollRecordingFrozen) return;
  const entry = snapshot.entries[key];
  if (!entry || !containerId) return;
  entry.containerScrolls[containerId] = {
    top: Math.max(0, Math.round(top)),
    left: Math.max(0, Math.round(left)),
  };
  entry.updatedAt = Date.now();
  schedulePersistSnapshot();
}

export function captureAllScrollPositionsForKey(key: string): void {
  if (typeof window === 'undefined' || !key) return;
  if (document.body?.style.position === 'fixed') return;

  const entry = snapshot.entries[key];
  if (!entry) return;

  const currentY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  if (!isScrollRecordingFrozen && Number.isFinite(currentY) && currentY >= 0) {
    entry.scrollY = Math.round(currentY);
  }

  if (typeof document !== 'undefined') {
    const containers = document.querySelectorAll<HTMLElement>('[data-scroll-restore-id]');
    containers.forEach((el) => {
      const id = el.getAttribute('data-scroll-restore-id');
      if (id) {
        entry.containerScrolls[id] = {
          top: Math.max(0, Math.round(el.scrollTop)),
          left: Math.max(0, Math.round(el.scrollLeft)),
        };
      }
    });
  }

  entry.updatedAt = Date.now();
  schedulePersistSnapshot();
}

export function getSavedScrollForEntry(
  key: string,
  pathname?: string
): { scrollY: number; containerScrolls: Record<string, { top: number; left: number }> } | null {
  const direct = snapshot.entries[key];
  if (direct) {
    return {
      scrollY: direct.scrollY,
      containerScrolls: direct.containerScrolls || {},
    };
  }
  if (pathname) {
    const fallbackKey = snapshot.latestKeyByPath[pathname];
    if (fallbackKey && snapshot.entries[fallbackKey]) {
      const fb = snapshot.entries[fallbackKey];
      return {
        scrollY: fb.scrollY,
        containerScrolls: fb.containerScrolls || {},
      };
    }
  }
  return null;
}

// ── Page State Persistence Per History Entry ──────────────────────────────────

export function getSavedPageState<T>(
  locationKey: string,
  pathname: string,
  stateKey: string
): T | undefined {
  const directEntry = snapshot.entries[locationKey];
  if (directEntry && stateKey in directEntry.pageState) {
    return directEntry.pageState[stateKey] as T;
  }
  // Also support restoring state from the most recent visit to this pathname
  // when returning or switching tabs within the session
  const latestKey = snapshot.latestKeyByPath[pathname];
  if (latestKey && snapshot.entries[latestKey] && stateKey in snapshot.entries[latestKey].pageState) {
    return snapshot.entries[latestKey].pageState[stateKey] as T;
  }
  return undefined;
}

export function savePageState<T>(
  locationKey: string,
  pathname: string,
  stateKey: string,
  value: T
): void {
  const key = locationKey || 'default';
  const entry = getOrCreateHistoryEntry(key, pathname);
  entry.pageState[stateKey] = value;
  snapshot.latestKeyByPath[pathname] = key;
  schedulePersistSnapshot();
}

/**
 * React hook that behaves identically to `useState<T>`, but automatically preserves
 * and restores the state per navigation history entry (and across route visits in the session).
 */
export function useHistoryPageState<T>(
  stateKey: string,
  initialValue: T | (() => T)
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const location = useLocation();
  const navigationType = useNavigationType();
  const locKey = location.key || 'default';

  const resolveInitial = useCallback((): T => {
    // Always restore saved state for this history entry (`locKey`) or when returning via POP
    // or re-entering a previously configured directory view in the same session.
    const directEntry = snapshot.entries[locKey];
    if (directEntry && stateKey in directEntry.pageState) {
      return directEntry.pageState[stateKey] as T;
    }
    if (navigationType === 'POP') {
      const saved = getSavedPageState<T>(locKey, location.pathname, stateKey);
      if (saved !== undefined) return saved;
    }
    // Also check if the user previously configured filters on this exact pathname in this session
    const savedForPath = getSavedPageState<T>(locKey, location.pathname, stateKey);
    if (savedForPath !== undefined) {
      return savedForPath;
    }
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  }, [locKey, location.pathname, navigationType, stateKey, initialValue]);

  const [state, setState] = useState<T>(resolveInitial);

  // When `location.key` changes on POP to another instance of the same route component,
  // sync the state from that history entry.
  const prevKeyRef = useRef(locKey);
  useEffect(() => {
    if (prevKeyRef.current !== locKey) {
      prevKeyRef.current = locKey;
      const directEntry = snapshot.entries[locKey];
      if (directEntry && stateKey in directEntry.pageState) {
        setState(directEntry.pageState[stateKey] as T);
        return;
      }
    }
  }, [locKey, stateKey]);

  // Persist whenever state or locationKey updates
  useEffect(() => {
    savePageState(locKey, location.pathname, stateKey, state);
  }, [locKey, location.pathname, stateKey, state]);

  return [state, setState];
}

// ── Contextual Fallback Resolution ────────────────────────────────────────────

/**
 * Determine the contextual parent route when a page was opened directly via deep link,
 * bookmark, or external share with no prior in-app history entry.
 */
export function resolveContextualFallbackUrl(pathname: string, explicitFallback?: string): string {
  if (explicitFallback && explicitFallback.trim().length > 0) {
    return explicitFallback;
  }
  if (pathname.startsWith('/free/')) {
    return '/free';
  }
  if (pathname.startsWith('/room/')) {
    return '/leaderboard';
  }
  if (pathname.startsWith('/jackpot')) {
    return '/leaderboard';
  }
  return '/';
}

/**
 * Returns true if there is a valid previous in-app history entry we can pop back to.
 */
export function canGoBackInApp(): boolean {
  if (snapshot.currentIndex > 0 && snapshot.stackKeys.length > 1) {
    return true;
  }
  if (typeof window !== 'undefined') {
    const historyState = window.history.state as { idx?: number } | null;
    if (historyState && typeof historyState.idx === 'number' && historyState.idx > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Get the previous history entry in the session stack, if one exists.
 */
export function getPreviousHistoryEntry(): NavigationHistoryEntry | null {
  if (snapshot.currentIndex > 0) {
    const prevKey = snapshot.stackKeys[snapshot.currentIndex - 1];
    return (prevKey && snapshot.entries[prevKey]) || null;
  }
  return null;
}

// ── LIFO Overlay / Modal / Drawer Stack ───────────────────────────────────────

let popStateListenerAttached = false;

function ensureGlobalOverlayPopStateListener(): void {
  if (popStateListenerAttached || typeof window === 'undefined') return;
  popStateListenerAttached = true;

  window.addEventListener('popstate', () => {
    if (suppressNextPopStateCount > 0) {
      suppressNextPopStateCount--;
      return;
    }

    if (overlayStack.length > 0) {
      // Pop and close ONLY the topmost overlay in LIFO order
      const topOverlay = overlayStack.pop();
      if (topOverlay) {
        topOverlay.pushedHistoryState = false;
        topOverlay.close();
      }
    }
  });
}

/**
 * Register an active modal, drawer, reel, or overlay on the LIFO Back stack.
 * Pushes a synthetic history entry that PRESERVES React Router's `{ usr, key, idx }`
 * state so `window.history.state.idx` is NEVER lost or corrupted.
 */
export function pushOverlayToBackStack(id: string, closeCallback: () => void): void {
  ensureGlobalOverlayPopStateListener();

  const existingIdx = overlayStack.findIndex((item) => item.id === id);
  if (existingIdx !== -1) {
    overlayStack[existingIdx].close = closeCallback;
    return;
  }

  let pushedHistoryState = false;
  if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
    try {
      const currentState =
        window.history.state && typeof window.history.state === 'object'
          ? { ...window.history.state }
          : {};
      const activeOverlays = Array.isArray(currentState.__mshindiOverlays)
        ? [...currentState.__mshindiOverlays, id]
        : [id];
      // Preserve React Router's `idx`, `key`, and `usr` fields!
      window.history.pushState(
        {
          ...currentState,
          __mshindiOverlays: activeOverlays,
          __mshindiTopOverlay: id,
        },
        ''
      );
      pushedHistoryState = true;
    } catch {
      pushedHistoryState = false;
    }
  }

  overlayStack.push({
    id,
    close: closeCallback,
    pushedHistoryState,
  });
}

/**
 * Update the close callback for an already-registered overlay without mutating history.
 */
export function updateOverlayCloseCallback(id: string, closeCallback: () => void): void {
  const found = overlayStack.find((item) => item.id === id);
  if (found) {
    found.close = closeCallback;
  }
}

/**
 * Remove an overlay from the LIFO stack when it closes.
 * If it was closed via UI button/backdrop (rather than browser/hardware Back),
 * we cleanly pop its synthetic history entry so the user doesn't have to press
 * Back twice later.
 */
export function removeOverlayFromBackStack(id: string): void {
  const idx = overlayStack.findIndex((item) => item.id === id);
  if (idx === -1) return;

  const [removed] = overlayStack.splice(idx, 1);
  if (
    removed.pushedHistoryState &&
    typeof window !== 'undefined' &&
    window.history &&
    typeof window.history.back === 'function'
  ) {
    const currentTop = window.history.state?.__mshindiTopOverlay;
    if (currentTop === id || Array.isArray(window.history.state?.__mshindiOverlays)) {
      suppressNextPopStateCount++;
      try {
        window.history.back();
      } catch {
        suppressNextPopStateCount = Math.max(0, suppressNextPopStateCount - 1);
      }
    }
  }
}

export function getActiveOverlayCount(): number {
  return overlayStack.length;
}

/**
 * Close the topmost active overlay if any is open.
 * Returns `true` if an overlay was closed, or `false` if no overlays were open.
 */
export function closeTopmostOverlay(): boolean {
  if (overlayStack.length === 0) return false;
  const top = overlayStack[overlayStack.length - 1];
  if (top.pushedHistoryState && typeof window !== 'undefined' && typeof window.history?.back === 'function') {
    // Triggering `window.history.back()` will fire `popstate`, which pops and closes `top`
    window.history.back();
    return true;
  }
  overlayStack.pop();
  top.close();
  return true;
}

// ── Centralized Back Execution ────────────────────────────────────────────────

/**
 * Centralized Back action used by all in-app Back buttons (`BackNavButton`, `useSmartBack`,
 * custom header back buttons, and post-auth return actions).
 *
 * Rules:
 * 1. If a modal/drawer/reel overlay is open on the LIFO stack, close the topmost overlay first.
 * 2. Capture current scroll positions before leaving and freeze scroll recording during transition.
 * 3. If a valid previous in-app history entry exists (`canGoBackInApp()`), execute `navigate(-1)`
 *    to return to the exact previous history entry (with its saved scroll & state).
 * 4. ONLY if no previous in-app history entry exists (e.g., direct deep link in a new tab),
 *    navigate with `{ replace: true }` to the contextual fallback route.
 */
export function executeCentralizedBack(
  navigate: NavigateFunction,
  location: Pick<Location, 'key' | 'pathname'>,
  fallbackUrl?: string
): void {
  if (closeTopmostOverlay()) {
    return;
  }

  const currentKey = location.key || 'default';
  captureAllScrollPositionsForKey(currentKey);
  freezeScrollRecording(400);

  if (canGoBackInApp()) {
    navigate(-1);
  } else {
    const targetFallback = resolveContextualFallbackUrl(location.pathname, fallbackUrl);
    navigate(targetFallback, { replace: true });
  }
}

/**
 * Test/diagnostic helper to inspect or reset the navigation history snapshot.
 */
export function getNavigationHistorySnapshot(): NavigationHistorySnapshot {
  return snapshot;
}

export function resetNavigationHistoryForTests(): void {
  snapshot = createEmptySnapshot();
  overlayStack.length = 0;
  isScrollRecordingFrozen = false;
  suppressNextPopStateCount = 0;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
}

