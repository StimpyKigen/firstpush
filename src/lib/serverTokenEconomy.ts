/**
 * MshindiRoom Authoritative Server-Side Token Economy Engine
 *
 * Enforces:
 * 1. Server as sole authority over Mshindi Token creation, ownership, spending, and validation.
 * 2. Globally unique, cryptographically strong permanent identities (`mt_<128-bit hex>`) for every single Mshindi Token unit.
 * 3. Non-reusable consumed tokens (`ACTIVE` -> `CONSUMED` one-way state machine).
 * 4. Append-only immutable transaction ledger (`PURCHASE`, `REFERRAL_REWARD`, `SPEND`, `ADMIN_CREDIT`, `ADMIN_DEBIT`, `REFUND`, `REVERSAL`, `MIGRATION`).
 * 5. Atomic concurrency-safe operations with per-user & global mutex locks, rollback on failure, and idempotency keys.
 * 6. Official Award Rates:
 *    - Purchases: KSh 100 = 1 Mshindi Token (`Math.floor(verifiedAmountKsh / 100)`)
 *    - Referrals: 3 qualifying successful invitations = 1 Mshindi Token (`Math.floor(qualifyingReferrals / 3)`), preserving remainders (`1/3`, `2/3`).
 * 7. Safe, idempotent migration of existing user token balances with reconciliation auditing.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { verifyAdminRequest, normalizeAdminPhone, ADMIN_PHONE_NORMALIZED } from './adminAuthService.js';

// ============================================================================
// OFFICIAL RATES & CONSTANTS
// ============================================================================

export const KSH_PER_MSHINDI_TOKEN = 100; // KSh 100 = 1 Mshindi Token
export const QUALIFYING_REFERRALS_PER_TOKEN = 3; // 3 qualifying invitations = 1 Mshindi Token
export const DEFAULT_ROOM_UNLOCK_TOKEN_COST = 1; // 1 Mshindi Token unlocks a standard KSh 10 room

const USER_SESSION_SECRET =
  process.env.USER_TOKEN_SECRET ||
  process.env.ADMIN_TOKEN_SECRET ||
  'mshindi-token-economy-hmac-secret-2026';

// ============================================================================
// DATA MODELS & INTERFACES
// ============================================================================

export type TokenUnitStatus = 'ACTIVE' | 'CONSUMED';

export type TokenIssuanceSource =
  | 'PURCHASE'
  | 'REFERRAL'
  | 'ADMIN'
  | 'MIGRATION'
  | 'REFUND';

export type TokenTransactionType =
  | 'PURCHASE'
  | 'REFERRAL_REWARD'
  | 'SPEND'
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT'
  | 'REFUND'
  | 'REVERSAL'
  | 'MIGRATION';

export interface MshindiTokenUnit {
  tokenId: string; // Globally unique permanent ID (`mt_<32-char hex>`)
  ownerUid: string; // Canonical authenticated owner UID
  status: TokenUnitStatus; // 'ACTIVE' | 'CONSUMED'
  createdAt: string; // Server ISO timestamp
  source: TokenIssuanceSource;
  transactionId: string; // Issuance transaction ID
  consumedAt: string | null; // Server ISO timestamp when consumed
  consumedByTransactionId: string | null; // Transaction ID that consumed this token
  consumedReason: string | null;
}

export interface TokenLedgerTransaction {
  transactionId: string; // Unique transaction ID (`tx_mt_<hex>`)
  userUid: string; // Canonical owner UID
  type: TokenTransactionType;
  quantity: number; // Positive integer count of token units
  delta: number; // Signed change (+quantity or -quantity)
  balanceAfter: number; // Authoritative active token count after transaction
  tokenIds: string[]; // Exact `mt_...` token unit IDs minted or consumed
  source: string; // Origin or context
  reason: string; // Human-readable description
  referenceId: string; // Payment code, referral batch ID, room ID, or migration ref
  idempotencyKey: string; // Unique idempotency key preventing replay
  timestamp: string; // Server-generated ISO timestamp
  status: 'COMPLETED';
  actorId: string; // Authenticated user UID, 'SYSTEM', or 'ADMIN:<phone>'
}

export interface LegacyHistoricalTx {
  id: string;
  type: string;
  label: string;
  amount: number;
  time: string;
  migratedAt: string;
}

export interface VerifiedReferralRecord {
  referralId: string;
  referrerUid: string;
  referrerUsername: string;
  referredUid: string;
  referredUsername: string;
  verifiedAt: string;
  qualifyingSequenceNumber: number; // 1st, 2nd, 3rd, etc. for this referrer
  awardedTransactionId: string | null; // Populated on every 3rd qualifying referral
}

export interface VerifiedPaymentRecord {
  code: string;
  userUid: string;
  amountKsh: number;
  purpose: string; // 'wallet-topup' | 'profile-deposit' | roomId
  roomName?: string;
  tokensAwarded: number;
  mintedTokenIds: string[];
  transactionId: string | null;
  verifiedAt: string;
  reversed: boolean;
  reversedAt: string | null;
  reversalTransactionId: string | null;
  reversalReason: string | null;
}

export interface TokenMigrationAuditRecord {
  migrationId: string;
  userUid: string;
  username: string;
  legacyBalance: number;
  migratedTokenCount: number;
  mintedTokenIds: string[];
  transactionId: string;
  legacyTxCount: number;
  legacyTxSum: number;
  reconciliationFlag: boolean;
  reconciliationNotes: string | null;
  migratedAt: string;
}

export interface UserTokenWalletRecord {
  userUid: string;
  username: string;
  pinHash?: string;
  balance: number; // Always strictly equals count of ACTIVE MshindiTokenUnits owned by userUid
  activeTokenIds: string[];
  consumedTokenIds: string[];
  walletBalanceKsh: number;
  unlockedRooms: string[];
  redeemedCodes: string[];
  qualifyingReferrals: string[]; // List of referredUid values
  totalQualifyingReferrals: number;
  referralTokensAwardedCount: number;
  referralProgressRemainder: number; // 0, 1, or 2 (progress toward next 3-invite token)
  referralsNeededForNextToken: number; // 3, 2, or 1
  legacyHistoricalTransactions: LegacyHistoricalTx[];
  migrated: boolean;
  migratedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PersistedTokenEconomyState {
  version: number;
  wallets: Record<string, UserTokenWalletRecord>;
  usernameToUid: Record<string, string>;
  tokenUnits: Record<string, MshindiTokenUnit>;
  ledger: TokenLedgerTransaction[]; // Append-only immutable array
  idempotencyMap: Record<string, { transactionId: string; createdAt: string; responseSnapshot: any }>;
  verifiedPayments: Record<string, VerifiedPaymentRecord>;
  referredUsers: Record<string, VerifiedReferralRecord>; // keyed by referredUid
  migrations: Record<string, TokenMigrationAuditRecord>; // keyed by userUid
}

// ============================================================================
// STORAGE & PERSISTENCE LAYER
// ============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');
const PRIMARY_ECONOMY_FILE = path.join(DATA_DIR, 'token_economy.json');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), '.mshindi-cache')
  : path.join(process.cwd(), '.cache');
const FALLBACK_ECONOMY_FILE = path.join(CACHE_DIR, 'token_economy.json');

let memoryState: PersistedTokenEconomyState | null = null;
let persistenceEnabled = true;

export function setTokenPersistenceEnabled(enabled: boolean): void {
  persistenceEnabled = enabled;
}

function createEmptyEconomyState(): PersistedTokenEconomyState {
  return {
    version: 1,
    wallets: {},
    usernameToUid: {},
    tokenUnits: {},
    ledger: [],
    idempotencyMap: {},
    verifiedPayments: {},
    referredUsers: {},
    migrations: {},
  };
}

function loadEconomyState(): PersistedTokenEconomyState {
  if (memoryState) return memoryState;

  if (persistenceEnabled) {
    for (const filePath of [FALLBACK_ECONOMY_FILE, PRIMARY_ECONOMY_FILE]) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && parsed.wallets && parsed.tokenUnits) {
            memoryState = {
              version: 1,
              wallets: parsed.wallets || {},
              usernameToUid: parsed.usernameToUid || {},
              tokenUnits: parsed.tokenUnits || {},
              ledger: Array.isArray(parsed.ledger) ? parsed.ledger.map((tx: any) => Object.freeze({ ...tx })) : [],
              idempotencyMap: parsed.idempotencyMap || {},
              verifiedPayments: parsed.verifiedPayments || {},
              referredUsers: parsed.referredUsers || {},
              migrations: parsed.migrations || {},
            };
            return memoryState;
          }
        }
      } catch {
        // Fallback to next file or empty state
      }
    }
  }

  memoryState = createEmptyEconomyState();
  return memoryState;
}

function saveEconomyState(): void {
  if (!memoryState || !persistenceEnabled) return;
  const serialized = JSON.stringify(memoryState, null, 2);

  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(FALLBACK_ECONOMY_FILE, serialized, 'utf-8');
  } catch { }

  if (!isServerless) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(PRIMARY_ECONOMY_FILE, serialized, 'utf-8');
    } catch { }
  }
}

/**
 * Resets in-memory state (for isolated security/unit test runs only).
 */
export function resetTokenEconomyForTesting(): void {
  memoryState = createEmptyEconomyState();
}

// ============================================================================
// CONCURRENCY LOCKING (MUTEX QUEUE)
// ============================================================================

let globalLockChain: Promise<any> = Promise.resolve();
const userLockChains = new Map<string, Promise<any>>();

/**
 * Serializes operations globally and per-user so concurrent requests can never
 * double-spend the same token unit or bypass idempotency checks.
 */
