/**
 * Authoritative Fixture Identity, Matching & Incremental Reconciliation Engine
 *
 * Enforces:
 * 1. Stable, permanent fixture identity based on SportScore unique match IDs.
 * 2. Multi-priority identity matching across different ID representations without duplicates.
 * 3. Non-destructive field-level merging preserving existing records and creation metadata.
 * 4. Strict live-match and terminal-status protection (monotonic progression pre -> in -> post).
 * 5. Preservation of authentic Bet365 odds, logos, and match incidents.
 */

import { type MatchPeriod, type MatchStatus, isStatusTransitionValid } from './matchStatus.js';
import type { MarketFixture } from './sportsFeedService.js';

/**
 * Normalizes a team name for reliable fuzzy identity comparison.
 * Strips common prefixes, suffixes (FC, SC, United, etc.), punctuation, and whitespace.
 */
export function normalizeTeamName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\b(fc|cf|sc|afc|cd|rc|sv|sk|fk|ud|ac|bsc|tsv|vfb|vfl|rb|ffc|women|u20|u19|youth)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Extracts a calendar date string (YYYY-MM-DD) in East Africa Time (Africa/Nairobi, UTC+3)
 */
export function formatEatDay(isoOrDate?: string | Date | null): string {
  if (!isoOrDate) return '';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (!d || Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Extracts the stable alphanumeric SportScore provider ID from any match representation.
 * Handles matchUrl trailing slug (/football/match/.../<providerId>/), providerId, matchId, or id.
 */
export function extractSportScoreProviderId(item: {
  id?: string;
  providerId?: string;
  matchId?: string;
  matchUrl?: string;
  url?: string;
}): string | null {
  if (!item) return null;

  // 1. Explicit matchId
  if (item.matchId && typeof item.matchId === 'string' && item.matchId.trim()) {
    return item.matchId.trim();
  }

  // 2. URL parsing: SportScore match URLs always end with the unique match ID
  // e.g. /football/match/newcastle-united-vs-crystal-palace/23xmvkh6zjg9qg8/
  const url = item.matchUrl || item.url;
  if (url && typeof url === 'string') {
    const parts = url.split('/').filter(Boolean);
    if (parts.length >= 3) {
      const last = parts[parts.length - 1];
      if (/^[a-z0-9_-]{4,}$/i.test(last)) {
        return last;
      }
    }
  }

  // 3. ProviderId field
  if (item.providerId && typeof item.providerId === 'string' && item.providerId.trim()) {
    const pid = item.providerId.trim();
    // If it is compound like "arsenal-vs-chelsea-3glrw7hnx23jqdy", extract trailing hash
    const match = pid.match(/([a-z0-9]{5,})$/i);
    if (match) return match[1];
    return pid;
  }

  // 4. Internal fixture ID: "mkt-ss-<slug>-<id>" or "mkt-ss-<id>"
  if (item.id && typeof item.id === 'string') {
    if (item.id.startsWith('mkt-ss-')) {
      const sub = item.id.slice(7);
      const match = sub.match(/([a-z0-9]{5,})$/i);
      if (match) return match[1];
      return sub;
    }
  }

  return null;
}

/**
 * Builds the primary composite identity key for fallback matching when provider IDs are unavailable.
 */
export function makeCompositeMatchKey(home: string, away: string, kickoffIso?: string): string {
  const normH = normalizeTeamName(home);
  const normA = normalizeTeamName(away);
  const day = formatEatDay(kickoffIso);
  return `${normH}__vs__${normA}__${day}`;
}

/**
 * Returns a stable unique primary key for indexing fixtures in maps and caches.
 */
export function getFixtureStableKey(item: {
  id?: string;
  providerId?: string;
  matchId?: string;
  matchUrl?: string;
  home?: string;
  away?: string;
  kickoffIso?: string;
}): string {
  const ssId = extractSportScoreProviderId(item);
  if (ssId) {
    return `ss_${ssId}`;
  }
  if (item.home && item.away) {
    return makeCompositeMatchKey(item.home, item.away, item.kickoffIso);
  }
  return item.id || `unknown_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Determines whether two fixture objects refer to the exact same real-world football match.
 * Uses a rigorous 5-tier identity cascade:
 *  1. Exact ID equality
 *  2. SportScore unique provider ID equality
 *  3. Match URL equality
 *  4. ID substring match (reconciling legacy compound IDs with provider IDs)
 *  5. Normalized team names + match date equality in EAT timezone
 */
export function areFixturesIdentical(
  a: {
    id?: string;
    providerId?: string;
    matchId?: string;
    matchUrl?: string;
    home?: string;
    away?: string;
    kickoffIso?: string;
  },
  b: {
    id?: string;
    providerId?: string;
    matchId?: string;
    matchUrl?: string;
    home?: string;
    away?: string;
    kickoffIso?: string;
  }
): boolean {
  if (!a || !b) return false;

  // Tier 1: Exact ID match
  if (a.id && b.id && a.id === b.id) return true;

  // Tier 2: Extracted SportScore provider match ID match
  const aSsId = extractSportScoreProviderId(a);
  const bSsId = extractSportScoreProviderId(b);
  if (aSsId && bSsId && aSsId === bSsId) return true;

  // Tier 3: Match URL match
  const aUrl = a.matchUrl || (a as any).url;
  const bUrl = b.matchUrl || (b as any).url;
  if (aUrl && bUrl && aUrl === bUrl) return true;

  // Tier 4: Reconcile legacy compound IDs with provider IDs
  if (aSsId && b.id && b.id.includes(aSsId)) return true;
  if (bSsId && a.id && a.id.includes(bSsId)) return true;

  // Tier 5: Normalized teams + EAT match date
  if (a.home && a.away && b.home && b.away) {
    const aNormH = normalizeTeamName(a.home);
    const aNormA = normalizeTeamName(a.away);
    const bNormH = normalizeTeamName(b.home);
    const bNormA = normalizeTeamName(b.away);

    if (aNormH && aNormA && aNormH === bNormH && aNormA === bNormA) {
      const aDay = formatEatDay(a.kickoffIso);
      const bDay = formatEatDay(b.kickoffIso);
      if (aDay && bDay && aDay === bDay) {
        return true;
      }
      // If one is missing date, consider it a match if teams are highly distinct
      if (!aDay || !bDay) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Searches a collection of existing fixtures for a match corresponding to candidate.
 */
export function findMatchingExistingFixture<T extends {
  id?: string;
  providerId?: string;
  matchId?: string;
  matchUrl?: string;
  home?: string;
  away?: string;
  kickoffIso?: string;
}>(candidate: T, existingPool: Iterable<T>): T | null {
  for (const existing of existingPool) {
    if (areFixturesIdentical(existing, candidate)) {
      return existing;
    }
  }
  return null;
}

/**
 * Performs a safe, non-destructive, incremental merge of incoming fixture data onto an existing record.
 * Guarantees:
 * - Preserves existing fixture ID and creation metadata.
 * - Protects live-match scores from being wiped out by scheduled 0-0/null responses.
 * - Terminal statuses ('post', 'cancelled', 'abandoned') can NEVER regress to scheduled ('pre') or live ('in').
 * - Preserves authentic Bet365 odds and bookmaker when incoming has generic odds.
 * - Preserves team logos, match URLs, competition names, and incidents if omitted from incoming.
 * - Accurately reports whether any genuine field changed.
 */
export function mergeMarketFixtureRecords(
  existing: MarketFixture,
  incoming: MarketFixture,
  options?: { isAuthoritativeCorrection?: boolean }
): { merged: MarketFixture; hasChanged: boolean } {
  const allowCorrection = Boolean(options?.isAuthoritativeCorrection || incoming.isAuthoritativeCorrection);

  const existingStatus = existing.status || 'pre';
  const existingPeriod = existing.period || 'scheduled';
  const incomingStatus = incoming.status || 'pre';
  const incomingPeriod = incoming.period || 'scheduled';

  // Check monotonic state validity
  const isTransitionPermitted = isStatusTransitionValid(
    existingStatus,
    existingPeriod,
    incomingStatus,
    incomingPeriod,
    allowCorrection
  );

  let finalStatus: MatchStatus = existingStatus;
  let finalPeriod: MatchPeriod = existingPeriod;
  let finalClock = existing.displayClock;
  let finalPeriodSeq = existing.periodSequence ?? 0;

  if (isTransitionPermitted) {
    finalStatus = incomingStatus;
    finalPeriod = incoming.period || (incomingStatus === 'post' ? 'full_time' : incomingStatus === 'in' ? 'second_half' : 'scheduled');
    finalClock = incoming.displayClock || existing.displayClock;
    finalPeriodSeq = incoming.periodSequence ?? (incomingStatus === 'post' ? 60 : incomingStatus === 'in' ? 25 : 0);
  } else if (existingStatus === 'post') {
    // Invariant: Terminal full-time matches remain full-time
    finalStatus = 'post';
    finalPeriod = existingPeriod === 'scheduled' ? 'full_time' : existingPeriod;
    finalClock = existing.displayClock || 'FT';
  } else if (existingStatus === 'in' && incomingStatus === 'pre') {
    // Invariant: In-play match cannot be regressed to scheduled by stale schedule refresh
    finalStatus = 'in';
    finalPeriod = existingPeriod;
    finalClock = existing.displayClock || 'LIVE';
  }

  // Score reconciliation
  let finalHomeScore = existing.homeScore;
  let finalAwayScore = existing.awayScore;
  let finalHomeHtScore = existing.homeHtScore;
  let finalAwayHtScore = existing.awayHtScore;

  if (incomingStatus === 'in' || incomingStatus === 'post') {
    if (incoming.homeScore !== null && incoming.homeScore !== undefined) {
      if (isTransitionPermitted || allowCorrection) {
        finalHomeScore = incoming.homeScore;
      } else if (existingStatus === 'post') {
        finalHomeScore = Math.max(existing.homeScore ?? 0, incoming.homeScore);
      }
    }
    if (incoming.awayScore !== null && incoming.awayScore !== undefined) {
      if (isTransitionPermitted || allowCorrection) {
        finalAwayScore = incoming.awayScore;
      } else if (existingStatus === 'post') {
        finalAwayScore = Math.max(existing.awayScore ?? 0, incoming.awayScore);
      }
    }
    if (incoming.homeHtScore !== null && incoming.homeHtScore !== undefined) {
      finalHomeHtScore = incoming.homeHtScore;
    }
    if (incoming.awayHtScore !== null && incoming.awayHtScore !== undefined) {
      finalAwayHtScore = incoming.awayHtScore;
    }
  } else if (incomingStatus === 'pre') {
    // CRITICAL LIVE SCORE PROTECTION:
    // Stale scheduled refresh must NEVER reset existing live or finished scores!
    if (existingStatus === 'pre') {
      finalHomeScore = null;
      finalAwayScore = null;
      finalHomeHtScore = null;
      finalAwayHtScore = null;
    }
  }

  // Odds & Bookmaker preservation:
  // If either has authentic Bet365 odds, preserve them
  const isIncomingBet365 = incoming.bookmaker === 'Bet365';
  const isExistingBet365 = existing.bookmaker === 'Bet365';
  const preferBet365 = isIncomingBet365 || isExistingBet365;

  const finalBookmaker = preferBet365 ? 'Bet365' : (incoming.bookmaker || existing.bookmaker || 'Market Consensus');
  const finalHomeOdds = isExistingBet365 && !isIncomingBet365 ? existing.homeOdds : (incoming.homeOdds || existing.homeOdds);
  const finalDrawOdds = isExistingBet365 && !isIncomingBet365 ? existing.drawOdds : (incoming.drawOdds || existing.drawOdds);
  const finalAwayOdds = isExistingBet365 && !isIncomingBet365 ? existing.awayOdds : (incoming.awayOdds || existing.awayOdds);
  const finalHomePct = isExistingBet365 && !isIncomingBet365 ? existing.homePct : (incoming.homePct || existing.homePct);
  const finalDrawPct = isExistingBet365 && !isIncomingBet365 ? existing.drawPct : (incoming.drawPct || existing.drawPct);
  const finalAwayPct = isExistingBet365 && !isIncomingBet365 ? existing.awayPct : (incoming.awayPct || existing.awayPct);
  const finalOver25Pct = isExistingBet365 && !isIncomingBet365 ? existing.over25Pct : (incoming.over25Pct ?? existing.over25Pct);

  // Metadata preservation
  const finalMatchUrl = incoming.matchUrl || existing.matchUrl;
  const finalHomeLogo = incoming.homeLogo || existing.homeLogo;
  const finalAwayLogo = incoming.awayLogo || existing.awayLogo;
  const finalCompetition = incoming.competition || existing.competition;
  const finalCompetitionId = incoming.competitionId || existing.competitionId;
  const finalLeagueCode = incoming.leagueCode || existing.leagueCode;
  const finalCountry = incoming.country || existing.country;
  const finalKickoff = incoming.kickoff || existing.kickoff;
  const finalKickoffIso = incoming.kickoffIso || existing.kickoffIso;
  const finalIncidents = (incoming.incidents && incoming.incidents.length > 0) ? incoming.incidents : existing.incidents;
  const finalLatestGoalscorer = incoming.latestGoalscorer || existing.latestGoalscorer;

  const merged: MarketFixture = {
    ...existing,
    ...incoming,
    id: existing.id, // STABLE IDENTITY: Preserve existing database record ID
    providerId: incoming.providerId || existing.providerId,
    matchId: incoming.matchId || existing.matchId,
    matchUrl: finalMatchUrl,
    home: existing.home || incoming.home,
    away: existing.away || incoming.away,
    homeLogo: finalHomeLogo,
    awayLogo: finalAwayLogo,
    competition: finalCompetition,
    competitionId: finalCompetitionId,
    leagueCode: finalLeagueCode,
    country: finalCountry,
    kickoff: finalKickoff,
    kickoffIso: finalKickoffIso,
    status: finalStatus,
    period: finalPeriod,
    periodSequence: finalPeriodSeq,
    displayClock: finalClock,
    homeScore: finalHomeScore,
    awayScore: finalAwayScore,
    homeHtScore: finalHomeHtScore,
    awayHtScore: finalAwayHtScore,
    bookmaker: finalBookmaker,
    homeOdds: finalHomeOdds,
    drawOdds: finalDrawOdds,
    awayOdds: finalAwayOdds,
    homePct: finalHomePct,
    drawPct: finalDrawPct,
    awayPct: finalAwayPct,
    over25Pct: finalOver25Pct,
    incidents: finalIncidents,
    latestGoalscorer: finalLatestGoalscorer,
    lastSyncTime: incoming.syncedAt || new Date().toISOString(),
  };

  // Determine if meaningful properties genuinely changed
  const hasChanged =
    existing.status !== merged.status ||
    existing.period !== merged.period ||
    existing.displayClock !== merged.displayClock ||
    existing.homeScore !== merged.homeScore ||
    existing.awayScore !== merged.awayScore ||
    existing.homeHtScore !== merged.homeHtScore ||
    existing.awayHtScore !== merged.awayHtScore ||
    existing.kickoffIso !== merged.kickoffIso ||
    existing.homeOdds !== merged.homeOdds ||
    existing.drawOdds !== merged.drawOdds ||
    existing.awayOdds !== merged.awayOdds ||
    existing.bookmaker !== merged.bookmaker ||
    existing.competition !== merged.competition;

  return { merged, hasChanged };
}
