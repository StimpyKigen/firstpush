/**
 * Turns any thrown value / failed response into an ErrorKind.
 *
 * The classifier only ever reads the *shape* of an error (name, code, HTTP
 * status, message keywords). It never returns the raw text; user copy comes
 * exclusively from the catalogue.
 */
import type { ErrorKind } from './errorCatalog';

/** The part of the product the failed operation belongs to. */
export type ErrorDomain =
  | 'payment'
  | 'token'
  | 'subscription'
  | 'upload'
  | 'chat'
  | 'fixtures'
  | 'search'
  | 'update'
  | 'content'
  | 'auth'
  | 'general';

export interface ClassifyContext {
  domain?: ErrorDomain;
  /** HTTP status when the caller already has it (e.g. `res.status`). */
  status?: number;
}

interface ErrorLike {
  name?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  message?: unknown;
  error?: unknown;
  response?: { status?: unknown };
}

const NETWORK_MESSAGE =
  /(failed to fetch|networkerror|network request failed|network error|load failed|fetch failed|econnreset|econnrefused|enotfound|eai_again|socket hang up|err_internet_disconnected|err_network|connection (?:was )?(?:lost|reset|closed)|unable to reach|could not reach|backend api unreachable)/i;
const TIMEOUT_MESSAGE = /(timed? ?out|timeout|etimedout|deadline[-_ ]exceeded|took too long)/i;
const PERMISSION_MESSAGE = /(permission[-_ ]denied|insufficient permissions|forbidden|not authorized|unauthorized)/i;
const SESSION_MESSAGE = /(session (?:has )?expired|token (?:has )?expired|id-token-expired|invalid or expired (?:user )?session|authentication required|not signed in|sign in required)/i;
const RATE_MESSAGE = /(too many requests|rate limit|quota[-_ ]exceeded|resource[-_ ]exhausted|cooldown)/i;
const NOT_FOUND_MESSAGE = /(not[-_ ]found|does not exist|no such)/i;
const SIZE_MESSAGE = /(payload too large|too large|file size|exceeds? .*(?:size|limit)|larger than)/i;

const AUTH_CODE_MAP: Record<string, ErrorKind> = {
  'auth/network-request-failed': 'connection-lost',
  'auth/too-many-requests': 'rate-limited',
  'auth/quota-exceeded': 'rate-limited',
  'auth/user-token-expired': 'session-expired',
  'auth/id-token-expired': 'session-expired',
  'auth/requires-recent-login': 'session-expired',
  'auth/user-disabled': 'access-denied',
  'auth/user-not-found': 'access-denied',
  'auth/invalid-credential': 'access-denied',
  'auth/unauthorized-domain': 'server',
  'auth/operation-not-allowed': 'server',
  'auth/internal-error': 'server',
  'auth/captcha-check-failed': 'server',
  'auth/missing-client-identifier': 'server',
  'auth/invalid-phone-number': 'validation',
  'auth/invalid-verification-code': 'validation',
  'auth/code-expired': 'validation',
  'auth/missing-phone-number': 'validation',
};

const FIRESTORE_CODE_MAP: Record<string, ErrorKind> = {
  'permission-denied': 'access-denied',
  unauthenticated: 'session-expired',
  'not-found': 'not-found',
  unavailable: 'server',
  'deadline-exceeded': 'timeout',
  'resource-exhausted': 'rate-limited',
  cancelled: 'connection-lost',
  aborted: 'connection-lost',
  internal: 'server',
  'data-loss': 'server',
  'failed-precondition': 'server',
  'already-exists': 'update-failed',
  'invalid-argument': 'validation',
  'out-of-range': 'validation',
};

const STORAGE_CODE_MAP: Record<string, ErrorKind> = {
  'storage/unauthorized': 'access-denied',
  'storage/unauthenticated': 'session-expired',
  'storage/object-not-found': 'not-found',
  'storage/retry-limit-exceeded': 'timeout',
  'storage/quota-exceeded': 'server',
  'storage/canceled': 'upload-failed',
  'storage/invalid-checksum': 'upload-failed',
  'storage/server-file-wrong-size': 'upload-failed',
  'storage/unknown': 'upload-failed',
};

export function kindFromStatus(status: number): ErrorKind | null {
  if (!Number.isFinite(status) || status < 400) return null;
  if (status === 401) return 'session-expired';
  if (status === 403) return 'access-denied';
  if (status === 404 || status === 410) return 'not-found';
  if (status === 408 || status === 504) return 'timeout';
  if (status === 413 || status === 415) return 'file-invalid';
  if (status === 409) return 'update-failed';
  if (status === 422 || status === 400) return 'validation';
  if (status === 429) return 'rate-limited';
  if (status === 503) return 'maintenance';
  if (status >= 500) return 'server';
  return null;
}

