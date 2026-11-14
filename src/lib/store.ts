import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuth, type Account } from './authStore';

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
  userSessionToken: string | null;
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

function getAuthHeaders(state: WalletState, user?: Account | null): Record<string, string> {
  const currentUser = user ?? useAuth.getState().getCurrentUser();
  const token = state.userSessionToken || useAuth.getState().userSessionToken;
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
      referralsNeededForNextToken: 3,
      serverMigrated: false,
      userSessionToken: null,
      tokenSyncLoading: false,
      tokenTransactions: [],

      isRoomUnlocked: (roomId) => get().unlockedRooms.includes(roomId),
      isCodeUsed: (code) => get().redeemedCodes.includes(code),

      applyServerWalletSnapshot: (snapshot) => {
        if (!snapshot || typeof snapshot !== 'object') return;
        set((state) => ({
          mshindiTokens:
            typeof snapshot.mshindiTokens === 'number' ? snapshot.mshindiTokens : state.mshindiTokens,
          activeTokenIds: Array.isArray(snapshot.activeTokenIds)
            ? snapshot.activeTokenIds
            : state.activeTokenIds,
          tokenTransactions: Array.isArray(snapshot.tokenTransactions)
            ? snapshot.tokenTransactions
            : state.tokenTransactions,
          totalReferrals:
            typeof snapshot.totalReferrals === 'number' ? snapshot.totalReferrals : state.totalReferrals,
          referralTokensAwardedCount:
            typeof snapshot.referralTokensAwardedCount === 'number'
              ? snapshot.referralTokensAwardedCount
              : state.referralTokensAwardedCount,
          referralProgressRemainder:
            typeof snapshot.referralProgressRemainder === 'number'
              ? snapshot.referralProgressRemainder
              : state.referralProgressRemainder,
          referralsNeededForNextToken:
            typeof snapshot.referralsNeededForNextToken === 'number'
              ? snapshot.referralsNeededForNextToken
              : state.referralsNeededForNextToken,
          balance:
            typeof snapshot.walletBalanceKsh === 'number' ? snapshot.walletBalanceKsh : state.balance,
          unlockedRooms: Array.isArray(snapshot.unlockedRooms)
            ? Array.from(new Set([...state.unlockedRooms, ...snapshot.unlockedRooms]))
            : state.unlockedRooms,
          redeemedCodes: Array.isArray(snapshot.redeemedCodes)
            ? Array.from(new Set([...state.redeemedCodes, ...snapshot.redeemedCodes]))
            : state.redeemedCodes,
          serverMigrated: Boolean(snapshot.migrated ?? state.serverMigrated),
          userSessionToken: snapshot.userSessionToken || state.userSessionToken,
        }));
      },

      syncAuthoritativeTokens: async (userArg) => {
        if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
        const currentUser = userArg ?? useAuth.getState().getCurrentUser();
        if (!currentUser?.phone) return;

        const state = get();
        set({ tokenSyncLoading: true });

        try {
          const res = await fetch('/api/tokens/wallet', {
            method: 'POST',
            headers: getAuthHeaders(state, currentUser),
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
            get().applyServerWalletSnapshot(data.wallet);
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
            headers: getAuthHeaders(get(), currentUser),
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
            headers: getAuthHeaders(get(), currentUser),
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
            headers: getAuthHeaders(get(), currentUser),
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
            headers: getAuthHeaders(get()),
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
          unlockedRooms: [],
          balance: 0,
          redeemedCodes: [],
          transactions: [],
          mshindiTokens: 0,
          activeTokenIds: [],
          tokenTransactions: [],
          totalReferrals: 0,
          referralTokensAwardedCount: 0,
          referralProgressRemainder: 0,
          referralsNeededForNextToken: QUALIFYING_REFERRALS_PER_TOKEN,
          serverMigrated: false,
          userSessionToken: null,
        }),

      holdEscrow: () => false,
      releasePayout: () => {},
      refundEscrow: () => {},
    }),
    { name: 'mshindi-wallet' }
  )
);
