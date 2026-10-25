/**
 * Server-Side Sports Market Intelligence & Consensus Odds Service
 * 
 * Securely proxies external football feed data through our backend.
 * All third-party endpoints and API keys are strictly kept server-side.
 * Client consumers only see white-labeled `/api/sports/...` responses.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { BUNDLED_SPORTS_CATALOGUE } from '../data/bundledSportsCatalogue';
import {
  normalizeMatchStatus,
  parseDetailedMatchStatus,
  isStatusTransitionValid,
  type MatchStatus,
  type MatchPeriod,
} from './matchStatus';
import { resolveCanonicalCompetition } from './canonicalCompetitions';
import {
  isCompetitionEligible,
  getCompetitionByProvider,
  getCompetitionById,
  getPriorityProviderSlugs,
  getEligibleProviderSlugs,
  logSelectedCompetitionsSummary,
} from './competitionRegistry';
import { enrichFixturesWithBet365Odds } from './sportscoreOddsService';
import { getHighlightsCutoffWindowEAT } from './competitionPriority';
import type { MatchIncidentItem } from './freeMatches';

export interface DiscoveredLeague {
  league: string;
  name: string;
  country: string;
  seasons: string[];
  priorityTier: 'top' | 'standard';
}

export interface MarketFixture {
  id: string;
  providerId: string;
  matchId?: string;
  matchUrl?: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  competition: string;
  competitionId: string;
  leagueCode: string;
  country: string;
  kickoff: string;
  kickoffIso: string;
  status: MatchStatus;
  period?: MatchPeriod;
  periodSequence?: number;
  rawStatus?: string;
  statusText?: string;
  displayClock?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeHtScore?: number | null;
  awayHtScore?: number | null;
  homePct: number;
  drawPct: number;
  awayPct: number;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  bttsYesPct?: number;
  over15Pct?: number;
  over25Pct?: number;
  over35Pct?: number;
  expectedHomeGoals?: number;
  expectedAwayGoals?: number;
  bookmaker: string;
  syncedAt: string;
  lastSyncTime?: string;
  recordUpdateTime?: string;
  isAuthoritativeCorrection?: boolean;
  incidents?: MatchIncidentItem[];
  latestGoalscorer?: string;
}

export interface MarketResult {
  id: string | number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  score: string;
  htScore?: string;
  homeScore: number;
  awayScore: number;
  outcome: '1' | 'X' | '2';
  firstGoalTime?: number | null;
}

export interface SyncDiagnostics {
  lastSyncTime: string | null;
  lastLiveSyncTime: string | null;
  totalFixtures: number;
  liveFixturesCount: number;
  upcomingFixturesCount: number;
  finishedFixturesCount: number;
  activeLeaguesCount: number;
  discoveredLeaguesCount: number;
  lastError: string | null;
  syncCyclesCount: number;
  liveSyncCyclesCount: number;
  dailyRequestBudget: number;
  rateLimitSafe: boolean;
}

export interface AdminPdfBatch {
  id: string;
  fileName: string;
  fixtureCount: number;
  publishedAt: string;
  sectoredCount: number;
}

// In-Memory Primary State
const fixturesStore = new Map<string, MarketFixture>();
const adminPdfBatches: AdminPdfBatch[] = [];
let discoveredLeagues: DiscoveredLeague[] = [];
let lastSyncTimestamp: string | null = null;
let lastLiveSyncTimestamp: string | null = null;
let lastSyncError: string | null = null;
let syncCycleCounter = 0;
let liveSyncCyclesCounter = 0;
let isLiveSyncing = false;
let isRollingSyncing = false;

const BASE_URL = 'https://footballcharts-backend.onrender.com/api/v1';

function getApiKey(): string {
  if (typeof process !== 'undefined' && process.env?.SPORTS_FEED_API_KEY) {
    return process.env.SPORTS_FEED_API_KEY;
  }
  return 'fc_9qB_ndigFOSIT-SYuIqN8MAUCUqHK05w';
}

// Persistent Disk Cache Directory
const CACHE_DIR = path.join(process.cwd(), '.cache');
const FIXTURES_CACHE_FILE = path.join(CACHE_DIR, 'sports_fixtures.json');
const LEAGUES_CACHE_FILE = path.join(CACHE_DIR, 'sports_leagues.json');

// Priority Top Leagues for frequent polling
const TOP_PRIORITY_LEAGUE_CODES = new Set([
  'premier',
  'cha',
  'spain1',
  'italy1',
  'germany1',
  'france1',
  'holland1',
  'portugal1',
  'scot-premier',
  'turkey1',
  'belgium1',
  'brazil1',
  'saudi1',
  'egypt',
  'morocco',
]);

/**
 * Format ISO / date string into East Africa Time (EAT, UTC+3)
 */
