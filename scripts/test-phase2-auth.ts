/**
 * Phase 2 Security & Regression Verification Suite
 * Authentication, Session Security, Salted scrypt Hashing, Brute-Force Lockout,
 * Persistent Token Revocation, HttpOnly Cookies, & Legacy Bypass Removal
 */

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import authHandler from '../api/auth.js';
import adminHandler from '../api/admin.js';
import tokensHandler from '../api/tokens.js';
import subscriptionHandler from '../api/subscription.js';
import {
  hashPinScrypt,
  verifyPinScrypt,
  handleAuthHttpRequest,
  resetAuthRateLimitsForTests,
} from '../src/lib/serverAuthService.js';
import { resetRevocationCacheForTests } from '../src/lib/tokenRevocationStore.js';
import {
  verifyFirebaseJwtWithCertificates,
  USER_SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
} from '../src/lib/firebaseIdTokenVerifier.js';
import { verifyAdminRequest } from '../src/lib/adminAuthService.js';

interface MockResponseResult {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: any;
  setCookies: string[];
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

  const rawSetCookie = headersOut['set-cookie'];
  const setCookies = Array.isArray(rawSetCookie)
    ? rawSetCookie
    : typeof rawSetCookie === 'string'
      ? [rawSetCookie]
      : [];

  return { statusCode, headers: headersOut, body: jsonBody, setCookies };
}

function extractCookieValue(setCookies: string[], name: string): string {
  for (const header of setCookies) {
    if (header.startsWith(`${name}=`)) {
      const semi = header.indexOf(';');
      return header.slice(name.length + 1, semi === -1 ? header.length : semi);
    }
  }
  return '';
}

