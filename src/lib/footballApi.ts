import {
  type MatchPeriod,
  type MatchStatus,
  AWAITING_CONFIRMATION_MINUTES,
  UNCONFIRMED_MATCH_MINUTES,
  parseDetailedMatchStatus,
  isStatusTransitionValid,
} from './matchStatus.js';
import { enrichFixturesWithBet365Odds } from './sportscoreOddsService.js';
import {
  findMatchingExistingFixture,
  areFixturesIdentical,
  extractSportScoreMatchSlug,
  extractSportScoreProviderId,
} from './fixtureIdentity.js';
import { realtimeClient } from './realtimeClient.js';
import { resolveCanonicalCompetition, isCompetitionEligible } from './canonicalCompetitions.js';
import { isHighlightsEligible } from './competitionPriority.js';

export interface HighlightFixture {
  id: string;
  providerId?: string;
  matchId?: string;
  matchSlug?: string;
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
  tier: 'blockbuster' | 'continental' | 'derby';
  blurb: string;
  homePct: number;
  drawPct: number;
  awayPct: number;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  bookmaker?: string;
  syncedAt: string;
  lastSyncTime?: string;
  status?: MatchStatus;
  period?: MatchPeriod;
  periodSequence?: number;
  displayClock?: string;
  minute?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeHtScore?: number | null;
  awayHtScore?: number | null;
  result?: '1' | 'X' | '2';
  bttsYesPct?: number;
  over15Pct?: number;
  over25Pct?: number;
  over35Pct?: number;
  incidents?: any[];
  latestGoalscorer?: any;
  updateVersion?: number;
}

export function parseAmericanToDecimalOdds(moneylineStr?: string | number): number | null {
  if (moneylineStr === undefined || moneylineStr === null) return null;
  const str = String(moneylineStr).trim();
  if (!str) return null;

  const floatVal = parseFloat(str);
  if (!Number.isNaN(floatVal) && floatVal > 1.01 && floatVal < 100 && !str.startsWith('+') && !str.startsWith('-')) {
    return +floatVal.toFixed(2);
  }

  const num = parseInt(str.replace('+', ''), 10);
  if (Number.isNaN(num) || num === 0) return null;

  if (num < 0) {
    return +(1 + 100 / Math.abs(num)).toFixed(2);
  } else {
    return +(1 + num / 100).toFixed(2);
  }
}

export function inferTier(leagueName: string, home: string, away: string): 'blockbuster' | 'continental' | 'derby' {
  const combined = `${leagueName} ${home} ${away}`.toLowerCase();
  if (combined.includes('champions') || combined.includes('europa') || combined.includes('conference') || combined.includes('libertadores') || combined.includes('caf')) {
    return 'continental';
  }
  if (combined.includes('derby') || combined.includes('clasico') || combined.includes('cup') || combined.includes('fa cup')) {
    return 'derby';
  }
  return 'blockbuster';
}

export function buildBlurb(home: string, away: string, competition: string, status?: string): string {
  if (status === 'in') {
    return `${home} vs ${away} is live right now in ${competition}! Track live crowd predictions as the action unfolds.`;
  }
  if (competition.toLowerCase().includes('champions')) {
    return `${home} and ${away} lock horns in a high-voltage ${competition} fixture with momentum and qualification on the line.`;
  }
  if (competition.toLowerCase().includes('premier') || competition.toLowerCase().includes('liga') || competition.toLowerCase().includes('serie')) {
    return `${home} host ${away} in a crucial league clash that could shift the table and shape punters' slips.`;
  }
  return `${home} face ${away} in an exciting ${competition} match-up attracting heavy debate from the community.`;
}

let cachedFixtures: HighlightFixture[] = [];
// IMPORTANT: Keep lastFetchedTime = 0 on initial module load so the first call to fetchDailyHighlightFixtures()
// always fetches fresh live/finished state from the backend rather than serving a stale localStorage snapshot.
let lastFetchedTime = 0;