export function withAtomicLock<T>(lockKey: string, task: () => Promise<T> | T): Promise<T> {
  const prevGlobal = globalLockChain;
  const prevUser = userLockChains.get(lockKey) || Promise.resolve();

  const run = async (): Promise<T> => {
    await Promise.allSettled([prevGlobal, prevUser]);
    return await task();
  };

  const currentPromise = run();
  const settledPromise = currentPromise.then(
    () => undefined,
    () => undefined
  );

  globalLockChain = settledPromise;
  userLockChains.set(lockKey, settledPromise);

  return currentPromise;
}

// ============================================================================
// CRYPTOGRAPHIC IDENTITIES & SESSION AUTHENTICATION
// ============================================================================

export function normalizeCanonicalUid(rawPhoneOrUid?: string | null): string {
  if (!rawPhoneOrUid || typeof rawPhoneOrUid !== 'string') return '';
  const trimmed = rawPhoneOrUid.trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return '254' + digits.slice(1);
  }
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    return '254' + digits;
  }
  if (digits.length >= 7 && digits.length <= 15) {
    return digits;
  }
  return trimmed.replace(/[^A-Za-z0-9_-]/g, '');
}

/**
 * Generates a cryptographically strong, collision-safe unique Mshindi Token ID.
 */
function generateUniqueTokenId(state: PersistedTokenEconomyState): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `mt_${crypto.randomBytes(16).toString('hex')}`;
    if (!state.tokenUnits[candidate]) {
      return candidate;
    }
  }
  throw new Error('CRITICAL: Failed to generate unique Mshindi Token ID.');
}

/**
 * Generates a cryptographically strong unique ledger Transaction ID.
 */
function generateUniqueTransactionId(state: PersistedTokenEconomyState): string {
  const existingIds = new Set(state.ledger.map((tx) => tx.transactionId));
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `tx_mt_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }
  throw new Error('CRITICAL: Failed to generate unique transaction ID.');
}

/**
 * Issues an HMAC-SHA256 signed user session token bound to `userUid`.
 */
export function issueUserSessionToken(userUid: string, pinHash?: string): string {
  const canonicalUid = normalizeCanonicalUid(userUid);
  if (!canonicalUid) {
    throw new Error('Cannot issue session token for empty userUid.');
  }
  const issuedAt = Date.now();
  const payload = `${canonicalUid}:${issuedAt}:${pinHash ? pinHash.slice(0, 16) : 'verified'}`;
  const sig = crypto.createHmac('sha256', USER_SESSION_SECRET).update(payload).digest('hex');
  return `utok.${Buffer.from(payload, 'utf-8').toString('base64url')}.${sig}`;
}

/**
 * Verifies an HMAC-SHA256 signed user session token and returns the authenticated `userUid`.
 */
export function verifyUserSessionToken(token?: string | null): { valid: boolean; userUid?: string } {
  if (!token || typeof token !== 'string' || !token.startsWith('utok.')) {
    return { valid: false };
  }
  const parts = token.trim().split('.');
  if (parts.length !== 3) return { valid: false };

  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const expectedSig = crypto.createHmac('sha256', USER_SESSION_SECRET).update(payload).digest('hex');
    const a = Buffer.from(parts[2], 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false };
    }
    const [uidPart, issuedAtStr] = payload.split(':');
    const issuedAt = Number(issuedAtStr);
    if (!uidPart || !Number.isFinite(issuedAt) || issuedAt <= 0) {
      return { valid: false };
    }
    return { valid: true, userUid: normalizeCanonicalUid(uidPart) };
  } catch {
    return { valid: false };
  }
}

/**
 * Authenticates an incoming user request via signed `x-user-token` or registered `(userUid, pinHash)` credentials.
 * Strictly prevents any user from acting on behalf of another `userUid`.
 */
export function authenticateTokenRequest(
  headers?: Record<string, string | string[] | undefined>,
  body?: any
): { authenticated: boolean; userUid?: string; isAdmin?: boolean; error?: string; statusCode?: number } {
  const getHeader = (name: string): string => {
    if (!headers) return '';
    const val = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] || '';
    return typeof val === 'string' ? val.trim() : '';
  };

  // 1. Check if request carries valid admin credentials
  const adminCheck = verifyAdminRequest(headers, body);
  const requestedUid = normalizeCanonicalUid(
    body?.userUid || body?.userId || body?.phone || getHeader('x-user-uid') || getHeader('x-user-phone')
  );

  // 2. Check signed user session token (`x-user-token` or `Authorization: Bearer utok...`)
  const authHeader = getHeader('authorization');
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const sessionToken =
    getHeader('x-user-token') ||
    (bearerToken.startsWith('utok.') ? bearerToken : '') ||
    (typeof body?.userToken === 'string' ? body.userToken : '');

  if (sessionToken) {
    const verified = verifyUserSessionToken(sessionToken);
    if (!verified.valid || !verified.userUid) {
      return { authenticated: false, error: 'Invalid or tampered user session token.', statusCode: 401 };
    }
    if (requestedUid && requestedUid !== verified.userUid && !adminCheck.authorized) {
      return {
        authenticated: false,
        error: `Forbidden: Authenticated user '${verified.userUid}' cannot perform operations on '${requestedUid}'.`,
        statusCode: 403,
      };
    }
    return { authenticated: true, userUid: verified.userUid, isAdmin: adminCheck.authorized };
  }

  // 3. Check `x-user-uid` + `x-user-pin-hash` against registered wallet/account
  const pinHash = getHeader('x-user-pin-hash') || (typeof body?.pinHash === 'string' ? body.pinHash.trim() : '');
  if (requestedUid && pinHash && /^[a-f0-9]{64}$/i.test(pinHash)) {
    const state = loadEconomyState();
    const existingWallet = state.wallets[requestedUid];
    if (existingWallet && existingWallet.pinHash && existingWallet.pinHash !== pinHash) {
      return { authenticated: false, error: 'Invalid user PIN credentials.', statusCode: 401 };
    }
    return { authenticated: true, userUid: requestedUid, isAdmin: adminCheck.authorized };
  }

  if (adminCheck.authorized && requestedUid) {
    return { authenticated: true, userUid: requestedUid, isAdmin: true };
  }

  return {
    authenticated: false,
    error: 'Authentication required: Missing valid session token or verified credentials.',
    statusCode: 401,
  };
}

// ============================================================================
// OFFICIAL AWARD RATE CALCULATORS
// ============================================================================

/**
 * Official Purchase Award Rate:
 * KSh 100 = 1 Mshindi Token
 * Examples: KSh 100 -> 1, KSh 200 -> 2, KSh 500 -> 5, KSh 1000 -> 10.
 */
export function calculatePurchaseTokens(verifiedAmountKsh: number): number {
  if (!Number.isFinite(verifiedAmountKsh) || verifiedAmountKsh < KSH_PER_MSHINDI_TOKEN) {
    return 0;
  }
  return Math.floor(verifiedAmountKsh / KSH_PER_MSHINDI_TOKEN);
}

/**
 * Official Referral Award Rate:
 * 3 qualifying successful invitations = 1 Mshindi Token
 * Examples: 3 -> 1, 6 -> 2, 9 -> 3, 12 -> 4.
 * Preserves qualifying invitation remainders (1 or 2) toward the next token.
 */
export function calculateReferralMilestones(totalQualifyingReferrals: number): {
  totalQualifyingReferrals: number;
  totalTokensEarned: number;
  remainderProgress: number;
  referralsNeededForNextToken: number;
} {
  const safeCount = Math.max(0, Math.floor(Number(totalQualifyingReferrals) || 0));
  const totalTokensEarned = Math.floor(safeCount / QUALIFYING_REFERRALS_PER_TOKEN);
  const remainderProgress = safeCount % QUALIFYING_REFERRALS_PER_TOKEN;
  const referralsNeededForNextToken = QUALIFYING_REFERRALS_PER_TOKEN - remainderProgress;
  return {
    totalQualifyingReferrals: safeCount,
    totalTokensEarned,
    remainderProgress,
    referralsNeededForNextToken,
  };
}

/**
 * Calculates the Mshindi Token cost to unlock a room based on its entry fee.
 * Standard KSh 10 room = 1 Mshindi Token.
 */
export function calculateRoomUnlockTokenCost(entryFeeKsh: number = 10): number {
  if (!Number.isFinite(entryFeeKsh) || entryFeeKsh <= 0) return DEFAULT_ROOM_UNLOCK_TOKEN_COST;
  return Math.max(1, Math.ceil(entryFeeKsh / 10));
}

// ============================================================================
// INTERNAL WALLET & LEDGER HELPERS
// ============================================================================

function getOrCreateUserWallet(
  state: PersistedTokenEconomyState,
  userUid: string,
  username?: string,
  pinHash?: string
): UserTokenWalletRecord {
  const canonicalUid = normalizeCanonicalUid(userUid);
  if (!canonicalUid) {
    throw new Error('Invalid userUid.');
  }

  let wallet = state.wallets[canonicalUid];
  const now = new Date().toISOString();

  if (!wallet) {
    const cleanUsername = (username || `Punter_${canonicalUid.slice(-4)}`).trim();
    wallet = {
      userUid: canonicalUid,
      username: cleanUsername,
      pinHash: pinHash || undefined,
      balance: 0,
      activeTokenIds: [],
      consumedTokenIds: [],
      walletBalanceKsh: 250,
      unlockedRooms: [],
      redeemedCodes: [],
      qualifyingReferrals: [],
      totalQualifyingReferrals: 0,
      referralTokensAwardedCount: 0,
      referralProgressRemainder: 0,
      referralsNeededForNextToken: QUALIFYING_REFERRALS_PER_TOKEN,
      legacyHistoricalTransactions: [],
      migrated: false,
      migratedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    state.wallets[canonicalUid] = wallet;
    if (cleanUsername) {
      state.usernameToUid[cleanUsername.toLowerCase()] = canonicalUid;
    }
  } else {
    if (username && username.trim()) {
      wallet.username = username.trim();
      state.usernameToUid[username.trim().toLowerCase()] = canonicalUid;
    }
    if (pinHash && !wallet.pinHash) {
      wallet.pinHash = pinHash;
    }
  }

  // Reconcile balance strictly from authoritative activeTokenIds
  wallet.activeTokenIds = wallet.activeTokenIds.filter((id) => {
    const unit = state.tokenUnits[id];
    return unit && unit.ownerUid === canonicalUid && unit.status === 'ACTIVE';
  });
  wallet.balance = wallet.activeTokenIds.length;
  return wallet;
}

/**
 * Mints `quantity` cryptographically unique `MshindiTokenUnit` records for `ownerUid`
 * and appends an immutable transaction to the ledger.
 */
function mintTokensAndRecordLedger(
  state: PersistedTokenEconomyState,
  params: {
    userUid: string;
    username?: string;
    quantity: number;
    source: TokenIssuanceSource;
    txType: TokenTransactionType;
    reason: string;
    referenceId: string;
    idempotencyKey: string;
    actorId: string;
  }
): { transaction: TokenLedgerTransaction; mintedTokens: MshindiTokenUnit[]; wallet: UserTokenWalletRecord } {
  const { userUid, username, quantity, source, txType, reason, referenceId, idempotencyKey, actorId } = params;
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Invalid token mint quantity: ${quantity}`);
  }

  const wallet = getOrCreateUserWallet(state, userUid, username);
  const now = new Date().toISOString();
  const transactionId = generateUniqueTransactionId(state);
  const mintedTokens: MshindiTokenUnit[] = [];
  const mintedIds: string[] = [];

  for (let i = 0; i < quantity; i++) {
    const tokenId = generateUniqueTokenId(state);
    const unit: MshindiTokenUnit = {
      tokenId,
      ownerUid: wallet.userUid,
      status: 'ACTIVE',
      createdAt: now,
      source,
      transactionId,
      consumedAt: null,
      consumedByTransactionId: null,
      consumedReason: null,
    };
    state.tokenUnits[tokenId] = unit;
    wallet.activeTokenIds.push(tokenId);
    mintedTokens.push(unit);
    mintedIds.push(tokenId);
  }

  wallet.balance = wallet.activeTokenIds.length;
  wallet.updatedAt = now;

  const transaction: TokenLedgerTransaction = Object.freeze({
    transactionId,
    userUid: wallet.userUid,
    type: txType,
    quantity,
    delta: quantity,
    balanceAfter: wallet.balance,
    tokenIds: mintedIds,
    source,
    reason,
    referenceId,
    idempotencyKey,
    timestamp: now,
    status: 'COMPLETED',
    actorId,
  });

  state.ledger.unshift(transaction);
  return { transaction, mintedTokens, wallet };
}

