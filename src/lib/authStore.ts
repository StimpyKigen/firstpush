import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getRandomGlyphAvatar } from './avatarCatalog';

export interface Account {
  phone: string; // canonical form: 2547XXXXXXXX / 2541XXXXXXXX
  pinHash: string; // salted SHA-256 hash
  pin?: string; // legacy migration field
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

// Pure JS SHA-256 implementation for secure client-side PIN hashing without plaintext storage
function sha256Sync(str: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words: number[] = [];
  const asciiBitLength = str.length * 8;
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let strMod = str + '\x80';
  while ((strMod.length % 64) - 56) strMod += '\x00';
  for (let i = 0; i < strMod.length; i++) {
    const j = strMod.charCodeAt(i);
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength | 0;

  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      const s1h = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1h + ch + k[i] + w[i]) | 0;
      const s0h = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0h + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

export function hashPin(phone: string, pin: string): string {
  return sha256Sync(`mshindi_pin_salt:${phone.trim()}:${pin.trim()}`);
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
        const pinHash = hashPin(norm, pin);
        // Automatically assign a random DiceBear glyph avatar upon successful sign up
        const assignedAvatar = avatarId || getRandomGlyphAvatar().id;
        const account: Account = { phone: norm, pinHash, username: username.trim(), createdAt: new Date().toISOString(), avatarId: assignedAvatar };
        set((state) => ({ accounts: [...state.accounts, account], currentPhone: norm }));
        return { ok: true };
      },

      logIn: (phone, pin) => {
        const norm = normalizePhone(phone);
        if (!isValidPhone(phone)) return { ok: false, error: 'Enter a valid Kenyan phone number.' };
        const account = get().accounts.find((a) => a.phone === norm);
        if (!account) return { ok: false, error: 'No account found for that number. Sign up first.' };
        
        const pinHash = hashPin(norm, pin);
        const matches = account.pinHash ? account.pinHash === pinHash : account.pin === pin;
        if (!matches) return { ok: false, error: 'Incorrect PIN. Try again.' };

        // Seamless migration: upgrade legacy plaintext PIN to salted hash
        if (!account.pinHash) {
          set((state) => ({
            accounts: state.accounts.map((a) => (a.phone === norm ? { ...a, pinHash, pin: undefined } : a)),
          }));
        }

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

        const pinHash = hashPin(currentPhone, pin);
        const matches = account.pinHash ? account.pinHash === pinHash : account.pin === pin;
        if (!matches) return { ok: false, error: 'Incorrect PIN. Account not closed.' };

        set((state) => ({
          accounts: state.accounts.filter((a) => a.phone !== currentPhone),
          currentPhone: null,
        }));
        return { ok: true };
      },

      setAvatar: (_avatarId) => {
        // Avatars are immutable and automatically assigned upon sign-up; editing is disabled
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
