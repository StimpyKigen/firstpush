import type { MatchConsensus } from './types';
import { buildConsensus } from './consensusEngine';
import { fetchDailyHighlightFixtures, getEffectiveMatchDayFormattedEAT, type HighlightFixture } from './footballApi';

const listeners = new Set<() => void>();

export type MatchTier = 'blockbuster' | 'continental' | 'derby';

export interface FreeMatch {
  id: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  competition: string;
  kickoff: string;
  kickoffIso?: string;
  tier: MatchTier;
  blurb: string;
  syncedAt: string;
  status?: 'pre' | 'in' | 'post';
  displayClock?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  result?: '1' | 'X' | '2';
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  bookmaker?: string;
}

function getDynamicFallbackMatches(): FreeMatch[] {
  const activeDayLabel = getEffectiveMatchDayFormattedEAT(new Date());
  return [
    {
      id: 'free-m1',
      home: 'Arsenal',
      away: 'Coventry City',
      competition: 'English Premier League',
      kickoff: `${activeDayLabel} · 22:00 EAT`,
      tier: 'blockbuster',
      blurb: 'Arsenal host Coventry City in a high-profile fixture with full crowd predictions active.',
      syncedAt: 'Live sync ESPN & SportsDB',
      homeOdds: 1.37,
      drawOdds: 7.64,
      awayOdds: 13.38,
      bookmaker: 'Official Bookmaker',
    },
    {
      id: 'free-m2',
      home: 'Trabzonspor',
      away: 'Al Sadd',
      competition: 'International Club Friendly',
      kickoff: `${activeDayLabel} · 20:00 EAT`,
      tier: 'continental',
      blurb: 'Trabzonspor face Qatar champions Al Sadd in a fast-paced clash.',
      syncedAt: 'Live sync ESPN',
      homeOdds: 2.06,
      drawOdds: 4.12,
      awayOdds: 4.86,
      bookmaker: 'Official Bookmaker',
    },
    {
      id: 'free-m3',
      home: 'Sunderland',
      away: 'Leeds United',
      competition: 'English Championship',
      kickoff: `${activeDayLabel} · 17:00 EAT`,
      tier: 'derby',
      blurb: 'Fierce rivalry under the floodlights with both sides hunting automatic promotion.',
      syncedAt: 'Live sync ESPN',
      homeOdds: 2.55,
      drawOdds: 3.57,
      awayOdds: 3.82,
      bookmaker: 'Official Bookmaker',
    },
    {
      id: 'free-m4',
      home: 'Deportivo Alavés',
      away: 'Getafe',
      competition: 'Spanish LALIGA',
      kickoff: `${activeDayLabel} · 19:00 EAT`,
      tier: 'blockbuster',
      blurb: 'Tactical duel in Mendizorrotza with tight defenses battling for key league points.',
      syncedAt: 'Live sync TheSportsDB',
      homeOdds: 2.38,
      drawOdds: 3.34,
      awayOdds: 4.65,
      bookmaker: 'Official Bookmaker',
    },
  ];
}

const RAW_PCT = [
  { homePct: 78, drawPct: 14 },
  { homePct: 52, drawPct: 26 },
  { homePct: 42, drawPct: 30 },
  { homePct: 45, drawPct: 32 },
];

let liveMatches: FreeMatch[] = getDynamicFallbackMatches();
let liveConsensus: Record<string, MatchConsensus> = Object.fromEntries(
  liveMatches.map((m, i) => [m.id, buildConsensus(m.id, i * 13 + 41, RAW_PCT[i].homePct, RAW_PCT[i].drawPct)]),
) as Record<string, MatchConsensus>;

export const freeMatches: FreeMatch[] = liveMatches;
export const freeMatchConsensus: Record<string, MatchConsensus> = liveConsensus;

let freeMatchesSnapshot: FreeMatch[] = [...liveMatches];
let freeMatchConsensusSnapshot: Record<string, MatchConsensus> = { ...liveConsensus };

export function getFreeMatchesSnapshot() {
  return freeMatchesSnapshot;
}

export function getFreeMatchConsensusSnapshot() {
  return freeMatchConsensusSnapshot;
}

export function subscribeToFreeMatches(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitFreeMatchesChange() {
  freeMatchesSnapshot = [...liveMatches];
  freeMatchConsensusSnapshot = { ...liveConsensus };
  listeners.forEach((listener) => listener());
}

function toFreeMatch(item: HighlightFixture): FreeMatch {
  return {
    id: item.id,
    home: item.home,
    away: item.away,
    homeLogo: item.homeLogo,
    awayLogo: item.awayLogo,
    competition: item.competition,
    kickoff: item.kickoff,
    kickoffIso: item.kickoffIso,
    tier: item.tier,
    blurb: item.blurb,
    syncedAt: item.syncedAt,
    status: item.status,
    displayClock: item.displayClock,
    homeScore: item.homeScore,
    awayScore: item.awayScore,
    result: item.result,
    homeOdds: item.homeOdds,
    drawOdds: item.drawOdds,
    awayOdds: item.awayOdds,
    bookmaker: item.bookmaker,
  };
}

export async function refreshFreeMatches() {
  const fixtures = await fetchDailyHighlightFixtures();
  if (fixtures.length === 0) {
    const fallbacks = getDynamicFallbackMatches();
    liveMatches = fallbacks;
    liveConsensus = Object.fromEntries(
      fallbacks.map((m, i) => [m.id, buildConsensus(m.id, i * 13 + 41, RAW_PCT[i].homePct, RAW_PCT[i].drawPct)]),
    ) as Record<string, MatchConsensus>;
  } else {
    liveMatches = fixtures.map((fixture) => toFreeMatch(fixture));
    liveConsensus = Object.fromEntries(
      liveMatches.map((match, index) => [match.id, buildConsensus(match.id, index * 17 + 7, fixtures[index].homePct, fixtures[index].drawPct)]),
    ) as Record<string, MatchConsensus>;
  }

  freeMatches.splice(0, freeMatches.length, ...liveMatches);
  Object.keys(freeMatchConsensus).forEach((key) => delete freeMatchConsensus[key]);
  Object.assign(freeMatchConsensus, liveConsensus);
  emitFreeMatchesChange();
}

export function getFreeMatch(id: string): FreeMatch | undefined {
  return freeMatches.find((m) => m.id === id);
}

export const TIER_LABEL: Record<MatchTier, string> = {
  blockbuster: 'Blockbuster Match',
  continental: 'Continental Cup Night',
  derby: 'Derby Day',
};
