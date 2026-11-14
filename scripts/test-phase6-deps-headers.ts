/**
 * Phase 6 Security Verification Suite
 * Covers MSH-017, MSH-022, MSH-023, MSH-026:
 * - Dependency vulnerability resolution (0 critical, 0 high)
 * - Trusted-origin CORS & preflight enforcement across Express, Vercel, Vite dev config
 * - Security headers & CSP (no script 'unsafe-inline', HSTS, nosniff, Permissions/Referrer Policy)
 * - Controlled JSON 400 / 413 error handling and scoped request-size limits
 */

import assert from 'node:assert/strict';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import adminHandler from '../api/admin.js';
import authHandler from '../api/auth.js';
import homepageFeedHandler from '../api/homepage-feed.js';
import sportsHandler from '../api/sports.js';
import subscriptionHandler from '../api/subscription.js';
import tokensHandler from '../api/tokens.js';

import {
  resolveTrustedCorsOrigin,
  buildContentSecurityPolicy,
} from '../src/lib/httpSecurity.js';
import {
  ADMIN_PHONE_NORMALIZED,
  verifyAdminPinCredentials,
} from '../src/lib/adminAuthService.js';

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

async function main() {
  let passed = 0;
  const pass = (msg: string) => {
    passed += 1;
    console.log(`PASS [${passed}]: ${msg}`);
  };

  process.env.USER_TOKEN_SECRET = 'phase6-test-user-token-secret-xyz';
  process.env.ADMIN_TOKEN_SECRET = 'phase6-test-admin-token-secret-xyz';
  process.env.ADMIN_PIN = '7410';

  const adminPinResult = verifyAdminPinCredentials(ADMIN_PHONE_NORMALIZED, '7410');
  assert.ok(adminPinResult.valid && adminPinResult.token);
  const adminToken = adminPinResult.token!;

  // =========================================================================
  // 1. 6A Dependency Vulnerability Audit Verification
  // =========================================================================
  let auditRaw = '';
  try {
    auditRaw = execSync('npm audit --json', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err: any) {
    auditRaw = String(err?.stdout || '');
  }
  const auditJson = JSON.parse(auditRaw);
  const counts = auditJson?.metadata?.vulnerabilities || {};
  assert.equal(counts.critical ?? 0, 0, 'Must have 0 critical vulnerabilities');
  assert.equal(counts.high ?? 0, 0, 'Must have 0 high vulnerabilities');

  const pkgLock = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package-lock.json'), 'utf-8'));
  const lockPackages = pkgLock.packages || {};
  assert.ok(!lockPackages['node_modules/proxy-addr']?.version?.startsWith('2.0.7'));
  assert.ok(!lockPackages['node_modules/body-parser']?.version?.startsWith('1.20.6'));
  assert.ok(!lockPackages['node_modules/re2js']?.version?.startsWith('2.8.'));
  assert.ok(!lockPackages['node_modules/source-map-js']?.version?.startsWith('1.2.1'));
  assert.ok(!lockPackages['node_modules/vite']?.version?.startsWith('6.4.3'));
  assert.equal(lockPackages['node_modules/@grpc/grpc-js']?.version?.startsWith('1.14.'), true);
  assert.equal(lockPackages['node_modules/qs']?.version?.startsWith('6.17.'), true);
  pass('6A npm audit confirms 0 critical and 0 high vulnerabilities across patched dependencies');

  // =========================================================================
  // 2. 6B Trusted-Origin CORS & Preflight Enforcement
  // =========================================================================
  assert.equal(resolveTrustedCorsOrigin('https://mshindi.co.ke'), 'https://mshindi.co.ke');
  assert.equal(resolveTrustedCorsOrigin('https://www.mshindi.co.ke'), 'https://www.mshindi.co.ke');
  assert.equal(resolveTrustedCorsOrigin('http://localhost:5173'), 'http://localhost:5173');
  assert.equal(resolveTrustedCorsOrigin('https://evil.example.com'), null);
  assert.equal(resolveTrustedCorsOrigin('https://mshindi.co.ke.attacker.com'), null);
  assert.equal(resolveTrustedCorsOrigin('null'), null);

  const handlers: [string, (req: any, res: any) => Promise<any>, string, Record<string, any>][] = [
    ['api/admin', adminHandler, '/api/admin/fixtures', { endpoint: 'fixtures' }],
    ['api/auth', authHandler, '/api/auth/me', { endpoint: 'me' }],
    ['api/homepage-feed', homepageFeedHandler, '/api/homepage-feed', {}],
    ['api/sports', sportsHandler, '/api/sports/daily-fixtures', { endpoint: 'daily-fixtures' }],
    ['api/subscription', subscriptionHandler, '/api/subscription/status', { endpoint: 'status' }],
    ['api/tokens', tokensHandler, '/api/tokens/packages', { endpoint: 'packages' }],
  ];

  for (const [name, fn, url, query] of handlers) {
    // Trusted origin OPTIONS
    const trustedOpt = await invokeVercelHandler(fn, {
      method: 'OPTIONS',
      url,
      query,
      headers: { origin: 'https://mshindi.co.ke' },
    });
    assert.equal(trustedOpt.statusCode, 200, `${name} trusted OPTIONS must return 200`);
    assert.equal(trustedOpt.headers['access-control-allow-origin'], 'https://mshindi.co.ke');
    assert.equal(trustedOpt.headers['access-control-allow-credentials'], 'true');
    assert.ok(String(trustedOpt.headers['vary'] || '').includes('Origin'));

    // Untrusted origin OPTIONS
    const evilOpt = await invokeVercelHandler(fn, {
      method: 'OPTIONS',
      url,
      query,
      headers: { origin: 'https://evil.attacker.com' },
    });
    assert.equal(evilOpt.statusCode, 403, `${name} untrusted OPTIONS must return 403`);
    assert.equal(evilOpt.headers['access-control-allow-origin'], undefined);
  }

  // Verify no wildcard CORS in vite.config.ts
  const viteConfigSrc = fs.readFileSync(path.join(process.cwd(), 'vite.config.ts'), 'utf-8');
  assert.ok(
    !viteConfigSrc.includes("Access-Control-Allow-Origin', '*'"),
    'vite.config.ts must not expose wildcard Access-Control-Allow-Origin'
  );
  pass('6B Trusted-origin CORS & 403 untrusted preflight enforced across all 6 Vercel handlers & Vite dev middleware');

  // =========================================================================
  // 3. 6C Security Headers & Strict Production CSP
  // =========================================================================
  const distHtml = fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf-8');
  assert.ok(distHtml.includes('src="/theme-init.js"'), 'dist/index.html must load external /theme-init.js');
  // Check there are zero inline executable <script> blocks (allow only type="application/ld+json" and src=...)
  const scriptTags = [...distHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const [, attrs, inner] of scriptTags) {
    const isJsonLd = /type=["']application\/ld\+json["']/i.test(attrs);
    const hasSrc = /\bsrc=/i.test(attrs);
    assert.ok(isJsonLd || hasSrc || !inner.trim(), `Unexpected inline script in dist/index.html: ${attrs}`);
  }

  const prodPageCsp = buildContentSecurityPolicy({ isDev: false, isHttps: true, isApi: false });
  const scriptSrcMatch = prodPageCsp.match(/script-src ([^;]+)/);
  assert.ok(scriptSrcMatch && !scriptSrcMatch[1].includes("'unsafe-inline'"), 'Prod script-src must omit unsafe-inline');
  assert.ok(scriptSrcMatch && !scriptSrcMatch[1].includes("'unsafe-eval'"), 'Prod script-src must omit unsafe-eval');
  assert.ok(prodPageCsp.includes("frame-ancestors 'self'"));

  const vercelJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf-8'));
  const rootHeaderBlock = (vercelJson.headers || []).find((h: any) => h.source === '/(.*)');
  assert.ok(rootHeaderBlock, 'vercel.json must define /(.*) security headers');
  const rootHeaderKeys = new Set((rootHeaderBlock.headers || []).map((h: any) => h.key));
  for (const required of [
    'Content-Security-Policy',
    'Strict-Transport-Security',
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ]) {
    assert.ok(rootHeaderKeys.has(required), `vercel.json missing ${required}`);
  }
  const spaRewrite = (vercelJson.rewrites || []).find((r: any) => r.destination === '/index.html');
  assert.ok(spaRewrite?.source?.includes('theme-init'), 'vercel.json SPA rewrite must exclude theme-init.js');
  pass('6C Security headers, HSTS, strict no-unsafe-inline script CSP, and vercel.json parity verified');

  // =========================================================================
  // 4. 6D Safe JSON Parsing & Error Handling on All 6 Vercel Handlers
  // =========================================================================
  for (const [name, fn, url, query] of handlers) {
    const malformed = await invokeVercelHandler(fn, {
      method: 'POST',
      url,
      query,
      headers: { 'Content-Type': 'application/json' },
      body: '{"malformed":',
    });
    assert.equal(malformed.statusCode, 400, `${name} must return 400 on malformed JSON (not 500)`);
    assert.equal(malformed.body?.success, false);

    const arrayBody = await invokeVercelHandler(fn, {
      method: 'POST',
      url,
      query,
      headers: { 'Content-Type': 'application/json' },
      body: '[1,2,3]',
    });
    assert.equal(arrayBody.statusCode, 400, `${name} must return 400 on non-object JSON body`);
  }
  pass('6D All 6 Vercel handlers reject malformed JSON & non-object JSON cleanly with HTTP 400');

  // =========================================================================
  // 5. Live Express Bundle (dist/server.cjs) Phase 6 End-to-End Verification
  // =========================================================================
  const serverProcess: ChildProcess = spawn(process.execPath, [path.join(process.cwd(), 'dist', 'server.cjs')], {
    env: {
      ...process.env,
      PORT: '3000',
      NODE_ENV: 'production',
      USER_TOKEN_SECRET: 'phase6-test-user-token-secret-xyz',
      ADMIN_TOKEN_SECRET: 'phase6-test-admin-token-secret-xyz',
      ADMIN_PIN: '7410',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
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
    assert.ok(healthy, 'Express dist/server.cjs must start and respond on /api/health');

    // 5a. Static page HTML + /theme-init.js + headers
    const pageRes = await fetch('http://127.0.0.1:3000/');
    assert.equal(pageRes.status, 200);
    assert.equal(pageRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(pageRes.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(pageRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.ok((pageRes.headers.get('permissions-policy') || '').includes('camera=()'));
    assert.ok((pageRes.headers.get('strict-transport-security') || '').includes('max-age=31536000'));
    assert.ok((pageRes.headers.get('content-security-policy') || '').includes("frame-ancestors 'self'"));

    const themeJsRes = await fetch('http://127.0.0.1:3000/theme-init.js');
    assert.equal(themeJsRes.status, 200);
    assert.ok((themeJsRes.headers.get('content-type') || '').includes('javascript'));

    // 5b. Express API CSP & CORS checks
    const trustedApi = await fetch('http://127.0.0.1:3000/api/health', {
      headers: { Origin: 'https://mshindi.co.ke' },
    });
    assert.equal(trustedApi.status, 200);
    assert.equal(trustedApi.headers.get('access-control-allow-origin'), 'https://mshindi.co.ke');
    assert.equal(trustedApi.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(trustedApi.headers.get('x-frame-options'), 'DENY');
    assert.ok((trustedApi.headers.get('content-security-policy') || '').includes("default-src 'none'"));

    const evilApiPreflight = await fetch('http://127.0.0.1:3000/api/tokens/spend', {
      method: 'OPTIONS',
      headers: { Origin: 'https://phish.example.com' },
    });
    assert.equal(evilApiPreflight.status, 403);
    assert.equal(evilApiPreflight.headers.get('access-control-allow-origin'), null);

    // 5c. Express malformed JSON -> 400 JSON (never HTML/500)
    const badJsonRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"phone": "0712", broken',
    });
    assert.equal(badJsonRes.status, 400);
    const badJsonBody: any = await badJsonRes.json();
    assert.equal(badJsonBody?.success, false);

    // 5d. Express general route >1MB limit -> 413 JSON, while admin parse-pdf accepts >1MB up to 15MB
    const bigBody = JSON.stringify({ junk: 'a'.repeat(1_200_000) });
    const tooLargeRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bigBody,
    });
    assert.equal(tooLargeRes.status, 413);
    const tooLargeJson: any = await tooLargeRes.json();
    assert.equal(tooLargeJson?.success, false);

    // Admin parse-pdf allows >1MB valid PDF payload (e.g. 1.2MB raw -> 1.6MB base64)
    const paddedValidPdf = Buffer.concat([
      Buffer.from('%PDF-1.4\n% ', 'latin1'),
      Buffer.alloc(1_200_000, ' '),
      Buffer.from('\n%%EOF', 'latin1'),
    ]);
    const pdfOkRes = await fetch('http://127.0.0.1:3000/api/admin/parse-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ base64: paddedValidPdf.toString('base64') }),
    });
    assert.equal(pdfOkRes.status, 200);
    pass('Live Express dist/server.cjs enforces trusted CORS, CSP/HSTS/Frame headers, 400 malformed JSON, 413 >1MB cap, and 15MB PDF route');
  } finally {
    serverProcess.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\nALL PHASE 6 TESTS PASSED (${passed}/${passed})`);
}

main().catch((err) => {
  console.error('\nPHASE 6 SECURITY TEST FAILED:', err);
  process.exit(1);
});

