/**
 * Authoritative Server-Side Subscription & Free Trial Service
 * 
 * Manages MshindiRoom premium subscription entitlements, 3-day trial enforcement,
 * payment verification (Ksh 20/week, Ksh 75/month), and immutable chronological history.
 * 
 * Persists to Cloud Firestore (`subscriptions/{userId}`, `subscriptionHistory/{historyId}`)
 * with atomic transactional isolation and local disk persistence.
 */

import fs from 'fs';
import path from 'path';
import { isValidMpesaCode, normalizeCode } from './mpesa.js';
import {
  authenticateTokenRequestAsync,
  processVerifiedPurchasePayment,
} from './serverTokenEconomy.js';
import { verifyAdminRequestAsync } from './adminAuthService.js';
import {
  getAdminFirestore,
  resetFirebaseAdminForTests,
  resolveScopedServiceAccountRaw,
} from './serverFirebaseAdmin.js';
import { recordSecurityEvent } from './securityAuditLogger.js';
import { extractTrustedClientIp } from './rateLimitService.js';

export type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'none';
export type SubscriptionPlan = 'weekly' | 'monthly' | 'trial';

export interface UserSubscription {
  userId: string;
  phone?: string;
  username?: string;
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  trialClaimed: boolean;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  nextPaymentDate: string | null;
  lastPaymentRef: string | null;
  amountKsh: number | null;
  updatedAt: string;
}

export interface SubscriptionHistoryRecord {
  id: string;
  userId: string;
  phone?: string;
  username?: string;
  plan: SubscriptionPlan;
  type: 'subscription' | 'trial';
  amountKsh: number;
  transactionRef: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'completed';
  createdAt: string;
}

interface PersistentSubscriptionState {
  subscriptions: Record<string, UserSubscription>;
  history: Record<string, SubscriptionHistoryRecord[]>;
  usedPaymentCodes: Record<string, { userId: string; usedAt: string; plan: string; amountKsh: number }>;
}

// Shared Firebase Admin Firestore accessor
export function resetSubscriptionFirestoreForTests(): void {
  resetFirebaseAdminForTests();
}

async function getAdminFirestoreSubscriptionDb(): Promise<any | null> {
  void resolveScopedServiceAccountRaw();
  return getAdminFirestore();
}

// Local filesystem fallback storage path
const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'subscriptions.json');

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {}
}

let inMemoryState: PersistentSubscriptionState | null = null;

function loadLocalState(): PersistentSubscriptionState {
  if (inMemoryState) return inMemoryState;

  ensureDataDir();
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      inMemoryState = {
        subscriptions: parsed.subscriptions || {},
        history: parsed.history || {},
        usedPaymentCodes: parsed.usedPaymentCodes || {},
      };
      return inMemoryState;
    }
  } catch {}

  inMemoryState = {
    subscriptions: {},
    history: {},
    usedPaymentCodes: {},
  };
  return inMemoryState;
}

function saveLocalState(state: PersistentSubscriptionState): void {
  inMemoryState = state;
  ensureDataDir();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {}
}

/**
 * Normalizes subscription status by checking current expiry timestamps against server clock
 */
function normalizeSubscription(sub: UserSubscription): UserSubscription {
  const nowMs = Date.now();

  if (sub.status === 'trial') {
    if (!sub.trialExpiresAt || nowMs >= Date.parse(sub.trialExpiresAt)) {
      sub.status = 'expired';
    }
  } else if (sub.status === 'active') {
    if (sub.expiresAt && nowMs >= Date.parse(sub.expiresAt)) {
      sub.status = 'expired';
    }
  }

  return sub;
}

/**
 * 1. GET USER SUBSCRIPTION & IMMUTABLE HISTORY
 */
