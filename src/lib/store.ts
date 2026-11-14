import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuth, type Account } from './authStore';
import { registerSessionLifecycleListener } from './sessionLifecycle';

export const KSH_PER_MSHINDI_TOKEN = 100; // Official Purchase Rate: KSh 100 = 1 MT
export const QUALIFYING_REFERRALS_PER_TOKEN = 3; // Official Referral Rate: 3 Invites = 1 MT
export const DEFAULT_ROOM_UNLOCK_TOKEN_COST = 1; // 1 MT unlocks a standard KSh 10 room

export interface WalletTx {
  id: string;
  type: 'topup' | 'spend' | 'withdraw' | 'escrow' | 'payout' | 'refund';
  label: string;
  amount: number;
  time: string;
}

export interface TokenTx {
  id: string;
  transactionId?: string;
  type:
    | 'earn_spend'
    | 'earn_referral'
    | 'redeem_room'
    | 'admin_credit'
    | 'admin_debit'
    | 'refund'
    | 'reversal'
    | 'migration';
  ledgerType?: string;
  label: string;
  amount: number;
  balanceAfter?: number;
  tokenIds?: string[];
  referenceId?: string;
  time: string;
  timestamp?: string;
}

interface WalletState {
  unlockedRooms: string[];
  balance: number;
  redeemedCodes: string[];
  transactions: WalletTx[];

  // Authoritative Server-Controlled Mshindi Tokens (MT)
  mshindiTokens: number;
  activeTokenIds: string[];
  tokenTransactions: TokenTx[];
  totalReferrals: number;
  referralTokensAwardedCount: number;
  referralProgressRemainder: number;
  referralsNeededForNextToken: number;
  serverMigrated: boolean;
  walletOwnerPhone: string | null;
  tokenSyncLoading: boolean;

  isRoomUnlocked: (roomId: string) => boolean;
  isCodeUsed: (code: string) => boolean;

  // Authoritative Server Synchronization & Transaction Actions
  applyServerWalletSnapshot: (snapshot: any) => void;
  syncAuthoritativeTokens: (user?: Account | null) => Promise<void>;
  unlockRoomWithTokensServer: (
    roomId: string,
    tokenCost: number,
    roomName?: string
  ) => Promise<{ ok: boolean; error?: string; consumedTokenIds?: string[] }>;
  unlockRoomWithBalanceServer: (
    roomId: string,
    cost: number,
    roomName?: string
  ) => Promise<{ ok: boolean; tokensAwarded?: number; error?: string }>;
  verifyMpesaAndSyncServer: (params: {
    code: string;
    amount: number;
    roomId?: string;
    roomName?: string;
    purpose?: string;
  }) => Promise<{ ok: boolean; tokensAwarded?: number; amountKsh?: number; error?: string }>;
  submitServerReferral: (params: {
    referrerIdentifier: string;
    referredPhone: string;
    referredUsername: string;
  }) => Promise<{ ok: boolean; tokensAwarded?: number; error?: string }>;

  // Legacy signatures delegated through server authority (no local balance fabrication allowed)
  unlockRoomWithCode: (roomId: string, code: string, costKsh?: number, roomName?: string) => void;
  unlockRoomWithBalance: (roomId: string, cost: number, roomName?: string) => void;
  unlockRoomWithTokens: (
    roomId: string,
    tokenCost: number,
    roomName?: string
  ) => { ok: boolean; error?: string };
  topUpWithCode: (code: string, amount: number) => void;
  resetWallet: () => void;

  /** Hold funds in escrow for a P2P bet stake. Returns false if insufficient balance. */
  holdEscrow: (amount: number, label: string) => boolean;
  /** Release escrowed winnings back to a punter's spendable balance. */
  releasePayout: (amount: number, label: string) => void;
  /** Refund an escrowed stake (e.g. bet cancelled/declined). */
  refundEscrow: (amount: number, label: string) => void;
}

function getAuthHeaders(user?: Account | null): Record<string, string> {
  const currentUser = user ?? useAuth.getState().getCurrentUser();
  const token = useAuth.getState().userSessionToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['x-user-token'] = token;
  }
  if (currentUser?.phone) {
    headers['x-user-uid'] = currentUser.phone;
  }
  return headers;
}

