import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { notifySessionChanged } from './sessionLifecycle';
import {
  ADMIN_PHONE as CANONICAL_ADMIN_PHONE,
  isAdminKenyanPhone,
  isValidKenyanPhone,
  normalizeKenyanPhone,
} from './phoneUtils.js';
import { isValidUsernameFormat } from './usernameUtils.js';

export interface Account {
  phone: string; // canonical form: 2547XXXXXXXX / 2541XXXXXXXX
  username: string;
  createdAt: string;
  avatarId?: string;
  role?: 'user' | 'admin';
  verifiedWithSms?: boolean;
  lastLoginAt?: string;
}

export interface AuthActionResult {
  ok: boolean;
  user?: Account;
  error?: string;
}

interface AuthState {
  currentUser: Account | null;
  currentPhone: string | null;
  userSessionToken: string | null;
  sessionHydrated: boolean;
  isPhoneRegistered: (phone: string) => boolean;
  isUsernameTaken: (username: string) => boolean;
  checkUsernameAvailability: (username: string) => Promise<boolean>;
  hydrateSession: () => Promise<Account | null>;
  signUp: (
    phone: string,
    pin: string,
    username: string,
    avatarId?: string,
    firebaseIdToken?: string | null
  ) => Promise<AuthActionResult>;
  logIn: (
    phone: string,
    pin: string,
    firebaseIdToken?: string | null
  ) => Promise<AuthActionResult>;
  exchangeFirebaseSession: (
    firebaseIdToken: string
  ) => Promise<{ ok: boolean; registered?: boolean; phone?: string; user?: Account; error?: string }>;
  logOut: () => Promise<void>;
  getCurrentUser: () => Account | null;
  closeAccount: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  setAvatar: (avatarId: string) => void;
  setSessionToken: (token: string | null) => void;
}

// Normalize any phone input down to a canonical digits-only key
export function normalizePhone(raw: string): string {
  return normalizeKenyanPhone(raw);
}

