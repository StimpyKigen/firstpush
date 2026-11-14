/**
 * Administrator Authentication & Authorization Service
 *
 * Enforces strict verification for the platform administrator (0743304579 / 254743304579)
 * across all homepage content publishing, editing, archiving, media upload, and deletion routes.
 */

import crypto from 'crypto';
import {
  persistRevokedTokenNonce,
  persistRevokedTokenNonceAsync,
  isTokenNonceRevoked,
  checkTokenNonceRevocationAsync,
} from './tokenRevocationStore.js';
import { ADMIN_SESSION_COOKIE_NAME, getCookieFromHeaders } from './firebaseIdTokenVerifier.js';

export const ADMIN_PHONE_NORMALIZED = '254743304579';
export const MAX_ADMIN_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function getConfiguredAdminPin(): string {
  return (process.env.ADMIN_PIN || '').trim();
}

function getConfiguredAdminTokenSecret(): string {
  return (process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_SECRET || '').trim();
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(getConfiguredAdminPin() && getConfiguredAdminTokenSecret());
}

export function constantTimeEqualText(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf-8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf-8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function normalizeAdminPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return '254' + digits.slice(1);
  }
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) {
    return '254' + digits;
  }
  return digits;
}

export function isAdminIdentifier(phoneOrId?: string | null): boolean {
  if (!phoneOrId) return false;
  return normalizeAdminPhone(phoneOrId) === ADMIN_PHONE_NORMALIZED;
}

/**
 * Generates an HMAC-SHA256 signed, expiring administrator session token with nonce.
 */
export function generateAdminToken(phone: string = ADMIN_PHONE_NORMALIZED): string {
  const normalized = normalizeAdminPhone(phone);
  if (normalized !== ADMIN_PHONE_NORMALIZED) {
    throw new Error('Cannot mint admin token for non-admin phone number.');
  }
  const secret = getConfiguredAdminTokenSecret();
  if (!secret) {
    throw new Error('Administrator token signing secret is not configured.');
  }
  const issuedAt = Date.now();
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `${ADMIN_PHONE_NORMALIZED}:${issuedAt}:${nonce}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

function parseAdminTokenParts(token?: string | null): { nonce: string; exp: number } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split(':');
  if (parts.length !== 4 || !/^[a-f0-9]{16}$/i.test(parts[2])) return null;
  const issuedAt = Number(parts[1]);
  const exp =
    Number.isFinite(issuedAt) && issuedAt > 0
      ? issuedAt + MAX_ADMIN_TOKEN_TTL_MS + 60_000
      : Date.now() + MAX_ADMIN_TOKEN_TTL_MS;
  return { nonce: parts[2], exp };
}

function validateAdminTokenSignatureAndTtl(token?: string | null): { valid: boolean; nonce?: string } {
  if (!token || typeof token !== 'string') return { valid: false };
  const secret = getConfiguredAdminTokenSecret();
  if (!secret) return { valid: false };

  const parts = token.trim().split(':');
  if (parts.length !== 4) return { valid: false };

  const [phonePart, issuedAtStr, nonce, signature] = parts;
  if (normalizeAdminPhone(phonePart) !== ADMIN_PHONE_NORMALIZED) return { valid: false };
  if (!/^[a-f0-9]{16}$/i.test(nonce)) return { valid: false };

  const issuedAt = Number(issuedAtStr);
  const now = Date.now();
  if (
    !Number.isFinite(issuedAt) ||
    issuedAt <= 0 ||
    issuedAt > now + 60_000 ||
    now - issuedAt > MAX_ADMIN_TOKEN_TTL_MS
  ) {
    return { valid: false };
  }

  const payload = `${phonePart}:${issuedAtStr}:${nonce}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  try {
    if (!/^[a-f0-9]+$/i.test(signature)) return { valid: false };
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length || a.length === 0) return { valid: false };
    return crypto.timingSafeEqual(a, b) ? { valid: true, nonce } : { valid: false };
  } catch {
    return { valid: false };
  }
}

/**
 * Revokes an active admin token nonce persistently (sync local fallback wrapper).
 */
export function revokeAdminToken(token?: string | null): boolean {
  const parsed = parseAdminTokenParts(token);
  if (!parsed) return false;
  return persistRevokedTokenNonce(parsed.nonce, parsed.exp);
}

/**
 * Revokes an active admin token nonce persistently across Firestore instances.
 */
export async function revokeAdminTokenAsync(token?: string | null): Promise<boolean> {
  const parsed = parseAdminTokenParts(token);
  if (!parsed) return false;
  return persistRevokedTokenNonceAsync(parsed.nonce, parsed.exp);
}

/**
 * Verifies an HMAC-SHA256 signed, non-expired, non-revoked administrator session token (sync local wrapper).
 */
export function verifyAdminToken(token?: string | null): boolean {
  const sig = validateAdminTokenSignatureAndTtl(token);
  if (!sig.valid || !sig.nonce) return false;
  return !isTokenNonceRevoked(sig.nonce);
}

/**
 * Authoritative async admin token verification backed by shared Firestore revocation store.
 */
