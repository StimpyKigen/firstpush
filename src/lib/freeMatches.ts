import type { MatchConsensus } from './types.js';
import {
  type MatchPeriod,
  type MatchStatus,
  isStatusTransitionValid,
  parseDetailedMatchStatus,
} from './matchStatus.js';
import { buildConsensus } from './consensusEngine.js';
import {
  fetchDailyHighlightFixtures,
  reconcileLiveFixturesFromBackend,
  sanitizeFrontendFixtureLifecycle,
  syncCachedFixturesFromRealtime,
  type HighlightFixture,
} from './footballApi.js';
import {
  areFixturesIdentical,
  findMatchingExistingFixture,
  extractSportScoreProviderId,
  extractSportScoreMatchSlug,
} from './fixtureIdentity.js';
import { realtimeClient } from './realtimeClient.js';

const listeners = new Set<() => void>();

export type MatchTier = 'blockbuster' | 'continental' | 'derby';

export interface FreeMatch {
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
  tier: MatchTier;
  blurb: string;
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
  incidents?: MatchIncidentItem[];
  latestGoalscorer?: { player: string; minute: string; team: 'home' | 'away' } | any;
  updateVersion?: number;
}

export interface MatchIncidentItem {
  id?: string;
  time?: number | string;
  minute?: number | string;
  type: string;
  cardType?: 'yellow' | 'red';
  side?: 'home' | 'away';
  team?: 'home' | 'away';
  teamSide?: 'home' | 'away';
  player?: string;
  name?: string;
  assist?: string;
  scoreAfter?: string;
  is_goal?: boolean;
  is_card?: boolean;
  home_score?: number;
  away_score?: number;
}

function loadStoredMatches(): FreeMatch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('mshindi_football_cache_v3');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const nowMs = Date.now();
        return parsed
          .filter((m: any) => {
            if (!m || !m.id || m.id.startsWith('future_') || m.providerId === 'ars_che_001') return false;
            const kMs = m.kickoffIso ? Date.parse(m.kickoffIso) : NaN;
            if (Number.isFinite(kMs) && nowMs - kMs > 7 * 86_400_000) return false;
            return true;
          })
          .map((m: any) => sanitizeFrontendFixtureLifecycle(toFreeMatch(m), nowMs, 160));
      }
    }
  } catch {}
  return [];
}

function persistLiveMatchesToStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    if (liveMatches.length > 0) {
      localStorage.setItem('mshindi_football_cache_v3', JSON.stringify(liveMatches));
      syncCachedFixturesFromRealtime(liveMatches);
    }
  } catch {}
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

function emitFreeMatchesChange(persist = false) {
  freeMatchesSnapshot = [...liveMatches];
  freeMatchConsensusSnapshot = { ...liveConsensus };
  if (persist) {
    persistLiveMatchesToStorage();
  }
  listeners.forEach((listener) => listener());
}

/**
 * Helper to match an incoming SSE payload to a stored FreeMatch using full 5-tier identity matching.
 */
function matchesSseTarget(m: FreeMatch, payload: any, d: any): boolean {
  if (!m) return false;
  if (payload.fixtureId && m.id === payload.fixtureId) return true;
  if (payload.providerId && m.providerId === payload.providerId) return true;
  if (payload.matchSlug && m.matchSlug === payload.matchSlug) return true;
  return areFixturesIdentical(m, {
    id: payload.fixtureId || d?.id,
    providerId: payload.providerId || d?.providerId,
    matchSlug: payload.matchSlug || d?.matchSlug,
    matchUrl: d?.matchUrl || d?.url,
    home: d?.home,
    away: d?.away,
    kickoffIso: d?.kickoffIso,
  });
}

