/**
 * Authoritative Kenyan phone normalization & validation utilities.
 * Shared identically by browser stores, Firebase Auth UI, and backend services.
 */

export const ADMIN_PHONE = '254743304579';

const KENYAN_CANONICAL_PHONE_REGEX = /^254(7\d{8}|1\d{8})$/;

/**
 * Normalizes Kenyan phone numbers into canonical `2547XXXXXXXX` / `2541XXXXXXXX` form
 * while stripping all non-digit characters.
 */
export function normalizeKenyanPhone(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const digits = raw.trim().replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('2540') && digits.length === 13) {
    return `254${digits.slice(4)}`;
  }
  if (digits.startsWith('254') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    return `254${digits}`;
  }
  return digits;
}

/**
 * Validates strictly against Safaricom/Airtel/Telkom/Equitel Kenya formats:
 * `2547XXXXXXXX` or `2541XXXXXXXX`.
 */
export function isValidKenyanPhone(raw?: string | null): boolean {
  const norm = normalizeKenyanPhone(raw);
  return KENYAN_CANONICAL_PHONE_REGEX.test(norm);
}

export function isAdminKenyanPhone(raw?: string | null): boolean {
  const norm = normalizeKenyanPhone(raw);
  return Boolean(norm && norm === ADMIN_PHONE);
}

/**
 * Formats phone as E.164 (`+254...`) for Firebase Phone Auth.
 */
export function formatE164KenyanPhone(raw?: string | null): string {
  const trimmed = String(raw || '').trim();
  const normalized = normalizeKenyanPhone(trimmed);
  if (normalized) {
    return `+${normalized}`;
  }
  const fallbackDigits = trimmed.replace(/\D/g, '');
  return fallbackDigits ? `+${fallbackDigits}` : '';
}