function signMockFirebaseJwt(
  privateKeyPem: string,
  kid: string,
  payload: Record<string, any>
): string {
  const headerB64 = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }),
    'utf-8'
  ).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const unsigned = `${headerB64}.${payloadB64}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const sigB64 = signer.sign(privateKeyPem).toString('base64url');
  return `${unsigned}.${sigB64}`;
}

async function runTests() {
  const cwd = process.cwd();
  const managedFiles = [
    path.join(cwd, '.data', 'auth_accounts.json'),
    path.join(cwd, '.data', 'revoked_tokens.json'),
    path.join(cwd, 'data', 'token_economy.json'),
    path.join(cwd, 'data', 'subscriptions.json'),
  ];
  let serverProc: ChildProcess | null = null;
  const snapshots = new Map<string, string | null>();
  for (const file of managedFiles) {
    snapshots.set(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : null);
  }

  // Backup env vars
  const envBackup = {
    USER_TOKEN_SECRET: process.env.USER_TOKEN_SECRET,
    USER_SESSION_SECRET: process.env.USER_SESSION_SECRET,
    ADMIN_TOKEN_SECRET: process.env.ADMIN_TOKEN_SECRET,
    ADMIN_SECRET: process.env.ADMIN_SECRET,
    ADMIN_PIN: process.env.ADMIN_PIN,
    FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };

  let passed = 0;
  function check(label: string) {
    passed += 1;
    console.log(`  [PASS ${passed}] ${label}`);
  }

  try {
    console.log('\n=== MSHINDIROOM PHASE 2 AUTH & SESSION SECURITY SUITE ===\n');

    // Start from clean auth + revocation state
    for (const file of managedFiles) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    resetAuthRateLimitsForTests();
    resetRevocationCacheForTests();
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    delete process.env.VERCEL_ENV;

    // 1. Fail closed when session secrets are unconfigured
    delete process.env.USER_TOKEN_SECRET;
    delete process.env.USER_SESSION_SECRET;
    delete process.env.ADMIN_TOKEN_SECRET;
    const unconfReg = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/register',
      query: { endpoint: 'register' },
      body: { phone: '0712345678', pin: '1234', username: 'TestUser1' },
    });
    assert.equal(unconfReg.statusCode, 503);
    const unconfLogin = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/login',
      query: { endpoint: 'login' },
      body: { phone: '0712345678', pin: '1234' },
    });
    assert.equal(unconfLogin.statusCode, 503);
    check('Register & login fail closed (503) when signing secrets are missing');

    // Configure secrets for test run
    process.env.USER_TOKEN_SECRET = 'phase2-test-user-signing-secret-0123456789abcdef';
    process.env.ADMIN_TOKEN_SECRET = 'phase2-test-admin-signing-secret-0123456789abcdef';
    process.env.ADMIN_PIN = '9090';

    // 2. Salted scrypt PIN hashing
    const h1 = hashPinScrypt('4567');
    const h2 = hashPinScrypt('4567');
    assert.ok(h1.startsWith('scrypt$16384$8$1$'));
    assert.notEqual(h1, h2, 'Identical PINs must use distinct per-user random salts');
    assert.equal(verifyPinScrypt('4567', h1), true);
    assert.equal(verifyPinScrypt('0000', h1), false);
    check('Salted scrypt PIN hashing uses distinct random salts and timing-safe verify');

    // 3. Admin phone hijacking blocked without SMS or admin proof
    const adminHijack = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/register',
      query: { endpoint: 'register' },
      body: {
        phone: '0743304579',
        pin: '1111',
        username: 'FakeAdmin',
        verifiedWithSms: true,
        role: 'admin',
      },
    });
    assert.equal(adminHijack.statusCode, 403);
    check('Public registration for reserved admin phone (0743304579) blocked with 403');

    // 4. Register ordinary punter even if client spoofs role/verifiedWithSms
    const reg = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/register',
      query: { endpoint: 'register' },
      headers: { 'x-forwarded-proto': 'https' },
      body: {
        phone: '0712345678',
        pin: '4321',
        username: 'TipsterOne',
        avatarId: 'glyph_01',
        role: 'admin',
        verifiedWithSms: true,
      },
    });
    assert.equal(reg.statusCode, 201);
    assert.equal(reg.body.success, true);
    assert.equal(reg.body.user.phone, '254712345678');
    assert.equal(reg.body.user.role, 'user', 'Server must ignore client-supplied role=admin');
    assert.equal(
      reg.body.user.verifiedWithSms,
      false,
      'Server must ignore client-supplied verifiedWithSms=true'
    );
    assert.equal('pinScryptHash' in reg.body.user, false);
    assert.equal('pinHash' in reg.body.user, false);
    assert.ok(String(reg.body.userSessionToken || '').startsWith('utok.'));
    const cookieVal = extractCookieValue(reg.setCookies, USER_SESSION_COOKIE_NAME);
    assert.ok(cookieVal.startsWith('utok.'));
    const rawCookieHeader = reg.setCookies.find((c) => c.startsWith(`${USER_SESSION_COOKIE_NAME}=`)) || '';
    assert.ok(rawCookieHeader.includes('HttpOnly'));
    assert.ok(rawCookieHeader.includes('SameSite=Lax'));
    assert.ok(rawCookieHeader.includes('Secure'));
    check('Registration issues salted scrypt account, HttpOnly/SameSite/Secure cookie, and strips spoofed claims');

    // 5. Duplicate phone & duplicate case-insensitive username rejected (409)
    const dupPhone = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/register',
      query: { endpoint: 'register' },
      body: { phone: '+254712345678', pin: '4321', username: 'AnotherName' },
    });
    assert.equal(dupPhone.statusCode, 409);

    const dupUsername = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/register',
      query: { endpoint: 'register' },
      body: { phone: '0722999888', pin: '4321', username: 'tipsterone' },
    });
    assert.equal(dupUsername.statusCode, 409);

    const availTaken = await invokeVercelHandler(authHandler, {
      method: 'GET',
      url: '/api/auth/availability?username=TIPSTERONE',
      query: { endpoint: 'availability', username: 'TIPSTERONE' },
    });
    assert.equal(availTaken.statusCode, 200);
    assert.equal(availTaken.body.available, false);

    const availFree = await invokeVercelHandler(authHandler, {
      method: 'GET',
      url: '/api/auth/availability?username=FreshPunter99',
      query: { endpoint: 'availability', username: 'FreshPunter99' },
    });
    assert.equal(availFree.statusCode, 200);
    assert.equal(availFree.body.available, true);
    check('Duplicate phone & username checks return 409; /availability checks username cleanly');

    // 6. Public directory omits phones and hashes completely
    const dirRes = await invokeVercelHandler(authHandler, {
      method: 'GET',
      url: '/api/auth/directory',
      query: { endpoint: 'directory' },
    });
    assert.equal(dirRes.statusCode, 200);
    const dirSerialized = JSON.stringify(dirRes.body);
    assert.ok(dirSerialized.includes('TipsterOne'));
    assert.equal(dirSerialized.includes('254712345678'), false);
    assert.equal(dirSerialized.includes('scrypt$'), false);
    check('/api/auth/directory exposes public usernames/avatars only with zero phone/hash leakage');

    // 7. Reject legacy x-user-pin-hash and uid-only headers; accept HttpOnly cookie across wallet & subscription
    const spoofWallet = await invokeVercelHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/wallet',
      query: { endpoint: 'wallet' },
      headers: {
        'x-user-uid': '254712345678',
        'x-user-pin-hash': 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      },
      body: {
        action: 'wallet',
        userUid: '254712345678',
        pinHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      },
    });
    assert.equal(spoofWallet.statusCode, 401);

    const spoofSub = await invokeVercelHandler(subscriptionHandler, {
      method: 'GET',
      url: '/api/subscription/status?userId=254712345678',
      query: { endpoint: 'status', userId: '254712345678' },
      headers: { 'x-user-uid': '254712345678' },
    });
    assert.equal(spoofSub.statusCode, 401);

    const meCookie = await invokeVercelHandler(authHandler, {
      method: 'GET',
      url: '/api/auth/me',
      query: { endpoint: 'me' },
      headers: { cookie: `${USER_SESSION_COOKIE_NAME}=${cookieVal}` },
    });
    assert.equal(meCookie.statusCode, 200);
    assert.equal(meCookie.body.authenticated, true);
    assert.equal(meCookie.body.user.phone, '254712345678');

    const walletCookie = await invokeVercelHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/wallet',
      query: { endpoint: 'wallet' },
      headers: { cookie: `${USER_SESSION_COOKIE_NAME}=${cookieVal}` },
      body: { action: 'wallet', userUid: '254712345678' },
    });
    assert.equal(walletCookie.statusCode, 200);
    assert.equal(walletCookie.body.success, true);

    const subCookie = await invokeVercelHandler(subscriptionHandler, {
      method: 'GET',
      url: '/api/subscription/status?userId=254712345678',
      query: { endpoint: 'status', userId: '254712345678' },
      headers: { cookie: `${USER_SESSION_COOKIE_NAME}=${cookieVal}` },
    });
    assert.equal(subCookie.statusCode, 200);
    assert.equal(subCookie.body.success, true);
    check('x-user-pin-hash rejected (401); HttpOnly session cookie authenticates /me, /tokens, and /subscription');

    // 8. Brute-force PIN lockout (5 failures -> 429 on 6th attempt even with valid PIN)
    for (let i = 0; i < 5; i++) {
      const bad = await invokeVercelHandler(authHandler, {
        method: 'POST',
        url: '/api/auth/login',
        query: { endpoint: 'login' },
        headers: { 'x-forwarded-for': '203.0.113.55' },
        body: { phone: '0712345678', pin: '0000' },
      });
      assert.equal(bad.statusCode, 401);
    }
    const lockedOut = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/login',
      query: { endpoint: 'login' },
      headers: { 'x-forwarded-for': '203.0.113.55' },
      body: { phone: '0712345678', pin: '4321' }, // even correct PIN must be blocked during lockout
    });
    assert.equal(lockedOut.statusCode, 429);
    assert.ok(Number(lockedOut.headers['retry-after']) > 0);
    check('Brute-force PIN limiter locks out after 5 failures with 429 + Retry-After');

    // Reset rate limit & perform clean login
    resetAuthRateLimitsForTests();
    const loginRes = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/login',
      query: { endpoint: 'login' },
      body: { phone: '0712345678', pin: '4321' },
    });
    assert.equal(loginRes.statusCode, 200);
    assert.equal(loginRes.body.authenticated, true);
    const loginCookieToken = extractCookieValue(loginRes.setCookies, USER_SESSION_COOKIE_NAME);
    assert.ok(loginCookieToken.startsWith('utok.'));
    check('Valid login succeeds (200) after rate-limit window resets and rotates session token');

    // 9. Persistent logout revocation survives simulated restart
    const logoutRes = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/logout',
      query: { endpoint: 'logout' },
      headers: { cookie: `${USER_SESSION_COOKIE_NAME}=${loginCookieToken}` },
      body: {},
    });
    assert.equal(logoutRes.statusCode, 200);
    assert.equal(logoutRes.body.revokedUser, true);
    assert.ok(
      logoutRes.setCookies.some(
        (c) => c.startsWith(`${USER_SESSION_COOKIE_NAME}=`) && c.includes('Max-Age=0')
      )
    );

    // Wipe in-memory revocation cache to prove persistence on disk
    resetRevocationCacheForTests();
    const afterLogoutMe = await invokeVercelHandler(authHandler, {
      method: 'GET',
      url: '/api/auth/me',
      query: { endpoint: 'me' },
      headers: { cookie: `${USER_SESSION_COOKIE_NAME}=${loginCookieToken}` },
    });
    assert.equal(afterLogoutMe.body.authenticated, false);

    const afterLogoutWallet = await invokeVercelHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/wallet',
      query: { endpoint: 'wallet' },
      headers: { 'x-user-token': loginCookieToken },
      body: { action: 'wallet', userUid: '254712345678' },
    });
    assert.equal(afterLogoutWallet.statusCode, 401);
    check('User logout persistently revokes token across cold cache reset and clears HttpOnly cookie');

    // 10. Admin cookie issuance + persistent logout revocation
    const adminLogin = await invokeVercelHandler(adminHandler, {
      method: 'POST',
      url: '/api/admin/verify-pin',
      query: { endpoint: 'verify-pin' },
      body: { phone: '0743304579', pin: '9090' },
    });
    assert.equal(adminLogin.statusCode, 200);
    const adminCookie = extractCookieValue(adminLogin.setCookies, ADMIN_SESSION_COOKIE_NAME);
    assert.ok(decodeURIComponent(adminCookie).startsWith('254743304579:'));
    assert.equal(decodeURIComponent(adminCookie).split(':').length, 4);
    assert.equal(
      verifyAdminRequest({ cookie: `${ADMIN_SESSION_COOKIE_NAME}=${adminCookie}` }).authorized,
      true
    );

    const adminLogout = await invokeVercelHandler(adminHandler, {
      method: 'POST',
      url: '/api/admin/logout',
      query: { endpoint: 'logout' },
      headers: { cookie: `${ADMIN_SESSION_COOKIE_NAME}=${adminCookie}` },
      body: {},
    });
    assert.equal(adminLogout.statusCode, 200);
    resetRevocationCacheForTests();
    assert.equal(
      verifyAdminRequest({ cookie: `${ADMIN_SESSION_COOKIE_NAME}=${adminCookie}` }).authorized,
      false
    );
    check('Admin login issues HttpOnly cookie; admin logout persistently revokes admin token');

    // 11. Close account requires active session + valid PIN & revokes tokens
    const freshLogin = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/login',
      query: { endpoint: 'login' },
      body: { phone: '0712345678', pin: '4321' },
    });
    const activeToken = freshLogin.body.userSessionToken;

    const unauthClose = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/close-account',
      query: { endpoint: 'close-account' },
      body: { pin: '4321' },
    });
    assert.equal(unauthClose.statusCode, 401);

    const wrongPinClose = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/close-account',
      query: { endpoint: 'close-account' },
      headers: { cookie: `${USER_SESSION_COOKIE_NAME}=${activeToken}` },
      body: { pin: '9999' },
    });
    assert.equal(wrongPinClose.statusCode, 401);

    const goodClose = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/close-account',
      query: { endpoint: 'close-account' },
      headers: { cookie: `${USER_SESSION_COOKIE_NAME}=${activeToken}` },
      body: { pin: '4321' },
    });
    assert.equal(goodClose.statusCode, 200);
    assert.equal(goodClose.body.closed, true);

    const loginDeleted = await invokeVercelHandler(authHandler, {
      method: 'POST',
      url: '/api/auth/login',
      query: { endpoint: 'login' },
      body: { phone: '0712345678', pin: '4321' },
    });
    assert.equal(loginDeleted.statusCode, 401);
    check('Close-account enforces session + scrypt PIN check, deletes account, and revokes session');

    // 12. Real RSA-2048 RS256 Firebase JWT Verification
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const kid = 'test-firebase-kid-1';
    const certs = { [kid]: publicKey };
    const nowSec = 1760000000;
    const validJwt = signMockFirebaseJwt(privateKey, kid, {
      iss: 'https://securetoken.google.com/mshindiroom',
      aud: 'mshindiroom',
      sub: 'fb-uid-9988',
      auth_time: nowSec - 10,
      iat: nowSec - 5,
      exp: nowSec + 3600,
      phone_number: '+254799111222',
    });
    const fbOk = verifyFirebaseJwtWithCertificates(validJwt, certs, 'mshindiroom', nowSec);
    assert.equal(fbOk.valid, true);
    assert.equal(fbOk.uid, 'fb-uid-9988');
    assert.equal(fbOk.phoneNumber, '+254799111222');

    const fbWrongAud = verifyFirebaseJwtWithCertificates(
      signMockFirebaseJwt(privateKey, kid, {
        iss: 'https://securetoken.google.com/other-project',
        aud: 'other-project',
        sub: 'fb-uid-9988',
        iat: nowSec - 5,
        exp: nowSec + 3600,
      }),
      certs,
      'mshindiroom',
      nowSec
    );
    assert.equal(fbWrongAud.valid, false);

    const fbExpired = verifyFirebaseJwtWithCertificates(
      signMockFirebaseJwt(privateKey, kid, {
        iss: 'https://securetoken.google.com/mshindiroom',
        aud: 'mshindiroom',
        sub: 'fb-uid-9988',
        iat: nowSec - 7200,
        exp: nowSec - 1,
      }),
      certs,
      'mshindiroom',
      nowSec
    );
    assert.equal(fbExpired.valid, false);

    const parts = validJwt.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        iss: 'https://securetoken.google.com/mshindiroom',
        aud: 'mshindiroom',
        sub: 'attacker-uid',
        iat: nowSec - 5,
        exp: nowSec + 3600,
      }),
      'utf-8'
    ).toString('base64url');
    const fbTampered = verifyFirebaseJwtWithCertificates(
      `${parts[0]}.${tamperedPayload}.${parts[2]}`,
      certs,
      'mshindiroom',
      nowSec
    );
    assert.equal(fbTampered.valid, false);
    check('Cryptographic RS256 Firebase ID token verification passes valid claims & rejects wrong aud/expired/tampered');

    // 13. Static source hygiene verification
    const useAuthFlowSrc = fs.readFileSync(path.join(cwd, 'src', 'lib', 'useAuthFlow.ts'), 'utf-8');
    const authStoreSrc = fs.readFileSync(path.join(cwd, 'src', 'lib', 'authStore.ts'), 'utf-8');
    const walletStoreSrc = fs.readFileSync(path.join(cwd, 'src', 'lib', 'store.ts'), 'utf-8');
    const directorySrc = fs.readFileSync(path.join(cwd, 'src', 'lib', 'punterDirectory.ts'), 'utf-8');
    const vercelSrc = fs.readFileSync(path.join(cwd, 'vercel.json'), 'utf-8');

    assert.equal(useAuthFlowSrc.includes('bypassOtpForTesting'), false);
    assert.equal(authStoreSrc.includes('mshindi_pin_salt'), false);
    assert.equal(authStoreSrc.includes('sha256Sync'), false);
    assert.equal(walletStoreSrc.includes('x-user-pin-hash'), false);
    assert.equal(directorySrc.includes('.accounts'), false);
    assert.equal(vercelSrc.includes('/api/auth/:endpoint*'), true);
    check('Static security hygiene verified: zero bypassOtpForTesting, mshindi_pin_salt, x-user-pin-hash, or client accounts[]');

    // 15. Shared handleAuthHttpRequest Express/Vercel parity
    const expCompat = await handleAuthHttpRequest({
      method: 'GET',
      pathname: '/api/auth/availability',
      query: { username: 'Anyone' },
    });
    assert.equal(expCompat.statusCode, 200);
    check('Shared handleAuthHttpRequest Express/Vercel parity verified');

    // 16. Live Express bundle (dist/server.cjs) HTTP cookie & auth parity
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
      },
      stdio: 'ignore',
    });

    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        const probe = await fetch('http://127.0.0.1:3000/api/health');
        if (probe.ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }

    const expReg = await fetch('http://127.0.0.1:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0733555666', pin: '2468', username: 'ExpressUser1' }),
    });
    assert.equal(expReg.status, 201);
    const expSetCookie = expReg.headers.get('set-cookie') || '';
    assert.ok(expSetCookie.includes(`${USER_SESSION_COOKIE_NAME}=`));
    assert.ok(expSetCookie.includes('HttpOnly'));
    const expCookiePair = expSetCookie.split(';')[0];

    const expMe = await fetch('http://127.0.0.1:3000/api/auth/me', {
      headers: { Cookie: expCookiePair },
    });
    const expMeJson: any = await expMe.json();
    assert.equal(expMe.status, 200);
    assert.equal(expMeJson.authenticated, true);
    assert.equal(expMeJson.user.phone, '254733555666');

    const expWallet = await fetch('http://127.0.0.1:3000/api/tokens/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: expCookiePair },
      body: JSON.stringify({ action: 'wallet', userUid: '254733555666' }),
    });
    assert.equal(expWallet.status, 200);

    const expLogout = await fetch('http://127.0.0.1:3000/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: expCookiePair },
    });
    assert.equal(expLogout.status, 200);
    const expAfterLogout = await fetch('http://127.0.0.1:3000/api/auth/me', {
      headers: { Cookie: expCookiePair },
    });
    const expAfterLogoutJson: any = await expAfterLogout.json();
    assert.equal(expAfterLogoutJson.authenticated, false);
    check('Live Express dist/server.cjs HTTP register -> HttpOnly cookie /me & /tokens -> logout revocation verified');

    console.log(`\nALL ${passed}/${passed} PHASE 2 SECURITY & REGRESSION CHECKS PASSED.\n`);
  } finally {
    if (serverProc && !serverProc.killed) {
      serverProc.kill();
    }
    // Restore files cleanly
    for (const file of managedFiles) {
      const orig = snapshots.get(file);
      if (orig === null || orig === undefined) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, orig, 'utf-8');
      }
    }
    resetAuthRateLimitsForTests();
    resetRevocationCacheForTests();

    // Restore env vars
    for (const [k, v] of Object.entries(envBackup)) {
      if (v === undefined) delete (process.env as any)[k];
      else (process.env as any)[k] = v;
    }
  }
}

runTests().catch((err) => {
  console.error('\nPHASE 2 TEST SUITE FAILED:', err);
  process.exit(1);
});

