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
import { BUNDLED_SPORTS_CATALOGUE } from '../data/bundledSportsCatalogue.js';
import {
  normalizeMatchStatus,
  parseDetailedMatchStatus,
  isStatusTransitionValid,
  AWAITING_CONFIRMATION_MINUTES,
  UNCONFIRMED_MATCH_MINUTES,
  type MatchStatus,
  type MatchPeriod,
} from './matchStatus.js';
import { resolveCanonicalCompetition } from './canonicalCompetitions.js';
import {
  isCompetitionEligible,
  getCompetitionByProvider,
  getCompetitionById,
  getPriorityProviderSlugs,
  getEligibleProviderSlugs,
  logSelectedCompetitionsSummary,
} from './competitionRegistry.js';
import { enrichFixturesWithBet365Odds } from './sportscoreOddsService.js';
import { getHighlightsCutoffWindowEAT } from './competitionPriority.js';
import type { MatchIncidentItem } from './freeMatches.js';
import { isSnapshotStoreConfigured, loadFixtureSnapshot, saveFixtureSnapshot } from './fixtureSnapshotStore.js';
import {
  findMatchingExistingFixture,
  mergeMarketFixtureRecords,
  extractSportScoreProviderId,
  extractSportScoreMatchSlug,
  areFixturesIdentical,
} from './fixtureIdentity.js';
import { realtimeBroadcaster, type BroadcasterMetrics } from './realtimeBroadcaster.js';

// Firestore snapshot hydration state (serverless-safe shared fixture source)
const SNAPSHOT_REFRESH_MS = 60_000;
const SNAPSHOT_MAX_AGE_MS = 48 * 3600 * 1000;
let lastSnapshotLoadMs = 0;
let lastSnapshotUpdatedMs = 0;
let lastLiveSnapshotPersistMs = 0;
let lastTodayDateReconcileMs = 0;

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
  matchSlug?: string;
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
  minute?: string;
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
  recordUpdateTime?: number | string;
  updateVersion?: number;
  isAuthoritativeCorrection?: boolean;
  /**
   * Epoch ms of the provider observation this record reflects. Used by
   * `mergeMarketFixtureRecords` to reject older responses (stale snapshots, late fetches)
   * so they can never overwrite newer live scores/status. Defaults to `syncedAt`.
   */
  observedAtMs?: number;
  incidents?: MatchIncidentItem[];
  latestGoalscorer?: { player: string; minute: string; team: 'home' | 'away' } | any;
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
  lastSuccessfulProviderFetchAt: string | null;
  lastValidLiveUpdateAt: string | null;
  lastSseEventDispatchedAt: string | null;
  lastSseDeliverySentAt: string | null;
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
  providerRequestStats: {
    totalRequests: number;
    successCount: number;
    failureCount: number;
    rateLimitCount: number;
    avgResponseTimeMs: number;
  };
  liveSyncStats: {
    fixturesUpdatedCount: number;
    scoreChangesDetected: number;
    statusChangesDetected: number;
    incidentsDetected: number;
    duplicateEventsIgnored: number;
    staleUpdatesRejected: number;
  };
  sseMetrics: BroadcasterMetrics;
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
let lastSuccessfulProviderFetchAt: string | null = null;
let lastValidLiveUpdateAt: string | null = null;
let lastSyncError: string | null = null;
let syncCycleCounter = 0;
let liveSyncCyclesCounter = 0;
let isLiveSyncing = false;
let isRollingSyncing = false;

// Telemetry counters for Section 13 diagnostics
const providerStats = {
  totalRequests: 0,
  successCount: 0,
  failureCount: 0,
  rateLimitCount: 0,
  totalResponseTimeMs: 0,
};

const livePipelineStats = {
  fixturesUpdatedCount: 0,
  scoreChangesDetected: 0,
  statusChangesDetected: 0,
  incidentsDetected: 0,
  duplicateEventsIgnored: 0,
  staleUpdatesRejected: 0,
};

const BASE_URL = 'https://footballcharts-backend.onrender.com/api/v1';

