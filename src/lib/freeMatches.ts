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
      home: 'Barcelona',
      away: 'Real Madrid',
      competition: 'Spanish La Liga',
      kickoff: `${activeDayLabel} · 23:00 EAT`,
      tier: 'derby',
      blurb: 'El Clásico: Barcelona host Real Madrid in a colossal title clash with millions tracking consensus.',
      syncedAt: 'Live Consensus Feed',
      homeOdds: 2.02,
      drawOdds: 4.28,
      awayOdds: 4.86,
      bookmaker: 'Market Consensus',
    },
    {
      id: 'free-m2',
      home: 'Chelsea',
      away: 'Tottenham',
      competition: 'English Premier League',
      kickoff: `${activeDayLabel} · 19:30 EAT`,
      tier: 'derby',
      blurb: 'London Derby: Stamford Bridge under the floodlights as Chelsea battle Spurs for top-four positioning.',
      syncedAt: 'Live Consensus Feed',
      homeOdds: 2.05,
      drawOdds: 3.96,
      awayOdds: 5.23,
      bookmaker: 'Market Consensus',
    },
    {
      id: 'free-m3',
      home: 'Arsenal',
      away: 'Everton',
      competition: 'English Premier League',
      kickoff: `${activeDayLabel} · 17:00 EAT`,
      tier: 'blockbuster',
      blurb: 'Arsenal look to control tempo at the Emirates with strong community consensus backing them.',
      syncedAt: 'Live Consensus Feed',
      homeOdds: 2.05,
      drawOdds: 3.96,
      awayOdds: 5.23,
      bookmaker: 'Market Consensus',
    },
    {
      id: 'free-m4',
      home: 'Liverpool',
      away: 'Brighton',
      competition: 'English Premier League',
      kickoff: `${activeDayLabel} · 17:00 EAT`,
      tier: 'blockbuster',
      blurb: 'High-octane clash at Anfield with both sides known for intense attacking football.',
      syncedAt: 'Live Consensus Feed',
      homeOdds: 2.27,
      drawOdds: 4.12,
      awayOdds: 3.97,
      bookmaker: 'Market Consensus',
    },
  ];
}

const RAW_PCT = [
  { homePct: 53, drawPct: 25 },
  { homePct: 52, drawPct: 27 },
  { homePct: 52, drawPct: 27 },
  { homePct: 47, drawPct: 26 },
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

let isSyncingFreeMatches = false;
let hasSyncedFreeMatchesOnce = false;

export function getIsFreeMatchesSyncing(): boolean {
  return isSyncingFreeMatches;
}

export function getHasFreeMatchesSynced(): boolean {
  return hasSyncedFreeMatchesOnce;
}

export async function refreshFreeMatches() {
  isSyncingFreeMatches = true;
  emitFreeMatchesChange();
  try {
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
  } finally {
    isSyncingFreeMatches = false;
    hasSyncedFreeMatchesOnce = true;
    emitFreeMatchesChange();
  }
}

export function getFreeMatch(id: string): FreeMatch | undefined {
  return freeMatches.find((m) => m.id === id);
}

export const TIER_LABEL: Record<MatchTier, string> = {
  blockbuster: 'Blockbuster Match',
  continental: 'Continental Cup Night',
  derby: 'Derby Day',
};
