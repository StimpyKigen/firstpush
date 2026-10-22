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

function loadStoredMatches(): FreeMatch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('mshindi_uploaded_fixtures');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
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

export function makeFreeMatchDedupeKey(m: { home: string; away: string; kickoffIso?: string; kickoff?: string }): string {
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
    // 1. Fetch server admin fixtures (persisted on disk / backend cache)
    let serverFixtures: FreeMatch[] = [];
    try {
      const adminRes = await fetch('/api/admin/fixtures');
      if (adminRes.ok) {
        const data = await adminRes.json();
        if (data && Array.isArray(data.fixtures) && data.fixtures.length > 0) {
          serverFixtures = data.fixtures.map((m: any) => ({
            id: m.id,
            providerId: m.providerId || m.id,
            home: m.home,
            away: m.away,
            competition: m.competition,
            competitionId: m.competitionId,
            leagueCode: m.leagueCode,
            country: m.country,
            kickoff: m.kickoff,
            kickoffIso: m.kickoffIso,
            tier: 'blockbuster' as MatchTier,
            blurb: `${m.home} face ${m.away} in ${m.competition}.`,
            syncedAt: m.syncedAt || 'Uploaded Market Consensus',
            status: m.status || 'pre',
            homeOdds: m.homeOdds,
            drawOdds: m.drawOdds,
            awayOdds: m.awayOdds,
            homePct: m.homePct,
            drawPct: m.drawPct,
            awayPct: m.awayPct,
            bttsYesPct: m.bttsYesPct,
            over25Pct: m.over25Pct,
            bookmaker: m.bookmaker || 'Uploaded Market Consensus',
          }));
        }
        if (data && Array.isArray(data.batches) && data.batches.length > 0) {
          savePdfFixtureBatches(data.batches);
        }
      }
    } catch {}

    // 2. Fetch daily highlights
    const highlightFixtures = await fetchDailyHighlightFixtures(force);
    const convertedHighlights = highlightFixtures.map((fixture) => toFreeMatch(fixture));

    // 3. Load locally stored fixtures
    const storedFixtures = loadStoredMatches();

    // 4. Merge all sources with deduplication (Server fixtures > Local stored > Highlights)
    const mergedMap = new Map<string, FreeMatch>();

    for (const m of convertedHighlights) {
      mergedMap.set(makeFreeMatchDedupeKey(m), m);
    }
    for (const m of storedFixtures) {
      const key = makeFreeMatchDedupeKey(m);
      mergedMap.set(key, { ...(mergedMap.get(key) || {}), ...m });
    }
    for (const m of serverFixtures) {
      const key = makeFreeMatchDedupeKey(m);
      mergedMap.set(key, { ...(mergedMap.get(key) || {}), ...m });
    }

    const mergedList = Array.from(mergedMap.values());

    if (mergedList.length > 0) {
      liveMatches = mergedList;
      liveConsensus = Object.fromEntries(
        liveMatches.map((match, index) => [
          match.id,
          freeMatchConsensus[match.id] || buildConsensus(match.id, index * 17 + 7, match.homePct || 33, match.drawPct || 34),
        ]),
      ) as Record<string, MatchConsensus>;

      try {
        localStorage.setItem('mshindi_uploaded_fixtures', JSON.stringify(liveMatches));
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
    localStorage.removeItem('mshindi_uploaded_fixtures');
    localStorage.removeItem('mshindi_fixture_batches');
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