const EMPTY_WALLET_DATA = {
  unlockedRooms: [] as string[],
  balance: 0,
  redeemedCodes: [] as string[],
  transactions: [] as WalletTx[],
  mshindiTokens: 0,
  activeTokenIds: [] as string[],
  tokenTransactions: [] as TokenTx[],
  totalReferrals: 0,
  referralTokensAwardedCount: 0,
  referralProgressRemainder: 0,
  referralsNeededForNextToken: QUALIFYING_REFERRALS_PER_TOKEN,
  serverMigrated: false,
  walletOwnerPhone: null as string | null,
};

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      unlockedRooms: [],
      balance: 0,
      redeemedCodes: [],
      transactions: [],

      // Authoritative Mshindi Tokens state (synced exclusively from server)
      mshindiTokens: 0,
      activeTokenIds: [],
      totalReferrals: 0,
      referralTokensAwardedCount: 0,
      referralProgressRemainder: 0,
      referralsNeededForNextToken: QUALIFYING_REFERRALS_PER_TOKEN,
      serverMigrated: false,
      walletOwnerPhone: null,
      tokenSyncLoading: false,
      tokenTransactions: [],

      isRoomUnlocked: (roomId) => get().unlockedRooms.includes(roomId),
      isCodeUsed: (code) => get().redeemedCodes.includes(code),

      applyServerWalletSnapshot: (snapshot) => {
        if (!snapshot || typeof snapshot !== 'object') return;
        const currentAuthPhone = useAuth.getState().currentPhone;
        const rawOwner =
          typeof snapshot.userUid === 'string' && snapshot.userUid.trim()
            ? snapshot.userUid.trim()
            : typeof snapshot.phone === 'string' && snapshot.phone.trim()
              ? snapshot.phone.trim()
              : currentAuthPhone || null;

        set((state) => {
          const switchedOwner =
            Boolean(state.walletOwnerPhone && rawOwner && state.walletOwnerPhone !== rawOwner);
          const nextOwner = rawOwner || state.walletOwnerPhone;
          return {
            walletOwnerPhone: nextOwner,
            mshindiTokens:
              typeof snapshot.mshindiTokens === 'number'
                ? snapshot.mshindiTokens
                : switchedOwner
                  ? 0
                  : state.mshindiTokens,
            activeTokenIds: Array.isArray(snapshot.activeTokenIds)
              ? snapshot.activeTokenIds
              : switchedOwner
                ? []
                : state.activeTokenIds,
            tokenTransactions: Array.isArray(snapshot.tokenTransactions)
              ? snapshot.tokenTransactions
              : switchedOwner
                ? []
                : state.tokenTransactions,
            transactions: Array.isArray(snapshot.transactions)
              ? snapshot.transactions
              : switchedOwner
                ? []
                : state.transactions,
            totalReferrals:
              typeof snapshot.totalReferrals === 'number'
                ? snapshot.totalReferrals
                : switchedOwner
                  ? 0
                  : state.totalReferrals,
            referralTokensAwardedCount:
              typeof snapshot.referralTokensAwardedCount === 'number'
                ? snapshot.referralTokensAwardedCount
                : switchedOwner
                  ? 0
                  : state.referralTokensAwardedCount,
            referralProgressRemainder:
              typeof snapshot.referralProgressRemainder === 'number'
                ? snapshot.referralProgressRemainder
                : switchedOwner
                  ? 0
                  : state.referralProgressRemainder,
            referralsNeededForNextToken:
              typeof snapshot.referralsNeededForNextToken === 'number'
                ? snapshot.referralsNeededForNextToken
                : QUALIFYING_REFERRALS_PER_TOKEN,
            balance:
              typeof snapshot.walletBalanceKsh === 'number'
                ? snapshot.walletBalanceKsh
                : switchedOwner
                  ? 0
                  : state.balance,
            unlockedRooms: Array.isArray(snapshot.unlockedRooms)
              ? Array.from(new Set(snapshot.unlockedRooms.filter((r: unknown): r is string => typeof r === 'string')))
              : switchedOwner
                ? []
                : state.unlockedRooms,
            redeemedCodes: Array.isArray(snapshot.redeemedCodes)
              ? Array.from(new Set(snapshot.redeemedCodes.filter((c: unknown): c is string => typeof c === 'string')))
              : switchedOwner
                ? []
                : state.redeemedCodes,
            serverMigrated: Boolean(snapshot.migrated ?? true),
          };
        });
      },

      syncAuthoritativeTokens: async (userArg) => {
        if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
        const currentUser = userArg ?? useAuth.getState().getCurrentUser();
        if (!currentUser?.phone) return;

        const existingOwner = get().walletOwnerPhone;
        if (existingOwner && existingOwner !== currentUser.phone) {
          get().resetWallet();
        }
        set({ walletOwnerPhone: currentUser.phone, tokenSyncLoading: true });

        try {
          const res = await fetch('/api/tokens/wallet', {
            method: 'POST',
            headers: getAuthHeaders(currentUser),
            credentials: 'include',
            body: JSON.stringify({
              action: 'wallet',
              userUid: currentUser.phone,
              username: currentUser.username,
            }),
          });
          if (!res.ok) {
            set({ tokenSyncLoading: false });
            return;
          }
          const data = await res.json();
          if (data?.success && data?.wallet) {
            get().applyServerWalletSnapshot({
              ...data.wallet,
              userUid: data.wallet.userUid || currentUser.phone,
            });
          }
        } catch {
          // Network hiccup: preserve last known server snapshot until online
        } finally {
          set({ tokenSyncLoading: false });
        }
      },

      unlockRoomWithTokensServer: async (roomId, tokenCost, roomName) => {
        const currentUser = useAuth.getState().getCurrentUser();
        if (!currentUser?.phone) {
          return { ok: false, error: 'Please sign in to redeem Mshindi Tokens.' };
        }

        const state = get();
        if (!state.serverMigrated) {
          await state.syncAuthoritativeTokens(currentUser);
        }

        try {
          const res = await fetch('/api/tokens/spend', {
            method: 'POST',
            headers: getAuthHeaders(currentUser),
            credentials: 'include',
            body: JSON.stringify({
              action: 'spend',
              userUid: currentUser.phone,
              quantity: tokenCost,
              roomId,
              roomName,
              idempotencyKey: `spend:room:${currentUser.phone}:${roomId}`,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            if (data?.wallet) {
              get().applyServerWalletSnapshot(data.wallet);
            }
            return {
              ok: false,
              error: data?.error || 'Could not redeem Mshindi Tokens on the server.',
            };
          }
          if (data.wallet) {
            get().applyServerWalletSnapshot(data.wallet);
          }
          return {
            ok: true,
            consumedTokenIds: data.consumedTokenIds || [],
          };
        } catch {
          return {
            ok: false,
            error: 'Unable to reach the token verification server. Please check your connection and try again.',
          };
        }
      },

      unlockRoomWithBalanceServer: async (roomId, cost, roomName) => {
        const currentUser = useAuth.getState().getCurrentUser();
        if (!currentUser?.phone) {
          return { ok: false, error: 'Please sign in to unlock this room.' };
        }

        const state = get();
        if (!state.serverMigrated) {
          await state.syncAuthoritativeTokens(currentUser);
        }

        try {
          const res = await fetch('/api/tokens/unlock-with-balance', {
            method: 'POST',
            headers: getAuthHeaders(currentUser),
            credentials: 'include',
            body: JSON.stringify({
              action: 'unlock-with-balance',
              userUid: currentUser.phone,
              roomId,
              roomName,
              costKsh: cost,
              idempotencyKey: `wallet-unlock:${currentUser.phone}:${roomId}`,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            if (data?.wallet) {
              get().applyServerWalletSnapshot(data.wallet);
            }
            return {
              ok: false,
              error: data?.error || 'Could not unlock room with wallet balance.',
            };
          }
          if (data.wallet) {
            get().applyServerWalletSnapshot(data.wallet);
          }
          set((s) => ({
            transactions: [
              {
                id: `tx-${Date.now()}`,
                type: 'spend',
                label: `Unlocked ${roomName || roomId}`,
                amount: -cost,
                time: 'just now',
              },
              ...s.transactions,
            ],
          }));
          return {
            ok: true,
            tokensAwarded: Number(data.tokensAwarded || 0),
          };
        } catch {
          return {
            ok: false,
            error: 'Unable to reach the server to verify your wallet balance. Please try again.',
          };
        }
      },

      verifyMpesaAndSyncServer: async ({ code, amount, roomId, roomName, purpose }) => {
        const currentUser = useAuth.getState().getCurrentUser();
        const state = get();
        if (currentUser && !state.serverMigrated) {
          await state.syncAuthoritativeTokens(currentUser);
        }

        try {
          const res = await fetch('/api/mpesa/verify-code', {
            method: 'POST',
            headers: getAuthHeaders(currentUser),
            credentials: 'include',
            body: JSON.stringify({
              code,
              amount,
              userUid: currentUser?.phone,
              username: currentUser?.username,
              roomId,
              roomName,
              purpose: purpose || roomId || 'wallet-topup',
              idempotencyKey: `purchase:mpesa:${code.trim().toUpperCase()}`,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            return {
              ok: false,
              error: data?.error || 'M-Pesa payment code verification failed.',
            };
          }
          if (data.wallet) {
            get().applyServerWalletSnapshot(data.wallet);
          }
          const isTopUp = !roomId || roomId === 'wallet-topup' || roomId === 'profile-deposit';
          if (isTopUp) {
            set((s) => ({
              transactions: [
                {
                  id: `tx-${Date.now()}`,
                  type: 'topup',
                  label: `M-Pesa Top Up (${code.trim().toUpperCase()})`,
                  amount: Number(data.amountKsh ?? amount),
                  time: 'just now',
                },
                ...s.transactions,
              ],
            }));
          }
          return {
            ok: true,
            tokensAwarded: Number(data.tokensAwarded || 0),
            amountKsh: Number(data.amountKsh ?? amount),
          };
        } catch {
          return {
            ok: false,
            error: 'Unable to reach the M-Pesa verification server. Please check your connection and try again.',
          };
        }
      },

      submitServerReferral: async ({ referrerIdentifier, referredPhone, referredUsername }) => {
        try {
          const res = await fetch('/api/tokens/referral', {
            method: 'POST',
            headers: getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify({
              action: 'referral',
              referrerIdentifier,
              referredUid: referredPhone,
              referredUsername,
              isVerifiedRegistration: true,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            return { ok: false, error: data?.error || 'Referral verification failed.' };
          }
          return {
            ok: true,
            tokensAwarded: Number(data.tokensAwarded || 0),
          };
        } catch {
          return { ok: false, error: 'Failed to contact referral verification server.' };
        }
      },

      unlockRoomWithCode: (roomId, code) => {
        // State is updated via verifyMpesaAndSyncServer; never fabricate tokens on the client
        set((state) => ({
          unlockedRooms: state.unlockedRooms.includes(roomId)
            ? state.unlockedRooms
            : [...state.unlockedRooms, roomId],
          redeemedCodes: state.redeemedCodes.includes(code)
            ? state.redeemedCodes
            : [...state.redeemedCodes, code],
        }));
      },

      unlockRoomWithBalance: (roomId, cost, roomName) => {
        void get().unlockRoomWithBalanceServer(roomId, cost, roomName);
      },

      unlockRoomWithTokens: (roomId, tokenCost, roomName) => {
        const { mshindiTokens } = get();
        if (mshindiTokens < tokenCost) {
          return {
            ok: false,
            error: `You need ${tokenCost} Mshindi Token${tokenCost === 1 ? '' : 's'} to unlock this room. You have ${mshindiTokens} MT.`,
          };
        }
        void get().unlockRoomWithTokensServer(roomId, tokenCost, roomName);
        return { ok: true };
      },

      topUpWithCode: (code, amount) => {
        void get().verifyMpesaAndSyncServer({ code, amount, purpose: 'wallet-topup' });
      },

      resetWallet: () =>
        set({
          ...EMPTY_WALLET_DATA,
          tokenSyncLoading: false,
        }),

      holdEscrow: () => false,
      releasePayout: () => {},
      refundEscrow: () => {},
    }),
    {
      name: 'mshindi-wallet',
      // Never persist bearer/session tokens (`userSessionToken`) or transient sync flags into localStorage
      partialize: (state) => ({
        unlockedRooms: state.unlockedRooms,
        balance: state.balance,
        redeemedCodes: state.redeemedCodes,
        transactions: state.transactions,
        mshindiTokens: state.mshindiTokens,
        activeTokenIds: state.activeTokenIds,
        tokenTransactions: state.tokenTransactions,
        totalReferrals: state.totalReferrals,
        referralTokensAwardedCount: state.referralTokensAwardedCount,
        referralProgressRemainder: state.referralProgressRemainder,
        referralsNeededForNextToken: state.referralsNeededForNextToken,
        serverMigrated: state.serverMigrated,
        walletOwnerPhone: state.walletOwnerPhone,
      }),
      merge: (persistedState: any, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return currentState;
        }
        const activePhone = useAuth.getState().currentPhone;
        const persistedOwner =
          typeof persistedState.walletOwnerPhone === 'string' && persistedState.walletOwnerPhone.trim()
            ? persistedState.walletOwnerPhone.trim()
            : null;
        // Reject persisted wallet data if no user is signed in or it belongs to another user
        if (!activePhone || !persistedOwner || persistedOwner !== activePhone) {
          return {
            ...currentState,
            ...EMPTY_WALLET_DATA,
          };
        }
        const { userSessionToken: _scrubbedToken, tokenSyncLoading: _ignoredLoading, ...safePersisted } =
          persistedState as Record<string, any>;
        return {
          ...currentState,
          ...safePersisted,
          walletOwnerPhone: persistedOwner,
        };
      },
    }
  )
);

registerSessionLifecycleListener((nextUserPhone) => {
  const wallet = useWallet.getState();
  if (!nextUserPhone) {
    wallet.resetWallet();
    return;
  }
  if (
    !wallet.walletOwnerPhone ||
    wallet.walletOwnerPhone !== nextUserPhone
  ) {
    wallet.resetWallet();
  }
});