export function isValidPhone(raw: string): boolean {
  return isValidKenyanPhone(raw);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

// Canonical admin phone number: 0743304579 -> 254743304579
export const ADMIN_PHONE = CANONICAL_ADMIN_PHONE;

export function isAdminPhone(phone: string | null | undefined): boolean {
  return isAdminKenyanPhone(phone);
}

export function isAdminUser(account: Account | null | undefined): boolean {
  if (!account) return false;
  return account.role === 'admin' && isAdminPhone(account.phone);
}

export function isValidUsername(username: string): boolean {
  return isValidUsernameFormat(username);
}

function buildAuthFetchHeaders(sessionToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (sessionToken) {
    headers['x-user-token'] = sessionToken;
  }
  return headers;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      currentPhone: null,
      userSessionToken: null,
      sessionHydrated: false,

      // Deprecated synchronous checks retained as safe no-op shims; authoritative checks run on the server.
      isPhoneRegistered: () => false,
      isUsernameTaken: () => false,

      checkUsernameAvailability: async (username: string) => {
        const clean = username.trim();
        if (!clean) return false;
        try {
          const res = await fetch(
            `/api/auth/availability?username=${encodeURIComponent(clean)}`,
            { credentials: 'include' }
          );
          if (!res.ok) return true;
          const data = await res.json();
          return Boolean(data?.available);
        } catch {
          return true;
        }
      },

      hydrateSession: async () => {
        try {
          const res = await fetch('/api/auth/me', {
            method: 'GET',
            headers: buildAuthFetchHeaders(get().userSessionToken),
            credentials: 'include',
          });
          if (!res.ok) {
            set({ sessionHydrated: true });
            return get().currentUser;
          }
          const data = await res.json();
          if (data?.authenticated && data?.user) {
            const user = data.user as Account;
            set({
              currentUser: user,
              currentPhone: user.phone,
              userSessionToken:
                typeof data.userSessionToken === 'string' && data.userSessionToken
                  ? data.userSessionToken
                  : get().userSessionToken,
              sessionHydrated: true,
            });
            notifySessionChanged(user.phone);
            return user;
          }
          set({
            currentUser: null,
            currentPhone: null,
            userSessionToken: null,
            sessionHydrated: true,
          });
          notifySessionChanged(null);
          return null;
        } catch {
          set({ sessionHydrated: true });
          return get().currentUser;
        }
      },

      signUp: async (phone, pin, username, avatarId, firebaseIdToken) => {
        const norm = normalizePhone(phone);
        const cleanUsername = username.trim();

        if (!isValidPhone(norm)) {
          return { ok: false, error: 'Enter a valid phone number (e.g. 0743 304 579).' };
        }
        if (!isValidPin(pin)) {
          return { ok: false, error: 'PIN must be exactly 4 digits.' };
        }
        if (!isValidUsername(cleanUsername)) {
          return { ok: false, error: 'Username must be 3-16 letters or numbers.' };
        }

        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              phone: norm,
              pin: pin.trim(),
              username: cleanUsername,
              avatarId: avatarId || 'default',
              ...(firebaseIdToken ? { firebaseIdToken } : {}),
            }),
          });
          const data = await res.json();
          if (!res.ok || !data?.success || !data?.user) {
            return {
              ok: false,
              error: data?.error || 'Could not complete registration. Please try again.',
            };
          }

          const created = data.user as Account;
          set({
            currentUser: created,
            currentPhone: created.phone,
            userSessionToken:
              typeof data.userSessionToken === 'string' ? data.userSessionToken : null,
            sessionHydrated: true,
          });
          notifySessionChanged(created.phone);
          return { ok: true, user: created };
        } catch {
          return {
            ok: false,
            error: 'Unable to reach the authentication server. Please check your connection.',
          };
        }
      },

      logIn: async (phone, pin, firebaseIdToken) => {
        const norm = normalizePhone(phone);
        if (!isValidPhone(norm) || !isValidPin(pin)) {
          return { ok: false, error: 'Enter a valid phone number and 4-digit PIN.' };
        }

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              phone: norm,
              pin: pin.trim(),
              ...(firebaseIdToken ? { firebaseIdToken } : {}),
            }),
          });
          const data = await res.json();
          if (!res.ok || !data?.success || !data?.user) {
            return {
              ok: false,
              error: data?.error || 'Invalid phone number or PIN.',
            };
          }

          const loggedInUser = data.user as Account;
          set({
            currentUser: loggedInUser,
            currentPhone: loggedInUser.phone,
            userSessionToken:
              typeof data.userSessionToken === 'string' ? data.userSessionToken : null,
            sessionHydrated: true,
          });
          notifySessionChanged(loggedInUser.phone);
          return { ok: true, user: loggedInUser };
        } catch {
          return {
            ok: false,
            error: 'Unable to reach the authentication server. Please check your connection.',
          };
        }
      },

      exchangeFirebaseSession: async (firebaseIdToken: string) => {
        try {
          const res = await fetch('/api/auth/firebase-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ firebaseIdToken }),
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            return {
              ok: false,
              error: data?.error || 'Could not verify phone session.',
            };
          }
          if (data.registered && data.user) {
            const user = data.user as Account;
            set({
              currentUser: user,
              currentPhone: user.phone,
              userSessionToken:
                typeof data.userSessionToken === 'string' ? data.userSessionToken : null,
              sessionHydrated: true,
            });
            notifySessionChanged(user.phone);
            return { ok: true, registered: true, user, phone: user.phone };
          }
          return {
            ok: true,
            registered: false,
            phone: typeof data.phone === 'string' ? data.phone : undefined,
          };
        } catch {
          return {
            ok: false,
            error: 'Unable to verify Firebase session with the server.',
          };
        }
      },

      logOut: async () => {
        const token = get().userSessionToken;
        let adminToken = '';
        if (typeof window !== 'undefined') {
          try {
            adminToken = window.localStorage.getItem('mshindi_admin_token_v1') || '';
            window.localStorage.removeItem('mshindi_admin_token_v1');
          } catch {}
        }

        set({
          currentUser: null,
          currentPhone: null,
          userSessionToken: null,
          sessionHydrated: true,
        });
        notifySessionChanged(null);

        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: buildAuthFetchHeaders(token),
            credentials: 'include',
            body: JSON.stringify({
              ...(token ? { userSessionToken: token } : {}),
              ...(adminToken ? { adminToken } : {}),
            }),
          });
        } catch {}
      },

      getCurrentUser: () => {
        return get().currentUser;
      },

      closeAccount: async (pin) => {
        const token = get().userSessionToken;
        let adminToken = '';
        if (typeof window !== 'undefined') {
          try {
            adminToken = window.localStorage.getItem('mshindi_admin_token_v1') || '';
          } catch {}
        }

        try {
          const res = await fetch('/api/auth/close-account', {
            method: 'POST',
            headers: buildAuthFetchHeaders(token),
            credentials: 'include',
            body: JSON.stringify({
              pin: pin.trim(),
              ...(token ? { userSessionToken: token } : {}),
              ...(adminToken ? { adminToken } : {}),
            }),
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            return {
              ok: false,
              error: data?.error || 'Could not close account. Check your PIN and try again.',
            };
          }

          if (typeof window !== 'undefined') {
            try {
              window.localStorage.removeItem('mshindi_admin_token_v1');
            } catch {}
          }

          set({
            currentUser: null,
            currentPhone: null,
            userSessionToken: null,
            sessionHydrated: true,
          });
          notifySessionChanged(null);
          return { ok: true };
        } catch {
          return {
            ok: false,
            error: 'Unable to reach the server to close your account.',
          };
        }
      },

      setAvatar: (avatarId) => {
        set((state) => {
          if (!state.currentUser) return state;
          return {
            currentUser: { ...state.currentUser, avatarId },
          };
        });
      },

      setSessionToken: (token) => {
        set({ userSessionToken: token });
      },
    }),
    {
      name: 'mshindi-auth',
      // Only persist sanitized non-credential profile metadata for instant first paint;
      // never store accounts[], PINs, pinHashes, or bearer session tokens in localStorage.
      partialize: (state) => ({
        currentUser: state.currentUser
          ? {
              phone: state.currentUser.phone,
              username: state.currentUser.username,
              createdAt: state.currentUser.createdAt,
              avatarId: state.currentUser.avatarId,
              role: state.currentUser.role,
              verifiedWithSms: state.currentUser.verifiedWithSms,
            }
          : null,
        currentPhone: state.currentPhone,
      }),
      merge: (persistedState: any, currentState) => {
        const persistedUser =
          persistedState && typeof persistedState === 'object' && persistedState.currentUser
            ? {
                phone: String(persistedState.currentUser.phone || ''),
                username: String(persistedState.currentUser.username || ''),
                createdAt: String(persistedState.currentUser.createdAt || ''),
                avatarId: persistedState.currentUser.avatarId,
                role: (persistedState.currentUser.role === 'admin' ? 'admin' : 'user') as
                  | 'user'
                  | 'admin',
                verifiedWithSms: Boolean(persistedState.currentUser.verifiedWithSms),
              }
            : null;
        return {
          ...currentState,
          currentUser: persistedUser && persistedUser.phone ? persistedUser : null,
          currentPhone: persistedUser && persistedUser.phone ? persistedUser.phone : null,
        };
      },
    }
  )
);

export function useCurrentUser(): Account | null {
  return useAuth((s) => s.currentUser);
}
