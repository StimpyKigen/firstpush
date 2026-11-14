/**
 * Persistent Cross-Instance Token Revocation Store
 *
 * Tracks revoked session nonces/JTIs (`adminToken` & `utok.` user session tokens)
 * using one-way SHA-256 hashed identifiers (`revokedTokens/{nonceHash}` in Cloud Firestore)
 * with expiration pruning so logout and account-closure revocations survive across
 * independent serverless instances and cold restarts.
 *
 * Fail-closed guarantee:
 * When distributed Firestore revocation is required (Firestore configured OR running in a
 * multi-instance serverless runtime such as Vercel/Lambda), Firestore unavailability or query
 * errors reject session verification (`unavailable: true`, fail closed) rather than
 * silently accepting potentially revoked tokens from ephemeral local `/tmp` state.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getAdminFirestore, isFirebaseAdminConfigured } from './serverFirebaseAdmin.js';

export const REVOKED_TOKENS_COLLECTION = 'revokedTokens';
const DEFAULT_REVOCATION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours (covers max 1h token TTL + drift)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let revokedMemoryCache: Map<string, number> | null = null;
let lastCleanupAtMs = 0;
let firestoreOverrideForTests: any = undefined; // undefined = unused, 'throw' = simulate outage, object = mock db

export interface RevocationCheckResult {
  revoked: boolean;
  unavailable?: boolean;
  expiredCleaned?: boolean;
}

export function hashRevocationNonce(nonce: string): string {
  const clean = String(nonce || '').trim().toLowerCase();
  return crypto.createHash('sha256').update(`mshindi-revoked-nonce:${clean}`, 'utf-8').digest('hex');
}

function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL === '1' ||
      process.env.VERCEL_ENV ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.K_SERVICE
  );
}

/**
 * True whenever shared Firestore revocation is authoritative and local disk cannot be trusted alone.
 */
export function isDistributedRevocationRequired(): boolean {
  return Boolean(
    firestoreOverrideForTests !== undefined ||
      isFirebaseAdminConfigured() ||
      isServerlessRuntime()
  );
}

function resolveLocalRevocationFilePath(): string {
  const cwdFile = path.resolve(process.cwd(), '.data', 'revoked_tokens.json');
  const tmpFile = path.join(os.tmpdir(), 'mshindi_revoked_tokens.json');
  if (fs.existsSync(cwdFile)) return cwdFile;
  if (process.env.VERCEL === '1') return tmpFile;
  return cwdFile;
}

function pruneExpired(map: Map<string, number>, now: number = Date.now()): boolean {
  let removed = false;
  for (const [key, exp] of map.entries()) {
    if (!Number.isFinite(exp) || exp <= now) {
      map.delete(key);
      removed = true;
    }
  }
  return removed;
}

function getMemoryCache(): Map<string, number> {
  if (!revokedMemoryCache) {
    revokedMemoryCache = new Map<string, number>();
  } else {
    pruneExpired(revokedMemoryCache);
  }
  return revokedMemoryCache;
}

function loadLocalDiskRevocations(): Map<string, number> {
  const map = new Map<string, number>();
  const filePath = resolveLocalRevocationFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof k === 'string' && typeof v === 'number' && Number.isFinite(v)) {
            const normalizedKey = /^[a-f0-9]{16}$/i.test(k) ? hashRevocationNonce(k) : k.toLowerCase();
            map.set(normalizedKey, v);
          }
        }
      }
    }
  } catch {
    // Non-fatal in local fallback mode
  }
  pruneExpired(map);
  return map;
}

function saveLocalDiskRevocations(map: Map<string, number>): void {
  pruneExpired(map);
  const obj: Record<string, number> = {};
  for (const [k, v] of map.entries()) {
    obj[k] = v;
  }
  const serialized = JSON.stringify(obj);

  const target = path.resolve(process.cwd(), '.data', 'revoked_tokens.json');
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, serialized, 'utf-8');
    fs.renameSync(tmp, target);
  } catch {
    // Best effort in local non-serverless mode
  }
}

async function resolveRevocationFirestore(): Promise<any | null> {
  if (firestoreOverrideForTests === 'throw') {
    throw new Error('Simulated Firestore revocation store outage');
  }
  if (firestoreOverrideForTests !== undefined) {
    return firestoreOverrideForTests;
  }
  return getAdminFirestore();
}

