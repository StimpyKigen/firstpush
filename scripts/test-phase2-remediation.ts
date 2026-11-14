import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer as createViteServer } from 'vite';
import aiHandler from '../api/ai';
import adminHandler from '../api/admin';
import homepageFeedHandler from '../api/homepage-feed';
import { getConfiguredGeminiModel, DEFAULT_GEMINI_MODEL } from '../src/lib/serverAiService';
import { ADMIN_PHONE_NORMALIZED } from '../src/lib/adminAuthService';

function pass(msg: string) {
  console.log(`PASS: ${msg}`);
}

async function invokeVercelHandler(
  handlerFn: (req: any, res: any) => Promise<any>,
  opts: {
    method: string;
    url: string;
    query?: Record<string, any>;
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<{ statusCode: number; headers: Record<string, any>; body: any; rawText: string }> {
  const resHeaders: Record<string, any> = {};
  let statusCode = 200;
  let body: any = undefined;
  let rawText = '';

  const req: any = {
    method: opts.method,
    url: opts.url,
    query: opts.query || {},
    headers: Object.fromEntries(
      Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    ),
    body: opts.body,
    socket: { remoteAddress: '127.0.0.1' },
  };

  const res: any = {
    statusCode: 200,
    headersSent: false,
    writableEnded: false,
    setHeader(name: string, value: any) {
      resHeaders[name.toLowerCase()] = value;
    },
    getHeader(name: string) {
      return resHeaders[name.toLowerCase()];
    },
    status(code: number) {
      statusCode = code;
      res.statusCode = code;
      return res;
    },
    json(payload: any) {
      resHeaders['content-type'] = resHeaders['content-type'] || 'application/json; charset=utf-8';
      body = payload;
      rawText = JSON.stringify(payload);
      res.headersSent = true;
      res.writableEnded = true;
      return res;
    },
    send(payload: any) {
      body = payload;
      rawText = Buffer.isBuffer(payload) ? payload.toString('hex') : String(payload);
      res.headersSent = true;
      res.writableEnded = true;
      return res;
    },
    end(chunk?: any) {
      if (chunk !== undefined) {
        body = chunk;
        rawText = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
      }
      res.headersSent = true;
      res.writableEnded = true;
      return res;
    },
  };

  await handlerFn(req, res);
  return { statusCode, headers: resHeaders, body, rawText };
}

async function runTests() {
  console.log('=== PHASE 2 REMEDIATION TESTS (API ROUTING PARITY & FUNCTIONALITY) ===');

  // 1. Vercel Hobby 12-function limit check
  const apiDir = path.join(process.cwd(), 'api');
  const apiFiles = fs.readdirSync(apiDir).filter((f) => f.endsWith('.ts')).sort();
  assert.equal(apiFiles.length, 8, `Expected exactly 8 Vercel serverless functions, found: ${apiFiles.join(', ')}`);
  assert.ok(apiFiles.length <= 12, 'Vercel Hobby limit of 12 functions must not be exceeded');
  pass(`2.1 Vercel function count verified (${apiFiles.length}/12: ${apiFiles.join(', ')})`);

  // 2. vercel.json route parity & dead parser removal in server.ts
  const vercelJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf-8'));
  const rewriteSources = (vercelJson.rewrites || []).map((r: any) => r.source);
  assert.ok(rewriteSources.includes('/api/gemini/:endpoint*'), 'vercel.json must rewrite /api/gemini/*');
  assert.ok(rewriteSources.includes('/api/jackpots/mirror'), 'vercel.json must rewrite /api/jackpots/mirror');
  assert.ok(rewriteSources.includes('/api/health'), 'vercel.json must rewrite /api/health');
  assert.ok(rewriteSources.includes('/images/uploads/:folder/:fileName'), 'vercel.json must rewrite /images/uploads/*');
  assert.ok(
    (vercelJson.rewrites || []).some((r: any) => r.destination === '/api/ai?endpoint=not-found'),
    'vercel.json must route unmatched /api/* to JSON 404 endpoint'
  );

  const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  assert.ok(!serverSource.includes('/api/homepage-feed/upload-media'), 'Dead upload-media middleware must be removed from server.ts');
  assert.ok(serverSource.includes('fetchAuthoritativeSportScoreMatchDetail'), 'server.ts match-detail must use authoritative SportScore helper');
  pass('2.2 vercel.json rewrites & server.ts cleanup/parity verified');

  // 3. Configurable GEMINI_MODEL
  const prevModel = process.env.GEMINI_MODEL;
  delete process.env.GEMINI_MODEL;
  assert.equal(getConfiguredGeminiModel(), DEFAULT_GEMINI_MODEL);
  process.env.GEMINI_MODEL = 'gemini-2.5-flash';
  assert.equal(getConfiguredGeminiModel(), 'gemini-2.5-flash');
  if (prevModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = prevModel;
  pass('2.3 GEMINI_MODEL environment override verified');

  // 4. Vercel api/ai.ts security + routing parity
  const trustedOpt = await invokeVercelHandler(aiHandler, {
    method: 'OPTIONS',
    url: '/api/health',
    query: { endpoint: 'health' },
    headers: { origin: 'https://mshindi.co.ke' },
  });
  assert.equal(trustedOpt.statusCode, 200);
  assert.equal(trustedOpt.headers['access-control-allow-origin'], 'https://mshindi.co.ke');

  const untrustedOpt = await invokeVercelHandler(aiHandler, {
    method: 'OPTIONS',
    url: '/api/health',
    query: { endpoint: 'health' },
    headers: { origin: 'https://evil.example.com' },
  });
  assert.equal(untrustedOpt.statusCode, 403);
  assert.equal(untrustedOpt.headers['access-control-allow-origin'], undefined);

  const badJsonAi = await invokeVercelHandler(aiHandler, {
    method: 'POST',
    url: '/api/gemini/support-chat',
    query: { endpoint: 'support-chat' },
    headers: { 'content-type': 'application/json' },
    body: '{"broken":',
  });
  assert.equal(badJsonAi.statusCode, 400);
  assert.equal(badJsonAi.body?.success, false);

  const healthVercel = await invokeVercelHandler(aiHandler, {
    method: 'GET',
    url: '/api/health',
    query: { endpoint: 'health' },
  });
  assert.equal(healthVercel.statusCode, 200);
  assert.equal(healthVercel.body?.status, 'ok');

  const badChat = await invokeVercelHandler(aiHandler, {
    method: 'POST',
    url: '/api/gemini/support-chat',
    query: { endpoint: 'support-chat' },
    body: { message: '   ' },
  });
  assert.equal(badChat.statusCode, 400);

  const badAdvisorMode = await invokeVercelHandler(aiHandler, {
    method: 'POST',
    url: '/api/gemini/advisor',
    query: { endpoint: 'advisor' },
    body: { prompt: 'hello', mode: 'invalid_mode' },
  });
  assert.equal(badAdvisorMode.statusCode, 400);

  const unauthParser = await invokeVercelHandler(aiHandler, {
    method: 'POST',
    url: '/api/gemini/parse-jackpot-text',
    query: { endpoint: 'parse-jackpot-text' },
    body: { rawText: '1 Arsenal vs Chelsea 2.10 3.20 3.40' },
  });
  assert.equal(unauthParser.statusCode, 403);

  const prevAdminSecret = process.env.ADMIN_SECRET;
  const prevGeminiKey = process.env.GEMINI_API_KEY;
  process.env.ADMIN_SECRET = 'phase2-test-admin-secret';
  delete process.env.GEMINI_API_KEY;

  const authParser = await invokeVercelHandler(aiHandler, {
    method: 'POST',
    url: '/api/gemini/parse-jackpot-text',
    query: { endpoint: 'parse-jackpot-text' },
    headers: { 'x-admin-key': 'phase2-test-admin-secret' },
    body: {
      bookie: 'SportPesa',
      legCount: 2,
      rawText: '1. Arsenal vs Chelsea Sat 17:00 2.10 3.20 3.40\n2. Liverpool vs Everton Sun 19:30 1.65 3.80 4.90',
    },
  });
  assert.equal(authParser.statusCode, 200);
  assert.equal(authParser.body?.success, true);
  assert.ok(Array.isArray(authParser.body?.matches));

  const unknownVercel = await invokeVercelHandler(aiHandler, {
    method: 'GET',
    url: '/api/nonexistent-phase2-route',
    query: { endpoint: 'not-found' },
  });
  assert.equal(unknownVercel.statusCode, 404);
  assert.equal(unknownVercel.body?.success, false);
  pass('2.4 api/ai.ts security headers, CORS, validation, auth, parser fallback, and JSON 404 verified');

  // 5. Permanent media upload & /images/uploads/* serving parity on Vercel handlers
  const tinyPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const testFileName = `phase2-test-${Date.now()}.png`;
  const testDiskPath = path.join(process.cwd(), 'public', 'images', 'uploads', 'feed', testFileName);

  const prevPin = process.env.ADMIN_PIN;
  const prevAdminTokenSecret = process.env.ADMIN_TOKEN_SECRET;
  const prevUserTokenSecret = process.env.USER_TOKEN_SECRET;
  process.env.ADMIN_PIN = '7410';
  process.env.ADMIN_TOKEN_SECRET = 'phase2-admin-secret-xyz';
  process.env.USER_TOKEN_SECRET = 'phase2-user-secret-xyz';

  const pinLogin = await invokeVercelHandler(adminHandler, {
    method: 'POST',
    url: '/api/admin/verify-pin',
    query: { endpoint: 'verify-pin' },
    body: { pin: '7410', phone: ADMIN_PHONE_NORMALIZED },
  });
  assert.equal(pinLogin.statusCode, 200, 'Admin PIN verification should issue session token');
  const adminToken = pinLogin.body?.adminToken || pinLogin.body?.token;
  assert.ok(adminToken, 'Expected admin token from verify-pin');

  const uploadRes = await invokeVercelHandler(adminHandler, {
    method: 'POST',
    url: '/api/admin/upload-media',
    query: { endpoint: 'upload-media' },
    headers: { 'x-admin-token': adminToken },
    body: {
      dataUrl: `data:image/png;base64,${tinyPngBase64}`,
      fileName: testFileName,
      folder: 'feed',
    },
  });
  assert.equal(uploadRes.statusCode, 200);
  assert.equal(uploadRes.body?.url, `/images/uploads/feed/${testFileName}`);

  const mediaServeRes = await invokeVercelHandler(homepageFeedHandler, {
    method: 'GET',
    url: `/images/uploads/feed/${testFileName}`,
    query: { action: 'media', folder: 'feed', fileName: testFileName },
  });
  assert.equal(mediaServeRes.statusCode, 200);
  assert.equal(mediaServeRes.headers['content-type'], 'image/png');
  assert.equal(mediaServeRes.headers['x-content-type-options'], 'nosniff');
  assert.equal(mediaServeRes.headers['content-security-policy'], "default-src 'none'; sandbox");

  const missingMediaRes = await invokeVercelHandler(homepageFeedHandler, {
    method: 'GET',
    url: '/images/uploads/feed/does-not-exist-phase2.png',
    query: { action: 'media', folder: 'feed', fileName: 'does-not-exist-phase2.png' },
  });
  assert.equal(missingMediaRes.statusCode, 404);
  assert.equal(missingMediaRes.body?.success, false);
  pass('2.5 Upload + /images/uploads/* serving parity on Vercel handlers verified');

  // Clean up test artifact on disk & registry
  try {
    if (fs.existsSync(testDiskPath)) fs.unlinkSync(testDiskPath);
    for (const regFile of [
      path.join(process.cwd(), 'data', 'homepage_media.json'),
      path.join(process.cwd(), '.cache', 'homepage_media.json'),
    ]) {
      if (fs.existsSync(regFile)) {
        const reg = JSON.parse(fs.readFileSync(regFile, 'utf-8'));
        delete reg[`feed/${testFileName}`];
        fs.writeFileSync(regFile, JSON.stringify(reg, null, 2));
      }
    }
  } catch {}

  // Restore env
  if (prevAdminSecret === undefined) delete process.env.ADMIN_SECRET;
  else process.env.ADMIN_SECRET = prevAdminSecret;
  if (prevGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = prevGeminiKey;
  if (prevPin === undefined) delete process.env.ADMIN_PIN;
  else process.env.ADMIN_PIN = prevPin;
  if (prevAdminTokenSecret === undefined) delete process.env.ADMIN_TOKEN_SECRET;
  else process.env.ADMIN_TOKEN_SECRET = prevAdminTokenSecret;
  if (prevUserTokenSecret === undefined) delete process.env.USER_TOKEN_SECRET;
  else process.env.USER_TOKEN_SECRET = prevUserTokenSecret;

  // 6. Live Express bundle (dist/server.cjs) Phase 2 End-to-End Verification
  const expressPort = 3102;
  const serverProc: ChildProcess = spawn(process.execPath, [path.join(process.cwd(), 'dist', 'server.cjs')], {
    env: {
      ...process.env,
      PORT: String(expressPort),
      NODE_ENV: 'production',
      USER_TOKEN_SECRET: 'phase2-express-user-secret',
      ADMIN_TOKEN_SECRET: 'phase2-express-admin-secret',
      ADMIN_PIN: '7410',
      ADMIN_SECRET: 'phase2-express-admin-key',
      GEMINI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    let up = false;
    for (let i = 0; i < 40; i++) {
      try {
        const p = await fetch(`http://127.0.0.1:${expressPort}/api/health`);
        if (p.ok) {
          up = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    assert.ok(up, 'dist/server.cjs must start on port 3102');

    const expUnknown = await fetch(`http://127.0.0.1:${expressPort}/api/nonexistent-phase2-route`);
    assert.equal(expUnknown.status, 404, 'Express unknown /api/* route must return 404');
    assert.ok((expUnknown.headers.get('content-type') || '').includes('application/json'));
    const expUnknownJson = await expUnknown.json();
    assert.equal(expUnknownJson.success, false);

    const expBadSlug = await fetch(`http://127.0.0.1:${expressPort}/api/sports/match-detail?slug=bad!slug`);
    assert.equal(expBadSlug.status, 400);

    const expBadChat = await fetch(`http://127.0.0.1:${expressPort}/api/gemini/support-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    assert.equal(expBadChat.status, 400);

    const expParser = await fetch(`http://127.0.0.1:${expressPort}/api/gemini/parse-jackpot-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': 'phase2-express-admin-key',
      },
      body: JSON.stringify({
        bookie: 'SportPesa',
        legCount: 2,
        rawText: '1. Arsenal vs Chelsea Sat 17:00 2.10 3.20 3.40\n2. Liverpool vs Everton Sun 19:30 1.65 3.80 4.90',
      }),
    });
    assert.equal(expParser.status, 200);
    const expParserJson = await expParser.json();
    assert.equal(expParserJson.success, true);

    const expMissingUpload = await fetch(`http://127.0.0.1:${expressPort}/images/uploads/feed/missing-phase2.png`);
    assert.equal(expMissingUpload.status, 404);
    assert.ok((expMissingUpload.headers.get('content-type') || '').includes('application/json'));
    pass('2.6 Live Express dist/server.cjs parity & JSON 404 checks passed');
  } finally {
    serverProc.kill('SIGTERM');
  }

  // 7. Standalone Vite dev middleware bridge verification
  const viteServer = await createViteServer({
    server: { port: 3103, strictPort: true, host: '127.0.0.1' },
    logLevel: 'silent',
  });
  await viteServer.listen();
  try {
    const vHealth = await fetch('http://127.0.0.1:3103/api/health');
    assert.equal(vHealth.status, 200);
    const vHealthJson = await vHealth.json();
    assert.equal(vHealthJson.status, 'ok');

    const vBadChat = await fetch('http://127.0.0.1:3103/api/gemini/support-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    assert.equal(vBadChat.status, 400);

    const vUnknown = await fetch('http://127.0.0.1:3103/api/nonexistent-phase2-route');
    assert.equal(vUnknown.status, 404);
    assert.ok((vUnknown.headers.get('content-type') || '').includes('application/json'));

    const vMissingImg = await fetch('http://127.0.0.1:3103/images/uploads/feed/missing-phase2.png');
    assert.equal(vMissingImg.status, 404);
    assert.ok((vMissingImg.headers.get('content-type') || '').includes('application/json'));
    pass('2.7 Standalone Vite dev bridge (/api/health, /api/gemini/*, /images/uploads/*, 404 JSON) verified');
  } finally {
    await viteServer.close();
  }

  console.log('ALL PHASE 2 REMEDIATION TESTS PASSED');
}

runTests().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
