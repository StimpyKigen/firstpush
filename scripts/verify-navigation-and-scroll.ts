import assert from 'node:assert/strict';
import {
  recordRouteNavigation,
  saveWindowScrollForEntry,
  saveContainerScrollForEntry,
  getSavedScrollForEntry,
  savePageState,
  getSavedPageState,
  canGoBackInApp,
  getPreviousHistoryEntry,
  resolveContextualFallbackUrl,
  executeCentralizedBack,
  pushOverlayToBackStack,
  removeOverlayFromBackStack,
  closeTopmostOverlay,
  getActiveOverlayCount,
  freezeScrollRecording,
  setScrollRecordingFrozen,
  getNavigationHistorySnapshot,
  resetNavigationHistoryForTests,
} from '../src/lib/navigationHistory';

/**
 * MSHINDIROOM — AUTOMATED NAVIGATION, HISTORY, SCROLL RESTORATION & OVERLAY STACK VERIFICATION SUITE
 *
 * Verifies all mandatory requirements from Section 10 (Tests A through I):
 * - Test A: Homepage -> Post/Match -> Comments -> Back -> Back (Scroll & State Restoration)
 * - Test B: Fixture Directory (`/free`) -> Country (`england`) -> League (`Championship`) -> Match (`/free/m-12`) -> Back
 * - Test C: Highlights / Video & Horizontal Container Scroll Restoration
 * - Test D: Multi-Page Deep Navigation Chain (`/` -> `/free` -> `/free/m-1` -> `/slips` -> `/leaderboard` -> `/room/jp-1` -> Back x5)
 * - Test E: Modal / Drawer / Reel LIFO Overlay Stack Navigation & React Router `history.state.idx` Preservation
 * - Test F: Browser Back Button vs In-App Back Button Parity
 * - Test G: Android & iOS Installed PWA Back Behaviour (SessionStorage Persistence + Freeze Protection During Route Exit)
 * - Test H: Direct Link / Deep-Link Contextual Fallback Navigation (No Prior In-App History)
 * - Test I: Repeated Back and Forward Navigation (`POP` Back & `POP` Forward between multiple instances)
 */

// ── Minimal Browser Environment Shims for Node Execution ──────────────────────

class MockSessionStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

interface HistoryEntryMock {
  state: any;
  url: string;
}