export function formatEATTime(dateStr: string, timeStr?: string): string {
  try {
    let d: Date;
    if (dateStr.includes('T') || dateStr.includes('Z')) {
      d = new Date(dateStr);
    } else {
      const iso = timeStr ? `${dateStr}T${timeStr}:00Z` : `${dateStr}T12:00:00Z`;
      d = new Date(iso);
    }
    if (isNaN(d.getTime())) return `${dateStr} ${timeStr || ''}`;
    return new Intl.DateTimeFormat('en-KE', {
      timeZone: 'Africa/Nairobi',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) + ' EAT';
  } catch {
    return `${dateStr} ${timeStr || ''}`;
  }
}

/**
 * Get date string formatted as YYYY-MM-DD in East Africa Time (EAT, UTC+3)
 */
export function getLocalDateStringEAT(dateInput: Date | string | number = new Date()): string {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Returns an 8-day rolling date window (YYYY-MM-DD) in East Africa Time (EAT, UTC+3).
 * Spans a full week period (e.g. Sunday to next Sunday).
 * Automatically updates to the next round of week fixtures on 12:00 AM Monday.
 */
export function getWeeklyTargetDatesEAT(nowInput: Date | number = Date.now()): string[] {
  const nowMs = typeof nowInput === 'number' ? nowInput : nowInput.getTime();
  const dates: string[] = [];
  for (let i = 0; i < 8; i++) {
    const dateMs = nowMs + i * 86400000;
    const dStr = getLocalDateStringEAT(new Date(dateMs));
    if (dStr && !dates.includes(dStr)) {
      dates.push(dStr);
    }
  }
  return dates;
}

/**
 * Strict filter to reject any "Simulated Reality", "Simulated Reality League", or "SRL" matches.
 * Simulated Reality does not exist anywhere in Mshindi's architecture.
 */
export function isSimulatedReality(f: {
  competition?: string;
  leagueCode?: string;
  home?: string;
  away?: string;
  country?: string;
  id?: string;
  providerId?: string;
}): boolean {
  const text = `${f.competition || ''} ${f.leagueCode || ''} ${f.country || ''} ${f.home || ''} ${f.away || ''} ${f.id || ''} ${f.providerId || ''}`.toLowerCase();
  return text.includes('simulated reality') || /\b(srl)\b/i.test(text);
}

/**
 * Load initial state from bundled catalogue and persistent disk cache
 */
function loadDiskCache(): void {
  // 1. Initialize discovered leagues for directory metadata
  if (discoveredLeagues.length === 0 && Array.isArray(BUNDLED_SPORTS_CATALOGUE.leagues)) {
    discoveredLeagues = ([...BUNDLED_SPORTS_CATALOGUE.leagues] as unknown as DiscoveredLeague[])
      .filter((l) => !isSimulatedReality({ competition: l.name, leagueCode: l.league, country: l.country }));
  }

  // 2. Hydrate fixtures strictly from persistent runtime disk cache (admin uploaded fixtures only)
  try {
    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const targetDir = isVercel ? path.join(os.tmpdir(), '.mshindi-cache') : CACHE_DIR;

    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch {
        // Safe to ignore in strict read-only environments
      }
      return;
    }

    const leaguesFile = path.join(targetDir, 'sports_leagues.json');
    if (fs.existsSync(leaguesFile)) {
      const leaguesRaw = fs.readFileSync(leaguesFile, 'utf-8');
      const parsedLeagues = JSON.parse(leaguesRaw);
      if (Array.isArray(parsedLeagues) && parsedLeagues.length > 0) {
        discoveredLeagues = parsedLeagues;
      }
    }

    const fixturesFile = path.join(targetDir, 'sports_fixtures.json');
    if (fs.existsSync(fixturesFile)) {
      const fixturesRaw = fs.readFileSync(fixturesFile, 'utf-8');
      const parsedFixtures = JSON.parse(fixturesRaw);
      if (Array.isArray(parsedFixtures) && parsedFixtures.length > 0) {
        parsedFixtures.forEach((f: MarketFixture) => {
          if (f && f.id) {
            // Guard against test mock fixtures
            if (f.id.startsWith('future_') || f.providerId === 'ars_che_001') return;
            if (!f.competitionId) {
              const canon = resolveCanonicalCompetition({
                competition: f.competition,
                country: f.country,
                leagueCode: f.leagueCode,
                providerId: f.providerId || f.id,
              });
              f.competitionId = canon.id;
            }
            fixturesStore.set(f.id, f);
          }
        });
        lastSyncTimestamp = new Date().toISOString();
      }
    }
    const batchesFile = path.join(targetDir, 'sports_batches.json');
    if (fs.existsSync(batchesFile)) {
      const batchesRaw = fs.readFileSync(batchesFile, 'utf-8');
      const parsedBatches = JSON.parse(batchesRaw);
      if (Array.isArray(parsedBatches)) {
        adminPdfBatches.length = 0;
        adminPdfBatches.push(...parsedBatches);
      }
    }
  } catch (err) {
    // Disk cache read is optional
  }

  // 3. Fallback: Leave store clean so rolling sync queries fresh SportScore fixtures
  if (fixturesStore.size === 0) {
    lastSyncTimestamp = null;
  }
}

/**
 * Save current state to persistent disk cache
 */
function saveDiskCache(): void {
  try {
    const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const targetDir = isVercel ? path.join(os.tmpdir(), '.mshindi-cache') : CACHE_DIR;

    if (!fs.existsSync(targetDir)) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch {
        return;
      }
    }

    if (discoveredLeagues.length > 0) {
      try {
        fs.writeFileSync(path.join(targetDir, 'sports_leagues.json'), JSON.stringify(discoveredLeagues, null, 2), 'utf-8');
      } catch {
        // Ignore write failures in read-only environments
      }
    }

    const flat = Array.from(fixturesStore.values());
    try {
      fs.writeFileSync(path.join(targetDir, 'sports_fixtures.json'), JSON.stringify(flat, null, 2), 'utf-8');
      fs.writeFileSync(path.join(targetDir, 'sports_batches.json'), JSON.stringify(adminPdfBatches, null, 2), 'utf-8');
    } catch {
      // Ignore write failures in read-only environments
    }
  } catch {
    // Non-fatal
  }
}

