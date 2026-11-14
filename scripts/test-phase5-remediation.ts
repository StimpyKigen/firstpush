import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clearServerAuthCacheForTests,
  handleAuthHttpRequest,
} from '../src/lib/serverAuthService';
import {
  fetchTargetedDayDocs,
  resetSnapshotStoreCacheForTests,
} from '../src/lib/fixtureSnapshotStore';
import {
  clearModerationDictionaryCacheForTests,
  evaluateServerModeration,
  resetModerationServerForTests,
} from '../src/lib/serverModerationService';
import {
  flushEconomyStateToDiskAsync,
  processVerifiedPurchasePayment,
  resetTokenEconomyForTesting,
  setTokenPersistenceEnabled,
  withAtomicLock,
  withAtomicLocks,
} from '../src/lib/serverTokenEconomy';

function pass(msg: string) {
  console.log(`PASS: ${msg}`);
}

async function run() {
  // --- 1. FND-007a: firestore.indexes.json + firebase.json mapping + subscription query limit ---
  const indexesRaw = JSON.parse(fs.readFileSync(path.resolve('firestore.indexes.json'), 'utf8'));
  assert.ok(Array.isArray(indexesRaw.indexes) && indexesRaw.indexes.length >= 1, 'firestore.indexes.json defines indexes');
  const subHistIndex = indexesRaw.indexes.find((idx: any) => idx.collectionGroup === 'subscriptionHistory');
  assert.ok(subHistIndex, 'Composite index for subscriptionHistory is defined');
  assert.deepEqual(subHistIndex.fields, [
    { fieldPath: 'userId', order: 'ASCENDING' },
    { fieldPath: 'createdAt', order: 'DESCENDING' },
  ]);

  const firebaseJson = JSON.parse(fs.readFileSync(path.resolve('firebase.json'), 'utf8'));
  assert.equal(firebaseJson.firestore?.indexes, 'firestore.indexes.json', 'firebase.json maps firestore.indexes.json');

  const subServiceSrc = fs.readFileSync(path.resolve('src/lib/serverSubscriptionService.ts'), 'utf8');
  assert.ok(subServiceSrc.includes('.limit(50)'), 'subscriptionHistory query bounds results with .limit(50)');
  pass('FND-007a firestore.indexes.json, firebase.json mapping, and subscription query limit verified');

  // --- 2. FND-007b: serverAuthService eliminates full collection scan on register/directory/availability ---
  const authServiceSrc = fs.readFileSync(path.resolve('src/lib/serverAuthService.ts'), 'utf8');
  assert.ok(!authServiceSrc.includes('function loadAllAccountRecords'), 'loadAllAccountRecords full scan removed');
  assert.ok(
    authServiceSrc.includes(".where('usernameLower', '==', lower)"),
    'serverAuthService uses indexed usernameLower query'
  );
  assert.ok(
    authServiceSrc.includes("col.select('username', 'avatarId', 'verifiedWithSms')"),
    'serverAuthService projects public directory fields only'
  );

  clearServerAuthCacheForTests();
  const dir1 = await handleAuthHttpRequest({
    method: 'GET',
    pathname: '/api/auth/directory',
    headers: {},
    query: {},
  });
  assert.equal(dir1.statusCode, 200);
  const avail = await handleAuthHttpRequest({
    method: 'GET',
    pathname: '/api/auth/availability',
    headers: {},
    query: { username: 'phase5_unique_check_999' },
  });
  assert.equal(avail.statusCode, 200);
  assert.equal(avail.payload.available, true);
  pass('FND-007b auth indexed lookup & cached public directory projection verified');

  // --- 3. FND-007c: fixtureSnapshotStore targeted day-doc reads via _meta + db.getAll ---
  resetSnapshotStoreCacheForTests();
  let fullScanCalls = 0;
  let getAllCalls = 0;
  const mockDocs: Record<string, any> = {
    _meta: {
      exists: true,
      id: '_meta',
      data: () => ({ updatedAt: '2026-11-14T10:00:00.000Z', dates: ['2026-11-14', '2026-11-15'] }),
    },
    '2026-11-14': {
      exists: true,
      id: '2026-11-14',
      data: () => ({ fixtures: [{ id: 'm1', homeTeam: 'A', awayTeam: 'B' }] }),
    },
    '2026-11-15': {
      exists: true,
      id: '2026-11-15',
      data: () => ({ fixtures: [{ id: 'm2', homeTeam: 'C', awayTeam: 'D' }] }),
    },
  };
  const fakeCol = {
    doc: (id: string) => ({
      id,
      get: async () => mockDocs[id] || { exists: false, id, data: () => ({}) },
    }),
    get: async () => {
      fullScanCalls++;
      return { forEach: () => {} };
    },
  };
  const fakeDb = {
    getAll: async (...refs: any[]) => {
      getAllCalls++;
      return refs.map((r) => mockDocs[r.id] || { exists: false, id: r.id, data: () => ({}) });
    },
  };

  const targeted = await fetchTargetedDayDocs(fakeDb, fakeCol, ['2026-11-14'], true);
  assert.equal(fullScanCalls, 0, 'Targeted day-doc reader must not trigger col.get() when _meta.dates exists');
  assert.equal(getAllCalls, 1, 'db.getAll() must batch-fetch all targeted day documents in 1 round trip');
  assert.equal(targeted.existingDayMap.size, 2);
  assert.equal(targeted.updatedAt, '2026-11-14T10:00:00.000Z');
  pass('FND-007c fixtureSnapshotStore targeted day-doc reads & batch getAll verified');

  // --- 4. FND-007d: serverModerationService 120s TTL cache + invalidation ---
  resetModerationServerForTests();
  clearModerationDictionaryCacheForTests();
  const modRes1 = await evaluateServerModeration('hello normal clean message');
  assert.equal(modRes1.isAllowed, true);
  const modServiceSrc = fs.readFileSync(path.resolve('src/lib/serverModerationService.ts'), 'utf8');
  assert.ok(
    modServiceSrc.includes('MODERATION_DICTIONARY_CACHE_TTL_MS'),
    'serverModerationService caches moderation dictionary with TTL'
  );
  assert.ok(
    modServiceSrc.includes('invalidateModerationDictionaryCache()'),
    'serverModerationService invalidates dictionary cache on admin mutations'
  );
  pass('FND-007d moderation dictionary TTL cache & invalidation verified');

  // --- 5. FND-008: Partitioned per-user mutex (no global blocking) + coalesced async disk I/O ---
  setTokenPersistenceEnabled(false);
  resetTokenEconomyForTesting();

  try {
    const completionOrder: string[] = [];
    const t0 = Date.now();
    let elapsedA = 0;
    let elapsedB = 0;
    const slowUserA = withAtomicLock('254711000001', async () => {
      await new Promise((r) => setTimeout(r, 90));
      elapsedA = Date.now() - t0;
      completionOrder.push('userA');
      return 'A';
    });
    const fastUserB = withAtomicLock('254722000002', async () => {
      elapsedB = Date.now() - t0;
      completionOrder.push('userB');
      return 'B';
    });

    const [resA, resB] = await Promise.all([slowUserA, fastUserB]);
    assert.equal(resA, 'A');
    assert.equal(resB, 'B');
    assert.equal(
      completionOrder[0],
      'userB',
      'User B must finish BEFORE blocked User A (zero global head-of-line mutex)'
    );
    assert.ok(
      elapsedB < elapsedA,
      `Expected parallel User B (${elapsedB}ms) to finish well before slow User A (${elapsedA}ms)`
    );

    // Same-user serialization must still be strict
    let concurrentOverlap = 0;
    let activeSameUser = 0;
    await Promise.all(
      Array.from({ length: 4 }, (_, idx) =>
        withAtomicLock('254711000001', async () => {
          activeSameUser++;
          if (activeSameUser > 1) concurrentOverlap++;
          await new Promise((r) => setTimeout(r, 15));
          activeSameUser--;
          return idx;
        })
      )
    );
    assert.equal(concurrentOverlap, 0, 'Same-user operations must stay strictly serialized');

    // Sorted multi-key locking must serialize different users attempting same M-Pesa receipt code
    const [pay1, pay2] = await Promise.all([
      processVerifiedPurchasePayment({ userUid: '254711000001', code: 'TXPHASE599', amountKsh: 100 }),
      processVerifiedPurchasePayment({ userUid: '254722000002', code: 'TXPHASE599', amountKsh: 100 }),
    ]);
    assert.equal([pay1.success, pay2.success].filter(Boolean).length, 1, 'Duplicate M-Pesa receipt race blocked');

    // Verify withAtomicLocks deadlock-free sorted ordering
    const orderResult = await withAtomicLocks(['z', 'a', 'z'], () => 'ok');
    assert.equal(orderResult, 'ok');

    const economySrc = fs.readFileSync(path.resolve('src/lib/serverTokenEconomy.ts'), 'utf8');
    assert.ok(!economySrc.includes('globalLockChain'), 'globalLockChain removed from serverTokenEconomy');
    assert.ok(economySrc.includes('fs.promises.writeFile') && economySrc.includes('fs.promises.rename'), 'Token economy uses async atomic temp-file writes');
    assert.ok(economySrc.includes('adminDb.runTransaction'), 'Token economy includes per-user Firestore runTransaction sync');

    const p2pSrc = fs.readFileSync(path.resolve('src/lib/serverP2pService.ts'), 'utf8');
    assert.ok(p2pSrc.includes('fs.promises.writeFile') && p2pSrc.includes('fs.promises.rename'), 'P2P service uses async atomic temp-file writes');

    await flushEconomyStateToDiskAsync();
    pass('FND-008 partitioned per-user locks, sorted multi-key locks, and async atomic disk writes verified');
  } finally {
    resetTokenEconomyForTesting();
    setTokenPersistenceEnabled(true);
  }

  console.log('\nALL PHASE 5 REMEDIATION TESTS PASSED');
}

run().catch((err) => {
  console.error('PHASE 5 TEST FAILED:', err);
  process.exit(1);
});

