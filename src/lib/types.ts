export type Bookie = 'SportPesa' | 'Betika' | 'Odibets' | 'Mozzart';

export type Outcome = '1' | 'X' | '2';

export type RoomStatus = 'open' | 'locked' | 'settled';

export type Conviction = 'Banker' | 'Value Pick' | 'Long Shot';

export interface Match {
  id: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  competition: string;
  kickoff: string;
  result?: Outcome;
  status?: 'pre' | 'in' | 'post';
  displayClock?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  bookmaker?: string;
}

export interface GamblerPick {
  id: string;
  username: string;
  pick: Outcome;
  reasoning: string;
  conviction: Conviction;
  likes: number;
  timeAgo: string;
  colorSeed: number;
}

export interface MatchConsensus {
  matchId: string;
  homePct: number;
  drawPct: number;
  awayPct: number;
  totalVotes: number;
  picks: GamblerPick[];
}

export interface LeaderboardEntry {
  rank: number;
  prevRank?: number;
  rankChange?: number;
  username: string;
  correct: number;
  completedMatches?: number;
  totalMatches: number;
  prizeWon: string;
  submittedAt?: string;
  submissionTimestamp?: number;
  isClosest?: boolean;
  colorSeed: number;
}

export interface Jackpot {
  id: string;
  bookie: Bookie;
  name: string;
  gameweek: string;
  status: RoomStatus;
  entryFee: number;
  prizePool: string;
  deadline: string;
  participants: number;
  matches: Match[];
  consensus: Record<string, MatchConsensus>;
  leaderboard?: LeaderboardEntry[];
  closesInHours?: number;
  /** Human-readable timestamp of when this slip was last synced from the bookie's live jackpot feed. */
  syncedAt?: string;
  numGames?: number;
  /** Timestamp in ms when this room/jackpot was created or settled */
  createdAt?: number;
}

export const BOOKIE_THEME: Record<Bookie, { bg: string; text: string; ring: string }> = {
  SportPesa: { bg: '#0e5c36', text: '#ffffff', ring: '#1fae6f' },
  Betika: { bg: '#7a1c1c', text: '#ffe9c7', ring: '#ef5b5b' },
  Odibets: { bg: '#123a6b', text: '#dbe9ff', ring: '#3b82f6' },
  Mozzart: { bg: '#5c1a4a', text: '#f7dcf0', ring: '#d84fb0' },
};
