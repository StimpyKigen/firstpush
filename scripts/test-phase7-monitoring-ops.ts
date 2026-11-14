import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Isolated test environment before importing app/server modules
process.env.USER_SESSION_SECRET = process.env.USER_SESSION_SECRET || 'phase7_test_user_secret_xyz_123456';
process.env.ADMIN_PIN = process.env.ADMIN_PIN || '8899';
process.env.ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || 'phase7_test_admin_secret_xyz_123456';
process.env.FIREBASE_SERVICE_ACCOUNT = '';

import moderationHandler from '../api/moderation.js';
import adminHandler from '../api/admin.js';
import tokensHandler from '../api/tokens.js';
import {
  issueUserSessionToken,
  resetTokenEconomyForTesting,
  setTokenPersistenceEnabled,
} from '../src/lib/serverTokenEconomy.js';
import { generateAdminToken } from '../src/lib/adminAuthService.js';
import { resetModerationServerForTests } from '../src/lib/serverModerationService.js';
import { resetP2pServerForTests } from '../src/lib/serverP2pService.js';
import {
  extractTrustedClientIp,
  resetRateLimiterForTests,
} from '../src/lib/rateLimitService.js';
import {
  querySecurityEvents,
  resetSecurityAuditLogsForTests,
} from '../src/lib/securityAuditLogger.js';

function createMockRes() {
  const headers: Record<string, string | string[]> = {};
  let statusCode = 200;
  let jsonBody: any = null;

  const res: any = {
    statusCode: 200,
    setHeader(name: string, val: string | string[]) {
      headers[name] = val;
      headers[name.toLowerCase()] = val;
    },
    getHeader(name: string) {
      return headers[name] ?? headers[name.toLowerCase()];
    },
    status(code: number) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      jsonBody = payload;
      return this;
    },
    send(payload: any) {
      jsonBody = payload;
      return this;
    },
    end() {
      return this;
    },
  };

  return {
    res,
    getStatus: () => statusCode,
    getBody: () => jsonBody,
    getHeaders: () => headers,
  };
}

async function callHandler(
  handler: any,
  opts: {
    method?: string;
    url: string;
    query?: Record<string, any>;
    headers?: Record<string, string>;
    body?: any;
    remoteAddress?: string;
  }
) {
  const mock = createMockRes();
  const req: any = {
    method: opts.method || 'GET',
    url: opts.url,
    query: opts.query || {},
    headers: {
      origin: 'http://localhost:3000',
      ...(opts.headers || {}),
    },
    socket: {
      remoteAddress: opts.remoteAddress || '203.0.113.10',
    },
    body: opts.body,
  };
  await handler(req, mock.res);
  return {
    statusCode: mock.getStatus(),
    body: mock.getBody(),
    headers: mock.getHeaders(),
  };
}

let passed = 0;
let failed = 0;

async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    failed += 1;
    console.error(`  [FAIL] ${name}: ${err?.message || err}`);
  }
}