export async function verifyAdminTokenAsync(
  token?: string | null
): Promise<{ valid: boolean; storeUnavailable?: boolean }> {
  const sig = validateAdminTokenSignatureAndTtl(token);
  if (!sig.valid || !sig.nonce) return { valid: false };
  const rev = await checkTokenNonceRevocationAsync(sig.nonce);
  if (rev.revoked) {
    return { valid: false, storeUnavailable: rev.unavailable };
  }
  return { valid: true };
}

/**
 * Verifies administrator phone + PIN credentials and issues a signed admin token.
 */
export function verifyAdminPinCredentials(
  phone?: string | null,
  pin?: string | null
): {
  success: boolean;
  valid: boolean;
  misconfigured?: boolean;
  token?: string;
  adminToken?: string;
  error?: string;
} {
  const configuredPin = getConfiguredAdminPin();
  const secret = getConfiguredAdminTokenSecret();
  if (!configuredPin || !secret) {
    return {
      success: false,
      valid: false,
      misconfigured: true,
      error: 'Administrator authentication is not configured on the server.',
    };
  }

  const normalizedPhone = normalizeAdminPhone(phone);
  const cleanPin = String(pin || '').trim();

  if (normalizedPhone !== ADMIN_PHONE_NORMALIZED) {
    return { success: false, valid: false, error: 'Unauthorized phone number' };
  }

  if (!cleanPin || !constantTimeEqualText(cleanPin, configuredPin)) {
    return { success: false, valid: false, error: 'Invalid administrator PIN' };
  }

  const token = generateAdminToken(normalizedPhone);
  return {
    success: true,
    valid: true,
    token,
    adminToken: token,
  };
}

function extractAdminRequestCandidates(
  headers?: Record<string, string | string[] | undefined>,
  body?: any
) {
  const getHeader = (name: string): string => {
    if (!headers) return '';
    const val = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(val)) return val[0] || '';
    return typeof val === 'string' ? val : '';
  };

  const tokenCandidate =
    getHeader('x-admin-token') ||
    (getHeader('authorization').startsWith('Bearer ')
      ? getHeader('authorization').slice(7).trim()
      : '') ||
    getCookieFromHeaders(headers, ADMIN_SESSION_COOKIE_NAME) ||
    (body && typeof body.adminToken === 'string' ? body.adminToken : '');

  const phoneCandidate =
    getHeader('x-admin-phone') ||
    (body && typeof body.adminPhone === 'string' ? body.adminPhone : '') ||
    (body && typeof body.authorId === 'string' ? body.authorId : '');
  const pinCandidate =
    getHeader('x-admin-pin') || (body && typeof body.adminPin === 'string' ? body.adminPin : '');

  return { tokenCandidate, phoneCandidate, pinCandidate };
}

function finalizeAdminCredentialFallback(
  phoneCandidate: string,
  pinCandidate: string,
  body?: any
): { authorized: boolean; reason?: string } {
  if (phoneCandidate && pinCandidate) {
    const check = verifyAdminPinCredentials(phoneCandidate, pinCandidate);
    if (check.valid) return { authorized: true };
    return { authorized: false, reason: check.error };
  }

  if (phoneCandidate && !isAdminIdentifier(phoneCandidate)) {
    return {
      authorized: false,
      reason: `Forbidden: User '${phoneCandidate}' is not an authorized administrator.`,
    };
  }

  if (body && body.authorRole && body.authorRole !== 'admin') {
    return {
      authorized: false,
      reason: `Forbidden: Role '${body.authorRole}' is not authorized to perform administrator actions.`,
    };
  }

  return {
    authorized: false,
    reason: 'Unauthorized: Valid administrator session token or credentials required.',
  };
}

/**
 * Validates whether an incoming HTTP request carries valid cryptographic administrator credentials (sync wrapper).
 */
export function verifyAdminRequest(
  headers?: Record<string, string | string[] | undefined>,
  body?: any
): { authorized: boolean; reason?: string } {
  const { tokenCandidate, phoneCandidate, pinCandidate } = extractAdminRequestCandidates(headers, body);

  if (tokenCandidate && verifyAdminToken(tokenCandidate)) {
    return { authorized: true };
  }

  return finalizeAdminCredentialFallback(phoneCandidate, pinCandidate, body);
}

/**
 * Authoritative async admin request verification with cross-instance Firestore revocation check.
 */
export async function verifyAdminRequestAsync(
  headers?: Record<string, string | string[] | undefined>,
  body?: any
): Promise<{ authorized: boolean; reason?: string; storeUnavailable?: boolean }> {
  const { tokenCandidate, phoneCandidate, pinCandidate } = extractAdminRequestCandidates(headers, body);

  if (tokenCandidate) {
    const tokCheck = await verifyAdminTokenAsync(tokenCandidate);
    if (tokCheck.valid) {
      return { authorized: true };
    }
    if (tokCheck.storeUnavailable) {
      return {
        authorized: false,
        storeUnavailable: true,
        reason: 'Session revocation store unavailable.',
      };
    }
  }

  return finalizeAdminCredentialFallback(phoneCandidate, pinCandidate, body);
}