export function sanitizeFrontendFixtureLifecycle<T extends {
  status?: MatchStatus;
  period?: MatchPeriod;
  periodSequence?: number;
  displayClock?: string;
  minute?: string;
  kickoffIso?: string;
  homeScore?: number | null;
  awayScore?: number | null;
}>(
  item: T,
  nowMs: number = Date.now(),
  awaitingThresholdMinutes: number = AWAITING_CONFIRMATION_MINUTES,
  unconfirmedThresholdMinutes: number = UNCONFIRMED_MATCH_MINUTES
): T {
  if (!item || typeof item !== 'object') return item;
  if (item.status === 'in' || item.status === 'awaiting_confirmation') {
    const kMs = item.kickoffIso ? Date.parse(item.kickoffIso) : NaN;
    const elapsedMin = Number.isFinite(kMs) ? (nowMs - kMs) / 60000 : Infinity;
    if (elapsedMin >= unconfirmedThresholdMinutes) {
      return {
        ...item,
        status: 'suspended',
        period: 'unconfirmed',
        periodSequence: 58,
        displayClock: 'UNCONFIRMED',
        minute: 'UNCONFIRMED',
        homeScore: item.homeScore ?? null,
        awayScore: item.awayScore ?? null,
      };
    }
    if (elapsedMin > awaitingThresholdMinutes) {
      return {
        ...item,
        status: 'awaiting_confirmation',
        period: 'awaiting_confirmation',
        periodSequence: 55,
        displayClock: 'Awaiting FT',
        minute: 'Awaiting FT',
        homeScore: item.homeScore ?? null,
        awayScore: item.awayScore ?? null,
      };
    }
  }
  return item;
}

const FOOTBALL_CACHE_KEY = 'mshindi_football_cache_v4';
const LEGACY_FOOTBALL_CACHE_KEY = 'mshindi_football_cache_v3';

// Hydrate initial state from localStorage for instant render while fresh network sync runs
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_FOOTBALL_CACHE_KEY);
  }
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(FOOTBALL_CACHE_KEY) : null;
  if (stored) {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const nowMs = Date.now();
      cachedFixtures = parsed
        .filter((item: any) => {
          if (!item || typeof item !== 'object' || !item.id) return false;
          const kMs = item.kickoffIso ? Date.parse(item.kickoffIso) : NaN;
          if (Number.isFinite(kMs) && nowMs - kMs > 7 * 86_400_000) return false;
          return true;
        })
        .map((item: any) => {
          if (!item.status || item.status === 'pre') {
            return {
              ...item,
              status: 'pre',
              period: 'scheduled',
              displayClock: '',
              minute: '',
              homeScore: null,
              awayScore: null,
            };
          }
          return sanitizeFrontendFixtureLifecycle(item, nowMs, AWAITING_CONFIRMATION_MINUTES);
        });
    }
  }
} catch {
  // ignore storage error
}

