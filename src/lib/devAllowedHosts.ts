/**
 * Explicit hostname allowlist for Vite dev server (`server.allowedHosts`).
 * Replaces permissive `allowedHosts: true` while still allowing localhost
 * and explicitly configured preview/tunnel domains from environment config.
 */

const DEFAULT_DEV_ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1', '.localhost'];

function normalizeHostEntry(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed === '*' || trimmed === 'all' || trimmed === 'true') {
    return null;
  }

  try {
    if (trimmed.includes('://')) {
      const parsed = new URL(trimmed);
      return parsed.hostname.toLowerCase() || null;
    }
  } catch {
    return null;
  }

  // Handle IPv6 bracket notation cleanly before stripping optional :port
  if (trimmed.startsWith('[')) {
    const endIdx = trimmed.indexOf(']');
    if (endIdx > 1) {
      return trimmed.slice(1, endIdx);
    }
    return null;
  }

  const colonCount = (trimmed.match(/:/g) || []).length;
  const hostWithoutPort = colonCount === 1 ? trimmed.split(':')[0] : trimmed;
  const cleanHost = hostWithoutPort.replace(/\/.*$/, '').trim();

  if (!cleanHost || /[\s/\\?#*]/.test(cleanHost)) {
    return null;
  }

  return cleanHost;
}

export function getDevAllowedHosts(env: Record<string, string | undefined> = process.env): string[] {
  const allowed = new Set<string>(DEFAULT_DEV_ALLOWED_HOSTS);

  const envSources = [
    env.VITE_DEV_ALLOWED_HOSTS || '',
    env.APP_URL || '',
    env.NEXT_PUBLIC_APP_URL || '',
    env.ALLOWED_ORIGINS || '',
  ];

  for (const source of envSources) {
    if (!source) continue;
    for (const part of source.split(',')) {
      const normalized = normalizeHostEntry(part);
      if (normalized) {
        allowed.add(normalized);
      }
    }
  }

  return Array.from(allowed);
}