/**
 * Selects `quantity` active `MshindiTokenUnit`s owned by `userUid` (FIFO order),
 * permanently marks them as `CONSUMED`, updates the wallet balance, and appends an
 * immutable debit/spend transaction to the ledger.
 */
function consumeTokensAndRecordLedger(
  state: PersistedTokenEconomyState,
  params: {
    userUid: string;
    quantity: number;
    txType: 'SPEND' | 'ADMIN_DEBIT' | 'REVERSAL' | 'REFUND';
    source: string;
    reason: string;
    referenceId: string;
    idempotencyKey: string;
    actorId: string;
    specificTokenIds?: string[];
  }
): { transaction: TokenLedgerTransaction; consumedTokens: MshindiTokenUnit[]; wallet: UserTokenWalletRecord } {
  const { userUid, quantity, txType, source, reason, referenceId, idempotencyKey, actorId, specificTokenIds } = params;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error(`Invalid token consumption quantity: ${quantity}`);
  }

  const wallet = getOrCreateUserWallet(state, userUid);

  // If specific token IDs were requested, verify every single one is owned and ACTIVE
  let targetTokenIds: string[] = [];
  if (specificTokenIds && specificTokenIds.length > 0) {
    if (specificTokenIds.length !== quantity) {
      throw new Error('Requested specificTokenIds length does not match quantity.');
    }
    const uniqueCheck = new Set(specificTokenIds);
    if (uniqueCheck.size !== specificTokenIds.length) {
      throw new Error('Duplicate token IDs in consumption request.');
    }
    for (const id of specificTokenIds) {
      const unit = state.tokenUnits[id];
      if (!unit) {
        throw new Error(`TOKEN_NOT_FOUND: Token ID '${id}' does not exist.`);
      }
      if (unit.ownerUid !== wallet.userUid) {
        throw new Error(`UNAUTHORIZED_TOKEN_OWNERSHIP: Token '${id}' does not belong to user '${wallet.userUid}'.`);
      }
      if (unit.status !== 'ACTIVE') {
        throw new Error(`TOKEN_ALREADY_CONSUMED: Token '${id}' has already been consumed and cannot be reused.`);
      }
    }
    targetTokenIds = [...specificTokenIds];
  } else {
    // Select FIFO from user's verified ACTIVE tokens
    if (wallet.activeTokenIds.length < quantity) {
      throw new Error(
        `INSUFFICIENT_TOKENS: Required ${quantity} MT, but user '${wallet.userUid}' only has ${wallet.activeTokenIds.length} active MT.`
      );
    }
    targetTokenIds = wallet.activeTokenIds.slice(0, quantity);
  }

  const now = new Date().toISOString();
  const transactionId = generateUniqueTransactionId(state);
  const consumedTokens: MshindiTokenUnit[] = [];
  const consumedSet = new Set(targetTokenIds);

  for (const tokenId of targetTokenIds) {
    const unit = state.tokenUnits[tokenId];
    if (!unit || unit.status !== 'ACTIVE' || unit.ownerUid !== wallet.userUid) {
      throw new Error(`ATOMIC_INVARIANT_VIOLATION: Token '${tokenId}' is not active or owned by '${wallet.userUid}'.`);
    }
    unit.status = 'CONSUMED';
    unit.consumedAt = now;
    unit.consumedByTransactionId = transactionId;
    unit.consumedReason = reason;
    consumedTokens.push({ ...unit });
    wallet.consumedTokenIds.push(tokenId);
  }

  wallet.activeTokenIds = wallet.activeTokenIds.filter((id) => !consumedSet.has(id));
  wallet.balance = wallet.activeTokenIds.length;
  wallet.updatedAt = now;

  const transaction: TokenLedgerTransaction = Object.freeze({
    transactionId,
    userUid: wallet.userUid,
    type: txType,
    quantity,
    delta: -quantity,
    balanceAfter: wallet.balance,
    tokenIds: targetTokenIds,
    source,
    reason,
    referenceId,
    idempotencyKey,
    timestamp: now,
    status: 'COMPLETED',
    actorId,
  });

  state.ledger.unshift(transaction);
  return { transaction, consumedTokens, wallet };
}

// ============================================================================
// PUBLIC SERVER OPERATIONS
// ============================================================================

export interface FormattedWalletResponse {
  userUid: string;
  username: string;
  mshindiTokens: number;
  activeTokenCount: number;
  activeTokenIds: string[];
  consumedTokenCount: number;
  walletBalanceKsh: number;
  unlockedRooms: string[];
  redeemedCodes: string[];
  totalReferrals: number;
  referralTokensAwardedCount: number;
  referralProgressRemainder: number;
  referralsNeededForNextToken: number;
  tokenTransactions: Array<{
    id: string;
    transactionId: string;
    type: 'earn_spend' | 'earn_referral' | 'redeem_room' | 'admin_credit' | 'admin_debit' | 'refund' | 'reversal' | 'migration';
    ledgerType: TokenTransactionType;
    label: string;
    amount: number;
    balanceAfter?: number;
    tokenIds: string[];
    referenceId: string;
    time: string;
    timestamp: string;
  }>;
  rates: {
    purchaseKshPerToken: number;
    referralsPerToken: number;
    defaultRoomUnlockTokenCost: number;
  };
  migrated: boolean;
  userSessionToken?: string;
}

