/**
 * Shared HTTP Security Module (CORS, Security Headers, CSP, Safe JSON Body Parsing)
 * Enforces identical security posture across Express (`server.ts`), Vite dev middleware,
 * and Vercel Serverless API handlers (`api/*.ts`).
 */

import { isHttpsRequest } from './firebaseIdTokenVerifier.js';

const STATIC_TRUSTED_ORIGINS = new Set([
  'https://mshindi.co.ke',
  'https://www.mshindi.co.ke',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function normalizeOriginCandidate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === '*') return null;
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (parsed.pathname !== '/' && parsed.pathname !== '') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function getTrustedOriginsSet(): Set<string> {
  const trusted = new Set<string>(STATIC_TRUSTED_ORIGINS);

  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => normalizeOriginCandidate(s))
    .filter((v): v is string => Boolean(v));
  for (const origin of envOrigins) {
    trusted.add(origin);
  }

  for (const hostEnv of [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]) {
    if (hostEnv) {
      const normalized = normalizeOriginCandidate(`https://${hostEnv.replace(/^https?:\/\//i, '')}`);
      if (normalized) trusted.add(normalized);
    }
  }

  return trusted;
}

export function resolveTrustedCorsOrigin(originHeader?: string | string[]): string | null {
  const raw = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (typeof raw !== 'string') return null;

  const normalized = normalizeOriginCandidate(raw);
  if (!normalized) return null;

  const trusted = getTrustedOriginsSet();
  if (trusted.has(normalized)) {
    return normalized;
  }

  // Allow local development loopback ports when running outside production
  if (process.env.NODE_ENV !== 'production') {
    try {
      const parsed = new URL(normalized);
      if (
        parsed.protocol === 'http:' &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
      ) {
        return parsed.origin;
      }
    } catch {}
  }

  return null;
}

function appendVaryHeader(res: any, value: string): void {
  const existing = typeof res?.getHeader === 'function' ? res.getHeader('Vary') : undefined;
  const currentList = Array.isArray(existing)
    ? existing.join(',')
    : typeof existing === 'string'
      ? existing
      : '';
  const values = currentList
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  if (!values.some((v) => v.toLowerCase() === value.toLowerCase())) {
    values.push(value);
  }
  if (typeof res?.setHeader === 'function') {
    res.setHeader('Vary', values.join(', '));
  }
}

export interface CorsEvaluationResult {
  originPresent: boolean;
  originTrusted: boolean;
  allowedOrigin: string | null;
  preflightHandled: boolean;
}

/**
 * Applies explicit trusted-origin CORS headers and handles OPTIONS preflight requests.
 * Rejects untrusted cross-origin preflight requests with HTTP 403 and never emits '*'.
 */
export function applyCorsPolicy(
  req: any,
  res: any,
  options: { methods: string; allowHeaders: string }
): CorsEvaluationResult {
  const rawOrigin = req?.headers?.origin ?? req?.headers?.Origin;
  const originStr = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
  const originPresent = typeof originStr === 'string' && originStr.trim().length > 0;
  const allowedOrigin = originPresent ? resolveTrustedCorsOrigin(originStr) : null;
  const originTrusted = Boolean(allowedOrigin);

  appendVaryHeader(res, 'Origin');
  res.setHeader('Access-Control-Allow-Methods', options.methods);
  res.setHeader('Access-Control-Allow-Headers', options.allowHeaders);
  res.setHeader('Access-Control-Max-Age', '86400');

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  const method = String(req?.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    if (originPresent && !originTrusted) {
      res.status(403).json({
        success: false,
        error: 'CORS policy: Origin not permitted.',
      });
      return { originPresent, originTrusted, allowedOrigin, preflightHandled: true };
    }
    res.status(200).end();
    return { originPresent, originTrusted, allowedOrigin, preflightHandled: true };
  }

  return { originPresent, originTrusted, allowedOrigin, preflightHandled: false };
}

/**
 * Builds the MshindiRoom Content-Security-Policy string aligned with actual dependencies:
 * - Self-hosted Vite ESM bundles, Inter WOFF2 fonts, and Service Worker (/sw.js)
 * - Firebase Auth (including reCAPTCHA phone verification), Firestore, and Storage
 * - Sports/video embeds (YouTube, Vimeo, Streamable, SportScore widget, sandboxed bookies)
 */
export function buildContentSecurityPolicy(options?: {
  isDev?: boolean;
  isHttps?: boolean;
  isApi?: boolean;
}): string {
  if (options?.isApi) {
    return "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
  }

  const isDev = Boolean(options?.isDev);
  const scriptSrc = [
    "'self'",
    'https://www.google.com',
    'https://www.gstatic.com',
    'https://apis.google.com',
    ...(isDev ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
  ].join(' ');

  const connectSrc = [
    "'self'",
    'https://*.googleapis.com',
    'https://firestore.googleapis.com',
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://firebaseinstallations.googleapis.com',
    'https://firebasestorage.googleapis.com',
    'https://*.firebaseio.com',
    'wss://*.firebaseio.com',
    'https://www.google.com',
    'https://www.gstatic.com',
    'https://footballcharts-backend.onrender.com',
    'https://r.jina.ai',
    'https://sportscore.com',
    'https://*.sportscore.com',
    ...(isDev ? ['http://localhost:*', 'http://127.0.0.1:*', 'ws://localhost:*', 'ws://127.0.0.1:*'] : []),
  ].join(' ');

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://www.gstatic.com",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "frame-src 'self' https:",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];

  if (options?.isHttps) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

export const PERMISSIONS_POLICY_VALUE =
  'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

/**
 * Applies standard defense-in-depth security headers to Express or Vercel responses.
 */
export function applyStandardSecurityHeaders(
  req: any,
  res: any,
  options?: { isApi?: boolean; isDev?: boolean }
): void {
  const https = isHttpsRequest(req);
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', options?.isApi ? 'DENY' : 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY_VALUE);
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  if (https || isProd) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  res.setHeader(
    'Content-Security-Policy',
    buildContentSecurityPolicy({
      isDev: options?.isDev,
      isHttps: https,
      isApi: options?.isApi,
    })
  );
}

export interface ParsedJsonBodyResult {
  ok: boolean;
  body: Record<string, any>;
  statusCode: number;
  error: string;
}

/**
 * Safely parses JSON bodies in serverless handlers without leaking 500s on invalid syntax
 * or non-object payloads when a JSON body is supplied.
 */
export function parseSafeJsonBody(
  req: any,
  options?: { maxBytes?: number }
): ParsedJsonBodyResult {
  const raw = req?.body;
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, body: {}, statusCode: 200, error: '' };
  }

  const maxBytes = options?.maxBytes ?? 15 * 1024 * 1024;
  if (typeof raw === 'string') {
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
      return { ok: false, body: {}, statusCode: 413, error: 'Request payload too large.' };
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, body: {}, statusCode: 400, error: 'JSON request body must be an object.' };
      }
      return { ok: true, body: parsed, statusCode: 200, error: '' };
    } catch {
      return { ok: false, body: {}, statusCode: 400, error: 'Invalid JSON request body.' };
    }
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return { ok: true, body: raw, statusCode: 200, error: '' };
  }

  return { ok: false, body: {}, statusCode: 400, error: 'Invalid request body format.' };
}

