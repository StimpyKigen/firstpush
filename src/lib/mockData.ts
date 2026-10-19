import type { Jackpot, MatchConsensus, Match, Outcome, LeaderboardEntry } from './types';
import { buildConsensus } from './consensusEngine';
import { jackpotFeedSeed } from './jackpotFeed';
import { fetchDailyHighlightFixtures, type HighlightFixture } from './footballApi';
import { fetchSportpesaMegaMirror, fetchBetikaMidweekMirror } from './jackpotMirrorService';

export const MOCK_GAMBLERS = [
  { username: 'NairobiNostradamus', colorSeed: 2 },
  { username: 'BankerOnly254', colorSeed: 5 },
  { username: 'SlipDoctorKE', colorSeed: 1 },
  { username: 'FormGuideFred', colorSeed: 6 },
  { username: 'MtaaAnalyst', colorSeed: 3 },
  { username: 'ChezaKamaWewe', colorSeed: 7 },
  { username: 'HustlerOdds', colorSeed: 4 },
  { username: 'KipchogePredictor', colorSeed: 8 },
  { username: 'KiprotichPicks', colorSeed: 9 },
  { username: 'OddsMasterKE', colorSeed: 10 },
];

export function getGamblerPickForMatch(username: string, matchId: string, homePct = 45, drawPct = 30): Outcome {
  let hash = 0;
  const str = `${username}:${matchId}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const val = Math.abs(hash) % 100;
  if (val < homePct) return '1';
  if (val < homePct + drawPct) return 'X';
  return '2';
}

function getGamblerSubmissionOffset(username: string, jackpotId: string): number {
  let hash = 0;
  const str = `${username}:${jackpotId}:submission`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 2880) + 10; // 10 mins to 48 hours prior
}

export function recalculateJackpotLeaderboard(jackpot: Jackpot): LeaderboardEntry[] {
  const completedMatches = jackpot.matches.filter((m) => m.result !== undefined);
  const completedCount = completedMatches.length;

  if (completedCount === 0) {
    // Leaderboard is strictly inactive before any match results are posted
    jackpot.leaderboard = [];
    return [];
  }

  // Record previous ranks if existing
  const prevRankMap = new Map<string, number>();
  if (jackpot.leaderboard && jackpot.leaderboard.length > 0) {
    jackpot.leaderboard.forEach((entry) => {
      prevRankMap.set(entry.username, entry.rank);
    });
  }

  const totalMatches = jackpot.matches.length;
  const baseTime = jackpot.createdAt || (Date.now() - 86400000);

  // Compute scores and submission timestamps for each mock gambler
  const scoredGamblers = MOCK_GAMBLERS.map((gambler) => {
    let correct = 0;
    jackpot.matches.forEach((m) => {
      if (m.result) {
        const consensus = jackpot.consensus ? jackpot.consensus[m.id] : undefined;
        const hPct = consensus ? consensus.homePct : 45;
        const dPct = consensus ? consensus.drawPct : 30;
        const pick = getGamblerPickForMatch(gambler.username, m.id, hPct, dPct);
        if (pick === m.result) {
          correct++;
        }
      }
    });

    const offsetMinutes = getGamblerSubmissionOffset(gambler.username, jackpot.id);
    const submissionTimestamp = baseTime + (offsetMinutes * 60 * 1000);
    const hoursAgo = Math.floor(offsetMinutes / 60);
    const minsAgo = offsetMinutes % 60;
    const submittedAt = hoursAgo > 0 ? `${hoursAgo}h ${minsAgo}m prior` : `${minsAgo}m prior`;

    return {
      username: gambler.username,
      colorSeed: gambler.colorSeed,
      correct,
      submissionTimestamp,
      submittedAt,
    };
  });

  // Sort by correct descending (primary), then EARLIEST submission timestamp (tiebreaker)
  scoredGamblers.sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    if (a.submissionTimestamp !== b.submissionTimestamp) {
      return a.submissionTimestamp - b.submissionTimestamp;
    }
    return a.username.localeCompare(b.username);
  });

  // Map to LeaderboardEntry
  const newLeaderboard: LeaderboardEntry[] = scoredGamblers.map((g, idx) => {
    const rank = idx + 1;
    const prevRank = prevRankMap.get(g.username);
    const rankChange = prevRank !== undefined ? prevRank - rank : 0;

    let statusTitle = g.submittedAt;
    if (rank === 1) statusTitle = '👑 #1 Crown';
    else if (rank === 2) statusTitle = '🥈 #2 Runner-up';
    else if (rank === 3) statusTitle = '🥉 #3 Podium';

    return {
      rank,
      prevRank,
      rankChange,
      username: g.username,
      correct: g.correct,
      completedMatches: completedCount,
      totalMatches,
      prizeWon: statusTitle,
      submittedAt: g.submittedAt,
      submissionTimestamp: g.submissionTimestamp,
      isClosest: rank === 1,
      colorSeed: g.colorSeed,
    };
  });

  jackpot.leaderboard = newLeaderboard;

  // Auto-update room status if all matches are completed
  if (completedCount === totalMatches && jackpot.status !== 'settled') {
    jackpot.status = 'settled';
  }

  return newLeaderboard;
}

interface RawMatch {
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  competition: string;
  kickoff: string;
  homePct: number;
  drawPct: number;
  result?: '1' | 'X' | '2';
  status?: 'pre' | 'in' | 'post';
  displayClock?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  bookmaker?: string;
}

// Live upcoming matches from Consensus Engine
const sportpesaMegaLive: RawMatch[] = [
  { home: 'Arsenal', away: 'Everton', competition: 'Premier League', kickoff: 'Sat 24 Oct · 17:00 EAT', homePct: 52, drawPct: 27 },
  { home: 'Chelsea', away: 'Tottenham', competition: 'Premier League', kickoff: 'Sat 24 Oct · 19:30 EAT', homePct: 52, drawPct: 27 },
  { home: 'Liverpool', away: 'Brighton', competition: 'Premier League', kickoff: 'Sun 25 Oct · 17:00 EAT', homePct: 47, drawPct: 26 },
  { home: 'Manchester Utd', away: 'Bournemouth', competition: 'Premier League', kickoff: 'Sun 25 Oct · 17:00 EAT', homePct: 47, drawPct: 27 },
  { home: 'Crystal Palace', away: 'Newcastle', competition: 'Premier League', kickoff: 'Sun 25 Oct · 17:00 EAT', homePct: 31, drawPct: 37 },
  { home: 'Hull', away: 'Brentford', competition: 'Premier League', kickoff: 'Sun 25 Oct · 17:00 EAT', homePct: 41, drawPct: 31 },
  { home: 'Sunderland', away: 'Leeds', competition: 'Premier League', kickoff: 'Sun 25 Oct · 19:30 EAT', homePct: 31, drawPct: 40 },
  { home: 'Barcelona', away: 'Real Madrid', competition: 'La Liga', kickoff: 'Sun 25 Oct · 23:00 EAT', homePct: 53, drawPct: 25 },
  { home: 'Valencia', away: 'Villarreal', competition: 'La Liga', kickoff: 'Sat 24 Oct · 19:30 EAT', homePct: 26, drawPct: 31 },
  { home: 'Real Sociedad', away: 'Levante', competition: 'La Liga', kickoff: 'Sun 25 Oct · 20:30 EAT', homePct: 52, drawPct: 26 },
  { home: 'Ath Bilbao', away: 'Getafe', competition: 'La Liga', kickoff: 'Sun 25 Oct · 16:00 EAT', homePct: 47, drawPct: 36 },
  { home: 'Celta Vigo', away: 'Betis', competition: 'La Liga', kickoff: 'Sun 25 Oct · 18:15 EAT', homePct: 45, drawPct: 27 },
  { home: 'Sevilla', away: 'Osasuna', competition: 'La Liga', kickoff: 'Mon 26 Oct · 23:00 EAT', homePct: 47, drawPct: 28 },
  { home: 'Racing Santander', away: 'Espanyol', competition: 'La Liga', kickoff: 'Sat 24 Oct · 17:00 EAT', homePct: 36, drawPct: 32 },
  { home: 'Aston Villa', away: 'Newcastle', competition: 'Premier League', kickoff: 'Sat 24 Oct · 15:00 EAT', homePct: 42, drawPct: 30 },
  { home: 'Wolves', away: 'West Ham', competition: 'Premier League', kickoff: 'Sat 24 Oct · 17:00 EAT', homePct: 44, drawPct: 29 },
  { home: 'Fulham', away: 'Chelsea', competition: 'Premier League', kickoff: 'Sun 25 Oct · 16:00 EAT', homePct: 30, drawPct: 32 },
];

const betikaMidweekLive: RawMatch[] = [
  { home: 'Barcelona', away: 'Real Madrid', competition: 'La Liga', kickoff: 'Sun 25 Oct · 23:00 EAT', homePct: 53, drawPct: 25 },
  { home: 'Chelsea', away: 'Tottenham', competition: 'Premier League', kickoff: 'Sat 24 Oct · 19:30 EAT', homePct: 52, drawPct: 27 },
  { home: 'Arsenal', away: 'Everton', competition: 'Premier League', kickoff: 'Sat 24 Oct · 17:00 EAT', homePct: 52, drawPct: 27 },
  { home: 'Liverpool', away: 'Brighton', competition: 'Premier League', kickoff: 'Sun 25 Oct · 17:00 EAT', homePct: 47, drawPct: 26 },
  { home: 'Manchester Utd', away: 'Bournemouth', competition: 'Premier League', kickoff: 'Sun 25 Oct · 17:00 EAT', homePct: 47, drawPct: 27 },
  { home: 'Valencia', away: 'Villarreal', competition: 'La Liga', kickoff: 'Sat 24 Oct · 19:30 EAT', homePct: 26, drawPct: 31 },
  { home: 'Crystal Palace', away: 'Newcastle', competition: 'Premier League', kickoff: 'Sun 25 Oct · 17:00 EAT', homePct: 31, drawPct: 37 },
  { home: 'Real Sociedad', away: 'Levante', competition: 'La Liga', kickoff: 'Sun 25 Oct · 20:30 EAT', homePct: 52, drawPct: 26 },
  { home: 'Ath Bilbao', away: 'Getafe', competition: 'La Liga', kickoff: 'Sun 25 Oct · 16:00 EAT', homePct: 47, drawPct: 36 },
  { home: 'Celta Vigo', away: 'Betis', competition: 'La Liga', kickoff: 'Sun 25 Oct · 18:15 EAT', homePct: 45, drawPct: 27 },
  { home: 'Sunderland', away: 'Leeds', competition: 'Premier League', kickoff: 'Sun 25 Oct · 19:30 EAT', homePct: 31, drawPct: 40 },
  { home: 'Sevilla', away: 'Osasuna', competition: 'La Liga', kickoff: 'Mon 26 Oct · 23:00 EAT', homePct: 47, drawPct: 28 },
  { home: 'Hull', away: 'Brentford', competition: 'Premier League', kickoff: 'Sun 25 Oct · 17:00 EAT', homePct: 41, drawPct: 31 },
  { home: 'Racing Santander', away: 'Espanyol', competition: 'La Liga', kickoff: 'Sat 24 Oct · 17:00 EAT', homePct: 36, drawPct: 32 },
  { home: 'Wolves', away: 'West Ham', competition: 'Premier League', kickoff: 'Sat 24 Oct · 17:00 EAT', homePct: 44, drawPct: 29 },
];

const sportpesaMidweekSettled: RawMatch[] = [
  { home: 'Hammarby FF', away: 'Anderlecht', competition: 'Europa League Q.', kickoff: 'Thu 17:00 EAT', homePct: 34, drawPct: 33, result: 'X' },
  { home: 'Gais', away: 'FC Nordsjaelland', competition: 'Europa League Q.', kickoff: 'Thu 17:00 EAT', homePct: 30, drawPct: 34, result: '1' },
  { home: 'Dynamo Kyiv', away: 'PAOK', competition: 'Europa League Q.', kickoff: 'Thu 17:00 EAT', homePct: 28, drawPct: 30, result: '2' },
  { home: 'Universitatea Cluj', away: 'Brann', competition: 'Conference League Q.', kickoff: 'Thu 17:00 EAT', homePct: 32, drawPct: 33, result: 'X' },
  { home: 'NK Varazdin', away: 'FK Jablonec', competition: 'Conference League Q.', kickoff: 'Thu 18:00 EAT', homePct: 31, drawPct: 32, result: '1' },
  { home: 'Hapoel Tel Aviv', away: 'Ludogorets', competition: 'Champions League Q.', kickoff: 'Thu 18:30 EAT', homePct: 27, drawPct: 30, result: '2' },
  { home: 'HNK Hajduk Split', away: 'Pafos', competition: 'Champions League Q.', kickoff: 'Thu 19:00 EAT', homePct: 33, drawPct: 30, result: '1' },
  { home: 'Aalborg', away: 'Hillerod', competition: 'Danish Cup', kickoff: 'Thu 19:00 EAT', homePct: 51, drawPct: 30, result: '1' },
  { home: 'Rapperswil', away: 'FC WIL 1900', competition: 'Swiss Challenge League', kickoff: 'Thu 19:00 EAT', homePct: 51, drawPct: 30, result: '2' },
  { home: 'Arges Pitesti', away: 'Petrolul Ploiesti', competition: 'Romania Liga 1', kickoff: 'Thu 19:30 EAT', homePct: 21, drawPct: 30, result: '2' },
  { home: 'Pogon Szczecin', away: 'Legia Warszawa', competition: 'Poland Ekstraklasa', kickoff: 'Thu 19:30 EAT', homePct: 24, drawPct: 30, result: '2' },
  { home: 'Cobh Ramblers', away: 'Bray Wanderers', competition: 'Ireland First Division', kickoff: 'Thu 19:45 EAT', homePct: 32, drawPct: 31, result: '2' },
  { home: 'Treaty United', away: 'Athlone Town', competition: 'Ireland Premier Division', kickoff: 'Thu 19:45 EAT', homePct: 44, drawPct: 31, result: '1' },
];

const betikaGrandSettled: RawMatch[] = [
  { home: 'Cordoba', away: 'Oviedo', competition: 'La Liga', kickoff: 'Sun 14:15 EAT', homePct: 32, drawPct: 30, result: 'X' },
  { home: 'AC Milan', away: 'Atalanta', competition: 'Serie A', kickoff: 'Sun 18:45 EAT', homePct: 26, drawPct: 30, result: '2' },
  { home: 'Sevilla', away: 'Alaves', competition: 'La Liga', kickoff: 'Sun 16:30 EAT', homePct: 35, drawPct: 30, result: 'X' },
  { home: 'Bologna', away: 'Inter', competition: 'Serie A', kickoff: 'Sun 16:00 EAT', homePct: 37, drawPct: 30, result: '1' },
  { home: 'Stade Brestois 29', away: 'Lens', competition: 'Ligue 1', kickoff: 'Sun 15:15 EAT', homePct: 33, drawPct: 30, result: '2' },
  { home: 'Reims', away: 'Toulouse', competition: 'Ligue 1', kickoff: 'Sun 15:15 EAT', homePct: 23, drawPct: 30, result: '1' },
  { home: 'Austria Vienna', away: 'Red Bull Salzburg', competition: 'Austria Bundesliga', kickoff: 'Sun 15:00 EAT', homePct: 32, drawPct: 31, result: '2' },
  { home: 'FC Volendam', away: 'Excelsior', competition: 'Eredivisie', kickoff: 'Sun 14:45 EAT', homePct: 40, drawPct: 30, result: '2' },
  { home: 'IFK Goteborg', away: 'BK Hacken', competition: 'Allsvenskan', kickoff: 'Sun 14:30 EAT', homePct: 26, drawPct: 30, result: '2' },
  { home: 'Aston Villa', away: 'Newcastle', competition: 'Premier League', kickoff: 'Sat 16:30 EAT', homePct: 34, drawPct: 30, result: '1' },
  { home: 'Genk', away: 'Union St. Gilloise', competition: 'Belgium Pro League', kickoff: 'Sun 14:00 EAT', homePct: 33, drawPct: 30, result: '2' },
  { home: 'FC Augsburg', away: 'Eintracht Frankfurt', competition: 'Bundesliga', kickoff: 'Sun 13:30 EAT', homePct: 33, drawPct: 31, result: 'X' },
  { home: 'Empoli', away: 'Venezia', competition: 'Serie A', kickoff: 'Sun 13:00 EAT', homePct: 22, drawPct: 30, result: 'X' },
  { home: 'Fulham', away: 'Chelsea', competition: 'Premier League', kickoff: 'Sun 13:00 EAT', homePct: 31, drawPct: 30, result: '2' },
  { home: 'Wolfsberger AC', away: 'Rapid Vienna', competition: 'Austria Bundesliga', kickoff: 'Sun 12:30 EAT', homePct: 33, drawPct: 31, result: '1' },
  { home: 'Burgos', away: 'Cadiz', competition: 'La Liga 2', kickoff: 'Sat 19:00 EAT', homePct: 40, drawPct: 31, result: 'X' },
  { home: 'Union Berlin', away: 'VfB Stuttgart', competition: 'Bundesliga', kickoff: 'Sat 16:30 EAT', homePct: 30, drawPct: 30, result: 'X' },
];

function makeJackpotFromLive(
  id: string,
  bookie: Jackpot['bookie'],
  name: string,
  gameweek: string,
  status: Jackpot['status'],
  entryFee: number,
  prizePool: string,
  deadline: string,
  participants: number,
  raw: RawMatch[],
  syncedAt: string,
  closesInHours?: number,
): Jackpot {
  const matches: Match[] = raw.map((m, i) => {
    const hP = m.homePct;
    const dP = m.drawPct;
    const aP = Math.max(1, 100 - hP - dP);
    return {
      id: `${id}-m${i + 1}`,
      home: m.home,
      away: m.away,
      homeLogo: m.homeLogo,
      awayLogo: m.awayLogo,
      competition: m.competition,
      kickoff: m.kickoff,
      result: m.result,
      status: m.status,
      displayClock: m.displayClock,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      homeOdds: m.homeOdds || +Math.max(1.05, 1.07 / (hP / 100)).toFixed(2),
      drawOdds: m.drawOdds || +Math.max(1.05, 1.07 / (dP / 100)).toFixed(2),
      awayOdds: m.awayOdds || +Math.max(1.05, 1.07 / (aP / 100)).toFixed(2),
      bookmaker: m.bookmaker || `${bookie} Official Odds`,
    };
  });

  const consensus: Record<string, MatchConsensus> = {};
  raw.forEach((m, i) => {
    const matchId = `${id}-m${i + 1}`;
    consensus[matchId] = buildConsensus(matchId, i * 17 + id.length * 3 + 5, m.homePct, m.drawPct);
  });

  const jpObj: Jackpot = {
    id, bookie, name, gameweek, status, entryFee, prizePool, deadline, participants,
    matches, consensus, leaderboard: undefined, closesInHours, syncedAt, numGames: matches.length,
    createdAt: Date.now(),
  };

  recalculateJackpotLeaderboard(jpObj);
  return jpObj;
}

export function updateJackpotMatchResult(
  jackpotId: string,
  matchId: string,
  result: Outcome | undefined,
  homeScore?: number | null,
  awayScore?: number | null
): Jackpot | undefined {
  const jp = activeJackpots.find((j) => j.id === jackpotId);
  if (!jp) return undefined;

  const mIdx = jp.matches.findIndex((m) => m.id === matchId);
  if (mIdx >= 0) {
    jp.matches[mIdx] = {
      ...jp.matches[mIdx],
      result,
      homeScore: homeScore !== undefined ? homeScore : jp.matches[mIdx].homeScore,
      awayScore: awayScore !== undefined ? awayScore : jp.matches[mIdx].awayScore,
      status: result ? 'post' : 'pre',
    };
  }

  recalculateJackpotLeaderboard(jp);
  saveAdminJackpot(jp);
  return jp;
}

export function autoSimulateNextLegResult(jackpotId: string): { jackpot?: Jackpot; matchName?: string; result?: Outcome } {
  const jp = activeJackpots.find((j) => j.id === jackpotId);
  if (!jp) return {};

  const unplayed = jp.matches.find((m) => m.result === undefined);
  if (!unplayed) return { jackpot: jp };

  const rand = Math.random();
  const result: Outcome = rand < 0.45 ? '1' : rand < 0.75 ? 'X' : '2';
  const homeScore = result === '1' ? 2 : result === 'X' ? 1 : 0;
  const awayScore = result === '2' ? 2 : result === 'X' ? 1 : 0;

  updateJackpotMatchResult(jp.id, unplayed.id, result, homeScore, awayScore);
  return {
    jackpot: jp,
    matchName: `${unplayed.home} vs ${unplayed.away}`,
    result,
  };
}

export const JACKPOT_ENTRY_FEE = 10;

/**
 * 3-Month Retention Policy:
 * Automatically purges any jackpot rooms or archives older than 90 days (3 months).
 */
export const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

export function purgeOldJackpots(): number {
  const now = Date.now();
  const initialLength = activeJackpots.length;
  activeJackpots = activeJackpots.filter((j) => {
    if (!j.createdAt) return true; // keep if timestamp missing
    return now - j.createdAt <= THREE_MONTHS_MS;
  });

  if (activeJackpots.length !== initialLength) {
    jackpots.length = 0;
    jackpots.push(...activeJackpots);
    try {
      localStorage.setItem('mshindi_admin_custom_jackpots', JSON.stringify(activeJackpots));
    } catch (e) {
      console.warn('Failed to update storage after purging old archives', e);
    }
    emitJackpotsChange();
  }

  return initialLength - activeJackpots.length;
}

/**
 * Calculates total picks shared prior to room closure across all leg consensus
 */
export function getTotalSharedPicksCount(jackpot: Jackpot): number {
  if (!jackpot.consensus) return jackpot.participants || 0;
  let total = 0;
  Object.values(jackpot.consensus).forEach((c) => {
    total += c.totalVotes || 0;
  });
  return Math.max(total, jackpot.participants || 0);
}

const listeners = new Set<() => void>();
let jackpotsSnapshot: Jackpot[] = [];

export function subscribeToJackpots(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitJackpotsChange() {
  jackpotsSnapshot = [...activeJackpots];
  listeners.forEach((l) => l());
}

let activeJackpots: Jackpot[] = [];

export const jackpots: Jackpot[] = activeJackpots;

function deduplicateJackpots() {
  const seen = new Set<string>();
  const unique: Jackpot[] = [];
  for (const j of activeJackpots) {
    if (!seen.has(j.id)) {
      seen.add(j.id);
      unique.push(j);
    }
  }
  activeJackpots = unique;
  jackpots.length = 0;
  jackpots.push(...activeJackpots);
  jackpotsSnapshot = [...activeJackpots];
}

// Restore any manually saved admin jackpots from localStorage or seed defaults
try {
  const stored = localStorage.getItem('mshindi_admin_custom_jackpots');
  if (stored) {
    const parsed: Jackpot[] = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      activeJackpots = parsed.map((j) => ({
        ...j,
        gameweek: j.gameweek ? j.gameweek.replace(/ · Admin Manual Update/gi, ' · Live Sync') : j.gameweek,
        syncedAt: j.syncedAt ? j.syncedAt.replace(/Admin Manual Update · /gi, `Live synced from ${j.bookie} · `) : j.syncedAt,
      }));
      deduplicateJackpots();
    }
  }
} catch (e) {
  console.warn('Could not load custom admin jackpots from storage:', e);
}

if (activeJackpots.length === 0) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const spMega = makeJackpotFromLive('sp-mega-live', 'SportPesa', 'Mega Jackpot Pro', '17 Games · Live Mirrored', 'open', JACKPOT_ENTRY_FEE, 'Ksh 354,820,110', 'Begins: Sat 18:00 EAT', 12480, sportpesaMegaLive, 'Live Sync', 16);
  spMega.createdAt = now - 2 * dayMs;

  const betMidweek = makeJackpotFromLive('bet-midweek-live', 'Betika', 'Midweek Jackpot', '15 Games · Live Mirrored', 'open', JACKPOT_ENTRY_FEE, 'Ksh 15,000,000', 'Begins: Sat 16:00 EAT', 9840, betikaMidweekLive, 'Live Sync', 20);
  betMidweek.createdAt = now - 5 * dayMs;

  const spSettled = makeJackpotFromLive('sp-midweek-settled', 'SportPesa', 'Midweek Jackpot', '13 Games · Settled Archive', 'settled', JACKPOT_ENTRY_FEE, 'Ksh 12,500,000', 'Ended 14 Jul', 14200, sportpesaMidweekSettled, 'Archived');
  spSettled.createdAt = now - 25 * dayMs; // ~25 days ago (within 3 months retention)

  const betGrandSettled = makeJackpotFromLive('bet-grand-settled', 'Betika', 'Grand Jackpot', '17 Games · Settled Archive', 'settled', JACKPOT_ENTRY_FEE, 'Ksh 100,000,000', 'Ended 07 Jul', 18900, betikaGrandSettled, 'Archived');
  betGrandSettled.createdAt = now - 50 * dayMs; // ~50 days ago (within 3 months retention)

  activeJackpots = [spMega, betMidweek, spSettled, betGrandSettled];
  deduplicateJackpots();
}

// Automatically enforce 3-month archive retention policy on startup
purgeOldJackpots();

export function saveAdminJackpot(newJackpot: Jackpot) {
  const existingIdx = activeJackpots.findIndex((j) => j.id === newJackpot.id);
  if (existingIdx >= 0) {
    activeJackpots[existingIdx] = newJackpot;
  } else {
    activeJackpots.unshift(newJackpot);
  }

  deduplicateJackpots();

  try {
    localStorage.setItem('mshindi_admin_custom_jackpots', JSON.stringify(activeJackpots));
  } catch (e) {
    console.warn('Failed to persist admin jackpot to local storage', e);
  }

  emitJackpotsChange();
}

export function deleteAdminJackpot(id: string) {
  activeJackpots = activeJackpots.filter((j) => j.id !== id);
  jackpots.length = 0;
  jackpots.push(...activeJackpots);

  try {
    localStorage.setItem('mshindi_admin_custom_jackpots', JSON.stringify(activeJackpots));
  } catch (e) {
    console.warn('Failed to persist admin jackpot deletion to local storage', e);
  }

  emitJackpotsChange();
}

export function clearAllJackpots() {
  activeJackpots = [];
  jackpots.length = 0;
  try {
    localStorage.removeItem('mshindi_admin_custom_jackpots');
  } catch (e) {
    console.warn('Failed to clear admin jackpots from local storage', e);
  }
  emitJackpotsChange();
}

export function createAdminJackpotRoom(params: {
  id?: string;
  bookie: Jackpot['bookie'];
  name: string;
  prizePool: string;
  startTime: string;
  entryFee?: number;
  rawMatches: RawMatch[];
}): Jackpot {
  const id = params.id || `admin-${params.bookie.toLowerCase()}-${Date.now()}`;
  const timeNow = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const gameweek = `${params.rawMatches.length} Games · Live Sync`;
  const syncedAt = `Live synced from ${params.bookie} · ${timeNow} EAT`;
  const deadline = params.startTime ? `Begins: ${params.startTime}` : 'Begins soon';

  const jp = makeJackpotFromLive(
    id,
    params.bookie,
    params.name,
    gameweek,
    'open',
    params.entryFee || JACKPOT_ENTRY_FEE,
    params.prizePool || 'Ksh 100,000,000',
    deadline,
    8500,
    params.rawMatches,
    syncedAt,
    24
  );

  saveAdminJackpot(jp);
  return jp;
}

export function getJackpotsSnapshot() {
  if (jackpotsSnapshot.length === 0 && activeJackpots.length > 0) {
    jackpotsSnapshot = [...activeJackpots];
  }
  return jackpotsSnapshot;
}

export function getJackpot(id: string): Jackpot | undefined {
  return jackpots.find((j) => j.id === id);
}

export async function syncJackpotsFromApi() {
  try {
    let marketFixtures: any[] = [];
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;
      const res = await fetch('/api/sports/daily-fixtures', controller ? { signal: controller.signal } : {});
      if (timeoutId) clearTimeout(timeoutId);
      if (res.ok) {
        const d = await res.json();
        if (d && d.success && Array.isArray(d.fixtures) && d.fixtures.length > 0) {
          marketFixtures = d.fixtures;
        }
      }
    } catch {
      // Ignore network/proxy error and use live fixtures
    }

    let spMegaMatches: RawMatch[] = [];
    let betikaMidweekMatches: RawMatch[] = [];

    if (marketFixtures.length >= 10) {
      spMegaMatches = marketFixtures.slice(0, 17).map((f) => ({
        home: f.home,
        away: f.away,
        competition: f.competition || 'Premier League',
        kickoff: f.kickoff,
        homePct: f.homePct,
        drawPct: f.drawPct,
        homeOdds: f.homeOdds,
        drawOdds: f.drawOdds,
        awayOdds: f.awayOdds,
        bookmaker: 'Market Consensus',
      }));

      betikaMidweekMatches = marketFixtures.slice(0, 15).map((f) => ({
        home: f.home,
        away: f.away,
        competition: f.competition || 'Premier League',
        kickoff: f.kickoff,
        homePct: f.homePct,
        drawPct: f.drawPct,
        homeOdds: f.homeOdds,
        drawOdds: f.drawOdds,
        awayOdds: f.awayOdds,
        bookmaker: 'Market Consensus',
      }));
    } else {
      const [spMegaMirror, betikaMidweekMirror] = await Promise.all([
        fetchSportpesaMegaMirror(),
        fetchBetikaMidweekMirror(),
      ]);

      spMegaMatches = spMegaMirror.fixtures.length > 0
        ? spMegaMirror.fixtures.map((f, i) => ({
            home: f.home,
            away: f.away,
            competition: f.competition,
            kickoff: f.kickoff,
            homePct: f.homePct || (45 + (i % 5) * 4),
            drawPct: f.drawPct || 30,
          }))
        : sportpesaMegaLive;

      betikaMidweekMatches = betikaMidweekMirror.fixtures.length > 0
        ? betikaMidweekMirror.fixtures.map((f, i) => ({
            home: f.home,
            away: f.away,
            competition: f.competition,
            kickoff: f.kickoff,
            homePct: f.homePct || (42 + (i % 6) * 3),
            drawPct: f.drawPct || 30,
          }))
        : betikaMidweekLive;
    }

    const updatedMega = makeJackpotFromLive(
      'sp-mega-live',
      'SportPesa',
      'Mega Jackpot Pro',
      '17 Games · Live Mirrored',
      'open',
      JACKPOT_ENTRY_FEE,
      spMegaMirror.prizeMoney,
      `Begins: ${spMegaMirror.startTime}`,
      12480,
      spMegaMatches,
      spMegaMirror.syncedAt,
      16
    );

    const updatedMidweek = makeJackpotFromLive(
      'bet-midweek-live',
      'Betika',
      'Midweek Jackpot',
      '15 Games · Live Mirrored',
      'open',
      JACKPOT_ENTRY_FEE,
      betikaMidweekMirror.prizeMoney,
      `Begins: ${betikaMidweekMirror.startTime}`,
      9840,
      betikaMidweekMatches,
      betikaMidweekMirror.syncedAt,
      20
    );

    const spIdx = activeJackpots.findIndex((j) => j.id === 'sp-mega-live');
    if (spIdx >= 0) {
      activeJackpots[spIdx] = updatedMega;
    }

    const betIdx = activeJackpots.findIndex((j) => j.id === 'bet-midweek-live');
    if (betIdx >= 0) {
      activeJackpots[betIdx] = updatedMidweek;
    }

    deduplicateJackpots();
    emitJackpotsChange();
  } catch (err) {
    console.warn('Sync jackpot mirror error:', err);
  }
}