function formatRelativeTime(isoString: string): string {
  const ts = Date.parse(isoString);
  if (!Number.isFinite(ts)) return isoString;
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function mapLedgerTypeToUiType(
  type: TokenTransactionType
): 'earn_spend' | 'earn_referral' | 'redeem_room' | 'admin_credit' | 'admin_debit' | 'refund' | 'reversal' | 'migration' {
  switch (type) {
    case 'PURCHASE':
      return 'earn_spend';
    case 'REFERRAL_REWARD':
      return 'earn_referral';
    case 'SPEND':
      return 'redeem_room';
    case 'ADMIN_CREDIT':
      return 'admin_credit';
    case 'ADMIN_DEBIT':
      return 'admin_debit';
    case 'REFUND':
      return 'refund';
    case 'REVERSAL':
      return 'reversal';
    case 'MIGRATION':
      return 'migration';
  }
}

export function buildFormattedWalletResponse(
  state: PersistedTokenEconomyState,
  wallet: UserTokenWalletRecord,
  includeSessionToken = false
): FormattedWalletResponse {
  const userLedger = state.ledger.filter(
    (tx) => tx.userUid === wallet.userUid && tx.type !== 'MIGRATION'
  );

  const formattedLedger: FormattedWalletResponse['tokenTransactions'] = userLedger.map((tx) => ({
    id: tx.transactionId,
    transactionId: tx.transactionId,
    type: mapLedgerTypeToUiType(tx.type),
    ledgerType: tx.type,
    label: tx.reason,
    amount: tx.delta,
    balanceAfter: tx.balanceAfter,
    tokenIds: tx.tokenIds,
    referenceId: tx.referenceId,
    time: formatRelativeTime(tx.timestamp),
    timestamp: tx.timestamp,
  }));

  // Append preserved legacy historical transactions below new server ledger transactions
  for (const legacyTx of wallet.legacyHistoricalTransactions || []) {
    formattedLedger.push({
      id: legacyTx.id,
      transactionId: legacyTx.id,
      type: (legacyTx.type as any) || 'earn_spend',
      ledgerType: 'MIGRATION',
      label: legacyTx.label,
      amount: legacyTx.amount,
      tokenIds: [],
      referenceId: 'legacy-history',
      time: legacyTx.time || 'historical',
      timestamp: legacyTx.migratedAt,
    });
  }

  return {
    userUid: wallet.userUid,
    username: wallet.username,
    mshindiTokens: wallet.balance,
    activeTokenCount: wallet.activeTokenIds.length,
    activeTokenIds: [...wallet.activeTokenIds],
    consumedTokenCount: wallet.consumedTokenIds.length,
    walletBalanceKsh: wallet.walletBalanceKsh,
    unlockedRooms: [...wallet.unlockedRooms],
    redeemedCodes: [...wallet.redeemedCodes],
    totalReferrals: wallet.totalQualifyingReferrals,
    referralTokensAwardedCount: wallet.referralTokensAwardedCount,
    referralProgressRemainder: wallet.referralProgressRemainder,
    referralsNeededForNextToken: wallet.referralsNeededForNextToken,
    tokenTransactions: formattedLedger,
    rates: {
      purchaseKshPerToken: KSH_PER_MSHINDI_TOKEN,
      referralsPerToken: QUALIFYING_REFERRALS_PER_TOKEN,
      defaultRoomUnlockTokenCost: DEFAULT_ROOM_UNLOCK_TOKEN_COST,
    },
    migrated: wallet.migrated,
    ...(includeSessionToken ? { userSessionToken: issueUserSessionToken(wallet.userUid, wallet.pinHash) } : {}),
  };
}

/**
 * 1. SAFE IDEMPOTENT MIGRATION OF EXISTING USER TOKEN BALANCES
 *
 * Preserves existing user balances without resetting, reducing, or duplicating them.
 * Assigns unique `mt_...` token identities to every migrated token unit and records
 * an auditable migration record + flags any legacy transaction sum discrepancies for reconciliation.
 */
export async function migrateUserTokenBalance(params: {
  userUid: string;
  username?: string;
  pinHash?: string;
  legacyBalance?: number;
  legacyTokenTransactions?: Array<{ id?: string; type?: string; label?: string; amount?: number; time?: string }>;
  legacyWalletBalanceKsh?: number;
  legacyUnlockedRooms?: string[];
  legacyRedeemedCodes?: string[];
  legacyTotalReferrals?: number;
}): Promise<{
  success: boolean;
  alreadyMigrated: boolean;
  migrationRecord: TokenMigrationAuditRecord;
  wallet: FormattedWalletResponse;
}> {
  const canonicalUid = normalizeCanonicalUid(params.userUid);
  if (!canonicalUid) {
    throw new Error('Cannot migrate token balance without a valid userUid.');
  }

  return withAtomicLock(canonicalUid, () => {
    const state = loadEconomyState();
    const wallet = getOrCreateUserWallet(state, canonicalUid, params.username, params.pinHash);

    // Prevent duplicate migration if executed more than once
    if (wallet.migrated && state.migrations[canonicalUid]) {
      return {
        success: true,
        alreadyMigrated: true,
        migrationRecord: state.migrations[canonicalUid],
        wallet: buildFormattedWalletResponse(state, wallet, true),
      };
    }

    const rawLegacyBalance =
      typeof params.legacyBalance === 'number' && Number.isFinite(params.legacyBalance)
        ? Math.max(0, Math.floor(params.legacyBalance))
        : 0;

    // Only migrate non-seed real user balances or explicit legacy balances passed for existing users
    const legacyTxs = Array.isArray(params.legacyTokenTransactions) ? params.legacyTokenTransactions : [];
    const legacyTxSum = legacyTxs.reduce((acc, tx) => acc + (Number(tx?.amount) || 0), 0);

    // Reconciliation check: flag if legacy transaction history sum differs from legacyBalance
    let reconciliationFlag = false;
    let reconciliationNotes: string | null = null;
    if (legacyTxs.length > 0 && legacyTxSum !== rawLegacyBalance) {
      reconciliationFlag = true;
      reconciliationNotes = `Legacy balance (${rawLegacyBalance} MT) differs from legacy transaction sum (${legacyTxSum} MT). Preserved legacy balance intact per migration policy.`;
    }

    const idempotencyKey = `migration:v1:${canonicalUid}`;
    const now = new Date().toISOString();

    // Preserve wallet metadata from existing client state
    if (typeof params.legacyWalletBalanceKsh === 'number' && Number.isFinite(params.legacyWalletBalanceKsh) && params.legacyWalletBalanceKsh >= 0) {
      wallet.walletBalanceKsh = params.legacyWalletBalanceKsh;
    }
    if (Array.isArray(params.legacyUnlockedRooms)) {
      for (const roomId of params.legacyUnlockedRooms) {
        if (typeof roomId === 'string' && roomId && !wallet.unlockedRooms.includes(roomId)) {
          wallet.unlockedRooms.push(roomId);
        }
      }
    }
    if (Array.isArray(params.legacyRedeemedCodes)) {
      for (const code of params.legacyRedeemedCodes) {
        if (typeof code === 'string' && code && !wallet.redeemedCodes.includes(code)) {
          wallet.redeemedCodes.push(code);
        }
      }
    }
    if (typeof params.legacyTotalReferrals === 'number' && params.legacyTotalReferrals > wallet.totalQualifyingReferrals) {
      // Preserve historical referral count without re-triggering duplicate rewards
      const histCount = Math.max(0, Math.floor(params.legacyTotalReferrals));
      wallet.totalQualifyingReferrals = histCount;
      wallet.referralTokensAwardedCount = Math.floor(histCount / QUALIFYING_REFERRALS_PER_TOKEN);
      wallet.referralProgressRemainder = histCount % QUALIFYING_REFERRALS_PER_TOKEN;
      wallet.referralsNeededForNextToken = QUALIFYING_REFERRALS_PER_TOKEN - wallet.referralProgressRemainder;
    }

    // Preserve historical transaction records
    wallet.legacyHistoricalTransactions = legacyTxs
      .filter((tx) => tx && typeof tx.label === 'string' && typeof tx.amount === 'number')
      .map((tx, idx) => ({
        id: String(tx.id || `legacy-tx-${idx + 1}`),
        type: String(tx.type || 'earn_spend'),
        label: String(tx.label),
        amount: Number(tx.amount),
        time: String(tx.time || 'historical'),
        migratedAt: now,
      }));

    // Mint unique MshindiTokenUnit records for each unit of existing balance
    const { transaction, mintedTokens } = mintTokensAndRecordLedger(state, {
      userUid: canonicalUid,
      username: params.username,
      quantity: rawLegacyBalance,
      source: 'MIGRATION',
      txType: 'MIGRATION',
      reason: `Migrated existing balance (${rawLegacyBalance} MT) to server-controlled token units`,
      referenceId: `migration:${canonicalUid}`,
      idempotencyKey,
      actorId: 'SYSTEM_MIGRATION',
    });

    wallet.migrated = true;
    wallet.migratedAt = now;

    const migrationRecord: TokenMigrationAuditRecord = {
      migrationId: `mig_${canonicalUid}`,
      userUid: canonicalUid,
      username: wallet.username,
      legacyBalance: rawLegacyBalance,
      migratedTokenCount: mintedTokens.length,
      mintedTokenIds: mintedTokens.map((t) => t.tokenId),
      transactionId: transaction.transactionId,
      legacyTxCount: wallet.legacyHistoricalTransactions.length,
      legacyTxSum,
      reconciliationFlag,
      reconciliationNotes,
      migratedAt: now,
    };

    state.migrations[canonicalUid] = migrationRecord;
    state.idempotencyMap[idempotencyKey] = {
      transactionId: transaction.transactionId,
      createdAt: now,
      responseSnapshot: migrationRecord,
    };

    saveEconomyState();

    return {
      success: true,
      alreadyMigrated: false,
      migrationRecord,
      wallet: buildFormattedWalletResponse(state, wallet, true),
    };
  });
}

/**
 * 2. GET AUTHORITATIVE USER WALLET & TOKEN STATE
 */
export async function getAuthoritativeUserWallet(params: {
  userUid: string;
  username?: string;
  pinHash?: string;
}): Promise<FormattedWalletResponse> {
  const canonicalUid = normalizeCanonicalUid(params.userUid);
  if (!canonicalUid) {
    throw new Error('Valid userUid is required.');
  }

  return withAtomicLock(canonicalUid, () => {
    const state = loadEconomyState();
    const wallet = getOrCreateUserWallet(state, canonicalUid, params.username, params.pinHash);
    saveEconomyState();
    return buildFormattedWalletResponse(state, wallet, true);
  });
}

/**
 * 3. ATOMIC TOKEN SPENDING / ROOM REDEMPTION
 *
 * Validates user identity, checks active token ownership, selects FIFO active tokens,
 * marks them permanently CONSUMED, records an immutable SPEND transaction, and unlocks
 * the target room or feature atomically.
 */
export async function spendAuthoritativeTokens(params: {
  userUid: string;
  quantity: number;
  roomId?: string;
  roomName?: string;
  reason?: string;
  idempotencyKey?: string;
  specificTokenIds?: string[];
  simulateFailureAfterConsume?: boolean;
}): Promise<{
  success: boolean;
  idempotentReplay?: boolean;
  error?: string;
  statusCode?: number;
  transaction?: TokenLedgerTransaction;
  consumedTokenIds?: string[];
  wallet?: FormattedWalletResponse;
}> {
  const canonicalUid = normalizeCanonicalUid(params.userUid);
  if (!canonicalUid) {
    return { success: false, error: 'Authenticated userUid is required.', statusCode: 401 };
  }

  const quantity = Number(params.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, error: 'Token spend quantity must be a positive integer.', statusCode: 400 };
  }

  return withAtomicLock(canonicalUid, () => {
    const state = loadEconomyState();
    const wallet = getOrCreateUserWallet(state, canonicalUid);

    const idempotencyKey =
      params.idempotencyKey?.trim() ||
      (params.roomId ? `spend:room:${canonicalUid}:${params.roomId}` : '');

    // 1. Check idempotency key for duplicate/retried requests
    if (idempotencyKey && state.idempotencyMap[idempotencyKey]) {
      const prev = state.idempotencyMap[idempotencyKey];
      const existingTx = state.ledger.find((tx) => tx.transactionId === prev.transactionId);
      return {
        success: true,
        idempotentReplay: true,
        transaction: existingTx,
        consumedTokenIds: existingTx?.tokenIds || [],
        wallet: buildFormattedWalletResponse(state, wallet),
      };
    }

    // 2. If unlocking a room that the user already unlocked, return idempotently without double-charging
    if (params.roomId && wallet.unlockedRooms.includes(params.roomId)) {
      const existingTx = state.ledger.find(
        (tx) => tx.userUid === canonicalUid && tx.type === 'SPEND' && tx.referenceId === params.roomId
      );
      return {
        success: true,
        idempotentReplay: true,
        transaction: existingTx,
        consumedTokenIds: existingTx?.tokenIds || [],
        wallet: buildFormattedWalletResponse(state, wallet),
      };
    }

    // 3. Snapshot state before mutation so any failure rolls back completely
    const walletSnapshot = JSON.parse(JSON.stringify(wallet)) as UserTokenWalletRecord;
    const unitsSnapshot: Record<string, MshindiTokenUnit> = {};
    for (const tokenId of wallet.activeTokenIds) {
      if (state.tokenUnits[tokenId]) {
        unitsSnapshot[tokenId] = { ...state.tokenUnits[tokenId] };
      }
    }
    const ledgerLengthBefore = state.ledger.length;

    try {
      const effectiveKey = idempotencyKey || `spend:${canonicalUid}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
      const reason =
        params.reason ||
        `Redeemed ${quantity} MT to unlock ${params.roomName || params.roomId || 'Premium Room'}`;

      const { transaction, consumedTokens } = consumeTokensAndRecordLedger(state, {
        userUid: canonicalUid,
        quantity,
        txType: 'SPEND',
        source: 'ROOM_REDEMPTION',
        reason,
        referenceId: params.roomId || 'token-spend',
        idempotencyKey: effectiveKey,
        actorId: canonicalUid,
        specificTokenIds: params.specificTokenIds,
      });

      if (params.roomId && !wallet.unlockedRooms.includes(params.roomId)) {
        wallet.unlockedRooms.push(params.roomId);
      }

      if (params.simulateFailureAfterConsume) {
        throw new Error('SIMULATED_TRANSACTION_FAILURE: Atomic rollback triggered.');
      }

      state.idempotencyMap[effectiveKey] = {
        transactionId: transaction.transactionId,
        createdAt: transaction.timestamp,
        responseSnapshot: { consumedTokenIds: consumedTokens.map((t) => t.tokenId) },
      };

      saveEconomyState();

      return {
        success: true,
        idempotentReplay: false,
        transaction,
        consumedTokenIds: consumedTokens.map((t) => t.tokenId),
        wallet: buildFormattedWalletResponse(state, wallet),
      };
    } catch (err: any) {
      // Atomic Rollback: restore wallet, token units, and ledger length
      state.wallets[canonicalUid] = walletSnapshot;
      for (const [id, snapUnit] of Object.entries(unitsSnapshot)) {
        state.tokenUnits[id] = snapUnit;
      }
      while (state.ledger.length > ledgerLengthBefore) {
        state.ledger.shift();
      }

      const msg = err?.message || 'Failed to spend Mshindi Tokens.';
      const statusCode = msg.includes('INSUFFICIENT_TOKENS')
        ? 400
        : msg.includes('UNAUTHORIZED_TOKEN_OWNERSHIP')
          ? 403
          : msg.includes('TOKEN_ALREADY_CONSUMED')
            ? 409
            : 500;
      return {
        success: false,
        error: msg,
        statusCode,
        wallet: buildFormattedWalletResponse(state, walletSnapshot),
      };
    }
  });
}

/**
 * 4. SERVER-VERIFIED M-PESA PAYMENT & PURCHASE TOKEN AWARD
 *
 * Official Rate: KSh 100 = 1 Mshindi Token (`Math.floor(verifiedAmountKsh / 100)`).
 * Rejects unconfirmed payments, forged token amounts, and duplicate payment callbacks.
 */
export async function processVerifiedPurchasePayment(params: {
  userUid?: string;
  username?: string;
  code: string;
  amountKsh: number;
  purpose?: string; // 'wallet-topup' | 'profile-deposit' | roomId
  roomId?: string;
  roomName?: string;
  paymentConfirmed?: boolean; // Defaults to true when code passes server receipt validation; false if payment failed
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  idempotentReplay?: boolean;
  error?: string;
  statusCode?: number;
  code?: string;
  amountKsh?: number;
  tokensAwarded?: number;
  mintedTokenIds?: string[];
  transaction?: TokenLedgerTransaction | null;
  wallet?: FormattedWalletResponse;
}> {
  const cleanCode = String(params.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{8,12}$/.test(cleanCode)) {
    return {
      success: false,
      error: 'Invalid M-Pesa confirmation code format (e.g. QFT7K9L2M1).',
      statusCode: 400,
    };
  }

  // Reject explicitly failed or unconfirmed payment statuses
  if (params.paymentConfirmed === false) {
    return {
      success: false,
      error: 'Payment was not confirmed. Unsuccessful payments do not award Mshindi Tokens.',
      statusCode: 402,
    };
  }

  const amountKsh = Number(params.amountKsh);
  if (!Number.isFinite(amountKsh) || amountKsh <= 0) {
    return {
      success: false,
      error: 'Verified payment amount must be a positive number.',
      statusCode: 400,
    };
  }

  const canonicalUid = normalizeCanonicalUid(params.userUid) || 'guest_verified';

  return withAtomicLock(canonicalUid, () => {
    const state = loadEconomyState();
    const idempotencyKey = params.idempotencyKey?.trim() || `purchase:mpesa:${cleanCode}`;

    // Check if this M-Pesa confirmation code has already been processed
    const existingPayment = state.verifiedPayments[cleanCode];
    if (existingPayment) {
      // Never award duplicate tokens on replayed payment callbacks or repeated submissions
      return {
        success: false,
        idempotentReplay: true,
        error: 'This M-Pesa confirmation code has already been redeemed.',
        statusCode: 409,
        code: cleanCode,
        amountKsh: existingPayment.amountKsh,
        tokensAwarded: 0,
      };
    }

    const wallet = getOrCreateUserWallet(state, canonicalUid, params.username);
    const purpose = params.roomId || params.purpose || 'wallet-topup';
    const isTopUp = purpose === 'wallet-topup' || purpose === 'profile-deposit';

    // Update fiat wallet balance or unlock room
    if (isTopUp) {
      wallet.walletBalanceKsh += amountKsh;
    } else if (!wallet.unlockedRooms.includes(purpose)) {
      wallet.unlockedRooms.push(purpose);
    }

    if (!wallet.redeemedCodes.includes(cleanCode)) {
      wallet.redeemedCodes.push(cleanCode);
    }

    // Calculate official purchase reward: KSh 100 = 1 Mshindi Token
    const tokensAwarded = calculatePurchaseTokens(amountKsh);
    let transaction: TokenLedgerTransaction | null = null;
    let mintedTokenIds: string[] = [];

    if (tokensAwarded > 0) {
      const reason = isTopUp
        ? `Purchase Reward: M-Pesa Top Up of KSh ${amountKsh} (${cleanCode})`
        : `Purchase Reward: Unlocked ${params.roomName || purpose} — KSh ${amountKsh} (${cleanCode})`;

      const minted = mintTokensAndRecordLedger(state, {
        userUid: canonicalUid,
        username: params.username,
        quantity: tokensAwarded,
        source: 'PURCHASE',
        txType: 'PURCHASE',
        reason,
        referenceId: cleanCode,
        idempotencyKey,
        actorId: 'SYSTEM_PAYMENT_VERIFIER',
      });
      transaction = minted.transaction;
      mintedTokenIds = minted.mintedTokens.map((t) => t.tokenId);
    }

    const now = new Date().toISOString();
    const paymentRecord: VerifiedPaymentRecord = {
      code: cleanCode,
      userUid: canonicalUid,
      amountKsh,
      purpose,
      roomName: params.roomName,
      tokensAwarded,
      mintedTokenIds,
      transactionId: transaction?.transactionId || null,
      verifiedAt: now,
      reversed: false,
      reversedAt: null,
      reversalTransactionId: null,
      reversalReason: null,
    };

    state.verifiedPayments[cleanCode] = paymentRecord;
    state.idempotencyMap[idempotencyKey] = {
      transactionId: transaction?.transactionId || `pay_${cleanCode}`,
      createdAt: now,
      responseSnapshot: paymentRecord,
    };

    saveEconomyState();

    return {
      success: true,
      idempotentReplay: false,
      code: cleanCode,
      amountKsh,
      tokensAwarded,
      mintedTokenIds,
      transaction,
      wallet: buildFormattedWalletResponse(state, wallet),
    };
  });
}

/**
 * 5. WALLET BALANCE ROOM UNLOCK WITH SERVER-VALIDATED PURCHASE REWARD
 *
 * Deducts `costKsh` from the user's fiat wallet balance and awards `Math.floor(costKsh / 100)`
 * Mshindi Tokens (KSh 100 = 1 MT).
 */
export async function unlockRoomWithWalletBalanceServer(params: {
  userUid: string;
  roomId: string;
  roomName?: string;
  costKsh: number;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  idempotentReplay?: boolean;
  error?: string;
  statusCode?: number;
  tokensAwarded?: number;
  mintedTokenIds?: string[];
  transaction?: TokenLedgerTransaction | null;
  wallet?: FormattedWalletResponse;
}> {
  const canonicalUid = normalizeCanonicalUid(params.userUid);
  if (!canonicalUid) {
    return { success: false, error: 'Authenticated userUid is required.', statusCode: 401 };
  }

  const costKsh = Number(params.costKsh);
  if (!Number.isFinite(costKsh) || costKsh <= 0) {
    return { success: false, error: 'Room unlock cost must be a positive amount.', statusCode: 400 };
  }

  return withAtomicLock(canonicalUid, () => {
    const state = loadEconomyState();
    const wallet = getOrCreateUserWallet(state, canonicalUid);
    const idempotencyKey =
      params.idempotencyKey?.trim() || `wallet-unlock:${canonicalUid}:${params.roomId}`;

    if (wallet.unlockedRooms.includes(params.roomId) || state.idempotencyMap[idempotencyKey]) {
      return {
        success: true,
        idempotentReplay: true,
        tokensAwarded: 0,
        mintedTokenIds: [],
        transaction: null,
        wallet: buildFormattedWalletResponse(state, wallet),
      };
    }

    if (wallet.walletBalanceKsh < costKsh) {
      return {
        success: false,
        error: `Insufficient wallet balance. Need KSh ${costKsh}, have KSh ${wallet.walletBalanceKsh}.`,
        statusCode: 400,
      };
    }

    wallet.walletBalanceKsh -= costKsh;
    wallet.unlockedRooms.push(params.roomId);

    const tokensAwarded = calculatePurchaseTokens(costKsh);
    let transaction: TokenLedgerTransaction | null = null;
    let mintedTokenIds: string[] = [];

    if (tokensAwarded > 0) {
      const minted = mintTokensAndRecordLedger(state, {
        userUid: canonicalUid,
        quantity: tokensAwarded,
        source: 'PURCHASE',
        txType: 'PURCHASE',
        reason: `Purchase Reward: Unlocked ${params.roomName || params.roomId} (KSh ${costKsh} spent)`,
        referenceId: `wallet-unlock:${params.roomId}`,
        idempotencyKey,
        actorId: canonicalUid,
      });
      transaction = minted.transaction;
      mintedTokenIds = minted.mintedTokens.map((t) => t.tokenId);
    }

    state.idempotencyMap[idempotencyKey] = {
      transactionId: transaction?.transactionId || `unlock_${params.roomId}`,
      createdAt: new Date().toISOString(),
      responseSnapshot: { roomId: params.roomId, tokensAwarded },
    };

    saveEconomyState();

    return {
      success: true,
      idempotentReplay: false,
      tokensAwarded,
      mintedTokenIds,
      transaction,
      wallet: buildFormattedWalletResponse(state, wallet),
    };
  });
}

/**
 * 6. PAYMENT REVERSAL / REFUND COMPENSATING TRANSACTION
 *
 * Handles payment reversals, refunds, and chargebacks without editing historical ledger records.
 * Consumes the tokens awarded by the original payment (or active tokens up to the reversal amount)
 * and appends an immutable `REVERSAL` or `REFUND` compensating transaction.
 */
export async function reverseOrRefundPurchasePayment(params: {
  code: string;
  type?: 'REVERSAL' | 'REFUND';
  reason: string;
  actorId: string;
}): Promise<{
  success: boolean;
  error?: string;
  statusCode?: number;
  transaction?: TokenLedgerTransaction | null;
  consumedTokenIds?: string[];
  wallet?: FormattedWalletResponse;
}> {
  const cleanCode = String(params.code || '').trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, error: 'Payment confirmation code is required for reversal.', statusCode: 400 };
  }
  if (!params.reason || !params.reason.trim()) {
    return { success: false, error: 'A recorded reason is required for payment reversal/refund.', statusCode: 400 };
  }

  const state = loadEconomyState();
  const payment = state.verifiedPayments[cleanCode];
  if (!payment) {
    return { success: false, error: `Verified payment '${cleanCode}' not found.`, statusCode: 404 };
  }

  return withAtomicLock(payment.userUid, () => {
    if (payment.reversed) {
      return {
        success: false,
        error: `Payment '${cleanCode}' has already been reversed.`,
        statusCode: 409,
      };
    }

    const wallet = getOrCreateUserWallet(state, payment.userUid);
    const txType = params.type === 'REFUND' ? 'REFUND' : 'REVERSAL';
    const idempotencyKey = `${txType.toLowerCase()}:payment:${cleanCode}`;

    let transaction: TokenLedgerTransaction | null = null;
    let consumedTokenIds: string[] = [];

    // Deduct tokens that were awarded by this payment if any are still active
    const tokensToDebit = Math.min(payment.tokensAwarded, wallet.activeTokenIds.length);
    if (tokensToDebit > 0) {
      // Prefer consuming the exact token IDs minted by this purchase if still active
      const stillActiveFromPurchase = payment.mintedTokenIds.filter(
        (id) => state.tokenUnits[id]?.status === 'ACTIVE' && state.tokenUnits[id]?.ownerUid === wallet.userUid
      );
      const specificIds =
        stillActiveFromPurchase.length === tokensToDebit ? stillActiveFromPurchase : undefined;

      const consumed = consumeTokensAndRecordLedger(state, {
        userUid: wallet.userUid,
        quantity: tokensToDebit,
        txType,
        source: 'PAYMENT_REVERSAL',
        reason: `${txType}: Payment ${cleanCode} (${params.reason.trim()})`,
        referenceId: cleanCode,
        idempotencyKey,
        actorId: params.actorId,
        specificTokenIds: specificIds,
      });
      transaction = consumed.transaction;
      consumedTokenIds = consumed.consumedTokens.map((t) => t.tokenId);
    }

    // Deduct fiat wallet balance if it was a top-up
    if (payment.purpose === 'wallet-topup' || payment.purpose === 'profile-deposit') {
      wallet.walletBalanceKsh = Math.max(0, wallet.walletBalanceKsh - payment.amountKsh);
    } else {
      wallet.unlockedRooms = wallet.unlockedRooms.filter((r) => r !== payment.purpose);
    }

    payment.reversed = true;
    payment.reversedAt = new Date().toISOString();
    payment.reversalTransactionId = transaction?.transactionId || null;
    payment.reversalReason = params.reason.trim();

    saveEconomyState();

    return {
      success: true,
      transaction,
      consumedTokenIds,
      wallet: buildFormattedWalletResponse(state, wallet),
    };
  });
}

/**
 * 7. SERVER-VERIFIED REFERRAL QUALIFICATION & REMAINDER-PRESERVING REWARDS
 *
 * Official Rate: 3 qualifying successful invitations = 1 Mshindi Token.
 * Preserves remainders (1 or 2 invitations) toward the next token.
 * Prevents self-referrals, duplicate referral claims, unverified registrations, and replay attacks.
 */
export async function recordQualifyingReferral(params: {
  referrerIdentifier: string; // Referrer username or UID
  referredUid: string; // Canonical phone/UID of newly registered user
  referredUsername: string;
  referredPinHash?: string;
  isVerifiedRegistration?: boolean; // Must be true for legitimate registration
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  idempotentReplay?: boolean;
  error?: string;
  statusCode?: number;
  tokensAwarded?: number;
  mintedTokenIds?: string[];
  totalQualifyingReferrals?: number;
  referralProgressRemainder?: number;
  referralsNeededForNextToken?: number;
  transaction?: TokenLedgerTransaction | null;
  referrerWallet?: FormattedWalletResponse;
}> {
  const referredUid = normalizeCanonicalUid(params.referredUid);
  const referredUsername = (params.referredUsername || '').trim();
  const rawReferrer = (params.referrerIdentifier || '').trim();

  if (!referredUid || !referredUsername || !rawReferrer) {
    return {
      success: false,
      error: 'referrerIdentifier, referredUid, and referredUsername are required.',
      statusCode: 400,
    };
  }

  // Reject fake or incomplete/unverified registrations
  if (params.isVerifiedRegistration === false) {
    return {
      success: false,
      error: 'Incomplete or unverified registrations do not qualify for referral rewards.',
      statusCode: 400,
    };
  }

  const state = loadEconomyState();

  // Resolve referrer canonical UID from username or phone
  const lowerRef = rawReferrer.replace(/^@/, '').toLowerCase();
  const resolvedReferrerUid =
    state.usernameToUid[lowerRef] ||
    normalizeCanonicalUid(rawReferrer) ||
    `ref_${lowerRef.replace(/[^a-z0-9]/g, '')}`;

  // 1. Prevent self-referrals (by UID, normalized phone, or username)
  if (
    resolvedReferrerUid === referredUid ||
    lowerRef === referredUsername.toLowerCase() ||
    normalizeCanonicalUid(rawReferrer) === referredUid
  ) {
    return {
      success: false,
      error: 'Self-referrals are not permitted.',
      statusCode: 400,
    };
  }

  return withAtomicLock(resolvedReferrerUid, () => {
    // Ensure the referred user's own wallet/account is registered on the server
    getOrCreateUserWallet(state, referredUid, referredUsername, params.referredPinHash);

    // 2. Prevent duplicate referral claims or repeated rewards for the same referred user
    const existingRef = state.referredUsers[referredUid];
    if (existingRef) {
      return {
        success: false,
        idempotentReplay: true,
        error: `User '${referredUsername}' has already been counted as a referral.`,
        statusCode: 409,
      };
    }

    const idempotencyKey =
      params.idempotencyKey?.trim() || `referral:${resolvedReferrerUid}:${referredUid}`;

    if (state.idempotencyMap[idempotencyKey]) {
      return {
        success: false,
        idempotentReplay: true,
        error: 'Duplicate referral event.',
        statusCode: 409,
      };
    }

    const referrerWallet = getOrCreateUserWallet(
      state,
      resolvedReferrerUid,
      state.wallets[resolvedReferrerUid]?.username || rawReferrer.replace(/^@/, '')
    );

    if (referrerWallet.qualifyingReferrals.includes(referredUid)) {
      return {
        success: false,
        idempotentReplay: true,
        error: 'Referred user is already recorded for this referrer.',
        statusCode: 409,
      };
    }

    // 3. Record qualifying invitation and calculate milestone progress
    referrerWallet.qualifyingReferrals.push(referredUid);
    const milestones = calculateReferralMilestones(referrerWallet.qualifyingReferrals.length);

    const tokensToAwardNow = Math.max(
      0,
      milestones.totalTokensEarned - referrerWallet.referralTokensAwardedCount
    );

    referrerWallet.totalQualifyingReferrals = milestones.totalQualifyingReferrals;
    referrerWallet.referralProgressRemainder = milestones.remainderProgress;
    referrerWallet.referralsNeededForNextToken = milestones.referralsNeededForNextToken;

    let transaction: TokenLedgerTransaction | null = null;
    let mintedTokenIds: string[] = [];

    if (tokensToAwardNow > 0) {
      referrerWallet.referralTokensAwardedCount += tokensToAwardNow;

      const minted = mintTokensAndRecordLedger(state, {
        userUid: referrerWallet.userUid,
        username: referrerWallet.username,
        quantity: tokensToAwardNow,
        source: 'REFERRAL',
        txType: 'REFERRAL_REWARD',
        reason: `Referral Milestone Reward: ${milestones.totalQualifyingReferrals} qualifying invitations completed (@${referredUsername})`,
        referenceId: idempotencyKey,
        idempotencyKey,
        actorId: 'SYSTEM_REFERRAL_VERIFIER',
      });
      transaction = minted.transaction;
      mintedTokenIds = minted.mintedTokens.map((t) => t.tokenId);
    }

    const now = new Date().toISOString();
    const refRecord: VerifiedReferralRecord = {
      referralId: `ref_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
      referrerUid: referrerWallet.userUid,
      referrerUsername: referrerWallet.username,
      referredUid,
      referredUsername,
      verifiedAt: now,
      qualifyingSequenceNumber: milestones.totalQualifyingReferrals,
      awardedTransactionId: transaction?.transactionId || null,
    };

    state.referredUsers[referredUid] = refRecord;
    state.idempotencyMap[idempotencyKey] = {
      transactionId: transaction?.transactionId || refRecord.referralId,
      createdAt: now,
      responseSnapshot: refRecord,
    };

    saveEconomyState();

    return {
      success: true,
      idempotentReplay: false,
      tokensAwarded: tokensToAwardNow,
      mintedTokenIds,
      totalQualifyingReferrals: referrerWallet.totalQualifyingReferrals,
      referralProgressRemainder: referrerWallet.referralProgressRemainder,
      referralsNeededForNextToken: referrerWallet.referralsNeededForNextToken,
      transaction,
      referrerWallet: buildFormattedWalletResponse(state, referrerWallet),
    };
  });
}

