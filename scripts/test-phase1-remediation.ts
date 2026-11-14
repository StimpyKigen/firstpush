import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

let passed = 0;
function pass(label: string) {
  passed += 1;
  console.log(`PASS [${passed}]: ${label}`);
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}

function httpRequest(opts: {
  port: number;
  method?: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: opts.port,
        method: opts.method || 'GET',
        path: opts.path,
        headers: opts.headers || {},
        timeout: opts.timeoutMs ?? 8000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('HTTP request timeout')));
    if (opts.body !== undefined) {
      req.write(opts.body);
    }
    req.end();
  });
}

async function waitForServerReady(port: number, urlPath: string, childExited: () => boolean, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (childExited()) {
      throw new Error(`Child server exited prematurely while waiting for ${urlPath} on port ${port}`);
    }
    try {
      const res = await httpRequest({ port, path: urlPath, timeoutMs: 1500 });
      if (res.statusCode > 0 && res.statusCode < 500) {
        return;
      }
    } catch {
      // Retry until ready
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for server on port ${port} (${urlPath})`);
}

function killProcessTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  }
}

function buildMinimalValidPdf(text: string): string {
  const contentStream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj\n',
    `4 0 obj << /Length ${Buffer.byteLength(contentStream, 'utf-8')} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objs) {
    offsets.push(Buffer.byteLength(pdf, 'utf-8'));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf-8').toString('base64');
}

function createMockRevocationFirestore(options?: { failReads?: boolean; failWrites?: boolean }) {
  const docs = new Map<string, Record<string, any>>();
  const opts = { failReads: Boolean(options?.failReads), failWrites: Boolean(options?.failWrites) };

  const collection = (name: string) => {
    assert.equal(name, 'revokedTokens');
    return {
      doc: (docId: string) => ({
        async get() {
          if (opts.failReads) {
            throw new Error('Simulated Firestore read outage');
          }
          const data = docs.get(docId);
          return {
            exists: Boolean(data),
            id: docId,
            data: () => (data ? { ...data } : undefined),
          };
        },
        async set(data: Record<string, any>) {
          if (opts.failWrites) {
            throw new Error('Simulated Firestore write outage');
          }
          docs.set(docId, { ...data });
        },
        async delete() {
          docs.delete(docId);
        },
      }),
      where(field: string, op: string, value: any) {
        let maxLimit = 100;
        const q = {
          limit(n: number) {
            maxLimit = n;
            return q;
          },
          async get() {
            if (opts.failReads) {
              throw new Error('Simulated Firestore query outage');
            }
            const matched: Array<{ id: string; ref: { delete: () => Promise<void> }; data: () => any }> = [];
            for (const [id, row] of docs.entries()) {
              if (op === '<=' && typeof row[field] === 'number' && row[field] <= value) {
                matched.push({
                  id,
                  ref: {
                    async delete() {
                      docs.delete(id);
                    },
                  },
                  data: () => ({ ...row }),
                });
                if (matched.length >= maxLimit) break;
              }
            }
            return {
              empty: matched.length === 0,
              docs: matched,
            };
          },
        };
        return q;
      },
    };
  };

  return {
    docs,
    setOptions(next: { failReads?: boolean; failWrites?: boolean }) {
      if (next.failReads !== undefined) opts.failReads = next.failReads;
      if (next.failWrites !== undefined) opts.failWrites = next.failWrites;
    },
    db: {
      collection,
      batch() {
        const ops: Array<() => Promise<void>> = [];
        return {
          delete(ref: { delete: () => Promise<void> }) {
            ops.push(() => ref.delete());
          },
          async commit() {
            for (const op of ops) {
              await op();
            }
          },
        };
      },
    },
  };
}

async function runPhase1ATests() {
  console.log('\n--- 1A (FND-001): Vite Dev Middleware & Explicit allowedHosts ---');

  const { getDevAllowedHosts } = await import('../src/lib/devAllowedHosts');
  const defaultHosts = getDevAllowedHosts({});
  assert.ok(defaultHosts.includes('localhost'));
  assert.ok(defaultHosts.includes('127.0.0.1'));
  assert.ok(defaultHosts.includes('::1'));
  assert.ok(defaultHosts.includes('.localhost'));
  assert.equal(defaultHosts.includes('*'), false);

  const customHosts = getDevAllowedHosts({
    APP_URL: 'https://preview.mshindi.example:8443/app',
    VITE_DEV_ALLOWED_HOSTS: '*.trycloudflare.com, *, all, true, tunnel.mshindi.local:3000',
  });
  assert.ok(customHosts.includes('preview.mshindi.example'));
  assert.ok(customHosts.includes('tunnel.mshindi.local'));
  assert.equal(customHosts.includes('*'), false);
  assert.equal(customHosts.includes('all'), false);
  assert.equal(customHosts.includes('true'), false);
  pass('getDevAllowedHosts builds explicit allowlist and strips wildcards');

  const viteCfgSrc = fs.readFileSync(path.join(process.cwd(), 'vite.config.ts'), 'utf-8');
  assert.ok(!viteCfgSrc.includes('allowedHosts: true'), 'vite.config.ts must not use allowedHosts: true');
  assert.ok(
    !viteCfgSrc.includes("'/api/admin/fixtures'") && !viteCfgSrc.includes('extractPdfTextServer'),
    'vite.config.ts must not contain duplicate admin/PDF route implementations'
  );
  const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  assert.ok(!serverSrc.includes('allowedHosts: true'), 'server.ts must not use allowedHosts: true');
  pass('vite.config.ts & server.ts have zero allowedHosts:true and zero duplicated admin/PDF handlers');

  const sharedTestEnv = {
    ...process.env,
    NODE_ENV: 'development',
    DISABLE_HMR: 'true',
    ADMIN_PHONE: '254743304579',
    ADMIN_PIN: '9090',
    ADMIN_SECRET: 'phase1-remediation-test-secret-key-32bytes',
    ADMIN_TOKEN_SECRET: 'phase1-remediation-test-secret-key-32bytes',
    SESSION_SIGNING_SECRET: 'phase1-remediation-test-secret-key-32bytes',
    TOKEN_SIGNING_SECRET: 'phase1-remediation-test-secret-key-32bytes',
    FIREBASE_SERVICE_ACCOUNT: '',
    FIREBASE_SERVICE_ACCOUNT_PREVIEW: '',
  };

  // Backup data files modified during admin HTTP tests so test suite is idempotent
  const adminFixturesFile = path.join(process.cwd(), 'data', 'admin_fixtures.json');
  const hadFixturesFile = fs.existsSync(adminFixturesFile);
  const origFixturesBackup = hadFixturesFile ? fs.readFileSync(adminFixturesFile, 'utf-8') : null;

  const vitePort = await getFreePort();
  const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
  let viteExited = false;
  const viteChild = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'], {
    env: sharedTestEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  viteChild.on('exit', () => {
    viteExited = true;
  });

  try {
    await waitForServerReady(vitePort, '/api/admin/fixtures', () => viteExited, 25000);

    // Disallowed Host header blocked
    const badHostRes = await httpRequest({
      port: vitePort,
      path: '/',
      headers: { host: 'evil.attacker.example' },
    });
    assert.equal(badHostRes.statusCode, 403, `Standalone Vite must block unknown Host header (got ${badHostRes.statusCode})`);

    // Unauthenticated admin mutations rejected
    const unauthPostFixtures = await httpRequest({
      port: vitePort,
      method: 'POST',
      path: '/api/admin/fixtures',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fixtures: [{ homeTeam: 'A', awayTeam: 'B' }] }),
    });
    assert.equal(unauthPostFixtures.statusCode, 403, 'Standalone Vite POST /api/admin/fixtures must reject unauth (403)');

    const unauthDelBatch = await httpRequest({
      port: vitePort,
      method: 'DELETE',
      path: '/api/admin/fixtures/batch/nonexistent-batch',
    });
    assert.equal(unauthDelBatch.statusCode, 403, 'Standalone Vite DELETE /api/admin/fixtures/batch/* must reject unauth (403)');

    const unauthDelAll = await httpRequest({
      port: vitePort,
      method: 'DELETE',
      path: '/api/admin/fixtures',
    });
    assert.equal(unauthDelAll.statusCode, 403, 'Standalone Vite DELETE /api/admin/fixtures must reject unauth (403)');

    const unauthPdf = await httpRequest({
      port: vitePort,
      method: 'POST',
      path: '/api/admin/parse-pdf',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ base64: buildMinimalValidPdf('Arsenal vs Chelsea') }),
    });
    assert.equal(unauthPdf.statusCode, 403, 'Standalone Vite POST /api/admin/parse-pdf must reject unauth (403)');

    // Unknown API route returns JSON 404 (not SPA HTML)
    const unknownApi = await httpRequest({
      port: vitePort,
      path: '/api/nonexistent-route-check',
    });
    assert.equal(unknownApi.statusCode, 404);
    assert.ok(unknownApi.headers['content-type']?.includes('application/json'));

    // Authorized admin flow through standalone Vite
    const pinRes = await httpRequest({
      port: vitePort,
      method: 'POST',
      path: '/api/admin/verify-pin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '0743304579', pin: '9090' }),
    });
    assert.equal(pinRes.statusCode, 200);
    const pinJson = JSON.parse(pinRes.body);
    assert.equal(pinJson.valid, true);
    assert.ok(typeof pinJson.adminToken === 'string' && pinJson.adminToken.length > 20);

    // Malformed PDF must be rejected (400) when authenticated
    const badPdfRes = await httpRequest({
      port: vitePort,
      method: 'POST',
      path: '/api/admin/parse-pdf',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': pinJson.adminToken,
      },
      body: JSON.stringify({ base64: Buffer.from('NOT-A-PDF-HEADER').toString('base64') }),
    });
    assert.equal(badPdfRes.statusCode, 400, 'Standalone Vite /api/admin/parse-pdf must validate PDF header via decodePdfBase64Payload');

    // Valid minimal PDF succeeds when authenticated
    const validPdfRes = await httpRequest({
      port: vitePort,
      method: 'POST',
      path: '/api/admin/parse-pdf',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': pinJson.adminToken,
      },
      body: JSON.stringify({ base64: buildMinimalValidPdf('Arsenal vs Chelsea') }),
    });
    assert.equal(validPdfRes.statusCode, 200);
    const validPdfJson = JSON.parse(validPdfRes.body);
    assert.equal(validPdfJson.success, true);

    // Authorized fixture ingestion & cleanup
    const ingestRes = await httpRequest({
      port: vitePort,
      method: 'POST',
      path: '/api/admin/fixtures',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': pinJson.adminToken,
      },
      body: JSON.stringify({
        fixtures: [{ id: 'phase1-test-fix-1', homeTeam: 'Arsenal', awayTeam: 'Chelsea', sport: 'football' }],
        fileName: 'phase1-test.pdf',
      }),
    });
    assert.equal(ingestRes.statusCode, 200);
    const ingestJson = JSON.parse(ingestRes.body);
    const createdBatchId = ingestJson.batches?.[0]?.id;
    assert.ok(createdBatchId, 'Expected created batch id on authorized ingest');

    const delBatchRes = await httpRequest({
      port: vitePort,
      method: 'DELETE',
      path: `/api/admin/fixtures/batch/${encodeURIComponent(createdBatchId)}`,
      headers: { 'x-admin-token': pinJson.adminToken },
    });
    assert.equal(delBatchRes.statusCode, 200);
    pass('Standalone `vite` HTTP server blocks spoofed Host, rejects unauth admin mutations, validates PDFs & permits authorized admin workflow');
  } finally {
    killProcessTree(viteChild.pid);
  }

  // Test `npx tsx server.ts` (`npm run dev` path)
  const appPort = await getFreePort();
  const tsxBin = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
  let appExited = false;
  const appChild = spawn(process.execPath, [tsxBin, 'server.ts'], {
    env: { ...sharedTestEnv, PORT: String(appPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  appChild.on('exit', () => {
    appExited = true;
  });

  try {
    await waitForServerReady(appPort, '/api/admin/fixtures', () => appExited, 30000);

    const badHostExpress = await httpRequest({
      port: appPort,
      path: '/',
      headers: { host: 'evil.attacker.example' },
    });
    assert.equal(badHostExpress.statusCode, 403, `npm run dev Vite middleware must reject disallowed Host (got ${badHostExpress.statusCode})`);

    const unauthExpressPost = await httpRequest({
      port: appPort,
      method: 'POST',
      path: '/api/admin/fixtures',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fixtures: [] }),
    });
    assert.equal(unauthExpressPost.statusCode, 403);

    const okHomeRes = await httpRequest({
      port: appPort,
      path: '/',
      headers: { host: `127.0.0.1:${appPort}` },
    });
    assert.equal(okHomeRes.statusCode, 200);
    pass('Full `tsx server.ts` (`npm run dev`) enforces allowedHosts & admin authentication over HTTP');
  } finally {
    killProcessTree(appChild.pid);
    if (origFixturesBackup !== null) {
      fs.writeFileSync(adminFixturesFile, origFixturesBackup, 'utf-8');
    } else if (fs.existsSync(adminFixturesFile)) {
      fs.unlinkSync(adminFixturesFile);
    }
  }
}

async function runPhase1BTests() {
  console.log('\n--- 1B (FND-003): Client Storage Security & Cross-Account Isolation ---');

  const backingStorage = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => (backingStorage.has(k) ? backingStorage.get(k)! : null),
    setItem: (k: string, v: string) => {
      backingStorage.set(k, String(v));
    },
    removeItem: (k: string) => {
      backingStorage.delete(k);
    },
    clear: () => {
      backingStorage.clear();
    },
    key: (i: number) => Array.from(backingStorage.keys())[i] ?? null,
    get length() {
      return backingStorage.size;
    },
  };

  // Seed legacy compromised localStorage payload BEFORE store hydration
  mockLocalStorage.setItem(
    'mshindi-auth',
    JSON.stringify({
      state: {
        currentUser: { phone: '254700000001', username: 'Alice', createdAt: '2026-01-01T00:00:00Z' },
        currentPhone: '254700000001',
      },
      version: 0,
    })
  );
  mockLocalStorage.setItem(
    'mshindi-wallet',
    JSON.stringify({
      state: {
        unlockedRooms: ['legacy-room'],
        balance: 500,
        redeemedCodes: ['LEGACY1'],
        userSessionToken: 'utok.MUST_BE_SCRUBBED_ON_MERGE',
        walletOwnerPhone: '254700000001',
      },
      version: 0,
    })
  );

  (globalThis as any).localStorage = mockLocalStorage;
  (globalThis as any).window = {
    localStorage: mockLocalStorage,
    location: { origin: 'http://localhost:3000', protocol: 'http:' },
  };
  (globalThis as any).fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return { success: true, loggedOut: true, authenticated: false };
    },
  });

  const { useAuth } = await import('../src/lib/authStore');
  const { useWallet } = await import('../src/lib/store');
  const { useSubscriptionStore } = await import('../src/lib/subscriptionStore');
  const { notifySessionChanged } = await import('../src/lib/sessionLifecycle');

  // Rehydrate check: legacy userSessionToken must NOT exist on state or persisted JSON
  const rehydratedWallet = useWallet.getState() as any;
  assert.equal(rehydratedWallet.userSessionToken, undefined, 'Wallet state must not retain userSessionToken');

  // Apply snapshot carrying userSessionToken -> must NEVER persist token to localStorage['mshindi-wallet']
  useWallet.getState().applyServerWalletSnapshot({
    userUid: '254700000001',
    walletBalanceKsh: 750,
    mshindiTokens: 4,
    activeTokenIds: ['T-1', 'T-2'],
    unlockedRooms: ['room-alpha', 'room-beta'],
    redeemedCodes: ['MPESA001'],
    transactions: [{ id: 'tx-1', type: 'topup', label: 'Topup', amount: 750, time: 'now' }],
    userSessionToken: 'utok.SENSITIVE_BEARER_TOKEN_XYZ',
  });

  const persistedWalletRaw = mockLocalStorage.getItem('mshindi-wallet') || '';
  assert.ok(
    !persistedWalletRaw.includes('utok.SENSITIVE_BEARER_TOKEN_XYZ') &&
      !persistedWalletRaw.includes('userSessionToken'),
    'localStorage["mshindi-wallet"] must NEVER persist userSessionToken'
  );
  pass('useWallet never persists userSessionToken into localStorage even when server payload includes it');

  // Authoritative replacement (revoked room/code removed instead of permanently unioned)
  useWallet.getState().applyServerWalletSnapshot({
    userUid: '254700000001',
    walletBalanceKsh: 500,
    unlockedRooms: ['room-beta'],
    redeemedCodes: [],
  });
  assert.deepEqual(useWallet.getState().unlockedRooms, ['room-beta']);
  assert.deepEqual(useWallet.getState().redeemedCodes, []);
  assert.equal(useWallet.getState().balance, 500);
  pass('applyServerWalletSnapshot authoritatively replaces unlockedRooms and redeemedCodes instead of union-leaking stale items');

  // Populate subscription state for Account A
  useSubscriptionStore.setState({
    activeUserId: '254700000001',
    subscription: {
      userId: '254700000001',
      status: 'active',
      plan: 'monthly',
      trialClaimed: true,
      trialStartedAt: null,
      trialExpiresAt: null,
      activatedAt: '2026-11-01T00:00:00Z',
      expiresAt: '2026-12-01T00:00:00Z',
      nextPaymentDate: '2026-12-01T00:00:00Z',
      lastPaymentRef: 'ABC123XYZ',
      amountKsh: 75,
      updatedAt: '2026-11-01T00:00:00Z',
    },
    history: [
      {
        id: 'h-1',
        userId: '254700000001',
        plan: 'monthly',
        type: 'subscription',
        amountKsh: 75,
        transactionRef: 'ABC123XYZ',
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2026-12-01T00:00:00Z',
        status: 'active',
        createdAt: '2026-11-01T00:00:00Z',
      },
    ],
  });
  assert.equal(useSubscriptionStore.getState().hasPremiumAccess(), true);

  // Logout must wipe wallet AND subscription state completely
  await useAuth.getState().logOut();
  assert.equal(useWallet.getState().balance, 0);
  assert.equal(useWallet.getState().mshindiTokens, 0);
  assert.deepEqual(useWallet.getState().unlockedRooms, []);
  assert.deepEqual(useWallet.getState().transactions, []);
  assert.equal(useSubscriptionStore.getState().subscription, null);
  assert.deepEqual(useSubscriptionStore.getState().history, []);
  assert.equal(useSubscriptionStore.getState().hasPremiumAccess(), false);
  pass('logOut resets both useWallet and useSubscriptionStore completely');

  // Direct account switch (User A -> User B without intermediate logout) must wipe User A data
  useWallet.getState().applyServerWalletSnapshot({
    userUid: '254700000001',
    walletBalanceKsh: 999,
    mshindiTokens: 9,
    unlockedRooms: ['secret-room-a'],
    transactions: [{ id: 'tx-a', type: 'topup', label: 'A', amount: 999, time: 'now' }],
  });
  useSubscriptionStore.setState({
    activeUserId: '254700000001',
    subscription: {
      userId: '254700000001',
      status: 'active',
      plan: 'weekly',
      trialClaimed: true,
      trialStartedAt: null,
      trialExpiresAt: null,
      activatedAt: '2026-11-01T00:00:00Z',
      expiresAt: '2026-12-01T00:00:00Z',
      nextPaymentDate: null,
      lastPaymentRef: 'REF-A',
      amountKsh: 20,
      updatedAt: '2026-11-01T00:00:00Z',
    },
  });

  // Switch to User B
  notifySessionChanged('254700000002');
  assert.equal(useWallet.getState().balance, 0);
  assert.deepEqual(useWallet.getState().unlockedRooms, []);
  assert.equal(useWallet.getState().walletOwnerPhone, null);
  assert.equal(useSubscriptionStore.getState().subscription, null);
  assert.equal(useSubscriptionStore.getState().activeUserId, null);
  pass('Switching Account A -> Account B wipes cached wallet and subscription state immediately');
}