async function main() {
  console.log('\n=============================================================');
  console.log('PHASE 7 SECURITY & REGRESSION TESTS (MODERATION, P2P, RL, AUDIT)');
  console.log('=============================================================\n');

  setTokenPersistenceEnabled(false);
  resetTokenEconomyForTesting();
  resetModerationServerForTests();
  resetP2pServerForTests();
  resetRateLimiterForTests();
  resetSecurityAuditLogsForTests();

  const userA = '254711000001';
  const userB = '254722000002';
  const userC = '254733000003';
  const tokenA = issueUserSessionToken(userA);
  const tokenB = issueUserSessionToken(userB);
  const tokenC = issueUserSessionToken(userC);
  const adminToken = generateAdminToken('254743304579');

  await check('7.1 MSH-024 Server-Authoritative Moderation Dictionary & RBAC', async () => {
    // Public dictionary read returns enabled entries
    const dictGet = await callHandler(moderationHandler, {
      method: 'GET',
      url: '/api/moderation/dictionary',
      query: { endpoint: 'dictionary' },
    });
    assert.equal(dictGet.statusCode, 200);
    assert.equal(dictGet.body?.success, true);
    assert.ok(Array.isArray(dictGet.body?.entries) && dictGet.body.entries.length > 0);

    // Unauth & non-admin dictionary mutations are blocked 403
    const unauthAdd = await callHandler(moderationHandler, {
      method: 'POST',
      url: '/api/moderation/dictionary',
      query: { endpoint: 'dictionary' },
      body: {
        operation: 'add',
        phrase: 'scamphrase_test',
        category: 'Scam & Fraud',
        severity: 'High',
        action: 'Block',
      },
    });
    assert.equal(unauthAdd.statusCode, 403);

    const userAdd = await callHandler(moderationHandler, {
      method: 'POST',
      url: '/api/moderation/dictionary',
      query: { endpoint: 'dictionary' },
      headers: { 'x-user-token': tokenA },
      body: {
        action: 'add',
        phrase: 'scamphrase_test',
        category: 'Scam & Fraud',
        severity: 'High',
      },
    });
    assert.equal(userAdd.statusCode, 403);

    // Admin adds custom phrase and server moderation blocks it
    const adminAdd = await callHandler(moderationHandler, {
      method: 'POST',
      url: '/api/moderation/dictionary',
      query: { endpoint: 'dictionary' },
      headers: { 'x-admin-token': adminToken },
      body: {
        operation: 'add',
        phrase: 'badtipster77',
        category: 'Scam & Fraud',
        severity: 'Critical',
        action: 'Block',
      },
    });
    assert.equal(adminAdd.statusCode, 201);
    const addedId = adminAdd.body?.entry?.id;
    assert.ok(addedId);

    const modCheck = await callHandler(moderationHandler, {
      method: 'POST',
      url: '/api/moderation/check',
      query: { endpoint: 'check' },
      body: { text: 'Join badtipster77 sure bet group now!' },
    });
    assert.equal(modCheck.statusCode, 200);
    assert.equal(modCheck.body?.result?.isAllowed, false);

    // Admin can delete custom test entry
    const adminDel = await callHandler(moderationHandler, {
      method: 'DELETE',
      url: '/api/moderation/dictionary',
      query: { endpoint: 'dictionary' },
      headers: { 'x-admin-token': adminToken },
      body: { id: addedId },
    });
    assert.equal(adminDel.statusCode, 200);
  });

  await check('7.2 MSH-024 Abuse Reports Server Isolation, Validation & Admin Workflow', async () => {
    // Non-admin & unauth users blocked from reading, updating, or deleting reports (403)
    const unauthReports = await callHandler(moderationHandler, {
      method: 'GET',
      url: '/api/moderation/reports',
      query: { endpoint: 'reports' },
    });
    assert.equal(unauthReports.statusCode, 403);

    const nonAdminReports = await callHandler(moderationHandler, {
      method: 'GET',
      url: '/api/moderation/reports',
      query: { endpoint: 'reports' },
      headers: { 'x-user-token': tokenA },
    });
    assert.equal(nonAdminReports.statusCode, 403);

    // Short description rejected 400
    const shortRep = await callHandler(moderationHandler, {
      method: 'POST',
      url: '/api/moderation/reports',
      query: { endpoint: 'reports' },
      headers: { 'x-user-token': tokenA },
      body: {
        postId: 'post-99',
        reportedUser: 'Spammer',
        reasonCategory: 'Scam',
        description: 'bad',
      },
    });
    assert.equal(shortRep.statusCode, 400);

    // Authenticated report submission forces status = Pending regardless of forged client fields
    const validRep = await callHandler(moderationHandler, {
      method: 'POST',
      url: '/api/moderation/reports',
      query: { endpoint: 'reports' },
      headers: { 'x-user-token': tokenA },
      body: {
        postId: 'post-123',
        reportedUser: 'BadActor',
        postContent: 'Inbox me 0712345678 for fixed game',
        reporterUsername: 'UserAlpha',
        reasonCategory: 'Scam / Fraudulent Content',
        description: 'Sharing sure bet claims and masked phone contact.',
        status: 'Reviewed', // Spoof attempt must be ignored
      },
    });
    assert.equal(validRep.statusCode, 201);
    assert.equal(validRep.body?.report?.status, 'Pending');
    const reportId = validRep.body?.report?.id;
    assert.ok(reportId);

    // Non-admin still cannot mark Reviewed or Delete
    const userStatusUpdate = await callHandler(moderationHandler, {
      method: 'POST',
      url: '/api/moderation/reports/status',
      query: { endpoint: ['reports', 'status'] },
      headers: { 'x-user-token': tokenA },
      body: { id: reportId, status: 'Reviewed' },
    });
    assert.equal(userStatusUpdate.statusCode, 403);

    // Admin lists reports, marks Reviewed, then deletes
    const adminList = await callHandler(moderationHandler, {
      method: 'GET',
      url: '/api/moderation/reports',
      query: { endpoint: 'reports' },
      headers: { 'x-admin-token': adminToken },
    });
    assert.equal(adminList.statusCode, 200);
    assert.equal(adminList.body?.reports?.[0]?.id, reportId);
    assert.equal(adminList.body?.reports?.[0]?.autoModeration?.isAllowed, false);

    const adminReview = await callHandler(moderationHandler, {
      method: 'POST',
      url: '/api/moderation/reports/status',
      query: { endpoint: ['reports', 'status'] },
      headers: { 'x-admin-token': adminToken },
      body: { id: reportId, status: 'Reviewed' },
    });
    assert.equal(adminReview.statusCode, 200);
    assert.equal(adminReview.body?.report?.status, 'Reviewed');
  });

  await check('7.3 MSH-019 Server-Authoritative P2P Escrow, IDOR Blocking & Settlement', async () => {
    resetRateLimiterForTests();

    // Unauthenticated P2P rejected 401
    const unauthP2p = await callHandler(tokensHandler, {
      method: 'GET',
      url: '/api/tokens/p2p',
      query: { endpoint: 'p2p' },
    });
    assert.equal(unauthP2p.statusCode, 401);

    // Non-integer / below-min / prohibited-content bet creation rejected 400
    const badStake = await callHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/p2p/create',
      query: { endpoint: ['p2p', 'create'] },
      headers: { 'x-user-token': tokenA },
      body: {
        title: 'Arsenal vs Chelsea',
        category: 'Sports',
        creatorSidePick: 'Arsenal Win',
        opponentSidePick: 'Chelsea Win',
        creatorStake: 5,
        opponentStake: 100,
      },
    });
    assert.equal(badStake.statusCode, 400);

    const scamContent = await callHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/p2p/create',
      query: { endpoint: ['p2p', 'create'] },
      headers: { 'x-user-token': tokenA },
      body: {
        title: 'Fixed match guaranteed win',
        category: 'Sports',
        creatorSidePick: 'Home',
        opponentSidePick: 'Away',
        creatorStake: 50,
        opponentStake: 50,
      },
    });
    assert.equal(scamContent.statusCode, 400);

    // User A creates bet staking 100 KSh (starter wallet 250 -> 150)
    const createRes = await callHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/p2p/create',
      query: { endpoint: ['p2p', 'create'] },
      headers: { 'x-user-token': tokenA },
      body: {
        creatorUsername: 'AlphaPunter',
        title: 'Gor Mahia vs AFC Leopards',
        category: 'Sports',
        creatorSidePick: 'Gor Mahia Win',
        opponentSidePick: 'AFC Leopards Win',
        creatorStake: 100,
        opponentStake: 80,
      },
    });
    assert.equal(createRes.statusCode, 201);
    assert.equal(createRes.body?.wallet?.walletBalanceKsh, 150);
    const betId = createRes.body?.bet?.id;
    const betCode = createRes.body?.bet?.code;
    assert.ok(betId && betCode);

    // Self-join blocked 400
    const selfJoin = await callHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/p2p/join',
      query: { endpoint: ['p2p', 'join'] },
      headers: { 'x-user-token': tokenA },
      body: { code: betCode },
    });
    assert.equal(selfJoin.statusCode, 400);

    // User C unrelated IDOR cancel blocked 403
    const idorCancel = await callHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/p2p/cancel',
      query: { endpoint: ['p2p', 'cancel'] },
      headers: { 'x-user-token': tokenC },
      body: { id: betId },
    });
    assert.equal(idorCancel.statusCode, 403);

    // User B joins with invite code (250 -> 170)
    const joinRes = await callHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/p2p/join',
      query: { endpoint: ['p2p', 'join'] },
      headers: { 'x-user-token': tokenB },
      body: { code: betCode, opponentUsername: 'BetaPunter' },
    });
    assert.equal(joinRes.statusCode, 200);
    assert.equal(joinRes.body?.bet?.status, 'active');
    assert.equal(joinRes.body?.wallet?.walletBalanceKsh, 170);

    // Non-participant User C blocked 403 from proposing winner
    const idorPropose = await callHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/p2p/propose-winner',
      query: { endpoint: ['p2p', 'propose-winner'] },
      headers: { 'x-user-token': tokenC },
      body: { id: betId, winner: 'creator' },
    });
    assert.equal(idorPropose.statusCode, 403);

    // Spoofed `proposer: 'opponent'` by User A is ignored (server derives creator side from tokenA!)
    const proposeA = await callHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/p2p/propose-winner',
      query: { endpoint: ['p2p', 'propose-winner'] },
      headers: { 'x-user-token': tokenA },
      body: { id: betId, proposer: 'opponent', winner: 'opponent' },
    });
    assert.equal(proposeA.statusCode, 200);
    assert.equal(proposeA.body?.bet?.proposedWinnerByCreator, 'opponent');
    assert.equal(proposeA.body?.bet?.proposedWinnerByOpponent, null);

    // User B confirms opponent wins -> pot 180 credited atomically to User B (170 + 180 = 350)
    const proposeB = await callHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/p2p/propose-winner',
      query: { endpoint: ['p2p', 'propose-winner'] },
      headers: { 'x-user-token': tokenB },
      body: { id: betId, winner: 'opponent' },
    });
    assert.equal(proposeB.statusCode, 200);
    assert.equal(proposeB.body?.bet?.status, 'settled');
    assert.equal(proposeB.body?.bet?.winner, 'opponent');
    assert.equal(proposeB.body?.wallet?.walletBalanceKsh, 350);

    // Verify cancel & refund works for creator on awaiting bet (150 -> create 50 = 100 -> cancel = 150)
    const createCancelBet = await callHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/p2p/create',
      query: { endpoint: ['p2p', 'create'] },
      headers: { 'x-user-token': tokenA },
      body: {
        title: 'Derby Escrow Refund Test',
        category: 'Sports',
        creatorSidePick: 'Team X',
        opponentSidePick: 'Team Y',
        creatorStake: 50,
        opponentStake: 50,
      },
    });
    assert.equal(createCancelBet.statusCode, 201);
    assert.equal(createCancelBet.body?.wallet?.walletBalanceKsh, 100);

    const cancelOk = await callHandler(tokensHandler, {
      method: 'POST',
      url: '/api/tokens/p2p/cancel',
      query: { endpoint: ['p2p', 'cancel'] },
      headers: { 'x-user-token': tokenA },
      body: { id: createCancelBet.body.bet.id },
    });
    assert.equal(cancelOk.statusCode, 200);
    assert.equal(cancelOk.body?.bet?.status, 'cancelled');
    assert.equal(cancelOk.body?.wallet?.walletBalanceKsh, 150);

    // Verify client store.ts does NOT hardcode fabricated default balance: 250 / mshindiTokens: 24
    const storeSrc = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'store.ts'), 'utf-8');
    assert.ok(storeSrc.includes('balance: 0,') && storeSrc.includes('mshindiTokens: 0,'));
    assert.ok(!storeSrc.includes('balance: 250'));
  });

  await check('7.4 MSH-029 Distributed Rate Limiting & Anti-Spoof IP Extraction', async () => {
    // Verify extractTrustedClientIp rejects client-spoofed x-forwarded-for on Express sockets
    const expressDirectIp = extractTrustedClientIp({
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      socket: { remoteAddress: '::ffff:198.51.100.25' },
    });
    assert.equal(expressDirectIp, '198.51.100.25');

    // Verify Vercel edge extracts rightmost proxy hop / x-vercel-forwarded-for (never spoofed [0])
    const prevVercel = process.env.VERCEL;
    process.env.VERCEL = '1';
    try {
      const xffEdgeIp = extractTrustedClientIp({
        headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.88' },
      });
      assert.equal(xffEdgeIp, '203.0.113.88');

      const vercelHeaderIp = extractTrustedClientIp({
        headers: {
          'x-forwarded-for': '9.9.9.9',
          'x-vercel-forwarded-for': '192.0.2.44',
        },
      });
      assert.equal(vercelHeaderIp, '192.0.2.44');
    } finally {
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
    }

    // Verify Vercel serverless rate limiter enforces 429 + headers on POST /api/moderation/reports (12/15m)
    resetRateLimiterForTests();
    let hit429Serverless = false;
    for (let i = 0; i < 15; i++) {
      const r = await callHandler(moderationHandler, {
        method: 'POST',
        url: '/api/moderation/reports',
        query: { endpoint: 'reports' },
        remoteAddress: '198.51.100.77',
        // Rotate spoofed leftmost IP every call — real peer IP must still trip limit!
        headers: { 'x-forwarded-for': `10.10.10.${i}` },
        body: {
          postId: `p-${i}`,
          reportedUser: 'spam',
          reasonCategory: 'Spam',
          description: 'Repeated automated abuse test message',
        },
      });
      if (r.statusCode === 429) {
        hit429Serverless = true;
        assert.ok(r.headers['retry-after'] || r.headers['Retry-After']);
        assert.ok(r.headers['ratelimit-limit'] || r.headers['RateLimit-Limit']);
        break;
      }
    }
    assert.equal(hit429Serverless, true);

    // Live Express dist/server.cjs HTTP test: rotating spoofed x-forwarded-for does not bypass admin verify-pin limiter
    const port = 3000;
    const serverProcess = spawn(process.execPath, [path.join(process.cwd(), 'dist', 'server.cjs')], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        USER_TOKEN_SECRET: process.env.USER_TOKEN_SECRET,
        USER_SESSION_SECRET: process.env.USER_SESSION_SECRET,
        ADMIN_PIN: process.env.ADMIN_PIN,
        ADMIN_TOKEN_SECRET: process.env.ADMIN_TOKEN_SECRET,
      },
      stdio: 'ignore',
    });
    try {
      let ready = false;
      for (let w = 0; w < 30; w++) {
        try {
          const h = await fetch(`http://127.0.0.1:${port}/api/health`);
          if (h.ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }
      assert.equal(ready, true, 'Compiled Express server failed to respond on /api/health');

      let hit429Express = false;
      for (let i = 0; i < 24; i++) {
        const res = await fetch(`http://127.0.0.1:${port}/api/admin/verify-pin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': `172.16.0.${i + 1}`,
          },
          body: JSON.stringify({ phone: '0743304579', pin: '0000' }),
        });
        if (res.status === 429) {
          hit429Express = true;
          assert.ok(res.headers.get('retry-after'));
          break;
        }
      }
      assert.equal(hit429Express, true);
    } finally {
      serverProcess.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 250));
    }
  });

  await check('7.5 Security Audit Logging, Anomaly Alerting & Admin Security Logs API', async () => {
    resetSecurityAuditLogsForTests();
    resetRateLimiterForTests();

    // Generate 6 failed admin PIN attempts to cross sliding-window anomaly threshold (>= 5)
    for (let i = 0; i < 6; i++) {
      const failRes = await callHandler(adminHandler, {
        method: 'POST',
        url: '/api/admin/verify-pin',
        query: { endpoint: 'verify-pin' },
        remoteAddress: '198.51.100.90',
        body: { phone: '0743304579', pin: '0000' },
      });
      assert.equal(failRes.statusCode, 401);
    }

    // Generate a critical PDF security event (invalid/corrupted oversized or non-PDF payload)
    const pdfFail = await callHandler(adminHandler, {
      method: 'POST',
      url: '/api/admin/parse-pdf',
      query: { endpoint: 'parse-pdf' },
      headers: { 'x-admin-token': adminToken },
      body: { base64: Buffer.from('not-a-pdf-bomb-payload').toString('base64') },
    });
    assert.equal(pdfFail.statusCode, 400);

    // Non-admin & unauth blocked 403 from viewing security logs
    const unauthLogs = await callHandler(adminHandler, {
      method: 'GET',
      url: '/api/admin/security-logs',
      query: { endpoint: 'security-logs' },
    });
    assert.equal(unauthLogs.statusCode, 403);

    const userLogs = await callHandler(adminHandler, {
      method: 'GET',
      url: '/api/admin/security-logs',
      query: { endpoint: 'security-logs' },
      headers: { 'x-user-token': tokenA },
    });
    assert.equal(userLogs.statusCode, 403);

    // Admin views security logs -> receives redacted logs + alertCount >= 1
    const adminLogs = await callHandler(adminHandler, {
      method: 'GET',
      url: '/api/admin/security-logs',
      query: { endpoint: 'security-logs', limit: '30' },
      headers: { 'x-admin-token': adminToken },
    });
    assert.equal(adminLogs.statusCode, 200);
    assert.ok(Array.isArray(adminLogs.body?.logs) && adminLogs.body.logs.length >= 7);
    assert.ok(Number(adminLogs.body?.alertCount) >= 1);

    const serialized = JSON.stringify(adminLogs.body.logs);
    assert.ok(!serialized.includes('phase7_test_admin_secret_xyz_123456'));
    assert.ok(!serialized.includes('"pin":"0000"'));

    const queried = await querySecurityEvents({ onlyAlerts: true });
    assert.ok(queried.logs.some((e) => e.alertTriggered));
  });

  await check('7.6 MSH-028, MSH-030 & Phase 7 Firestore Rules Hardening', async () => {
    const firebaseJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase.json'), 'utf-8'));
    assert.equal(firebaseJson?.firestore?.rules, 'firestore.rules');
    assert.equal(firebaseJson?.storage?.rules, 'storage.rules');

    const rulesText = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8');
    assert.ok(rulesText.includes("rules_version = '2';"));
    for (const collection of ['reports', 'p2pBets', 'rateLimits', 'securityAuditLogs']) {
      assert.ok(rulesText.includes(`match /${collection}/`), `Missing Firestore rule block for ${collection}`);
    }
    assert.ok(rulesText.includes('function isOwner(userId)'));
    assert.ok(rulesText.includes('match /moderationDictionary/'));
  });

  console.log(`\n=============================================================`);
  console.log(`PHASE 7 RESULTS: ${passed} passed, ${failed} failed (total ${passed + failed})`);
  console.log(`=============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

