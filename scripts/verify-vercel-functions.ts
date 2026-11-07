import fs from 'fs';
import path from 'path';
import sportsHandler from '../api/sports.js';
import tokensHandler from '../api/tokens.js';
import adminHandler from '../api/admin.js';
import homepageFeedHandler from '../api/homepage-feed.js';
import { issueUserSessionToken, setTokenPersistenceEnabled } from '../src/lib/serverTokenEconomy.js';
import { generateAdminToken } from '../src/lib/adminAuthService.js';
import { isSnapshotStoreConfigured, resetSnapshotStoreCacheForTests } from '../src/lib/fixtureSnapshotStore.js';
import { getApiKey } from '../src/lib/sportsFeedService.js';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function listFilesRecursively(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursively(fullPath));
    } else if (entry.isFile() && /\.(ts|js|mjs|cjs)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function createMockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let jsonBody: any = null;
  let rawOutput = '';
  let ended = false;
  const listeners: Record<string, Array<() => void>> = {};

  const res: any = {
    setHeader(k: string, v: string) {
      headers[k.toLowerCase()] = String(v);
      return res;
    },
    writeHead(code: number, hdrs?: Record<string, string>) {
      statusCode = code;
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) {
          headers[k.toLowerCase()] = String(v);
        }
      }
      return res;
    },
    flushHeaders() {},
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: any) {
      jsonBody = payload;
      ended = true;
      return res;
    },
    write(chunk: string) {
      rawOutput += chunk;
      return true;
    },
    end(chunk?: string) {
      if (chunk) rawOutput += chunk;
      ended = true;
      for (const fn of listeners['close'] || []) fn();
      return res;
    },
    on(event: string, fn: () => void) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    get writableEnded() {
      return ended;
    },
    get statusCode() {
      return statusCode;
    },
    get headers() {
      return headers;
    },
    get body() {
      return jsonBody;
    },
    get raw() {
      return rawOutput;
    },
  };

  return res;
}