async function runPhase1CTests() {
  console.log('\n--- 1C (FND-004): Shared Persistent Token Revocation & Fail-Closed Behavior ---');

  process.env.SESSION_SIGNING_SECRET = 'phase1c-secret-signing-key-32-bytes';
  process.env.TOKEN_SIGNING_SECRET = 'phase1c-secret-signing-key-32-bytes';
  process.env.ADMIN_SECRET = 'phase1c-secret-signing-key-32-bytes';
  process.env.ADMIN_TOKEN_SECRET = 'phase1c-secret-signing-key-32-bytes';
  process.env.ADMIN_PHONE = '254743304579';
  process.env.ADMIN_PIN = '9090';

  const revStore = await import('../src/lib/tokenRevocationStore');
  const adminAuth = await import('../src/lib/adminAuthService');
  const tokenEconomy = await import('../src/lib/serverTokenEconomy');

  const mockFs = createMockRevocationFirestore();
  revStore.setRevocationFirestoreOverrideForTests(mockFs.db);
  revStore.resetRevocationCacheForTests();

  try {
    // Issue user token & admin token
    const adminLogin = adminAuth.verifyAdminPinCredentials('0743304579', '9090');
    assert.equal(adminLogin.valid, true, adminLogin.error || 'Admin PIN login must succeed');
    const adminTok = adminLogin.adminToken!;
    const userTok = tokenEconomy.issueUserSessionToken('254711223344')!;
    assert.ok(userTok.startsWith('utok.'));

    // Verify valid before revocation
    const adminValidBefore = await adminAuth.verifyAdminRequestAsync({ 'x-admin-token': adminTok });
    assert.equal(adminValidBefore.authorized, true);
    const userValidBefore = await tokenEconomy.verifyUserSessionTokenAsync(userTok);
    assert.equal(userValidBefore.valid, true);

    // Revoke both asynchronously -> must store hashed key ONLY (no raw token or nonce)
    const revAdmin = await adminAuth.revokeAdminTokenAsync(adminTok);
    const revUser = await tokenEconomy.revokeUserSessionTokenAsync(userTok);
    assert.equal(revAdmin, true);
    assert.equal(revUser, true);
    assert.equal(mockFs.docs.size, 2);

    const adminNonce = adminTok.split(':')[2];
    const userNonce = Buffer.from(userTok.split('.')[1], 'base64url').toString('utf-8').split(':')[2];
    assert.ok(adminNonce && userNonce);
    for (const [docId, docData] of mockFs.docs.entries()) {
      const serialized = JSON.stringify(docData);
      assert.notEqual(docId, adminNonce, 'Doc ID must be hashed, not raw admin nonce');
      assert.notEqual(docId, userNonce, 'Doc ID must be hashed, not raw user nonce');
      assert.ok(!serialized.includes(adminTok) && !serialized.includes(adminNonce), 'Raw admin token/nonce must not be persisted');
      assert.ok(!serialized.includes(userTok) && !serialized.includes(userNonce), 'Raw user token/nonce must not be persisted');
    }
    pass('Revoked tokens are persisted to Firestore revokedTokens/{sha256} without raw tokens or nonces');

    // Simulate cold container / separate serverless instance by wiping local memory cache
    revStore.resetRevocationCacheForTests();

    const adminAfterColdReset = await adminAuth.verifyAdminRequestAsync({ 'x-admin-token': adminTok });
    assert.equal(adminAfterColdReset.authorized, false);
    const userAfterColdReset = await tokenEconomy.verifyUserSessionTokenAsync(userTok);
    assert.equal(userAfterColdReset.valid, false);
    assert.notEqual(userAfterColdReset.storeUnavailable, true);

    const httpAuthCheck = await tokenEconomy.authenticateTokenRequestAsync(
      { 'x-user-token': userTok },
      { userUid: '254711223344' }
    );
    assert.equal(httpAuthCheck.authenticated, false);
    assert.equal(httpAuthCheck.statusCode, 401);
    pass('Revoked admin and user sessions stay rejected across simulated cold server instance (cache reset)');

    // Test expired revocation cleanup
    const expiredId = revStore.hashRevocationNonce('expired-test-nonce');
    await mockFs.db.collection('revokedTokens').doc(expiredId).set({
      idHash: expiredId,
      tokenType: 'user',
      expiresAtMs: Date.now() - 10_000,
      revokedAt: new Date(Date.now() - 20_000).toISOString(),
    });
    const cleaned = await revStore.cleanupExpiredRevokedTokensAsync();
    assert.ok(cleaned.prunedFirestore >= 1);
    assert.equal(mockFs.docs.has(expiredId), false);
    pass('Expired revocation records are pruned via cleanupExpiredRevokedTokensAsync');

    // Test FAIL-CLOSED on Firestore read outage (even for a token that previously passed!)
    const freshAdminTok = adminAuth.verifyAdminPinCredentials('0743304579', '9090').adminToken!;
    const freshUserTok = tokenEconomy.issueUserSessionToken('254799887766')!;
    assert.equal((await adminAuth.verifyAdminRequestAsync({ 'x-admin-token': freshAdminTok })).authorized, true);
    assert.equal((await tokenEconomy.verifyUserSessionTokenAsync(freshUserTok)).valid, true);

    mockFs.setOptions({ failReads: true });
    const outageAdmin = await adminAuth.verifyAdminRequestAsync({ 'x-admin-token': freshAdminTok });
    assert.equal(outageAdmin.authorized, false);
    assert.equal(outageAdmin.storeUnavailable, true);

    const outageUser = await tokenEconomy.verifyUserSessionTokenAsync(freshUserTok);
    assert.equal(outageUser.valid, false);
    assert.equal(outageUser.storeUnavailable, true);

    const outageHttp = await tokenEconomy.authenticateTokenRequestAsync(
      { 'x-user-token': freshUserTok },
      { userUid: '254799887766' }
    );
    assert.equal(outageHttp.authenticated, false);
    assert.equal(outageHttp.statusCode, 503);
    pass('Zero negative cache & fail-closed (503 / storeUnavailable) when revocation Firestore throws');

    // Test FAIL-CLOSED in serverless env when Firestore is unconfigured
    const prevVercel = process.env.VERCEL;
    process.env.VERCEL = '1';
    revStore.setRevocationFirestoreOverrideForTests(null);
    revStore.resetRevocationCacheForTests();
    try {
      const noDbAdmin = await adminAuth.verifyAdminRequestAsync({ 'x-admin-token': freshAdminTok });
      assert.equal(noDbAdmin.authorized, false);
      assert.equal(noDbAdmin.storeUnavailable, true);
      const noDbUser = await tokenEconomy.verifyUserSessionTokenAsync(freshUserTok);
      assert.equal(noDbUser.valid, false);
      assert.equal(noDbUser.storeUnavailable, true);
      pass('Serverless mode without Firestore fails closed instead of falling back silently to local memory');
    } finally {
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
    }
  } finally {
    revStore.setRevocationFirestoreOverrideForTests(undefined);
    revStore.resetRevocationCacheForTests();
  }
}