function readStatus(err: ErrorLike, ctx?: ClassifyContext): number | undefined {
  const candidates = [ctx?.status, err.status, err.statusCode, err.response?.status];
  for (const c of candidates) {
    const n = typeof c === 'string' ? Number(c) : c;
    if (typeof n === 'number' && Number.isFinite(n) && n >= 100) return n;
  }
  return undefined;
}

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Kinds produced by transport / backend failures where the outcome may be unknown. */
const UNCERTAIN_KINDS: ReadonlySet<ErrorKind> = new Set<ErrorKind>([
  'offline',
  'connection-lost',
  'timeout',
  'server',
  'maintenance',
  'unknown',
]);

function applyDomain(kind: ErrorKind, domain: ErrorDomain | undefined): ErrorKind {
  if (!domain || domain === 'general' || domain === 'auth' || domain === 'content') return kind;

  switch (domain) {
    case 'payment':
      if (UNCERTAIN_KINDS.has(kind)) return 'payment-pending';
      if (kind === 'update-failed' || kind === 'validation' || kind === 'not-found') return 'payment-failed';
      return kind;
    case 'token':
      if (UNCERTAIN_KINDS.has(kind) || kind === 'update-failed') return 'token-failed';
      return kind;
    case 'subscription':
      if (UNCERTAIN_KINDS.has(kind)) return 'subscription-delayed';
      return kind;
    case 'upload':
      if (kind === 'file-invalid' || kind === 'offline') return kind;
      if (UNCERTAIN_KINDS.has(kind) || kind === 'update-failed') return 'upload-failed';
      return kind;
    case 'chat':
      if (UNCERTAIN_KINDS.has(kind) || kind === 'update-failed') return kind === 'offline' ? kind : 'chat-failed';
      return kind;
    case 'fixtures':
      if (UNCERTAIN_KINDS.has(kind) && kind !== 'offline') return 'fixtures-failed';
      return kind;
    case 'search':
      if (UNCERTAIN_KINDS.has(kind) && kind !== 'offline') return 'search-failed';
      return kind;
    case 'update':
      if (UNCERTAIN_KINDS.has(kind) && kind !== 'offline') return 'update-failed';
      return kind;
    default:
      return kind;
  }
}

function classifyBase(input: unknown, ctx?: ClassifyContext): ErrorKind {
  // HTTP status takes precedence when known.
  const objectLike: ErrorLike | null =
    input && typeof input === 'object' ? (input as ErrorLike) : null;

  const status = objectLike ? readStatus(objectLike, ctx) : ctx?.status;
  if (typeof status === 'number') {
    const fromStatus = kindFromStatus(status);
    if (fromStatus) return fromStatus;
  }

  const code = objectLike && typeof objectLike.code === 'string' ? objectLike.code : '';
  if (code) {
    if (AUTH_CODE_MAP[code]) return AUTH_CODE_MAP[code];
    if (STORAGE_CODE_MAP[code]) return STORAGE_CODE_MAP[code];
    const bare = code.replace(/^firestore\//, '');
    if (FIRESTORE_CODE_MAP[bare]) return FIRESTORE_CODE_MAP[bare];
    if (code.startsWith('auth/')) return 'access-denied';
    if (code.startsWith('storage/')) return 'upload-failed';
  }

  const name = objectLike && typeof objectLike.name === 'string' ? objectLike.name : '';
  if (name === 'AbortError' || name === 'TimeoutError') return 'timeout';

  const message =
    typeof input === 'string'
      ? input
      : objectLike && typeof objectLike.message === 'string'
        ? objectLike.message
        : objectLike && typeof objectLike.error === 'string'
          ? objectLike.error
          : '';

  if (message) {
    if (NETWORK_MESSAGE.test(message)) return isBrowserOffline() ? 'offline' : 'connection-lost';
    if (TIMEOUT_MESSAGE.test(message)) return 'timeout';
    if (SESSION_MESSAGE.test(message)) return 'session-expired';
    if (PERMISSION_MESSAGE.test(message)) return 'access-denied';
    if (RATE_MESSAGE.test(message)) return 'rate-limited';
    if (SIZE_MESSAGE.test(message)) return 'file-invalid';
    if (NOT_FOUND_MESSAGE.test(message)) return 'not-found';
    if (/(internal server error|bad gateway|service unavailable|http 5\d\d|status code 5\d\d)/i.test(message)) {
      return 'server';
    }
    if (name === 'TypeError' && /fetch/i.test(message)) {
      return isBrowserOffline() ? 'offline' : 'connection-lost';
    }
  }

  return isBrowserOffline() ? 'offline' : 'unknown';
}

/** Public entry point. */
export function classifyError(input: unknown, ctx?: ClassifyContext): ErrorKind {
  return applyDomain(classifyBase(input, ctx), ctx?.domain);
}
