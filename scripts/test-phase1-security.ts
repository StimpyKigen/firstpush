/**
 * Phase 1 Comprehensive Security & Regression Verification Suite
 *
 * Covers every Phase 1A-1D remediation control across:
 *   1. Cryptographic admin & user token unit tests (fail-closed secrets, TTL, revocation, no phone-only/pinHash bypass)
 *   2. Vercel serverless handlers (`api/admin.ts`, `api/homepage-feed.ts`, `api/sports.ts`, `api/tokens.ts`, `api/subscription.ts`)
 *   3. Express production bundle (`dist/server.cjs`) over live TCP HTTP on port 3000
 *   4. Static Firebase Firestore/Storage rules & hardcoded secret hygiene checks
 *   5. Non-destructive preservation of local data files (`data/` and `.data/`)
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

import {
  ADMIN_PHONE_NORMALIZED,
  MAX_ADMIN_TOKEN_TTL_MS,
  generateAdminToken,
  revokeAdminToken,
  verifyAdminToken,
  verifyAdminPinCredentials,
  verifyAdminRequest,
} from '../src/lib/adminAuthService';
import {
  AUTHORITATIVE_ROOM_UNLOCK_COST_KSH,
  MAX_USER_TOKEN_TTL_MS,
  issueUserSessionToken,
  revokeUserSessionToken,
  verifyUserSessionToken,
  authenticateTokenRequest,
  handleTokenEconomyHttpRequest,
} from '../src/lib/serverTokenEconomy';
import { handleSubscriptionHttpRequest } from '../src/lib/serverSubscriptionService';

import adminHandler from '../api/admin';
import homepageFeedHandler from '../api/homepage-feed';
import sportsHandler from '../api/sports';
import tokensHandler from '../api/tokens';
import subscriptionHandler from '../api/subscription';

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    failed++;
    console.error(`  [FAIL] ${name} -> ${err?.message || err}`);
  }
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    end(payload?: any) {
      if (payload !== undefined) this.body = payload;
      return this;
    },
  };
  return res;
}

async function callHandler(handler: any, reqOpts: {
  method?: string;
  url: string;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
}) {
  const req: any = {
    method: reqOpts.method || 'GET',
    url: reqOpts.url,
    query: reqOpts.query || {},
    headers: reqOpts.headers || {},
    body: reqOpts.body,
  };
  const res = createMockRes();
  await handler(req, res);
  return res;
}

// Snapshot & restore any existing local state files so tests leave workspace clean
const BACKUP_PATHS = [
  'data/token_economy.json',
  'data/admin_fixtures.json',
  'data/homepage_feed.json',
  '.data/subscriptions.json',
];

function snapshotFiles(): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const rel of BACKUP_PATHS) {
    const full = path.resolve(process.cwd(), rel);
    map.set(full, fs.existsSync(full) ? fs.readFileSync(full, 'utf-8') : null);
  }
  return map;
}

function restoreFiles(map: Map<string, string | null>) {
  for (const [full, content] of map.entries()) {
    if (content === null) {
      if (fs.existsSync(full)) fs.rmSync(full, { force: true });
    } else {
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf-8');
    }
  }
}

async function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for Express server at ${url}`);
}

async function main() {
  console.log('\n================================================================');
  console.log('MSHINDIROOM — PHASE 1 SECURITY & REGRESSION VERIFICATION SUITE');
  console.log('================================================================\n');

  const fileSnapshot = snapshotFiles();
  let serverProc: ChildProcess | null = null;

  // Preserve & control env vars cleanly
  const prevEnv = {
    ADMIN_PIN: process.env.ADMIN_PIN,
    ADMIN_TOKEN_SECRET: process.env.ADMIN_TOKEN_SECRET,
    ADMIN_SECRET: process.env.ADMIN_SECRET,
    USER_TOKEN_SECRET: process.env.USER_TOKEN_SECRET,
    USER_SESSION_SECRET: process.env.USER_SESSION_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
  };

  try {
    // =========================================================================
    // 1. FAIL-CLOSED BEHAVIOR WHEN ENV SECRETS ARE UNSET
    // =========================================================================
    console.log('--- [1/5] Fail-Closed Checks When Secrets Unconfigured ---');
    delete process.env.ADMIN_PIN;
    delete process.env.ADMIN_TOKEN_SECRET;
    delete process.env.ADMIN_SECRET;
    delete process.env.USER_TOKEN_SECRET;
    delete process.env.USER_SESSION_SECRET;
    delete process.env.CRON_SECRET;

    await check('1.1 Legacy hardcoded PIN 7433 is rejected when ADMIN_PIN is unset', () => {
      const res = verifyAdminPinCredentials(ADMIN_PHONE_NORMALIZED, '7433');
      assert.equal(res.valid, false);
      assert.equal(res.misconfigured, true);
    });

    await check('1.2 generateAdminToken fails closed without ADMIN_TOKEN_SECRET', () => {
      assert.throws(() => generateAdminToken(ADMIN_PHONE_NORMALIZED), /not configured/i);
    });

    await check('1.3 Legacy hardcoded admin secret token (3-part or 4-part) rejected', () => {
      const issuedAt = Date.now();
      const payload3 = `${ADMIN_PHONE_NORMALIZED}:${issuedAt}`;
      const sig3 = crypto.createHmac('sha256', 'mshindi-admin-secret-key-2026').update(payload3).digest('hex');
      assert.equal(verifyAdminToken(`${payload3}:${sig3}`), false);

      const nonce = '0011223344556677';
      const payload4 = `${ADMIN_PHONE_NORMALIZED}:${issuedAt}:${nonce}`;
      const sig4 = crypto.createHmac('sha256', 'mshindi-admin-secret-key-2026').update(payload4).digest('hex');
      assert.equal(verifyAdminToken(`${payload4}:${sig4}`), false);
    });

    await check('1.4 issueUserSessionToken fails closed without USER_TOKEN_SECRET', () => {
      assert.throws(() => issueUserSessionToken('254712345678'), /not configured/i);
    });

    await check('1.5 Vercel api/homepage-feed cleanup rejects spoofed x-vercel-cron:1 when CRON_SECRET unset', async () => {
      const res = await callHandler(homepageFeedHandler, {
        method: 'GET',
        url: '/api/homepage-feed?action=cleanup',
        query: { action: 'cleanup' },
        headers: { 'x-vercel-cron': '1' },
      });
      assert.equal(res.statusCode, 403);
      assert.equal(res.body?.success, false);
    });

    await check('1.6 Vercel api/admin verify-pin returns 503 when ADMIN_PIN/secret unset', async () => {
      const res = await callHandler(adminHandler, {
        method: 'POST',
        url: '/api/admin/verify-pin',
        query: { endpoint: 'verify-pin' },
        body: { phone: '0743304579', pin: '7433' },
      });
      assert.equal(res.statusCode, 503);
      assert.equal(res.body?.valid, false);
    });

    await check('1.7 Vercel api/sports weekly-sync returns 503 when CRON_SECRET unset', async () => {
      const res = await callHandler(sportsHandler, {
        method: 'POST',
        url: '/api/sports/weekly-sync',
        query: { endpoint: 'weekly-sync' },
      });
      assert.equal(res.statusCode, 503);
    });

    // =========================================================================
    // 2. CONFIGURED SECRETS — CRYPTOGRAPHY, TTL, REVOCATION & BYPASS REJECTION
    // =========================================================================
    console.log('\n--- [2/5] Admin & User Auth Hardening (Phase 1A / 1B) ---');
    const TEST_PIN = '908172';
    const TEST_ADMIN_TOKEN_SECRET = 'test_admin_secret_' + crypto.randomBytes(16).toString('hex');
    const TEST_ADMIN_KEY = 'test_admin_api_' + crypto.randomBytes(16).toString('hex');
    const TEST_USER_SECRET = 'test_user_secret_' + crypto.randomBytes(16).toString('hex');
    const TEST_CRON_SECRET = 'test_cron_secret_' + crypto.randomBytes(16).toString('hex');

    process.env.ADMIN_PIN = TEST_PIN;
    process.env.ADMIN_TOKEN_SECRET = TEST_ADMIN_TOKEN_SECRET;
    process.env.ADMIN_SECRET = TEST_ADMIN_KEY;
    process.env.USER_TOKEN_SECRET = TEST_USER_SECRET;
    process.env.CRON_SECRET = TEST_CRON_SECRET;

    const validAdminLogin = verifyAdminPinCredentials('0743304579', TEST_PIN);
    const validAdminToken = validAdminLogin.adminToken!;

    await check('2.1 Valid ADMIN_PIN issues working 4-part HMAC admin token; 7433 rejected', () => {
      assert.equal(validAdminLogin.valid, true);
      assert.ok(validAdminToken && validAdminToken.split(':').length === 4);
      assert.equal(verifyAdminToken(validAdminToken), true);
      assert.equal(verifyAdminPinCredentials('0743304579', '7433').valid, false);
      assert.equal(verifyAdminPinCredentials('0711111111', TEST_PIN).valid, false);
    });

    await check('2.2 Phone-only header & body.authorId admin bypass completely rejected', () => {
      const hBypass = verifyAdminRequest({ 'x-admin-phone': '254743304579' }, {});
      assert.equal(hBypass.authorized, false);
      const bBypass = verifyAdminRequest({}, { authorId: '0743304579', authorRole: 'admin', adminPhone: '254743304579' });
      assert.equal(bBypass.authorized, false);
    });

    await check('2.3 Expired (>TTL) & legacy 3-part & revoked admin tokens rejected', () => {
      const oldTs = Date.now() - MAX_ADMIN_TOKEN_TTL_MS - 5000;
      const nonce = crypto.randomBytes(8).toString('hex');
      const expiredPayload = `${ADMIN_PHONE_NORMALIZED}:${oldTs}:${nonce}`;
      const expiredSig = crypto.createHmac('sha256', TEST_ADMIN_TOKEN_SECRET).update(expiredPayload).digest('hex');
      assert.equal(verifyAdminToken(`${expiredPayload}:${expiredSig}`), false);

      // 3-part token rejected
      const payload3 = `${ADMIN_PHONE_NORMALIZED}:${Date.now()}`;
      const sig3 = crypto.createHmac('sha256', TEST_ADMIN_TOKEN_SECRET).update(payload3).digest('hex');
      assert.equal(verifyAdminToken(`${payload3}:${sig3}`), false);

      // Revoked 4-part token rejected
      const tempToken = generateAdminToken(ADMIN_PHONE_NORMALIZED);
      assert.equal(verifyAdminToken(tempToken), true);
      assert.equal(revokeAdminToken(tempToken), true);
      assert.equal(verifyAdminToken(tempToken), false);
    });

    const userA = '254711000222';
    const userB = '254711000333';
    const validUserAToken = issueUserSessionToken(userA);

    await check('2.4 User token verifies for own UID, blocks expired/forged/revoked tokens & cross-UID', () => {
      assert.equal(verifyUserSessionToken(validUserAToken).valid, true);
      assert.equal(verifyUserSessionToken(validUserAToken).userUid, userA);

      // Cross-UID access blocked (403)
      const crossUid = authenticateTokenRequest({ 'x-user-token': validUserAToken }, { userUid: userB });
      assert.equal(crossUid.authenticated, false);
      assert.equal(crossUid.statusCode, 403);

      // Forged with old fallback secret rejected
      const p = Buffer.from(`${userA}:${Date.now()}:0011223344556677:verified`).toString('base64url');
      const s = crypto.createHmac('sha256', 'mshindi-token-economy-hmac-secret-2026').update(`${userA}:${Date.now()}:0011223344556677:verified`).digest('hex');
      assert.equal(verifyUserSessionToken(`utok.${p}.${s}`).valid, false);

      // Expired user token rejected
      const expStr = `${userA}:${Date.now() - MAX_USER_TOKEN_TTL_MS - 10_000}:0011223344556677:verified`;
      const expP = Buffer.from(expStr).toString('base64url');
      const expS = crypto.createHmac('sha256', TEST_USER_SECRET).update(expStr).digest('hex');
      assert.equal(verifyUserSessionToken(`utok.${expP}.${expS}`).valid, false);

      // Revoked user token rejected
      const uTemp = issueUserSessionToken(userA);
      assert.equal(verifyUserSessionToken(uTemp).valid, true);
      assert.equal(revokeUserSessionToken(uTemp), true);
      assert.equal(verifyUserSessionToken(uTemp).valid, false);
    });

    await check('2.5 Unregistered cold-start x-user-pin-hash bypass rejected (401)', () => {
      const fakeHash = crypto.createHash('sha256').update('arbitrary-pin').digest('hex');
      const auth = authenticateTokenRequest({
        'x-user-uid': '254799111222',
        'x-user-pin-hash': fakeHash,
      });
      assert.equal(auth.authenticated, false);
      assert.equal(auth.statusCode, 401);
    });

    // =========================================================================
    // 3. VERCEL SERVERLESS HANDLERS SECURITY + REGRESSION TESTS
    // =========================================================================
    console.log('\n--- [3/5] Vercel Serverless Handlers (api/*.ts) ---');

    await check('3.1 api/admin.ts blocks unauth/phone-only on parse-pdf, fixtures, upload-media, batch delete', async () => {
      const badHeaders = { 'x-admin-phone': '254743304579' };
      const parseUnauth = await callHandler(adminHandler, {
        method: 'POST',
        url: '/api/admin/parse-pdf',
        query: { endpoint: 'parse-pdf' },
        headers: badHeaders,
        body: { base64: 'JVBERi0xLjQK', authorId: '254743304579' },
      });
      assert.equal(parseUnauth.statusCode, 403);

      const fixPostUnauth = await callHandler(adminHandler, {
        method: 'POST',
        url: '/api/admin/fixtures',
        query: { endpoint: 'fixtures' },
        headers: badHeaders,
        body: { fixtures: [] },
      });
      assert.equal(fixPostUnauth.statusCode, 403);

      const fixDelUnauth = await callHandler(adminHandler, {
        method: 'DELETE',
        url: '/api/admin/fixtures',
        query: { endpoint: 'fixtures' },
        headers: badHeaders,
      });
      assert.equal(fixDelUnauth.statusCode, 403);

      const batchDelUnauth = await callHandler(adminHandler, {
        method: 'DELETE',
        url: '/api/admin/fixtures/batch/abc',
        query: { endpoint: ['fixtures', 'batch', 'abc'] },
        headers: badHeaders,
      });
      assert.equal(batchDelUnauth.statusCode, 403);

      const uploadUnauth = await callHandler(adminHandler, {
        method: 'POST',
        url: '/api/admin/upload-media',
        query: { endpoint: 'upload-media' },
        headers: badHeaders,
        body: { dataUrl: 'data:image/webp;base64,UklGRg==', fileName: 'x.webp' },
      });
      assert.equal(uploadUnauth.statusCode, 403);

      // Invalid JSON fails gracefully with 400
      const malformed = await callHandler(adminHandler, {
        method: 'POST',
        url: '/api/admin/verify-pin',
        query: { endpoint: 'verify-pin' },
        body: '{invalid-json',
      });
      assert.equal(malformed.statusCode, 400);
    });

    await check('3.2 api/admin.ts preserves public GET /fixtures & authorized admin POST /parse-pdf', async () => {
      const pubGet = await callHandler(adminHandler, {
        method: 'GET',
        url: '/api/admin/fixtures',
        query: { endpoint: 'fixtures' },
      });
      assert.equal(pubGet.statusCode, 200);
      assert.equal(pubGet.body?.success, true);

      const parseValid = await callHandler(adminHandler, {
        method: 'POST',
        url: '/api/admin/parse-pdf',
        query: { endpoint: 'parse-pdf' },
        headers: { 'x-admin-token': validAdminToken },
        body: { base64: Buffer.from('Sample PDF text', 'utf-8').toString('base64') },
      });
      assert.equal(parseValid.statusCode, 200);
      assert.equal(parseValid.body?.success, true);
    });

    await check('3.3 api/homepage-feed.ts preserves public GET, blocks spoofed cron/phone-only, allows valid cron/admin', async () => {
      const pubGet = await callHandler(homepageFeedHandler, {
        method: 'GET',
        url: '/api/homepage-feed',
      });
      assert.equal(pubGet.statusCode, 200);
      assert.equal(pubGet.body?.success, true);

      const spoofedCron = await callHandler(homepageFeedHandler, {
        method: 'GET',
        url: '/api/homepage-feed?action=cleanup',
        query: { action: 'cleanup' },
        headers: { 'x-vercel-cron': '1', authorization: 'Bearer wrong' },
      });
      assert.equal(spoofedCron.statusCode, 403);

      const validCron = await callHandler(homepageFeedHandler, {
        method: 'GET',
        url: '/api/homepage-feed?action=cleanup',
        query: { action: 'cleanup' },
        headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
      });
      assert.equal(validCron.statusCode, 200);
      assert.equal(validCron.body?.action, 'cleanup');

      const phoneOnlyPost = await callHandler(homepageFeedHandler, {
        method: 'POST',
        url: '/api/homepage-feed',
        headers: { 'x-admin-phone': '0743304579' },
        body: { carouselItems: [], videoItems: [], authorId: '254743304579' },
      });
      assert.equal(phoneOnlyPost.statusCode, 403);

      const badJson = await callHandler(homepageFeedHandler, {
        method: 'POST',
        url: '/api/homepage-feed',
        body: '{not_json',
      });
      assert.equal(badJson.statusCode, 400);
    });

    await check('3.4 api/sports.ts blocks unauth/phone-only on sync, sync-live, weekly-sync', async () => {
      for (const ep of ['sync', 'sync-live', 'weekly-sync']) {
        const res = await callHandler(sportsHandler, {
          method: 'POST',
          url: `/api/sports/${ep}`,
          query: { endpoint: ep },
          headers: { 'x-admin-phone': '254743304579' },
        });
        assert.ok(res.statusCode === 401 || res.statusCode === 403, `${ep} got ${res.statusCode}`);
      }
    });

    await check('3.5 api/tokens.ts quarantines mpesa verify-code, referral, legacy migration, forged costKsh, IDOR', async () => {
      // M-Pesa verify-code quarantined 503
      const mpesaRes = await callHandler(tokensHandler, {
        method: 'POST',
        url: '/api/mpesa/verify-code',
        headers: { 'x-user-token': validUserAToken },
        body: { code: 'FAKECODE99', amount: 5000, userUid: userA },
      });
      assert.equal(mpesaRes.statusCode, 503);
      assert.equal(mpesaRes.body?.quarantined, true);

      // Unauthenticated wallet blocked 401 (no IDOR)
      const idorWallet = await callHandler(tokensHandler, {
        method: 'GET',
        url: `/api/tokens/wallet?userUid=${userA}`,
        query: { endpoint: 'wallet', userUid: userA },
      });
      assert.equal(idorWallet.statusCode, 401);

      // Authenticated wallet for own UID succeeds
      const ownWallet = await callHandler(tokensHandler, {
        method: 'GET',
        url: '/api/tokens/wallet',
        query: { endpoint: 'wallet' },
        headers: { 'x-user-token': validUserAToken },
      });
      assert.equal(ownWallet.statusCode, 200);
      assert.equal(ownWallet.body?.wallet?.userUid, userA);

      // Authenticated legacy balance minting rejected 403
      const migAbuse = await callHandler(tokensHandler, {
        method: 'POST',
        url: '/api/tokens/migrate',
        query: { endpoint: 'migrate' },
        headers: { 'x-user-token': validUserAToken },
        body: { userUid: userA, legacyBalance: 9999, legacyWalletBalanceKsh: 50000 },
      });
      assert.equal(migAbuse.statusCode, 403);
      assert.equal(migAbuse.body?.quarantined, true);

      // Forged low costKsh rejected 400
      const cheapUnlock = await callHandler(tokensHandler, {
        method: 'POST',
        url: '/api/tokens/unlock-with-balance',
        query: { endpoint: 'unlock-with-balance' },
        headers: { 'x-user-token': validUserAToken },
        body: { userUid: userA, roomId: 'room-1', costKsh: 0.01 },
      });
      assert.equal(cheapUnlock.statusCode, 400);
      assert.ok(String(cheapUnlock.body?.error).includes(String(AUTHORITATIVE_ROOM_UNLOCK_COST_KSH)));

      // Public referral quarantined 503
      const refAbuse = await callHandler(tokensHandler, {
        method: 'POST',
        url: '/api/tokens/referral',
        query: { endpoint: 'referral' },
        body: { referrerIdentifier: userA, referredUid: '254700000111', referredUsername: 'bot' },
      });
      assert.equal(refAbuse.statusCode, 503);
      assert.equal(refAbuse.body?.quarantined, true);
    });

    await check('3.6 api/subscription.ts blocks bare x-user-uid IDOR & quarantines self-verify-payment', async () => {
      // Bare x-user-uid blocked 401
      const bareStatus = await callHandler(subscriptionHandler, {
        method: 'GET',
        url: `/api/subscription/status?userId=${userA}`,
        query: { endpoint: 'status', userId: userA },
        headers: { 'x-user-uid': userA },
      });
      assert.equal(bareStatus.statusCode, 401);

      const bareTrial = await callHandler(subscriptionHandler, {
        method: 'POST',
        url: '/api/subscription/trial',
        query: { endpoint: 'trial' },
        headers: { 'x-user-uid': userA },
        body: { userId: userA },
      });
      assert.equal(bareTrial.statusCode, 401);

      // Authenticated status succeeds cleanly
      const authStatus = await callHandler(subscriptionHandler, {
        method: 'GET',
        url: '/api/subscription/status',
        query: { endpoint: 'status' },
        headers: { 'x-user-token': validUserAToken },
      });
      assert.equal(authStatus.statusCode, 200);
      assert.equal(authStatus.body?.subscription?.userId, userA);

      // Self-submitted verify-payment quarantined 503 even when authenticated
      const payRes = await callHandler(subscriptionHandler, {
        method: 'POST',
        url: '/api/subscription/verify-payment',
        query: { endpoint: 'verify-payment' },
        headers: { 'x-user-token': validUserAToken },
        body: { plan: 'monthly', mpesaCode: 'QK12345678', amountKsh: 75 },
      });
      assert.equal(payRes.statusCode, 503);
      assert.equal(payRes.body?.quarantined, true);
    });

    // =========================================================================
    // 4. EXPRESS PRODUCTION BUNDLE (dist/server.cjs) LIVE HTTP INTEGRATION TESTS
    // =========================================================================
    console.log('\n--- [4/5] Express Production Server (dist/server.cjs) HTTP Integration ---');

    const distServerPath = path.resolve(process.cwd(), 'dist/server.cjs');
    assert.ok(fs.existsSync(distServerPath), 'dist/server.cjs must exist prior to HTTP test');

    serverProc = spawn(process.execPath, [distServerPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ADMIN_PIN: TEST_PIN,
        ADMIN_TOKEN_SECRET: TEST_ADMIN_TOKEN_SECRET,
        ADMIN_SECRET: TEST_ADMIN_KEY,
        USER_TOKEN_SECRET: TEST_USER_SECRET,
        CRON_SECRET: TEST_CRON_SECRET,
      },
      stdio: 'ignore',
    });

    await waitForServer('http://127.0.0.1:3000/api/health');

    await check('4.1 Express HTTP /api/admin/verify-pin rejects 7433 & accepts configured ADMIN_PIN', async () => {
      const bad = await fetch('http://127.0.0.1:3000/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0743304579', pin: '7433' }),
      });
      assert.equal(bad.status, 401);

      const good = await fetch('http://127.0.0.1:3000/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '0743304579', pin: TEST_PIN }),
      });
      assert.equal(good.status, 200);
      const data: any = await good.json();
      assert.ok(data.adminToken);
    });

    await check('4.2 Express HTTP blocks unauth & phone-only mutations across admin & sports routes', async () => {
      const spoofHeaders = {
        'Content-Type': 'application/json',
        'x-admin-phone': '254743304579',
      };
      const checks = await Promise.all([
        fetch('http://127.0.0.1:3000/api/admin/fixtures', { method: 'POST', headers: spoofHeaders, body: '{}' }),
        fetch('http://127.0.0.1:3000/api/admin/fixtures', { method: 'DELETE', headers: spoofHeaders }),
        fetch('http://127.0.0.1:3000/api/admin/fixtures/batch/test1', { method: 'DELETE', headers: spoofHeaders }),
        fetch('http://127.0.0.1:3000/api/admin/parse-pdf', { method: 'POST', headers: spoofHeaders, body: '{"base64":"AAAA"}' }),
        fetch('http://127.0.0.1:3000/api/sports/sync', { method: 'POST', headers: spoofHeaders }),
        fetch('http://127.0.0.1:3000/api/sports/sync-live', { method: 'POST', headers: spoofHeaders }),
        fetch('http://127.0.0.1:3000/api/sports/weekly-sync', { method: 'POST', headers: spoofHeaders }),
      ]);
      for (const r of checks) {
        assert.ok(r.status === 401 || r.status === 403, `Expected 401/403, got ${r.status} for ${r.url}`);
      }
    });

    await check('4.3 Express HTTP /api/gemini/parse-jackpot-text rejects old key & dummy >=20-char token', async () => {
      const oldKey = await fetch('http://127.0.0.1:3000/api/gemini/parse-jackpot-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'mshindi_admin_audit_key_2026',
        },
        body: JSON.stringify({ rawText: 'Arsenal vs Chelsea' }),
      });
      assert.equal(oldKey.status, 403);

      const dummyLen25 = await fetch('http://127.0.0.1:3000/api/gemini/parse-jackpot-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': 'arbitrary_string_length_over_twenty_chars',
        },
        body: JSON.stringify({ rawText: 'Arsenal vs Chelsea' }),
      });
      assert.equal(dummyLen25.status, 403);
    });

    await check('4.4 Express HTTP public GET /api/homepage-feed & /api/admin/fixtures still return 200; cron Bearer works', async () => {
      const feedRes = await fetch('http://127.0.0.1:3000/api/homepage-feed');
      assert.equal(feedRes.status, 200);
      const fixRes = await fetch('http://127.0.0.1:3000/api/admin/fixtures');
      assert.equal(fixRes.status, 200);

      const cleanupBad = await fetch('http://127.0.0.1:3000/api/homepage-feed?action=cleanup', {
        headers: { 'x-vercel-cron': '1' },
      });
      assert.equal(cleanupBad.status, 403);

      const cleanupGood = await fetch('http://127.0.0.1:3000/api/homepage-feed?action=cleanup', {
        headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
      });
      assert.equal(cleanupGood.status, 200);
    });

    await check('4.5 Express HTTP token & subscription quarantine endpoints enforce fail-closed controls', async () => {
      const mpesa = await fetch('http://127.0.0.1:3000/api/mpesa/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-token': validUserAToken },
        body: JSON.stringify({ code: 'QWE123RTY4', amount: 1000 }),
      });
      assert.equal(mpesa.status, 503);

      const walletNoAuth = await fetch(`http://127.0.0.1:3000/api/tokens/wallet?userUid=${userA}`);
      assert.equal(walletNoAuth.status, 401);

      const subNoAuth = await fetch(`http://127.0.0.1:3000/api/subscription/status?userId=${userA}`, {
        headers: { 'x-user-uid': userA },
      });
      assert.equal(subNoAuth.status, 401);

      const subPay = await fetch('http://127.0.0.1:3000/api/subscription/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-token': validUserAToken },
        body: JSON.stringify({ plan: 'weekly', mpesaCode: 'QWE123RTY4', amountKsh: 20 }),
      });
      assert.equal(subPay.status, 503);
    });

    // =========================================================================
    // 5. STATIC FIREBASE RULES & HARDCODED SECRET HYGIENE CHECKS
    // =========================================================================
    console.log('\n--- [5/5] Firebase Security Rules & Secret Hygiene Audit ---');

    await check('5.1 firestore.rules siteContent permits public read and restricts create, update, delete to isAdmin()', () => {
      const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf-8');
      const m = rules.match(/match \/siteContent\/\{docId\}\s*\{([\s\S]*?)\}/);
      assert.ok(m, 'siteContent match block must exist in firestore.rules');
      const block = m[1];
      assert.ok(/allow read:\s*if true;/.test(block));
      assert.ok(/allow create,\s*update,\s*delete:\s*if isAdmin\(\);/.test(block));
      assert.equal(block.includes('authorId in'), false);
    });

    await check('5.2 storage.rules & firebase.json enforce admin-only carousel writes & map storage rules', () => {
      const sRules = fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf-8');
      const m = sRules.match(/match \/homepage-carousel\/\{photoId\}\/\{fileName\}\s*\{([\s\S]*?)\}/);
      assert.ok(m, 'homepage-carousel match block must exist in storage.rules');
      const block = m[1];
      assert.ok(/allow read:\s*if true;/.test(block));
      assert.ok(/allow create,\s*update:\s*if isAdmin\(\)\s*&&/.test(block));
      assert.equal(block.includes(') || isAdmin()'), false);

      const fbJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase.json'), 'utf-8'));
      assert.equal(fbJson.storage?.rules, 'storage.rules');
      assert.equal(fbJson.firestore?.rules, 'firestore.rules');
    });

    await check('5.3 Zero hardcoded Phase 1 fallback secrets or PINs remain in src/, api/, server.ts', () => {
      const forbidden = [
        'mshindi-admin-secret-key-2026',
        'mshindi_admin_audit_key_2026',
        'mshindi-token-economy-hmac-secret-2026',
        "|| '7433'",
        "=== '7433'",
      ];
      const filesToScan: string[] = [path.resolve(process.cwd(), 'server.ts')];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (/\.(ts|tsx)$/.test(entry.name)) filesToScan.push(full);
        }
      };
      walk(path.resolve(process.cwd(), 'src'));
      walk(path.resolve(process.cwd(), 'api'));

      for (const f of filesToScan) {
        const content = fs.readFileSync(f, 'utf-8');
        for (const needle of forbidden) {
          assert.equal(content.includes(needle), false, `Forbidden string "${needle}" found in ${f}`);
        }
      }
    });
  } finally {
    if (serverProc && !serverProc.killed) {
      serverProc.kill('SIGTERM');
    }
    restoreFiles(fileSnapshot);
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }

  console.log('\n================================================================');
  console.log(`PHASE 1 SECURITY SUITE COMPLETE: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