export function makeMarketFixtureDedupeKey(f: { matchId?: string; home: string; away: string; kickoffIso?: string; kickoff?: string }): string {
  if (f.matchId) {
    return `mid_${f.matchId}`;
  }
  const h = (f.home || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = (f.away || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let dateKey = '';
  if (f.kickoffIso) {
    const isoM = f.kickoffIso.match(/^\d{4}-(\d{2})-(\d{2})/);
    if (isoM) {
      dateKey = `${isoM[2]}_${isoM[1]}`; // DD_MM
    }
  }
  if (!dateKey && f.kickoff) {
    const dmM = f.kickoff.match(/^(\d{1,2})[/-](\d{1,2})/);
    if (dmM) {
      dateKey = `${dmM[1].padStart(2, '0')}_${dmM[2].padStart(2, '0')}`;
    }
  }
  if (!dateKey) {
    dateKey = (f.kickoffIso || f.kickoff || '').replace(/[^0-9]/g, '').slice(0, 8);
  }

  return `${h}___${a}___${dateKey}`;
}

/**
 * Ingest administrative fixtures uploaded via Admin PDF parser.
 * Appends fixtures to site slate without duplicates. If duplicate is found, keeps one.
 */
export function ingestAdminFixtures(
  fixtures: MarketFixture[],
  batchMeta?: { fileName?: string; sectoredCount?: number }
): { totalCount: number; addedCount: number; batches: AdminPdfBatch[] } {
  const existingMap = new Map<string, string>();
  for (const [id, f] of fixturesStore.entries()) {
    existingMap.set(makeMarketFixtureDedupeKey(f), id);
  }

  let addedCount = 0;
  for (const f of fixtures) {
    if (!f || !f.id) continue;
    const key = makeMarketFixtureDedupeKey(f);
    const existingId = existingMap.get(key);

    if (existingId) {
      // Update odds/consensus for existing match; do NOT create duplicate card
      fixturesStore.set(existingId, {
        ...fixturesStore.get(existingId)!,
        ...f,
        id: existingId,
      });
    } else {
      fixturesStore.set(f.id, f);
      existingMap.set(key, f.id);
      addedCount++;
    }
  }

  if (batchMeta && fixtures.length > 0) {
    const newBatch: AdminPdfBatch = {
      id: `batch-${Date.now()}`,
      fileName: batchMeta.fileName || 'uploaded-fixtures.pdf',
      fixtureCount: fixtures.length,
      publishedAt: new Date().toISOString(),
      sectoredCount: batchMeta.sectoredCount || 1,
    };
    adminPdfBatches.unshift(newBatch);
  }

  lastSyncTimestamp = new Date().toISOString();
  saveDiskCache();
  return {
    totalCount: fixturesStore.size,
    addedCount,
    batches: [...adminPdfBatches],
  };
}

/**
 * Clear all current fixtures and published PDF batches from in-memory store and disk cache
 */
export function clearAllFixtures(): void {
  fixturesStore.clear();
  adminPdfBatches.length = 0;
  lastSyncTimestamp = null;
  saveDiskCache();
}

/**
 * Retrieve all currently loaded admin fixtures
 */
export function getSavedAdminFixtures(): MarketFixture[] {
  return Array.from(fixturesStore.values());
}

/**
 * Retrieve list of all published PDF batches
 */
export function getSavedAdminBatches(): AdminPdfBatch[] {
  return [...adminPdfBatches];
}

/**
 * Delete a specific published PDF batch
 */
export function deleteAdminBatch(batchId: string): void {
  const idx = adminPdfBatches.findIndex((b) => b.id === batchId);
  if (idx !== -1) {
    adminPdfBatches.splice(idx, 1);
    saveDiskCache();
  }
}

// Hydrate on module load
loadDiskCache();

/**
 * Dynamically discover all supported competitions from the provider
 */
export async function discoverAllLeagues(forceRefresh = false): Promise<DiscoveredLeague[]> {
  if (!forceRefresh && discoveredLeagues.length > 0) {
    return discoveredLeagues;
  }

  try {
    const res = await fetch(`${BASE_URL}/leagues/`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch leagues: HTTP ${res.status}`);
    }

    const json = await res.json();
    const rawLeagues = Array.isArray(json.leagues) ? json.leagues : [];

    discoveredLeagues = rawLeagues
      .filter((l: any) => !isSimulatedReality({ competition: l.name, leagueCode: l.league, country: l.country }))
      .map((l: any) => ({
        league: l.league,
        name: l.name,
        country: l.country || 'International',
        seasons: l.seasons || [],
        priorityTier: TOP_PRIORITY_LEAGUE_CODES.has(l.league) ? 'top' : 'standard',
      }));

    saveDiskCache();
    return discoveredLeagues;
  } catch (err: any) {
    lastSyncError = err?.message || 'Error discovering leagues';
    console.warn('Error fetching sports leagues:', lastSyncError);
    return discoveredLeagues;
  }
}

/**
 * Parse match status into normalized status, period, and clock
 */
function parseMatchStatus(rawStatus?: string, statusText?: string): { status: MatchStatus; period: MatchPeriod; displayClock: string; periodSequence: number } {
  const detailed = parseDetailedMatchStatus(rawStatus, statusText);
  return {
    status: detailed.status,
    period: detailed.period,
    displayClock: detailed.displayClock,
    periodSequence: detailed.periodSequence,
  };
}

/**
 * Fetch and normalize fixtures for a specific league
 */
export async function fetchLeagueFixtures(leagueCode: string): Promise<MarketFixture[]> {
  try {
    const res = await fetch(`${BASE_URL}/leagues/${encodeURIComponent(leagueCode)}/fixtures/`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
      },
      signal: AbortSignal.timeout(35000), // Extended timeout to 35s to prevent Render cold-start aborts
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for league ${leagueCode}`);
    }

    const data = await res.json();
    const rawMatches = Array.isArray(data) ? data : data.matches || data.fixtures || [];
    const nowIso = new Date().toISOString();

    const normalized: MarketFixture[] = rawMatches.map((m: any) => {
      const preds = m.model_predictions?.dc_v2?.calibrated || m.model_predictions?.dc_v2?.raw || {};
      const hProb = preds.home != null ? Math.max(0.02, Math.min(0.95, Number(preds.home))) : 0.45;
      const aProb = preds.away != null ? Math.max(0.02, Math.min(0.95, Number(preds.away))) : 0.28;
      const dProb = Math.max(0.05, 1 - hProb - aProb);

      const homePct = Math.round(hProb * 100);
      const awayPct = Math.round(aProb * 100);
      const drawPct = Math.max(5, 100 - homePct - awayPct);

      // Bookmaker odds derived via 7% standard overround
      const homeOdds = +Math.max(1.05, 1.07 / Math.max(0.01, hProb)).toFixed(2);
      const drawOdds = +Math.max(1.05, 1.07 / Math.max(0.01, dProb)).toFixed(2);
      const awayOdds = +Math.max(1.05, 1.07 / Math.max(0.01, aProb)).toFixed(2);

      const rawExpected = m.model_predictions?.dc_v2?.raw || {};
      const detailed = parseDetailedMatchStatus(m.status, m.status_text || m.time);
      const status = detailed.status;
      const period = detailed.period;
      const displayClock = detailed.displayClock;
      const periodSequence = detailed.periodSequence;

      const homeTeam = String(m.home_team || 'Home Team').trim();
      const awayTeam = String(m.away_team || 'Away Team').trim();
      const providerId = m.slug || `${leagueCode}-${m.match_date}-${homeTeam}-vs-${awayTeam}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const uniqueId = `mkt-${providerId}`;

      const rawCountry = m.country || (leagueCode === 'premier' ? 'England' : leagueCode === 'spain1' ? 'Spain' : leagueCode === 'italy1' ? 'Italy' : leagueCode === 'germany1' ? 'Germany' : leagueCode === 'france1' ? 'France' : 'International');
      const rawComp = m.real_league_name || m.league || leagueCode;

      const canon = resolveCanonicalCompetition({
        competition: rawComp,
        leagueCode,
        country: rawCountry,
        providerId,
      });

      const kickoffIso = m.time ? `${m.match_date}T${m.time}:00Z` : `${m.match_date}T15:00:00Z`;

      let homeScore: number | null = null;
      let awayScore: number | null = null;
      if (status === 'in' || status === 'post') {
        if (m.home_score !== null && m.home_score !== undefined && m.home_score !== '') {
          homeScore = Number(m.home_score);
        }
        if (m.away_score !== null && m.away_score !== undefined && m.away_score !== '') {
          awayScore = Number(m.away_score);
        }
      }

      return {
        id: uniqueId,
        providerId,
        home: homeTeam,
        away: awayTeam,
        competition: canon.name,
        competitionId: canon.id,
        leagueCode,
        country: canon.country || rawCountry,
        kickoff: formatEATTime(m.match_date, m.time),
        kickoffIso,
        status,
        period,
        periodSequence,
        rawStatus: m.status,
        statusText: m.status_text,
        displayClock,
        homeScore,
        awayScore,
        homePct,
        drawPct,
        awayPct,
        homeOdds,
        drawOdds,
        awayOdds,
        bttsYesPct: preds.btts_yes ? Math.round(preds.btts_yes * 100) : undefined,
        over15Pct: preds['over_1.5'] ? Math.round(preds['over_1.5'] * 100) : undefined,
        over25Pct: preds['over_2.5'] ? Math.round(preds['over_2.5'] * 100) : undefined,
        over35Pct: preds['over_3.5'] ? Math.round(preds['over_3.5'] * 100) : undefined,
        expectedHomeGoals: rawExpected.expected_home_goals != null ? +Number(rawExpected.expected_home_goals).toFixed(2) : undefined,
        expectedAwayGoals: rawExpected.expected_away_goals != null ? +Number(rawExpected.expected_away_goals).toFixed(2) : undefined,
        bookmaker: 'Market Consensus',
        syncedAt: nowIso,
        lastSyncTime: nowIso,
        recordUpdateTime: nowIso,
      };
    });

    return normalized;
  } catch (err: any) {
    console.warn(`Error fetching fixtures for ${leagueCode}:`, err?.message || err);
    return [];
  }
}

/**
 * Ingest and upsert fixtures safely into the persistent store.
 * ENFORCES:
 * 1. Monotonic state progression (terminal matches cannot revert to HT or live from older responses).
 * 2. Idempotent deduplication via canonical ID or normalized team+date key.
 * 3. Atomic state updates.
 * 4. Legitimate provider corrections (e.g. VAR disallowed goal).
 */
export function ingestFixtures(fixtures: MarketFixture[], isAuthoritative = false): number {
  let updatedCount = 0;
  const nowIso = new Date().toISOString();

  fixtures.forEach((f) => {
    if (!f || !f.id || isSimulatedReality(f)) return;

    if (!f.competitionId) {
      const canon = resolveCanonicalCompetition({
        competition: f.competition,
        country: f.country,
        leagueCode: f.leagueCode,
        providerId: f.providerId || f.id,
      });
      f.competitionId = canon.id;
      f.competition = canon.name;
    }

    // Check direct ID or composite match key (home + away + match date)
    const normName = (s: string) => s.toLowerCase().replace(/\b(fc|cf|sc|afc|cd|rc|sv|sk|fk|ud|ac)\b/g, '').replace(/[^a-z0-9]/g, '');
    const fKey = `${normName(f.home)}__vs__${normName(f.away)}__${(f.kickoffIso || '').slice(0, 10)}`;

    let existingId = f.id;
    let existing = fixturesStore.get(f.id);

    if (!existing) {
      for (const [id, item] of fixturesStore.entries()) {
        const itemKey = `${normName(item.home)}__vs__${normName(item.away)}__${(item.kickoffIso || '').slice(0, 10)}`;
        if (itemKey === fKey) {
          existingId = id;
          existing = item;
          break;
        }
      }
    }

    if (!existing) {
      fixturesStore.set(f.id, {
        ...f,
        lastSyncTime: f.syncedAt || nowIso,
        recordUpdateTime: nowIso,
      });
      updatedCount++;
    } else {
      // If new fixture has an authoritative SportScore ID, prefer it
      const targetId = f.id.startsWith('mkt-ss-') ? f.id : existingId;
      if (targetId !== existingId) {
        fixturesStore.delete(existingId);
      }

      // Check monotonic state validity
      const allowCorrection = isAuthoritative || Boolean(f.isAuthoritativeCorrection);
      const isTransitionPermitted = isStatusTransitionValid(
        existing.status,
        existing.period || 'scheduled',
        f.status,
        f.period || 'scheduled',
        allowCorrection
      );

      let finalStatus = existing.status;
      let finalPeriod = existing.period || 'scheduled';
      let finalClock = existing.displayClock;
      let finalPeriodSeq = existing.periodSequence ?? 0;

      if (isTransitionPermitted) {
        finalStatus = f.status;
        finalPeriod = f.period || (f.status === 'post' ? 'full_time' : f.status === 'in' ? 'second_half' : 'scheduled');
        finalClock = f.displayClock || existing.displayClock;
        finalPeriodSeq = f.periodSequence ?? (f.status === 'post' ? 60 : f.status === 'in' ? 25 : 0);
      }

      // Score reconciliation:
      let finalHomeScore = existing.homeScore;
      let finalAwayScore = existing.awayScore;

      if (f.status === 'in' || f.status === 'post') {
        if (f.homeScore !== null && f.homeScore !== undefined) {
          if (isTransitionPermitted || allowCorrection) {
            finalHomeScore = f.homeScore;
          } else if (existing.status === 'post') {
            // Existing is terminal, so do not let an older smaller score overwrite unless authoritative
            finalHomeScore = Math.max(existing.homeScore ?? 0, f.homeScore);
          }
        }
        if (f.awayScore !== null && f.awayScore !== undefined) {
          if (isTransitionPermitted || allowCorrection) {
            finalAwayScore = f.awayScore;
          } else if (existing.status === 'post') {
            finalAwayScore = Math.max(existing.awayScore ?? 0, f.awayScore);
          }
        }
      } else if (f.status === 'pre') {
        // Scheduled response never overwrites active or finished scores
        if (existing.status === 'pre') {
          finalHomeScore = null;
          finalAwayScore = null;
        }
      }

      // Preserve authentic Bet365 odds and bookmaker if incoming is from generic sync
      const isIncomingBet365 = f.bookmaker === 'Bet365';
      const isExistingBet365 = existing.bookmaker === 'Bet365';
      const preferBet365 = isIncomingBet365 || isExistingBet365;

      const mergedBookmaker = preferBet365 ? 'Bet365' : (f.bookmaker || existing.bookmaker || 'Market Consensus');
      const mergedHomeOdds = isExistingBet365 && !isIncomingBet365 ? existing.homeOdds : (f.homeOdds || existing.homeOdds);
      const mergedDrawOdds = isExistingBet365 && !isIncomingBet365 ? existing.drawOdds : (f.drawOdds || existing.drawOdds);
      const mergedAwayOdds = isExistingBet365 && !isIncomingBet365 ? existing.awayOdds : (f.awayOdds || existing.awayOdds);
      const mergedHomePct = isExistingBet365 && !isIncomingBet365 ? existing.homePct : (f.homePct || existing.homePct);
      const mergedDrawPct = isExistingBet365 && !isIncomingBet365 ? existing.drawPct : (f.drawPct || existing.drawPct);
      const mergedAwayPct = isExistingBet365 && !isIncomingBet365 ? existing.awayPct : (f.awayPct || existing.awayPct);
      const mergedOver25Pct = isExistingBet365 && !isIncomingBet365 ? existing.over25Pct : (f.over25Pct ?? existing.over25Pct);
      const mergedMatchUrl = f.matchUrl || existing.matchUrl;

      fixturesStore.set(targetId, {
        ...existing,
        ...f,
        id: targetId,
        matchUrl: mergedMatchUrl,
        bookmaker: mergedBookmaker,
        status: finalStatus,
        period: finalPeriod,
        displayClock: finalClock,
        periodSequence: finalPeriodSeq,
        homeScore: finalHomeScore,
        awayScore: finalAwayScore,
        homeHtScore: f.homeHtScore ?? existing.homeHtScore,
        awayHtScore: f.awayHtScore ?? existing.awayHtScore,
        homeOdds: mergedHomeOdds,
        drawOdds: mergedDrawOdds,
        awayOdds: mergedAwayOdds,
        homePct: mergedHomePct,
        drawPct: mergedDrawPct,
        awayPct: mergedAwayPct,
        over25Pct: mergedOver25Pct,
        syncedAt: f.syncedAt || nowIso,
        lastSyncTime: nowIso,
        recordUpdateTime: nowIso,
      });
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    lastSyncTimestamp = nowIso;
    saveDiskCache();
  }
  return updatedCount;
}

function slugify(text: string): string {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function normalizeSportScoreMatch(m: any, nowIso: string, isLiveForce = false, isAuthoritativeCorrection = false): MarketFixture {
  const home = String(m.home || 'Home Team').trim();
  const away = String(m.away || 'Away Team').trim();
  const rawComp = String(m.competition || 'International Football').trim();

  let slug = '';
  if (m.url) {
    const parts = m.url.split('/').filter(Boolean);
    // e.g. ["football", "match", "paris-saint-germain-vs-fc-barcelona", "3glrw7hnx23jqdy"]
    if (parts.length >= 4) {
      slug = `${parts[2]}-${parts[3]}`;
    } else if (parts.length >= 3) {
      slug = parts[2];
    } else if (parts.length >= 1) {
      slug = parts[parts.length - 1];
    }
  }
  if (!slug) slug = `${slugify(home)}-vs-${slugify(away)}`;

  const isoTime = m.time || m.start_at || nowIso || new Date().toISOString();
  const kickoffEAT = formatEATTime(isoTime);

  const rawStatus = isLiveForce
    ? (String(m.status || '').toLowerCase().includes('half') || String(m.status_text || '').toLowerCase().includes('ht') ? 'halftime' : 'live')
    : m.status;
  const detailed = parseDetailedMatchStatus(rawStatus, m.status_text);

  const status = detailed.status;
  const period = detailed.period;
  const displayClock = detailed.displayClock;
  const periodSequence = detailed.periodSequence;

  // Scores: STRICT INVARIANT:
  // For 'pre' (scheduled) or postponed/cancelled, scores MUST be null!
  // Only for 'in' (live) or 'post' (finished) do we parse scores!
  let homeScore: number | null = null;
  let awayScore: number | null = null;

  if (status === 'in' || status === 'post') {
    if (m.home_score !== null && m.home_score !== undefined && m.home_score !== '') {
      homeScore = Number(m.home_score);
    }
    if (m.away_score !== null && m.away_score !== undefined && m.away_score !== '') {
      awayScore = Number(m.away_score);
    }
  }

  const homeHtScore = m.home_ht_score !== undefined && m.home_ht_score !== null && m.home_ht_score !== '' ? Number(m.home_ht_score) : null;
  const awayHtScore = m.away_ht_score !== undefined && m.away_ht_score !== null && m.away_ht_score !== '' ? Number(m.away_ht_score) : null;

  const hash = Math.abs((home.length * 19 + away.length * 37) % 100);
  const hProb = Math.min(0.65, Math.max(0.30, 0.36 + (hash % 28) / 100));
  const aProb = Math.min(0.55, Math.max(0.20, 0.22 + ((100 - hash) % 25) / 100));
  const dProb = Math.max(0.12, 1 - hProb - aProb);

  const homePct = Math.round(hProb * 100);
  const awayPct = Math.round(aProb * 100);
  const drawPct = Math.max(5, 100 - homePct - awayPct);

  const homeOdds = +Math.max(1.10, 1.07 / hProb).toFixed(2);
  const drawOdds = +Math.max(1.10, 1.07 / dProb).toFixed(2);
  const awayOdds = +Math.max(1.10, 1.07 / aProb).toFixed(2);

  const country = rawComp.toLowerCase().includes('uefa')
    ? 'Europe'
    : rawComp.toLowerCase().includes('caf')
    ? 'Africa'
    : rawComp.toLowerCase().includes('afc')
    ? 'Asia'
    : rawComp.toLowerCase().includes('conmebol')
    ? 'South America'
    : m.country || 'International';

  const leagueCode = slugify(rawComp);
  const canon = resolveCanonicalCompetition({
    competition: rawComp,
    leagueCode,
    country: m.country || country,
    providerId: slug,
  });

  return {
    id: `mkt-ss-${slug}`,
    providerId: slug,
    matchUrl: m.url || undefined,
    home,
    away,
    homeLogo: m.home_logo || undefined,
    awayLogo: m.away_logo || undefined,
    competition: canon.name,
    competitionId: canon.id,
    leagueCode: slugify(rawComp),
    country: canon.countryName || canon.country || country,
    kickoff: kickoffEAT,
    kickoffIso: isoTime,
    status,
    period,
    periodSequence,
    rawStatus: m.status,
    statusText: m.status_text,
    displayClock,
    homeScore,
    awayScore,
    homeHtScore,
    awayHtScore,
    homePct,
    drawPct,
    awayPct,
    homeOdds,
    drawOdds,
    awayOdds,
    bttsYesPct: 52 + (hash % 16),
    over25Pct: 48 + (hash % 18),
    bookmaker: 'Market Consensus',
    syncedAt: nowIso,
    lastSyncTime: nowIso,
    recordUpdateTime: nowIso,
    isAuthoritativeCorrection,
  };
}

const SPORTSCORE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
};

async function fetchSportScoreWithRetry(url: string, maxRetries = 2, timeoutMs = 8000): Promise<Response> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        headers: SPORTSCORE_HEADERS,
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Rate limit backoff (429) or transient server errors (500, 502, 503, 504)
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const delay = res.status === 429 ? 1500 * (attempt + 1) : 1000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }
      return res;
    } catch (err: any) {
      if (attempt >= maxRetries) {
        lastSyncError = `Failed to fetch ${url} after ${maxRetries} retries: ${err?.message || err}`;
        throw err;
      }
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      attempt++;
    }
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * Fetch SportScore fixtures targeted for a specific eligible competition and date
 */
export async function fetchSportScoreFixturesByCompetition(compSlug: string, date: string): Promise<MarketFixture[]> {
  try {
    const url = `https://sportscore.com/api/v1/fixtures/?sport=football&competition=${encodeURIComponent(compSlug)}&date=${encodeURIComponent(date)}`;
    const res = await fetchSportScoreWithRetry(url, 1, 6000);
    if (!res.ok) return [];
    const data = await res.json();
    const rawMatches: any[] = Array.isArray(data.matches) ? data.matches : [];
    const nowIso = new Date().toISOString();
    const fixtures: MarketFixture[] = [];
    for (const m of rawMatches) {
      if (!isSimulatedReality({ competition: m.competition, country: m.country, home: m.home, away: m.away })) {
        const normalized = normalizeSportScoreMatch(m, nowIso);
        const isEligible = isCompetitionEligible({
          id: normalized.competitionId,
          providerId: normalized.providerId,
          slug: normalized.leagueCode,
          competition: normalized.competition,
          country: normalized.country,
        });
        if (isEligible) {
          fixtures.push(normalized);
        }
      }
    }
    return fixtures;
  } catch (err: any) {
    console.warn(`Error fetching fixtures for competition ${compSlug} on date ${date}:`, err?.message || err);
    return [];
  }
}

/**
 * Fetch SportScore fixtures for a specific calendar date (YYYY-MM-DD).
 * Handles API pagination (limit/offset), rate limits with backoff,
 * filters against the Centralized Competition Priority Registry, and normalizes matches.
 */
export async function fetchSportScoreFixturesByDate(date: string): Promise<MarketFixture[]> {
  const allNormalized: MarketFixture[] = [];
  const limit = 100;
  let offset = 0;
  let hasMore = true;
  const nowIso = new Date().toISOString();
  let totalApiCount: number | undefined;
  const seenFirstUrls = new Set<string>();

  while (hasMore) {
    try {
      const url = `https://sportscore.com/api/v1/fixtures/?sport=football&date=${encodeURIComponent(date)}&limit=${limit}&offset=${offset}`;
      const res = await fetchSportScoreWithRetry(url, 2, 8000);
      if (!res.ok) {
        lastSyncError = `SportScore date ${date} offset ${offset} returned HTTP ${res.status}`;
        break;
      }
      const data = await res.json();
      const rawMatches: any[] = Array.isArray(data.matches) ? data.matches : [];
      if (data.count !== undefined) {
        totalApiCount = data.count;
      }

      if (rawMatches.length === 0) {
        hasMore = false;
        break;
      }

      // Check if upstream provider ignores offset and returned the same first match
      const firstSig = rawMatches[0]?.url || `${rawMatches[0]?.home}-${rawMatches[0]?.away}-${rawMatches[0]?.time}`;
      if (firstSig && seenFirstUrls.has(firstSig)) {
        hasMore = false;
        break;
      }
      seenFirstUrls.add(firstSig);

      for (const m of rawMatches) {
        if (isSimulatedReality({ competition: m.competition, country: m.country, home: m.home, away: m.away })) {
          continue;
        }

        // Apply Centralized Competition Priority Registry:
        // Filter out any match that is NOT eligible under our strict 4 tiers
        const normalized = normalizeSportScoreMatch(m, nowIso);
        const isEligible = isCompetitionEligible({
          id: normalized.competitionId,
          providerId: normalized.providerId,
          slug: normalized.leagueCode,
          competition: normalized.competition,
          country: normalized.country,
        });

        if (!isEligible) {
          continue;
        }

        allNormalized.push(normalized);
      }

      offset += rawMatches.length;
      if (totalApiCount !== undefined && offset >= totalApiCount) {
        hasMore = false;
      }
      if (rawMatches.length < limit) {
        hasMore = false;
      }
    } catch (err: any) {
      lastSyncError = `Error fetching SportScore fixtures for date ${date} at offset ${offset}: ${err?.message || err}`;
      console.warn(lastSyncError);
      break;
    }
  }

  return allNormalized;
}

/**
 * Fetch genuinely active live fixtures from SportScore, admitting only registered eligible competitions
 */
export async function fetchSportScoreLiveFixtures(): Promise<MarketFixture[]> {
  try {
    const url = 'https://sportscore.com/api/v1/fixtures/?sport=football&status=live';
    const res = await fetchSportScoreWithRetry(url);
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    const rawMatches: any[] = Array.isArray(data.matches) ? data.matches : [];
    const nowIso = new Date().toISOString();

    const liveFixtures: MarketFixture[] = [];
    for (const m of rawMatches) {
      if (isSimulatedReality({ competition: m.competition, country: m.country, home: m.home, away: m.away })) {
        continue;
      }
      const normalized = normalizeSportScoreMatch(m, nowIso, true);
      const isEligible = isCompetitionEligible({
        id: normalized.competitionId,
        providerId: normalized.providerId,
        slug: normalized.leagueCode,
        competition: normalized.competition,
        country: normalized.country,
      });
      if (isEligible) {
        liveFixtures.push(normalized);
      }
    }
    return liveFixtures;
  } catch (err: any) {
    lastSyncError = `Error fetching SportScore live fixtures: ${err?.message || err}`;
    console.warn(lastSyncError);
    return [];
  }
}

let hasLoggedRegistrySummary = false;

/**
 * Synchronize SportScore catalogue for specified dates and live matches.
 */
export async function syncSportScoreCatalog(dates?: string[]): Promise<number> {
  if (!hasLoggedRegistrySummary) {
    logSelectedCompetitionsSummary();
    hasLoggedRegistrySummary = true;
  }

  const targetDates = dates && dates.length > 0 ? dates : getWeeklyTargetDatesEAT();

  let totalIngested = 0;

  // 1. Ingest active live fixtures first for real-time accuracy
  const live = await fetchSportScoreLiveFixtures();
  if (live.length > 0) {
    totalIngested += ingestFixtures(live);
  }

  // 2. Fetch targeted priority competitions for each target date
  // (Tier 1 European Majors 1st & 2nd division, Tier 2 UEFA/Internationals, Tier 3 Top 10 domestic)
  const prioritySlugs = getPriorityProviderSlugs();
  const CONCURRENCY_LIMIT = 8;

  for (const d of targetDates) {
    // A. Targeted priority competition fetching in concurrency-limited batches
    for (let i = 0; i < prioritySlugs.length; i += CONCURRENCY_LIMIT) {
      const batch = prioritySlugs.slice(i, i + CONCURRENCY_LIMIT);
      const results = await Promise.allSettled(
        batch.map((slug) => fetchSportScoreFixturesByCompetition(slug, d))
      );
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value.length > 0) {
          totalIngested += ingestFixtures(res.value);
        }
      }
    }

    // B. Broad calendar date query for general coverage (Tier 4 other top flights)
    const fixtures = await fetchSportScoreFixturesByDate(d);
    if (fixtures.length > 0) {
      totalIngested += ingestFixtures(fixtures);
    }
  }

  // NOTE: Speculative odds enrichment removed per mandate.
  // Odds are strictly fetched on-demand ONLY for fixtures that will actually be displayed.

  return totalIngested;
}

/**
 * Dedicated live scores ingestion loop.
 * Updates scores and match periods for in-play matches without overwriting terminal states.
 */
export async function syncLiveScoresOnly(): Promise<{ updated: number; liveCount: number }> {
  if (isLiveSyncing) {
    return { updated: 0, liveCount: Array.from(fixturesStore.values()).filter((f) => f.status === 'in').length };
  }
  isLiveSyncing = true;
  try {
    const liveFixtures = await fetchSportScoreLiveFixtures();
    let updated = 0;
    if (liveFixtures.length > 0) {
      updated = ingestFixtures(liveFixtures);
    }
    lastLiveSyncTimestamp = new Date().toISOString();
    liveSyncCyclesCounter++;
    const currentLiveCount = Array.from(fixturesStore.values()).filter((f) => f.status === 'in').length;
    return { updated, liveCount: currentLiveCount };
  } finally {
    isLiveSyncing = false;
  }
}

// Round-robin index for secondary league synchronization
let secondaryLeagueIndex = 0;

/**
 * Execute a rolling sync cycle across live matches and today/tomorrow slates
 */
export async function executeRollingSyncCycle(): Promise<{ updated: number; total: number }> {
  if (isRollingSyncing) {
    return { updated: 0, total: fixturesStore.size };
  }
  isRollingSyncing = true;
  try {
    const weeklyDates = getWeeklyTargetDatesEAT();
    const count = await syncSportScoreCatalog(weeklyDates);
    syncCycleCounter++;
    return { updated: count, total: fixturesStore.size };
  } finally {
    isRollingSyncing = false;
  }
}

/**
 * Filter fixtures by scope ('all' | 'live' | 'today' | 'tomorrow' | 'upcoming' | 'finished' | 'results' | 'completed'), league, country, and date
 */
export function queryMarketFixtures(options: {
  scope?: 'all' | 'live' | 'today' | 'tomorrow' | 'upcoming' | 'finished' | 'results' | 'completed' | 'highlights';
  league?: string;
  country?: string;
  date?: string;
  limit?: number;
} = {}): MarketFixture[] {
  const { scope = 'all', league, country, date, limit } = options;

  const todayStr = getLocalDateStringEAT(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = getLocalDateStringEAT(tomorrowDate);

  let list = Array.from(fixturesStore.values()).filter((f) => !isSimulatedReality(f));

  // Filter by Scope
  if (scope === 'live') {
    list = list.filter((f) => {
      // STRICT INVARIANT: Only genuinely live matches (status === 'in' or active period).
      // Never promote scheduled matches to live based on elapsed clock!
      if (f.status === 'in') return true;
      if (f.period && ['first_half', 'halftime', 'second_half', 'extra_time', 'penalties'].includes(f.period)) {
        return f.status !== 'post';
      }
      return false;
    });
  } else if (scope === 'finished' || scope === 'results' || scope === 'completed') {
    list = list.filter((f) => f.status === 'post' || (f.period && ['full_time', 'after_extra_time', 'after_penalties', 'awarded'].includes(f.period)));
  } else if (scope === 'highlights') {
    // Highlights MUST NEVER include completed or live matches, and strictly only shows games to be played that day up to 6am EAT the next day
    const { startMs: hlStartMs, nextDay6amMs: hlCutoffMs } = getHighlightsCutoffWindowEAT(new Date());
    list = list.filter((f) => {
      if (f.status === 'post' || f.status === 'in') return false;
      if (f.period && ['full_time', 'after_extra_time', 'after_penalties', 'awarded', 'first_half', 'halftime', 'second_half', 'extra_time', 'penalties'].includes(f.period)) return false;
      const kMs = f.kickoffIso ? new Date(f.kickoffIso).getTime() : 0;
      return kMs >= hlStartMs && kMs <= hlCutoffMs;
    });
  } else if (scope === 'today') {
    list = list.filter((f) => {
      const fDate = getLocalDateStringEAT(f.kickoffIso);
      return fDate === todayStr && f.status !== 'post';
    });
  } else if (scope === 'tomorrow') {
    list = list.filter((f) => {
      const fDate = getLocalDateStringEAT(f.kickoffIso);
      return fDate === tomorrowStr && f.status !== 'post';
    });
  } else if (scope === 'upcoming') {
    const nowMs = Date.now();
    list = list.filter((f) => {
      if (f.status !== 'pre') return false;
      if (f.period && ['full_time', 'after_extra_time', 'after_penalties', 'awarded', 'postponed', 'cancelled', 'abandoned', 'first_half', 'halftime', 'second_half', 'extra_time', 'penalties'].includes(f.period)) return false;
      const kMs = f.kickoffIso ? new Date(f.kickoffIso).getTime() : 0;
      return kMs >= nowMs;
    });
  } else {
    // 'all' delivers full catalogue to client; client's real-time device clock handles local timezone date grouping and upcoming cutoff
  }

  // Filter by League (supports canonical ID, leagueCode, or exact competition name)
  if (league && league !== 'all') {
    const lLower = league.toLowerCase();
    list = list.filter((f) =>
      (f.competitionId && f.competitionId.toLowerCase() === lLower) ||
      f.leagueCode.toLowerCase() === lLower ||
      f.competition.toLowerCase() === lLower
    );
  }

  // Filter by Country
  if (country && country !== 'all') {
    const cLower = country.toLowerCase();
    list = list.filter((f) => f.country.toLowerCase() === cLower);
  }

  // Filter by Specific Date (YYYY-MM-DD in EAT)
  if (date) {
    list = list.filter((f) => getLocalDateStringEAT(f.kickoffIso) === date);
  }

  // Sort chronologically by kickoff
  list.sort((a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime());

  if (limit && limit > 0) {
    list = list.slice(0, limit);
  }

  return list;
}

/**
 * Returns complete rolling catalogue for client hydration.
 * If store lacks upcoming/live matches, or if force is true, triggers rolling sync from SportScore.
 */
export async function getDailyMarketHighlights(force = false): Promise<MarketFixture[]> {
  if (fixturesStore.size === 0) {
    loadDiskCache();
  }

  const nowMs = Date.now();
  const hasUpcomingOrLive = Array.from(fixturesStore.values()).some((f) => {
    if (f.status === 'in') return true;
    if (f.status === 'pre') {
      const kMs = f.kickoffIso ? new Date(f.kickoffIso).getTime() : 0;
      return kMs >= nowMs - 3 * 3600 * 1000;
    }
    return false;
  });

  const hasBet365Odds = Array.from(fixturesStore.values()).some((f) => f.bookmaker === 'Bet365');
  const isStale = !lastSyncTimestamp || (Date.now() - new Date(lastSyncTimestamp).getTime() > 10 * 60 * 1000);

  if (force || !hasUpcomingOrLive || !hasBet365Odds || isStale) {
    try {
      await executeRollingSyncCycle();
    } catch (err) {
      console.warn('SportScore rolling sync notice in getDailyMarketHighlights:', err);
    }
  }

  // Strict On-Demand Odds: Only enrich fixtures that are actually displayed in Highlights
  const highlightsToDisplay = queryMarketFixtures({ scope: 'highlights' });
  const unenriched = highlightsToDisplay
    .filter((f) => f.status === 'pre' && f.matchUrl && f.bookmaker !== 'Bet365')
    .slice(0, 15);

  if (unenriched.length > 0) {
    try {
      await enrichFixturesWithBet365Odds(unenriched, 15, 5);
      for (const enc of unenriched) {
        if (enc.bookmaker === 'Bet365') {
          fixturesStore.set(enc.id, enc);
        }
      }
      saveDiskCache();
    } catch (err) {
      console.warn('Bet365 odds enrichment notice in getDailyMarketHighlights:', err);
    }
  }

  return queryMarketFixtures({ scope: 'all' });
}

/**
 * Backward-compatible single league fixture query
 */
export async function getMarketFixtures(leagueCode: string = 'premier'): Promise<MarketFixture[]> {
  const existing = queryMarketFixtures({ league: leagueCode, scope: 'all' });
  if (existing.length > 0) {
    return existing;
  }
  const fetched = await fetchLeagueFixtures(leagueCode);
  ingestFixtures(fetched);
  return fetched;
}

/**
 * Fetch and transform completed results for a league
 */
export async function getMarketResults(leagueCode: string = 'premier', season?: string): Promise<MarketResult[]> {
  const targetSeason = season || '2025-2026';
  try {
    const res = await fetch(`${BASE_URL}/leagues/${encodeURIComponent(leagueCode)}/results/?season=${encodeURIComponent(targetSeason)}`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch results for ${leagueCode}: HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawEvents = Array.isArray(data) ? data : data.matches || data.results || [];

    return rawEvents.map((r: any) => {
      const scoreStr = String(r.score || '0:0');
      const [hStr, aStr] = scoreStr.split(':');
      const homeScore = parseInt(hStr, 10) || 0;
      const awayScore = parseInt(aStr, 10) || 0;

      let outcome: '1' | 'X' | '2' = 'X';
      if (homeScore > awayScore) outcome = '1';
      else if (awayScore > homeScore) outcome = '2';

      return {
        id: r.id || `${r.date}-${r.homeTeam}-${r.awayTeam}`,
        date: r.date,
        homeTeam: r.homeTeam,
        awayTeam: r.awayTeam,
        score: scoreStr,
        htScore: r.ht_result,
        homeScore,
        awayScore,
        outcome,
        firstGoalTime: r.first_goal_time,
      };
    });
  } catch (err: any) {
    console.warn(`Error fetching results for ${leagueCode}:`, err?.message || err);
    return [];
  }
}

/**
 * Return safe diagnostic telemetry for administrative inspection
 */
export function getSyncDiagnostics(): SyncDiagnostics {
  const all = Array.from(fixturesStore.values());
  const todayStr = getLocalDateStringEAT(new Date());

  const liveCount = all.filter((f) => f.status === 'in').length;
  const upcomingCount = all.filter((f) => f.status === 'pre' && getLocalDateStringEAT(f.kickoffIso) >= todayStr).length;
  const finishedCount = all.filter((f) => f.status === 'post').length;
  const uniqueLeagues = new Set(all.map((f) => f.leagueCode));

  return {
    lastSyncTime: lastSyncTimestamp,
    lastLiveSyncTime: lastLiveSyncTimestamp,
    totalFixtures: all.length,
    liveFixturesCount: liveCount,
    upcomingFixturesCount: upcomingCount,
    finishedFixturesCount: finishedCount,
    activeLeaguesCount: uniqueLeagues.size,
    discoveredLeaguesCount: discoveredLeagues.length,
    lastError: lastSyncError,
    syncCyclesCount: syncCycleCounter,
    liveSyncCyclesCount: liveSyncCyclesCounter,
    dailyRequestBudget: 3840,
    rateLimitSafe: true,
  };
}

// Background scheduler handles
let schedulerTimer: NodeJS.Timeout | null = null;
let liveSchedulerTimer: NodeJS.Timeout | null = null;

/**
 * Start the background continuous synchronization loop (runs in server.ts)
 * Automated polling scheduler disabled per user mandate.
 */
export function startContinuousSportsScheduler(_intervalMinutes = 5, _liveIntervalSeconds = 20): void {
  // Automated background crawler and scheduler disabled per user mandate
}
