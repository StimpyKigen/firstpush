export type Bookie =
  | 'SportPesa'
  | 'Betika'
  | 'Odibets'
  | 'Mozzart'
  | 'MozzartBet'
  | 'SportyBet'
  | 'BetPawa'
  | '1xBet'
  | '22Bet';

export type Outcome = '1' | 'X' | '2';

export type RoomStatus = 'open' | 'locked' | 'settled';

export type NonResultStatus = 'Canceled' | 'Postponed' | 'Abandoned' | 'TBD';

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
  nonResultStatus?: NonResultStatus | null;
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
  SportPesa: { bg: '#0A3B8C', text: '#ffffff', ring: '#1fae6f' },
  Betika: { bg: '#1F3888', text: '#ffe9c7', ring: '#ef5b5b' },
  Odibets: { bg: '#22C55E', text: '#ffffff', ring: '#3b82f6' },
  Mozzart: { bg: '#6D28D9', text: '#ffffff', ring: '#d84fb0' },
  MozzartBet: { bg: '#6D28D9', text: '#ffffff', ring: '#d84fb0' },
  SportyBet: { bg: '#DC2626', text: '#ffffff', ring: '#f87171' },
  BetPawa: { bg: '#65A30D', text: '#ffffff', ring: '#a3e635' },
  '1xBet': { bg: '#0284C7', text: '#ffffff', ring: '#38bdf8' },
  '22Bet': { bg: '#0D9488', text: '#ffffff', ring: '#2dd4bf' },
};