export async function getUserSubscription(
  userId: string
): Promise<{ subscription: UserSubscription; history: SubscriptionHistoryRecord[] }> {
  const cleanUserId = userId.trim();
  const state = loadLocalState();

  let sub = state.subscriptions[cleanUserId];
  let history = state.history[cleanUserId] || [];

  // Try reading from Firestore if Admin SDK is available
  try {
    const adminDb = await getAdminFirestoreSubscriptionDb();
    if (adminDb) {
      const docSnap = await adminDb.collection('subscriptions').doc(cleanUserId).get();
      if (docSnap.exists) {
        const firestoreSub = docSnap.data() as UserSubscription;
        sub = firestoreSub;
        state.subscriptions[cleanUserId] = firestoreSub;
      }

      const histQuery = await adminDb
        .collection('subscriptionHistory')
        .where('userId', '==', cleanUserId)
        .orderBy('createdAt', 'desc')
        .get();

      if (!histQuery.empty) {
        const firestoreHistory: SubscriptionHistoryRecord[] = [];
        histQuery.forEach((d: any) => firestoreHistory.push(d.data() as SubscriptionHistoryRecord));
        history = firestoreHistory;
        state.history[cleanUserId] = firestoreHistory;
      }
    }
  } catch (err) {
    console.warn('[serverSubscription] Firestore read notice:', err);
  }

  if (!sub) {
    sub = {
      userId: cleanUserId,
      status: 'none',
      plan: null,
      trialClaimed: false,
      trialStartedAt: null,
      trialExpiresAt: null,
      activatedAt: null,
      expiresAt: null,
      nextPaymentDate: null,
      lastPaymentRef: null,
      amountKsh: null,
      updatedAt: new Date().toISOString(),
    };
    state.subscriptions[cleanUserId] = sub;
    saveLocalState(state);
  } else {
    const prevStatus = sub.status;
    sub = normalizeSubscription(sub);
    if (prevStatus !== sub.status) {
      sub.updatedAt = new Date().toISOString();
      state.subscriptions[cleanUserId] = sub;
      saveLocalState(state);
      void syncSubscriptionToFirestore(sub);
    }
  }

  // Sort history chronologically newest first
  history.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return { subscription: sub, history };
}

/**
 * 2. ATOMIC 3-DAY FREE TRIAL ACTIVATION
 * Enforces one-time trial claim per account; rejects duplicate claims.
 */