/**
 * Deletes expired revocation records from Firestore and local memory/disk.
 */
export async function cleanupExpiredRevokedTokensAsync(
  nowMs: number = Date.now(),
  maxBatch: number = 50
): Promise<{ prunedLocal: number; prunedFirestore: number }> {
  let prunedLocal = 0;
  const cache = getMemoryCache();
  for (const [k, exp] of cache.entries()) {
    if (!Number.isFinite(exp) || exp <= nowMs) {
      cache.delete(k);
      prunedLocal++;
    }
  }

  if (!isServerlessRuntime()) {
    const localMap = loadLocalDiskRevocations();
    for (const [k, exp] of localMap.entries()) {
      if (!Number.isFinite(exp) || exp <= nowMs) {
        localMap.delete(k);
        prunedLocal++;
      }
    }
    if (prunedLocal > 0) {
      saveLocalDiskRevocations(localMap);
    }
  }

  let prunedFirestore = 0;
  try {
    const db = await resolveRevocationFirestore();
    if (db) {
      const snap = await db
        .collection(REVOKED_TOKENS_COLLECTION)
        .where('expiresAtMs', '<=', nowMs)
        .limit(maxBatch)
        .get();
      if (snap && !snap.empty && Array.isArray(snap.docs) && snap.docs.length > 0) {
        if (typeof db.batch === 'function') {
          const batch = db.batch();
          for (const docSnap of snap.docs) {
            batch.delete(docSnap.ref);
            prunedFirestore++;
          }
          await batch.commit();
        } else {
          for (const docSnap of snap.docs) {
            await docSnap.ref.delete();
            prunedFirestore++;
          }
        }
      }
    }
  } catch {
    // Cleanup errors must not crash active requests
  }

  return { prunedLocal, prunedFirestore };
}

/**
 * Authoritative async revocation persistence across Firestore + local memory cache.
 */
export async function persistRevokedTokenNonceAsync(
  nonce: string,
  expiresAtMs: number = Date.now() + DEFAULT_REVOCATION_TTL_MS
): Promise<boolean> {
  const clean = String(nonce || '').trim().toLowerCase();
  if (!/^[a-f0-9]{16}$/.test(clean)) return false;

  const idHash = hashRevocationNonce(clean);
  const now = Date.now();
  const safeExpMs = Math.max(expiresAtMs, now + 60_000);

  // Positive-only cache (once revoked, nonces never become valid before expiry)
  getMemoryCache().set(idHash, safeExpMs);

  const distributedRequired = isDistributedRevocationRequired();
  if (!isServerlessRuntime()) {
    const diskMap = loadLocalDiskRevocations();
    diskMap.set(idHash, safeExpMs);
    saveLocalDiskRevocations(diskMap);
  }

  try {
    const db = await resolveRevocationFirestore();
    if (db) {
      await db
        .collection(REVOKED_TOKENS_COLLECTION)
        .doc(idHash)
        .set({
          idHash,
          expiresAtMs: safeExpMs,
          expiresAtIso: new Date(safeExpMs).toISOString(),
          revokedAtMs: now,
          revokedAtIso: new Date(now).toISOString(),
        });

      if (now - lastCleanupAtMs >= CLEANUP_INTERVAL_MS) {
        lastCleanupAtMs = now;
        void cleanupExpiredRevokedTokensAsync(now).catch(() => {});
      }
      return true;
    }

    if (distributedRequired) {
      console.error('[TokenRevocation] Distributed Firestore revocation store unavailable on persist.');
      return false;
    }

    return true;
  } catch (err) {
    console.error('[TokenRevocation] Failed to persist revoked token to Firestore:', err);
    return !distributedRequired;
  }
}

/**
 * Authoritative async revocation check.
 * Queries shared Firestore when not cached as already-revoked; fails closed if Firestore
 * is unavailable or throws in distributed/serverless mode.
 */
