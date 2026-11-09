/**
 * Automated Verification Suite for MshindiRoom Premium Subscription & Paywall System
 * 
 * Tests:
 * 1. 3-day (72-hour) free trial activation, timestamp accuracy, and duplicate claim rejection.
 * 2. Weekly (Ksh 20 / 7 days) and monthly (Ksh 75 / 30 days) M-Pesa payment verification.
 * 3. Idempotency & fraud prevention: duplicate M-Pesa code rejection.
 * 4. Plan extension logic (extending existing active duration rather than resetting).
 * 5. Immutable chronological history recording.
 * 6. Entitlement checker helper (`checkHasPremiumAccess`).
 * 7. Unified HTTP server request handler (`handleSubscriptionHttpRequest`).
 */

import {
  activateThreeDayTrial,
  verifyAndGrantSubscription,
  getUserSubscription,
  getUserSubscriptionHistory,
  restoreUserSubscription,
  handleSubscriptionHttpRequest,
  type UserSubscription,
} from '../src/lib/serverSubscriptionService.js';
import { checkHasPremiumAccess } from '../src/lib/subscriptionStore.js';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runSubscriptionTests() {
  console.log('\n======================================================');
  console.log('🧪 MSHINDIROOM SUBSCRIPTION & PAYWALL VERIFICATION SUITE');
  console.log('======================================================\n');

  const now = Date.now();
  const testUserA = `+254799000${Math.floor(Math.random() * 899 + 100)}`;
  const testUserB = `+254788000${Math.floor(Math.random() * 899 + 100)}`;
  const testCode1 = `TEST${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const testCode2 = `TEST${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // ---------------------------------------------------------------------------------
  // TEST SUITE 1: 3-DAY FREE TRIAL SYSTEM
  // ---------------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: 3-Day (72h) Free Trial System ---');

  const trialRes1 = await activateThreeDayTrial(testUserA, {
    phone: testUserA,
    username: 'TrialTesterA',
  });

  assert(trialRes1.ok === true, 'First 3-day trial claim succeeds');
  assert(trialRes1.subscription?.status === 'trial', 'Subscription status marked as "trial"');
  assert(trialRes1.subscription?.plan === 'trial', 'Subscription plan marked as "trial"');
  assert(trialRes1.subscription?.trialClaimed === true, 'trialClaimed flag set to true');

  if (trialRes1.subscription?.trialExpiresAt && trialRes1.subscription?.trialStartedAt) {
    const startedMs = Date.parse(trialRes1.subscription.trialStartedAt);
    const expiresMs = Date.parse(trialRes1.subscription.trialExpiresAt);
    const durationHours = (expiresMs - startedMs) / (1000 * 60 * 60);
    assert(Math.abs(durationHours - 72) < 0.1, `Trial duration is exactly 72 hours (measured: ${durationHours.toFixed(2)}h)`);
  } else {
    assert(false, 'Trial timestamps missing');
  }

  // Attempt duplicate trial claim
  const trialRes2 = await activateThreeDayTrial(testUserA, {
    phone: testUserA,
    username: 'TrialTesterA',
  });
  assert(trialRes2.ok === false, 'Duplicate 3-day trial claim is rejected');
  assert(trialRes2.error?.includes('already claimed') === true, 'Duplicate trial returns clear error explanation');

  // Verify history has trial entry
  const historyA = await getUserSubscriptionHistory(testUserA);
  assert(historyA.length === 1, 'Chronological history has 1 entry for trial');
  assert(historyA[0].type === 'trial' && historyA[0].amountKsh === 0, 'History entry records free trial with 0 Ksh');

  // ---------------------------------------------------------------------------------
  // TEST SUITE 2: M-PESA PAYMENT VERIFICATION (WEEKLY Ksh 20)
  // ---------------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Weekly M-Pesa Subscription (Ksh 20) ---');

  const weeklyRes = await verifyAndGrantSubscription(testUserB, {
    plan: 'weekly',
    mpesaCode: testCode1,
    amountKsh: 20,
    phone: testUserB,
    username: 'PaidTesterB',
  });

  assert(weeklyRes.ok === true, 'Weekly subscription payment verified');
  assert(weeklyRes.subscription?.status === 'active', 'Subscription status marked as "active"');
  assert(weeklyRes.subscription?.plan === 'weekly', 'Subscription plan marked as "weekly"');
  assert(weeklyRes.subscription?.amountKsh === 20, 'Payment amount recorded as Ksh 20');

  if (weeklyRes.subscription?.expiresAt && weeklyRes.subscription?.activatedAt) {
    const activatedMs = Date.parse(weeklyRes.subscription.activatedAt);
    const expiresMs = Date.parse(weeklyRes.subscription.expiresAt);
    const durationDays = (expiresMs - activatedMs) / (1000 * 60 * 60 * 24);
    assert(Math.abs(durationDays - 7) < 0.1, `Weekly duration is exactly 7 days (measured: ${durationDays.toFixed(2)}d)`);
  } else {
    assert(false, 'Weekly subscription timestamps missing');
  }

  // ---------------------------------------------------------------------------------
  // TEST SUITE 3: FRAUD DETECTION & DUPLICATE CODE REJECTION
  // ---------------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: Duplicate Transaction Code Prevention ---');

  const duplicateCodeRes = await verifyAndGrantSubscription(testUserA, {
    plan: 'weekly',
    mpesaCode: testCode1, // Same code as testUserB!
    amountKsh: 20,
    phone: testUserA,
    username: 'TrialTesterA',
  });

  assert(duplicateCodeRes.ok === false, 'Duplicate M-Pesa code rejection works');
  assert(duplicateCodeRes.error?.includes('already been used') === true, 'Duplicate code returns clear rejection error');

  // ---------------------------------------------------------------------------------
  // TEST SUITE 4: SUBSCRIPTION DURATION EXTENSION (MONTHLY Ksh 75)
  // ---------------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: Plan Stacking & Duration Extension ---');

  const currentExpiryB = weeklyRes.subscription?.expiresAt;
  assert(Boolean(currentExpiryB), 'Prior active expiry exists before extension');

  const monthlyRes = await verifyAndGrantSubscription(testUserB, {
    plan: 'monthly',
    mpesaCode: testCode2,
    amountKsh: 75,
    phone: testUserB,
    username: 'PaidTesterB',
  });

  assert(monthlyRes.ok === true, 'Monthly extension payment verified');
  assert(monthlyRes.subscription?.plan === 'monthly', 'Subscription upgraded to "monthly"');

  if (currentExpiryB && monthlyRes.subscription?.expiresAt) {
    const priorExpiryMs = Date.parse(currentExpiryB);
    const newExpiryMs = Date.parse(monthlyRes.subscription.expiresAt);
    const extensionDays = (newExpiryMs - priorExpiryMs) / (1000 * 60 * 60 * 24);
    assert(
      Math.abs(extensionDays - 30) < 0.2,
      `Duration successfully extended by 30 days from existing expiry (added: ${extensionDays.toFixed(2)}d)`
    );
  }

  // Verify User B history has both transactions
  const historyB = await getUserSubscriptionHistory(testUserB);
  assert(historyB.length === 2, 'User B has 2 chronological transaction history records');
  assert(historyB[0].plan === 'monthly' && historyB[1].plan === 'weekly', 'History preserves newest-first chronological order');

  // ---------------------------------------------------------------------------------
  // TEST SUITE 5: ENTITLEMENT CHECKER (checkHasPremiumAccess)
  // ---------------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: Client Entitlement Logic (checkHasPremiumAccess) ---');

  const activeSub: UserSubscription = {
    userId: 'user_active',
    status: 'active',
    plan: 'weekly',
    trialClaimed: false,
    trialStartedAt: null,
    trialExpiresAt: null,
    activatedAt: new Date(now - 3600000).toISOString(),
    expiresAt: new Date(now + 604800000).toISOString(), // 7 days in future
    nextPaymentDate: null,
    lastPaymentRef: 'REF1',
    amountKsh: 20,
    updatedAt: new Date().toISOString(),
  };

  const trialSub: UserSubscription = {
    userId: 'user_trial',
    status: 'trial',
    plan: 'trial',
    trialClaimed: true,
    trialStartedAt: new Date(now - 3600000).toISOString(),
    trialExpiresAt: new Date(now + 259200000).toISOString(), // 72 hours in future
    activatedAt: null,
    expiresAt: null,
    nextPaymentDate: null,
    lastPaymentRef: null,
    amountKsh: 0,
    updatedAt: new Date().toISOString(),
  };

  const expiredSub: UserSubscription = {
    userId: 'user_expired',
    status: 'expired',
    plan: 'weekly',
    trialClaimed: false,
    trialStartedAt: null,
    trialExpiresAt: null,
    activatedAt: new Date(now - 14 * 86400000).toISOString(),
    expiresAt: new Date(now - 7 * 86400000).toISOString(), // Expired 7 days ago
    nextPaymentDate: null,
    lastPaymentRef: 'REF_OLD',
    amountKsh: 20,
    updatedAt: new Date().toISOString(),
  };

  assert(checkHasPremiumAccess(activeSub) === true, 'Active subscription grants premium access');
  assert(checkHasPremiumAccess(trialSub) === true, 'Active 3-day trial grants premium access');
  assert(checkHasPremiumAccess(expiredSub) === false, 'Expired subscription denies premium access');
  assert(checkHasPremiumAccess(null) === false, 'Null user subscription denies premium access');

  // ---------------------------------------------------------------------------------
  // TEST SUITE 6: RESTORE SUBSCRIPTION
  // ---------------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 6: Restore Subscription Feature ---');

  const restoreB = await restoreUserSubscription(testUserB);
  assert(restoreB.ok === true && restoreB.hasActive === true, 'Restoring User B finds active subscription');

  const restoreUnknown = await restoreUserSubscription('+254700000999');
  assert(restoreUnknown.ok === true && restoreUnknown.hasActive === false, 'Restoring unknown user reports no active subscription');

  // ---------------------------------------------------------------------------------
  // TEST SUITE 7: HTTP REQUEST DISPATCHER (handleSubscriptionHttpRequest)
  // ---------------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 7: HTTP API Endpoints ---');

  // Status endpoint
  const statusHttp = await handleSubscriptionHttpRequest({
    method: 'GET',
    pathname: '/api/subscription/status',
    headers: {},
    query: { userId: testUserB },
    body: {},
  });
  assert(statusHttp.statusCode === 200, 'GET /api/subscription/status returns 200');
  assert(statusHttp.payload.success === true, 'Status response has success: true');
  assert(statusHttp.payload.subscription?.plan === 'monthly', 'Status endpoint returns current monthly plan');

  // Trial endpoint validation (missing userId)
  const invalidTrialHttp = await handleSubscriptionHttpRequest({
    method: 'POST',
    pathname: '/api/subscription/trial',
    headers: {},
    query: {},
    body: {},
  });
  assert(invalidTrialHttp.statusCode === 401 || invalidTrialHttp.statusCode === 400, 'POST /api/subscription/trial without userId returns 401/400');

  // Payment endpoint validation (invalid mpesa code)
  const invalidPaymentHttp = await handleSubscriptionHttpRequest({
    method: 'POST',
    pathname: '/api/subscription/verify-payment',
    headers: {},
    query: {},
    body: {
      userId: testUserA,
      plan: 'weekly',
      mpesaCode: 'short',
    },
  });
  assert(invalidPaymentHttp.statusCode === 400, 'POST /api/subscription/verify-payment with invalid code returns 400');

  // Summary
  console.log('\n======================================================');
  console.log(`🏁 VERIFICATION COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

void runSubscriptionTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
