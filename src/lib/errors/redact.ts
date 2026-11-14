/**
 * Developer-diagnostics redaction.
 *
 * Everything written to logs (console, the in-memory ring buffer or an external
 * monitoring sink) passes through here first so that credentials, session
 * material and personal data never end up in diagnostics.
 *
 * This module is isomorphic (browser + Node) and has no DOM dependencies.
 */

const REDACTED = '[REDACTED]';

/** Object keys whose values must never be logged. */
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|set-cookie|password|passwd|pin|secret|token|apikey|api_key|api-key|credential|private|signature|otp|sms[-_]?code|verification[-_]?code|mpesa[-_]?code|confirmation[-_]?code|idtoken|refresh|session|phone|msisdn|email)/i;

/** Free-text patterns that look like secrets or personal data. */
const TEXT_REDACTIONS: Array<[RegExp, string]> = [
  // Bearer / Basic authorization values
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${REDACTED}`],
  // JSON Web Tokens
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, REDACTED],
  // Google / Firebase API keys
  [/\bAIza[0-9A-Za-z_-]{20,}\b/g, REDACTED],
  // key=value style secrets in URLs or strings
  [
    /\b(api[_-]?key|access[_-]?token|id[_-]?token|refresh[_-]?token|secret|password|pin|otp|code)=([^&\s"']+)/gi,
    `$1=${REDACTED}`,
  ],
  // Kenyan / international phone numbers
  [/(\+?254|\b0)[17]\d{8}\b/g, REDACTED],
  [/\+\d{10,14}\b/g, REDACTED],
  // Email addresses
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED],
  // M-Pesa style confirmation codes (10 chars, upper-case + digits, at least one digit)
  [/\b(?=[A-Z0-9]{10}\b)(?=[A-Z]*\d)(?=\d*[A-Z])[A-Z0-9]{10}\b/g, REDACTED],
];

export function redactText(input: unknown): string {
  let out = typeof input === 'string' ? input : safeToString(input);
  for (const [pattern, replacement] of TEXT_REDACTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function safeToString(value: unknown): string {
  try {
    if (value instanceof Error) return value.message;
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    return String(value);
  } catch {
    return '[unserializable]';
  }
}

export interface RedactOptions {
  maxDepth?: number;
  maxStringLength?: number;
}

/**
 * Deep-redacts an arbitrary value for logging. Errors are flattened to a plain
 * object so that stacks stay available to developers (with secrets scrubbed).
 */
export function redactForLog(value: unknown, options: RedactOptions = {}): unknown {
  const maxDepth = options.maxDepth ?? 4;
  const maxLen = options.maxStringLength ?? 2000;
  const seen = new WeakSet<object>();

  const walk = (v: unknown, depth: number, keyHint?: string): unknown => {
    if (keyHint && SENSITIVE_KEY_PATTERN.test(keyHint)) return REDACTED;
    if (v === null || v === undefined) return v;
    if (typeof v === 'string') {
      const redacted = redactText(v);
      return redacted.length > maxLen ? `${redacted.slice(0, maxLen)}…[truncated]` : redacted;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'function' || typeof v === 'symbol') return `[${typeof v}]`;
    if (typeof v === 'bigint') return v.toString();
    if (depth >= maxDepth) return '[max-depth]';

    if (v instanceof Error) {
      const anyErr = v as Error & { code?: unknown; statusCode?: unknown; status?: unknown };
      return {
        name: v.name,
        message: walk(v.message, depth + 1),
        code: anyErr.code !== undefined ? walk(String(anyErr.code), depth + 1) : undefined,
        status: anyErr.statusCode ?? anyErr.status,
        stack: typeof v.stack === 'string' ? walk(v.stack, depth + 1) : undefined,
      };
    }

    if (typeof v === 'object') {
      if (seen.has(v as object)) return '[circular]';
      seen.add(v as object);
      if (Array.isArray(v)) return v.slice(0, 25).map((item) => walk(item, depth + 1));
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>).slice(0, 40)) {
        out[k] = walk(val, depth + 1, k);
      }
      return out;
    }
    return REDACTED;
  };

  return walk(value, 0);
}

