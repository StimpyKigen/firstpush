/**
 * Authoritative username normalization & validation utilities.
 * Shared identically between frontend signup forms, moderation engine, and backend auth APIs.
 */

export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,16}$/;

export function normalizeUsername(raw?: string | null): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

export function isValidUsernameFormat(raw?: string | null): boolean {
  return USERNAME_REGEX.test(normalizeUsername(raw));
}

export function getUsernameValidationError(raw?: string | null): string | null {
  const clean = normalizeUsername(raw);
  if (clean.length < 3) {
    return 'Username must be at least 3 characters long.';
  }
  if (clean.length > 16) {
    return 'Username cannot exceed 16 characters.';
  }
  if (!/^[A-Za-z0-9_]+$/.test(clean)) {
    return 'Username can only contain letters, numbers, and underscores.';
  }
  return null;
}

export function sanitizeUsernameInput(raw: string): string {
  return String(raw || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16);
}

