/**
 * Phase 4 Security & Hardening Verification Suite
 * Covers SSRF & Open-Proxy Blocking, Authenticated/Bounded Chat Cooldown,
 * Gemini AI Input Bounds, Media Upload/Serving Hardening, Preview vs Production Isolation,
 * Economy/Subscription IDOR & Integrity Checks, and Security Headers/CORS Parity across
 * Vercel Serverless Handlers AND Live Express Bundle (`dist/server.cjs`).
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import adminHandler from '../api/admin.js';
import authHandler from '../api/auth.js';
import homepageFeedHandler from '../api/homepage-feed.js';
import sportsHandler from '../api/sports.js';
import subscriptionHandler from '../api/subscription.js';
import tokensHandler from '../api/tokens.js';

import {
  isValidSportScoreSlug,
  sanitizeSportScoreMatchPath,
} from '../src/lib/sportscoreOddsService.js';
import {
  MediaValidationError,
  getPermanentMediaAsset,
  savePermanentMediaAsset,
} from '../src/lib/serverHomepageFeed.js';
import {
  resolveScopedServiceAccountRaw,
  resetSnapshotStoreCacheForTests,
} from '../src/lib/fixtureSnapshotStore.js';
import {
  enforceAuthenticatedChatCooldown,
  getChatCooldownEntryCountForTests,
  issueUserSessionToken,
  resetChatCooldownsForTests,
  resetTokenEconomyForTesting,
} from '../src/lib/serverTokenEconomy.js';
import { handleSubscriptionHttpRequest } from '../src/lib/serverSubscriptionService.js';
import { ADMIN_PHONE_NORMALIZED, verifyAdminPinCredentials } from '../src/lib/adminAuthService.js';

interface MockResponseResult {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: any;
}

async function invokeVercelHandler(
  handler: (req: any, res: any) => Promise<any>,
  opts: {
    method: string;
    url: string;
    query?: Record<string, any>;
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<MockResponseResult> {
  const headersOut: Record<string, string | string[]> = {};
  let statusCode = 200;
  let jsonBody: any = null;

  const res: any = {
    setHeader(k: string, v: any) {
      headersOut[k.toLowerCase()] = v;
    },
    getHeader(k: string) {
      return headersOut[k.toLowerCase()];
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: any) {
      jsonBody = payload;
      return res;
    },
    end() {
      return res;
    },
  };

  await handler(
    {
      method: opts.method,
      url: opts.url,
      query: opts.query || {},
      headers: opts.headers || {},
      body: opts.body,
    },
    res
  );

  return { statusCode, headers: headersOut, body: jsonBody };
}

// Valid 1x1 WebP image payload
const VALID_WEBP_BASE64 = 'UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
const VALID_WEBP_DATA_URL = `data:image/webp;base64,${VALID_WEBP_BASE64}`;

async function main() {
  const cwd = process.cwd();
  const dataDir = path.join(cwd, 'data');
  const dotDataDir = path.join(cwd, '.data');
  const cacheDir = path.join(cwd, '.cache');
  const uploadsUploadsDir = path.join(cwd, 'public', 'images', 'uploads', 'uploads');

  // Snapshot files that tests might touch so repo stays 100% clean afterward
  const trackedPaths = [
    path.join(dataDir, 'homepage_feed.json'),
    path.join(dataDir, 'homepage_posts.json'),
    path.join(dataDir, 'homepage_media.json'),
    path.join(dataDir, 'token_economy.json'),
    path.join(dataDir, 'auth_users.json'),
    path.join(dotDataDir, 'subscriptions.json'),
    path.join(cacheDir, 'homepage_feed.json'),
    path.join(cacheDir, 'homepage_posts.json'),
    path.join(cacheDir, 'homepage_media.json'),
    path.join(cacheDir, 'token_economy.json'),
    path.join(cacheDir, 'auth_users.json'),
  ];
  const snapshots = new Map<string, string | null>();
  for (const p of trackedPaths) {
    snapshots.set(p, fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null);
  }
  const uploadedFilesToRemove: string[] = [];

  // Configure isolated test secrets
  process.env.USER_TOKEN_SECRET = 'phase4-test-user-token-secret-xyz';
  process.env.ADMIN_TOKEN_SECRET = 'phase4-test-admin-token-secret-xyz';
  process.env.ADMIN_PIN = '7410';
  process.env.GEMINI_API_KEY = 'phase4-dummy-gemini-key-for-validation';

  resetTokenEconomyForTesting();
  resetChatCooldownsForTests();

  const adminLogin = verifyAdminPinCredentials(ADMIN_PHONE_NORMALIZED, '7410');
  assert.ok(adminLogin.valid && adminLogin.adminToken, 'Test setup must mint valid admin token');
  const adminToken = adminLogin.adminToken!;

  const userAToken = issueUserSessionToken('254711111111');
  const userBToken = issueUserSessionToken('254722222222');

  let passed = 0;
  let total = 0;
  function pass(msg: string) {
    passed += 1;
    total += 1;
    console.log(`  ✓ [${passed}] ${msg}`);
  }

  let serverProc: ChildProcess | null = null;

  try {
    console.log('\n=== PHASE 4 HARDENING & REGRESSION TEST SUITE ===\n');

    // -------------------------------------------------------------------------
    // 1. SSRF & Open Proxy Input Validation (Unit + Vercel)
    // -------------------------------------------------------------------------
    assert.equal(isValidSportScoreSlug('arsenal-vs-chelsea-12345'), true);
    assert.equal(isValidSportScoreSlug('premier-league_2026'), true);
    assert.equal(isValidSportScoreSlug('../admin'), false);
    assert.equal(isValidSportScoreSlug('premier?next=http://169.254.169.254'), false);
    assert.equal(isValidSportScoreSlug('foo/bar'), false);
    assert.equal(isValidSportScoreSlug(''), false);

    assert.equal(
      sanitizeSportScoreMatchPath('/football/match/arsenal-vs-chelsea/12345/'),
      '/football/match/arsenal-vs-chelsea/12345/'
    );
    assert.equal(
      sanitizeSportScoreMatchPath('https://sportscore.com/football/match/arsenal-vs-chelsea/12345/'),
      '/football/match/arsenal-vs-chelsea/12345/'
    );
    assert.equal(sanitizeSportScoreMatchPath('//169.254.169.254/football/match/x'), null);
    assert.equal(sanitizeSportScoreMatchPath('https://evil.com/football/match/x'), null);
    assert.equal(sanitizeSportScoreMatchPath('/football/match/a@evil.com/x'), null);
    assert.equal(sanitizeSportScoreMatchPath('/football/match/../../etc/passwd'), null);
    assert.equal(sanitizeSportScoreMatchPath('/football/match/a?redirect=http://127.0.0.1'), null);
    assert.equal(sanitizeSportScoreMatchPath('http://127.0.0.1:8080/football/match/x'), null);
    pass('Unit SSRF/open-proxy validators accept legitimate SportScore paths/slugs and reject traversal/foreign hosts/userinfo/query injection');

    const ssrfMatchDetail = await invokeVercelHandler(sportsHandler, {
      method: 'GET',
      url: '/api/sports/match-detail',
      query: { endpoint: 'match-detail', slug: '../admin?foo=bar' },
    });
    assert.equal(ssrfMatchDetail.statusCode, 400);

    const ssrfStandings = await invokeVercelHandler(sportsHandler, {
      method: 'GET',
      url: '/api/sports/standings',
      query: { endpoint: 'standings', slug: 'epl#fragment' },
    });
    assert.equal(ssrfStandings.statusCode, 400);

    const ssrfMatchOdds = await invokeVercelHandler(sportsHandler, {
      method: 'GET',
      url: '/api/sports/match-odds',
      query: { endpoint: 'match-odds', url: '//evil.com/football/match/arsenal-vs-chelsea/1/' },
    });
    assert.equal(ssrfMatchOdds.statusCode, 400);
    pass('Vercel api/sports.ts rejects SSRF payloads on match-detail, standings, and match-odds with HTTP 400');

    // -------------------------------------------------------------------------
    // 2. Authenticated & Memory-Bounded Chat Cooldown
    // -------------------------------------------------------------------------
    const unauthCooldown = await invokeVercelHandler(sportsHandler, {
      method: 'POST',
      url: '/api/sports/chat-cooldown',
      query: { endpoint: 'chat-cooldown' },
      body: { userId: '254799888777' },
    });
    assert.equal(unauthCooldown.statusCode, 401);

    const idorCooldown = await invokeVercelHandler(sportsHandler, {
      method: 'POST',
      url: '/api/sports/chat-cooldown',
      query: { endpoint: 'chat-cooldown' },
      headers: { 'x-user-token': userAToken },
      body: { userId: '254722222222' },
    });
    assert.equal(idorCooldown.statusCode, 403);

    const okCooldown = await invokeVercelHandler(sportsHandler, {
      method: 'POST',
      url: '/api/sports/chat-cooldown',
      query: { endpoint: 'chat-cooldown' },
      headers: { 'x-user-token': userAToken },
      body: { userId: '254711111111' },
    });
    assert.equal(okCooldown.statusCode, 200);
    assert.equal(okCooldown.body?.allowed, true);

    const throttledCooldown = await invokeVercelHandler(sportsHandler, {
      method: 'POST',
      url: '/api/sports/chat-cooldown',
      query: { endpoint: 'chat-cooldown' },
      headers: { 'x-user-token': userAToken },
      body: {},
    });
    assert.equal(throttledCooldown.statusCode, 429);
    assert.equal(throttledCooldown.body?.allowed, false);
    pass('Chat cooldown requires session auth (401 unauth), blocks cross-user lockout DoS (403), and enforces 30s 429 rate limit');

    // Memory bound test across 2300 distinct authenticated users
    for (let i = 0; i < 2300; i++) {
      const uid = `2547${String(10000000 + i).slice(-8)}`;
      const tok = issueUserSessionToken(uid);
      const r = await enforceAuthenticatedChatCooldown({
        headers: { 'x-user-token': tok },
        body: {},
      });
      assert.equal(r.statusCode, 200);
    }
    assert.ok(
      getChatCooldownEntryCountForTests() <= 2000,
      `Expected bounded chat cooldown map <= 2000, got ${getChatCooldownEntryCountForTests()}`
    );
    resetChatCooldownsForTests();
    pass(`Chat cooldown Map stays strictly memory-bounded <= 2000 entries under 2,300 unique authenticated callers`);

    // -------------------------------------------------------------------------
    // 3. Media Upload & Serving Hardening (Unit + Vercel)
    // -------------------------------------------------------------------------
    assert.throws(
      () =>
        savePermanentMediaAsset({
          dataUrl: `data:image/svg+xml;base64,${Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')}`,
          fileName: 'xss.svg',
          folder: 'uploads',
        }),
      MediaValidationError
    );

    assert.throws(
      () =>
        savePermanentMediaAsset({
          dataUrl: `data:image/webp;base64,${Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')}`,
          fileName: 'polyglot.webp',
          folder: 'uploads',
        }),
      MediaValidationError
    );

    assert.throws(
      () =>
        savePermanentMediaAsset({
          dataUrl: VALID_WEBP_DATA_URL,
          fileName: '../../evil.webp',
          folder: 'uploads',
        }),
      MediaValidationError
    );

    assert.throws(
      () =>
        savePermanentMediaAsset({
          dataUrl: VALID_WEBP_DATA_URL,
          fileName: 'ok.webp',
          folder: 'arbitrary-dir',
        }),
      MediaValidationError
    );

    const hugeBase64 = Buffer.alloc(5 * 1024 * 1024 + 32, 0x41).toString('base64');
    assert.throws(
      () =>
        savePermanentMediaAsset({
          dataUrl: `data:image/webp;base64,${hugeBase64}`,
          fileName: 'huge.webp',
          folder: 'uploads',
        }),
      MediaValidationError
    );

    const svgUploadRes = await invokeVercelHandler(adminHandler, {
      method: 'POST',
      url: '/api/admin/upload-media',
      query: { endpoint: 'upload-media' },
      headers: { 'x-admin-token': adminToken },
      body: {
        dataUrl: `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`,
        fileName: 'vector.svg',
        folder: 'uploads',
      },
    });
    assert.equal(svgUploadRes.statusCode, 400);

    const validUploadRes = await invokeVercelHandler(adminHandler, {
      method: 'POST',
      url: '/api/admin/upload-media',
      query: { endpoint: 'upload-media' },
      headers: { 'x-admin-token': adminToken },
      body: {
        dataUrl: VALID_WEBP_DATA_URL,
        fileName: 'phase4-valid-banner.webp',
        folder: 'uploads',
      },
    });
    assert.equal(validUploadRes.statusCode, 200);
    assert.equal(validUploadRes.body?.url, '/images/uploads/uploads/phase4-valid-banner.webp');
    uploadedFilesToRemove.push(path.join(uploadsUploadsDir, 'phase4-valid-banner.webp'));

    const fetchedAsset = getPermanentMediaAsset('uploads', 'phase4-valid-banner.webp');
    assert.ok(fetchedAsset && fetchedAsset.mimeType === 'image/webp');
    assert.equal(getPermanentMediaAsset('../../etc', 'passwd'), null);
    pass('Media upload blocks SVG/HTML/polyglot payloads, >5MB uploads, and folder/filename traversal with 400 while preserving valid raster uploads');

    // -------------------------------------------------------------------------
    // 4. Production vs Preview State Isolation
    // -------------------------------------------------------------------------
    const prevVercelEnv = process.env.VERCEL_ENV;
    const prevProdSa = process.env.FIREBASE_SERVICE_ACCOUNT;
    const prevPreviewSa = process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW;
    try {
      process.env.VERCEL_ENV = 'preview';
      process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'mshindiroom-production' });
      delete process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW;
      resetSnapshotStoreCacheForTests();
      assert.equal(resolveScopedServiceAccountRaw(), undefined);

      process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW = JSON.stringify({ project_id: 'mshindiroom-preview' });
      const previewScoped = resolveScopedServiceAccountRaw();
      assert.ok(previewScoped?.includes('mshindiroom-preview'));

      const feedLibSrc = fs.readFileSync(path.join(cwd, 'src', 'lib', 'serverHomepageFeed.ts'), 'utf-8');
      const subLibSrc = fs.readFileSync(path.join(cwd, 'src', 'lib', 'serverSubscriptionService.ts'), 'utf-8');
      assert.equal(feedLibSrc.includes('resolveScopedServiceAccountRaw()'), true);
      assert.equal(feedLibSrc.includes('process.env.FIREBASE_SERVICE_ACCOUNT'), false);
      assert.equal(subLibSrc.includes('resolveScopedServiceAccountRaw()'), true);
      assert.equal(subLibSrc.includes('process.env.FIREBASE_SERVICE_ACCOUNT'), false);
    } finally {
      if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prevVercelEnv;
      if (prevProdSa === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT;
      else process.env.FIREBASE_SERVICE_ACCOUNT = prevProdSa;
      if (prevPreviewSa === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW;
      else process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW = prevPreviewSa;
      resetSnapshotStoreCacheForTests();
    }
    pass('Production vs Preview isolation enforced across fixtureSnapshotStore, serverHomepageFeed, and serverSubscriptionService');

    // -------------------------------------------------------------------------
    // 5. Economy & Subscription Integrity + IDOR Verification
    // -------------------------------------------------------------------------
    const walletIdor = await invokeVercelHandler(tokensHandler, {
      method: 'GET',
      url: '/api/tokens/wallet',
      query: { endpoint: 'wallet', userId: '254722222222' },
      headers: { 'x-user-token': userAToken },
    });
    assert.equal(walletIdor.statusCode, 403);

    for (const badQty of [-5, 0, 1.5, NaN, 1001, 'hack']) {
      const badSpend = await invokeVercelHandler(tokensHandler, {
        method: 'POST',
        url: '/api/tokens/spend',
        query: { endpoint: 'spend' },
        headers: { 'x-user-token': userAToken },
        body: { quantity: badQty, roomId: 'sportpesa-mega' },
      });
      assert.equal(badSpend.statusCode, 400, `Expected 400 for spend quantity ${String(badQty)}`);
    }

    const forgedOverride = await invokeVercelHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/wallet',
      query: { endpoint: 'wallet' },
      headers: { 'x-user-token': userAToken },
      body: { overrideBalance: 999 },
    });
    assert.equal(forgedOverride.statusCode, 403);

    const subIdor = await invokeVercelHandler(subscriptionHandler, {
      method: 'GET',
      url: '/api/subscription/status',
      query: { endpoint: 'status', userId: '254722222222' },
      headers: { 'x-user-token': userAToken },
    });
    assert.equal(subIdor.statusCode, 403);

    const spoofedTrialRes = await invokeVercelHandler(subscriptionHandler, {
      method: 'POST',
      url: '/api/subscription/trial',
      query: { endpoint: 'trial' },
      headers: { 'x-user-token': userBToken },
      body: { phone: '254799999999', username: 'VictimSpoof' },
    });
    assert.equal(spoofedTrialRes.statusCode, 403);

    const trialRes = await invokeVercelHandler(subscriptionHandler, {
      method: 'POST',
      url: '/api/subscription/trial',
      query: { endpoint: 'trial' },
      headers: { 'x-user-token': userBToken },
      body: { username: 'LegitTrialUser' },
    });
    assert.equal(trialRes.statusCode, 200);
    assert.equal(trialRes.body?.subscription?.userId, '254722222222');
    assert.equal(trialRes.body?.subscription?.phone, '254722222222');
    pass('Economy & subscription endpoints enforce anti-IDOR (403), positive integer spend bounds (1..1000), and block non-admin phone spoofing');

    // -------------------------------------------------------------------------
    // 6. CORS & Security Headers Parity on Vercel Handlers
    // -------------------------------------------------------------------------
    for (const [name, handler, url, query] of [
      ['tokens', tokensHandler, '/api/tokens/wallet', { endpoint: 'wallet' }],
      ['subscription', subscriptionHandler, '/api/subscription/status', { endpoint: 'status' }],
      ['admin', adminHandler, '/api/admin/fixtures', { endpoint: 'fixtures' }],
      ['homepage-feed', homepageFeedHandler, '/api/homepage-feed', {}],
      ['sports', sportsHandler, '/api/sports/status', { endpoint: 'status' }],
      ['auth', authHandler, '/api/auth/me', { endpoint: 'me' }],
    ] as const) {
      const optRes = await invokeVercelHandler(handler as any, {
        method: 'OPTIONS',
        url,
        query: { ...query },
      });
      assert.equal(optRes.headers['access-control-allow-origin'], undefined, `${name} must not expose wildcard CORS`);
      assert.equal(optRes.headers['x-content-type-options'], 'nosniff', `${name} must send nosniff`);
      const allowHeaders = String(optRes.headers['access-control-allow-headers'] || '').toLowerCase();
      assert.equal(allowHeaders.includes('x-admin-pin'), false, `${name} must not list legacy x-admin-pin header`);
    }
    pass('All 6 Vercel API handlers omit wildcard Access-Control-Allow-Origin, drop x-admin-pin, and enforce nosniff');

    // -------------------------------------------------------------------------
    // 7. Live Express Bundle (dist/server.cjs) Parity & Validation Tests
    // -------------------------------------------------------------------------
    const distServerPath = path.join(cwd, 'dist', 'server.cjs');
    assert.ok(fs.existsSync(distServerPath), 'dist/server.cjs must exist');

    serverProc = spawn(process.execPath, [distServerPath], {
      cwd,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        USER_TOKEN_SECRET: process.env.USER_TOKEN_SECRET,
        ADMIN_TOKEN_SECRET: process.env.ADMIN_TOKEN_SECRET,
        ADMIN_PIN: process.env.ADMIN_PIN,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      },
      stdio: 'ignore',
    });

    let healthy = false;
    for (let i = 0; i < 40; i++) {
      try {
        const probe = await fetch('http://127.0.0.1:3000/api/health');
        if (probe.ok) {
          healthy = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    assert.ok(healthy, 'Express dist/server.cjs must respond to /api/health');

    // Express SSRF checks
    const expMatchDetailBad = await fetch('http://127.0.0.1:3000/api/sports/match-detail?slug=../admin');
    assert.equal(expMatchDetailBad.status, 400);
    const expStandingsBad = await fetch('http://127.0.0.1:3000/api/sports/standings?slug=premier?x=1');
    assert.equal(expStandingsBad.status, 400);
    const expMatchOddsBad = await fetch('http://127.0.0.1:3000/api/sports/match-odds?url=https://evil.com/football/match/x');
    assert.equal(expMatchOddsBad.status, 400);
    pass('Live Express bundle rejects SSRF inputs on match-detail, standings, and match-odds with 400');

    // Express chat-cooldown checks
    const expCdUnauth = await fetch('http://127.0.0.1:3000/api/sports/chat-cooldown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '254799888777' }),
    });
    assert.equal(expCdUnauth.status, 401);

    const expCdIdor = await fetch('http://127.0.0.1:3000/api/sports/chat-cooldown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-token': userAToken },
      body: JSON.stringify({ userId: '254722222222' }),
    });
    assert.equal(expCdIdor.status, 403);
    pass('Live Express /api/sports/chat-cooldown enforces authentication (401) and anti-impersonation (403)');

    // Express Gemini input bounds
    const expGeminiBadHist = await fetch('http://127.0.0.1:3000/api/gemini/support-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hi Ava', history: 'not-an-array' }),
    });
    assert.equal(expGeminiBadHist.status, 400);

    const expGeminiHugeMsg = await fetch('http://127.0.0.1:3000/api/gemini/support-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'x'.repeat(1001) }),
    });
    assert.equal(expGeminiHugeMsg.status, 400);

    const expAdvisorHuge = await fetch('http://127.0.0.1:3000/api/gemini/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'a'.repeat(1501), mode: 'standard' }),
    });
    assert.equal(expAdvisorHuge.status, 400);

    const expAdvisorBadMode = await fetch('http://127.0.0.1:3000/api/gemini/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Tips', mode: 'system-override' }),
    });
    assert.equal(expAdvisorBadMode.status, 400);
    pass('Live Express Gemini endpoints reject malformed/oversized history, prompts > 1500 chars, and invalid modes with 400');

    // Express Media Upload + Static Serving Security Headers
    const expMediaSvg = await fetch('http://127.0.0.1:3000/api/admin/upload-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({
        dataUrl: `data:image/svg+xml;base64,${Buffer.from('<svg/>').toString('base64')}`,
        fileName: 'xss.svg',
        folder: 'uploads',
      }),
    });
    assert.equal(expMediaSvg.status, 400);

    const expImg = await fetch('http://127.0.0.1:3000/images/uploads/uploads/phase4-valid-banner.webp');
    assert.equal(expImg.status, 200);
    assert.equal(expImg.headers.get('content-type'), 'image/webp');
    assert.equal(expImg.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(expImg.headers.get('content-security-policy')?.includes('sandbox'));
    pass('Live Express /api/admin/upload-media rejects SVG (400) and /images/uploads/* serves raster with nosniff + sandbox CSP');

    console.log(`\n=== ALL ${passed}/${total} PHASE 4 SECURITY & HARDENING TESTS PASSED ===\n`);
  } finally {
    if (serverProc && !serverProc.killed) {
      serverProc.kill();
    }
    for (const f of uploadedFilesToRemove) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
    for (const [p, original] of snapshots.entries()) {
      try {
        if (original === null) {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } else {
          fs.mkdirSync(path.dirname(p), { recursive: true });
          fs.writeFileSync(p, original, 'utf-8');
        }
      } catch {}
    }
  }
}

main().catch((err) => {
  console.error('\n❌ Phase 4 Security Verification Failed:', err);
  process.exit(1);
});

