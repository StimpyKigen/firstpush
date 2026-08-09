import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Account {
  phone: string; // canonical form: 2547XXXXXXXX / 2541XXXXXXXX
  pin: string; // 4 numeric digits
  username: string;
  createdAt: string;
  avatarId?: string; // id from AVATAR_CATALOG; falls back to initials avatar if unset
}

interface AuthState {
  accounts: Account[];
  currentPhone: string | null;
  isPhoneRegistered: (phone: string) => boolean;
  isUsernameTaken: (username: string) => boolean;
  signUp: (phone: string, pin: string, username: string, avatarId?: string) => { ok: boolean; error?: string };
  logIn: (phone: string, pin: string) => { ok: boolean; error?: string };
  logOut: () => void;
  getCurrentUser: () => Account | null;
  closeAccount: (pin: string) => { ok: boolean; error?: string };
  setAvatar: (avatarId: string) => void;
}

// Normalize any phone input down to a canonical digits-only key
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) {
    return trimmed.replace(/\D/g, '');
  }
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '254' + digits.slice(1);
  } else if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    digits = '254' + digits;
  }
  return digits;
}

export function isValidPhone(raw: string): boolean {
  const norm = normalizePhone(raw);
  return norm.length >= 7 && norm.length <= 15;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

// Canonical admin phone number: 0743304579 -> 254743304579
export const ADMIN_PHONE = '254743304579';

export function isAdminPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return normalizePhone(phone) === ADMIN_PHONE;
}

export function isAdminUser(account: Account | null | undefined): boolean {
  if (!account) return false;
  return isAdminPhone(account.phone);
}

export function isValidUsername(username: string): boolean {
  return /^[A-Za-z0-9]{3,16}$/.test(username);
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accounts: [],
      currentPhone: null,

      isPhoneRegistered: (phone) => {
        const norm = normalizePhone(phone);
        return get().accounts.some((a) => a.phone === norm);
      },

      isUsernameTaken: (username) => {
        const clean = username.trim().toLowerCase();
        return get().accounts.some((a) => a.username.toLowerCase() === clean);
      },

      signUp: (phone, pin, username, avatarId) => {
        const norm = normalizePhone(phone);
        if (!isValidPhone(phone)) return { ok: false, error: 'Enter a valid Kenyan phone number.' };
        if (!isValidPin(pin)) return { ok: false, error: 'PIN must be exactly 4 digits.' };
        if (!isValidUsername(username)) return { ok: false, error: 'Username must be 3-16 letters/numbers only.' };
        if (get().accounts.some((a) => a.phone === norm)) {
          return { ok: false, error: 'This phone number already has an account. Please log in instead.' };
        }
        if (get().isUsernameTaken(username)) {
          return { ok: false, error: 'That username is already taken. Try another one.' };
        }
        const account: Account = { phone: norm, pin, username: username.trim(), createdAt: new Date().toISOString(), avatarId };
        set((state) => ({ accounts: [...state.accounts, account], currentPhone: norm }));
        return { ok: true };
      },

      logIn: (phone, pin) => {
        const norm = normalizePhone(phone);
        if (!isValidPhone(phone)) return { ok: false, error: 'Enter a valid Kenyan phone number.' };
        const account = get().accounts.find((a) => a.phone === norm);
        if (!account) return { ok: false, error: 'No account found for that number. Sign up first.' };
        if (account.pin !== pin) return { ok: false, error: 'Incorrect PIN. Try again.' };
        set({ currentPhone: norm });
        return { ok: true };
      },

      logOut: () => set({ currentPhone: null }),

      getCurrentUser: () => {
        const { currentPhone, accounts } = get();
        if (!currentPhone) return null;
        return accounts.find((a) => a.phone === currentPhone) ?? null;
      },

      closeAccount: (pin) => {
        const { currentPhone, accounts } = get();
        if (!currentPhone) return { ok: false, error: 'You are not logged in.' };
        const account = accounts.find((a) => a.phone === currentPhone);
        if (!account) return { ok: false, error: 'Account not found.' };
        if (account.pin !== pin) return { ok: false, error: 'Incorrect PIN. Account not closed.' };
        set((state) => ({
          accounts: state.accounts.filter((a) => a.phone !== currentPhone),
          currentPhone: null,
        }));
        return { ok: true };
      },

      setAvatar: (avatarId) => {
        const { currentPhone } = get();
        if (!currentPhone) return;
        set((state) => ({
          accounts: state.accounts.map((a) => (a.phone === currentPhone ? { ...a, avatarId } : a)),
        }));
      },
    }),
    { name: 'mshindi-auth' }
  )
);

export function useCurrentUser(): Account | null {
  const currentPhone = useAuth((s) => s.currentPhone);
  const accounts = useAuth((s) => s.accounts);
  if (!currentPhone) return null;
  return accounts.find((a) => a.phone === currentPhone) ?? null;
}
