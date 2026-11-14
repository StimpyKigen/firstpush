/**
 * Safe, user-facing error mapping.
 *
 * - `toUserError`        : any thrown value  -> catalogue entry (never raw text)
 * - `sanitizeUserMessage`: a string coming from a service/server -> either the
 *                          original (if it is already a human sentence) or a
 *                          catalogue message (if it looks technical).
 * - `clientSafeServerMessage`: the same idea for server responses, additionally
 *                          mapping internal error codes and stripping ids.
 */
import {
  ACTION_LABELS,
  ERROR_CATALOG,
  type ErrorActionId,
  type ErrorDefinition,
  type ErrorKind,
} from './errorCatalog';
import { classifyError, kindFromStatus, type ClassifyContext } from './classifyError';
import { reportError } from './errorReporter';

export interface UserError extends ErrorDefinition {
  /** True when `message` came from an intentional, human-written service message. */
  fromService: boolean;
}

/**
 * Patterns that indicate a string is developer-facing. Anything matching is
 * replaced by catalogue copy before it can reach the UI.
 */
const TECHNICAL_PATTERNS: RegExp[] = [
  /firebase|firestore|firebaseapp|googleapis|gstatic|identitytoolkit|cloudfunctions|grpc/i,
  /\b(auth|storage|functions|firestore)\/[a-z0-9-]+\b/i,
  /permission[-_ ]denied|insufficient permissions|missing or insufficient/i,
  /\b(TypeError|RangeError|ReferenceError|SyntaxError|EvalError|URIError|AggregateError|DOMException)\b/,
  /\b\w*Error:/,
  /cannot read propert|is not a function|is not defined|is not iterable|undefined|\bnull\b is not|\[object /i,
  /unexpected token|unexpected end of json|json\.parse|in json at position|is not valid json/i,
  /\bhttp[ /]?\d{3}\b|status(?: code)?:? ?[45]\d\d\b|\b[45]\d\d (?:internal|bad|service|not found|forbidden|unauthorized)/i,
  /internal server error|bad gateway|service unavailable|gateway time-?out/i,
  /\be(?:conn\w+|notfound|timedout|ai_again|pipe)\b/i,
  /failed to fetch|fetch failed|networkerror|network request failed|load failed/i,
  /(?:^|\s)at [\w$.<>]+ \(.*:\d+:\d+\)|\bat .*:\d+:\d+\b/,
  /node_modules|[A-Za-z]:\\|\/(?:src|dist|app|usr|var|home|opt)\/|\.(?:ts|tsx|js|cjs|mjs)(?::\d+)?\b/i,
  /https?:\/\/|\/api\/|\bendpoint\b/i,
  /\b(?:db|database|collection|document|snapshot|ledger|transaction id|tokenid|useruid|userid|uid)\b/i,
  /backend api|api unreachable|upstream|proxy|reCAPTCHA|recaptcha|sdk|stack ?trace|stacktrace/i,
  /\b(?:storage|read|write|verification|parse|conversion|cleanup) error\b|failed to (?:upload|decode|verify|parse|sync|publish|initialize)\b|\bwebp\b/i,
  /\b(?:INSUFFICIENT_TOKENS|UNAUTHORIZED_TOKEN_OWNERSHIP|TOKEN_ALREADY_CONSUMED|TOKEN_NOT_FOUND|ATOMIC_INVARIANT_VIOLATION|SECURITY_VIOLATION|SIMULATED_TRANSACTION_FAILURE|CRITICAL)\b/,
  /\b(?:unauthorized|forbidden):/i,
  /environment variable|\.env\b|secret is not configured|signing secret|api[_ -]?key|access[_ -]?token|bearer /i,
  /console ->|firebase console|authorized domains|sign-in method/i,
  /\b\d{9,}\b/, // phone numbers / long internal ids
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, // uuids
  /\[[a-z]+\/[a-z-]+\]|\([A-Za-z]+\/[a-z-]+\)/i, // [auth/xyz] suffixes
];

const MAX_PASSTHROUGH_LENGTH = 220;

export function looksTechnical(text: string): boolean {
  if (!text) return false;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(text));
}

