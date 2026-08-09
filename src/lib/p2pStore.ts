import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useWallet } from './store';

export type BetCategory = 'Sports' | 'Politics' | 'Gaming' | 'Weather' | 'Pop Culture' | 'Custom';
export type BetStatus = 'awaiting_opponent' | 'active' | 'disputed' | 'settled' | 'cancelled' | 'declined';
export type Side = 'creator' | 'opponent';

export interface P2PBet {
  id: string;
  code: string; // short shareable join code
  title: string; // what they are betting on
  description: string; // extra context / terms
  category: BetCategory;
  creatorUsername: string;
  creatorSidePick: string; // e.g. "Arsenal win"
  opponentSidePick: string; // e.g. "Arsenal do not win"
  creatorStake: number;
  opponentStake: number; // derived from odds, what the opponent must risk
  oddsLabel: string; // human readable e.g. "Even money (1:1)" or "2.5x for opponent"
  status: BetStatus;
  opponentUsername?: string;
  createdAt: string;
  settleBy?: string; // free-text deadline description
  proposedWinnerByCreator?: Side | null;
  proposedWinnerByOpponent?: Side | null;
  winner?: Side | null;
  settledAt?: string;
}

interface P2PState {
  bets: P2PBet[];
  createBet: (input: {
    creatorUsername: string;
    title: string;
    description: string;
    category: BetCategory;
    creatorSidePick: string;
    opponentSidePick: string;
    creatorStake: number;
    opponentStake: number;
    oddsLabel: string;
    settleBy?: string;
  }) => { ok: boolean; error?: string; bet?: P2PBet };
  joinBet: (code: string, opponentUsername: string) => { ok: boolean; error?: string };
  declineBet: (id: string) => void;
  cancelBet: (id: string) => { ok: boolean; error?: string };
  proposeWinner: (id: string, proposer: Side, winner: Side) => void;
  getBetByCode: (code: string) => P2PBet | undefined;
}

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const usePvP = create<P2PState>()(
  persist(
    (set, get) => ({
      bets: [],

      createBet: (input) => {
        if (input.creatorStake <= 0) return { ok: false, error: 'Stake must be greater than zero.' };
        const held = useWallet.getState().holdEscrow(input.creatorStake, `Escrow held: "${input.title}"`);
        if (!held) return { ok: false, error: 'Insufficient wallet balance to stake this bet.' };

        const bet: P2PBet = {
          id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          code: genCode(),
          title: input.title,
          description: input.description,
          category: input.category,
          creatorUsername: input.creatorUsername,
          creatorSidePick: input.creatorSidePick,
          opponentSidePick: input.opponentSidePick,
          creatorStake: input.creatorStake,
          opponentStake: input.opponentStake,
          oddsLabel: input.oddsLabel,
          status: 'awaiting_opponent',
          createdAt: new Date().toISOString(),
          settleBy: input.settleBy,
          proposedWinnerByCreator: null,
          proposedWinnerByOpponent: null,
          winner: null,
        };
        set((state) => ({ bets: [bet, ...state.bets] }));
        return { ok: true, bet };
      },

      joinBet: (code, opponentUsername) => {
        const bet = get().bets.find((b) => b.code.toUpperCase() === code.toUpperCase());
        if (!bet) return { ok: false, error: 'No bet found for that invite code.' };
        if (bet.status !== 'awaiting_opponent') return { ok: false, error: 'This bet is no longer accepting an opponent.' };
        if (bet.creatorUsername.toLowerCase() === opponentUsername.toLowerCase()) {
          return { ok: false, error: "You can't accept your own bet." };
        }
        set((state) => ({
          bets: state.bets.map((b) =>
            b.id === bet.id ? { ...b, status: 'active', opponentUsername } : b
          ),
        }));
        return { ok: true };
      },

      declineBet: (id) => {
        const bet = get().bets.find((b) => b.id === id);
        if (!bet) return;
        useWallet.getState().refundEscrow(bet.creatorStake, `Refund: opponent declined "${bet.title}"`);
        set((state) => ({
          bets: state.bets.map((b) => (b.id === id ? { ...b, status: 'declined' } : b)),
        }));
      },

      cancelBet: (id) => {
        const bet = get().bets.find((b) => b.id === id);
        if (!bet) return { ok: false, error: 'Bet not found.' };
        if (bet.status !== 'awaiting_opponent') return { ok: false, error: 'Only pending bets awaiting an opponent can be cancelled.' };
        useWallet.getState().refundEscrow(bet.creatorStake, `Refund: cancelled "${bet.title}"`);
        set((state) => ({
          bets: state.bets.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)),
        }));
        return { ok: true };
      },

      proposeWinner: (id, proposer, winner) => {
        const bet = get().bets.find((b) => b.id === id);
        if (!bet || bet.status !== 'active') return;

        const updated: P2PBet = {
          ...bet,
          proposedWinnerByCreator: proposer === 'creator' ? winner : bet.proposedWinnerByCreator ?? null,
          proposedWinnerByOpponent: proposer === 'opponent' ? winner : bet.proposedWinnerByOpponent ?? null,
        };

        const bothProposed = updated.proposedWinnerByCreator && updated.proposedWinnerByOpponent;
        if (bothProposed) {
          if (updated.proposedWinnerByCreator === updated.proposedWinnerByOpponent) {
            const finalWinner = updated.proposedWinnerByCreator as Side;
            const pot = bet.creatorStake + bet.opponentStake;
            if (finalWinner === 'creator') {
              useWallet.getState().releasePayout(pot, `Won bet: "${bet.title}"`);
            }
            // If opponent wins, the creator's escrowed stake is simply forfeited (opponent
            // is not modeled as a real wallet in this single-wallet demo).
            updated.status = 'settled';
            updated.winner = finalWinner;
            updated.settledAt = new Date().toISOString();
          } else {
            updated.status = 'disputed';
          }
        }

        set((state) => ({ bets: state.bets.map((b) => (b.id === id ? updated : b)) }));
      },

      getBetByCode: (code) => get().bets.find((b) => b.code.toUpperCase() === code.toUpperCase()),
    }),
    { name: 'mshindi-p2p' }
  )
);
