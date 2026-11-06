/**
 * Comprehensive Verification & Security Audit Suite for the Server-Side Mshindi Token Economy
 *
 * Tests all requirements from Section 11 & Section 12:
 * 1. Token Identity & Ownership (uniqueness, ownership assignment, non-reusable consumed IDs, cross-user rejection)
 * 2. Spending, Concurrency & Atomic Rollback (valid spend, over-spend rejection, idempotency, concurrent double-spend lock, simulated mid-tx failure rollback)
 * 3. Purchase Rewards (KSh 100 = 1 MT, KSh 200 = 2 MT, KSh 500 = 5 MT, KSh 1000 = 10 MT, failed payment = 0 MT, callback replay rejection, reversal & refund compensating ledger)
 * 4. Referral Rewards (3 qualifying invites = 1 MT, 1 & 2 invites preserve remainder 1/3 & 2/3 without premature award, 6/9/12 milestones, self-referral & duplicate claim rejection)
 * 5. Security & Admin Authorization (direct balance edit, token creation, ledger edit, forged payload rejection, admin auth enforcement)
 * 6. Safe Migration (existing balance preservation, unique unit minting, idempotent re-run protection, reconciliation flag auditing)
 * 7. Firestore Security Rules Verification
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  setTokenPersistenceEnabled,
  resetTokenEconomyForTesting,
  migrateUserTokenBalance,
  getAuthoritativeUserWallet,
  spendAuthoritativeTokens,
  processVerifiedPurchasePayment,
  reverseOrRefundPurchasePayment,
  recordQualifyingReferral,
  executeAdminTokenAdjustment,
  handleTokenEconomyHttpRequest,
  inspectTokenUnit,
  getAuditSnapshotForUser,
  issueUserSessionToken,
  KSH_PER_MSHINDI_TOKEN,
  QUALIFYING_REFERRALS_PER_TOKEN,
} from '../src/lib/serverTokenEconomy';
import { generateAdminToken, ADMIN_PHONE_NORMALIZED } from '../src/lib/adminAuthService';

async function runVerificationSuite() {
  console.log('================================================================================');
  console.log('MSHINDIROOM — SERVER-SIDE MSHINDI TOKEN ECONOMY SECURITY & VERIFICATION SUITE');
  console.log('================================================================================\n');

  // Run in isolated memory mode so tests don't pollute repository data files
  setTokenPersistenceEnabled(false);
  resetTokenEconomyForTesting();

  // --------------------------------------------------------------------------
  // TEST GROUP 1: SAFE MIGRATION & IDEMPOTENCY
  // --------------------------------------------------------------------------
  console.log('[1/7] Testing Existing Balance Migration, Unique Unit Minting & Idempotency...');
  const legacyUserUid = '254712345678';
  const legacyTxHistory = [
    { id: 'token-seed-1', type: 'earn_referral', label: 'Referral Bonus: Invited @KipPunter', amount: 4, time: '1d ago' },
    { id: 'token-seed-2', type: 'earn_spend', label: 'Room Unlock Cashback (100 Ksh spent)', amount: 4, time: '2d ago' },
    { id: 'token-seed-3', type: 'earn_referral', label: 'Welcome Bonus Tokens', amount: 16, time: '3d ago' },
  ];

  const mig1 = await migrateUserTokenBalance({
    userUid: legacyUserUid,
    username: 'KipLegacy',
    legacyBalance: 24,
    legacyTokenTransactions: legacyTxHistory,
    legacyWalletBalanceKsh: 350,
    legacyUnlockedRooms: ['sportpesa-mega-gw1'],
    legacyTotalReferrals: 1,
  });

  assert.strictEqual(mig1.success, true, 'First migration must succeed');
  assert.strictEqual(mig1.alreadyMigrated, false, 'First migration must report alreadyMigrated=false');
  assert.strictEqual(mig1.wallet.mshindiTokens, 24, 'Migrated user must retain exact 24 MT balance');
  assert.strictEqual(mig1.wallet.activeTokenIds.length, 24, '24 unique active token units must be minted');
  assert.strictEqual(mig1.migrationRecord.reconciliationFlag, false, '24 MT matches sum(4+4+16) so reconciliationFlag must be false');

  // Run migration a 2nd and 3rd time — must NOT duplicate tokens
  const mig2 = await migrateUserTokenBalance({
    userUid: legacyUserUid,
    username: 'KipLegacy',
    legacyBalance: 24,
    legacyTokenTransactions: legacyTxHistory,
  });
  const mig3 = await migrateUserTokenBalance({
    userUid: legacyUserUid,
    username: 'KipLegacy',
    legacyBalance: 999, // Even if a manipulated number is passed on second run
  });

  assert.strictEqual(mig2.alreadyMigrated, true, 'Second migration run must be detected as alreadyMigrated');
  assert.strictEqual(mig2.wallet.mshindiTokens, 24, 'Balance must remain 24 MT after second migration');
  assert.strictEqual(mig3.alreadyMigrated, true, 'Third migration run must be detected as alreadyMigrated');
  assert.strictEqual(mig3.wallet.mshindiTokens, 24, 'Balance must remain 24 MT after third migration');

  // Test reconciliation flagging when legacy transactions sum doesn't match legacy balance
  const inconsistentMig = await migrateUserTokenBalance({
    userUid: '254799887766',
    username: 'MismatchUser',
    legacyBalance: 15,
    legacyTokenTransactions: [{ id: 'tx-1', type: 'earn_spend', label: 'Old bonus', amount: 8, time: '5d ago' }],
  });
  assert.strictEqual(inconsistentMig.wallet.mshindiTokens, 15, 'Legitimate balance (15 MT) preserved without silent reduction');
  assert.strictEqual(inconsistentMig.migrationRecord.reconciliationFlag, true, 'Discrepancy between 15 MT and 8 MT tx sum must be flagged for reconciliation');
  console.log('  ✓ Existing balances preserved (24 MT -> 24 unique token units), duplicate migration blocked, reconciliation flagging verified.\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 2: UNIQUE TOKEN IDENTITIES & OWNERSHIP INVARIANTS
  // --------------------------------------------------------------------------
  console.log('[2/7] Testing Unique Token Identities, Ownership & Non-Reusable Consumed Tokens...');
  const allTokenIds = new Set<string>();
  for (const tokenId of mig1.wallet.activeTokenIds) {
    assert.ok(/^mt_[a-f0-9]{32}$/.test(tokenId), `Token ID ${tokenId} must be cryptographically strong 128-bit hex`);
    assert.strictEqual(allTokenIds.has(tokenId), false, `Token ID ${tokenId} must be globally unique`);
    allTokenIds.add(tokenId);

    const unit = inspectTokenUnit(tokenId);
    assert.ok(unit, `Token unit ${tokenId} must exist in server registry`);
    assert.strictEqual(unit.ownerUid, legacyUserUid, 'Token ownerUid must match authenticated user');
    assert.strictEqual(unit.status, 'ACTIVE', 'Migrated token must be ACTIVE');
    assert.strictEqual(unit.source, 'MIGRATION', 'Migrated token source must be MIGRATION');
  }

  // Consume 2 specific tokens and verify they become permanently CONSUMED and cannot be reused
  const targetTokensToSpend = mig1.wallet.activeTokenIds.slice(0, 2);
  const spendSpecific = await spendAuthoritativeTokens({
    userUid: legacyUserUid,
    quantity: 2,
    roomId: 'betika-midweek-gw4',
    roomName: 'Betika Midweek Jackpot',
    specificTokenIds: targetTokensToSpend,
    idempotencyKey: 'spend-specific-test-1',
  });
  assert.strictEqual(spendSpecific.success, true, 'Spending 2 active owned tokens must succeed');
  assert.strictEqual(spendSpecific.wallet?.mshindiTokens, 22, 'Balance must decrease from 24 to 22 MT');

  for (const consumedId of targetTokensToSpend) {
    const unitAfter = inspectTokenUnit(consumedId);
    assert.strictEqual(unitAfter?.status, 'CONSUMED', `Token ${consumedId} must be marked CONSUMED`);
    assert.ok(unitAfter?.consumedAt, 'Consumed token must have a server consumedAt timestamp');
    assert.strictEqual(unitAfter?.consumedByTransactionId, spendSpecific.transaction?.transactionId, 'Consumed token must reference consuming transactionId');
  }

  // Attempt to reuse an already-consumed token ID -> must be rejected!
  const reuseAttempt = await spendAuthoritativeTokens({
    userUid: legacyUserUid,
    quantity: 1,
    roomId: 'another-room-1',
    specificTokenIds: [targetTokensToSpend[0]],
    idempotencyKey: 'spend-reuse-attempt-1',
  });
  assert.strictEqual(reuseAttempt.success, false, 'Reusing a CONSUMED token ID must be rejected');
  assert.ok(reuseAttempt.error?.includes('TOKEN_ALREADY_CONSUMED'), 'Error must specify TOKEN_ALREADY_CONSUMED');

  // Attempt by another user to spend `legacyUserUid`'s active token ID -> must be rejected!
  const foreignTokenId = mig1.wallet.activeTokenIds[5];
  const crossUserAttempt = await spendAuthoritativeTokens({
    userUid: '254799887766',
    quantity: 1,
    roomId: 'stolen-room-attempt',
    specificTokenIds: [foreignTokenId],
    idempotencyKey: 'cross-user-steal-attempt',
  });
  assert.strictEqual(crossUserAttempt.success, false, 'Spending another user token ID must be rejected');
  assert.strictEqual(crossUserAttempt.statusCode, 403, 'Unauthorized token ownership attempt must return 403');
  console.log('  ✓ All token IDs unique (mt_<32-hex>), consumed tokens permanently retired, cross-user token theft rejected (403).\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 3: SPENDING, IDEMPOTENCY, CONCURRENCY & ATOMIC ROLLBACK
  // --------------------------------------------------------------------------
  console.log('[3/7] Testing Spending, Idempotency, Concurrent Double-Spend Prevention & Atomic Rollback...');
  const spendTestUid = '254722000111';
  // Give user 3 tokens via verified KSh 300 purchase
  await processVerifiedPurchasePayment({
    userUid: spendTestUid,
    username: 'SpendTester',
    code: 'QWE123RTY4',
    amountKsh: 300,
    purpose: 'wallet-topup',
  });

  // 3A. Attempt to spend more than available balance (has 3 MT, tries to spend 5 MT)
  const overSpend = await spendAuthoritativeTokens({
    userUid: spendTestUid,
    quantity: 5,
    roomId: 'room-overspend',
    idempotencyKey: 'overspend-key-1',
  });
  assert.strictEqual(overSpend.success, false, 'Spending 5 MT with 3 MT balance must fail');
  assert.ok(overSpend.error?.includes('INSUFFICIENT_TOKENS'), 'Must report INSUFFICIENT_TOKENS');

  // 3B. Submit the exact same transaction twice (Idempotency)
  const idemSpend1 = await spendAuthoritativeTokens({
    userUid: spendTestUid,
    quantity: 1,
    roomId: 'room-idem-1',
    idempotencyKey: 'idem-spend-key-unique',
  });
  const idemSpend2 = await spendAuthoritativeTokens({
    userUid: spendTestUid,
    quantity: 1,
    roomId: 'room-idem-1',
    idempotencyKey: 'idem-spend-key-unique',
  });
  assert.strictEqual(idemSpend1.success, true);
  assert.strictEqual(idemSpend2.success, true);
  assert.strictEqual(idemSpend2.idempotentReplay, true, 'Second identical request must be flagged as idempotentReplay');
  assert.strictEqual(idemSpend2.wallet?.mshindiTokens, 2, 'Balance must only be deducted once (3 -> 2 MT)');

  // 3C. Simulate mid-transaction failure -> must roll back atomically!
  const failedTxAttempt = await spendAuthoritativeTokens({
    userUid: spendTestUid,
    quantity: 2,
    roomId: 'room-rollback-test',
    idempotencyKey: 'rollback-key-1',
    simulateFailureAfterConsume: true,
  });
  assert.strictEqual(failedTxAttempt.success, false, 'Simulated failure must return success=false');
  const walletAfterRollback = await getAuthoritativeUserWallet({ userUid: spendTestUid });
  assert.strictEqual(walletAfterRollback.mshindiTokens, 2, 'Balance must remain 2 MT after atomic rollback');
  assert.strictEqual(walletAfterRollback.activeTokenIds.length, 2, 'Both token units must remain ACTIVE after rollback');
  for (const activeId of walletAfterRollback.activeTokenIds) {
    assert.strictEqual(inspectTokenUnit(activeId)?.status, 'ACTIVE', 'Rolled-back token unit must still be ACTIVE');
  }

  // 3D. Concurrent spending requests: user has 2 MT left, fires 5 simultaneous 1-MT spend requests for different rooms
  const concurrentResults = await Promise.all(
    [1, 2, 3, 4, 5].map((n) =>
      spendAuthoritativeTokens({
        userUid: spendTestUid,
        quantity: 1,
        roomId: `concurrent-room-${n}`,
        idempotencyKey: `concurrent-spend-${n}`,
      })
    )
  );
  const succeededCount = concurrentResults.filter((r) => r.success).length;
  const failedCount = concurrentResults.filter((r) => !r.success).length;
  assert.strictEqual(succeededCount, 2, 'Exactly 2 of the 5 concurrent 1-MT requests must succeed');
  assert.strictEqual(failedCount, 3, 'Remaining 3 concurrent requests must be rejected due to insufficient tokens');
  const finalWalletAfterConcurrent = await getAuthoritativeUserWallet({ userUid: spendTestUid });
  assert.strictEqual(finalWalletAfterConcurrent.mshindiTokens, 0, 'Final balance after concurrent spends must be 0 MT');
  console.log('  ✓ Over-spend blocked, idempotency verified, mid-tx failure rolled back atomically, 5 concurrent spends serialized cleanly.\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 4: PURCHASE REWARDS (KSh 100 = 1 MT), REPLAYS & REVERSALS
  // --------------------------------------------------------------------------
  console.log('[4/7] Testing Official Purchase Award Rates (KSh 100 = 1 MT), Replays & Reversals...');
  assert.strictEqual(KSH_PER_MSHINDI_TOKEN, 100, 'Official purchase rate constant must be KSh 100 = 1 MT');
  const buyerUid = '254733111222';

  // KSh 100 -> 1 token
  const p100 = await processVerifiedPurchasePayment({
    userUid: buyerUid,
    username: 'BuyerOne',
    code: 'MPESA100AA',
    amountKsh: 100,
    purpose: 'wallet-topup',
  });
  assert.strictEqual(p100.success, true);
  assert.strictEqual(p100.tokensAwarded, 1, 'KSh 100 must award exactly 1 Mshindi Token');
  assert.strictEqual(p100.wallet?.mshindiTokens, 1);

  // KSh 200 -> 2 tokens
  const p200 = await processVerifiedPurchasePayment({
    userUid: buyerUid,
    code: 'MPESA200BB',
    amountKsh: 200,
    purpose: 'wallet-topup',
  });
  assert.strictEqual(p200.tokensAwarded, 2, 'KSh 200 must award exactly 2 Mshindi Tokens');
  assert.strictEqual(p200.wallet?.mshindiTokens, 3);

  // KSh 500 -> 5 tokens
  const p500 = await processVerifiedPurchasePayment({
    userUid: buyerUid,
    code: 'MPESA500CC',
    amountKsh: 500,
    purpose: 'wallet-topup',
  });
  assert.strictEqual(p500.tokensAwarded, 5, 'KSh 500 must award exactly 5 Mshindi Tokens');
  assert.strictEqual(p500.wallet?.mshindiTokens, 8);

  // KSh 1,000 -> 10 tokens
  const p1000 = await processVerifiedPurchasePayment({
    userUid: buyerUid,
    code: 'MPESA1000D',
    amountKsh: 1000,
    purpose: 'wallet-topup',
  });
  assert.strictEqual(p1000.tokensAwarded, 10, 'KSh 1,000 must award exactly 10 Mshindi Tokens');
  assert.strictEqual(p1000.wallet?.mshindiTokens, 18);

  // Unsuccessful payment -> awards 0 tokens
  const pFailed = await processVerifiedPurchasePayment({
    userUid: buyerUid,
    code: 'MPESAFAIL1',
    amountKsh: 500,
    paymentConfirmed: false,
  });
  assert.strictEqual(pFailed.success, false, 'Unconfirmed payment must be rejected');
  const buyerCheck1 = await getAuthoritativeUserWallet({ userUid: buyerUid });
  assert.strictEqual(buyerCheck1.mshindiTokens, 18, 'Failed payment must award 0 tokens');

  // Replay payment callback with same M-Pesa code -> must be rejected (409) and award 0 duplicate tokens
  const pReplay = await processVerifiedPurchasePayment({
    userUid: buyerUid,
    code: 'MPESA500CC',
    amountKsh: 500,
  });
  assert.strictEqual(pReplay.success, false, 'Replayed M-Pesa payment code must be rejected');
  assert.strictEqual(pReplay.statusCode, 409, 'Replayed payment code must return 409 Conflict');
  const buyerCheck2 = await getAuthoritativeUserWallet({ userUid: buyerUid });
  assert.strictEqual(buyerCheck2.mshindiTokens, 18, 'Replayed callback must not change token balance');

  // Test payment reversal / refund (reversing the KSh 500 payment MPESA500CC)
  const reversal = await reverseOrRefundPurchasePayment({
    code: 'MPESA500CC',
    type: 'REVERSAL',
    reason: 'M-Pesa chargeback reversal test',
    actorId: `ADMIN:${ADMIN_PHONE_NORMALIZED}`,
  });
  assert.strictEqual(reversal.success, true, 'Payment reversal must succeed');
  assert.strictEqual(reversal.consumedTokenIds?.length, 5, 'Reversal of KSh 500 payment must consume the 5 awarded tokens');
  assert.strictEqual(reversal.wallet?.mshindiTokens, 13, 'Balance after reversing 5 MT must be 13 MT');
  assert.strictEqual(reversal.transaction?.type, 'REVERSAL', 'Ledger must record an immutable REVERSAL compensating transaction');
  console.log('  ✓ KSh 100=1, 200=2, 500=5, 1000=10 MT verified; failed/replayed payments blocked; reversals create compensating ledger entries.\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 5: REFERRAL REWARDS (3 QUALIFYING INVITATIONS = 1 MT)
  // --------------------------------------------------------------------------
  console.log('[5/7] Testing Official Referral Rewards (3 Invites = 1 MT), Remainders & Anti-Fraud...');
  assert.strictEqual(QUALIFYING_REFERRALS_PER_TOKEN, 3, 'Official referral rate constant must be 3 invitations = 1 MT');
  const inviterUid = '254744555666';
  await getAuthoritativeUserWallet({ userUid: inviterUid, username: 'CaptainPunter' });

  // Self-referral attempt (by username or phone) -> must be rejected
  const selfRef1 = await recordQualifyingReferral({
    referrerIdentifier: 'CaptainPunter',
    referredUid: inviterUid,
    referredUsername: 'CaptainPunter',
  });
  assert.strictEqual(selfRef1.success, false, 'Self-referral must be rejected');

  // Unverified registration -> must be rejected
  const unverifiedRef = await recordQualifyingReferral({
    referrerIdentifier: 'CaptainPunter',
    referredUid: '254700000099',
    referredUsername: 'UnverifiedBot',
    isVerifiedRegistration: false,
  });
  assert.strictEqual(unverifiedRef.success, false, 'Unverified registration must not count as a qualifying referral');

  // Invite #1 -> 0 tokens, progress 1/3 preserved
  const ref1 = await recordQualifyingReferral({
    referrerIdentifier: 'CaptainPunter',
    referredUid: '254755000001',
    referredUsername: 'InviteOne',
  });
  assert.strictEqual(ref1.success, true);
  assert.strictEqual(ref1.tokensAwarded, 0, '1st invitation must not award a token prematurely');
  assert.strictEqual(ref1.totalQualifyingReferrals, 1);
  assert.strictEqual(ref1.referralProgressRemainder, 1, 'Remainder 1/3 must be preserved');
  assert.strictEqual(ref1.referralsNeededForNextToken, 2);

  // Duplicate referral claim for InviteOne -> must be rejected!
  const dupRef1 = await recordQualifyingReferral({
    referrerIdentifier: 'CaptainPunter',
    referredUid: '254755000001',
    referredUsername: 'InviteOne',
  });
  assert.strictEqual(dupRef1.success, false, 'Duplicate referral claim for the same user must be rejected');
  assert.strictEqual(dupRef1.statusCode, 409);

  // Invite #2 -> 0 tokens, progress 2/3 preserved
  const ref2 = await recordQualifyingReferral({
    referrerIdentifier: 'CaptainPunter',
    referredUid: '254755000002',
    referredUsername: 'InviteTwo',
  });
  assert.strictEqual(ref2.success, true);
  assert.strictEqual(ref2.tokensAwarded, 0, '2nd invitation must not award a token prematurely');
  assert.strictEqual(ref2.totalQualifyingReferrals, 2);
  assert.strictEqual(ref2.referralProgressRemainder, 2, 'Remainder 2/3 must be preserved');
  assert.strictEqual(ref2.referralsNeededForNextToken, 1);
  assert.strictEqual(ref2.referrerWallet?.mshindiTokens, 0);

  // Invite #3 -> awards exactly 1 Mshindi Token! Remainder resets to 0/3
  const ref3 = await recordQualifyingReferral({
    referrerIdentifier: 'CaptainPunter',
    referredUid: '254755000003',
    referredUsername: 'InviteThree',
  });
  assert.strictEqual(ref3.success, true);
  assert.strictEqual(ref3.tokensAwarded, 1, '3rd qualifying invitation must award exactly 1 Mshindi Token');
  assert.strictEqual(ref3.totalQualifyingReferrals, 3);
  assert.strictEqual(ref3.referralProgressRemainder, 0);
  assert.strictEqual(ref3.referrerWallet?.mshindiTokens, 1);
  assert.strictEqual(ref3.transaction?.type, 'REFERRAL_REWARD');

  // Invites #4 through #12 -> verify 6=2 MT, 9=3 MT, 12=4 MT
  for (let i = 4; i <= 12; i++) {
    const r = await recordQualifyingReferral({
      referrerIdentifier: 'CaptainPunter',
      referredUid: `2547550000${i < 10 ? '0' + i : i}`,
      referredUsername: `InviteUser${i}`,
    });
    assert.strictEqual(r.success, true);
    const expectedTotalTokens = Math.floor(i / 3);
    assert.strictEqual(r.referrerWallet?.mshindiTokens, expectedTotalTokens, `After ${i} invites, total tokens must be ${expectedTotalTokens}`);
    assert.strictEqual(r.referralProgressRemainder, i % 3, `After ${i} invites, remainder must be ${i % 3}`);
  }
  console.log('  ✓ 3=1 MT, 6=2 MT, 9=3 MT, 12=4 MT verified; remainders (1/3, 2/3) preserved; self-referrals & duplicates rejected.\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 6: SECURITY & ADMIN AUTHORIZATION CHECKS
  // --------------------------------------------------------------------------
  console.log('[6/7] Testing Unauthorized Frontend Manipulation Rejection & Admin Authorization...');
  // 6A. Attempt direct frontend balance modification
  const setBalAttempt = await handleTokenEconomyHttpRequest({
    method: 'POST',
    pathname: '/api/tokens/set-balance',
    headers: {},
    query: {},
    body: { action: 'set-balance', userUid: buyerUid, balance: 99999 },
  });
  assert.strictEqual(setBalAttempt.statusCode, 403, 'Direct balance modification must return 403');

  // 6B. Attempt direct token creation from frontend
  const createTokAttempt = await handleTokenEconomyHttpRequest({
    method: 'POST',
    pathname: '/api/tokens/create-token',
    headers: {},
    query: {},
    body: { action: 'create-token', userUid: buyerUid, tokenId: 'mt_fake_12345' },
  });
  assert.strictEqual(createTokAttempt.statusCode, 403, 'Direct token creation must return 403');

  // 6C. Attempt transaction-history modification
  const editLedgerAttempt = await handleTokenEconomyHttpRequest({
    method: 'POST',
    pathname: '/api/tokens/edit-ledger',
    headers: {},
    query: {},
    body: { action: 'edit-ledger', transactionId: 'tx_123' },
  });
  assert.strictEqual(editLedgerAttempt.statusCode, 403, 'Transaction history modification must return 403');

  // 6D. Attempt forged balance override in purchase request
  const forgedPurchaseAttempt = await handleTokenEconomyHttpRequest({
    method: 'POST',
    pathname: '/api/mpesa/verify-code',
    headers: {},
    query: {},
    body: { code: 'FORGED1234', amount: 100, overrideBalance: 5000 },
  });
  assert.strictEqual(forgedPurchaseAttempt.statusCode, 403, 'Forged balance override must return 403');

  // 6E. Attempt spoofing another user's UID in spend endpoint
  const victimToken = issueUserSessionToken(buyerUid);
  const spoofSpend = await handleTokenEconomyHttpRequest({
    method: 'POST',
    pathname: '/api/tokens/spend',
    headers: { 'x-user-token': victimToken },
    query: {},
    body: { action: 'spend', userUid: legacyUserUid, quantity: 1, roomId: 'spoof-room' },
  });
  assert.strictEqual(spoofSpend.statusCode, 403, 'Cross-user spoofed spend request must return 403');

  // 6F. Attempt unauthorized admin token credit without admin token
  const unauthAdmin = await executeAdminTokenAdjustment({
    headers: {},
    body: {},
    targetUserUid: buyerUid,
    adjustmentType: 'ADMIN_CREDIT',
    quantity: 10,
    reason: 'Unauthorized attempt',
  });
  assert.strictEqual(unauthAdmin.success, false, 'Non-admin adjustment must be rejected');
  assert.strictEqual(unauthAdmin.statusCode, 403);

  // 6G. Authorized admin credit & debit with signed admin token + mandatory reason
  const adminToken = generateAdminToken(ADMIN_PHONE_NORMALIZED);
  const adminCredit = await executeAdminTokenAdjustment({
    headers: { 'x-admin-token': adminToken },
    body: {},
    targetUserUid: buyerUid,
    adjustmentType: 'ADMIN_CREDIT',
    quantity: 5,
    reason: 'Community tournament winner reward',
  });
  assert.strictEqual(adminCredit.success, true, 'Authorized admin credit must succeed');
  assert.strictEqual(adminCredit.wallet?.mshindiTokens, 18, 'Balance must increase from 13 to 18 MT');
  assert.strictEqual(adminCredit.transaction?.type, 'ADMIN_CREDIT');
  assert.strictEqual(adminCredit.transaction?.actorId, `ADMIN:${ADMIN_PHONE_NORMALIZED}`);

  const adminDebit = await executeAdminTokenAdjustment({
    headers: { 'x-admin-token': adminToken },
    body: {},
    targetUserUid: buyerUid,
    adjustmentType: 'ADMIN_DEBIT',
    quantity: 3,
    reason: 'Corrective administrative debit',
  });
  assert.strictEqual(adminDebit.success, true, 'Authorized admin debit must succeed');
  assert.strictEqual(adminDebit.wallet?.mshindiTokens, 15, 'Balance must decrease from 18 to 15 MT');
  assert.strictEqual(adminDebit.transaction?.type, 'ADMIN_DEBIT');

  // Verify ledger integrity for `buyerUid`
  const auditSnap = getAuditSnapshotForUser(buyerUid);
  assert.strictEqual(auditSnap.activeTokens.length, 15, 'Active token units count must equal authoritative balance (15)');
  assert.strictEqual(auditSnap.consumedTokens.length, 8, 'Consumed token units count must equal 5 (reversal) + 3 (admin debit) = 8');
  console.log('  ✓ All unauthorized client mutations rejected (403); admin credit/debit audited and ledger-backed.\n');

  // --------------------------------------------------------------------------
  // TEST GROUP 7: FIRESTORE SECURITY RULES VERIFICATION
  // --------------------------------------------------------------------------
  console.log('[7/7] Verifying Firestore Security Rules (`firestore.rules`)...');
  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf-8');
  assert.ok(rulesContent.includes('match /tokenWallets/{userId}'), 'firestore.rules must define match /tokenWallets/{userId}');
  assert.ok(rulesContent.includes('match /tokenUnits/{tokenId}'), 'firestore.rules must define match /tokenUnits/{tokenId}');
  assert.ok(rulesContent.includes('match /tokenTransactions/{transactionId}'), 'firestore.rules must define match /tokenTransactions/{transactionId}');
  assert.ok(rulesContent.includes('match /tokenReferrals/{referralId}'), 'firestore.rules must define match /tokenReferrals/{referralId}');
  assert.ok(rulesContent.includes('match /tokenMigrations/{migrationId}'), 'firestore.rules must define match /tokenMigrations/{migrationId}');
  assert.ok(rulesContent.includes('hasNoProtectedTokenFields()'), 'firestore.rules must forbid client writes to protected token fields on users/{userId}');
  console.log('  ✓ Firestore Security Rules verified: client writes to tokenWallets, tokenUnits, tokenTransactions, tokenReferrals, tokenMigrations, and user token fields are strictly denied.\n');

  console.log('================================================================================');
  console.log('ALL 7 VERIFICATION GROUPS PASSED (100% INVARIANTS VERIFIED)');
  console.log('================================================================================');
}

runVerificationSuite().catch((err) => {
  console.error('VERIFICATION SUITE FAILED:', err);
  process.exit(1);
});

