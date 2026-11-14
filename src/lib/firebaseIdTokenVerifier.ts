/**
 * Server-Side Cookie & Firebase ID Token Verification Utilities
 *
 * Leaf module (zero circular dependencies) providing:
 * 1. HttpOnly session cookie parsing & Set-Cookie header builders.
 * 2. Cryptographic Firebase ID Token verification via `firebase-admin` (when configured)
 *    with RS256 X.509 public certificate fallback against Google's official JWKS endpoint.
 */

import crypto from 'node:crypto';
import { getAdminAuth } from './serverFirebaseAdmin.js';

export const FIREBASE_PROJECT_ID = 'mshindiroom-production';
export const USER_SESSION_COOKIE_NAME = 'mshindi_user_session';
export const ADMIN_SESSION_COOKIE_NAME = 'mshindi_admin_session';

const GOOGLE_CERT_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedGoogleCerts: { certs: Record<string, string>; expiresAtMs: number } | null = null;

export function parseCookieHeader(cookieHeader?: string | string[]): Record<string, string> {
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : String(cookieHeader || '');
  const out: Record<string, string> = {};
  if (!raw.trim()) return out;

  for (const segment of raw.split(';')) {
    const eqIdx = segment.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = segment.slice(0, eqIdx).trim();
    const val = segment.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function getCookieFromHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
  cookieName: string
): string {
  if (!headers) return '';
  const cookieHeader = headers.cookie ?? headers.Cookie;
  if (!cookieHeader) return '';
  const parsed = parseCookieHeader(cookieHeader);
  return parsed[cookieName] || '';
}

export function isHttpsRequest(req?: { headers?: Record<string, any>; secure?: boolean }): boolean {
  if (!req) return process.env.NODE_ENV === 'production';
  if (req.secure) return true;
  const proto = String(req.headers?.['x-forwarded-proto'] || req.headers?.['X-Forwarded-Proto'] || '').toLowerCase();
  if (proto.includes('https')) return true;
  const host = String(req.headers?.host || '').toLowerCase();
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]')) {
    return false;
  }
  return process.env.NODE_ENV === 'production';
}