// Wire real-time delta pushes from SSE stream directly to reactive client store
if (typeof window !== 'undefined') {
  realtimeClient.on('live_snapshot', (payload) => {
    const d = payload.data || payload;
    const snapList: any[] = Array.isArray(d?.fixtures) ? d.fixtures : [];

    let changed = false;
    const incomingConverted: FreeMatch[] = [];
    for (const rawSnap of snapList) {
      const inc = toFreeMatch(rawSnap);
      incomingConverted.push(inc);
      const idx = liveMatches.findIndex((m) => areFixturesIdentical(m, inc));
      if (idx !== -1) {
        const merged = mergeFreeMatchPair(liveMatches[idx], inc);
        if (
          merged.status !== liveMatches[idx].status ||
          merged.period !== liveMatches[idx].period ||
          merged.displayClock !== liveMatches[idx].displayClock ||
          merged.homeScore !== liveMatches[idx].homeScore ||
          merged.awayScore !== liveMatches[idx].awayScore
        ) {
          liveMatches[idx] = merged;
          changed = true;
        }
      } else {
        liveMatches.unshift(inc);
        changed = true;
      }
    }

    // Reconcile any local fixture still marked 'in' that is NOT live in the authoritative SSE snapshot
    const nowMs = Date.now();
    liveMatches = liveMatches.map((m) => {
      if (m.status !== 'in') return m;
      const stillLiveInSnapshot = incomingConverted.some((inc) => inc.status === 'in' && areFixturesIdentical(m, inc));
      if (stillLiveInSnapshot) return m;
      const sanitized = sanitizeFrontendFixtureLifecycle(m, nowMs, 100);
      if (sanitized.status !== m.status) {
        changed = true;
      }
      return sanitized;
    });

    if (changed) {
      freeMatches.splice(0, freeMatches.length, ...liveMatches);
      emitFreeMatchesChange(true);
    }
  });

  realtimeClient.on('score_update', (payload) => {
    const d = payload.data || payload;
    let changed = false;
    liveMatches = liveMatches.map((m) => {
      if (matchesSseTarget(m, payload, d)) {
        const incStatus: MatchStatus = (d.status as MatchStatus) || m.status || 'in';
        const incPeriod: MatchPeriod = (d.period as MatchPeriod) || m.period || 'second_half';
        const isPermitted = isStatusTransitionValid(
          m.status || 'pre',
          m.period || 'scheduled',
          incStatus,
          incPeriod
        );
        const nextStatus = isPermitted ? incStatus : (m.status || incStatus);
        const nextPeriod = isPermitted ? incPeriod : (m.period || incPeriod);
        const nextClock =
          nextStatus === 'post'
            ? 'FT'
            : d.displayClock || (nextPeriod === 'halftime' ? 'HT' : m.displayClock);

        const nextHomeScore = d.homeScore !== undefined && d.homeScore !== null ? Number(d.homeScore) : m.homeScore;
        const nextAwayScore = d.awayScore !== undefined && d.awayScore !== null ? Number(d.awayScore) : m.awayScore;
        const nextHomeHt = d.homeHtScore !== undefined && d.homeHtScore !== null ? Number(d.homeHtScore) : m.homeHtScore;
        const nextAwayHt = d.awayHtScore !== undefined && d.awayHtScore !== null ? Number(d.awayHtScore) : m.awayHtScore;

        changed = true;
        return {
          ...m,
          homeScore: nextHomeScore,
          awayScore: nextAwayScore,
          homeHtScore: nextHomeHt,
          awayHtScore: nextAwayHt,
          displayClock: nextClock,
          minute: nextClock,
          period: nextPeriod,
          status: nextStatus,
          latestGoalscorer: d.latestGoalscorer || m.latestGoalscorer,
          updateVersion: d.updateVersion || ((m.updateVersion || 1) + 1),
        };
      }
      return m;
    });
    if (changed) {
      freeMatches.splice(0, freeMatches.length, ...liveMatches);
      emitFreeMatchesChange(true);
    }
  });

  realtimeClient.on('incident', (payload) => {
    const d = payload.data || payload;
    const inc = d.incident || d;
    if (!inc || typeof inc !== 'object') return;

    let changed = false;
    liveMatches = liveMatches.map((m) => {
      if (matchesSseTarget(m, payload, d)) {
        changed = true;
        const incidents = m.incidents ? [...m.incidents] : [];
        const incId = inc.id || `${inc.minute || inc.time}_${inc.type}_${inc.player || ''}`;
        if (!incidents.some((i) => (i.id || `${i.minute || i.time}_${i.type}_${i.player || ''}`) === incId)) {
          incidents.push(inc);
        }
        return {
          ...m,
          incidents,
          latestGoalscorer: d.latestGoalscorer || m.latestGoalscorer,
        };
      }
      return m;
    });
    if (changed) {
      freeMatches.splice(0, freeMatches.length, ...liveMatches);
      emitFreeMatchesChange(true);
    }
    try {
      window.dispatchEvent(
        new CustomEvent('match_incident_' + payload.fixtureId, {
          detail: inc,
        })
      );
    } catch {}
  });

  realtimeClient.on('status_change', (payload) => {
    const d = payload.data || payload;
    if (!d.status) return;

    let changed = false;
    liveMatches = liveMatches.map((m) => {
      if (matchesSseTarget(m, payload, d)) {
        const incStatus = d.status as MatchStatus;
        const incPeriod = (d.period as MatchPeriod) || (incStatus === 'post' ? 'full_time' : m.period || 'second_half');
        const isPermitted = isStatusTransitionValid(
          m.status || 'pre',
          m.period || 'scheduled',
          incStatus,
          incPeriod
        );
        if (!isPermitted) return m;

        const nextClock =
          incStatus === 'post'
            ? (incPeriod === 'after_penalties' ? 'AP' : incPeriod === 'after_extra_time' ? 'AET' : 'FT')
            : (d.displayClock || (incPeriod === 'halftime' ? 'HT' : incPeriod === 'second_half' ? '2nd Half' : m.displayClock));

        const nextHomeScore = d.homeScore !== undefined && d.homeScore !== null ? Number(d.homeScore) : m.homeScore;
        const nextAwayScore = d.awayScore !== undefined && d.awayScore !== null ? Number(d.awayScore) : m.awayScore;

        changed = true;
        return {
          ...m,
          status: incStatus,
          period: incPeriod,
          displayClock: nextClock,
          minute: nextClock,
          homeScore: nextHomeScore,
          awayScore: nextAwayScore,
          result: d.result || m.result,
          updateVersion: d.updateVersion || ((m.updateVersion || 1) + 1),
        };
      }
      return m;
    });
    if (changed) {
      freeMatches.splice(0, freeMatches.length, ...liveMatches);
      emitFreeMatchesChange(true);
    }
  });

  realtimeClient.on('odds_update', (payload) => {
    const d = payload.data || payload;
    let changed = false;
    liveMatches = liveMatches.map((m) => {
      if (matchesSseTarget(m, payload, d)) {
        changed = true;
        return {
          ...m,
          bookmaker: d.bookmaker || m.bookmaker,
          homeOdds: d.homeOdds !== undefined ? d.homeOdds : m.homeOdds,
          drawOdds: d.drawOdds !== undefined ? d.drawOdds : m.drawOdds,
          awayOdds: d.awayOdds !== undefined ? d.awayOdds : m.awayOdds,
        };
      }
      return m;
    });
    if (changed) {
      freeMatches.splice(0, freeMatches.length, ...liveMatches);
      emitFreeMatchesChange(true);
    }
  });

  realtimeClient.on('fixture_upsert', (payload) => {
    const d = payload.data || payload;
    const rawFixture = d.fixture || (payload as any).fixture;
    if (rawFixture) {
      const inc = toFreeMatch(rawFixture as any);
      const existingIdx = liveMatches.findIndex((m) => areFixturesIdentical(m, inc));
      if (existingIdx !== -1) {
        liveMatches[existingIdx] = mergeFreeMatchPair(liveMatches[existingIdx], inc);
      } else {
        liveMatches.unshift(inc);
      }
      freeMatches.splice(0, freeMatches.length, ...liveMatches);
      emitFreeMatchesChange(true);
    }
  });
}