async function runPhase1DTests() {
  console.log('\n--- 1D (FND-010): Unified Firebase Admin Initialization ---');

  const libDir = path.join(process.cwd(), 'src', 'lib');
  const libFiles = fs.readdirSync(libDir).filter((f) => f.endsWith('.ts'));
  for (const file of libFiles) {
    const content = fs.readFileSync(path.join(libDir, file), 'utf-8');
    if (file !== 'serverFirebaseAdmin.ts' && file !== 'ratingDatabaseFirestore.ts') {
      assert.ok(
        !content.includes('initializeApp('),
        `${file} must not call initializeApp() directly (must use serverFirebaseAdmin.ts)`
      );
    }
  }
  const homepageSrc = fs.readFileSync(path.join(libDir, 'serverHomepageFeed.ts'), 'utf-8');
  assert.ok(
    !homepageSrc.includes("from 'firebase/firestore'") && !homepageSrc.includes('clientDb'),
    'serverHomepageFeed.ts must not contain firebase/firestore client SDK fallback'
  );
  pass('Only serverFirebaseAdmin.ts initializes firebase-admin & serverHomepageFeed.ts has zero client SDK fallback');

  const fbAdmin = await import('../src/lib/serverFirebaseAdmin');
  const validSa = {
    project_id: 'mshindi-test-project',
    client_email: 'firebase-adminsdk@mshindi-test-project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADAN\\n-----END PRIVATE KEY-----\\n',
  };

  // Raw JSON with escaped \n
  const parsedRaw = fbAdmin.parseServiceAccountCredentials(JSON.stringify(validSa));
  assert.ok(parsedRaw);
  assert.equal(parsedRaw.project_id, 'mshindi-test-project');
  assert.ok(parsedRaw.private_key.includes('\n'), 'Escaped \\n in private_key must normalize to real newlines');

  // Base64 JSON
  const b64 = Buffer.from(JSON.stringify(validSa), 'utf-8').toString('base64');
  const parsedB64 = fbAdmin.parseServiceAccountCredentials(b64);
  assert.ok(parsedB64);
  assert.equal(parsedB64.client_email, validSa.client_email);

  // Malformed JSON
  assert.equal(fbAdmin.parseServiceAccountCredentials('{not valid json'), null);
  assert.equal(fbAdmin.parseServiceAccountCredentials(''), null);
  pass('serverFirebaseAdmin parses raw JSON, base64 JSON, escaped newlines, and safely rejects malformed credentials');

  // Preview vs Production isolation check
  const prevVercelEnv = process.env.VERCEL_ENV;
  const prevProdSa = process.env.FIREBASE_SERVICE_ACCOUNT;
  const prevPreviewSa = process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW;
  try {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ ...validSa, project_id: 'prod-only' });
    delete process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW;
    process.env.VERCEL_ENV = 'preview';
    assert.equal(
      fbAdmin.resolveScopedServiceAccountRaw(),
      undefined,
      'Preview environment must NOT inherit production FIREBASE_SERVICE_ACCOUNT'
    );

    process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW = JSON.stringify({ ...validSa, project_id: 'preview-only' });
    assert.ok((fbAdmin.resolveScopedServiceAccountRaw() || '').includes('preview-only'));

    process.env.VERCEL_ENV = 'production';
    assert.ok((fbAdmin.resolveScopedServiceAccountRaw() || '').includes('prod-only'));
    pass('Preview vs production credential isolation enforced by serverFirebaseAdmin');
  } finally {
    if (prevVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevVercelEnv;
    if (prevProdSa === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT;
    else process.env.FIREBASE_SERVICE_ACCOUNT = prevProdSa;
    if (prevPreviewSa === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW;
    else process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW = prevPreviewSa;
    fbAdmin.resetFirebaseAdminForTests();
  }
}

async function main() {
  try {
    await runPhase1DTests();
    await runPhase1CTests();
    await runPhase1BTests();
    await runPhase1ATests();
    console.log(`\nALL PHASE 1 REMEDIATION CHECKS PASSED (${passed} checks).`);
    process.exit(0);
  } catch (err) {
    console.error('\nPHASE 1 REMEDIATION TEST FAILED:', err);
    process.exit(1);
  }
}

void main();
