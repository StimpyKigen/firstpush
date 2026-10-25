import type { MatchConsensus } from './types';
import { type MatchPeriod, type MatchStatus, isStatusTransitionValid } from './matchStatus';
import { buildConsensus } from './consensusEngine';
import { fetchDailyHighlightFixtures, type HighlightFixture } from './footballApi';

const listeners = new Set<() => void>();

export type MatchTier = 'blockbuster' | 'continental' | 'derby';

export interface FreeMatch {
  id: string;
  providerId?: string;
  matchId?: string;
  matchUrl?: string;
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

function loadStoredMatches(): FreeMatch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('mshindi_football_cache_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((m: any) => m && m.id && !m.id.startsWith('future_') && m.providerId !== 'ars_che_001')
          .map((m: any) => toFreeMatch(m));
      }
    }
  } catch {}
  return [];
}

let liveMatches: FreeMatch[] = loadStoredMatches();
let liveConsensus: Record<string, MatchConsensus> = Object.fromEntries(
  liveMatches.map((match, index) => [
    match.id,
    buildConsensus(match.id, index * 17 + 7, match.homePct || 33, match.drawPct || 34),
  ])
);

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
    matchId: item.matchId,
    matchUrl: item.matchUrl,
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

export function makeFreeMatchDedupeKey(m: { matchId?: string; home: string; away: string; kickoffIso?: string; kickoff?: string }): string {
  if (m.matchId) {
    return `mid_${m.matchId}`;
  }
  const h = (m.home || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = (m.away || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let dateKey = '';
  if (m.kickoffIso) {
    const isoM = m.kickoffIso.match(/^\d{4}-(\d{2})-(\d{2})/);
    if (isoM) {
      dateKey = `${isoM[2]}_${isoM[1]}`; // DD_MM
    }
  }
  if (!dateKey && m.kickoff) {
    const dmM = m.kickoff.match(/^(\d{1,2})[/-](\d{1,2})/);
    if (dmM) {
      dateKey = `${dmM[1].padStart(2, '0')}_${dmM[2].padStart(2, '0')}`;
    }
  }
  if (!dateKey) {
    dateKey = (m.kickoffIso || m.kickoff || '').replace(/[^0-9]/g, '').slice(0, 8);
  }

  return `${h}___${a}___${dateKey}`;
}

export async function refreshFreeMatches(force = false) {
  // Only show full loading state during initial page hydration if no matches are cached
  if (!hasSyncedFreeMatchesOnce && liveMatches.length === 0) {
    isSyncingFreeMatches = true;
    emitFreeMatchesChange();
  }

  try {
    // 1. Fetch daily highlights directly from SportScore API pipeline
    const highlightFixtures = await fetchDailyHighlightFixtures(force);
    const convertedHighlights = highlightFixtures.map((fixture) => toFreeMatch(fixture));

    // 2. Load locally cached SportScore fixtures
    const storedFixtures = loadStoredMatches();

    // 3. Merge sources with deduplication & monotonic state validation
    const mergeFreeMatchRecords = (existing: FreeMatch, incoming: FreeMatch): FreeMatch => {
      const existingStatus = existing.status || 'pre';
      const existingPeriod = existing.period || 'scheduled';
      const incomingStatus = incoming.status || 'pre';
      const incomingPeriod = incoming.period || 'scheduled';

      const isPermitted = isStatusTransitionValid(
        existingStatus,
        existingPeriod,
        incomingStatus,
        incomingPeriod
      );

      let finalStatus = isPermitted ? incomingStatus : existingStatus;
      let finalPeriod = isPermitted ? incomingPeriod : existingPeriod;
      let finalClock = isPermitted ? (incoming.displayClock || existing.displayClock) : existing.displayClock;

      // Terminal status invariant: completed matches ('post') must never be downgraded
      if (existingStatus === 'post' && incomingStatus !== 'post') {
        finalStatus = 'post';
        finalPeriod = existingPeriod === 'scheduled' ? 'full_time' : existingPeriod;
      }

      let finalHomeScore = incoming.homeScore !== null && incoming.homeScore !== undefined ? incoming.homeScore : existing.homeScore;
      let finalAwayScore = incoming.awayScore !== null && incoming.awayScore !== undefined ? incoming.awayScore : existing.awayScore;
      if (finalStatus === 'post' && (finalHomeScore === null || finalHomeScore === undefined)) {
        finalHomeScore = existing.homeScore;
        finalAwayScore = existing.awayScore;
      }

      const isIncomingBet365 = incoming.bookmaker === 'Bet365';
      const isExistingBet365 = existing.bookmaker === 'Bet365';
      const preferBet365 = isIncomingBet365 || isExistingBet365;

      const finalBookmaker = preferBet365 ? 'Bet365' : (incoming.bookmaker || existing.bookmaker);
      const finalHomeOdds = isExistingBet365 && !isIncomingBet365 ? existing.homeOdds : (incoming.homeOdds || existing.homeOdds);
      const finalDrawOdds = isExistingBet365 && !isIncomingBet365 ? existing.drawOdds : (incoming.drawOdds || existing.drawOdds);
      const finalAwayOdds = isExistingBet365 && !isIncomingBet365 ? existing.awayOdds : (incoming.awayOdds || existing.awayOdds);
      const finalHomePct = isExistingBet365 && !isIncomingBet365 ? existing.homePct : (incoming.homePct || existing.homePct);
      const finalDrawPct = isExistingBet365 && !isIncomingBet365 ? existing.drawPct : (incoming.drawPct || existing.drawPct);
      const finalAwayPct = isExistingBet365 && !isIncomingBet365 ? existing.awayPct : (incoming.awayPct || existing.awayPct);
      const finalOver25Pct = isExistingBet365 && !isIncomingBet365 ? existing.over25Pct : (incoming.over25Pct ?? existing.over25Pct);
      const finalMatchUrl = incoming.matchUrl || existing.matchUrl;

      return {
        ...existing,
        ...incoming,
        matchUrl: finalMatchUrl,
        bookmaker: finalBookmaker,
        homeOdds: finalHomeOdds,
        drawOdds: finalDrawOdds,
        awayOdds: finalAwayOdds,
        homePct: finalHomePct,
        drawPct: finalDrawPct,
        awayPct: finalAwayPct,
        over25Pct: finalOver25Pct,
        status: finalStatus,
        period: finalPeriod,
        displayClock: finalClock,
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
      };
    };

    const mergedMap = new Map<string, FreeMatch>();

    if (convertedHighlights.length > 0) {
      // Create lookup map of stored fixtures for fast merging
      const storedMap = new Map<string, FreeMatch>();
      for (const m of storedFixtures) {
        if (!m.id?.startsWith('future_') && m.providerId !== 'ars_che_001') {
          storedMap.set(makeFreeMatchDedupeKey(m), m);
        }
      }

      // Authoritative fresh highlights from server are the primary foundation
      for (const m of convertedHighlights) {
        const key = makeFreeMatchDedupeKey(m);
        const existing = storedMap.get(key);
        mergedMap.set(key, existing ? mergeFreeMatchRecords(existing, m) : m);
      }

      // Preserve active admin PDF uploads and genuine live in-play matches from stored fixtures
      for (const m of storedFixtures) {
        const key = makeFreeMatchDedupeKey(m);
        if (!mergedMap.has(key)) {
          const isAdmin = m.id?.startsWith('admin_') || m.providerId?.startsWith('admin_');
          const isLive = m.status === 'in';
          if (isAdmin || isLive) {
            mergedMap.set(key, m);
          }
        }
      }
    } else {
      // Fallback: if server returned no highlights, preserve valid stored fixtures
      for (const m of storedFixtures) {
        if (!m.id?.startsWith('future_') && m.providerId !== 'ars_che_001') {
          mergedMap.set(makeFreeMatchDedupeKey(m), m);
        }
      }
    }

    const mergedList = Array.from(mergedMap.values());

    if (mergedList.length > 0) {
      liveMatches = mergedList;
      liveConsensus = Object.fromEntries(
        liveMatches.map((match, index) => [
          match.id,
          buildConsensus(match.id, index * 17 + 7, match.homePct || 33, match.drawPct || 34),
        ]),
      ) as Record<string, MatchConsensus>;

      try {
        localStorage.setItem('mshindi_football_cache_v3', JSON.stringify(liveMatches));
      } catch {}
    } else if (liveMatches.length === 0) {
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

export interface PdfFixtureBatch {
  id: string;
  fileName: string;
  fixtureCount: number;
  publishedAt: string;
  sectoredCount: number;
}

export function getPdfFixtureBatches(): PdfFixtureBatch[] {
  try {
    const raw = localStorage.getItem('mshindi_fixture_batches');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function savePdfFixtureBatches(batches: PdfFixtureBatch[]) {
  try {
    localStorage.setItem('mshindi_fixture_batches', JSON.stringify(batches));
  } catch {}
}

export function deletePdfFixtureBatch(batchId: string): PdfFixtureBatch[] {
  const batches = getPdfFixtureBatches().filter((b) => b.id !== batchId);
  savePdfFixtureBatches(batches);
  return batches;
}

export function appendUploadedFreeMatches(
  incoming: FreeMatch[],
  batchMeta?: { fileName: string; sectoredCount: number }
): { totalCount: number; addedCount: number; batches: PdfFixtureBatch[] } {
  const existingMap = new Map<string, FreeMatch>();
  for (const m of liveMatches) {
    existingMap.set(makeFreeMatchDedupeKey(m), m);
  }

  let addedCount = 0;
  for (const inc of incoming) {
    const key = makeFreeMatchDedupeKey(inc);
    if (existingMap.has(key)) {
      // Duplicate fixture found on new PDF: keep existing, do not show duplicates
      const prev = existingMap.get(key)!;
      existingMap.set(key, {
        ...prev,
        ...inc,
        id: prev.id,
      });
    } else {
      existingMap.set(key, inc);
      addedCount++;
    }
  }

  const merged = Array.from(existingMap.values());
  setUploadedFreeMatches(merged);

  let batches = getPdfFixtureBatches();
  if (batchMeta && incoming.length > 0) {
    const newBatch: PdfFixtureBatch = {
      id: `batch-${Date.now()}`,
      fileName: batchMeta.fileName || 'uploaded-fixtures.pdf',
      fixtureCount: incoming.length,
      publishedAt: new Date().toISOString(),
      sectoredCount: batchMeta.sectoredCount || 1,
    };
    batches = [newBatch, ...batches];
    savePdfFixtureBatches(batches);
  }

  return {
    totalCount: merged.length,
    addedCount,
    batches,
  };
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
    localStorage.removeItem('mshindi_football_cache_v3');
    localStorage.removeItem('mshindi_uploaded_fixtures');
    localStorage.removeItem('mshindi_fixture_batches');
  } catch {}
}

export function updateFreeMatchOdds(enriched: FreeMatch[]) {
  if (!enriched || enriched.length === 0) return;
  const enrichedMap = new Map(enriched.map((m) => [m.id, m]));
  let hasChanges = false;

  liveMatches = liveMatches.map((existing) => {
    const updated = enrichedMap.get(existing.id);
    if (updated && updated.bookmaker === 'Bet365' && existing.bookmaker !== 'Bet365') {
      hasChanges = true;
      return {
        ...existing,
        bookmaker: 'Bet365',
        homeOdds: updated.homeOdds || existing.homeOdds,
        drawOdds: updated.drawOdds || existing.drawOdds,
        awayOdds: updated.awayOdds || existing.awayOdds,
        homePct: updated.homePct || existing.homePct,
        drawPct: updated.drawPct || existing.drawPct,
        awayPct: updated.awayPct || existing.awayPct,
        over25Pct: updated.over25Pct ?? existing.over25Pct,
      };
    }
    return existing;
  });

  if (hasChanges) {
    freeMatches.splice(0, freeMatches.length, ...liveMatches);
    emitFreeMatchesChange();
    try {
      localStorage.setItem('mshindi_football_cache_v3', JSON.stringify(liveMatches));
    } catch {}
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
