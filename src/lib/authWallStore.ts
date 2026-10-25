import { create } from 'zustand';

export type AuthWallAction =
  | 'video'
  | 'details'
  | 'discussion'
  | 'builder'
  | 'builder_pick'
  | 'jackpot'
  | 'leaderboard';

export interface AuthWallOptions {
  title?: string;
  message?: string;
  actionType?: AuthWallAction;
}

interface AuthWallState {
  isOpen: boolean;
  title: string;
  message: string;
  actionType: AuthWallAction;
  openAuthWall: (options?: AuthWallOptions) => void;
  closeAuthWall: () => void;
}

export const useAuthWallStore = create<AuthWallState>((set) => ({
  isOpen: false,
  title: 'Sign In Required',
  message: 'Sign up or log in to access this feature on MshindiRoom.',
  actionType: 'details',
  openAuthWall: (options) => {
    let defaultTitle = 'Sign In Required';
    let defaultMessage = 'Sign up or log in to continue on MshindiRoom.';

    if (options?.actionType === 'video') {
      defaultTitle = 'Sign In to Play Highlights';
      defaultMessage = 'Sign up or log in to stream full match video highlights and tactical perspectives.';
    } else if (options?.actionType === 'details') {
      defaultTitle = 'Sign In for Match Details';
      defaultMessage = 'Sign up or log in to view match intelligence, tactical lineups, pitch incident tracker, and H2H statistics.';
    } else if (options?.actionType === 'discussion') {
      defaultTitle = 'Sign In to Join Discussion';
      defaultMessage = 'Sign up or log in to participate in live match room debates and fan discussions.';
    } else if (options?.actionType === 'builder' || options?.actionType === 'builder_pick') {
      defaultTitle = 'Sign In to Use Bet Builder';
      defaultMessage = 'Sign up or log in to select market odds, build custom accumulators, and share verified bet slips.';
    } else if (options?.actionType === 'jackpot') {
      defaultTitle = 'Sign In to Unlock Jackpot Room';
      defaultMessage = 'Sign up or log in to unlock crowd consensus data, post your 17-leg picks, and qualify for the leaderboard crown.';
    } else if (options?.actionType === 'leaderboard') {
      defaultTitle = 'Sign In to View Leaderboards';
      defaultMessage = 'Sign up or log in to view top punter rankings, gameweek performance, and star ratings.';
    }

    set({
      isOpen: true,
      title: options?.title || defaultTitle,
      message: options?.message || defaultMessage,
      actionType: options?.actionType || 'details',
    });
  },
  closeAuthWall: () => set({ isOpen: false }),
}));