export function buildSessionCookieHeader(
  name: string,
  value: string,
  maxAgeSeconds: number,
  secure: boolean
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildClearCookieHeader(name: string, secure: boolean): string {
  return buildSessionCookieHeader(name, '', 0, secure);
}

export function appendSetCookieHeader(res: any, cookieValue: string): void {
  if (!res) return;
  const existing =
    typeof res.getHeader === 'function' ? res.getHeader('Set-Cookie') : res.headers?.['set-cookie'];
  const next = Array.isArray(existing)
    ? [...existing, cookieValue]
    : existing
      ? [String(existing), cookieValue]
      : [cookieValue];
  if (typeof res.setHeader === 'function') {
    res.setHeader('Set-Cookie', next);
  } else if (res.headers) {
    res.headers['set-cookie'] = next;
  }
}

export interface VerifiedFirebaseIdentity {
  valid: boolean;
  uid?: string;
  phoneNumber?: string;
  error?: string;
}

async function fetchGoogleSecureTokenCerts(): Promise<Record<string, string> | null> {
  const now = Date.now();
  if (cachedGoogleCerts && cachedGoogleCerts.expiresAtMs > now) {
    return cachedGoogleCerts.certs;
  }

  try {
    const signal =
      typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? AbortSignal.timeout(8000)
        : undefined;
    const res = await fetch(GOOGLE_CERT_URL, { signal });
    if (!res.ok) return null;
    const certs = (await res.json()) as Record<string, string>;
    const cc = res.headers.get('cache-control') || '';
    const match = cc.match(/max-age=(\d+)/i);
    const maxAgeMs = match ? Number(match[1]) * 1000 : 60 * 60 * 1000;
    cachedGoogleCerts = {
      certs,
      expiresAtMs: now + Math.max(60_000, maxAgeMs),
    };
    return certs;
  } catch {
    return null;
  }
}

function decodeBase64UrlJson(segment: string): Record<string, any> | null {
  try {
    const raw = Buffer.from(segment, 'base64url').toString('utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Pure cryptographic RS256 Firebase ID Token verifier against explicit X.509 certificate map.
 */
export function verifyFirebaseJwtWithCertificates(
  idToken: string,
  certs: Record<string, string>,
  projectId: string = FIREBASE_PROJECT_ID,
  nowEpochSeconds: number = Math.floor(Date.now() / 1000)
): VerifiedFirebaseIdentity {
  if (!idToken || typeof idToken !== 'string') {
    return { valid: false, error: 'Missing Firebase ID token.' };
  }
  const parts = idToken.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed JWT format.' };
  }

  const [headerB64, payloadB64, sigB64] = parts;
  const header = decodeBase64UrlJson(headerB64);
  const payload = decodeBase64UrlJson(payloadB64);
  if (!header || !payload) {
    return { valid: false, error: 'Invalid JWT JSON encoding.' };
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    return { valid: false, error: 'Unsupported Firebase token algorithm or missing key ID.' };
  }

  const certPem = certs[header.kid];
  if (!certPem) {
    return { valid: false, error: 'Signing certificate for token kid not found.' };
  }

  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerB64}.${payloadB64}`);
    verifier.end();
    const signatureValid = verifier.verify(certPem, Buffer.from(sigB64, 'base64url'));
    if (!signatureValid) {
      return { valid: false, error: 'Invalid Firebase ID token signature.' };
    }
  } catch {
    return { valid: false, error: 'Cryptographic signature verification failed.' };
  }

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  if (payload.aud !== projectId) {
    return { valid: false, error: 'Firebase ID token audience mismatch.' };
  }
  if (payload.iss !== expectedIssuer) {
    return { valid: false, error: 'Firebase ID token issuer mismatch.' };
  }
  if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128) {
    return { valid: false, error: 'Firebase ID token missing valid subject UID.' };
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowEpochSeconds) {
    return { valid: false, error: 'Firebase ID token has expired.' };
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowEpochSeconds + 300) {
    return { valid: false, error: 'Firebase ID token issued-at timestamp is invalid.' };
  }
  if (typeof payload.auth_time === 'number' && payload.auth_time > nowEpochSeconds + 300) {
    return { valid: false, error: 'Firebase ID token auth_time is in the future.' };
  }

  return {
    valid: true,
    uid: payload.sub,
    phoneNumber: typeof payload.phone_number === 'string' ? payload.phone_number : undefined,
  };
}

/**
 * Verifies a Firebase Auth ID Token on the server.
 * Uses firebase-admin (with checkRevoked=true) when service account credentials exist,
 * otherwise verifies cryptographically against Google's official Firebase X.509 certificates.
 */
export async function verifyFirebaseIdTokenServer(
  idToken?: string | null
): Promise<VerifiedFirebaseIdentity> {
  if (!idToken || typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    return { valid: false, error: 'Invalid or missing Firebase ID token.' };
  }

  const adminAuth = await getAdminAuth({ allowAdc: false });
  if (adminAuth) {
    try {
      const decoded = await adminAuth.verifyIdToken(idToken.trim(), true);
      if (!decoded?.uid) {
        return { valid: false, error: 'Verified Firebase token missing uid.' };
      }
      return {
        valid: true,
        uid: decoded.uid,
        phoneNumber: typeof decoded.phone_number === 'string' ? decoded.phone_number : undefined,
      };
    } catch (err: any) {
      return {
        valid: false,
        error: err?.message || 'Firebase ID token verification failed.',
      };
    }
  }

  const certs = await fetchGoogleSecureTokenCerts();
  if (!certs) {
    return {
      valid: false,
      error: 'Unable to fetch Google public certificates to verify Firebase ID token.',
    };
  }

  return verifyFirebaseJwtWithCertificates(idToken.trim(), certs, FIREBASE_PROJECT_ID);
}