async function runVerification() {
  console.log('=== MSHINDIROOM VERCEL SERVERLESS FUNCTION LIMIT & PARITY VERIFICATION ===\n');

  // 1. Audit api/ directory function count
  const apiDir = path.join(process.cwd(), 'api');
  const functionFiles = listFilesRecursively(apiDir).map((f) => path.relative(process.cwd(), f).replace(/\\/g, '/'));
  console.log(`[1] Generated Vercel Serverless Function files (${functionFiles.length}/12 Hobby limit):`);
  for (const f of functionFiles) {
    console.log(`    - ${f}`);
  }
  assert(
    functionFiles.length <= 12,
    `Expected <= 12 Serverless Functions for Vercel Hobby plan, found ${functionFiles.length}`
  );
  assert(
    functionFiles.length === 4,
    `Expected exactly 4 consolidated Serverless Functions (api/admin.ts, api/homepage-feed.ts, api/sports.ts, api/tokens.ts), found ${functionFiles.length}`
  );

  // Verify vercel.json rewrites
  const vercelJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));
  const rewriteSources = (vercelJson.rewrites || []).map((r: any) => r.source);
  assert(rewriteSources.includes('/api/sports/:endpoint*'), 'vercel.json must rewrite /api/sports/:endpoint*');
  assert(rewriteSources.includes('/api/cron/:endpoint*'), 'vercel.json must rewrite /api/cron/:endpoint*');
  assert(rewriteSources.includes('/api/mpesa/verify-code'), 'vercel.json must rewrite /api/mpesa/verify-code');
  assert(rewriteSources.includes('/api/tokens/:endpoint*'), 'vercel.json must rewrite /api/tokens/:endpoint*');
  assert(rewriteSources.includes('/api/admin/:endpoint*'), 'vercel.json must rewrite /api/admin/:endpoint*');
  console.log('    PASS: Function count is 4 (well below 12-function Hobby limit) & vercel.json rewrites verified.\n');

  // 2. Test Consolidated Sports Function (api/sports.ts)
  console.log('[2] Testing consolidated api/sports.ts endpoints (Rewrite & Direct URL parity)...');

  // 2a. /api/sports/status
  {
    const res = createMockRes();
    await sportsHandler({ method: 'GET', url: '/api/sports?endpoint=status', query: { endpoint: 'status' } }, res);
    assert(res.statusCode === 200 && res.body?.success === true && res.body?.diagnostics, '/api/sports/status failed');
  }

  // 2b. /api/sports/leagues
  {
    const res = createMockRes();
    await sportsHandler({ method: 'GET', url: '/api/sports?endpoint=leagues', query: { endpoint: 'leagues' } }, res);
    assert(res.statusCode === 200 && res.body?.success === true && Array.isArray(res.body?.leagues), '/api/sports/leagues failed');
  }

  // 2c. /api/sports/daily-fixtures
  {
    const res = createMockRes();
    await sportsHandler(
      { method: 'GET', url: '/api/sports?endpoint=daily-fixtures', query: { endpoint: 'daily-fixtures' } },
      res
    );
    assert(
      res.statusCode === 200 && res.body?.success === true && Array.isArray(res.body?.fixtures),
      '/api/sports/daily-fixtures failed'
    );
  }

  // 2d. /api/sports/fixtures
  {
    const res = createMockRes();
    await sportsHandler(
      { method: 'GET', url: '/api/sports?endpoint=fixtures&scope=today', query: { endpoint: 'fixtures', scope: 'today' } },
      res
    );
    assert(
      res.statusCode === 200 && res.body?.success === true && Array.isArray(res.body?.fixtures),
      '/api/sports/fixtures failed'
    );
  }

  // 2e. /api/sports/live
  {
    const res = createMockRes();
    await sportsHandler({ method: 'GET', url: '/api/sports/live', query: {} }, res);
    assert(
      res.statusCode === 200 &&
        res.body?.success === true &&
        Array.isArray(res.body?.fixtures) &&
        Array.isArray(res.body?.recentlyFinished),
      '/api/sports/live failed'
    );
  }

  // 2f. /api/sports/match-detail & /api/sports/standings validation
  {
    const resDetail = createMockRes();
    await sportsHandler({ method: 'GET', url: '/api/sports?endpoint=match-detail', query: { endpoint: 'match-detail' } }, resDetail);
    assert(resDetail.statusCode === 400 && resDetail.body?.error === 'Match slug is required.', '/api/sports/match-detail validation failed');

    const resStandings = createMockRes();
    await sportsHandler({ method: 'GET', url: '/api/sports?endpoint=standings', query: { endpoint: 'standings' } }, resStandings);
    assert(resStandings.statusCode === 400 && resStandings.body?.error === 'Competition slug is required.', '/api/sports/standings validation failed');
  }

  // 2g. /api/sports/stream (SSE stream registration + connected frame + stream/status)
  {
    const resStream = createMockRes();
    await sportsHandler(
      {
        method: 'GET',
        url: '/api/sports?endpoint=stream',
        query: { endpoint: 'stream' },
        headers: {},
        on() {},
      },
      resStream
    );
    assert(
      resStream.headers['content-type']?.includes('text/event-stream'),
      'SSE stream must set Content-Type: text/event-stream'
    );
    assert(
      resStream.raw.includes('event: connected'),
      'SSE stream must immediately emit event: connected frame'
    );
    resStream.end();

    const resStreamStatus = createMockRes();
    await sportsHandler(
      {
        method: 'GET',
        url: '/api/sports?endpoint=stream/status',
        query: { endpoint: ['stream', 'status'] },
      },
      resStreamStatus
    );
    assert(
      resStreamStatus.statusCode === 200 && resStreamStatus.body?.success === true && resStreamStatus.body?.metrics,
      '/api/sports/stream/status failed'
    );
  }

  // 2h. /api/cron/weekly-sync & /api/sports/weekly-sync/status
  {
    const resWeeklyStatus = createMockRes();
    await sportsHandler(
      {
        method: 'GET',
        url: '/api/sports?endpoint=weekly-sync/status',
        query: { endpoint: ['weekly-sync', 'status'] },
      },
      resWeeklyStatus
    );
    assert(resWeeklyStatus.statusCode === 200 && resWeeklyStatus.body?.success === true, '/api/sports/weekly-sync/status failed');

    const prevCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test_cron_secret_123';
    const resCronUnauth = createMockRes();
    await sportsHandler(
      {
        method: 'GET',
        url: '/api/sports?endpoint=cron-weekly-sync',
        query: { endpoint: 'cron-weekly-sync' },
        headers: { authorization: 'Bearer wrong_secret' },
      },
      resCronUnauth
    );
    assert(resCronUnauth.statusCode === 401, '/api/cron/weekly-sync must reject unauthorized requests with 401');
    if (prevCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevCronSecret;

    // 2i. /api/sports/sync & /api/sports/sync-live must require admin auth
    const resSyncUnauth = createMockRes();
    await sportsHandler(
      {
        method: 'POST',
        url: '/api/sports?endpoint=sync',
        query: { endpoint: 'sync' },
        headers: {},
        body: {},
      },
      resSyncUnauth
    );
    assert(resSyncUnauth.statusCode === 403, '/api/sports/sync must reject unauthenticated requests with 403');

    const resSyncLiveUnauth = createMockRes();
    await sportsHandler(
      {
        method: 'POST',
        url: '/api/sports?endpoint=sync-live',
        query: { endpoint: 'sync-live' },
        headers: {},
        body: {},
      },
      resSyncLiveUnauth
    );
    assert(resSyncLiveUnauth.statusCode === 403, '/api/sports/sync-live must reject unauthenticated requests with 403');
  }
  console.log('    PASS: All consolidated /api/sports/* and /api/cron/weekly-sync routes verified.\n');

  // 3. Test Consolidated Token Economy & M-Pesa Function (api/tokens.ts)
  console.log('[3] Testing consolidated api/tokens.ts & /api/mpesa/verify-code routes...');
  setTokenPersistenceEnabled(false);
  const testUid = `vercel_test_${Date.now()}`;
  const testPhone = '+254711223344';
  const userToken = issueUserSessionToken(testUid, testPhone);
  const authHeaders = {
    'x-user-token': userToken,
    'x-user-uid': testUid,
    'x-user-phone': testPhone,
  };

  // 3a. POST /api/mpesa/verify-code via Vercel rewrite (?endpoint=mpesa-verify-code)
  {
    const resVerify = createMockRes();
    const mpesaCode = `SHK${Math.random().toString(36).slice(2, 9).toUpperCase()}9`;
    await tokensHandler(
      {
        method: 'POST',
        url: '/api/tokens?endpoint=mpesa-verify-code',
        query: { endpoint: 'mpesa-verify-code' },
        headers: authHeaders,
        body: {
          uid: testUid,
          phone: testPhone,
          code: mpesaCode,
          amount: 200,
          purpose: 'Token Top-Up (KSh 200)',
        },
      },
      resVerify
    );
    assert(
      resVerify.statusCode === 200 && resVerify.body?.success === true && resVerify.body?.tokensAwarded === 2,
      `Expected KSh 200 M-Pesa verification via /api/mpesa/verify-code rewrite to award 2 tokens, got: ${JSON.stringify(resVerify.body)}`
    );
  }

  // 3b. POST /api/tokens/wallet via Vercel rewrite (?endpoint=wallet)
  {
    const resWallet = createMockRes();
    await tokensHandler(
      {
        method: 'POST',
        url: '/api/tokens?endpoint=wallet',
        query: { endpoint: 'wallet' },
        headers: authHeaders,
        body: { userUid: testUid, phone: testPhone },
      },
      resWallet
    );
    assert(
      resWallet.statusCode === 200 &&
        resWallet.body?.success === true &&
        resWallet.body?.wallet?.mshindiTokens === 2 &&
        resWallet.body?.wallet?.activeTokenIds?.length === 2,
      `/api/tokens/wallet rewrite failed to return authoritative balance of 2 tokens: ${JSON.stringify(resWallet.body)}`
    );
  }

  // 3c. POST /api/tokens/spend via Vercel rewrite (?endpoint=spend)
  {
    const resSpend = createMockRes();
    await tokensHandler(
      {
        method: 'POST',
        url: '/api/tokens?endpoint=spend',
        query: { endpoint: 'spend' },
        headers: authHeaders,
        body: {
          userUid: testUid,
          phone: testPhone,
          quantity: 1,
          roomId: 'room-sportpesa-mega',
          roomName: 'SportPesa Mega Room',
          reason: 'Unlocked SportPesa Mega Room',
          idempotencyKey: `spend_${testUid}_1`,
        },
      },
      resSpend
    );
    assert(
      resSpend.statusCode === 200 &&
        resSpend.body?.success === true &&
        resSpend.body?.wallet?.mshindiTokens === 1 &&
        resSpend.body?.consumedTokenIds?.length === 1,
      `/api/tokens/spend rewrite failed to atomically deduct 1 token: ${JSON.stringify(resSpend.body)}`
    );
  }
  console.log('    PASS: All consolidated /api/tokens/* and /api/mpesa/verify-code routes verified.\n');

  // 4. Test Consolidated Admin Function (api/admin.ts)
  console.log('[4] Testing consolidated api/admin.ts routes...');
  {
    const resPin = createMockRes();
    await adminHandler(
      {
        method: 'POST',
        url: '/api/admin?endpoint=verify-pin',
        query: { endpoint: 'verify-pin' },
        headers: {},
        body: { phone: '+254700000000', pin: '0000' },
      },
      resPin
    );
    assert(
      (resPin.statusCode === 401 || resPin.statusCode === 403) && resPin.body?.valid === false,
      '/api/admin/verify-pin must reject unauthorized credentials'
    );

    const resMedia = createMockRes();
    await adminHandler(
      {
        method: 'POST',
        url: '/api/admin?endpoint=upload-media',
        query: { endpoint: 'upload-media' },
        headers: {},
        body: { dataUrl: 'data:image/png;base64,AA==', fileName: 'test.png' },
      },
      resMedia
    );
    assert(resMedia.statusCode === 403, '/api/admin/upload-media must reject unauthenticated uploads with 403');

    const resFixtures = createMockRes();
    await adminHandler(
      {
        method: 'GET',
        url: '/api/admin?endpoint=fixtures',
        query: { endpoint: 'fixtures' },
        headers: {},
      },
      resFixtures
    );
    assert(
      resFixtures.statusCode === 200 && resFixtures.body?.success === true && Array.isArray(resFixtures.body?.fixtures),
      '/api/admin/fixtures GET failed'
    );

    const resFixturesPostUnauth = createMockRes();
    await adminHandler(
      {
        method: 'POST',
        url: '/api/admin?endpoint=fixtures',
        query: { endpoint: 'fixtures' },
        headers: {},
        body: { fixtures: [] },
      },
      resFixturesPostUnauth
    );
    assert(resFixturesPostUnauth.statusCode === 403, 'POST /api/admin/fixtures must reject unauthenticated requests with 403');

    const resFixturesDeleteUnauth = createMockRes();
    await adminHandler(
      {
        method: 'DELETE',
        url: '/api/admin?endpoint=fixtures',
        query: { endpoint: 'fixtures' },
        headers: {},
        body: {},
      },
      resFixturesDeleteUnauth
    );
    assert(resFixturesDeleteUnauth.statusCode === 403, 'DELETE /api/admin/fixtures must reject unauthenticated requests with 403');

    const resBatchDeleteUnauth = createMockRes();
    await adminHandler(
      {
        method: 'DELETE',
        url: '/api/admin?endpoint=fixtures/batch/test-batch-1',
        query: { endpoint: ['fixtures', 'batch', 'test-batch-1'] },
        headers: {},
        body: {},
      },
      resBatchDeleteUnauth
    );
    assert(
      resBatchDeleteUnauth.statusCode === 403,
      'DELETE /api/admin/fixtures/batch/:id must reject unauthenticated requests with 403'
    );

    // Authenticated admin POST /api/admin/fixtures succeeds
    const validAdminToken = generateAdminToken();
    const resFixturesPostAuth = createMockRes();
    await adminHandler(
      {
        method: 'POST',
        url: '/api/admin?endpoint=fixtures',
        query: { endpoint: 'fixtures' },
        headers: { 'x-admin-token': validAdminToken },
        body: { fixtures: [], fileName: 'auth-verify.pdf' },
      },
      resFixturesPostAuth
    );
    assert(
      resFixturesPostAuth.statusCode === 200 && resFixturesPostAuth.body?.success === true,
      'Authenticated POST /api/admin/fixtures failed'
    );
  }
  console.log('    PASS: All consolidated /api/admin/* routes verified.\n');

  // 6. Test Production vs Preview Snapshot Isolation & Strict SPORTS_FEED_API_KEY Enforcement
  console.log('[6] Testing Production vs Preview snapshot isolation & SPORTS_FEED_API_KEY fail-loud check...');
  {
    const prevVercelEnv = process.env.VERCEL_ENV;
    const prevSa = process.env.FIREBASE_SERVICE_ACCOUNT;
    const prevPreviewSa = process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW;
    const prevFeedKey = process.env.SPORTS_FEED_API_KEY;

    try {
      process.env.FIREBASE_SERVICE_ACCOUNT = '{"project_id":"prod-mock"}';
      delete process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW;

      process.env.VERCEL_ENV = 'preview';
      resetSnapshotStoreCacheForTests();
      assert(
        isSnapshotStoreConfigured() === false,
        'Preview deployment must NOT read Production FIREBASE_SERVICE_ACCOUNT when FIREBASE_SERVICE_ACCOUNT_PREVIEW is unset'
      );

      process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW = '{"project_id":"preview-mock"}';
      resetSnapshotStoreCacheForTests();
      assert(
        isSnapshotStoreConfigured() === true,
        'Preview deployment must accept dedicated FIREBASE_SERVICE_ACCOUNT_PREVIEW'
      );

      process.env.VERCEL_ENV = 'production';
      delete process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW;
      resetSnapshotStoreCacheForTests();
      assert(
        isSnapshotStoreConfigured() === true,
        'Production deployment must read FIREBASE_SERVICE_ACCOUNT'
      );

      delete process.env.SPORTS_FEED_API_KEY;
      let threwMissingKey = false;
      try {
        getApiKey();
      } catch (err: any) {
        threwMissingKey = String(err?.message || '').includes('SPORTS_FEED_API_KEY');
      }
      assert(threwMissingKey, 'getApiKey() must fail loudly when SPORTS_FEED_API_KEY is unset');
    } finally {
      if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevVercelEnv;
      if (prevSa === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT;
      else process.env.FIREBASE_SERVICE_ACCOUNT = prevSa;
      if (prevPreviewSa === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW;
      else process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW = prevPreviewSa;
      if (prevFeedKey === undefined) delete process.env.SPORTS_FEED_API_KEY;
      else process.env.SPORTS_FEED_API_KEY = prevFeedKey;
      resetSnapshotStoreCacheForTests();
    }
  }
  console.log('    PASS: Production/Preview snapshot isolation & strict SPORTS_FEED_API_KEY enforcement verified.\n');

  // 5. Test Homepage Feed Function (api/homepage-feed.ts)
  console.log('[5] Testing api/homepage-feed.ts routes...');
  {
    const resFeedGet = createMockRes();
    await homepageFeedHandler({ method: 'GET', url: '/api/homepage-feed', headers: {} }, resFeedGet);
    assert(
      resFeedGet.statusCode === 200 && resFeedGet.body?.success === true && resFeedGet.body?.feed,
      'GET /api/homepage-feed failed'
    );

    const resFeedPostUnauth = createMockRes();
    await homepageFeedHandler(
      {
        method: 'POST',
        url: '/api/homepage-feed',
        headers: {},
        body: { carouselItems: [], videoItems: [] },
      },
      resFeedPostUnauth
    );
    assert(resFeedPostUnauth.statusCode === 403, 'POST /api/homepage-feed must reject unauthorized writes with 403');
  }
  console.log('    PASS: /api/homepage-feed GET & POST security verified.\n');

  console.log('ALL VERCEL SERVERLESS FUNCTION CONSOLIDATION & PARITY CHECKS PASSED!');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
