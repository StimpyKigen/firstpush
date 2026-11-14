/**
 * Persistent Server Token Revocation Store
 *
 * Tracks revoked session nonces/JTIs (`adminToken` & `utok.` user session tokens)
 * with expiration pruning so logout and account-closure revocations survive
 * across requests and server restarts.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_REVOCATION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours (covers max 1h token TTL + drift)

let cachedRevocations: Map<string, number> | null = null;

function resolveRevocationFilePath(): string {
  const cwdFile = path.resolve(process.cwd(), '.data', 'revoked_tokens.json');
  const tmpFile = path.join(os.tmpdir(), 'mshindi_revoked_tokens.json');
  if (fs.existsSync(cwdFile)) return cwdFile;
  if (process.env.VERCEL === '1') return tmpFile;
  return cwdFile;
}

function pruneExpired(map: Map<string, number>, now: number = Date.now()): void {
  for (const [nonce, exp] of map.entries()) {
    if (!Number.isFinite(exp) || exp <= now) {
      map.delete(nonce);
    }
  }
}

function loadRevocations(): Map<string, number> {
  if (cachedRevocations) {
    pruneExpired(cachedRevocations);
    return cachedRevocations;
  }

  const map = new Map<string, number>();
  const filePath = resolveRevocationFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof k === 'string' && typeof v === 'number' && Number.isFinite(v)) {
            map.set(k.toLowerCase(), v);
          }
        }
      }
    }
  } catch {
    // Non-fatal: start with empty revocation map if disk unreadable
  }
  pruneExpired(map);
  cachedRevocations = map;
  return map;
}

function saveRevocations(map: Map<string, number>): void {
  pruneExpired(map);
  const obj: Record<string, number> = {};
  for (const [k, v] of map.entries()) {
    obj[k] = v;
  }
  const serialized = JSON.stringify(obj);

  const candidates =
    process.env.VERCEL === '1'
      ? [path.join(os.tmpdir(), 'mshindi_revoked_tokens.json')]
      : [
          path.resolve(process.cwd(), '.data', 'revoked_tokens.json'),
          path.join(os.tmpdir(), 'mshindi_revoked_tokens.json'),
        ];

  for (const target of candidates) {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, serialized, 'utf-8');
      return;
    } catch {
      // Fallback to /tmp if workspace directory is read-only
    }
  }
}

export function persistRevokedTokenNonce(
  nonce: string,
  expiresAtMs: number = Date.now() + DEFAULT_REVOCATION_TTL_MS
): boolean {
  const clean = String(nonce || '').trim().toLowerCase();
  if (!/^[a-f0-9]{16}$/.test(clean)) return false;

  const map = loadRevocations();
  map.set(clean, Math.max(expiresAtMs, Date.now() + 60_000));
  saveRevocations(map);
  return true;
}

export function isTokenNonceRevoked(nonce?: string | null): boolean {
  if (!nonce || typeof nonce !== 'string') return false;
  const clean = nonce.trim().toLowerCase();
  if (!/^[a-f0-9]{16}$/.test(clean)) return false;

  const map = loadRevocations();
  const exp = map.get(clean);
  if (exp === undefined) return false;
  if (exp <= Date.now()) {
    map.delete(clean);
    return false;
  }
  return true;
}

export function resetRevocationCacheForTests(): void {
  cachedRevocations = null;
}