export async function checkTokenNonceRevocationAsync(
  nonce?: string | null
): Promise<RevocationCheckResult> {
  if (!nonce || typeof nonce !== 'string') return { revoked: false };
  const clean = nonce.trim().toLowerCase();
  if (!/^[a-f0-9]{16}$/.test(clean)) return { revoked: false };

  const idHash = hashRevocationNonce(clean);
  const now = Date.now();

  // 1. Positive-only memory cache check (safe across instances: only hit when confirmed revoked)
  const mem = getMemoryCache();
  const memExp = mem.get(idHash);
  if (memExp !== undefined) {
    if (memExp > now) {
      return { revoked: true };
    }
    mem.delete(idHash);
  }

  // 2. Shared Firestore check when distributed revocation is configured or required
  if (isDistributedRevocationRequired()) {
    try {
      const db = await resolveRevocationFirestore();
      if (!db) {
        return { revoked: true, unavailable: true };
      }

      const docRef = db.collection(REVOKED_TOKENS_COLLECTION).doc(idHash);
      const snap = await docRef.get();
      if (!snap || !snap.exists) {
        return { revoked: false };
      }

      const data = typeof snap.data === 'function' ? snap.data() : snap.data;
      const exp = Number(data?.expiresAtMs);
      if (!Number.isFinite(exp) || exp <= now) {
        try {
          await docRef.delete();
        } catch {}
        return { revoked: false, expiredCleaned: true };
      }

      mem.set(idHash, exp);
      return { revoked: true };
    } catch {
      // Fail closed on Firestore read outage — never silently accept unverified sessions
      return { revoked: true, unavailable: true };
    }
  }

  // 3. Single-process non-serverless local dev/test fallback
  const diskMap = loadLocalDiskRevocations();
  const diskExp = diskMap.get(idHash);
  if (diskExp === undefined) return { revoked: false };
  if (diskExp <= now) {
    diskMap.delete(idHash);
    saveLocalDiskRevocations(diskMap);
    return { revoked: false, expiredCleaned: true };
  }
  mem.set(idHash, diskExp);
  return { revoked: true };
}

export async function isTokenNonceRevokedAsync(nonce?: string | null): Promise<boolean> {
  const result = await checkTokenNonceRevocationAsync(nonce);
  return result.revoked;
}

/**
 * Synchronous fallback retained strictly for local single-node unit tests when Firestore
 * is not active. In distributed/serverless mode without async verification, fails closed.
 */
export function persistRevokedTokenNonce(
  nonce: string,
  expiresAtMs: number = Date.now() + DEFAULT_REVOCATION_TTL_MS
): boolean {
  const clean = String(nonce || '').trim().toLowerCase();
  if (!/^[a-f0-9]{16}$/.test(clean)) return false;

  const idHash = hashRevocationNonce(clean);
  const safeExpMs = Math.max(expiresAtMs, Date.now() + 60_000);
  getMemoryCache().set(idHash, safeExpMs);

  if (!isServerlessRuntime()) {
    const diskMap = loadLocalDiskRevocations();
    diskMap.set(idHash, safeExpMs);
    saveLocalDiskRevocations(diskMap);
  }

  if (isDistributedRevocationRequired()) {
    void persistRevokedTokenNonceAsync(clean, safeExpMs).catch(() => {});
  }

  return true;
}

export function isTokenNonceRevoked(nonce?: string | null): boolean {
  if (!nonce || typeof nonce !== 'string') return false;
  const clean = nonce.trim().toLowerCase();
  if (!/^[a-f0-9]{16}$/.test(clean)) return false;

  const idHash = hashRevocationNonce(clean);
  const now = Date.now();
  const mem = getMemoryCache();
  const memExp = mem.get(idHash);
  if (memExp !== undefined) {
    if (memExp > now) return true;
    mem.delete(idHash);
  }

  // Fail closed if distributed Firestore revocation is required and sync path cannot query async DB
  if (isDistributedRevocationRequired()) {
    return true;
  }

  const diskMap = loadLocalDiskRevocations();
  const diskExp = diskMap.get(idHash);
  if (diskExp === undefined) return false;
  if (diskExp <= now) {
    diskMap.delete(idHash);
    saveLocalDiskRevocations(diskMap);
    return false;
  }
  mem.set(idHash, diskExp);
  return true;
}

/**
 * Wipes ONLY the in-memory revocation cache (simulating a cold serverless instance).
 */
export function resetRevocationCacheForTests(): void {
  revokedMemoryCache = null;
  lastCleanupAtMs = 0;
}

/**
 * Test seam for injecting a mock Firestore instance or `'throw'` outage simulator.
 */
export function setRevocationFirestoreOverrideForTests(override?: any): void {
  firestoreOverrideForTests = override;
  revokedMemoryCache = null;
}
