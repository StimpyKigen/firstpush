/**
 * Client- and server-safe URL validation & external host security helpers.
 * Prevents javascript:/data:/vbscript: XSS links and private/SSRF targets.
 */

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

const DANGEROUS_SCHEME_RE = /^(?:javascript|data|vbscript|file|blob|about|filesystem):/i;

const BARE_DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d{1,5})?(?:[/?#].*)?$/i;

/**
 * Explicit allowlist of supported Kenyan sportsbooks for remote slip inspection.
 * Exact matches and subdomains (e.g. www.betika.com, ke.sportpesa.com) are allowed.
 */
const ALLOWED_SPORTSBOOK_ROOTS = new Set([
  'sportpesa.com',
  'betika.com',
  'mozzartbet.co.ke',
  'odibets.com',
  'shabiki.com',
  'bangbet.com',
  '22bet.co.ke',
  '22bet.com',
  '1xbet.co.ke',
  'betway.co.ke',
  'betgr8.co.ke',
  'cheza.co.ke',
]);

const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'auth',
  'authorization',
  'key',
  'api_key',
  'apikey',
  'secret',
  'password',
  'session',
  'sessionid',
  'sid',
  'sig',
  'signature',
]);

export function hasDangerousUrlScheme(rawUrl?: string | null): boolean {
  if (typeof rawUrl !== 'string') return false;
  // Strip control characters and whitespace so obfuscated "java\tscript:" is still detected.
  const collapsed = rawUrl.replace(/[\u0000-\u0020\u007F]+/g, '');
  return DANGEROUS_SCHEME_RE.test(collapsed);
}

/**
 * Validates and normalizes an external URL strictly to http:// or https://.
 * Returns null for empty, malformed, control-char, credentialed, protocol-relative,
 * or non-HTTP(S) schemes (javascript:, data:, vbscript:, file:, etc.).
 */
export function sanitizeExternalHttpUrl(
  rawUrl?: string | null,
  options?: { bareDomainToHttps?: boolean }
): string | null {
  if (typeof rawUrl !== 'string') return null;

  // Reject ASCII control characters anywhere in the URL.
  if (/[\u0000-\u001F\u007F]/.test(rawUrl)) {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) {
    return null;
  }

  if (hasDangerousUrlScheme(trimmed)) {
    return null;
  }

  // Reject protocol-relative //evil.com or backslash obfuscation before scheme.
  if (trimmed.startsWith('//') || /^[^/?#]*\\/.test(trimmed)) {
    return null;
  }

  let candidate = trimmed;
  const hasExplicitScheme = /^[a-z][a-z0-9+.-]*:/i.test(candidate);
  if (!hasExplicitScheme) {
    if (!options?.bareDomainToHttps || !BARE_DOMAIN_RE.test(candidate)) {
      return null;
    }
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return null;
    }
    // Reject embedded credentials (user:pass@host) and empty hostnames.
    if (!parsed.hostname || parsed.username || parsed.password) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function isIpv4PrivateOrReserved(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : -1));
  if (octets.some((n) => n < 0 || n > 255)) return false;

  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // Link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

/**
 * Checks whether a hostname targets localhost, raw numeric/hex IPv4 aliases, IPv6 local
 * ranges, or private/reserved network infrastructure.
 */
export function isPrivateOrReservedHost(rawHostname: string): boolean {
  const host = rawHostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa')
  ) {
    return true;
  }

  // Block raw integer/hex/octal IP representations such as http://2130706433 or 0x7f000001
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) {
    return true;
  }

  if (isIpv4PrivateOrReserved(host)) {
    return true;
  }

  // Block all IPv6 literals for external proxy lookups (covers ::1, fe80::, fc00::, ::ffff:127.0.0.1)
  if (host.includes(':')) {
    return true;
  }

  return false;
}

/**
 * Checks whether the hostname matches an explicitly supported sportsbook domain.
 */
export function isSafeSportsbookHost(rawHostname: string): boolean {
  const host = rawHostname.trim().toLowerCase().replace(/\.$/, '');
  if (!host || isPrivateOrReservedHost(host)) {
    return false;
  }

  for (const root of ALLOWED_SPORTSBOOK_ROOTS) {
    if (host === root || host.endsWith(`.${root}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Removes sensitive auth/token query parameters and fragments before passing a public
 * sportsbook URL through an external parser/proxy.
 */
export function stripSensitiveQueryParams(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.hash = '';
  return parsed.toString();
}

/**
 * Validates SportScore widget tracker IDs against strict alphanumeric/dash/underscore format.
 */
export function sanitizeSportScoreTrackerId(id: unknown): string | null {
  if (typeof id !== 'string' && typeof id !== 'number') {
    return null;
  }
  const normalized = String(id).trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(normalized)) {
    return null;
  }
  return encodeURIComponent(normalized);
}