/**
 * 8. AUTHORIZED ADMINISTRATOR TOKEN ADJUSTMENT (CREDIT / DEBIT)
 *
 * Requires verified administrator privileges (`0743304579`).
 * Requires a non-empty recorded reason.
 * Generates an auditable `ADMIN_CREDIT` or `ADMIN_DEBIT` transaction in the ledger.
 * Never rewrites historical transactions.
 */
export async function executeAdminTokenAdjustment(params: {
  headers?: Record<string, string | string[] | undefined>;
  body?: any;
  targetUserUid: string;
  targetUsername?: string;
  adjustmentType: 'ADMIN_CREDIT' | 'ADMIN_DEBIT';
  quantity: number;
  reason: string;
  idempotencyKey?: string;
}): Promise<{
  success: boolean;
  error?: string;
  statusCode?: number;
  transaction?: TokenLedgerTransaction;
  affectedTokenIds?: string[];
  wallet?: FormattedWalletResponse;
}> {
  const authCheck = verifyAdminRequest(params.headers, params.body);
  if (!authCheck.authorized) {
    return {
      success: false,
      error: authCheck.reason || 'Forbidden: Verified administrator privileges required.',
      statusCode: 403,
    };
  }

  const targetUid = normalizeCanonicalUid(params.targetUserUid);
  if (!targetUid) {
    return { success: false, error: 'Valid targetUserUid is required.', statusCode: 400 };
  }

  const quantity = Number(params.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, error: 'Adjustment quantity must be a positive integer.', statusCode: 400 };
  }

  const reason = (params.reason || '').trim();
  if (reason.length < 3) {
    return {
      success: false,
      error: 'A recorded administrative reason (min 3 characters) is required for all token adjustments.',
      statusCode: 400,
    };
  }

  return withAtomicLock(targetUid, () => {
    const state = loadEconomyState();
    const idempotencyKey =
      params.idempotencyKey?.trim() ||
      `admin:${params.adjustmentType.toLowerCase()}:${targetUid}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;

    if (state.idempotencyMap[idempotencyKey]) {
      const prev = state.idempotencyMap[idempotencyKey];
      const existingTx = state.ledger.find((tx) => tx.transactionId === prev.transactionId);
      const wallet = getOrCreateUserWallet(state, targetUid, params.targetUsername);
      return {
        success: true,
        transaction: existingTx,
        affectedTokenIds: existingTx?.tokenIds || [],
        wallet: buildFormattedWalletResponse(state, wallet),
      };
    }

    const adminActorId = `ADMIN:${ADMIN_PHONE_NORMALIZED}`;

    if (params.adjustmentType === 'ADMIN_CREDIT') {
      const { transaction, mintedTokens, wallet } = mintTokensAndRecordLedger(state, {
        userUid: targetUid,
        username: params.targetUsername,
        quantity,
        source: 'ADMIN',
        txType: 'ADMIN_CREDIT',
        reason: `Admin Credit: ${reason}`,
        referenceId: `admin-credit:${targetUid}`,
        idempotencyKey,
        actorId: adminActorId,
      });

      state.idempotencyMap[idempotencyKey] = {
        transactionId: transaction.transactionId,
        createdAt: transaction.timestamp,
        responseSnapshot: { tokenIds: mintedTokens.map((t) => t.tokenId) },
      };

      saveEconomyState();
      return {
        success: true,
        transaction,
        affectedTokenIds: mintedTokens.map((t) => t.tokenId),
        wallet: buildFormattedWalletResponse(state, wallet),
      };
    } else {
      try {
        const { transaction, consumedTokens, wallet } = consumeTokensAndRecordLedger(state, {
          userUid: targetUid,
          quantity,
          txType: 'ADMIN_DEBIT',
          source: 'ADMIN',
          reason: `Admin Debit: ${reason}`,
          referenceId: `admin-debit:${targetUid}`,
          idempotencyKey,
          actorId: adminActorId,
        });

        state.idempotencyMap[idempotencyKey] = {
          transactionId: transaction.transactionId,
          createdAt: transaction.timestamp,
          responseSnapshot: { tokenIds: consumedTokens.map((t) => t.tokenId) },
        };

        saveEconomyState();
        return {
          success: true,
          transaction,
          affectedTokenIds: consumedTokens.map((t) => t.tokenId),
          wallet: buildFormattedWalletResponse(state, wallet),
        };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Admin debit failed.',
          statusCode: 400,
        };
      }
    }
  });
}

/**
 * 9. EXPLICIT SECURITY REJECTION FOR UNAUTHORIZED CLIENT OPERATIONS
 *
 * Rejects any attempt by a client to directly set balances, manufacture token IDs,
 * reactivate consumed tokens, reassign ownership, or mutate ledger history.
 */
export function rejectUnauthorizedClientTokenMutation(operation: string): {
  success: false;
  error: string;
  statusCode: number;
} {
  return {
    success: false,
    error: `SECURITY_VIOLATION: Client-side '${operation}' is strictly forbidden. The server is the sole authority over Mshindi Tokens.`,
    statusCode: 403,
  };
}

/**
 * Inspects a specific token unit by its permanent ID (`mt_...`).
 */
export function inspectTokenUnit(tokenId: string): MshindiTokenUnit | null {
  const state = loadEconomyState();
  const unit = state.tokenUnits[tokenId];
  return unit ? { ...unit } : null;
}

/**
 * Returns a full read-only snapshot of a user's ledger and token units for auditing/verification.
 */
export function getAuditSnapshotForUser(userUid: string): {
  wallet: UserTokenWalletRecord | null;
  activeTokens: MshindiTokenUnit[];
  consumedTokens: MshindiTokenUnit[];
  ledgerTransactions: TokenLedgerTransaction[];
  migrationRecord: TokenMigrationAuditRecord | null;
} {
  const state = loadEconomyState();
  const canonicalUid = normalizeCanonicalUid(userUid);
  const wallet = state.wallets[canonicalUid] || null;
  if (!wallet) {
    return {
      wallet: null,
      activeTokens: [],
      consumedTokens: [],
      ledgerTransactions: [],
      migrationRecord: null,
    };
  }

  return {
    wallet: JSON.parse(JSON.stringify(wallet)),
    activeTokens: wallet.activeTokenIds.map((id) => ({ ...state.tokenUnits[id] })).filter(Boolean),
    consumedTokens: wallet.consumedTokenIds.map((id) => ({ ...state.tokenUnits[id] })).filter(Boolean),
    ledgerTransactions: state.ledger.filter((tx) => tx.userUid === canonicalUid),
    migrationRecord: state.migrations[canonicalUid] || null,
  };
}

/**
 * Unified HTTP request handler for `/api/tokens/*` and `/api/mpesa/verify-code`
 * shared across Express (`server.ts`) and Vercel Serverless Functions (`api/tokens.ts`).
 */
export async function handleTokenEconomyHttpRequest(params: {
  method: string;
  pathname: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, any>;
  body: any;
}): Promise<{ statusCode: number; payload: any }> {
  const method = (params.method || 'GET').toUpperCase();
  const pathname = (params.pathname || '').replace(/\/+$/, '');
  const headers = params.headers || {};
  const query = params.query || {};
  const body = params.body || {};

  // Explicitly block any unauthorized client attempt to directly mutate balances, token IDs, or ledger history
  const action = String(body.action || query.action || '').trim().toLowerCase();
  if (
    [
      'set-balance',
      'create-token',
      'reactivate-token',
      'edit-ledger',
      'delete-ledger',
      'transfer-ownership',
      'force-award',
    ].includes(action) ||
    pathname.endsWith('/set-balance') ||
    pathname.endsWith('/create-token') ||
    pathname.endsWith('/reactivate-token') ||
    pathname.endsWith('/edit-ledger')
  ) {
    const rejected = rejectUnauthorizedClientTokenMutation(action || pathname);
    return { statusCode: rejected.statusCode, payload: rejected };
  }

  // Reject any request where the client attempts to supply forged token counts or arbitrary balance overrides
  if (
    typeof body.overrideBalance !== 'undefined' ||
    typeof body.forgedTokens !== 'undefined' ||
    typeof body.manufactureTokenIds !== 'undefined'
  ) {
    const rejected = rejectUnauthorizedClientTokenMutation('client_submitted_balance_or_token_override');
    return { statusCode: rejected.statusCode, payload: rejected };
  }

  // 1. M-PESA VERIFY CODE / PURCHASE ENDPOINT (`/api/mpesa/verify-code` or `action === 'purchase'`)
  if (pathname.endsWith('/api/mpesa/verify-code') || pathname.endsWith('/purchase') || action === 'purchase') {
    if (method !== 'POST') {
      return { statusCode: 405, payload: { success: false, error: 'Method not allowed' } };
    }

    const userUid = normalizeCanonicalUid(
      body.userUid || body.uid || body.userId || body.phone || (headers['x-user-uid'] as string)
    );
    const result = await processVerifiedPurchasePayment({
      userUid: userUid || 'guest_verified',
      username: body.username,
      code: body.code,
      amountKsh: Number(body.amount ?? body.amountKsh ?? 10),
      purpose: body.purpose || body.roomId || 'wallet-topup',
      roomId: body.roomId,
      roomName: body.roomName,
      paymentConfirmed: body.paymentConfirmed !== false,
      idempotencyKey: body.idempotencyKey,
    });

    return {
      statusCode: result.statusCode || (result.success ? 200 : 400),
      payload: {
        ...result,
        amount: result.amountKsh,
        message: result.success
          ? result.tokensAwarded && result.tokensAwarded > 0
            ? `Payment verified. Awarded +${result.tokensAwarded} Mshindi Token${result.tokensAwarded === 1 ? '' : 's'}!`
            : 'Payment verified successfully.'
          : result.error,
      },
    };
  }

  // 2. WALLET SYNC & SAFE MIGRATION (`/api/tokens/wallet` or `/api/tokens/migrate` or GET `/api/tokens`)
  if (
    method === 'GET' ||
    pathname.endsWith('/wallet') ||
    pathname.endsWith('/migrate') ||
    action === 'wallet' ||
    action === 'migrate'
  ) {
    const userUid = normalizeCanonicalUid(
      body.userUid ||
      body.uid ||
      body.userId ||
      body.phone ||
      query.userUid ||
      query.uid ||
      query.userId ||
      query.phone ||
      (headers['x-user-uid'] as string)
    );
    if (!userUid) {
      return {
        statusCode: 400,
        payload: { success: false, error: 'userUid (or phone) is required to retrieve wallet state.' },
      };
    }

    // If the user has existing unmigrated balance data, run idempotent migration first
    if (
      action === 'migrate' ||
      pathname.endsWith('/migrate') ||
      typeof body.legacyBalance === 'number'
    ) {
      const migResult = await migrateUserTokenBalance({
        userUid,
        username: body.username || query.username,
        pinHash: body.pinHash || (headers['x-user-pin-hash'] as string),
        legacyBalance: body.legacyBalance,
        legacyTokenTransactions: body.legacyTokenTransactions,
        legacyWalletBalanceKsh: body.legacyWalletBalanceKsh,
        legacyUnlockedRooms: body.legacyUnlockedRooms,
        legacyRedeemedCodes: body.legacyRedeemedCodes,
        legacyTotalReferrals: body.legacyTotalReferrals,
      });
      return {
        statusCode: 200,
        payload: {
          success: true,
          alreadyMigrated: migResult.alreadyMigrated,
          migrationRecord: migResult.migrationRecord,
          wallet: migResult.wallet,
        },
      };
    }

    const wallet = await getAuthoritativeUserWallet({
      userUid,
      username: body.username || query.username,
      pinHash: body.pinHash || (headers['x-user-pin-hash'] as string),
    });

    return {
      statusCode: 200,
      payload: {
        success: true,
        wallet,
      },
    };
  }

  // 3. SPEND / ROOM REDEMPTION (`/api/tokens/spend` or `action === 'spend'`)
  if (pathname.endsWith('/spend') || action === 'spend') {
    const authCheck = authenticateTokenRequest(headers, body);
    if (!authCheck.authenticated || !authCheck.userUid) {
      return {
        statusCode: authCheck.statusCode || 401,
        payload: { success: false, error: authCheck.error || 'Unauthorized token spend request.' },
      };
    }

    const spendRes = await spendAuthoritativeTokens({
      userUid: authCheck.userUid,
      quantity: Number(body.quantity ?? body.tokenCost ?? DEFAULT_ROOM_UNLOCK_TOKEN_COST),
      roomId: body.roomId,
      roomName: body.roomName,
      reason: body.reason,
      idempotencyKey: body.idempotencyKey,
      specificTokenIds: body.specificTokenIds,
    });

    return {
      statusCode: spendRes.statusCode || (spendRes.success ? 200 : 400),
      payload: spendRes,
    };
  }

  // 4. UNLOCK ROOM WITH WALLET BALANCE (`/api/tokens/unlock-with-balance` or `action === 'unlock-with-balance'`)
  if (pathname.endsWith('/unlock-with-balance') || action === 'unlock-with-balance') {
    const authCheck = authenticateTokenRequest(headers, body);
    if (!authCheck.authenticated || !authCheck.userUid) {
      return {
        statusCode: authCheck.statusCode || 401,
        payload: { success: false, error: authCheck.error || 'Unauthorized wallet unlock request.' },
      };
    }

    const unlockRes = await unlockRoomWithWalletBalanceServer({
      userUid: authCheck.userUid,
      roomId: String(body.roomId || ''),
      roomName: body.roomName,
      costKsh: Number(body.costKsh ?? body.cost ?? 10),
      idempotencyKey: body.idempotencyKey,
    });

    return {
      statusCode: unlockRes.statusCode || (unlockRes.success ? 200 : 400),
      payload: unlockRes,
    };
  }

  // 5. REFERRAL QUALIFICATION (`/api/tokens/referral` or `action === 'referral'`)
  if (pathname.endsWith('/referral') || action === 'referral') {
    const refRes = await recordQualifyingReferral({
      referrerIdentifier: String(body.referrerIdentifier || body.referrerName || body.refCode || ''),
      referredUid: String(body.referredUid || body.newUserPhone || body.phone || ''),
      referredUsername: String(body.referredUsername || body.newUserName || body.username || ''),
      referredPinHash: body.referredPinHash || body.pinHash,
      isVerifiedRegistration: body.isVerifiedRegistration !== false,
      idempotencyKey: body.idempotencyKey,
    });

    return {
      statusCode: refRes.statusCode || (refRes.success ? 200 : 400),
      payload: refRes,
    };
  }

  // 6. ADMIN ADJUSTMENT / PAYMENT REVERSAL (`/api/tokens/admin` or `action === 'admin-adjust' | 'reversal'`)
  if (
    pathname.endsWith('/admin') ||
    pathname.endsWith('/admin/adjust') ||
    pathname.endsWith('/reverse-payment') ||
    action === 'admin-adjust' ||
    action === 'reversal' ||
    action === 'refund'
  ) {
    if (action === 'reversal' || action === 'refund' || pathname.endsWith('/reverse-payment')) {
      const adminAuth = verifyAdminRequest(headers, body);
      if (!adminAuth.authorized) {
        return {
          statusCode: 403,
          payload: { success: false, error: adminAuth.reason || 'Forbidden: Admin privileges required.' },
        };
      }
      const revRes = await reverseOrRefundPurchasePayment({
        code: String(body.code || ''),
        type: action === 'refund' || body.type === 'REFUND' ? 'REFUND' : 'REVERSAL',
        reason: String(body.reason || ''),
        actorId: `ADMIN:${ADMIN_PHONE_NORMALIZED}`,
      });
      return {
        statusCode: revRes.statusCode || (revRes.success ? 200 : 400),
        payload: revRes,
      };
    }

    const adjRes = await executeAdminTokenAdjustment({
      headers,
      body,
      targetUserUid: String(body.targetUserUid || body.userUid || ''),
      targetUsername: body.targetUsername,
      adjustmentType: body.adjustmentType === 'ADMIN_DEBIT' ? 'ADMIN_DEBIT' : 'ADMIN_CREDIT',
      quantity: Number(body.quantity || 0),
      reason: String(body.reason || ''),
      idempotencyKey: body.idempotencyKey,
    });

    return {
      statusCode: adjRes.statusCode || (adjRes.success ? 200 : 400),
      payload: adjRes,
    };
  }

  return {
    statusCode: 400,
    payload: { success: false, error: `Unsupported token economy action or route: ${pathname}` },
  };
}
