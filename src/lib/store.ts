import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WalletTx {
  id: string;
  type: 'topup' | 'spend' | 'withdraw' | 'escrow' | 'payout' | 'refund';
  label: string;
  amount: number;
  time: string;
}

export interface TokenTx {
  id: string;
  type: 'earn_spend' | 'earn_referral' | 'redeem_room';
  label: string;
  amount: number; // e.g. +4 or -20
  time: string;
}

interface WalletState {
  unlockedRooms: string[];
  balance: number;
  redeemedCodes: string[];
  transactions: WalletTx[];

  // Mshindi Tokens (MT)
  mshindiTokens: number;
  tokenTransactions: TokenTx[];
  totalReferrals: number;

  isRoomUnlocked: (roomId: string) => boolean;
  isCodeUsed: (code: string) => boolean;
  unlockRoomWithCode: (roomId: string, code: string, costKsh?: number, roomName?: string) => void;
  unlockRoomWithBalance: (roomId: string, cost: number, roomName?: string) => void;
  unlockRoomWithTokens: (roomId: string, tokenCost: number, roomName?: string) => { ok: boolean; error?: string };
  earnTokensForSpend: (spendKsh: number, roomName?: string) => number;
  creditReferralTokens: (referrerName: string, newUserName?: string) => void;
  topUpWithCode: (code: string, amount: number) => void;
  withdraw: (amount: number) => { ok: boolean; error?: string };
  resetWallet: () => void;
  /** Hold funds in escrow for a P2P bet stake. Returns false if insufficient balance. */
  holdEscrow: (amount: number, label: string) => boolean;
  /** Release escrowed winnings back to a punter's spendable balance. */
  releasePayout: (amount: number, label: string) => void;
  /** Refund an escrowed stake (e.g. bet cancelled/declined). */
  refundEscrow: (amount: number, label: string) => void;
}

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      unlockedRooms: [],
      balance: 250,
      redeemedCodes: [],
      transactions: [
        { id: 'seed-1', type: 'spend', label: 'Unlocked SportPesa Mega Jackpot GW42', amount: -10, time: '2h ago' },
        { id: 'seed-2', type: 'topup', label: 'M-Pesa Top Up', amount: 100, time: '1d ago' },
        { id: 'seed-3', type: 'spend', label: 'Unlocked Betika Grand Jackpot GW9', amount: -10, time: '3d ago' },
      ],

      // Mshindi Tokens Initial State
      mshindiTokens: 24, // 24 MT seed balance for testing
      totalReferrals: 1,
      tokenTransactions: [
        { id: 'token-seed-1', type: 'earn_referral', label: 'Referral Bonus: Invited @KipPunter', amount: 4, time: '1d ago' },
        { id: 'token-seed-2', type: 'earn_spend', label: 'Room Unlock Cashback (100 Ksh spent)', amount: 4, time: '2d ago' },
        { id: 'token-seed-3', type: 'earn_referral', label: 'Welcome Bonus Tokens', amount: 16, time: '3d ago' },
      ],

      isRoomUnlocked: (roomId) => get().unlockedRooms.includes(roomId),
      isCodeUsed: (code) => get().redeemedCodes.includes(code),

      earnTokensForSpend: (spendKsh, roomName) => {
        // Spending gives 10 Ksh value back for every 100 Ksh spent -> 4 MT per 100 Ksh spent
        const tokensEarned = Math.max(1, Math.floor(spendKsh * 0.04));
        set((state) => ({
          mshindiTokens: state.mshindiTokens + tokensEarned,
          tokenTransactions: [
            {
              id: `token-tx-${Date.now()}`,
              type: 'earn_spend',
              label: `Cashback: Unlocked ${roomName || 'Room'} (${spendKsh} Ksh spent)`,
              amount: tokensEarned,
              time: 'just now',
            },
            ...state.tokenTransactions,
          ],
        }));
        return tokensEarned;
      },

      unlockRoomWithCode: (roomId, code, costKsh = 50, roomName) => {
        const tokensEarned = get().earnTokensForSpend(costKsh, roomName);
        set((state) => ({
          unlockedRooms: state.unlockedRooms.includes(roomId)
            ? state.unlockedRooms
            : [...state.unlockedRooms, roomId],
          redeemedCodes: [...state.redeemedCodes, code],
        }));
      },

      unlockRoomWithBalance: (roomId, cost, roomName) => {
        get().earnTokensForSpend(cost, roomName);
        set((state) => ({
          unlockedRooms: state.unlockedRooms.includes(roomId)
            ? state.unlockedRooms
            : [...state.unlockedRooms, roomId],
          balance: state.balance - cost,
        }));
      },

      unlockRoomWithTokens: (roomId, tokenCost, roomName) => {
        const { mshindiTokens, unlockedRooms } = get();
        if (mshindiTokens < tokenCost) {
          return { ok: false, error: `You need ${tokenCost} Mshindi Tokens to unlock this room. You have ${mshindiTokens} MT.` };
        }
        set((state) => ({
          unlockedRooms: unlockedRooms.includes(roomId) ? unlockedRooms : [...unlockedRooms, roomId],
          mshindiTokens: state.mshindiTokens - tokenCost,
          tokenTransactions: [
            {
              id: `token-tx-${Date.now()}`,
              type: 'redeem_room',
              label: `Redeemed ${tokenCost} MT to unlock ${roomName || 'Room'}`,
              amount: -tokenCost,
              time: 'just now',
            },
            ...state.tokenTransactions,
          ],
        }));
        return { ok: true };
      },

      creditReferralTokens: (referrerName, newUserName) => {
        // 4 MT per referral (so 5 referrals = 20 MT = 1 free room unlock!)
        const referralBonus = 4;
        set((state) => ({
          mshindiTokens: state.mshindiTokens + referralBonus,
          totalReferrals: state.totalReferrals + 1,
          tokenTransactions: [
            {
              id: `token-tx-${Date.now()}`,
              type: 'earn_referral',
              label: `Referral Bonus: Joined via ${referrerName}${newUserName ? ` (${newUserName})` : ''}`,
              amount: referralBonus,
              time: 'just now',
            },
            ...state.tokenTransactions,
          ],
        }));
      },
      topUpWithCode: (code, amount) =>
        set((state) => ({
          balance: state.balance + amount,
          redeemedCodes: [...state.redeemedCodes, code],
          transactions: [
            { id: `tx-${Date.now()}`, type: 'topup', label: 'M-Pesa Top Up', amount, time: 'just now' },
            ...state.transactions,
          ],
        })),
      withdraw: (amount) => {
        const { balance } = get();
        if (amount <= 0) return { ok: false, error: 'Enter a valid amount.' };
        if (amount > balance) return { ok: false, error: 'Withdrawal amount exceeds your available balance.' };
        set((state) => ({
          balance: state.balance - amount,
          transactions: [
            { id: `tx-${Date.now()}`, type: 'withdraw', label: 'Withdrawal to M-Pesa', amount: -amount, time: 'just now' },
            ...state.transactions,
          ],
        }));
        return { ok: true };
      },
      resetWallet: () =>
        set({ unlockedRooms: [], balance: 0, redeemedCodes: [], transactions: [] }),

      holdEscrow: (amount, label) => {
        const { balance } = get();
        if (amount <= 0 || amount > balance) return false;
        set((state) => ({
          balance: state.balance - amount,
          transactions: [
            { id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'escrow', label, amount: -amount, time: 'just now' },
            ...state.transactions,
          ],
        }));
        return true;
      },

      releasePayout: (amount, label) =>
        set((state) => ({
          balance: state.balance + amount,
          transactions: [
            { id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'payout', label, amount, time: 'just now' },
            ...state.transactions,
          ],
        })),

      refundEscrow: (amount, label) =>
        set((state) => ({
          balance: state.balance + amount,
          transactions: [
            { id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: 'refund', label, amount, time: 'just now' },
            ...state.transactions,
          ],
        })),
    }),
    { name: 'mshindi-wallet' }
  )
);