function buildUserError(kind: ErrorKind, overrideMessage?: string): UserError {
  const def = ERROR_CATALOG[kind];
  return {
    ...def,
    actions: [...def.actions],
    message: overrideMessage ?? def.message,
    fromService: overrideMessage !== undefined,
  };
}

/**
 * Maps any thrown value / failed response to a safe `UserError`.
 * Technical details are reported to developers (redacted) but never returned.
 */
export function toUserError(
  err: unknown,
  ctx?: ClassifyContext & { source?: string; report?: boolean },
): UserError {
  const kind = classifyError(err, ctx);
  if (ctx?.report !== false) {
    reportError(err, { source: ctx?.source ?? 'ui', domain: ctx?.domain, kind });
  }
  return buildUserError(kind);
}

/**
 * For strings returned by services / servers (`{ ok:false, error:'…' }`).
 *
 * - Human-written business messages ("This code has already been redeemed")
 *   are preserved so users keep specific next steps.
 * - Anything that looks technical is swapped for catalogue copy.
 */
export function sanitizeUserMessage(
  raw: unknown,
  ctx?: ClassifyContext & { source?: string; fallback?: ErrorKind },
): string {
  return resolveServiceError(raw, ctx).message;
}

export function resolveServiceError(
  raw: unknown,
  ctx?: ClassifyContext & { source?: string; fallback?: ErrorKind },
): UserError {
  const text = typeof raw === 'string' ? raw.trim() : '';

  if (text && text.length <= MAX_PASSTHROUGH_LENGTH && !looksTechnical(text)) {
    // Preserve the intentional sentence, but still classify so the caller can
    // pick the right icon/actions (e.g. payment domain).
    const kind = ctx?.fallback ?? classifyError(text, ctx);
    return buildUserError(kind, text);
  }

  if (text) {
    reportError(text, { source: ctx?.source ?? 'service-message', domain: ctx?.domain });
  }
  const classified = text || raw ? classifyError(raw ?? text, ctx) : (ctx?.fallback ?? 'unknown');
  const kind = classified === 'unknown' && ctx?.fallback ? ctx.fallback : classified;
  return buildUserError(kind);
}

/**
 * Internal server error codes -> plain-language client messages.
 * Server code keeps the original text for logs/tests; only the HTTP payload is mapped.
 */
const SERVER_CODE_MESSAGES: Array<[RegExp, string]> = [
  [/INSUFFICIENT_TOKENS/, "You don't have enough Mshindi Tokens for this. Check your balance and try again."],
  [/TOKEN_ALREADY_CONSUMED/, 'Those tokens have already been used. Please refresh your wallet.'],
  [
    /UNAUTHORIZED_TOKEN_OWNERSHIP|TOKEN_NOT_FOUND|ATOMIC_INVARIANT_VIOLATION/,
    "We couldn't use those tokens. Please refresh your wallet and try again.",
  ],
  [/SECURITY_VIOLATION/, "That action isn't available from the app."],
  [/^Forbidden:/i, "You don't have permission to do that."],
  [/Authentication required|Invalid or expired user session/i, 'Please sign in again to continue.'],
];

const STATUS_FALLBACK: Record<number, ErrorKind> = {
  400: 'validation',
  401: 'session-expired',
  403: 'access-denied',
  404: 'not-found',
  409: 'update-failed',
  429: 'rate-limited',
};

/**
 * Use at the HTTP boundary (server) to make sure `error` fields never carry
 * internal ids, codes, phone numbers or exception text.
 */
export function clientSafeServerMessage(raw: unknown, status?: number): string {
  const text = typeof raw === 'string' ? raw.trim() : '';
  for (const [pattern, message] of SERVER_CODE_MESSAGES) {
    if (pattern.test(text)) return message;
  }
  if (text && text.length <= MAX_PASSTHROUGH_LENGTH && !looksTechnical(text)) return text;

  const kind =
    (typeof status === 'number' && (STATUS_FALLBACK[status] ?? kindFromStatus(status))) ||
    classifyError(text, { status });
  return ERROR_CATALOG[kind === 'unknown' ? 'server' : kind].message;
}

/** Convenience used by buttons: label for an action id. */
export function actionLabel(id: ErrorActionId): string {
  return ACTION_LABELS[id];
}

