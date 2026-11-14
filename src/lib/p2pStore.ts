import { create } from 'zustand';
import { useWallet } from './store';
import { useAuth } from './authStore';

export type BetCategory = 'Sports' | 'Politics' | 'Gaming' | 'Weather' | 'Pop Culture' | 'Custom';
export type BetStatus =
  | 'awaiting_opponent'
  | 'active'
  | 'disputed'
  | 'settled'
  | 'cancelled'
  | 'declined';
export type Side = 'creator' | 'opponent';

export interface P2PBet {
  id: string;
  code: string;
  creatorUsername: string;
  opponentUsername?: string;
  title: string;
  description?: string;
  category: BetCategory;
  creatorSidePick: string;
  opponentSidePick: string;
  creatorStake: number;
  opponentStake: number;
  oddsLabel: string;
  status: BetStatus;
  proposedWinnerByCreator?: Side | null;
  proposedWinnerByOpponent?: Side | null;
  winner?: Side | null;
  mySide?: Side | null;
  createdAt: string;
  settleBy?: string;
  settledAt?: string;
}

interface CreateBetInput {
  creatorUsername: string;
  title: string;
  description?: string;
  category: BetCategory;
  creatorSidePick: string;
  opponentSidePick: string;
  creatorStake: number;
  opponentStake: number;
  oddsLabel: string;
  settleBy?: string;
}

interface P2PState {
  bets: P2PBet[];
  loading: boolean;
  error: string | null;
  loadBets: () => Promise<void>;
  createBet: (input: CreateBetInput) => Promise<{ ok: boolean; bet?: P2PBet; error?: string }>;
  joinBet: (code: string, opponentUsername: string) => Promise<{ ok: boolean; bet?: P2PBet; error?: string }>;
  declineBet: (id: string, code?: string) => Promise<{ ok: boolean; error?: string }>;
  cancelBet: (id: string) => Promise<{ ok: boolean; error?: string }>;
  proposeWinner: (id: string, proposer: Side, winner: Side) => Promise<{ ok: boolean; error?: string }>;
  getBetByCode: (code: string) => P2PBet | undefined;
}

function getP2pAuthHeaders(includeContentType = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const token = useAuth.getState().userSessionToken;
  if (token) {
    headers['x-user-token'] = token;
  }
  return headers;
}

function syncReturnedWallet(wallet: any): void {
  if (wallet && typeof wallet === 'object') {
    useWallet.getState().applyServerWalletSnapshot(wallet);
  }
}

export const usePvP = create<P2PState>()((set, get) => ({
  bets: [],
  loading: false,
  error: null,

  loadBets: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/tokens/p2p', {
        method: 'GET',
        headers: getP2pAuthHeaders(false),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        set({
          loading: false,
          error: data?.error || 'Sign in to view P2P bets.',
        });
        return;
      }
      set({
        bets: Array.isArray(data.bets) ? data.bets : [],
        loading: false,
        error: null,
      });
    } catch {
      set({ loading: false, error: 'Failed to reach P2P escrow server.' });
    }
  },

  createBet: async (input) => {
    try {
      const res = await fetch('/api/tokens/p2p/create', {
        method: 'POST',
        headers: getP2pAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (data?.wallet) syncReturnedWallet(data.wallet);
      if (!res.ok || !data?.success || !data?.bet) {
        return { ok: false, error: data?.error || 'Could not create P2P bet.' };
      }
      set((state) => ({ bets: [data.bet, ...state.bets] }));
      return { ok: true, bet: data.bet };
    } catch {
      return { ok: false, error: 'Unable to reach P2P escrow server.' };
    }
  },

  joinBet: async (code, opponentUsername) => {
    try {
      const res = await fetch('/api/tokens/p2p/join', {
        method: 'POST',
        headers: getP2pAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ code, opponentUsername }),
      });
      const data = await res.json();
      if (data?.wallet) syncReturnedWallet(data.wallet);
      if (!res.ok || !data?.success || !data?.bet) {
        return { ok: false, error: data?.error || 'Could not join P2P bet.' };
      }
      set((state) => {
        const exists = state.bets.some((b) => b.id === data.bet.id);
        return {
          bets: exists
            ? state.bets.map((b) => (b.id === data.bet.id ? data.bet : b))
            : [data.bet, ...state.bets],
        };
      });
      return { ok: true, bet: data.bet };
    } catch {
      return { ok: false, error: 'Unable to reach P2P escrow server.' };
    }
  },

  declineBet: async (id, code) => {
    try {
      const res = await fetch('/api/tokens/p2p/decline', {
        method: 'POST',
        headers: getP2pAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ id, code }),
      });
      const data = await res.json();
      if (data?.wallet) syncReturnedWallet(data.wallet);
      if (!res.ok || !data?.success || !data?.bet) {
        return { ok: false, error: data?.error || 'Could not decline bet.' };
      }
      set((state) => ({
        bets: state.bets.map((b) => (b.id === id ? data.bet : b)),
      }));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach P2P escrow server.' };
    }
  },

  cancelBet: async (id) => {
    try {
      const res = await fetch('/api/tokens/p2p/cancel', {
        method: 'POST',
        headers: getP2pAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data?.wallet) syncReturnedWallet(data.wallet);
      if (!res.ok || !data?.success || !data?.bet) {
        return { ok: false, error: data?.error || 'Could not cancel bet.' };
      }
      set((state) => ({
        bets: state.bets.map((b) => (b.id === id ? data.bet : b)),
      }));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach P2P escrow server.' };
    }
  },

  proposeWinner: async (id, _proposer, winner) => {
    try {
      const res = await fetch('/api/tokens/p2p/propose-winner', {
        method: 'POST',
        headers: getP2pAuthHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ id, winner }),
      });
      const data = await res.json();
      if (data?.wallet) syncReturnedWallet(data.wallet);
      if (!res.ok || !data?.success || !data?.bet) {
        return { ok: false, error: data?.error || 'Could not submit winner confirmation.' };
      }
      set((state) => ({
        bets: state.bets.map((b) => (b.id === id ? data.bet : b)),
      }));
      return { ok: true };
    } catch {
      return { ok: false, error: 'Unable to reach P2P escrow server.' };
    }
  },

  getBetByCode: (code) => get().bets.find((b) => b.code?.toUpperCase() === code.toUpperCase()),
}));