export function persistHighlightCacheToStorage(list: HighlightFixture[] = cachedFixtures): void {
  try {
    if (typeof localStorage !== 'undefined' && Array.isArray(list) && list.length > 0) {
      localStorage.setItem(FOOTBALL_CACHE_KEY, JSON.stringify(list));
    }
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Synchronizes `cachedFixtures` and `localStorage` whenever real-time SSE deltas or
 * authoritative match-detail updates are applied in `freeMatches.ts`.
 */
export function syncCachedFixturesFromRealtime(updatedFixtures: any[]): void {
  if (!Array.isArray(updatedFixtures) || updatedFixtures.length === 0) return;
  cachedFixtures = mergeHighlightFixtureLists(cachedFixtures, updatedFixtures as HighlightFixture[]);
  persistHighlightCacheToStorage(cachedFixtures);
}

export function getEffectiveMatchDayEAT(dateObj: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(dateObj);
  const p: Record<string, string> = {};
  parts.forEach((pt) => { p[pt.type] = pt.value; });

  let year = parseInt(p.year, 10);
  let month = parseInt(p.month, 10) - 1;
  let day = parseInt(p.day, 10);
  const hour = parseInt(p.hour, 10);

  if (hour < 3) {
    const prev = new Date(Date.UTC(year, month, day - 1));
    year = prev.getUTCFullYear();
    month = prev.getUTCMonth();
    day = prev.getUTCDate();
  }

  const yyyy = year.toString().padStart(4, '0');
  const mm = (month + 1).toString().padStart(2, '0');
  const dd = day.toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getLocalDateStringEAT(dateInput: Date | string | number = new Date()): string {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function getEffectiveMatchDayFormattedEAT(dateObj: Date = new Date()): string {
  const matchDayStr = getEffectiveMatchDayEAT(dateObj);
  const [y, m, d] = matchDayStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(utcDate);
}

/**
 * Legacy export retained for backward compatibility; routes through the authoritative backend `/api/sports/live` endpoint
 * so the browser never makes competing direct requests to SportScore.
 */
export async function fetchDirectSportScoreFixtures(): Promise<HighlightFixture[]> {
  return reconcileLiveFixturesFromBackend();
}

export function mergeHighlightFixtureLists(
  existingList: HighlightFixture[],
  incomingList: HighlightFixture[]
): HighlightFixture[] {
  const map = new Map<string, HighlightFixture>();
  for (const item of existingList) {
    if (item && item.id) map.set(item.id, item);
  }

  for (const inc of incomingList) {
    if (!inc || !inc.id) continue;
    const existing = map.get(inc.id) || findMatchingExistingFixture(inc, map.values());
    if (!existing) {
      map.set(inc.id, inc);
    } else {
      const exStatus: MatchStatus = existing.status || 'pre';
      const exPeriod: MatchPeriod = existing.period || (exStatus === 'post' ? 'full_time' : exStatus === 'in' ? 'first_half' : 'scheduled');
      const incStatus: MatchStatus = inc.status || 'pre';
      const incPeriod: MatchPeriod = inc.period || (incStatus === 'post' ? 'full_time' : incStatus === 'in' ? 'second_half' : 'scheduled');

      const isPermitted = isStatusTransitionValid(exStatus, exPeriod, incStatus, incPeriod);
      const status: MatchStatus = isPermitted ? incStatus : exStatus;
      const period: MatchPeriod = isPermitted ? incPeriod : exPeriod;

      let displayClock = existing.displayClock || existing.minute || '';
      if (status === 'post') {
        displayClock = period === 'after_penalties' ? 'AP' : period === 'after_extra_time' ? 'AET' : 'FT';
      } else if (status === 'pre') {
        displayClock = '';
      } else if (status === 'in' && isPermitted) {
        const incClock = inc.displayClock || inc.minute || '';
        const isExNumericMin = /^\d+(?:\+\d*)?'$/.test(displayClock);
        const isIncGeneric = ['1st half', '2nd half', 'live'].includes(incClock.toLowerCase());
        // Never keep 'HT' when advancing to second_half!
        if (isExNumericMin && isIncGeneric && exPeriod === period) {
          // keep numeric minute within same half
        } else {
          displayClock = incClock || (period === 'halftime' ? 'HT' : period === 'second_half' ? '2nd Half' : 'LIVE');
        }
      } else if (isPermitted) {
        displayClock =
          inc.displayClock ||
          inc.minute ||
          (status === 'awaiting_confirmation' ? 'Awaiting FT' : period === 'unconfirmed' ? 'UNCONFIRMED' : displayClock);
      }

      let homeScore = existing.homeScore;
      let awayScore = existing.awayScore;
      if (incStatus === 'in' || incStatus === 'post') {
        if (inc.homeScore !== undefined && inc.homeScore !== null && !Number.isNaN(Number(inc.homeScore))) {
          if (isPermitted || exStatus === incStatus) homeScore = Number(inc.homeScore);
        }
        if (inc.awayScore !== undefined && inc.awayScore !== null && !Number.isNaN(Number(inc.awayScore))) {
          if (isPermitted || exStatus === incStatus) awayScore = Number(inc.awayScore);
        }
      } else if (incStatus === 'pre' && exStatus === 'pre') {
        homeScore = null;
        awayScore = null;
      }

      const result: '1' | 'X' | '2' | undefined =
        status === 'post' && homeScore !== null && homeScore !== undefined && awayScore !== null && awayScore !== undefined
          ? homeScore > awayScore
            ? '1'
            : homeScore < awayScore
            ? '2'
            : 'X'
          : existing.result;

      map.set(existing.id, {
        ...existing,
        ...inc,
        id: existing.id,
        providerId: inc.providerId || existing.providerId,
        matchId: inc.matchId || existing.matchId || extractSportScoreProviderId(inc) || undefined,
        matchSlug: inc.matchSlug || existing.matchSlug || extractSportScoreMatchSlug(inc) || undefined,
        matchUrl: inc.matchUrl || existing.matchUrl,
        status,
        period,
        displayClock,
        minute: displayClock,
        homeScore,
        awayScore,
        homeHtScore: inc.homeHtScore ?? existing.homeHtScore,
        awayHtScore: inc.awayHtScore ?? existing.awayHtScore,
        result,
        incidents: (inc.incidents && inc.incidents.length > 0) ? inc.incidents : existing.incidents,
        latestGoalscorer: inc.latestGoalscorer || existing.latestGoalscorer,
        bookmaker: inc.bookmaker === 'Bet365' ? 'Bet365' : (existing.bookmaker || inc.bookmaker),
        homeOdds: existing.bookmaker === 'Bet365' && inc.bookmaker !== 'Bet365' ? existing.homeOdds : (inc.homeOdds || existing.homeOdds),
        drawOdds: existing.bookmaker === 'Bet365' && inc.bookmaker !== 'Bet365' ? existing.drawOdds : (inc.drawOdds || existing.drawOdds),
        awayOdds: existing.bookmaker === 'Bet365' && inc.bookmaker !== 'Bet365' ? existing.awayOdds : (inc.awayOdds || existing.awayOdds),
        homePct: existing.bookmaker === 'Bet365' && inc.bookmaker !== 'Bet365' ? existing.homePct : (inc.homePct || existing.homePct),
        drawPct: existing.bookmaker === 'Bet365' && inc.bookmaker !== 'Bet365' ? existing.drawPct : (inc.drawPct || existing.drawPct),
        awayPct: existing.bookmaker === 'Bet365' && inc.bookmaker !== 'Bet365' ? existing.awayPct : (inc.awayPct || existing.awayPct),
        over25Pct: existing.bookmaker === 'Bet365' && inc.bookmaker !== 'Bet365' ? existing.over25Pct : (inc.over25Pct ?? existing.over25Pct),
      });
    }
  }
  return Array.from(map.values());
}

function mapRawApiFixtureToHighlight(m: any, syncTimeLabel: string): HighlightFixture {
  const canon = resolveCanonicalCompetition({
    competition: m.competition,
    country: m.country,
    leagueCode: m.leagueCode,
    providerId: m.providerId || m.id,
  });
  const compName = m.competitionId && m.competition ? m.competition : canon.name;
  const tier = inferTier(compName, m.home, m.away);
  const blurb = buildBlurb(m.home, m.away, compName, m.status);
  const fid = m.id?.startsWith('mkt-') ? m.id : `mkt-${m.id || `${m.home}-${m.away}`.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const status: MatchStatus = m.status || 'pre';
  const displayClock =
    status === 'post'
      ? (m.period === 'after_penalties' ? 'AP' : m.period === 'after_extra_time' ? 'AET' : 'FT')
      : status === 'in'
      ? (m.displayClock || m.minute || 'LIVE')
      : status === 'pre'
      ? ''
      : (m.displayClock || '');

  return {
    id: fid,
    providerId: m.providerId || fid,
    matchId: m.matchId || extractSportScoreProviderId(m) || undefined,
    matchSlug: m.matchSlug || extractSportScoreMatchSlug(m) || undefined,
    matchUrl: m.matchUrl || m.url || undefined,
    home: m.home,
    away: m.away,
    homeLogo: m.homeLogo || m.home_logo,
    awayLogo: m.awayLogo || m.away_logo,
    competition: compName,
    competitionId: m.competitionId || canon.id,
    leagueCode: m.leagueCode,
    country: m.country || canon.country,
    kickoff: m.kickoff,
    kickoffIso: m.kickoffIso,
    tier,
    blurb,
    homePct: m.homePct,
    drawPct: m.drawPct,
    awayPct: m.awayPct,
    homeOdds: m.homeOdds,
    drawOdds: m.drawOdds,
    awayOdds: m.awayOdds,
    bookmaker: m.bookmaker || 'Market Consensus',
    syncedAt: `Live Consensus · ${syncTimeLabel}`,
    lastSyncTime: m.lastSyncTime || m.syncedAt,
    status,
    period: m.period,
    periodSequence: m.periodSequence,
    displayClock,
    minute: displayClock,
    homeScore: m.homeScore !== undefined ? m.homeScore : null,
    awayScore: m.awayScore !== undefined ? m.awayScore : null,
    homeHtScore: m.homeHtScore !== undefined ? m.homeHtScore : null,
    awayHtScore: m.awayHtScore !== undefined ? m.awayHtScore : null,
    bttsYesPct: m.bttsYesPct,
    over15Pct: m.over15Pct,
    over25Pct: m.over25Pct,
    over35Pct: m.over35Pct,
    incidents: m.incidents,
    latestGoalscorer: m.latestGoalscorer,
    updateVersion: m.updateVersion,
  };
}

/**
 * Reconciles active live fixtures and today's/yesterday's recently finished fixtures from `/api/sports/live`.
 * Also transitions any local `status === 'in'` fixture that is absent from the backend's authoritative live list
 * and has exceeded regulation match duration so finished matches never stay stuck in Live.
 */
export async function reconcileLiveFixturesFromBackend(): Promise<HighlightFixture[]> {
  try {
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.API_BASE_URL || 'http://localhost:3000');
    const signal =
      typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? AbortSignal.timeout(8000)
        : undefined;
    const res = await fetch(`${baseUrl}/api/sports/live`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
    if (!res.ok) return cachedFixtures;
    const data = await res.json();
    const syncTimeLabel = new Intl.DateTimeFormat('en', {
      timeZone: 'Africa/Nairobi',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    }).format(new Date()) + ' EAT';

    const rawLiveList = Array.isArray(data?.fixtures) ? data.fixtures : [];
    const rawFinishedList = Array.isArray(data?.recentlyFinished) ? data.recentlyFinished : [];
    const rawCombined = [...rawLiveList, ...rawFinishedList];

    const mappedLive = rawLiveList.map((m: any) => mapRawApiFixtureToHighlight(m, syncTimeLabel));
    if (rawCombined.length > 0) {
      const mapped = rawCombined.map((m: any) => mapRawApiFixtureToHighlight(m, syncTimeLabel));
      cachedFixtures = mergeHighlightFixtureLists(cachedFixtures, mapped);
    }

    // Reconcile any local fixture in 'in' or 'awaiting_confirmation' without fabricating FT
    if (data && data.success) {
      const nowMs = Date.now();
      let reconciledOrphan = false;
      cachedFixtures = cachedFixtures.map((f) => {
        if (f.status !== 'in' && f.status !== 'awaiting_confirmation') return f;
        const stillLiveOnBackend = mappedLive.some((lf) => lf.status === 'in' && areFixturesIdentical(f, lf));
        if (stillLiveOnBackend) return f;

        // Not actively 'in' on backend: transition >115m to 'awaiting_confirmation' (or >=240m to 'unconfirmed'), NEVER fake FT
        return sanitizeFrontendFixtureLifecycle(f, nowMs, AWAITING_CONFIRMATION_MINUTES);
      });
      reconciledOrphan = true;
      if (reconciledOrphan || rawCombined.length > 0) {
        persistHighlightCacheToStorage(cachedFixtures);
      }
    }
    return cachedFixtures;
  } catch {
    return cachedFixtures;
  }
}

export async function fetchDailyHighlightFixtures(force = false): Promise<HighlightFixture[]> {
  const hasLiveMatches = cachedFixtures.some((f) => f.status === 'in' || f.status === 'awaiting_confirmation');
  const cacheTtlMs = hasLiveMatches ? 6_000 : 25_000;

  if (!force && lastFetchedTime > 0 && cachedFixtures.length > 0 && Date.now() - lastFetchedTime < cacheTtlMs) {
    return cachedFixtures;
  }

  const syncTimeLabel = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Nairobi',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(new Date()) + ' EAT';

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 25000) : null;
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.API_BASE_URL || 'http://localhost:3000');
    const res = await fetch(`${baseUrl}/api/sports/daily-fixtures`, {
      ...(controller ? { signal: controller.signal } : {}),
      cache: 'no-store',
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.fixtures) && data.fixtures.length > 0) {
        const mapped: HighlightFixture[] = data.fixtures.map((m: any) =>
          mapRawApiFixtureToHighlight(m, syncTimeLabel)
        );

        if (mapped.length > 0) {
          const unenriched = mapped
            .filter(
              (f) =>
                isHighlightsEligible(f) &&
                f.status === 'pre' &&
                f.matchUrl &&
                f.bookmaker !== 'Bet365' &&
                (!((f as any).oddsUnavailableUntil > Date.now()))
            )
            .slice(0, 15);
          if (unenriched.length > 0) {
            try {
              await enrichFixturesWithBet365Odds(unenriched, 15, 5);
            } catch {}
          }
          cachedFixtures = mergeHighlightFixtureLists(cachedFixtures, mapped);

          // Any cached fixture still 'in' or 'awaiting_confirmation' beyond 115m without provider confirmation
          // enters non-terminal 'awaiting_confirmation' (or 'suspended'/'unconfirmed' at >=240m), NEVER synthetic 'FT'.
          const nowMs = Date.now();
          cachedFixtures = cachedFixtures.map((f) => {
            if (f.status !== 'in' && f.status !== 'awaiting_confirmation') return f;
            const inServerPayload = mapped.some((m) => areFixturesIdentical(f, m));
            if (!inServerPayload) {
              return sanitizeFrontendFixtureLifecycle(f, nowMs, AWAITING_CONFIRMATION_MINUTES);
            }
            return sanitizeFrontendFixtureLifecycle(f, nowMs, 160);
          });

          lastFetchedTime = Date.now();
          persistHighlightCacheToStorage(cachedFixtures);
          return cachedFixtures;
        }
      }
    }
  } catch (err) {
    console.warn('Market Consensus feed sync notice:', err);
  }

  return cachedFixtures;
}

let dailySyncStarted = false;

export function startDailyHighlightSync(onRefresh: () => Promise<unknown> | unknown) {
  if (dailySyncStarted) return;
  dailySyncStarted = true;

  let timerHandle: NodeJS.Timeout | null = null;

  const runCheck = async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      scheduleNext();
      return;
    }
    try {
      await Promise.resolve(onRefresh());
    } catch (err) {
      console.warn('Sync iteration error:', err);
    } finally {
      scheduleNext();
    }
  };

  const scheduleNext = () => {
    if (timerHandle) clearTimeout(timerHandle);
    const hasLive = cachedFixtures.some((f) => f.status === 'in');
    const timeSinceLastSseData = Date.now() - realtimeClient.getLastDataEventTime();

    // When SSE is connected and actively receiving data, use a 25s reconciliation cadence for live matches (60s otherwise)
    if (realtimeClient.isConnected() && timeSinceLastSseData < 25_000) {
      timerHandle = setTimeout(runCheck, hasLive ? 25_000 : 60_000);
      return;
    }

    // Fallback or staleness check: if live matches exist or SSE has had no data event in 25s, reconcile every 12s
    const delayMs = hasLive ? 12_000 : 35_000;
    timerHandle = setTimeout(runCheck, delayMs);
  };

  realtimeClient.onStateChange(() => {
    scheduleNext();
  });

  // Immediate initial check
  void runCheck();

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void runCheck();
      }
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      void runCheck();
    });

    window.addEventListener('focus', () => {
      if (Date.now() - lastFetchedTime > 10_000) {
        void runCheck();
      }
    });
  }
}
