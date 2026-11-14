/**
 * Distributed Rate Limiter & Trusted Client IP Extractor (MSH-029)
 *
 * Eliminates spoofable left-most `x-forwarded-for` trust and unifies
 * rate-limit enforcement across both Express (`server.ts`) and Vercel
 * serverless functions (`api/*.ts`).
 *
 * Backend Priority:
 *  1. Upstash Redis REST (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)
 *  2. Cloud Firestore atomic transaction (`rateLimits/{bucketHash}`) via Admin SDK
 *  3. Bounded local memory fallback (`MAX_MEMORY_BUCKETS = 5000`)
 */

import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { resolveScopedServiceAccountRaw } from './fixtureSnapshotStore.js';
import { recordSecurityEvent } from './securityAuditLogger.js';

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  backend: 'upstash' | 'firestore' | 'memory';
  keyHash: string;
}

interface MemoryBucket {
  count: number;
  resetAt: number;
}

const MAX_MEMORY_BUCKETS = 5000;
const memoryBuckets = new Map<string, MemoryBucket>();

let adminFirestoreInstance: any | null = null;
let adminFirestoreInitAttempted = false;

export function resetRateLimiterForTests(): void {
  memoryBuckets.clear();
  adminFirestoreInstance = null;
  adminFirestoreInitAttempted = false;
}

function getHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string {
  if (!headers) return '';
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] || '').trim();
  return typeof raw === 'string' ? raw.trim() : '';
}

function normalizeIp(raw: string): string {
  const cleaned = raw.trim().replace(/^\[|\]$/g, '');
  if (!cleaned) return '';
  if (cleaned === '::1') return '127.0.0.1';
  if (cleaned.startsWith('::ffff:')) {
    return cleaned.slice(7);
  }
  return cleaned;
}

/**
 * Extracts the client IP without trusting client-spoofable leftmost `x-forwarded-for` entries.
 * - On direct Express/Node servers, relies strictly on the verified peer socket address.
 * - On Vercel Edge/Serverless runtimes, trusts `x-vercel-forwarded-for` / `x-real-ip` / rightmost hop.
 */
export function extractTrustedClientIp(
  reqOrHeaders?:
    | {
        ip?: string;
        headers?: Record<string, string | string[] | undefined>;
        socket?: { remoteAddress?: string };
        connection?: { remoteAddress?: string };
      }
    | Record<string, string | string[] | undefined>
): string {
  if (!reqOrHeaders) return 'unknown';

  const hasReqShape =
    'headers' in reqOrHeaders ||
    'socket' in reqOrHeaders ||
    'connection' in reqOrHeaders ||
    typeof (reqOrHeaders as any).ip === 'string';

  const req = hasReqShape ? (reqOrHeaders as any) : null;
  const headers: Record<string, string | string[] | undefined> = req
    ? req.headers || {}
    : (reqOrHeaders as Record<string, string | string[] | undefined>);

  const isVercelEdge = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

  if (isVercelEdge) {
    // 1. Platform-injected edge header (overwritten by Vercel edge, not spoofable by clients)
    const vercelIp = normalizeIp(getHeader(headers, 'x-vercel-forwarded-for').split(',').pop() || '');
    if (vercelIp) return vercelIp;

    // 2. Reverse-proxy real client IP header
    const realIp = normalizeIp(getHeader(headers, 'x-real-ip'));
    if (realIp) return realIp;

    // 3. Rightmost proxy-appended hop (never leftmost split(',')[0] which clients can forge)
    const xff = getHeader(headers, 'x-forwarded-for');
    if (xff) {
      const hops = xff
        .split(',')
        .map((h) => normalizeIp(h))
        .filter(Boolean);
      if (hops.length > 0) {
        return hops[hops.length - 1];
      }
    }
  }

  // Non-Vercel Node/Express execution: trust only peer socket or Express req.ip (with trust proxy disabled)
  const socketIp = normalizeIp(
    String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || req?.ip || '')
  );
  if (socketIp) return socketIp;

  // Fallback for mocked header-only tests when running without socket context
  const fallbackRealIp = normalizeIp(getHeader(headers, 'x-real-ip'));
  if (fallbackRealIp) return fallbackRealIp;

  return 'unknown';
}

function hashBucketKey(namespace: string, key: string): string {
  return crypto
    .createHash('sha256')
    .update(`${namespace}:${key}`, 'utf-8')
    .digest('hex')
    .slice(0, 36);
}