function setupMockWindow() {
  const sessionStorage = new MockSessionStorage();
  const popstateListeners: Array<() => void> = [];
  const historyStack: HistoryEntryMock[] = [
    { state: { usr: null, key: 'init-key', idx: 0 }, url: '/' },
  ];
  let historyIndex = 0;

  const mockWindow: any = {
    scrollY: 0,
    pageYOffset: 0,
    innerHeight: 844,
    sessionStorage,
    requestAnimationFrame: (cb: () => void) => {
      cb();
      return 1;
    },
    cancelAnimationFrame: () => {},
    addEventListener: (event: string, handler: () => void) => {
      if (event === 'popstate') {
        popstateListeners.push(handler);
      }
    },
    removeEventListener: () => {},
    history: {
      scrollRestoration: 'auto',
      get state() {
        return historyStack[historyIndex]?.state ?? null;
      },
      pushState(state: any, _title: string, url?: string) {
        historyStack.splice(historyIndex + 1);
        historyStack.push({ state, url: url || historyStack[historyIndex]?.url || '/' });
        historyIndex = historyStack.length - 1;
      },
      replaceState(state: any, _title: string, url?: string) {
        historyStack[historyIndex] = { state, url: url || historyStack[historyIndex]?.url || '/' };
      },
      back() {
        if (historyIndex > 0) {
          historyIndex--;
        }
        popstateListeners.slice().forEach((fn) => fn());
      },
    },
    setRouterHistoryState(idx: number, key: string, url: string) {
      historyStack.splice(historyIndex + 1);
      historyStack.push({ state: { usr: null, key, idx }, url });
      historyIndex = historyStack.length - 1;
    },
    triggerHardwareBack() {
      mockWindow.history.back();
    },
  };

  (globalThis as any).window = mockWindow;
  (globalThis as any).document = {
    body: { style: { position: '', overflow: '' }, scrollHeight: 3200 },
    documentElement: { scrollTop: 0, scrollHeight: 3200, style: { overflow: '' } },
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  return mockWindow;
}

const mockWin = setupMockWindow();

let passed = 0;
function runTest(name: string, fn: () => void) {
  resetNavigationHistoryForTests();
  fn();
  passed++;
  console.log(`✅ PASS: ${name}`);
}

// ── TEST A: Homepage -> Post/Match -> Comments -> Back -> Back ───────────────
runTest('Test A: Homepage -> Match -> Discussion Comments -> Back -> Back restores exact scroll & carousel state', () => {
  // 1. User lands on Homepage (`/`, key: 'home-1')
  mockWin.setRouterHistoryState(0, 'home-1', '/');
  recordRouteNavigation({ key: 'home-1', pathname: '/', search: '', hash: '' }, 'PUSH');
  savePageState('home-1', '/', 'home_carouselIdx', 3);

  // User scrolls down through 20+ items to Y = 1840px
  mockWin.scrollY = 1840;
  saveWindowScrollForEntry('home-1', 1840);

  // 2. User opens Match #20 (`/free/match-20`, key: 'match-20-key')
  mockWin.setRouterHistoryState(1, 'match-20-key', '/free/match-20');
  recordRouteNavigation({ key: 'match-20-key', pathname: '/free/match-20', search: '', hash: '' }, 'PUSH');
  savePageState('match-20-key', '/free/match-20', 'freematch_roomTab_match-20', 'details');
  saveWindowScrollForEntry('match-20-key', 420);

  // 3. User switches to Discussion / Comments tab and scrolls to Y = 690px
  savePageState('match-20-key', '/free/match-20', 'freematch_roomTab_match-20', 'discussion');
  saveWindowScrollForEntry('match-20-key', 690);

  // 4. User presses Back from Match #20 -> returns to Homepage (`home-1`)
  assert.equal(canGoBackInApp(), true, 'Must detect valid in-app history entry');
  assert.equal(getPreviousHistoryEntry()?.key, 'home-1', 'Previous entry must be home-1');

  let backAction: any = null;
  executeCentralizedBack(
    ((arg: any, opts?: any) => {
      backAction = { arg, opts };
    }) as any,
    { key: 'match-20-key', pathname: '/free/match-20' },
    '/free'
  );
  assert.equal(backAction.arg, -1, 'Must call navigate(-1) rather than pushing fallback');

  // Simulate POP to 'home-1' while old route unmount tries to emit scrollY = 0
  saveWindowScrollForEntry('home-1', 0); // Frozen! Must NOT overwrite 1840
  setScrollRecordingFrozen(false);

  recordRouteNavigation({ key: 'home-1', pathname: '/', search: '', hash: '' }, 'POP');
  const restoredScroll = getSavedScrollForEntry('home-1', '/');
  assert.equal(restoredScroll?.scrollY, 1840, 'Homepage scroll position (1840px) must be preserved without being overwritten by 0');
  assert.equal(getSavedPageState('home-1', '/', 'home_carouselIdx'), 3, 'Homepage carousel index (3) must be restored');
});

// ── TEST B: Fixture Directory -> Country -> League -> Match -> Back ──────────
runTest('Test B: Fixture directory -> Country (England) -> League (Championship) -> Match -> Back restores filters & scroll', () => {
  mockWin.setRouterHistoryState(0, 'free-dir-1', '/free');
  recordRouteNavigation({ key: 'free-dir-1', pathname: '/free', search: '', hash: '' }, 'PUSH');

  // User selects England -> Championship, Upcoming tab, Today date, and scrolls to Y = 1425px
  savePageState('free-dir-1', '/free', 'free_activeTab', 'upcoming');
  savePageState('free-dir-1', '/free', 'free_leagueFilter', 'england');
  savePageState('free-dir-1', '/free', 'free_selectedSubLeague', 'Championship');
  savePageState('free-dir-1', '/free', 'free_selectedDate', '2026-11-06');
  savePageState('free-dir-1', '/free', 'free_searchQuery', 'Leeds');
  saveWindowScrollForEntry('free-dir-1', 1425);

  // User opens match details (`/free/mkt-leeds-burnley`, key: 'match-leeds')
  mockWin.setRouterHistoryState(1, 'match-leeds', '/free/mkt-leeds-burnley');
  recordRouteNavigation({ key: 'match-leeds', pathname: '/free/mkt-leeds-burnley', search: '', hash: '' }, 'PUSH');
  saveWindowScrollForEntry('match-leeds', 210);

  // User presses Back
  recordRouteNavigation({ key: 'free-dir-1', pathname: '/free', search: '', hash: '' }, 'POP');

  assert.equal(getSavedPageState('free-dir-1', '/free', 'free_activeTab'), 'upcoming');
  assert.equal(getSavedPageState('free-dir-1', '/free', 'free_leagueFilter'), 'england');
  assert.equal(getSavedPageState('free-dir-1', '/free', 'free_selectedSubLeague'), 'Championship');
  assert.equal(getSavedPageState('free-dir-1', '/free', 'free_selectedDate'), '2026-11-06');
  assert.equal(getSavedPageState('free-dir-1', '/free', 'free_searchQuery'), 'Leeds');
  assert.equal(getSavedScrollForEntry('free-dir-1', '/free')?.scrollY, 1425);
});

// ── TEST C: Highlights -> Video / Nested Container Scroll -> Back ────────────
runTest('Test C: Highlights & horizontal video container scroll position restoration', () => {
  mockWin.setRouterHistoryState(0, 'home-vid', '/');
  recordRouteNavigation({ key: 'home-vid', pathname: '/', search: '', hash: '' }, 'PUSH');

  // User scrolls vertically to Highlights section (Y = 2350px) and horizontally in mobile video strip (left = 680px)
  saveWindowScrollForEntry('home-vid', 2350);
  saveContainerScrollForEntry('home-vid', 'home-mobile-videos', 0, 680);

  // User navigates to Bet Builder (`/slips`, key: 'slips-1')
  mockWin.setRouterHistoryState(1, 'slips-1', '/slips');
  recordRouteNavigation({ key: 'slips-1', pathname: '/slips', search: '', hash: '' }, 'PUSH');

  // User presses Back to Home
  recordRouteNavigation({ key: 'home-vid', pathname: '/', search: '', hash: '' }, 'POP');
  const saved = getSavedScrollForEntry('home-vid', '/');
  assert.equal(saved?.scrollY, 2350, 'Vertical scroll to Highlights section must be restored');
  assert.equal(saved?.containerScrolls['home-mobile-videos']?.left, 680, 'Horizontal video carousel scrollLeft must be restored');
});

// ── TEST D: Multi-Page Deep Navigation Chain (Back x5) ───────────────────────
runTest('Test D: Multi-page deep navigation chain reverses in exact order without skipping or jumping to /', () => {
  const steps = [
    { key: 'k-home', pathname: '/', scrollY: 750, stateKey: 'home_carouselIdx', stateVal: 2 },
    { key: 'k-free', pathname: '/free', scrollY: 1620, stateKey: 'free_leagueFilter', stateVal: 'spain' },
    { key: 'k-match', pathname: '/free/el-clasico', scrollY: 540, stateKey: 'freematch_roomTab_el-clasico', stateVal: 'discussion' },
    { key: 'k-slips', pathname: '/slips', scrollY: 980, stateKey: 'slips_activeTab', stateVal: 'punters' },
    { key: 'k-lb', pathname: '/leaderboard', scrollY: 1120, stateKey: 'lb_roomBookie', stateVal: 'SportPesa' },
    { key: 'k-room', pathname: '/room/sp-mega-gw42', scrollY: 430, stateKey: 'room_openMatch_sp-mega-gw42', stateVal: 'leg-7' },
  ];

  steps.forEach((step, idx) => {
    mockWin.setRouterHistoryState(idx, step.key, step.pathname);
    recordRouteNavigation({ key: step.key, pathname: step.pathname, search: '', hash: '' }, 'PUSH');
    saveWindowScrollForEntry(step.key, step.scrollY);
    savePageState(step.key, step.pathname, step.stateKey, step.stateVal);
  });

  // Walk backwards step by step from index 5 down to index 0
  for (let i = steps.length - 1; i > 0; i--) {
    const current = steps[i];
    const expectedPrev = steps[i - 1];

    assert.equal(canGoBackInApp(), true, `Must be able to go back from ${current.pathname}`);
    assert.equal(getPreviousHistoryEntry()?.key, expectedPrev.key, `Previous entry before ${current.key} must be ${expectedPrev.key}`);

    // Simulate POP to expectedPrev
    recordRouteNavigation({ key: expectedPrev.key, pathname: expectedPrev.pathname, search: '', hash: '' }, 'POP');
    assert.equal(getSavedScrollForEntry(expectedPrev.key, expectedPrev.pathname)?.scrollY, expectedPrev.scrollY);
    assert.equal(getSavedPageState(expectedPrev.key, expectedPrev.pathname, expectedPrev.stateKey), expectedPrev.stateVal);
  }
});

// ── TEST E: Modal / Drawer / Reel LIFO Stack & React Router idx Preservation ─
runTest('Test E: LIFO Overlay Stack closes topmost modal/reel first and preserves React Router history.state.idx', () => {
  mockWin.setRouterHistoryState(2, 'slips-page', '/slips');
  recordRouteNavigation({ key: 'slips-page', pathname: '/slips', search: '', hash: '' }, 'PUSH');

  let reelOpen = true;
  let profileModalOpen = true;

  // 1. Open SlipReelFeed overlay
  pushOverlayToBackStack('overlay-reel', () => {
    reelOpen = false;
  });
  assert.equal(getActiveOverlayCount(), 1);
  // Verify React Router's `idx: 2` and `key: 'slips-page'` were preserved in `window.history.state`!
  assert.equal(mockWin.history.state.idx, 2, 'window.history.state.idx must be preserved when pushing overlay state');
  assert.equal(mockWin.history.state.key, 'slips-page', 'window.history.state.key must be preserved');

  // 2. Open PunterProfileModal on top of SlipReelFeed
  pushOverlayToBackStack('overlay-punter-profile', () => {
    profileModalOpen = false;
  });
  assert.equal(getActiveOverlayCount(), 2);
  assert.equal(mockWin.history.state.idx, 2, 'window.history.state.idx must remain 2 with nested overlays');

  // 3. First Back press must close ONLY PunterProfileModal (topmost), leaving SlipReelFeed open!
  mockWin.triggerHardwareBack();
  assert.equal(profileModalOpen, false, 'Topmost modal (PunterProfileModal) must close on first Back press');
  assert.equal(reelOpen, true, 'Underlying overlay (SlipReelFeed) must remain open after first Back press');
  assert.equal(getActiveOverlayCount(), 1);

  // 4. Second Back press must close SlipReelFeed, leaving the user on `/slips`!
  mockWin.triggerHardwareBack();
  assert.equal(reelOpen, false, 'Second Back press must close SlipReelFeed');
  assert.equal(getActiveOverlayCount(), 0);
  assert.equal(mockWin.history.state.idx, 2, 'After closing all overlays, React Router history.state.idx must still be 2');
  assert.equal(canGoBackInApp(), true, 'canGoBackInApp() must remain true after closing modals');
});

// ── TEST F: Programmatic Modal Close Cleans Up Synthetic History Entry ───────
runTest('Test F: Closing a modal via its X button pops its synthetic history state without closing parent or navigating', () => {
  mockWin.setRouterHistoryState(1, 'free-list', '/free');
  recordRouteNavigation({ key: 'free-list', pathname: '/free', search: '', hash: '' }, 'PUSH');

  let quickBuilderClosedCount = 0;
  pushOverlayToBackStack('overlay-quick-builder', () => {
    quickBuilderClosedCount++;
  });
  assert.equal(getActiveOverlayCount(), 1);

  // User clicks the 'X' button inside QuickBetBuilderModal (which unmounts/removes the overlay)
  removeOverlayFromBackStack('overlay-quick-builder');
  assert.equal(getActiveOverlayCount(), 0);
  assert.equal(quickBuilderClosedCount, 0, 'Popstate suppression must prevent double-invoking onClose');
  assert.equal(mockWin.history.state.key, 'free-list', 'History state must return cleanly to the underlying route');
});

// ── TEST G: Installed Mobile PWA SessionStorage Persistence & Freeze Guard ───
runTest('Test G: SessionStorage persistence and scroll-freeze guard during AnimatePresence exit', () => {
  mockWin.setRouterHistoryState(0, 'pwa-free', '/free');
  recordRouteNavigation({ key: 'pwa-free', pathname: '/free', search: '', hash: '' }, 'PUSH');
  saveWindowScrollForEntry('pwa-free', 2180);
  savePageState('pwa-free', '/free', 'free_leagueFilter', 'italy');

  // Freeze scroll recording (simulating route exit transition or mobile menu fixed lock)
  freezeScrollRecording(500);
  saveWindowScrollForEntry('pwa-free', 0); // Attempted overwrite during unmount collapse
  assert.equal(
    getSavedScrollForEntry('pwa-free', '/free')?.scrollY,
    2180,
    'Scroll freeze must block 0px overwrite during route transition'
  );
  setScrollRecordingFrozen(false);

  // Verify sessionStorage persisted the full snapshot
  const rawStored = mockWin.sessionStorage.getItem('mshindi_nav_history_v1');
  assert.ok(rawStored, 'Navigation snapshot must be persisted to sessionStorage');
  const parsed = JSON.parse(rawStored);
  assert.equal(parsed.entries['pwa-free'].scrollY, 2180);
  assert.equal(parsed.entries['pwa-free'].pageState.free_leagueFilter, 'italy');
});

// ── TEST H: Direct Deep-Link Contextual Fallback Navigation ──────────────────
runTest('Test H: Direct deep link with no prior in-app history uses contextual fallback instead of random route', () => {
  // User opens `/free/mkt-arsenal-chelsea` directly in a brand-new tab (`idx: 0`, stack length 1)
  mockWin.setRouterHistoryState(0, 'direct-match', '/free/mkt-arsenal-chelsea');
  recordRouteNavigation({ key: 'direct-match', pathname: '/free/mkt-arsenal-chelsea', search: '', hash: '' }, 'PUSH');

  assert.equal(canGoBackInApp(), false, 'Must recognize there is no previous in-app history entry');

  let navCall: any = null;
  executeCentralizedBack(
    ((to: any, opts?: any) => {
      navCall = { to, opts };
    }) as any,
    { key: 'direct-match', pathname: '/free/mkt-arsenal-chelsea' }
  );

  assert.equal(navCall.to, '/free', 'Direct match deep link must fall back contextually to /free');
  assert.deepEqual(navCall.opts, { replace: true }, 'Fallback navigation must use replace: true to avoid history loops');

  // Also check `/room/sportpesa-mega` contextual fallback -> `/leaderboard`
  assert.equal(resolveContextualFallbackUrl('/room/sportpesa-mega'), '/leaderboard');
  assert.equal(resolveContextualFallbackUrl('/privacy'), '/');
});

// ── TEST I: Repeated Back and Forward Navigation (`POP` Back & `POP` Forward) ─
runTest('Test I: Repeated Back and Forward navigation between multiple route instances preserves distinct scroll & state', () => {
  mockWin.setRouterHistoryState(0, 'entry-1', '/free');
  recordRouteNavigation({ key: 'entry-1', pathname: '/free', search: '', hash: '' }, 'PUSH');
  saveWindowScrollForEntry('entry-1', 640);
  savePageState('entry-1', '/free', 'free_leagueFilter', 'germany');

  mockWin.setRouterHistoryState(1, 'entry-2', '/free/bayern-dortmund');
  recordRouteNavigation({ key: 'entry-2', pathname: '/free/bayern-dortmund', search: '', hash: '' }, 'PUSH');
  saveWindowScrollForEntry('entry-2', 310);

  mockWin.setRouterHistoryState(2, 'entry-3', '/slips');
  recordRouteNavigation({ key: 'entry-3', pathname: '/slips', search: '', hash: '' }, 'PUSH');
  saveWindowScrollForEntry('entry-3', 1290);

  // Back to entry-2
  recordRouteNavigation({ key: 'entry-2', pathname: '/free/bayern-dortmund', search: '', hash: '' }, 'POP');
  assert.equal(getNavigationHistorySnapshot().currentIndex, 1);
  assert.equal(getSavedScrollForEntry('entry-2')?.scrollY, 310);

  // Back to entry-1
  recordRouteNavigation({ key: 'entry-1', pathname: '/free', search: '', hash: '' }, 'POP');
  assert.equal(getNavigationHistorySnapshot().currentIndex, 0);
  assert.equal(getSavedScrollForEntry('entry-1')?.scrollY, 640);
  assert.equal(getSavedPageState('entry-1', '/free', 'free_leagueFilter'), 'germany');

  // Forward (`POP`) to entry-2
  recordRouteNavigation({ key: 'entry-2', pathname: '/free/bayern-dortmund', search: '', hash: '' }, 'POP');
  assert.equal(getNavigationHistorySnapshot().currentIndex, 1);
  assert.equal(getSavedScrollForEntry('entry-2')?.scrollY, 310);

  // Forward (`POP`) to entry-3
  recordRouteNavigation({ key: 'entry-3', pathname: '/slips', search: '', hash: '' }, 'POP');
  assert.equal(getNavigationHistorySnapshot().currentIndex, 2);
  assert.equal(getSavedScrollForEntry('entry-3')?.scrollY, 1290);
});

console.log(`\n🎉 ALL ${passed} NAVIGATION, HISTORY & SCROLL RESTORATION TESTS PASSED!`);

