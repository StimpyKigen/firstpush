import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Outcome, Conviction } from './types';
import { moderateText } from './contentModeration';

export interface UserPickRecord {
  matchId: string;
  roomId: string;
  pick: Outcome;
  reasoning: string;
  conviction: Conviction;
  editCount: number; // 0 = first submit, 1 = edited once, 2 = max edits reached
  updatedAt: string;
}

interface UserPicksState {
  userPicks: Record<string, UserPickRecord>; // key: `${roomId}:${matchId}`
  likedPicks: Record<string, boolean>; // key: pickId
  extraLikes: Record<string, number>; // key: pickId
  savePick: (roomId: string, matchId: string, pick: Outcome, reasoning: string, conviction?: Conviction) => { ok: boolean; error?: string };
  getPick: (roomId: string, matchId: string) => UserPickRecord | undefined;
  toggleLikePick: (pickId: string) => void;
  getExtraLikes: (pickId: string) => number;
  isPickLiked: (pickId: string) => boolean;
}

export const useUserPicks = create<UserPicksState>()(
  persist(
    (set, get) => ({
      userPicks: {},
      likedPicks: {},
      extraLikes: {},

      getPick: (roomId, matchId) => {
        const key = `${roomId}:${matchId}`;
        return get().userPicks[key];
      },

      savePick: (roomId, matchId, pick, reasoning, conviction = 'Banker') => {
        const modResult = moderateText(reasoning);
        if (!modResult.isAllowed) {
          return { ok: false, error: modResult.reason || 'Reasoning contains prohibited content.' };
        }

        const key = `${roomId}:${matchId}`;
        const existing = get().userPicks[key];

        if (existing) {
          if (existing.editCount >= 2) {
            return { ok: false, error: 'Maximum limit of 2 edits reached for this pick.' };
          }
          const updated: UserPickRecord = {
            ...existing,
            pick,
            reasoning,
            conviction,
            editCount: existing.editCount + 1,
            updatedAt: 'Just now (edited)',
          };
          set((state) => ({
            userPicks: { ...state.userPicks, [key]: updated },
          }));
          return { ok: true };
        } else {
          const newPick: UserPickRecord = {
            matchId,
            roomId,
            pick,
            reasoning,
            conviction,
            editCount: 0,
            updatedAt: 'Just now',
          };
          set((state) => ({
            userPicks: { ...state.userPicks, [key]: newPick },
          }));
          return { ok: true };
        }
      },

      toggleLikePick: (pickId) => {
        const currentLiked = !!get().likedPicks[pickId];
        const currentExtra = get().extraLikes[pickId] || 0;
        set((state) => ({
          likedPicks: { ...state.likedPicks, [pickId]: !currentLiked },
          extraLikes: {
            ...state.extraLikes,
            [pickId]: currentLiked ? Math.max(0, currentExtra - 1) : currentExtra + 1,
          },
        }));
      },

      getExtraLikes: (pickId) => get().extraLikes[pickId] || 0,
      isPickLiked: (pickId) => !!get().likedPicks[pickId],
    }),
    { name: 'mshindi-user-picks' }
  )
);

