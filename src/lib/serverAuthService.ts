/**
 * MshindiRoom Authoritative Server-Side Authentication & Session Service
 *
 * Security invariants enforced:
 * 1. PIN credentials are salted (16-byte CSPRNG salt) and hashed exclusively on the
 *    server using Node `crypto.scryptSync` (N=16384, r=8, p=1) with `timingSafeEqual`.
 * 2. Client-side PIN hashes (`x-user-pin-hash`), plaintext PINs, and client-asserted
 *    `verifiedWithSms` / `role` claims are strictly rejected.
 * 3. Active sessions use signed HMAC-SHA256 tokens (`utok.`) delivered both in an
 *    `HttpOnly; SameSite=Lax` cookie (`mshindi_user_session`) and for bearer/header sync.
 * 4. Brute-force protection rate-limits failed PIN verifications per normalized phone
 *    and client IP (429 Too Many Requests).
 * 5. Firestore (`authAccounts`) with Preview vs Production isolation + atomic disk
 *    fallback (`.data/auth_accounts.json` or `/tmp/.mshindi-data/auth_accounts.json`).
 * 6. Fail-closed on missing session signing secrets (`503`).
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  ADMIN_PHONE_NORMALIZED,
  normalizeAdminPhone,
  revokeAdminTokenAsync,
  verifyAdminRequestAsync,
} from './adminAuthService.js';
import {
  authenticateTokenRequestAsync,
  issueUserSessionToken,
  MAX_USER_TOKEN_TTL_MS,
  normalizeCanonicalUid,
  verifyUserSessionTokenAsync,
  revokeUserSessionTokenAsync,
} from './serverTokenEconomy.js';
import { extractTrustedClientIp } from './rateLimitService.js';
import { recordSecurityEvent } from './securityAuditLogger.js';
import {
  ADMIN_SESSION_COOKIE_NAME,
  buildClearCookieHeader,
  buildSessionCookieHeader,
  getCookieFromHeaders,
  USER_SESSION_COOKIE_NAME,
  verifyFirebaseIdTokenServer,
} from './firebaseIdTokenVerifier.js';
import {
  getAdminFirestore,
  resetFirebaseAdminForTests,
  resolveScopedServiceAccountRaw,
} from './serverFirebaseAdmin.js';
import {
  isValidKenyanPhone as sharedIsValidKenyanPhone,
  normalizeKenyanPhone,
} from './phoneUtils.js';
import { isValidUsernameFormat as sharedIsValidUsernameFormat } from './usernameUtils.js';

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

const AUTH_COLLECTION = 'authAccounts';
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

const MAX_FAILED_PIN_ATTEMPTS = 5;
const MAX_IP_FAILED_ATTEMPTS = 15;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export interface ServerAccountRecord {
  phone: string; // canonical 2547XXXXXXXX / 2541XXXXXXXX
  username: string;
  usernameLower: string;
  pinScryptHash: string;
  avatarId: string;
  role: 'user' | 'admin';
  firebaseUid: string | null;
  verifiedWithSms: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface SanitizedUserAccount {
  phone: string;
  username: string;
  avatarId: string;
  role: 'user' | 'admin';
  verifiedWithSms: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface PublicPunterEntry {
  username: string;
  avatarId: string;
  verifiedWithSms: boolean;
}

export interface AuthHttpResponse {
  statusCode: number;
  payload: Record<string, any>;
  setCookies?: string[];
  headers?: Record<string, string>;
}

interface AuthDatabaseShape {
  accounts: Record<string, ServerAccountRecord>;
}

interface RateLimitEntry {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number;
}

// ============================================================================
// STATE & LOCKS
// ============================================================================

const phoneFailureMap = new Map<string, RateLimitEntry>();
const ipFailureMap = new Map<string, RateLimitEntry>();
let authMutexTail: Promise<void> = Promise.resolve();
let memoryAuthDb: AuthDatabaseShape | null = null;

function withAuthMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = authMutexTail.then(fn, fn);
  authMutexTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// ============================================================================
// VALIDATION & NORMALIZATION
// ============================================================================

export function isUserSessionSecretConfigured(): boolean {
  const secret = (
    process.env.USER_TOKEN_SECRET ||
    process.env.USER_SESSION_SECRET ||
    process.env.ADMIN_TOKEN_SECRET ||
    ''
  ).trim();
  return secret.length > 0;
}

export function normalizePhoneDigits(raw?: string | null): string {
  const digits = normalizeKenyanPhone(raw);
  if (digits) return digits;
  return raw ? normalizeCanonicalUid(String(raw)) : '';
}

export function isValidKenyanPhone(phone: string): boolean {
  return sharedIsValidKenyanPhone(phone);
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4}$/.test(String(pin || '').trim());
}

export function isValidUsernameFormat(username: string): boolean {
  return sharedIsValidUsernameFormat(username);
}

// ============================================================================
// SCRYPT PASSWORD / PIN HASHING
// ============================================================================

export function hashPinScrypt(pin: string): string {
  const cleanPin = String(pin || '').trim();
  if (!isValidPinFormat(cleanPin)) {
    throw new Error('PIN must be exactly 4 digits.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto
    .scryptSync(cleanPin, salt, SCRYPT_KEYLEN, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    })
    .toString('hex');
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived}`;
}

export function verifyPinScrypt(pin: string, storedHash?: string | null): boolean {
  try {
    const cleanPin = String(pin || '').trim();
    if (!cleanPin || !storedHash) return false;
    const parts = String(storedHash).split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = parts[4];
    const expectedHex = parts[5];
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !expectedHex) {
      return false;
    }

    const expectedBuf = Buffer.from(expectedHex, 'hex');
    const derivedBuf = crypto.scryptSync(cleanPin, salt, expectedBuf.length, { N, r, p });
    if (derivedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derivedBuf, expectedBuf);
  } catch {
    return false;
  }
}

// ============================================================================
// BRUTE-FORCE RATE LIMITER
// ============================================================================

function getHeaderValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string {
  if (!headers) return '';
  const val = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(val)) return val[0] || '';
  return typeof val === 'string' ? val : '';
}

function resolveClientIp(headers?: Record<string, string | string[] | undefined>): string {
  return extractTrustedClientIp(headers);
}

function checkRateLimitMap(
  map: Map<string, RateLimitEntry>,
  key: string,
  nowMs: number
): { blocked: boolean; retryAfterSeconds: number } {
  const entry = map.get(key);
  if (!entry) return { blocked: false, retryAfterSeconds: 0 };

  if (entry.lockedUntil > nowMs) {
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil - nowMs) / 1000)),
    };
  }

  if (nowMs - entry.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    map.delete(key);
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

function recordFailureInMap(
  map: Map<string, RateLimitEntry>,
  key: string,
  maxAttempts: number,
  nowMs: number
): void {
  const existing = map.get(key);
  if (!existing || nowMs - existing.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    map.set(key, {
      count: 1,
      firstAttemptAt: nowMs,
      lockedUntil: 0,
    });
    return;
  }

  existing.count += 1;
  if (existing.count >= maxAttempts) {
    existing.lockedUntil = nowMs + LOCKOUT_DURATION_MS;
  }
  map.set(key, existing);
}

function checkPinBruteForce(
  phone: string,
  ip: string
): { blocked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const phoneCheck = checkRateLimitMap(phoneFailureMap, phone, now);
  if (phoneCheck.blocked) return phoneCheck;
  if (ip && ip !== 'unknown') {
    const ipCheck = checkRateLimitMap(ipFailureMap, ip, now);
    if (ipCheck.blocked) return ipCheck;
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

function recordPinFailure(phone: string, ip: string): void {
  const now = Date.now();
  if (phone) {
    recordFailureInMap(phoneFailureMap, phone, MAX_FAILED_PIN_ATTEMPTS, now);
  }
  if (ip && ip !== 'unknown') {
    recordFailureInMap(ipFailureMap, ip, MAX_IP_FAILED_ATTEMPTS, now);
  }
}

function clearPinFailures(phone: string): void {
  if (phone) phoneFailureMap.delete(phone);
}

export function resetAuthRateLimitsForTests(): void {
  phoneFailureMap.clear();
  ipFailureMap.clear();
  memoryAuthDb = null;
  resetFirebaseAdminForTests();
}

// ============================================================================
// PERSISTENCE STORE (FIRESTORE + ATOMIC LOCAL DISK FALLBACK)
// ============================================================================

function getAuthStorageFilePath(): string {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const dir = isServerless
    ? path.join(os.tmpdir(), '.mshindi-data')
    : path.join(process.cwd(), '.data');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {}
  return path.join(dir, 'auth_accounts.json');
}

function readDiskAuthDb(): AuthDatabaseShape {
  if (memoryAuthDb) return memoryAuthDb;
  const filePath = getAuthStorageFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.accounts === 'object' && parsed.accounts !== null) {
          memoryAuthDb = { accounts: { ...parsed.accounts } };
          return memoryAuthDb;
        }
      }
    }
  } catch {}
  memoryAuthDb = { accounts: {} };
  return memoryAuthDb;
}

function writeDiskAuthDb(db: AuthDatabaseShape): void {
  memoryAuthDb = db;
  const filePath = getAuthStorageFilePath();
  try {
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    console.warn('[ServerAuth] Failed to persist auth database to disk:', err);
  }
}

async function getAuthFirestoreDb(): Promise<any | null> {
  if (!resolveScopedServiceAccountRaw()) {
    return null;
  }
  return getAdminFirestore({ allowAdc: false });
}

const DIRECTORY_CACHE_TTL_MS = 60_000;
let cachedPublicDirectory: PublicPunterEntry[] | null = null;
let cachedPublicDirectoryExpiresAt = 0;

export function clearServerAuthCacheForTests(): void {
  cachedPublicDirectory = null;
  cachedPublicDirectoryExpiresAt = 0;
}

function invalidatePublicDirectoryCache(): void {
  cachedPublicDirectory = null;
  cachedPublicDirectoryExpiresAt = 0;
}

async function findAccountByUsername(username: string): Promise<ServerAccountRecord | null> {
  const lower = String(username || '').trim().toLowerCase();
  if (!lower) return null;

  const disk = readDiskAuthDb();
  const localMatch = Object.values(disk.accounts).find((acc) => acc.usernameLower === lower);
  if (localMatch) {
    return localMatch;
  }

  const fsDb = await getAuthFirestoreDb();
  if (fsDb) {
    try {
      const snap = await fsDb
        .collection(AUTH_COLLECTION)
        .where('usernameLower', '==', lower)
        .limit(1)
        .get();
      if (!snap.empty) {
        const data = snap.docs[0].data() as ServerAccountRecord;
        if (data && typeof data.phone === 'string') {
          disk.accounts[data.phone] = data;
          return data;
        }
      }
    } catch {}
  }

  return null;
}

async function loadPublicPunterDirectory(): Promise<PublicPunterEntry[]> {
  const now = Date.now();
  if (cachedPublicDirectory && now < cachedPublicDirectoryExpiresAt) {
    return cachedPublicDirectory;
  }

  const map = new Map<string, PublicPunterEntry>();
  const disk = readDiskAuthDb();
  for (const acc of Object.values(disk.accounts)) {
    if (acc?.username) {
      map.set(acc.username.toLowerCase(), {
        username: acc.username,
        avatarId: acc.avatarId || 'default',
        verifiedWithSms: Boolean(acc.verifiedWithSms),
      });
    }
  }

  const fsDb = await getAuthFirestoreDb();
  if (fsDb) {
    try {
      const col = fsDb.collection(AUTH_COLLECTION);
      const q = typeof col.select === 'function'
        ? col.select('username', 'avatarId', 'verifiedWithSms').limit(500)
        : col.limit(500);
      const snapshot = await q.get();
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        if (data && typeof data.username === 'string' && data.username.trim()) {
          map.set(data.username.toLowerCase(), {
            username: data.username,
            avatarId: data.avatarId || 'default',
            verifiedWithSms: Boolean(data.verifiedWithSms),
          });
        }
      });
    } catch (err) {
      console.warn('[ServerAuth] Public directory Firestore read fallback to local:', err);
    }
  }

  const entries = Array.from(map.values());
  cachedPublicDirectory = entries;
  cachedPublicDirectoryExpiresAt = Date.now() + DIRECTORY_CACHE_TTL_MS;
  return entries;
}

async function findAccountByPhone(phone: string): Promise<ServerAccountRecord | null> {
  const norm = normalizePhoneDigits(phone);
  if (!norm) return null;
  const disk = readDiskAuthDb();
  if (disk.accounts[norm]) {
    return disk.accounts[norm];
  }
  const fsDb = await getAuthFirestoreDb();
  if (fsDb) {
    try {
      const snap = await fsDb.collection(AUTH_COLLECTION).doc(norm).get();
      if (snap.exists) {
        const rec = snap.data() as ServerAccountRecord;
        disk.accounts[norm] = rec;
        writeDiskAuthDb(disk);
        return rec;
      }
    } catch {}
  }
  return null;
}

async function saveAccountRecord(record: ServerAccountRecord): Promise<void> {
  const disk = readDiskAuthDb();
  disk.accounts[record.phone] = record;
  writeDiskAuthDb(disk);
  invalidatePublicDirectoryCache();

  const fsDb = await getAuthFirestoreDb();
  if (fsDb) {
    try {
      await fsDb.collection(AUTH_COLLECTION).doc(record.phone).set(record, { merge: false });
    } catch (err) {
      console.warn('[ServerAuth] Firestore account write warning:', err);
    }
  }
}

async function deleteAccountRecord(phone: string): Promise<boolean> {
  const norm = normalizePhoneDigits(phone);
  if (!norm) return false;
  const disk = readDiskAuthDb();
  const existed = Boolean(disk.accounts[norm]);
  delete disk.accounts[norm];
  writeDiskAuthDb(disk);
  invalidatePublicDirectoryCache();

  const fsDb = await getAuthFirestoreDb();
  if (fsDb) {
    try {
      await fsDb.collection(AUTH_COLLECTION).doc(norm).delete();
    } catch (err) {
      console.warn('[ServerAuth] Firestore account delete warning:', err);
    }
  }
  return existed;
}

// ============================================================================
// PUBLIC SANITIZATION & TOKEN EXTRACTION HELPERS
// ============================================================================

export function sanitizeAccountForClient(record: ServerAccountRecord): SanitizedUserAccount {
  const isPlatformAdmin = normalizeAdminPhone(record.phone) === ADMIN_PHONE_NORMALIZED;
  return {
    phone: record.phone,
    username: record.username,
    avatarId: record.avatarId || 'default',
    role: isPlatformAdmin ? 'admin' : 'user',
    verifiedWithSms: Boolean(record.verifiedWithSms),
    createdAt: record.createdAt,
    ...(record.lastLoginAt ? { lastLoginAt: record.lastLoginAt } : {}),
  };
}

function extractUserTokenCandidate(
  headers?: Record<string, string | string[] | undefined>,
  body?: any
): string {
  const fromCookie = getCookieFromHeaders(headers, USER_SESSION_COOKIE_NAME);
  if (fromCookie) return fromCookie;

  const fromHeader = getHeaderValue(headers, 'x-user-token').trim();
  if (fromHeader) return fromHeader;

  const authHeader = getHeaderValue(headers, 'authorization').trim();
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.startsWith('utok.')) return bearer;
  }

  if (body && typeof body.userSessionToken === 'string') {
    return body.userSessionToken.trim();
  }
  return '';
}

function extractFirebaseTokenCandidate(
  headers?: Record<string, string | string[] | undefined>,
  body?: any
): string {
  const fromBody =
    body && typeof body.firebaseIdToken === 'string' ? body.firebaseIdToken.trim() : '';
  if (fromBody) return fromBody;

  const fromHeader = getHeaderValue(headers, 'x-firebase-id-token').trim();
  if (fromHeader) return fromHeader;

  const authHeader = getHeaderValue(headers, 'authorization').trim();
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.split('.').length === 3 && !bearer.startsWith('utok.')) {
      return bearer;
    }
  }
  return '';
}

function extractAdminTokenCandidate(
  headers?: Record<string, string | string[] | undefined>,
  body?: any
): string {
  const fromCookie = getCookieFromHeaders(headers, ADMIN_SESSION_COOKIE_NAME);
  if (fromCookie) return fromCookie;

  const fromHeader = getHeaderValue(headers, 'x-admin-token').trim();
  if (fromHeader) return fromHeader;

  if (body && typeof body.adminToken === 'string') {
    return body.adminToken.trim();
  }
  return '';
}

function buildCookieMaxAgeSeconds(): number {
  return Math.max(60, Math.floor(MAX_USER_TOKEN_TTL_MS / 1000));
}

// ============================================================================
// UNIFIED HTTP HANDLER FOR /api/auth/*
// ============================================================================

export async function handleAuthHttpRequest(params: {
  method: string;
  pathname: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, any>;
  body?: any;
  secureCookie?: boolean;
}): Promise<AuthHttpResponse> {
  const method = String(params.method || 'GET').toUpperCase();
  const pathname = String(params.pathname || '').split('?')[0].replace(/\/+$/, '').toLowerCase();
  const headers = params.headers || {};
  const query = params.query || {};
  const body = params.body && typeof params.body === 'object' ? params.body : {};
  const secureCookie = Boolean(params.secureCookie);
  const clientIp = resolveClientIp(headers);

  // 1. POST /api/auth/register
  if (pathname === '/api/auth/register') {
    if (method !== 'POST') {
      return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
    }
    if (!isUserSessionSecretConfigured()) {
      return {
        statusCode: 503,
        payload: {
          success: false,
          error: 'Authentication session service is not configured on the server.',
        },
      };
    }

    const normPhone = normalizePhoneDigits(body.phone);
    const pin = String(body.pin || '').trim();
    const cleanUsername = String(body.username || '').trim();
    const avatarId = String(body.avatarId || 'default').trim().slice(0, 64) || 'default';

    if (!isValidKenyanPhone(normPhone)) {
      return {
        statusCode: 400,
        payload: { success: false, error: 'Enter a valid Kenyan phone number (e.g. 0743 304 579).' },
      };
    }
    if (!isValidPinFormat(pin)) {
      return {
        statusCode: 400,
        payload: { success: false, error: 'PIN must be exactly 4 digits.' },
      };
    }
    if (!isValidUsernameFormat(cleanUsername)) {
      return {
        statusCode: 400,
        payload: {
          success: false,
          error: 'Username must be between 2 and 24 valid characters.',
        },
      };
    }

    // Verify optional Firebase Phone Auth proof (never trust client-asserted booleans)
    let verifiedWithSms = false;
    let firebaseUid: string | null = null;
    const firebaseToken = extractFirebaseTokenCandidate(headers, body);
    if (firebaseToken) {
      const fbCheck = await verifyFirebaseIdTokenServer(firebaseToken);
      if (!fbCheck.valid) {
        return {
          statusCode: 401,
          payload: { success: false, error: fbCheck.error || 'Invalid Firebase verification token.' },
        };
      }
      const tokenPhone = normalizePhoneDigits(fbCheck.phoneNumber);
      if (tokenPhone && tokenPhone !== normPhone) {
        return {
          statusCode: 403,
          payload: {
            success: false,
            error: 'Verified phone number does not match the registration phone number.',
          },
        };
      }
      if (tokenPhone === normPhone) {
        verifiedWithSms = true;
      }
      firebaseUid = fbCheck.uid || null;
    }

    // Reserved super-admin phone cannot be registered publicly without proof
    if (normalizeAdminPhone(normPhone) === ADMIN_PHONE_NORMALIZED) {
      const adminAuth = await verifyAdminRequestAsync(headers, body);
      if (!verifiedWithSms && !adminAuth.authorized) {
        return {
          statusCode: adminAuth.storeUnavailable ? 503 : 403,
          payload: {
            success: false,
            error:
              adminAuth.storeUnavailable
                ? adminAuth.reason || 'Session revocation store unavailable.'
                : 'Reserved platform administrator phone requires verified SMS OTP or server admin authorization.',
          },
        };
      }
    }

    return withAuthMutex(async () => {
      const [existingByPhone, existingByUsername] = await Promise.all([
        findAccountByPhone(normPhone),
        findAccountByUsername(cleanUsername),
      ]);
      if (existingByPhone) {
        return {
          statusCode: 409,
          payload: {
            success: false,
            error: 'An account with this phone number already exists.',
          },
        };
      }

      const usernameLower = cleanUsername.toLowerCase();
      if (existingByUsername) {
        return {
          statusCode: 409,
          payload: {
            success: false,
            error: 'This username is already taken. Please choose another.',
          },
        };
      }

      const nowIso = new Date().toISOString();
      const pinScryptHash = hashPinScrypt(pin);
      const record: ServerAccountRecord = {
        phone: normPhone,
        username: cleanUsername,
        usernameLower,
        pinScryptHash,
        avatarId,
        role: normalizeAdminPhone(normPhone) === ADMIN_PHONE_NORMALIZED ? 'admin' : 'user',
        firebaseUid,
        verifiedWithSms,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso,
      };

      await saveAccountRecord(record);

      const userSessionToken = issueUserSessionToken(normPhone);
      const userCookie = buildSessionCookieHeader(
        USER_SESSION_COOKIE_NAME,
        userSessionToken,
        buildCookieMaxAgeSeconds(),
        secureCookie
      );

      return {
        statusCode: 201,
        payload: {
          success: true,
          authenticated: true,
          user: sanitizeAccountForClient(record),
          userSessionToken,
        },
        setCookies: [userCookie],
      };
    });
  }

  // 2. POST /api/auth/login
  if (pathname === '/api/auth/login') {
    if (method !== 'POST') {
      return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
    }
    if (!isUserSessionSecretConfigured()) {
      return {
        statusCode: 503,
        payload: {
          success: false,
          error: 'Authentication session service is not configured on the server.',
        },
      };
    }

    const normPhone = normalizePhoneDigits(body.phone);
    const pin = String(body.pin || '').trim();

    if (!isValidKenyanPhone(normPhone) || !isValidPinFormat(pin)) {
      return {
        statusCode: 400,
        payload: { success: false, error: 'Enter a valid phone number and 4-digit PIN.' },
      };
    }

    const rateCheck = checkPinBruteForce(normPhone, clientIp);
    if (rateCheck.blocked) {
      await recordSecurityEvent({
        category: 'AUTH',
        severity: 'high',
        action: 'user_login_brute_force_lockout',
        outcome: 'blocked',
        actorId: normPhone,
        ip: clientIp,
        route: pathname,
        details: { retryAfterSeconds: rateCheck.retryAfterSeconds },
      });
      return {
        statusCode: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) },
        payload: {
          success: false,
          error: `Too many failed login attempts. Try again in ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minute(s).`,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
      };
    }

    const account = await findAccountByPhone(normPhone);
    const pinMatches = account ? verifyPinScrypt(pin, account.pinScryptHash) : false;

    if (!account || !pinMatches) {
      recordPinFailure(normPhone, clientIp);
      await recordSecurityEvent({
        category: 'AUTH',
        severity: 'warning',
        action: 'user_login_failed',
        outcome: 'failure',
        actorId: normPhone,
        ip: clientIp,
        route: pathname,
      });
      return {
        statusCode: 401,
        payload: {
          success: false,
          error: 'Invalid phone number or PIN.',
        },
      };
    }

    clearPinFailures(normPhone);

    // Optional verified Firebase upgrade on login
    const firebaseToken = extractFirebaseTokenCandidate(headers, body);
    let updated = false;
    if (firebaseToken) {
      const fbCheck = await verifyFirebaseIdTokenServer(firebaseToken);
      if (fbCheck.valid) {
        const tokenPhone = normalizePhoneDigits(fbCheck.phoneNumber);
        if (tokenPhone === normPhone) {
          account.verifiedWithSms = true;
          account.firebaseUid = fbCheck.uid || account.firebaseUid;
          updated = true;
        }
      }
    }

    const nowIso = new Date().toISOString();
    account.lastLoginAt = nowIso;
    account.updatedAt = nowIso;
    if (updated || account.lastLoginAt) {
      await saveAccountRecord(account);
    }

    const userSessionToken = issueUserSessionToken(normPhone);
    const userCookie = buildSessionCookieHeader(
      USER_SESSION_COOKIE_NAME,
      userSessionToken,
      buildCookieMaxAgeSeconds(),
      secureCookie
    );

    return {
      statusCode: 200,
      payload: {
        success: true,
        authenticated: true,
        user: sanitizeAccountForClient(account),
        userSessionToken,
      },
      setCookies: [userCookie],
    };
  }

  // 3. POST /api/auth/firebase-session (Exchange verified Firebase Phone OTP ID token for server session)
  if (pathname === '/api/auth/firebase-session') {
    if (method !== 'POST') {
      return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
    }
    if (!isUserSessionSecretConfigured()) {
      return {
        statusCode: 503,
        payload: {
          success: false,
          error: 'Authentication session service is not configured on the server.',
        },
      };
    }

    const firebaseToken = extractFirebaseTokenCandidate(headers, body);
    if (!firebaseToken) {
      return {
        statusCode: 400,
        payload: { success: false, error: 'firebaseIdToken is required.' },
      };
    }

    const fbCheck = await verifyFirebaseIdTokenServer(firebaseToken);
    if (!fbCheck.valid || !fbCheck.uid) {
      return {
        statusCode: 401,
        payload: { success: false, error: fbCheck.error || 'Invalid Firebase ID token.' },
      };
    }

    const verifiedPhone = normalizePhoneDigits(fbCheck.phoneNumber);
    if (!isValidKenyanPhone(verifiedPhone)) {
      return {
        statusCode: 403,
        payload: {
          success: false,
          error: 'Firebase token does not carry a verified Kenyan phone number.',
        },
      };
    }

    const account = await findAccountByPhone(verifiedPhone);
    if (!account) {
      return {
        statusCode: 200,
        payload: {
          success: true,
          authenticated: false,
          registered: false,
          phone: verifiedPhone,
          firebaseUid: fbCheck.uid,
          verifiedWithSms: true,
        },
      };
    }

    account.verifiedWithSms = true;
    account.firebaseUid = fbCheck.uid;
    account.lastLoginAt = new Date().toISOString();
    account.updatedAt = account.lastLoginAt;
    await saveAccountRecord(account);

    const userSessionToken = issueUserSessionToken(verifiedPhone);
    const userCookie = buildSessionCookieHeader(
      USER_SESSION_COOKIE_NAME,
      userSessionToken,
      buildCookieMaxAgeSeconds(),
      secureCookie
    );

    return {
      statusCode: 200,
      payload: {
        success: true,
        authenticated: true,
        registered: true,
        user: sanitizeAccountForClient(account),
        userSessionToken,
      },
      setCookies: [userCookie],
    };
  }

  // 4. GET /api/auth/me
  if (pathname === '/api/auth/me') {
    if (method !== 'GET') {
      return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
    }

    const adminCheck = await verifyAdminRequestAsync(headers);
    const tokenCandidate = extractUserTokenCandidate(headers);
    let resolvedPhone = '';
    let verifiedUserToken = '';
    let storeUnavailable = Boolean(adminCheck.storeUnavailable);

    if (tokenCandidate) {
      const tokenCheck = await verifyUserSessionTokenAsync(tokenCandidate);
      if (tokenCheck.storeUnavailable) {
        storeUnavailable = true;
      } else if (tokenCheck.valid && tokenCheck.userUid) {
        resolvedPhone = normalizePhoneDigits(tokenCheck.userUid);
        verifiedUserToken = tokenCandidate;
      }
    }

    if (storeUnavailable) {
      return {
        statusCode: 503,
        payload: {
          success: false,
          authenticated: false,
          adminAuthenticated: false,
          user: null,
          error: 'Session revocation store unavailable.',
        },
      };
    }

    if (!resolvedPhone) {
      const fbToken = extractFirebaseTokenCandidate(headers);
      if (fbToken) {
        const fbCheck = await verifyFirebaseIdTokenServer(fbToken);
        if (fbCheck.valid && fbCheck.phoneNumber) {
          resolvedPhone = normalizePhoneDigits(fbCheck.phoneNumber);
        }
      }
    }

    if (!resolvedPhone) {
      const clearUser = tokenCandidate
        ? [buildClearCookieHeader(USER_SESSION_COOKIE_NAME, secureCookie)]
        : undefined;
      return {
        statusCode: 200,
        payload: {
          success: true,
          authenticated: false,
          adminAuthenticated: adminCheck.authorized,
          user: null,
        },
        ...(clearUser ? { setCookies: clearUser } : {}),
      };
    }

    const account = await findAccountByPhone(resolvedPhone);
    if (!account) {
      return {
        statusCode: 200,
        payload: {
          success: true,
          authenticated: false,
          adminAuthenticated: adminCheck.authorized,
          user: null,
        },
        setCookies: [buildClearCookieHeader(USER_SESSION_COOKIE_NAME, secureCookie)],
      };
    }

    return {
      statusCode: 200,
      payload: {
        success: true,
        authenticated: true,
        adminAuthenticated: adminCheck.authorized,
        user: sanitizeAccountForClient(account),
        ...(verifiedUserToken ? { userSessionToken: verifiedUserToken } : {}),
      },
    };
  }

  // 5. POST /api/auth/logout
  if (pathname === '/api/auth/logout') {
    if (method !== 'POST') {
      return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
    }

    const userToken = extractUserTokenCandidate(headers, body);
    const adminToken = extractAdminTokenCandidate(headers, body);

    const revokedUser = userToken ? await revokeUserSessionTokenAsync(userToken) : false;
    const revokedAdmin = adminToken ? await revokeAdminTokenAsync(adminToken) : false;

    return {
      statusCode: 200,
      payload: {
        success: true,
        loggedOut: true,
        revokedUser,
        revokedAdmin,
      },
      setCookies: [
        buildClearCookieHeader(USER_SESSION_COOKIE_NAME, secureCookie),
        buildClearCookieHeader(ADMIN_SESSION_COOKIE_NAME, secureCookie),
      ],
    };
  }

  // 6. POST /api/auth/close-account
  if (pathname === '/api/auth/close-account') {
    if (method !== 'POST') {
      return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
    }

    const authResult = await authenticateTokenRequestAsync(headers, body);
    if (!authResult.authenticated || !authResult.userUid) {
      return {
        statusCode: authResult.statusCode || 401,
        payload: {
          success: false,
          error: authResult.error || 'Authentication required to close account.',
        },
      };
    }

    const normPhone = normalizePhoneDigits(authResult.userUid);
    const pin = String(body.pin || '').trim();
    if (!isValidPinFormat(pin)) {
      return {
        statusCode: 400,
        payload: { success: false, error: 'Enter your 4-digit PIN to confirm.' },
      };
    }

    const rateCheck = checkPinBruteForce(normPhone, clientIp);
    if (rateCheck.blocked) {
      return {
        statusCode: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) },
        payload: {
          success: false,
          error: `Too many failed PIN checks. Try again in ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minute(s).`,
        },
      };
    }

    return withAuthMutex(async () => {
      const account = await findAccountByPhone(normPhone);
      if (!account) {
        return {
          statusCode: 404,
          payload: { success: false, error: 'No active account found.' },
        };
      }

      if (!verifyPinScrypt(pin, account.pinScryptHash)) {
        recordPinFailure(normPhone, clientIp);
        return {
          statusCode: 401,
          payload: { success: false, error: 'Incorrect PIN. Please verify and try again.' },
        };
      }

      clearPinFailures(normPhone);
      await deleteAccountRecord(normPhone);

      const userToken = extractUserTokenCandidate(headers, body);
      const adminToken = extractAdminTokenCandidate(headers, body);
      if (userToken) await revokeUserSessionTokenAsync(userToken);
      if (adminToken) await revokeAdminTokenAsync(adminToken);

      return {
        statusCode: 200,
        payload: {
          success: true,
          closed: true,
        },
        setCookies: [
          buildClearCookieHeader(USER_SESSION_COOKIE_NAME, secureCookie),
          buildClearCookieHeader(ADMIN_SESSION_COOKIE_NAME, secureCookie),
        ],
      };
    });
  }

  // 7. GET /api/auth/directory (Sanitized non-sensitive punter handles only)
  if (pathname === '/api/auth/directory') {
    if (method !== 'GET') {
      return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
    }
    const punters = await loadPublicPunterDirectory();
    return {
      statusCode: 200,
      payload: {
        success: true,
        punters,
      },
    };
  }

  // 8. GET /api/auth/availability (Username availability check; never exposes phone existence)
  if (pathname === '/api/auth/availability') {
    if (method !== 'GET') {
      return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
    }
    const rawUsername = String(query.username || '').trim();
    if (!rawUsername) {
      return { statusCode: 400, payload: { success: false, error: 'username query parameter is required.' } };
    }
    const existing = await findAccountByUsername(rawUsername);
    return {
      statusCode: 200,
      payload: {
        success: true,
        username: rawUsername,
        available: !existing,
      },
    };
  }

  return {
    statusCode: 404,
    payload: {
      success: false,
      error: `Unknown authentication endpoint: ${pathname}`,
    },
  };
}