export interface AuthoritativeMatchDetail {
  home?: string;
  away?: string;
  home_team?: string;
  away_team?: string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  home_ht_score?: number | string | null;
  away_ht_score?: number | string | null;
  status?: string;
  status_text?: string;
  live_minute?: number | string | null;
  url?: string;
  tracker?: { id?: string; profile?: string; sport?: string };
  incidents?: any[];
}

/**
 * Direct mirror from SportScore 2D pitch tracker / match detail.
 * Acts as the immediate source of truth for scores, minute counter, HT, and FT updates.
 */
export function updateMatchAuthoritativeDetail(matchId: string, detailInput: AuthoritativeMatchDetail): void {
  if (!detailInput || typeof detailInput !== 'object') return;
  const detail: AuthoritativeMatchDetail = (detailInput as any).match || detailInput;

  let changed = false;
  liveMatches = liveMatches.map((m) => {
    const isTarget =
      m.id === matchId ||
      areFixturesIdentical(m, {
        id: matchId,
        matchId: detail.tracker?.id,
        matchUrl: detail.url,
        home: detail.home || detail.home_team,
        away: detail.away || detail.away_team,
      });

    if (!isTarget) return m;

    const detailed = parseDetailedMatchStatus(detail.status, detail.status_text, detail.live_minute);
    const isPermitted = isStatusTransitionValid(
      m.status || 'pre',
      m.period || 'scheduled',
      detailed.status,
      detailed.period,
      true
    );

    const status = isPermitted ? detailed.status : (m.status || detailed.status);
    const period = isPermitted ? detailed.period : (m.period || detailed.period);
    const clock =
      status === 'post'
        ? (period === 'after_penalties' ? 'AP' : period === 'after_extra_time' ? 'AET' : 'FT')
        : detailed.displayClock || m.displayClock;

    const homeScore =
      detail.home_score !== undefined && detail.home_score !== null && detail.home_score !== ''
        ? Number(detail.home_score)
        : m.homeScore;
    const awayScore =
      detail.away_score !== undefined && detail.away_score !== null && detail.away_score !== ''
        ? Number(detail.away_score)
        : m.awayScore;

    const homeHtScore =
      detail.home_ht_score !== undefined && detail.home_ht_score !== null && detail.home_ht_score !== ''
        ? Number(detail.home_ht_score)
        : m.homeHtScore;
    const awayHtScore =
      detail.away_ht_score !== undefined && detail.away_ht_score !== null && detail.away_ht_score !== ''
        ? Number(detail.away_ht_score)
        : m.awayHtScore;

    changed = true;
    return {
      ...m,
      status,
      period,
      periodSequence: detailed.periodSequence,
      displayClock: clock,
      minute: clock,
      homeScore,
      awayScore,
      homeHtScore,
      awayHtScore,
    };
  });

  if (changed) {
    freeMatches.splice(0, freeMatches.length, ...liveMatches);
    emitFreeMatchesChange(true);
  }
}

