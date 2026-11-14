import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { checkDistributedRateLimit } from '../src/lib/rateLimitService';
import { fetchMatchDetail } from '../src/lib/sportscoreService';
import { realtimeBroadcaster } from '../src/lib/realtimeBroadcaster';
import { getActiveSharedClockCountForTests } from '../src/lib/useSharedClock';

function pass(msg: string) {
  console.log(`PASS: ${msg}`);
}

async function run() {
  // --- 1. FND-015a: App startup parallelizes free matches + jackpots ---
  const appSource = fs.readFileSync(path.resolve('src/App.tsx'), 'utf8');
  assert.ok(
    appSource.includes('Promise.allSettled([refreshFreeMatches(), syncJackpotsFromApi()])'),
    'App.tsx startup syncs free matches and jackpots concurrently'
  );
  pass('FND-015a App startup parallelized via Promise.allSettled');

  // --- 2. FND-015b: Single-RTT Upstash /eval Lua rate limit check ---
  const origUrl = process.env.UPSTASH_REDIS_REST_URL;
  const origToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const origFetch = globalThis.fetch;

  process.env.UPSTASH_REDIS_REST_URL = 'https://mock-upstash.example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-upstash-token';

  const upstashCalls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    upstashCalls.push(url);
    assert.ok(url.endsWith('/eval'), `Expected single /eval call, got ${url}`);
    assert.ok(init?.signal, 'Upstash /eval fetch must include AbortSignal.timeout');
    return new Response(JSON.stringify({ result: [1, 60000] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const rl = await checkDistributedRateLimit({
      namespace: 'phase6-test',
      key: '198.51.100.77',
      windowMs: 60_000,
      maxRequests: 5,
    });
    assert.equal(rl.backend, 'upstash');
    assert.equal(rl.allowed, true);
    assert.equal(rl.remaining, 4);
    assert.equal(upstashCalls.length, 1, 'Cold bucket Upstash rate limit must take exactly 1 HTTP RTT');
    pass('FND-015b Upstash single-RTT /eval Lua rate limiting verified');
  } finally {
    globalThis.fetch = origFetch;
    if (origUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = origUrl;
    if (origToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = origToken;
  }

  // --- 3. FND-015c: Bounded concurrency weekly ingestion & sportsFeedService batch disk save ---
  const weeklySource = fs.readFileSync(path.resolve('src/lib/weeklyFixtureService.ts'), 'utf8');
  assert.ok(weeklySource.includes('const DATE_CONCURRENCY = 2;'), 'weeklyFixtureService caps date concurrency');
  assert.ok(
    weeklySource.includes('Promise.allSettled(['),
    'weeklyFixtureService executes 4 tier/daily fetches per date in parallel'
  );

  const sportsFeedSource = fs.readFileSync(path.resolve('src/lib/sportsFeedService.ts'), 'utf8');
  assert.ok(sportsFeedSource.includes('skipDiskSave?: boolean'), 'ingestFixtures supports batch skipDiskSave');
  assert.ok(
    sportsFeedSource.includes('await fs.promises.writeFile(tmpPath') &&
      sportsFeedSource.includes('await fs.promises.rename(tmpPath, filePath)'),
    'sportsFeedService uses async atomic temp-file writes'
  );
  pass('FND-015c weeklyFixtureService bounded concurrency & sportsFeedService batch async save verified');

  // --- 4. FND-015d & FND-016a: Parallel match-detail fallback + AbortSignal timeouts everywhere ---
  const requestedDetailUrls: string[] = [];
  let activeDetailFetches = 0;
  let maxConcurrentDetailFetches = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    requestedDetailUrls.push(url);
    assert.ok(init?.signal, `Fetch to ${url} must include AbortSignal.timeout`);
    activeDetailFetches++;
    maxConcurrentDetailFetches = Math.max(maxConcurrentDetailFetches, activeDetailFetches);
    await new Promise((r) => setTimeout(r, 40));
    activeDetailFetches--;
    if (url.includes('away-vs-home') || url.includes('chelsea-vs-arsenal')) {
      return new Response(
        JSON.stringify({ home_team: 'Arsenal', away_team: 'Chelsea', status: 'in', live_minute: 42 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }) as typeof fetch;

  try {
    const detail = await fetchMatchDetail('Arsenal', 'Chelsea');
    assert.ok(detail, 'Fallback match detail succeeded');
    assert.equal(requestedDetailUrls.length, 2, 'Primary and reverse slug fetched in parallel');
    assert.equal(
      maxConcurrentDetailFetches,
      2,
      `Expected both fallback slugs in flight simultaneously (2), got ${maxConcurrentDetailFetches}`
    );
  } finally {
    globalThis.fetch = origFetch;
  }

  for (const rel of [
    'src/lib/serverAiService.ts',
    'src/lib/firebaseIdTokenVerifier.ts',
    'src/lib/jackpotMirrorService.ts',
    'src/lib/footballApi.ts',
    'src/lib/sportscoreService.ts',
  ]) {
    const content = fs.readFileSync(path.resolve(rel), 'utf8');
    assert.ok(content.includes('AbortSignal.timeout('), `${rel} must configure AbortSignal.timeout`);
  }
  pass('FND-015d/FND-016a parallel match-detail fallback & AbortSignal.timeout verified');

  // --- 5. FND-016b: Visibility guards, shared clock, & SSE signature retention ---
  const matchCenterSrc = fs.readFileSync(path.resolve('src/components/SportScoreMatchCenter.tsx'), 'utf8');
  assert.ok(
    matchCenterSrc.includes('!document.hidden') && matchCenterSrc.includes("addEventListener('visibilitychange'"),
    'SportScoreMatchCenter pauses polling when tab hidden and refreshes on visibility resume'
  );

  const compactRowSrc = fs.readFileSync(path.resolve('src/components/CompactPickRow.tsx'), 'utf8');
  assert.ok(!compactRowSrc.includes('setInterval('), 'CompactPickRow must not create per-row setInterval timers');
  assert.ok(compactRowSrc.includes('useSharedNow('), 'CompactPickRow must use shared singleton clock');
  assert.equal(getActiveSharedClockCountForTests(), 0, 'Zero lingering clock buckets before React mount');

  const reqCloseCbs: Array<() => void> = [];
  const sseRes = {
    headersSent: false,
    setHeader() {},
    writeHead() {},
    write() {
      return true;
    },
    end() {},
  };
  realtimeBroadcaster.broadcastScoreUpdate('m-phase6', 1, 0, "12'", '1H');
  realtimeBroadcaster.registerClient(
    {
      headers: {},
      query: {},
      on(ev: string, cb: () => void) {
        if (ev === 'close') reqCloseCbs.push(cb);
      },
    },
    sseRes
  );
  const dupRes = realtimeBroadcaster.broadcastScoreUpdate('m-phase6', 1, 0, "12'", '1H');
  assert.equal(
    (dupRes as any).duplicateSuppressed,
    true,
    'Connecting new SSE client must not clear lastSignatureByKey or re-emit identical score update'
  );
  for (const cb of reqCloseCbs) cb();
  pass('FND-016b hidden-tab polling guard, shared clock & SSE signature preservation verified');

  console.log('\nALL PHASE 6 REMEDIATION TESTS PASSED');
}

run().catch((err) => {
  console.error('PHASE 6 TEST FAILED:', err);
  process.exit(1);
});