async function getRateLimitFirestore(): Promise<any | null> {
  if (adminFirestoreInstance) return adminFirestoreInstance;
  if (adminFirestoreInitAttempted) return null;
  adminFirestoreInitAttempted = true;

  try {
    const rawSa = resolveScopedServiceAccountRaw();
    const isVercelEnv = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
    const isCloudEnv = Boolean(
      !isVercelEnv &&
        (process.env.K_SERVICE ||
          process.env.GOOGLE_CLOUD_PROJECT ||
          process.env.GOOGLE_APPLICATION_CREDENTIALS)
    );
    if (!rawSa && !isCloudEnv) {
      return null;
    }

    const adminPkg = 'firebase-admin';
    const firebaseAdminModule = await import(adminPkg);
    const firebaseAdmin = firebaseAdminModule.default || firebaseAdminModule;

    if (!firebaseAdmin.apps.length) {
      if (rawSa) {
        const serviceAccount = JSON.parse(rawSa);
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert(serviceAccount),
        });
      } else {
        firebaseAdmin.initializeApp();
      }
    }

    const db = firebaseAdmin.firestore();
    adminFirestoreInstance = db;
    return db;
  } catch {
    return null;
  }
}

async function checkUpstashRateLimit(
  bucketKey: string,
  windowMs: number,
  maxRequests: number,
  nowMs: number
): Promise<RateLimitDecision | null> {
  const url = (process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/+$/, '');
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) return null;

  try {
    const redisKey = `mshindi:rl:${bucketKey}`;
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PTTL', redisKey],
      ]),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const count = Number(data?.[0]?.result ?? 1);
    let pttl = Number(data?.[1]?.result ?? -1);

    if (pttl < 0) {
      await fetch(`${url}/pexpire/${encodeURIComponent(redisKey)}/${windowMs}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      pttl = windowMs;
    }

    const resetAt = nowMs + Math.max(1000, pttl);
    const allowed = count <= maxRequests;
    return {
      allowed,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetAt,
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt - nowMs) / 1000)),
      backend: 'upstash',
      keyHash: bucketKey,
    };
  } catch {
    return null;
  }
}

async function checkFirestoreRateLimit(
  bucketKey: string,
  namespace: string,
  windowMs: number,
  maxRequests: number,
  nowMs: number
): Promise<RateLimitDecision | null> {
  const db = await getRateLimitFirestore();
  if (!db) return null;

  try {
    const docRef = db.collection('rateLimits').doc(bucketKey);
    const result = await db.runTransaction(async (tx: any) => {
      const snap = await tx.get(docRef);
      const data = snap.exists ? snap.data() : null;

      if (!data || Number(data.resetAt || 0) <= nowMs) {
        const nextResetAt = nowMs + windowMs;
        tx.set(docRef, {
          namespace,
          count: 1,
          resetAt: nextResetAt,
          updatedAt: new Date(nowMs).toISOString(),
        });
        return { count: 1, resetAt: nextResetAt };
      }

      const nextCount = Number(data.count || 0) + 1;
      const existingResetAt = Number(data.resetAt);
      tx.set(
        docRef,
        {
          count: nextCount,
          updatedAt: new Date(nowMs).toISOString(),
        },
        { merge: true }
      );
      return { count: nextCount, resetAt: existingResetAt };
    });

    const allowed = result.count <= maxRequests;
    return {
      allowed,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - result.count),
      resetAt: result.resetAt,
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((result.resetAt - nowMs) / 1000)),
      backend: 'firestore',
      keyHash: bucketKey,
    };
  } catch {
    return null;
  }
}

function checkMemoryRateLimit(
  bucketKey: string,
  windowMs: number,
  maxRequests: number,
  nowMs: number
): RateLimitDecision {
  const existing = memoryBuckets.get(bucketKey);
  if (!existing || existing.resetAt <= nowMs) {
    if (memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
      // Prune expired buckets first, otherwise evict oldest
      for (const [k, b] of memoryBuckets.entries()) {
        if (b.resetAt <= nowMs) {
          memoryBuckets.delete(k);
        }
        if (memoryBuckets.size < MAX_MEMORY_BUCKETS) break;
      }
      if (memoryBuckets.size >= MAX_MEMORY_BUCKETS) {
        const oldest = memoryBuckets.keys().next().value;
        if (oldest) memoryBuckets.delete(oldest);
      }
    }
    const resetAt = nowMs + windowMs;
    memoryBuckets.set(bucketKey, { count: 1, resetAt });
    return {
      allowed: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - 1),
      resetAt,
      retryAfterSeconds: 0,
      backend: 'memory',
      keyHash: bucketKey,
    };
  }

  existing.count += 1;
  memoryBuckets.set(bucketKey, existing);
  const allowed = existing.count <= maxRequests;
  return {
    allowed,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
    backend: 'memory',
    keyHash: bucketKey,
  };
}

/**
 * Evaluates a distributed rate limit counter across Upstash Redis, Firestore, or bounded local memory.
 */
export async function checkDistributedRateLimit(params: {
  namespace: string;
  key: string;
  windowMs: number;
  maxRequests: number;
}): Promise<RateLimitDecision> {
  const nowMs = Date.now();
  const bucketKey = hashBucketKey(params.namespace, params.key || 'unknown');

  const upstash = await checkUpstashRateLimit(
    bucketKey,
    params.windowMs,
    params.maxRequests,
    nowMs
  );
  if (upstash) return upstash;

  const firestore = await checkFirestoreRateLimit(
    bucketKey,
    params.namespace,
    params.windowMs,
    params.maxRequests,
    nowMs
  );
  if (firestore) return firestore;

  return checkMemoryRateLimit(bucketKey, params.windowMs, params.maxRequests, nowMs);
}

function applyRateLimitHeaders(res: any, decision: RateLimitDecision): void {
  if (!res || typeof res.setHeader !== 'function') return;
  res.setHeader('RateLimit-Limit', String(decision.limit));
  res.setHeader('RateLimit-Remaining', String(decision.remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)));
  if (!decision.allowed) {
    res.setHeader('Retry-After', String(decision.retryAfterSeconds));
  }
}

/**
 * Reusable serverless handler rate limiter helper for `api/*.ts` endpoints.
 * Returns `true` when permitted, or sends HTTP 429 and returns `false`.
 */
export async function enforceEndpointRateLimit(
  req: any,
  res: any,
  options: {
    namespace: string;
    key?: string;
    windowMs: number;
    maxRequests: number;
    routeLabel?: string;
  }
): Promise<boolean> {
  const ip = extractTrustedClientIp(req);
  const key = options.key ? `${ip}:${options.key}` : ip;
  const decision = await checkDistributedRateLimit({
    namespace: options.namespace,
    key,
    windowMs: options.windowMs,
    maxRequests: options.maxRequests,
  });
  applyRateLimitHeaders(res, decision);

  if (!decision.allowed) {
    void recordSecurityEvent({
      category: 'RATE_LIMIT',
      severity: 'warning',
      action: `rate_limit_exceeded:${options.namespace}`,
      outcome: 'blocked',
      ip,
      route: options.routeLabel || String(req?.url || '/api').split('?')[0],
      details: {
        namespace: options.namespace,
        limit: options.maxRequests,
        backend: decision.backend,
      },
    });
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please wait before trying again.',
      retryAfterSeconds: decision.retryAfterSeconds,
    });
    return false;
  }

  return true;
}

/**
 * Express middleware adapter using the shared distributed rate limiter and trusted IP resolution.
 */
export function createExpressRateLimiter(options: {
  namespace: string;
  windowMs: number;
  maxRequests: number;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = extractTrustedClientIp(req);
      const decision = await checkDistributedRateLimit({
        namespace: options.namespace,
        key: ip,
        windowMs: options.windowMs,
        maxRequests: options.maxRequests,
      });
      applyRateLimitHeaders(res, decision);

      if (!decision.allowed) {
        void recordSecurityEvent({
          category: 'RATE_LIMIT',
          severity: 'warning',
          action: `rate_limit_exceeded:${options.namespace}`,
          outcome: 'blocked',
          ip,
          route: req.path || '/api',
          details: {
            namespace: options.namespace,
            limit: options.maxRequests,
            backend: decision.backend,
          },
        });
        return res.status(429).json({
          success: false,
          error: 'Too many requests. Please wait a moment before trying again.',
          retryAfterMs: decision.retryAfterSeconds * 1000,
          retryAfterSeconds: decision.retryAfterSeconds,
        });
      }

      return next();
    } catch {
      return next();
    }
  };
}

