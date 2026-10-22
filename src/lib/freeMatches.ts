import type { MatchConsensus } from './types';
import type { MatchPeriod, MatchStatus } from './matchStatus';
import { buildConsensus } from './consensusEngine';
import { fetchDailyHighlightFixtures, type HighlightFixture } from './footballApi';

const listeners = new Set<() => void>();

export type MatchTier = 'blockbuster' | 'continental' | 'derby';

export interface FreeMatch {
  id: string;
  providerId?: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  competition: string;
  competitionId?: string;
  leagueCode?: string;
  country?: string;
  kickoff: string;
  kickoffIso?: string;
  tier: MatchTier;
  blurb: string;
  syncedAt: string;
  lastSyncTime?: string;
  status?: MatchStatus;
  period?: MatchPeriod;
  periodSequence?: number;
  displayClock?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeHtScore?: number | null;
  awayHtScore?: number | null;
  result?: '1' | 'X' | '2';
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  bookmaker?: string;
  bttsYesPct?: number;
  over15Pct?: number;
  over25Pct?: number;
  over35Pct?: number;
  homePct?: number;
  drawPct?: number;
  awayPct?: number;
}

let liveMatches: FreeMatch[] = [];
let liveConsensus: Record<string, MatchConsensus> = {};

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
    providerId: item.providerId || item.id,
    home: item.home,
    away: item.away,
    homeLogo: item.homeLogo,
    awayLogo: item.awayLogo,
    competition: item.competition,
    competitionId: item.competitionId,
    leagueCode: item.leagueCode,
    country: item.country,
    kickoff: item.kickoff,
    kickoffIso: item.kickoffIso,
    tier: item.tier,
    blurb: item.blurb,
    syncedAt: item.syncedAt,
    lastSyncTime: item.lastSyncTime,
    status: item.status,
    period: item.period,
    periodSequence: item.periodSequence,
    displayClock: item.displayClock,
    homeScore: item.homeScore,
    awayScore: item.awayScore,
    homeHtScore: item.homeHtScore,
    awayHtScore: item.awayHtScore,
    result: item.result,
    homeOdds: item.homeOdds,
    drawOdds: item.drawOdds,
    awayOdds: item.awayOdds,
    bookmaker: item.bookmaker,
    bttsYesPct: item.bttsYesPct,
    over15Pct: item.over15Pct,
    over25Pct: item.over25Pct,
    over35Pct: item.over35Pct,
    homePct: item.homePct,
    drawPct: item.drawPct,
    awayPct: item.awayPct,
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

export async function refreshFreeMatches(force = false) {
  // Only show full loading state during initial page hydration
  if (!hasSyncedFreeMatchesOnce) {
    isSyncingFreeMatches = true;
    emitFreeMatchesChange();
  }

  try {
    const fixtures = await fetchDailyHighlightFixtures(force);
    if (fixtures.length > 0) {
      liveMatches = fixtures.map((fixture) => toFreeMatch(fixture));
      liveConsensus = Object.fromEntries(
        liveMatches.map((match, index) => [
          match.id,
          freeMatchConsensus[match.id] || buildConsensus(match.id, index * 17 + 7, fixtures[index].homePct, fixtures[index].drawPct),
        ]),
      ) as Record<string, MatchConsensus>;
    } else {
      liveMatches = [];
      liveConsensus = {};
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

export function setUploadedFreeMatches(fixtures: FreeMatch[]) {
  liveMatches = [...fixtures];
  liveConsensus = Object.fromEntries(
    liveMatches.map((match, index) => [
      match.id,
      freeMatchConsensus[match.id] || buildConsensus(match.id, index * 17 + 7, match.homePct || 33, match.drawPct || 34),
    ]),
  ) as Record<string, MatchConsensus>;

  freeMatches.splice(0, freeMatches.length, ...liveMatches);
  Object.keys(freeMatchConsensus).forEach((key) => delete freeMatchConsensus[key]);
  Object.assign(freeMatchConsensus, liveConsensus);
  hasSyncedFreeMatchesOnce = true;
  emitFreeMatchesChange();

  try {
    localStorage.setItem('mshindi_uploaded_fixtures', JSON.stringify(fixtures));
  } catch {}
}

export function clearAllFreeMatches() {
  liveMatches = [];
  liveConsensus = {};
  freeMatches.splice(0, freeMatches.length);
  Object.keys(freeMatchConsensus).forEach((key) => delete freeMatchConsensus[key]);
  hasSyncedFreeMatchesOnce = true;
  emitFreeMatchesChange();

  try {
    localStorage.removeItem('mshindi_uploaded_fixtures');
  } catch {}
}

export function getFreeMatch(id: string): FreeMatch | undefined {
  return freeMatches.find((m) => m.id === id);
}

export const TIER_LABEL: Record<MatchTier, string> = {
  blockbuster: 'Blockbuster Match',
  continental: 'Continental Cup Night',
  derby: 'Derby Day',
};