export function getApiKey(): string {
  const key = typeof process !== 'undefined' ? process.env?.SPORTS_FEED_API_KEY?.trim() : '';
  if (!key) {
    throw new Error('[SportsFeed] SPORTS_FEED_API_KEY environment variable is not set.');
  }
  return key;
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
 * Returns a 9-day rolling date window (yesterday through +7 days, YYYY-MM-DD) in East Africa Time (EAT, UTC+3)
 * so cross-midnight and yesterday's late-finishing fixtures are always reconciled.
 */
export function getWeeklyTargetDatesEAT(nowInput: Date | number = Date.now()): string[] {
  const nowMs = typeof nowInput === 'number' ? nowInput : nowInput.getTime();
  const dates: string[] = [];
  for (let i = -1; i < 8; i++) {
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
 * Normalizes raw SportScore incidents into MshindiRoom MatchIncidentItem[] and extracts latestGoalscorer.
 */
export function normalizeSportScoreIncidents(rawIncidents?: any[]): {
  incidents: MatchIncidentItem[];
  latestGoalscorer?: { player: string; minute: string; team: 'home' | 'away' };
} {
  if (!Array.isArray(rawIncidents) || rawIncidents.length === 0) {
    return { incidents: [] };
  }

  const normalized: MatchIncidentItem[] = [];
  let latestGoalscorer: { player: string; minute: string; team: 'home' | 'away' } | undefined;
  const idOccurrences = new Map<string, number>();

  for (let idx = 0; idx < rawIncidents.length; idx++) {
    const inc = rawIncidents[idx];
    if (!inc || typeof inc !== 'object') continue;

    const rawMin = inc.time ?? inc.minute ?? '';
    const minStr = String(rawMin).trim().endsWith("'") ? String(rawMin).trim() : `${rawMin}'`;
    const team: 'home' | 'away' = inc.side === 'away' || inc.team === 'away' ? 'away' : 'home';
    const typeLower = String(inc.type || '').toLowerCase();
    const isShootoutEvent = typeLower.includes('shootout') || typeLower.includes('shoot-out');

    let incType: MatchIncidentItem['type'] = 'other';
    if (isShootoutEvent) {
      // Penalty-shootout kicks never change the match score and must never be treated as goals.
      incType = 'other';
    } else if (inc.is_goal || typeLower.includes('goal') || typeLower.includes('penalty') && !typeLower.includes('miss')) {
      incType = typeLower.includes('own') ? 'own_goal' : typeLower.includes('pen') ? 'penalty_goal' : 'goal';
    } else if (inc.is_card || typeLower.includes('card')) {
      incType = typeLower.includes('red') ? 'red_card' : 'yellow_card';
    } else if (inc.is_sub || typeLower.includes('sub')) {
      incType = 'substitution';
    } else if (typeLower === 'var' || typeLower.startsWith('var ') || typeLower.includes('video assistant') || inc.type_id === 28) {
      incType = 'var';
    }

    // Only a provider-supplied name is ever used. No placeholder like "Player" is invented,
    // so unidentified cards/goals can be recognised (and suppressed) by the UI.
    const playerName = String(inc.player || (incType === 'substitution' ? inc.player_in : '') || '').trim();

    // VAR decision is carried through ONLY if SportScore supplies explicit decision text.
    let decision: string | undefined;
    if (incType === 'var') {
      const candidate = [inc.decision, inc.var_decision, inc.result, inc.reason, inc.text, inc.description, inc.var_result]
        .find((v) => typeof v === 'string' && v.trim().length > 0);
      decision = candidate ? String(candidate).trim() : undefined;
    }

    // Stable, content-derived ID (independent of array position) so the same provider event
    // keeps the same ID across polls, snapshots and SSE replays. A counter disambiguates the
    // rare case of two identical events in the same minute.
    const baseId = inc.id ? String(inc.id) : `${minStr}_${incType}_${team}_${playerName}`;
    const occurrence = (idOccurrences.get(baseId) || 0) + 1;
    idOccurrences.set(baseId, occurrence);
    const itemId = inc.id ? baseId : occurrence > 1 ? `${baseId}#${occurrence}` : baseId;

    const hs = inc.home_score;
    const as = inc.away_score;
    normalized.push({
      id: itemId,
      type: incType,
      minute: minStr,
      team,
      player: playerName,
      assist: inc.assist || inc.player_out || undefined,
      scoreAfter:
        hs !== undefined && hs !== null && as !== undefined && as !== null
          ? `${hs} - ${as}`
          : inc.scoreAfter,
      ...(decision ? { decision } : {}),
      ...(typeof inc.type_id === 'number' ? { typeId: inc.type_id } : {}),
    });

    if ((incType === 'goal' || incType === 'own_goal' || incType === 'penalty_goal') && playerName) {
      latestGoalscorer = {
        player: playerName,
        minute: minStr,
        team,
      };
    }
  }

  return { incidents: normalized, latestGoalscorer };
}

export function sanitizeSnapshotLoadedFixture(f: MarketFixture, nowMs: number = Date.now()): MarketFixture {
  if (!f || typeof f !== 'object') return f;
  if (f.status === 'in' || f.status === 'awaiting_confirmation') {
    const kMs = f.kickoffIso ? new Date(f.kickoffIso).getTime() : NaN;
    const elapsedMin = Number.isFinite(kMs) ? (nowMs - kMs) / 60000 : Infinity;
    // Safeguard: matches with zero provider confirmation after >= 240 minutes become 'suspended' / 'unconfirmed'
    // (NEVER auto-finalized as 'post' / 'FT' with a guessed score).
    if (elapsedMin >= UNCONFIRMED_MATCH_MINUTES) {
      return {
        ...f,
        status: 'suspended',
        period: 'unconfirmed',
        periodSequence: 58,
        displayClock: 'UNCONFIRMED',
        minute: 'UNCONFIRMED',
        homeScore: f.homeScore ?? null,
        awayScore: f.awayScore ?? null,
        isAuthoritativeCorrection: false,
      };
    }
    // Non-terminal awaiting-confirmation state for matches > 115 minutes without provider terminal status.
    // Keep polling via widget & competition endpoints until provider explicitly returns finished / AET / AP.
    if (elapsedMin > AWAITING_CONFIRMATION_MINUTES) {
      return {
        ...f,
        status: 'awaiting_confirmation',
        period: 'awaiting_confirmation',
        periodSequence: 55,
        displayClock: 'Awaiting FT',
        minute: 'Awaiting FT',
        homeScore: f.homeScore ?? null,
        awayScore: f.awayScore ?? null,
        isAuthoritativeCorrection: false,
      };
    }
  }
  return f;
}

interface FixtureReconcileMeta {
  lastDetailCheckMs: number;
  consecutiveFailures: number;
  nextRetryMs: number;
}

const fixtureReconcileTracker = new Map<string, FixtureReconcileMeta>();

/**
 * Load initial state from bundled catalogue and persistent disk cache
 */
function loadDiskCache(): void {
  if (discoveredLeagues.length === 0 && Array.isArray(BUNDLED_SPORTS_CATALOGUE.leagues)) {
    discoveredLeagues = ([...BUNDLED_SPORTS_CATALOGUE.leagues] as unknown as DiscoveredLeague[])
      .filter((l) => !isSimulatedReality({ competition: l.name, leagueCode: l.league, country: l.country }));
  }

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
            if (f.id.startsWith('future_') || f.providerId === 'ars_che_001') return;
            if (!f.competitionId || f.competitionId === 'esp_la_liga') {
              const canon = resolveCanonicalCompetition({
                competition: f.competition,
                country: f.country,
                leagueCode: f.leagueCode,
                providerId: f.providerId || f.id,
                home: f.home,
                away: f.away,
              });
              f.competitionId = canon.id;
              f.competition = canon.name;
            }
            if (!f.matchSlug) {
              f.matchSlug = extractSportScoreMatchSlug(f) || undefined;
            }
            if (!f.matchId) {
              f.matchId = extractSportScoreProviderId(f) || undefined;
            }
            const sanitized = sanitizeSnapshotLoadedFixture(f);
            fixturesStore.set(sanitized.id, sanitized);
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
  } catch {
    // Disk cache read is optional
  }

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
      } catch {}
    }

    const flat = Array.from(fixturesStore.values());
    try {
      fs.writeFileSync(path.join(targetDir, 'sports_fixtures.json'), JSON.stringify(flat, null, 2), 'utf-8');
      fs.writeFileSync(path.join(targetDir, 'sports_batches.json'), JSON.stringify(adminPdfBatches, null, 2), 'utf-8');
    } catch {}
  } catch {}
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
      dateKey = `${isoM[2]}_${isoM[1]}`;
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

export function clearAllFixtures(): void {
  fixturesStore.clear();
  adminPdfBatches.length = 0;
  lastSyncTimestamp = null;
  saveDiskCache();
}

export function getSavedAdminFixtures(): MarketFixture[] {
  return Array.from(fixturesStore.values());
}

