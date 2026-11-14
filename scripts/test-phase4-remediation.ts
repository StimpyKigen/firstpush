import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clearSubscriptionFetchCacheForTests,
  useSubscriptionStore,
} from '../src/lib/subscriptionStore';
import {
  clearBetSlipEngagementCacheForTests,
  useBetSlipStore,
} from '../src/lib/betSlipStore';
import { resolveSavedReels } from '../src/lib/engagementService';
import {
  clearHomepageFeedRefreshCacheForTests,
  refreshHomepageFeed,
} from '../src/lib/homepageFeedStore';
import { realtimeBroadcaster } from '../src/lib/realtimeBroadcaster';

function pass(msg: string) {
  console.log(`PASS: ${msg}`);
}

async function run() {
  // --- 1. FND-006: Centralized subscription loading, in-flight dedup & 60s TTL ---
  const hookSource = fs.readFileSync(path.resolve('src/hooks/useSubscription.ts'), 'utf8');
  assert.ok(!hookSource.includes('useEffect('), 'useSubscription hook must not execute mount useEffect');
  assert.ok(!hookSource.includes('void loadSubscription('), 'useSubscription hook must not call loadSubscription');

  const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(
    appSource.includes('useSubscriptionStore.getState().loadSubscription('),
    'App.tsx must load subscription once per session boundary'
  );

  clearSubscriptionFetchCacheForTests();
  useSubscriptionStore.getState().resetSubscription();

  const originalFetch = globalThis.fetch;
  let statusFetchCount = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('/api/subscription/status')) {
      statusFetchCount++;
      await new Promise((r) => setTimeout(r, 15));
      return new Response(
        JSON.stringify({
          success: true,
          subscription: {
            userId: '254712345678',
            status: 'active',
            plan: 'monthly',
            trialClaimed: true,
            trialStartedAt: null,
            trialExpiresAt: null,
            activatedAt: '2026-11-01T00:00:00.000Z',
            expiresAt: '2026-12-01T00:00:00.000Z',
            nextPaymentDate: null,
            lastPaymentRef: 'MPESA123',
            amountKsh: 75,
            updatedAt: '2026-11-01T00:00:00.000Z',
          },
          history: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw new Error(`Unexpected fetch URL in subscription test: ${url}`);
  }) as typeof fetch;

  try {
    // 10 simultaneous calls -> must collapse into 1 HTTP request
    await Promise.all(
      Array.from({ length: 10 }, () => useSubscriptionStore.getState().loadSubscription('254712345678'))
    );
    assert.equal(statusFetchCount, 1, '10 concurrent loadSubscription calls must execute 1 HTTP fetch');

    // Subsequent call within 60s TTL -> 0 additional HTTP requests
    await useSubscriptionStore.getState().loadSubscription('254712345678');
    assert.equal(statusFetchCount, 1, 'Subsequent loadSubscription within TTL must reuse cached state');

    // Explicit force bypasses TTL cleanly
    await useSubscriptionStore.getState().loadSubscription('254712345678', { force: true });
    assert.equal(statusFetchCount, 2, 'Forced loadSubscription must fetch authoritative server status');

    useSubscriptionStore.getState().resetSubscription();
    pass('FND-006 subscription mount storm eliminated + in-flight dedup & TTL verified');
  } finally {
    globalThis.fetch = originalFetch;
  }

  // --- 2. FND-019: BetSlip engagement single-pass hydration + saved reel dedup + comment store ---
  clearBetSlipEngagementCacheForTests();
  const emptyPreloaded = await resolveSavedReels('254712345678', [], new Set<string>());
  assert.deepEqual(emptyPreloaded, [], 'resolveSavedReels with empty preloaded Set must return [] without querying');

  const betSlipSource = fs.readFileSync(path.resolve('src/lib/betSlipStore.ts'), 'utf8');
  assert.ok(
    betSlipSource.includes('resolveSavedReels(cleanPhone, get().posts, savedPostIds)'),
    'syncUserEngagements must reuse savedPostIds when calling resolveSavedReels'
  );
  assert.ok(
    betSlipSource.includes('persistPostComment('),
    'betSlipStore.addComment must persist comments asynchronously when authenticated'
  );

  await useBetSlipStore.getState().syncUserEngagements('254700000001');
  const savedAfterSync = await useBetSlipStore.getState().loadSavedReels('254700000001');
  assert.ok(Array.isArray(savedAfterSync), 'loadSavedReels returns array after syncUserEngagements');

  const targetPostId = useBetSlipStore.getState().posts[0]?.id;
  assert.ok(targetPostId, 'Initial community post exists');
  const beforeComments = useBetSlipStore.getState().posts[0]?.comments?.length ?? 0;
  useBetSlipStore.getState().addComment(targetPostId, 'TestPunter', 'Phase 4 comment persistence check');
  const afterComments = useBetSlipStore.getState().posts[0]?.comments?.length ?? 0;
  assert.equal(afterComments, beforeComments + 1, 'addComment appends comment synchronously');
  pass('FND-019 engagement hydration deduplication & comment persistence hook verified');

  // --- 3. FND-013: Homepage feed parallel startup + in-flight & 5s dedup ---
  const feedSource = fs.readFileSync(path.resolve('src/lib/homepageFeedStore.ts'), 'utf8');
  assert.ok(
    feedSource.includes('Promise.allSettled([fetchServerTask(), fetchFirestoreTask()])'),
    'refreshHomepageFeed must fetch server API and Firestore in parallel'
  );

  clearHomepageFeedRefreshCacheForTests();
  const [feedA, feedB, feedC] = await Promise.all([
    refreshHomepageFeed(),
    refreshHomepageFeed(),
    refreshHomepageFeed(),
  ]);
  assert.ok(feedA && Array.isArray(feedA.carouselItems), 'refreshHomepageFeed returns valid feed');
  assert.equal(feedA, feedB, 'Concurrent refreshHomepageFeed calls must resolve same feed');
  assert.equal(feedB, feedC, 'Concurrent refreshHomepageFeed calls must resolve same feed');
  const feedAfterTtl = await refreshHomepageFeed();
  assert.equal(feedAfterTtl, feedA, 'Subsequent refreshHomepageFeed within 5s TTL returns cached feed');
  pass('FND-013 parallel homepage feed refresh & in-flight/TTL deduplication verified');

  // --- 4. FND-014: Edge cache headers, single localStorage write & strict SSE CORS ---
  const vercelRaw = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8'));
  const sportsRules = (vercelRaw.headers || []).filter((h: any) =>
    String(h.source || '').startsWith('/api/sports')
  );
  assert.ok(
    !sportsRules.some((h: any) => h.source === '/api/sports/(.*)'),
    'vercel.json must not clobber cacheable /api/sports/* endpoints with blanket /api/sports/(.*)'
  );
  assert.ok(
    sportsRules.some((h: any) => String(h.source).includes('daily-fixtures') && String(h.source).includes('live')),
    'vercel.json must retain explicit no-store rules for volatile live/stream/daily-fixtures endpoints'
  );

  const freeMatchesSource = fs.readFileSync(path.resolve('src/lib/freeMatches.ts'), 'utf8');
  const persistFnMatch = freeMatchesSource.match(/function persistLiveMatchesToStorage\(\)[\s\S]*?\n\}/);
  assert.ok(persistFnMatch, 'persistLiveMatchesToStorage found');
  assert.ok(
    !persistFnMatch[0].includes('localStorage.setItem(FOOTBALL_CACHE_KEY'),
    'persistLiveMatchesToStorage must not duplicate synchronous FOOTBALL_CACHE_KEY localStorage write'
  );

  const makeMockRes = () => {
    const headers: Record<string, string> = {};
    return {
      headers,
      headersSent: false,
      setHeader(k: string, v: string) {
        headers[k.toLowerCase()] = v;
      },
      writeHead(_code: number, hdrs?: Record<string, string>) {
        if (hdrs) {
          for (const [k, v] of Object.entries(hdrs)) {
            headers[k.toLowerCase()] = v;
          }
        }
      },
      write() {
        return true;
      },
      end() {},
    };
  };

  const makeMockReq = (origin: string) => {
    const listeners: Record<string, Array<() => void>> = {};
    return {
      headers: { origin },
      query: {},
      on(ev: string, cb: () => void) {
        (listeners[ev] ??= []).push(cb);
      },
      emitClose() {
        for (const cb of listeners['close'] || []) cb();
      },
    };
  };

  const evilReq = makeMockReq('https://evil-attacker.example');
  const evilRes = makeMockRes();
  realtimeBroadcaster.registerClient(evilReq, evilRes);
  assert.equal(
    evilRes.headers['access-control-allow-origin'],
    undefined,
    'SSE broadcaster must not emit wildcard * or reflect untrusted origin'
  );
  evilReq.emitClose();

  const trustedReq = makeMockReq('https://mshindi.co.ke');
  const trustedRes = makeMockRes();
  realtimeBroadcaster.registerClient(trustedReq, trustedRes);
  assert.equal(
    trustedRes.headers['access-control-allow-origin'],
    'https://mshindi.co.ke',
    'SSE broadcaster must allow trusted origin explicitly'
  );
  assert.equal(trustedRes.headers['access-control-allow-credentials'], 'true');
  assert.equal(trustedRes.headers['vary'], 'Origin');
  trustedReq.emitClose();

  pass('FND-014 edge cache alignment, single localStorage write & strict SSE CORS verified');
  console.log('\nALL PHASE 4 REMEDIATION TESTS PASSED');
}

run().catch((err) => {
  console.error('PHASE 4 TEST FAILED:', err);
  process.exit(1);
});