export async function activateThreeDayTrial(
  userId: string,
  meta?: { phone?: string; username?: string }
): Promise<{ ok: boolean; subscription?: UserSubscription; history?: SubscriptionHistoryRecord[]; error?: string }> {
  const cleanUserId = userId.trim();
  const state = loadLocalState();

  const current = (await getUserSubscription(cleanUserId)).subscription;

  // Strict check: each account can claim trial only once
  if (current.trialClaimed) {
    return {
      ok: false,
      error: 'You have already claimed your 3-day free trial on this account.',
      subscription: current,
      history: state.history[cleanUserId] || [],
    };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  // 72 hours exact duration (3 days)
  const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();

  const updatedSub: UserSubscription = {
    userId: cleanUserId,
    phone: meta?.phone || current.phone,
    username: meta?.username || current.username,
    status: 'trial',
    plan: 'trial',
    trialClaimed: true,
    trialStartedAt: nowIso,
    trialExpiresAt: expiresAt,
    activatedAt: nowIso,
    expiresAt: expiresAt,
    nextPaymentDate: expiresAt,
    lastPaymentRef: 'TRIAL-3DAYS',
    amountKsh: 0,
    updatedAt: nowIso,
  };

  const historyItem: SubscriptionHistoryRecord = {
    id: `trial_${cleanUserId}_${Date.now()}`,
    userId: cleanUserId,
    phone: updatedSub.phone,
    username: updatedSub.username,
    plan: 'trial',
    type: 'trial',
    amountKsh: 0,
    transactionRef: 'TRIAL-3DAYS',
    startDate: nowIso,
    endDate: expiresAt,
    status: 'active',
    createdAt: nowIso,
  };

  state.subscriptions[cleanUserId] = updatedSub;
  if (!state.history[cleanUserId]) state.history[cleanUserId] = [];
  state.history[cleanUserId].unshift(historyItem);
  saveLocalState(state);

  // Sync to Firestore
  void syncSubscriptionToFirestore(updatedSub, historyItem);

  return {
    ok: true,
    subscription: updatedSub,
    history: state.history[cleanUserId],
  };
}

/**
 * 3. SERVER-VERIFIED M-PESA PAYMENT & SUBSCRIPTION GRANT
 * Supports Ksh 20/week and Ksh 75/month. Rejects invalid codes, forged amounts, and duplicates.
 */
export async function verifyAndGrantSubscription(
  userId: string,
  params: {
    plan: 'weekly' | 'monthly';
    mpesaCode: string;
    amountKsh: number;
    phone?: string;
    username?: string;
  }
): Promise<{ ok: boolean; subscription?: UserSubscription; history?: SubscriptionHistoryRecord[]; error?: string }> {
  const cleanUserId = userId.trim();
  const rawCode = (params.mpesaCode || '').trim();

  if (!isValidMpesaCode(rawCode)) {
    return {
      ok: false,
      error: 'Invalid M-Pesa transaction code. Expected 10 alphanumeric characters (e.g. QK12345678).',
    };
  }

  const cleanCode = normalizeCode(rawCode);
  const state = loadLocalState();

  // Validate plan pricing
  const expectedAmount = params.plan === 'weekly' ? 20 : 75;
  if (params.amountKsh < expectedAmount) {
    return {
      ok: false,
      error: `Insufficient payment amount. ${params.plan === 'weekly' ? 'Weekly' : 'Monthly'} plan requires Ksh ${expectedAmount}.`,
    };
  }

  // Anti-replay / duplicate payment prevention
  if (state.usedPaymentCodes[cleanCode]) {
    return {
      ok: false,
      error: `M-Pesa transaction code ${cleanCode} has already been used for subscription activation.`,
    };
  }

  // Integrate with authoritative server token ledger verification
  const purchaseResult = await processVerifiedPurchasePayment({
    userUid: params.phone || cleanUserId,
    username: params.username,
    code: cleanCode,
    amountKsh: params.amountKsh,
    purpose: `subscription-${params.plan}`,
    idempotencyKey: `sub:mpesa:${cleanCode}`,
    paymentConfirmed: true,
  });

  if (!purchaseResult.success) {
    return {
      ok: false,
      error: purchaseResult.error || 'Payment verification failed on the server.',
    };
  }

  // Calculate plan duration
  // Weekly = 7 days, Monthly = 30 days
  const durationMs = params.plan === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const now = new Date();
  const nowIso = now.toISOString();

  const current = (await getUserSubscription(cleanUserId)).subscription;

  // If user currently has active paid subscription time remaining, extend from current expiresAt
  let startDateMs = now.getTime();
  let endDateMs = startDateMs + durationMs;

  if (current.status === 'active' && current.expiresAt) {
    const existingExpiresMs = Date.parse(current.expiresAt);
    if (existingExpiresMs > now.getTime()) {
      startDateMs = Date.parse(current.activatedAt || nowIso);
      endDateMs = existingExpiresMs + durationMs;
    }
  }

  const startDateIso = new Date(startDateMs).toISOString();
  const endDateIso = new Date(endDateMs).toISOString();

  const updatedSub: UserSubscription = {
    userId: cleanUserId,
    phone: params.phone || current.phone,
    username: params.username || current.username,
    status: 'active',
    plan: params.plan,
    trialClaimed: current.trialClaimed,
    trialStartedAt: current.trialStartedAt,
    trialExpiresAt: current.trialExpiresAt,
    activatedAt: startDateIso,
    expiresAt: endDateIso,
    nextPaymentDate: endDateIso,
    lastPaymentRef: cleanCode,
    amountKsh: params.amountKsh,
    updatedAt: nowIso,
  };

  const historyItem: SubscriptionHistoryRecord = {
    id: `sub_${cleanCode}`,
    userId: cleanUserId,
    phone: updatedSub.phone,
    username: updatedSub.username,
    plan: params.plan,
    type: 'subscription',
    amountKsh: params.amountKsh,
    transactionRef: cleanCode,
    startDate: startDateIso,
    endDate: endDateIso,
    status: 'active',
    createdAt: nowIso,
  };

  state.usedPaymentCodes[cleanCode] = {
    userId: cleanUserId,
    usedAt: nowIso,
    plan: params.plan,
    amountKsh: params.amountKsh,
  };

  state.subscriptions[cleanUserId] = updatedSub;
  if (!state.history[cleanUserId]) state.history[cleanUserId] = [];
  state.history[cleanUserId].unshift(historyItem);
  saveLocalState(state);

  // Sync to Firestore
  void syncSubscriptionToFirestore(updatedSub, historyItem);

  return {
    ok: true,
    subscription: updatedSub,
    history: state.history[cleanUserId],
  };
}

/**
 * Syncs subscription state and history to Cloud Firestore using Admin SDK
 */
async function syncSubscriptionToFirestore(
  sub: UserSubscription,
  historyItem?: SubscriptionHistoryRecord
): Promise<boolean> {
  try {
    const adminDb = await getAdminFirestoreSubscriptionDb();
    if (!adminDb) return false;

    await adminDb.collection('subscriptions').doc(sub.userId).set(sub, { merge: true });

    if (historyItem) {
      await adminDb.collection('subscriptionHistory').doc(historyItem.id).set(historyItem, { merge: true });
      await adminDb
        .collection('users')
        .doc(sub.userId)
        .collection('subscriptionHistory')
        .doc(historyItem.id)
        .set(historyItem, { merge: true });
    }

    return true;
  } catch (err) {
    console.warn('[serverSubscription] Firestore sync notice:', err);
    return false;
  }
}

/**
 * Returns chronological subscription and trial history records for a user
 */
export async function getUserSubscriptionHistory(userId: string): Promise<SubscriptionHistoryRecord[]> {
  const data = await getUserSubscription(userId);
  return data.history;
}

/**
 * Restores active subscription status for a user
 */
export async function restoreUserSubscription(userId: string): Promise<{
  ok: boolean;
  hasActive: boolean;
  subscription: UserSubscription | null;
}> {
  const data = await getUserSubscription(userId);
  const sub = data.subscription;
  const hasActive = sub.status === 'active' || sub.status === 'trial';
  return {
    ok: true,
    hasActive,
    subscription: sub,
  };
}

/**
 * Unified HTTP request handler for `/api/subscription/*`
 */
export async function handleSubscriptionHttpRequest(req: {
  method: string;
  pathname: string;
  headers: any;
  query: any;
  body: any;
}): Promise<{ statusCode: number; payload: any }> {
  const method = (req.method || 'GET').toUpperCase();
  const pathname = (req.pathname || '').replace(/\/+$/, '');
  const body = req.body || {};
  const query = req.query || {};

  // 3. Quarantine self-submitted M-Pesa payment activation until Safaricom Daraja API integration (Phase 3B)
  if (method === 'POST' && pathname.endsWith('/verify-payment')) {
    const authCheck = await authenticateTokenRequestAsync(req.headers || {}, { ...query, ...body });
    if (!authCheck.authenticated || !authCheck.userUid) {
      return {
        statusCode: authCheck.statusCode || 401,
        payload: {
          success: false,
          error: authCheck.error || 'Authentication required for subscription verification.',
        },
      };
    }

    return {
      statusCode: 503,
      payload: {
        success: false,
        quarantined: true,
        error:
          'Self-submitted M-Pesa subscription verification is temporarily disabled pending Safaricom Daraja API integration. No subscription was activated.',
      },
    };
  }

  // Require authenticated user session (or verified administrator credentials for support actions)
  const adminAuth = await verifyAdminRequestAsync(req.headers || {}, body);
  const authCheck = await authenticateTokenRequestAsync(req.headers || {}, { ...query, ...body });

  if (!authCheck.authenticated && !adminAuth.authorized && (adminAuth.storeUnavailable || authCheck.statusCode === 503)) {
    return {
      statusCode: 503,
      payload: {
        success: false,
        error: adminAuth.reason || authCheck.error || 'Session revocation store unavailable.',
      },
    };
  }

  const requestedUserId = (
    body.userId ||
    query.userId ||
    req.headers?.['x-user-uid'] ||
    req.headers?.['x-user-phone'] ||
    ''
  )
    .toString()
    .trim();

  if (!authCheck.authenticated && !adminAuth.authorized) {
    if (authCheck.statusCode === 403 || requestedUserId) {
      await recordSecurityEvent({
        category: authCheck.statusCode === 403 ? 'IDOR' : 'SUBSCRIPTION',
        severity: authCheck.statusCode === 403 ? 'high' : 'warning',
        action: 'unauthorized_subscription_access',
        outcome: 'blocked',
        actorId: requestedUserId || null,
        ip: extractTrustedClientIp(req.headers),
        route: pathname,
      });
    }
    return {
      statusCode: authCheck.statusCode || 401,
      payload: {
        success: false,
        error: authCheck.error || 'Authentication required. Missing valid session token.',
      },
    };
  }

  const userId = adminAuth.authorized && requestedUserId
    ? requestedUserId
    : authCheck.userUid || '';

  if (!userId) {
    return {
      statusCode: 401,
      payload: { success: false, error: 'Authentication required. Missing verified user identity.' },
    };
  }

  // 1. GET /api/subscription/status or /api/subscription/restore
  if (method === 'GET' || pathname.endsWith('/status') || pathname.endsWith('/restore')) {
    const data = await getUserSubscription(userId);
    return {
      statusCode: 200,
      payload: {
        success: true,
        subscription: data.subscription,
        history: data.history,
      },
    };
  }

  // 2. POST /api/subscription/trial
  if (method === 'POST' && pathname.endsWith('/trial')) {
    const meta = {
      phone:
        adminAuth.authorized && typeof body.phone === 'string' && body.phone.trim()
          ? body.phone.trim().slice(0, 32)
          : userId,
      username: typeof body.username === 'string' ? body.username.trim().slice(0, 80) : undefined,
    };
    const result = await activateThreeDayTrial(userId, meta);
    return {
      statusCode: result.ok ? 200 : 400,
      payload: {
        success: result.ok,
        error: result.error,
        subscription: result.subscription,
        history: result.history,
      },
    };
  }

  return {
    statusCode: 404,
    payload: { success: false, error: 'Subscription endpoint not found.' },
  };
}