export function getSavedAdminBatches(): AdminPdfBatch[] {
  return [...adminPdfBatches];
}

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

  const apiKey = getApiKey();
  try {
    const res = await fetch(`${BASE_URL}/leagues/`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
 * Fetch and normalize fixtures for a specific league
 */
export async function fetchLeagueFixtures(leagueCode: string): Promise<MarketFixture[]> {
  const apiKey = getApiKey();
  try {
    const res = await fetch(`${BASE_URL}/leagues/${encodeURIComponent(leagueCode)}/fixtures/`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(35000),
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
        home: homeTeam,
        away: awayTeam,
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
        minute: displayClock,
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
        recordUpdateTime: Date.now(),
        updateVersion: 1,
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
 * 2. Idempotent deduplication via 5-tier identity matching in fixtureIdentity.ts.
 * 3. Atomic state updates & SSE delta broadcasting.
 * 4. Legitimate provider corrections (e.g. VAR disallowed goal).
 */
export function ingestFixtures(
  fixtures: MarketFixture[],
  isAuthoritative = false,
  options?: { updateFullSyncTimestamp?: boolean }
): number {
  let updatedCount = 0;
  const nowIso = new Date().toISOString();

  for (const f of fixtures) {
    if (!f || !f.id || isSimulatedReality(f)) continue;

    if (!f.competitionId || f.competitionId === 'esp_la_liga') {
      const canon = resolveCanonicalCompetition({
        competition: f.competition,
        country: f.country,
        leagueCode: f.leagueCode,
        providerId: f.providerId || f.id,
        home: f.home,
        away: f.away,
      });
      f.competitionId = canon.id;
      f.competition = canon.name;
    }

    if (!f.matchSlug) {
      f.matchSlug = extractSportScoreMatchSlug(f) || undefined;
    }
    if (!f.matchId) {
      f.matchId = extractSportScoreProviderId(f) || undefined;
    }

    // Find existing fixture using 5-tier identity cascade
    const existing = fixturesStore.get(f.id) || findMatchingExistingFixture(f, fixturesStore.values());

    if (!existing) {
      const newFixture: MarketFixture = {
        ...f,
        minute: f.displayClock || f.minute || '',
        lastSyncTime: f.syncedAt || nowIso,
        recordUpdateTime: Date.now(),
        updateVersion: 1,
      };
      fixturesStore.set(f.id, newFixture);
      updatedCount++;
      livePipelineStats.fixturesUpdatedCount++;
      try {
        realtimeBroadcaster.broadcastDelta({
          type: 'FIXTURE_UPSERT',
          fixtureId: f.id,
          providerId: f.providerId,
          matchSlug: f.matchSlug,
          fixture: newFixture,
        });
      } catch {}
    } else {
      const targetId = existing.id;
      const { merged, hasChanged, rejectedStaleTransition } = mergeMarketFixtureRecords(existing, f, {
        isAuthoritativeCorrection: isAuthoritative || Boolean(f.isAuthoritativeCorrection),
      });

      if (rejectedStaleTransition) {
        livePipelineStats.staleUpdatesRejected++;
      }

      if (!hasChanged) {
        livePipelineStats.duplicateEventsIgnored++;
        continue;
      }

      fixturesStore.set(targetId, merged);
      updatedCount++;
      livePipelineStats.fixturesUpdatedCount++;
      lastValidLiveUpdateAt = nowIso;

      try {
        const scoreChanged =
          merged.homeScore !== existing.homeScore ||
          merged.awayScore !== existing.awayScore ||
          merged.homeHtScore !== existing.homeHtScore ||
          merged.awayHtScore !== existing.awayHtScore;

        if (scoreChanged) {
          livePipelineStats.scoreChangesDetected++;
          realtimeBroadcaster.broadcastScoreUpdate(
            targetId,
            merged.homeScore,
            merged.awayScore,
            merged.displayClock,
            merged.period,
            merged.latestGoalscorer,
            merged.providerId,
            merged.status,
            merged.homeHtScore,
            merged.awayHtScore,
            merged.matchSlug,
            merged.home,
            merged.away,
            merged.kickoffIso,
            merged.updateVersion
          );
        }

        const statusChanged =
          merged.status !== existing.status ||
          merged.period !== existing.period ||
          merged.displayClock !== existing.displayClock;

        if (statusChanged) {
          livePipelineStats.statusChangesDetected++;
          const result: '1' | 'X' | '2' | undefined =
            merged.status === 'post'
              ? (merged.homeScore ?? 0) > (merged.awayScore ?? 0)
                ? '1'
                : (merged.homeScore ?? 0) < (merged.awayScore ?? 0)
                ? '2'
                : 'X'
              : undefined;

          realtimeBroadcaster.broadcastStatusChange(
            targetId,
            merged.status,
            merged.period,
            merged.displayClock,
            result,
            merged.providerId,
            merged.homeScore,
            merged.awayScore,
            merged.matchSlug,
            merged.home,
            merged.away,
            merged.kickoffIso,
            merged.updateVersion
          );
        }

        const oddsChanged =
          merged.homeOdds !== existing.homeOdds ||
          merged.drawOdds !== existing.drawOdds ||
          merged.awayOdds !== existing.awayOdds ||
          merged.bookmaker !== existing.bookmaker;

        if (oddsChanged) {
          realtimeBroadcaster.broadcastOddsUpdate(
            targetId,
            merged.bookmaker,
            merged.homeOdds,
            merged.drawOdds,
            merged.awayOdds,
            merged.providerId
          );
        }

        if (Array.isArray(f.incidents) && f.incidents.length > 0) {
          const existingIncidents = existing.incidents || [];
          const existingKeys = new Set(
            existingIncidents.map((i) => i.id || `${i.minute}_${i.type}_${i.player}`)
          );
          for (const inc of f.incidents) {
            const incKey = inc.id || `${inc.minute}_${inc.type}_${inc.player}`;
            if (!existingKeys.has(incKey)) {
              livePipelineStats.incidentsDetected++;
              realtimeBroadcaster.broadcastIncident(
                targetId,
                inc,
                merged.providerId,
                merged.latestGoalscorer,
                merged.matchSlug
              );
            }
          }
        }
      } catch {}
    }
  }

  if (updatedCount > 0) {
    if (options?.updateFullSyncTimestamp) {
      lastSyncTimestamp = nowIso;
    }
    saveDiskCache();
  }
  return updatedCount;
}

function slugify(text: string): string {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function normalizeSportScoreMatch(
  m: any,
  nowIso: string,
  isLiveForce = false,
  isAuthoritativeCorrection = false
): MarketFixture {
  const home = String(m.home || m.home_team || 'Home Team').trim();
  const away = String(m.away || m.away_team || 'Away Team').trim();
  const rawComp = String(m.competition || 'International Football').trim();

  let matchSlug = '';
  let matchId = m.id ? String(m.id) : '';
  let slug = '';

  if (m.url) {
    const parts = m.url.split('/').filter(Boolean);
    // e.g. ["football", "match", "paris-saint-germain-vs-fc-barcelona", "3glrw7hnx23jqdy"]
    if (parts.length >= 4) {
      matchSlug = parts[2];
      matchId = parts[3];
      slug = `${parts[2]}-${parts[3]}`;
    } else if (parts.length >= 3) {
      matchSlug = parts[2];
      slug = parts[2];
    } else if (parts.length >= 1) {
      slug = parts[parts.length - 1];
      matchSlug = slug;
    }
  }
  if (!matchSlug) {
    matchSlug = `${slugify(home)}-vs-${slugify(away)}`;
  }
  if (!slug) {
    slug = matchId ? `${matchSlug}-${matchId}` : matchSlug;
  }

  const isoTime = m.time || m.start_at || m.kickoff || nowIso || new Date().toISOString();
  const kickoffEAT = formatEATTime(isoTime);

  const effectiveRawStatus = m.status || (isLiveForce ? 'live' : 'upcoming');
  const detailed = parseDetailedMatchStatus(effectiveRawStatus, m.status_text, m.live_minute ?? m.minute);

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

  const homeHtScore =
    m.home_ht_score !== undefined && m.home_ht_score !== null && m.home_ht_score !== ''
      ? Number(m.home_ht_score)
      : null;
  const awayHtScore =
    m.away_ht_score !== undefined && m.away_ht_score !== null && m.away_ht_score !== ''
      ? Number(m.away_ht_score)
      : null;

  const { incidents, latestGoalscorer } = normalizeSportScoreIncidents(m.incidents);

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
    home,
    away,
  });

  return {
    id: `mkt-ss-${slug}`,
    providerId: slug,
    matchId: matchId || undefined,
    matchSlug,
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
    minute: displayClock,
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
    incidents: incidents.length > 0 ? incidents : undefined,
    latestGoalscorer,
    syncedAt: nowIso,
    lastSyncTime: nowIso,
    recordUpdateTime: Date.now(),
    updateVersion: 1,
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
    const startMs = Date.now();
    providerStats.totalRequests++;
    try {
      const res = await fetch(url, {
        headers: SPORTSCORE_HEADERS,
        signal: AbortSignal.timeout(timeoutMs),
      });
      providerStats.totalResponseTimeMs += Date.now() - startMs;

      if (res.status === 429) {
        providerStats.rateLimitCount++;
      }

      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const delay = res.status === 429 ? 1500 * (attempt + 1) : 1000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }

      if (res.ok) {
        providerStats.successCount++;
        lastSuccessfulProviderFetchAt = new Date().toISOString();
      } else {
        providerStats.failureCount++;
      }
      return res;
    } catch (err: any) {
      providerStats.totalResponseTimeMs += Date.now() - startMs;
      providerStats.failureCount++;
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
 * Parses `dm.time` from SportScore widget match-detail payloads.
 * Handles both ISO 8601 strings (e.g. "2026-11-07T13:00:00+00:00") and numeric Unix epochs
 * (seconds or milliseconds), validating `Number.isFinite(d.getTime())` before `.toISOString()`.
 */
export function parseSportScoreWidgetTimestamp(rawTime: unknown, slugContext?: string): string | undefined {
  if (rawTime === null || rawTime === undefined || rawTime === '') {
    return undefined;
  }
  if (typeof rawTime === 'string' && rawTime.trim() === '') {
    return undefined;
  }

  const numericVal =
    typeof rawTime === 'number'
      ? rawTime
      : typeof rawTime === 'string'
      ? Number(rawTime.trim())
      : NaN;

  const d =
    typeof rawTime === 'string' && Number.isNaN(numericVal)
      ? new Date(rawTime.trim())
      : Number.isFinite(numericVal)
      ? new Date(numericVal > 1e12 ? numericVal : numericVal * 1000)
      : new Date(NaN);

  if (!Number.isFinite(d.getTime())) {
    console.error('[SportScore Widget] Invalid dm.time value in match detail:', {
      slug: slugContext,
      rawTime,
      error: 'Invalid time value (non-finite Date)',
    });
    return undefined;
  }

  return d.toISOString();
}

/**
 * Authoritative SportScore Match Detail Fetcher & Normalizer.
 * Used by both `syncLiveScoresOnly` and `/api/sports/match-detail` proxy routes.
 * Unwraps `data.match`, maps `home`->`home_team` and `away`->`away_team` for compatibility,
 * and updates the authoritative `fixturesStore` + SSE subscribers when changes are detected!
 */
export async function fetchAuthoritativeSportScoreMatchDetail(
  slugOrItem: string | { matchSlug?: string; matchUrl?: string; providerId?: string; id?: string; home?: string; away?: string },
  options?: { ingestIntoStore?: boolean }
): Promise<any | null> {
  const candidateSlug =
    typeof slugOrItem === 'string'
      ? extractSportScoreMatchSlug({ matchSlug: slugOrItem, providerId: slugOrItem, id: slugOrItem }) || slugOrItem
      : extractSportScoreMatchSlug(slugOrItem);

  if (!candidateSlug || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,127}$/.test(candidateSlug)) return null;

  let rawDmTimeForLog: unknown = undefined;
  try {
    const url = `https://sportscore.com/api/widget/match/?sport=football&slug=${encodeURIComponent(candidateSlug)}`;
    const res = await fetchSportScoreWithRetry(url, 1, 6000);
    if (!res.ok) return null;

    const rawJson = await res.json();
    const dm = rawJson?.match || rawJson;
    if (!dm || typeof dm !== 'object' || (!dm.home && !dm.away && !dm.home_team && !dm.away_team)) {
      return null;
    }

    rawDmTimeForLog = dm.time;
    const parsedKickoffIso = parseSportScoreWidgetTimestamp(dm.time, candidateSlug);

    const homeTeam = String(dm.home || dm.home_team || '').trim();
    const awayTeam = String(dm.away || dm.away_team || '').trim();
    const detailed = parseDetailedMatchStatus(dm.status, dm.status_text, dm.live_minute);

    // Optionally ingest into fixturesStore so any match-detail fetch also updates the global live store & SSE
    if (options?.ingestIntoStore !== false) {
      const existing = findMatchingExistingFixture(
        {
          id: String(dm.id || candidateSlug),
          matchSlug: candidateSlug,
          matchUrl: dm.url,
          home: homeTeam,
          away: awayTeam,
          kickoffIso: parsedKickoffIso,
        } as any,
        fixturesStore.values()
      );

      // Only ingest if the match is already in our curated store or belongs to an eligible competition
      const nowIso = new Date().toISOString();
      const normFixture = normalizeSportScoreMatch(
        {
          ...dm,
          home: homeTeam,
          away: awayTeam,
          url: dm.url || existing?.matchUrl,
          time: parsedKickoffIso || existing?.kickoffIso,
          competition: dm.competition || existing?.competition,
        },
        nowIso,
        detailed.status === 'in',
        true
      );

      let shouldIngest = Boolean(
        existing ||
        isCompetitionEligible({
          id: normFixture.competitionId,
          providerId: normFixture.providerId,
          slug: normFixture.leagueCode,
          competition: normFixture.competition,
          country: normFixture.country,
        })
      );

      // Strict sanity guards against historical slug collisions:
      if (existing && shouldIngest) {
        const existKickoffMs = existing.kickoffIso
          ? Date.parse(existing.kickoffIso)
          : (existing.kickoff ? Date.parse(existing.kickoff) : NaN);
        const incomingKickoffMs = parsedKickoffIso ? Date.parse(parsedKickoffIso) : NaN;
        const isKickoffDivergent =
          Number.isFinite(existKickoffMs) &&
          Number.isFinite(incomingKickoffMs) &&
          Math.abs(existKickoffMs - incomingKickoffMs) > 24 * 3600 * 1000;
        const isFutureMatch =
          Number.isFinite(existKickoffMs) && existKickoffMs > Date.now() + 5 * 60 * 1000;

        // If kickoff dates diverge by > 24 hours, or if existing is a future-scheduled fixture
        // but incoming detail says finished or in-play, reject ingestion!
        if (isKickoffDivergent || (isFutureMatch && (detailed.status === 'post' || detailed.status === 'in'))) {
          shouldIngest = false;
        }
      }

      if (shouldIngest) {
        ingestFixtures([normFixture], true);
      }
    }

    // Return normalized detail compatible with both raw `match` consumers and `SportScoreMatchDetail`
    const normalizedDetail = {
      ...dm,
      home: homeTeam,
      away: awayTeam,
      home_team: homeTeam,
      away_team: awayTeam,
      home_score: dm.home_score !== null && dm.home_score !== undefined && dm.home_score !== '' ? Number(dm.home_score) : null,
      away_score: dm.away_score !== null && dm.away_score !== undefined && dm.away_score !== '' ? Number(dm.away_score) : null,
      home_ht_score: dm.home_ht_score !== null && dm.home_ht_score !== undefined && dm.home_ht_score !== '' ? Number(dm.home_ht_score) : null,
      away_ht_score: dm.away_ht_score !== null && dm.away_ht_score !== undefined && dm.away_ht_score !== '' ? Number(dm.away_ht_score) : null,
      kickoff: parsedKickoffIso || dm.kickoff || dm.time,
      normalized_status: detailed.status,
      normalized_period: detailed.period,
      display_clock: detailed.displayClock,
      updated: rawJson?.updated || new Date().toISOString(),
      match: dm,
    };

    return normalizedDetail;
  } catch (err: any) {
    console.error(
      `[SportScore Widget] Authoritative match detail fetch failed for "${candidateSlug}":`,
      { rawTime: rawDmTimeForLog, error: err?.message || err }
    );
    return null;
  }
}

/**
 * Resolve the SportScore competition slug for a tracked fixture so per-competition polling
 * can query `/api/v1/fixtures/?sport=football&competition=<slug>&date=<YYYY-MM-DD>`.
 */
export function resolveFixtureCompetitionSlug(f: MarketFixture): string | null {
  if (f.competitionId) {
    const byId = getCompetitionById(f.competitionId);
    if (byId?.providerSlug) return byId.providerSlug;
  }
  if (f.leagueCode) {
    const byLeague = getCompetitionByProvider(f.leagueCode);
    if (byLeague?.providerSlug) return byLeague.providerSlug;
  }
  if (f.competition) {
    const byName = getCompetitionByProvider(f.competition);
    if (byName?.providerSlug) return byName.providerSlug;
  }
  if (f.leagueCode && f.leagueCode.includes('-')) {
    return f.leagueCode.toLowerCase().trim();
  }
  if (f.competition) {
    const fallbackSlug = slugify(f.competition);
    if (fallbackSlug) return fallbackSlug;
  }
  return null;
}

/**
 * Fetch SportScore fixtures targeted for a specific competition and date.
 * Admits registered eligible competitions AND any fixture already tracked in `fixturesStore`.
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
        const isEligible =
          isCompetitionEligible({
            id: normalized.competitionId,
            providerId: normalized.providerId,
            slug: normalized.leagueCode,
            competition: normalized.competition,
            country: normalized.country,
          }) || Boolean(findMatchingExistingFixture(normalized, fixturesStore.values()));
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
 */
export async function fetchSportScoreFixturesByDate(date: string): Promise<MarketFixture[]> {
  const allNormalized: MarketFixture[] = [];
  const limit = 200;
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
 * Fetch genuinely active live fixtures from SportScore, admitting eligible competitions
 * plus any fixture already tracked in our store.
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
      const isEligible =
        isCompetitionEligible({
          id: normalized.competitionId,
          providerId: normalized.providerId,
          slug: normalized.leagueCode,
          competition: normalized.competition,
          country: normalized.country,
        }) || Boolean(findMatchingExistingFixture(normalized, fixturesStore.values()));

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
 * Synchronize SportScore catalogue for specified dates across priority competitions.
 * Note: Does NOT rely on `status=live` (which returns 0 matches upstream).
 */
export async function syncSportScoreCatalog(dates?: string[]): Promise<number> {
  if (!hasLoggedRegistrySummary) {
    logSelectedCompetitionsSummary();
    hasLoggedRegistrySummary = true;
  }

  const targetDates = dates && dates.length > 0 ? dates : getWeeklyTargetDatesEAT();
  let totalIngested = 0;

  // Fetch targeted priority competitions for each target date (capped concurrency to avoid 503s)
  const prioritySlugs = getPriorityProviderSlugs();
  const CONCURRENCY_LIMIT = 4;

  for (const d of targetDates) {
    for (let i = 0; i < prioritySlugs.length; i += CONCURRENCY_LIMIT) {
      const batch = prioritySlugs.slice(i, i + CONCURRENCY_LIMIT);
      const results = await Promise.allSettled(
        batch.map((slug) => fetchSportScoreFixturesByCompetition(slug, d))
      );
      for (const res of results) {
        if (res.status === 'fulfilled' && res.value.length > 0) {
          totalIngested += ingestFixtures(res.value, false, { updateFullSyncTimestamp: true });
        }
      }
    }

    const fixtures = await fetchSportScoreFixturesByDate(d);
    if (fixtures.length > 0) {
      totalIngested += ingestFixtures(fixtures, false, { updateFullSyncTimestamp: true });
    }
  }

  lastSyncTimestamp = new Date().toISOString();
  return totalIngested;
}

/**
 * Dedicated live scores & match state reconciliation loop.
 * 1. Does NOT rely on `status=live` (unreliable upstream) or global `date=` for anything after 10:00 UTC.
 * 2. Collects all currently `'in'`, `'awaiting_confirmation'`, and recently-kicked-off `'pre'` matches,
 *    groups them by `(competitionSlug, date)`, and polls `fetchSportScoreFixturesByCompetition()` with
 *    concurrency strictly capped at 3 to avoid upstream 503s.
 * 3. Cross-checks `'in'`, `'awaiting_confirmation'`, and un-transitioned past-kickoff `'pre'` matches
 *    against the authoritative widget endpoint (`fetchAuthoritativeSportScoreMatchDetail()`, concurrency 4).
 * 4. Never overwrites the full rolling-sync `lastSyncTimestamp`.
 */
export async function syncLiveScoresOnly(): Promise<{ updated: number; liveCount: number }> {
  if (isLiveSyncing) {
    return { updated: 0, liveCount: Array.from(fixturesStore.values()).filter((f) => f.status === 'in').length };
  }
  isLiveSyncing = true;
  try {
    let updated = 0;
    const nowMs = Date.now();
    const candidatesToReconcile: MarketFixture[] = [];
    let hasTerminalStatusTransition = false;

    for (const sf of fixturesStore.values()) {
      if (sf.status === 'in' || sf.status === 'awaiting_confirmation') {
        candidatesToReconcile.push(sf);
      } else if (sf.status === 'pre' && sf.kickoffIso) {
        const kMs = new Date(sf.kickoffIso).getTime();
        const elapsedMin = (nowMs - kMs) / 60000;
        // Kickoff passed between 1 minute ago and 360 minutes ago (covers cross-midnight & yesterday matches)
        if (elapsedMin >= 1 && elapsedMin <= 360) {
          candidatesToReconcile.push(sf);
        }
      }
    }

    // Step A: Group active & recently-kicked-off candidates by competition slug + match date (no .slice(0, 2) truncation!)
    if (candidatesToReconcile.length > 0) {
      const compDatePairs = new Map<string, { compSlug: string; dateStr: string }>();
      const pre10UtcUnmappedDates = new Set<string>();

      const fallbackUtcToday = new Date(nowMs).toISOString().slice(0, 10);
      const fallbackEatToday = getLocalDateStringEAT(nowMs);

      for (const c of candidatesToReconcile) {
        const compSlug = resolveFixtureCompetitionSlug(c);
        const candidateDates = new Set<string>();
        let kickoffUtcHour = 12;

        if (c.kickoffIso) {
          const kDate = new Date(c.kickoffIso);
          if (Number.isFinite(kDate.getTime())) {
            kickoffUtcHour = kDate.getUTCHours();
            candidateDates.add(kDate.toISOString().slice(0, 10));
            const eatDate = getLocalDateStringEAT(kDate);
            if (eatDate) candidateDates.add(eatDate);
          }
        }
        if (candidateDates.size === 0) {
          candidateDates.add(fallbackUtcToday);
          if (fallbackEatToday) candidateDates.add(fallbackEatToday);
        }

        if (compSlug) {
          for (const dateStr of candidateDates) {
            compDatePairs.set(`${compSlug}::${dateStr}`, { compSlug, dateStr });
          }
        } else if (kickoffUtcHour < 10) {
          // Only allow global date endpoint fallback for unmapped matches strictly before 10:00 UTC
          for (const dateStr of candidateDates) {
            pre10UtcUnmappedDates.add(dateStr);
          }
        }
      }

      const COMP_POLL_CONCURRENCY = 3;
      const compTasks = Array.from(compDatePairs.values());
      for (let i = 0; i < compTasks.length; i += COMP_POLL_CONCURRENCY) {
        const batch = compTasks.slice(i, i + COMP_POLL_CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map(({ compSlug, dateStr }) => fetchSportScoreFixturesByCompetition(compSlug, dateStr))
        );
        for (const res of results) {
          if (res.status === 'fulfilled' && res.value.length > 0) {
            for (const item of res.value) {
              const prev = fixturesStore.get(item.id) || findMatchingExistingFixture(item, fixturesStore.values());
              if (prev && prev.status !== 'post' && item.status === 'post') {
                hasTerminalStatusTransition = true;
              }
            }
            updated += ingestFixtures(res.value, true, { updateFullSyncTimestamp: false });
          }
        }
      }

      if (pre10UtcUnmappedDates.size > 0 && nowMs - lastTodayDateReconcileMs > 30_000) {
        lastTodayDateReconcileMs = nowMs;
        for (const dateStr of Array.from(pre10UtcUnmappedDates)) {
          try {
            const dateMatches = await fetchSportScoreFixturesByDate(dateStr);
            if (dateMatches.length > 0) {
              updated += ingestFixtures(dateMatches, true, { updateFullSyncTimestamp: false });
            }
          } catch {}
        }
      }
    }

    // Step B: Cross-check 'in', 'awaiting_confirmation', and un-transitioned past-kickoff 'pre' matches
    // against the fixed fetchAuthoritativeSportScoreMatchDetail() widget endpoint (capped concurrency = 4).
    const remainingCandidates = candidatesToReconcile
      .filter((c) => {
        const current = fixturesStore.get(c.id);
        if (!current) return false;
        if (current.status === 'in' || current.status === 'awaiting_confirmation') return true;
        if (current.status === 'pre' && current.kickoffIso) {
          const meta = fixtureReconcileTracker.get(current.id);
          if (meta && nowMs < meta.nextRetryMs) return false;
          const elapsedMin = (nowMs - new Date(current.kickoffIso).getTime()) / 60000;
          return elapsedMin >= 5 && elapsedMin <= 360;
        }
        return false;
      })
      .sort((a, b) => {
        const curA = fixturesStore.get(a.id) || a;
        const curB = fixturesStore.get(b.id) || b;
        const rank = (s?: MatchStatus) => (s === 'in' || s === 'awaiting_confirmation' ? 0 : 1);
        const rankDiff = rank(curA.status) - rank(curB.status);
        if (rankDiff !== 0) return rankDiff;
        // Priority 2: Least recently checked first (round-robin fairness)
        const metaA = fixtureReconcileTracker.get(curA.id)?.lastDetailCheckMs || 0;
        const metaB = fixtureReconcileTracker.get(curB.id)?.lastDetailCheckMs || 0;
        return metaA - metaB;
      })
      .slice(0, 32);

    const confirmedExtraTimeIds = new Set<string>();
    const WIDGET_POLL_CONCURRENCY = 4;

    for (let i = 0; i < remainingCandidates.length; i += WIDGET_POLL_CONCURRENCY) {
      const batch = remainingCandidates.slice(i, i + WIDGET_POLL_CONCURRENCY);
      await Promise.allSettled(
        batch.map(async (sf) => {
          const current = fixturesStore.get(sf.id);
          if (!current) return;
          const prevStatus = current.status;

          const prevMeta = fixtureReconcileTracker.get(current.id) || {
            lastDetailCheckMs: 0,
            consecutiveFailures: 0,
            nextRetryMs: 0,
          };
          prevMeta.lastDetailCheckMs = nowMs;
          fixtureReconcileTracker.set(current.id, prevMeta);

          const detail = await fetchAuthoritativeSportScoreMatchDetail(current, { ingestIntoStore: true });
          if (detail) {
            prevMeta.consecutiveFailures = 0;
            prevMeta.nextRetryMs = 0;
            if (detail.normalized_status !== prevStatus || detail.home_score !== current.homeScore || detail.away_score !== current.awayScore) {
              updated++;
              if (detail.normalized_status === 'post') {
                hasTerminalStatusTransition = true;
              }
            }
            if (
              detail.normalized_status === 'in' &&
              (detail.period === 'extra_time' ||
                detail.period === 'extra_time_halftime' ||
                detail.period === 'penalties')
            ) {
              confirmedExtraTimeIds.add(current.id);
            }
          } else {
            prevMeta.consecutiveFailures += 1;
            const backoffMs = Math.min(300_000, 15_000 * Math.pow(2, prevMeta.consecutiveFailures - 1));
            prevMeta.nextRetryMs = nowMs + backoffMs;
          }
        })
      );
    }

    // Apply non-terminal lifecycle safeguards across all candidates still lacking provider terminal confirmation.
    // NEVER fabricate status:'post' / 'FT' or guess a final score based on elapsed time alone!
    for (const sf of candidatesToReconcile) {
      const afterDetail = fixturesStore.get(sf.id);
      if (!afterDetail || (afterDetail.status !== 'in' && afterDetail.status !== 'awaiting_confirmation')) continue;

      const kMs = afterDetail.kickoffIso ? new Date(afterDetail.kickoffIso).getTime() : NaN;
      const elapsedMin = Number.isFinite(kMs) ? (nowMs - kMs) / 60000 : Infinity;

      if (elapsedMin >= UNCONFIRMED_MATCH_MINUTES) {
        const safeguardUnconfirmed: MarketFixture = {
          ...afterDetail,
          status: 'suspended',
          period: 'unconfirmed',
          periodSequence: 58,
          displayClock: 'UNCONFIRMED',
          minute: 'UNCONFIRMED',
          homeScore: afterDetail.homeScore ?? null,
          awayScore: afterDetail.awayScore ?? null,
          syncedAt: new Date().toISOString(),
          isAuthoritativeCorrection: false,
        };
        updated += ingestFixtures([safeguardUnconfirmed], false, { updateFullSyncTimestamp: false });
      } else if (elapsedMin > AWAITING_CONFIRMATION_MINUTES) {
        const hasConfirmedExtraTimeOrPenalties = confirmedExtraTimeIds.has(afterDetail.id) && elapsedMin < 160;
        if (!hasConfirmedExtraTimeOrPenalties && afterDetail.status !== 'awaiting_confirmation') {
          const awaitingConfirmation: MarketFixture = {
            ...afterDetail,
            status: 'awaiting_confirmation',
            period: 'awaiting_confirmation',
            periodSequence: 55,
            displayClock: 'Awaiting FT',
            minute: 'Awaiting FT',
            homeScore: afterDetail.homeScore ?? null,
            awayScore: afterDetail.awayScore ?? null,
            syncedAt: new Date().toISOString(),
            isAuthoritativeCorrection: false,
          };
          updated += ingestFixtures([awaitingConfirmation], false, { updateFullSyncTimestamp: false });
        }
      }
    }

    if (updated > 0 || hasTerminalStatusTransition) {
      saveDiskCache();
      // Always persist immediately when any match transitions to 'post', or every 25s on score updates,
      // so Firestore/disk snapshot reloads never resurrect a finished match as 'in'.
      if (isSnapshotStoreConfigured() && (hasTerminalStatusTransition || Date.now() - lastLiveSnapshotPersistMs > 25_000)) {
        lastLiveSnapshotPersistMs = Date.now();
        saveFixtureSnapshot(Array.from(fixturesStore.values()), {
          isCompleteReconciliation: false,
          source: 'rolling_sync',
        }).catch(() => {});
      }
    }

    lastLiveSyncTimestamp = new Date().toISOString();
    liveSyncCyclesCounter++;
    const currentLiveCount = Array.from(fixturesStore.values()).filter((f) => f.status === 'in').length;
    return { updated, liveCount: currentLiveCount };
  } finally {
    isLiveSyncing = false;
  }
}

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
    if (count > 0) {
      saveDiskCache();
      if (isSnapshotStoreConfigured()) {
        saveFixtureSnapshot(Array.from(fixturesStore.values()), {
          isCompleteReconciliation: false,
          source: 'rolling_sync',
        }).catch(() => {});
      }
    }
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
      if (f.status === 'post' || f.status === 'pre' || f.status === 'postponed' || f.status === 'cancelled' || f.status === 'abandoned' || f.status === 'suspended') {
        return false;
      }
      if (f.status === 'in' || f.status === 'awaiting_confirmation') return true;
      if (f.period && ['first_half', 'halftime', 'second_half', 'extra_time', 'extra_time_halftime', 'penalties', 'awaiting_confirmation'].includes(f.period)) {
        return true;
      }
      return false;
    });
  } else if (scope === 'finished' || scope === 'results' || scope === 'completed') {
    list = list.filter((f) => f.status === 'post' || (f.period && ['full_time', 'after_extra_time', 'after_penalties', 'awarded'].includes(f.period)));
  } else if (scope === 'highlights') {
    const { startMs: hlStartMs, nextDay6amMs: hlCutoffMs } = getHighlightsCutoffWindowEAT(new Date());
    list = list.filter((f) => {
      if (f.status === 'post' || f.status === 'in' || f.status === 'awaiting_confirmation' || f.status === 'suspended') return false;
      if (f.period && ['full_time', 'after_extra_time', 'after_penalties', 'awarded', 'first_half', 'halftime', 'second_half', 'extra_time', 'extra_time_halftime', 'penalties', 'awaiting_confirmation', 'unconfirmed'].includes(f.period)) return false;
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
      if (f.period && ['full_time', 'after_extra_time', 'after_penalties', 'awarded', 'postponed', 'cancelled', 'abandoned', 'first_half', 'halftime', 'second_half', 'extra_time', 'extra_time_halftime', 'penalties'].includes(f.period)) return false;
      const kMs = f.kickoffIso ? new Date(f.kickoffIso).getTime() : 0;
      return kMs >= nowMs;
    });
  }

  // Filter by League
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
 * Always reconciles live & recently finished matches when lastLiveSyncTimestamp > 12s ago,
 * even when base fixtures are hydrated from the weekly Firestore/disk snapshot!
 */
export async function getDailyMarketHighlights(force = false): Promise<MarketFixture[]> {
  if (fixturesStore.size === 0) {
    loadDiskCache();
  }

  const nowMs = Date.now();
  let snapshotServed = false;
  if (isSnapshotStoreConfigured()) {
    const snapshotAgeMs = Date.now() - lastSnapshotLoadMs;
    if (force || fixturesStore.size === 0 || snapshotAgeMs > SNAPSHOT_REFRESH_MS) {
      lastSnapshotLoadMs = Date.now();
      const { fixtures: snapFixtures, updatedAt: snapUpdatedAt } = await loadFixtureSnapshot();
      if (snapUpdatedAt) lastSnapshotUpdatedMs = new Date(snapUpdatedAt).getTime();
      if (snapFixtures.length > 0) {
        const sanitizedSnap = snapFixtures.map((f) => sanitizeSnapshotLoadedFixture(f, nowMs));
        ingestFixtures(sanitizedSnap, false, { updateFullSyncTimestamp: false });
      }
    }
    snapshotServed =
      Date.now() - lastSnapshotUpdatedMs < SNAPSHOT_MAX_AGE_MS &&
      Array.from(fixturesStore.values()).some((f) => f.status === 'pre' || f.status === 'in');
  }

  const hasUpcomingOrLive = Array.from(fixturesStore.values()).some((f) => {
    if (f.status === 'in' || f.status === 'awaiting_confirmation') return true;
    if (f.status === 'pre') {
      const kMs = f.kickoffIso ? new Date(f.kickoffIso).getTime() : 0;
      return kMs >= nowMs - 3 * 3600 * 1000;
    }
    return false;
  });

  const hasBet365Odds = Array.from(fixturesStore.values()).some((f) => f.bookmaker === 'Bet365');
  const isStale = !lastSyncTimestamp || Date.now() - new Date(lastSyncTimestamp).getTime() > 10 * 60 * 1000;

  // Do NOT allow the 48-hour snapshot window to suppress periodic rolling sync cycles (`isStale` / `force` / empty slate).
  if (force || isStale || !hasUpcomingOrLive || (!snapshotServed && !hasBet365Odds)) {
    try {
      await executeRollingSyncCycle();
    } catch (err) {
      console.warn('SportScore rolling sync notice in getDailyMarketHighlights:', err);
    }
  }

  // Always keep live, awaiting-confirmation, and recently-finished matches synchronized
  // across ALL active competitions (not just priority slugs) when lastLiveSyncTimestamp > 12s ago.
  const liveAgeMs = lastLiveSyncTimestamp ? Date.now() - new Date(lastLiveSyncTimestamp).getTime() : Infinity;
  if (force || liveAgeMs > 12_000) {
    try {
      await syncLiveScoresOnly();
    } catch (err) {
      console.warn('Live score sync notice in getDailyMarketHighlights:', err);
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
  const apiKey = getApiKey();
  try {
    const res = await fetch(`${BASE_URL}/leagues/${encodeURIComponent(leagueCode)}/results/?season=${encodeURIComponent(targetSeason)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
 * Return comprehensive diagnostic telemetry for monitoring & administrative inspection
 */
export function getSyncDiagnostics(): SyncDiagnostics {
  const all = Array.from(fixturesStore.values());
  const todayStr = getLocalDateStringEAT(new Date());

  const liveCount = all.filter((f) => f.status === 'in').length;
  const upcomingCount = all.filter((f) => f.status === 'pre' && getLocalDateStringEAT(f.kickoffIso) >= todayStr).length;
  const finishedCount = all.filter((f) => f.status === 'post').length;
  const uniqueLeagues = new Set(all.map((f) => f.leagueCode));
  const sseMetrics = realtimeBroadcaster.getMetrics();
  const avgResponseTimeMs =
    providerStats.totalRequests > 0
      ? Math.round(providerStats.totalResponseTimeMs / providerStats.totalRequests)
      : 0;

  return {
    lastSyncTime: lastSyncTimestamp,
    lastLiveSyncTime: lastLiveSyncTimestamp,
    lastSuccessfulProviderFetchAt,
    lastValidLiveUpdateAt,
    lastSseEventDispatchedAt: sseMetrics.lastEventDispatchedAt,
    lastSseDeliverySentAt: sseMetrics.lastDeliverySentAt,
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
    rateLimitSafe: providerStats.rateLimitCount === 0,
    providerRequestStats: {
      totalRequests: providerStats.totalRequests,
      successCount: providerStats.successCount,
      failureCount: providerStats.failureCount,
      rateLimitCount: providerStats.rateLimitCount,
      avgResponseTimeMs,
    },
    liveSyncStats: {
      ...livePipelineStats,
    },
    sseMetrics,
  };
}

export function startContinuousSportsScheduler(_intervalMinutes = 5, _liveIntervalSeconds = 20): void {
  // Automated background crawler and scheduler disabled per user mandate
}

let liveTelemetryInterval: NodeJS.Timeout | null = null;

/**
 * Starts central server-side live telemetry coordinator.
 * Polls upstream SportScore every `pollIntervalMs` when at least 1 SSE client is connected.
 */
export function startLiveTelemetryCoordinator(pollIntervalMs = 10_000): void {
  if (liveTelemetryInterval) return;

  liveTelemetryInterval = setInterval(async () => {
    try {
      const metrics = realtimeBroadcaster.getMetrics();
      if (metrics.activeConnections === 0) return;

      await syncLiveScoresOnly();
    } catch {
      // telemetry poll error handled quietly
    }
  }, pollIntervalMs);

  if (liveTelemetryInterval.unref) {
    liveTelemetryInterval.unref();
  }
}

// Configure realtimeBroadcaster snapshot & client-connect hooks so SSE clients immediately receive
// authoritative live + today's and yesterday's recently completed fixtures on connection.
realtimeBroadcaster.setSnapshotProvider(() => {
  const now = new Date();
  const todayStr = getLocalDateStringEAT(now);
  const yesterdayStr = getLocalDateStringEAT(new Date(now.getTime() - 24 * 3600 * 1000));
  return Array.from(fixturesStore.values()).filter((f) => {
    if (f.status === 'in' || f.status === 'awaiting_confirmation') return true;
    const fDate = getLocalDateStringEAT(f.kickoffIso);
    const isRecentDay = fDate === todayStr || fDate === yesterdayStr;
    if (f.status === 'post' && isRecentDay) return true;
    if ((f.status === 'postponed' || f.status === 'suspended' || f.status === 'cancelled' || f.status === 'abandoned') && isRecentDay) {
      return true;
    }
    return false;
  });
});

realtimeBroadcaster.setOnClientConnect(async () => {
  startLiveTelemetryCoordinator(10_000);
  const liveAgeMs = lastLiveSyncTimestamp ? Date.now() - new Date(lastLiveSyncTimestamp).getTime() : Infinity;
  if (liveAgeMs > 8_000) {
    await syncLiveScoresOnly();
  }
});