function toFreeMatch(item: HighlightFixture | any): FreeMatch {
  const status: MatchStatus = item.status || 'pre';
  const displayClock =
    status === 'post'
      ? (item.period === 'after_penalties' ? 'AP' : item.period === 'after_extra_time' ? 'AET' : 'FT')
      : status === 'in'
      ? (item.displayClock || item.minute || 'LIVE')
      : status === 'pre'
      ? ''
      : (item.displayClock || '');
  const homeScore = status === 'pre' ? null : item.homeScore;
  const awayScore = status === 'pre' ? null : item.awayScore;

  return {
    id: item.id,
    providerId: item.providerId || item.id,
    matchId: item.matchId || extractSportScoreProviderId(item) || undefined,
    matchSlug: item.matchSlug || extractSportScoreMatchSlug(item) || undefined,
    matchUrl: item.matchUrl || item.url,
    home: item.home,
    away: item.away,
    homeLogo: item.homeLogo || item.home_logo,
    awayLogo: item.awayLogo || item.away_logo,
    competition: item.competition,
    competitionId: item.competitionId,
    leagueCode: item.leagueCode,
    country: item.country,
    kickoff: item.kickoff,
    kickoffIso: item.kickoffIso,
    tier: item.tier || 'blockbuster',
    blurb: item.blurb || `${item.home} vs ${item.away} in ${item.competition}`,
    syncedAt: item.syncedAt || new Date().toISOString(),
    lastSyncTime: item.lastSyncTime,
    status,
    period: item.period,
    periodSequence: item.periodSequence,
    displayClock,
    minute: displayClock,
    homeScore,
    awayScore,
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
    incidents: item.incidents,
    latestGoalscorer: item.latestGoalscorer,
    updateVersion: item.updateVersion,
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

export function makeFreeMatchDedupeKey(m: {
  id?: string;
  providerId?: string;
  matchId?: string;
  matchUrl?: string;
  home: string;
  away: string;
  kickoffIso?: string;
  kickoff?: string;
}): string {
  const ssId = extractSportScoreProviderId(m);
  if (ssId) {
    return `mid_${ssId}`;
  }
  const h = (m.home || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = (m.away || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let dateKey = '';
  if (m.kickoffIso) {
    const isoM = m.kickoffIso.match(/^\d{4}-(\d{2})-(\d{2})/);
    if (isoM) {
      dateKey = `${isoM[2]}_${isoM[1]}`;
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

function mergeFreeMatchPair(existing: FreeMatch, incoming: FreeMatch): FreeMatch {
  const existingStatus = existing.status || 'pre';
  const existingPeriod = existing.period || (existingStatus === 'post' ? 'full_time' : existingStatus === 'in' ? 'first_half' : 'scheduled');
  const incomingStatus = incoming.status || 'pre';
  const incomingPeriod = incoming.period || (incomingStatus === 'post' ? 'full_time' : incomingStatus === 'in' ? 'second_half' : 'scheduled');

  const isPermitted = isStatusTransitionValid(
    existingStatus,
    existingPeriod,
    incomingStatus,
    incomingPeriod
  );

  let finalStatus: MatchStatus = isPermitted ? incomingStatus : existingStatus;
  let finalPeriod: MatchPeriod = isPermitted ? incomingPeriod : existingPeriod;

  if (existingStatus === 'post' && incomingStatus !== 'post') {
    finalStatus = 'post';
    finalPeriod = existingPeriod === 'scheduled' ? 'full_time' : existingPeriod;
  }

  let finalClock = existing.displayClock || existing.minute || '';
  if (finalStatus === 'post') {
    finalClock = finalPeriod === 'after_penalties' ? 'AP' : finalPeriod === 'after_extra_time' ? 'AET' : 'FT';
  } else if (finalStatus === 'pre') {
    finalClock = '';
  } else if (finalStatus === 'in' && isPermitted) {
    const incClock = incoming.displayClock || incoming.minute || '';
    const isExNumericMin = /^\d+(?:\+\d*)?'$/.test(finalClock);
    const isIncGeneric = ['1st half', '2nd half', 'live'].includes(incClock.toLowerCase());
    // Never keep 'HT' when match advances to 'second_half'!
    if (isExNumericMin && isIncGeneric && existingPeriod === finalPeriod) {
      // keep numeric minute within same half
    } else {
      finalClock = incClock || (finalPeriod === 'halftime' ? 'HT' : finalPeriod === 'second_half' ? '2nd Half' : 'LIVE');
    }
  }

  let finalHomeScore = existing.homeScore;
  let finalAwayScore = existing.awayScore;
  if (incomingStatus === 'in' || incomingStatus === 'post') {
    if (incoming.homeScore !== null && incoming.homeScore !== undefined && !Number.isNaN(Number(incoming.homeScore))) {
      if (isPermitted || existingStatus === incomingStatus) finalHomeScore = Number(incoming.homeScore);
    }
    if (incoming.awayScore !== null && incoming.awayScore !== undefined && !Number.isNaN(Number(incoming.awayScore))) {
      if (isPermitted || existingStatus === incomingStatus) finalAwayScore = Number(incoming.awayScore);
    }
  } else if (incomingStatus === 'pre' && existingStatus === 'pre') {
    finalHomeScore = null;
    finalAwayScore = null;
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
    id: existing.id,
    matchUrl: finalMatchUrl,
    matchSlug: incoming.matchSlug || existing.matchSlug,
    matchId: incoming.matchId || existing.matchId,
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
    minute: finalClock,
    homeScore: finalHomeScore,
    awayScore: finalAwayScore,
    homeHtScore: incoming.homeHtScore ?? existing.homeHtScore,
    awayHtScore: incoming.awayHtScore ?? existing.awayHtScore,
    incidents: (incoming.incidents && incoming.incidents.length > 0) ? incoming.incidents : existing.incidents,
    latestGoalscorer: incoming.latestGoalscorer || existing.latestGoalscorer,
  };
}

export async function refreshFreeMatches(force = false) {
  if (!hasSyncedFreeMatchesOnce && liveMatches.length === 0) {
    isSyncingFreeMatches = true;
    emitFreeMatchesChange();
  }

  try {
    // If we currently have live matches, also reconcile directly against `/api/sports/live`
    if (liveMatches.some((m) => m.status === 'in')) {
      try {
        await reconcileLiveFixturesFromBackend();
      } catch {}
    }

    const highlightFixtures = await fetchDailyHighlightFixtures(force);
    const convertedHighlights = highlightFixtures.map((fixture) => toFreeMatch(fixture));

    const persistedFixtures = loadStoredMatches();
    const baseList: FreeMatch[] = [];
    for (const m of persistedFixtures) {
      if (!m.id?.startsWith('future_') && m.providerId !== 'ars_che_001') {
        baseList.push(m);
      }
    }
    for (const m of liveMatches) {
      if (m.id?.startsWith('future_') || m.providerId === 'ars_che_001') continue;
      const existingIdx = baseList.findIndex(
        (b) => makeFreeMatchDedupeKey(b) === makeFreeMatchDedupeKey(m) || areFixturesIdentical(b, m)
      );
      if (existingIdx !== -1) {
        baseList[existingIdx] = mergeFreeMatchPair(baseList[existingIdx], m);
      } else {
        baseList.push(m);
      }
    }

    const nowMs = Date.now();
    const mergedList: FreeMatch[] = [];

    if (convertedHighlights.length > 0) {
      const matchedStoredIndices = new Set<number>();

      for (const m of convertedHighlights) {
        const matchIdx = baseList.findIndex(
          (b, idx) =>
            !matchedStoredIndices.has(idx) &&
            (makeFreeMatchDedupeKey(b) === makeFreeMatchDedupeKey(m) || areFixturesIdentical(b, m))
        );
        if (matchIdx !== -1) {
          matchedStoredIndices.add(matchIdx);
          mergedList.push(
            sanitizeFrontendFixtureLifecycle(mergeFreeMatchPair(baseList[matchIdx], m), nowMs, 160)
          );
        } else {
          mergedList.push(sanitizeFrontendFixtureLifecycle(m, nowMs, 160));
        }
      }

      // Retain non-expired historical fixtures from baseList that were not in convertedHighlights,
      // while sanitizing any orphaned 'in' fixture (>= 115m post-kickoff) to 'post' (FT)
      for (let idx = 0; idx < baseList.length; idx++) {
        if (matchedStoredIndices.has(idx)) continue;
        const m = baseList[idx];
        // Also ensure it doesn't duplicate anything already in mergedList
        if (mergedList.some((existing) => areFixturesIdentical(existing, m))) continue;

        const kickoffMs = Date.parse(m.kickoffIso || '');
        const isExpired = Number.isFinite(kickoffMs) && nowMs - kickoffMs > 7 * 86_400_000;
        if (!isExpired) {
          mergedList.push(sanitizeFrontendFixtureLifecycle(m, nowMs, 115));
        }
      }
    } else {
      for (const m of baseList) {
        mergedList.push(sanitizeFrontendFixtureLifecycle(m, nowMs, 160));
      }
    }

    if (mergedList.length > 0) {
      liveMatches = mergedList;
      liveConsensus = Object.fromEntries(
        liveMatches.map((match, index) => [
          match.id,
          buildConsensus(match.id, index * 17 + 7, match.homePct || 33, match.drawPct || 34),
        ]),
      ) as Record<string, MatchConsensus>;

      persistLiveMatchesToStorage();
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
  emitFreeMatchesChange(true);

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
    emitFreeMatchesChange(true);
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
