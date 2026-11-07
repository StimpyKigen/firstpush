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

import { type MatchPeriod, type MatchStatus, isStatusTransitionValid, parseDetailedMatchStatus } from './matchStatus.js';
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
 * Extracts the clean SportScore match slug (e.g. "sao-paulo-vs-sport-club-corinthians-paulista")
 * required by https://sportscore.com/api/widget/match/?sport=football&slug=<matchSlug>.
 * Strips any trailing alphanumeric match hash ID so the widget endpoint never 404s.
 */
function stripTrailingSportScoreHash(slug: string): string {
  const trimmed = slug.trim().replace(/^mkt-ss-/i, '');
  // A SportScore match hash ID is 12-20 alphanumeric chars containing BOTH letters and digits,
  // appended after the '<home>-vs-<away>' slug.
  const match = trimmed.match(/^(.+-vs-.+)-(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{12,20}$/i);
  return match ? match[1] : trimmed;
}

export function extractSportScoreMatchSlug(item: {
  id?: string;
  providerId?: string;
  matchId?: string;
  matchSlug?: string;
  matchUrl?: string;
  url?: string;
  home?: string;
  away?: string;
}): string | null {
  if (!item) return null;

  // 1. Canonical SportScore match URL: /football/match/<matchSlug>/<hashId>/
  const url = item.matchUrl || item.url;
  if (url && typeof url === 'string') {
    const parts = url.split('/').filter(Boolean);
    // parts = ['football', 'match', '<matchSlug>', '<hashId>']
    if (parts.length >= 3 && parts[0] === 'football' && parts[1] === 'match') {
      return parts[2];
    }
    const vsPart = parts.find((p) => p.includes('-vs-'));
    if (vsPart) {
      return stripTrailingSportScoreHash(vsPart);
    }
  }

  // 2. Explicit matchSlug
  if (item.matchSlug && typeof item.matchSlug === 'string' && item.matchSlug.trim()) {
    return stripTrailingSportScoreHash(item.matchSlug);
  }

  // 3. ProviderId or ID that contains -vs- (strip trailing hash if compound)
  for (const raw of [item.providerId, item.id]) {
    if (raw && typeof raw === 'string' && raw.includes('-vs-')) {
      const cleaned = stripTrailingSportScoreHash(raw);
      if (cleaned.includes('-vs-')) {
        return cleaned;
      }
    }
  }

  // 4. Fallback from home and away team names
  if (item.home && item.away) {
    const slugify = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const h = slugify(item.home);
    const a = slugify(item.away);
    if (h && a) return `${h}-vs-${a}`;
  }

  return null;
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
    if (parts.length >= 4 && parts[0] === 'football' && parts[1] === 'match') {
      return parts[3];
    }
    if (parts.length >= 3) {
      const last = parts[parts.length - 1];
      if (/^[a-z0-9_-]{4,}$/i.test(last) && !last.includes('-vs-')) {
        return last;
      }
    }
  }

  // 3. ProviderId field
  if (item.providerId && typeof item.providerId === 'string' && item.providerId.trim()) {
    const pid = item.providerId.trim();
    // If it is compound like "arsenal-vs-chelsea-3glrw7hnx23jqdy", extract trailing hash
    const trailingMatch = pid.match(/-([a-z0-9]{10,20})$/i);
    if (trailingMatch) return trailingMatch[1];
    const leadingMatch = pid.match(/^([a-z0-9]{10,20})-/i);
    if (leadingMatch) return leadingMatch[1];
    return pid;
  }

  // 4. Internal fixture ID: "mkt-ss-<slug>-<id>" or "mkt-ss-<id>-<slug>"
  if (item.id && typeof item.id === 'string') {
    if (item.id.startsWith('mkt-ss-')) {
      const sub = item.id.slice(7);
      const trailingMatch = sub.match(/-([a-z0-9]{10,20})$/i);
      if (trailingMatch) return trailingMatch[1];
      const leadingMatch = sub.match(/^([a-z0-9]{10,20})-/i);
      if (leadingMatch) return leadingMatch[1];
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
 *  3. Match URL or Match Slug equality
 *  4. ID substring match (reconciling legacy compound IDs with provider IDs)
 *  5. Normalized team names + match date equality in EAT timezone
 */
export function areFixturesIdentical(
  a: {
    id?: string;
    providerId?: string;
    matchId?: string;
    matchSlug?: string;
    matchUrl?: string;
    home?: string;
    away?: string;
    kickoffIso?: string;
  },
  b: {
    id?: string;
    providerId?: string;
    matchId?: string;
    matchSlug?: string;
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
  if (aSsId && aSsId.length >= 8 && b.id && b.id.includes(aSsId)) return true;
  if (bSsId && bSsId.length >= 8 && a.id && a.id.includes(bSsId)) return true;
  if (aSsId && aSsId.length >= 8 && b.providerId && b.providerId.includes(aSsId)) return true;
  if (bSsId && bSsId.length >= 8 && a.providerId && a.providerId.includes(bSsId)) return true;

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
  matchSlug?: string;
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

/** Epoch ms of the provider observation a fixture record reflects (0 when unknown). */
export function resolveObservedMs(f: { observedAtMs?: number; syncedAt?: string; lastSyncTime?: string }): number {
  if (typeof f.observedAtMs === 'number' && Number.isFinite(f.observedAtMs) && f.observedAtMs > 0) return f.observedAtMs;
  const t = Date.parse(f.syncedAt || f.lastSyncTime || '');
  return Number.isFinite(t) ? t : 0;
}

/** Additive, idempotent incident merge keyed by stable incident ID (never drops known events). */
function unionIncidentsById(
  existing: MarketFixture['incidents'],
  incoming: MarketFixture['incidents']
): MarketFixture['incidents'] {
  if (!incoming || incoming.length === 0) return existing;
  if (!existing || existing.length === 0) return incoming;
  const seen = new Set(existing.map((i) => i.id));
  const additions = incoming.filter((i) => !seen.has(i.id));
  return additions.length > 0 ? [...existing, ...additions] : existing;
}
/**
 * Performs a safe, non-destructive, incremental merge of incoming fixture data onto an existing record.
 * Guarantees:
 * - Preserves existing fixture ID and creation metadata.
 * - Protects live-match scores from being wiped out by scheduled 0-0/null responses.
 * - Terminal statuses ('post', 'cancelled', 'abandoned') can NEVER regress to scheduled ('pre') or live ('in').
 * - Never locks displayClock on 'HT' when a match advances to 'second_half' or 'post' ('FT').
 * - Preserves authentic Bet365 odds and bookmaker when incoming has generic odds.
 * - Preserves team logos, match URLs, competition names, and incidents if omitted from incoming.
 * - Accurately reports whether any genuine field changed.
 */
export function mergeMarketFixtureRecords(
  existing: MarketFixture,
  incoming: MarketFixture,
  options?: { isAuthoritativeCorrection?: boolean }
): { merged: MarketFixture; hasChanged: boolean; rejectedStaleTransition?: boolean } {
  const incomingObservedMs = resolveObservedMs(incoming);
  const existingObservedMs = resolveObservedMs(existing);

  // LIVE-DATA PROTECTION (permanent invariant): a response that was observed EARLIER than the
  // data we already hold (stale snapshot, late-arriving fetch, schedule refresh, out-of-order
  // provider reply) may enrich metadata but can NEVER overwrite status, period, clock, scores or
  // incident history. An explicit authoritative correction (e.g. cold-snapshot zombie recovery)
  // is the only way to bypass this.
  const isStaleObservation =
    !incoming.isAuthoritativeCorrection &&
    incomingObservedMs > 0 &&
    existingObservedMs > 0 &&
    incomingObservedMs < existingObservedMs;

  const allowCorrection =
    !isStaleObservation && Boolean(options?.isAuthoritativeCorrection || incoming.isAuthoritativeCorrection);

  const existingDetailed = parseDetailedMatchStatus(existing.status, existing.displayClock || existing.minute);
  const incomingDetailed = parseDetailedMatchStatus(incoming.status, incoming.displayClock || incoming.minute);

  const existingStatus = existing.status || existingDetailed.status;
  const existingPeriod = existing.period || existingDetailed.period;
  const incomingStatus = incoming.status || incomingDetailed.status;
  const incomingPeriod =
    incoming.period && incoming.period !== existing.period
      ? incoming.period
      : incomingDetailed.period || incoming.period;

  // Check monotonic state validity
  const isTransitionPermitted =
    !isStaleObservation &&
    isStatusTransitionValid(
      existingStatus,
      existingPeriod,
      incomingStatus,
      incomingPeriod,
      allowCorrection
    );

  let finalStatus: MatchStatus = existingStatus;
  let finalPeriod: MatchPeriod = existingPeriod;
  let finalClock = existing.displayClock || existing.minute || '';
  let finalMinute = existing.minute || existing.displayClock || '';
  let finalPeriodSeq = existing.periodSequence ?? 0;

  if (isTransitionPermitted) {
    finalStatus = incomingStatus;
    finalPeriod = incomingPeriod || (incomingStatus === 'post' ? 'full_time' : incomingStatus === 'in' ? 'second_half' : 'scheduled');
    finalPeriodSeq = incoming.periodSequence ?? incomingDetailed.periodSequence ?? (incomingStatus === 'post' ? 60 : incomingStatus === 'in' ? 25 : 0);

    if (finalStatus === 'post') {
      const terminalBadge =
        finalPeriod === 'after_penalties' ? 'AP' :
        finalPeriod === 'after_extra_time' ? 'AET' :
        finalPeriod === 'awarded' ? 'AWR' : 'FT';
      finalClock = terminalBadge;
      finalMinute = terminalBadge;
    } else if (finalStatus === 'in') {
      const existingClock = existing.displayClock || existing.minute || '';
      const incomingClock = incoming.displayClock || incoming.minute || '';

      // Only preserve an existing numeric minute (e.g. "67'") over a generic period label ("2nd Half")
      // when BOTH belong to the exact same period. NEVER preserve 'HT' when advancing to 'second_half'!
      const isExistingNumericMin = /^\d+(?:\+\d*)?'$/.test(existingClock);
      const isIncomingGenericLabel = ['1st half', '2nd half', 'live'].includes(incomingClock.toLowerCase());

      if (isExistingNumericMin && isIncomingGenericLabel && existingPeriod === finalPeriod) {
        finalClock = existingClock;
        finalMinute = existingClock;
      } else {
        finalClock = incomingClock || (finalPeriod === 'halftime' ? 'HT' : finalPeriod === 'second_half' ? '2nd Half' : '1st Half');
        finalMinute = incoming.minute || finalClock;
      }
    } else if (finalStatus === 'awaiting_confirmation') {
      finalClock = incoming.displayClock || 'Awaiting FT';
      finalMinute = incoming.minute || finalClock;
    } else if (finalStatus === 'suspended' && finalPeriod === 'unconfirmed') {
      finalClock = 'UNCONFIRMED';
      finalMinute = 'UNCONFIRMED';
    } else {
      finalClock = incoming.displayClock || '';
      finalMinute = incoming.minute || '';
    }
  } else if (existingStatus === 'post') {
    // Invariant: Terminal full-time matches remain full-time and never revert to HT, live, or awaiting_confirmation
    finalStatus = 'post';
    finalPeriod = existingPeriod === 'scheduled' ? 'full_time' : existingPeriod;
    finalClock = existing.displayClock && existing.displayClock !== 'HT' ? existing.displayClock : 'FT';
    finalMinute = finalClock;
  } else if ((existingStatus === 'in' || existingStatus === 'awaiting_confirmation') && incomingStatus === 'pre') {
    // Invariant: In-play or awaiting-confirmation match cannot be regressed to scheduled by stale schedule refresh
    finalStatus = existingStatus;
    finalPeriod = existingPeriod;
    finalClock = existing.displayClock || (existingStatus === 'awaiting_confirmation' ? 'Awaiting FT' : 'LIVE');
    finalMinute = existing.minute || finalClock;
  }

  // Score reconciliation
  let finalHomeScore = existing.homeScore;
  let finalAwayScore = existing.awayScore;
  let finalHomeHtScore = existing.homeHtScore;
  let finalAwayHtScore = existing.awayHtScore;

  if (!isStaleObservation && (incomingStatus === 'in' || incomingStatus === 'post')) {
    if (incoming.homeScore !== null && incoming.homeScore !== undefined && !Number.isNaN(Number(incoming.homeScore))) {
      if (isTransitionPermitted || allowCorrection) {
        finalHomeScore = Number(incoming.homeScore);
      } else if (existingStatus === 'post' && incomingStatus === 'post' && !isStaleObservation) {
        finalHomeScore = Number(incoming.homeScore);
      }
    }
    if (incoming.awayScore !== null && incoming.awayScore !== undefined && !Number.isNaN(Number(incoming.awayScore))) {
      if (isTransitionPermitted || allowCorrection) {
        finalAwayScore = Number(incoming.awayScore);
      } else if (existingStatus === 'post' && incomingStatus === 'post' && !isStaleObservation) {
        finalAwayScore = Number(incoming.awayScore);
      }
    }
    if (incoming.homeHtScore !== null && incoming.homeHtScore !== undefined && !Number.isNaN(Number(incoming.homeHtScore))) {
      finalHomeHtScore = Number(incoming.homeHtScore);
    }
    if (incoming.awayHtScore !== null && incoming.awayHtScore !== undefined && !Number.isNaN(Number(incoming.awayHtScore))) {
      finalAwayHtScore = Number(incoming.awayHtScore);
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
  const finalMatchSlug =
    incoming.matchSlug ||
    existing.matchSlug ||
    extractSportScoreMatchSlug({
      matchUrl: finalMatchUrl,
      providerId: incoming.providerId || existing.providerId,
      id: existing.id,
      home: existing.home || incoming.home,
      away: existing.away || incoming.away,
    }) ||
    undefined;
  const finalMatchId =
    incoming.matchId ||
    existing.matchId ||
    extractSportScoreProviderId({
      matchUrl: finalMatchUrl,
      providerId: incoming.providerId || existing.providerId,
      id: existing.id,
    }) ||
    undefined;

  const finalHomeLogo = incoming.homeLogo || existing.homeLogo;
  const finalAwayLogo = incoming.awayLogo || existing.awayLogo;
  const finalCompetition = incoming.competition || existing.competition;
  const finalCompetitionId = incoming.competitionId || existing.competitionId;
  const finalLeagueCode = incoming.leagueCode || existing.leagueCode;
  const finalCountry = incoming.country || existing.country;
  const finalKickoff = incoming.kickoff || existing.kickoff;
  const finalKickoffIso = incoming.kickoffIso || existing.kickoffIso;
  const finalIncidents = isStaleObservation
    ? unionIncidentsById(existing.incidents, incoming.incidents)
    : (incoming.incidents && incoming.incidents.length > 0) ? incoming.incidents : existing.incidents;
  const finalLatestGoalscorer = isStaleObservation
    ? existing.latestGoalscorer || incoming.latestGoalscorer
    : incoming.latestGoalscorer || existing.latestGoalscorer;

  const merged: MarketFixture = {
    ...existing,
    ...incoming,
    id: existing.id, // STABLE IDENTITY: Preserve existing database record ID
    providerId: incoming.providerId || existing.providerId,
    matchId: finalMatchId,
    matchSlug: finalMatchSlug,
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
    minute: finalMinute,
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
    observedAtMs: Math.max(incomingObservedMs, existingObservedMs) || undefined,
  };

  // Determine if meaningful properties genuinely changed
  const hasChanged =
    existing.status !== merged.status ||
    existing.period !== merged.period ||
    existing.displayClock !== merged.displayClock ||
    existing.minute !== merged.minute ||
    existing.homeScore !== merged.homeScore ||
    existing.awayScore !== merged.awayScore ||
    existing.homeHtScore !== merged.homeHtScore ||
    existing.awayHtScore !== merged.awayHtScore ||
    (incoming.incidents?.length || 0) > (existing.incidents?.length || 0) ||
    (merged.incidents?.length || 0) !== (existing.incidents?.length || 0) ||
    (merged.incidents?.length || 0) !== (existing.incidents?.length || 0) ||
    existing.latestGoalscorer?.minute !== merged.latestGoalscorer?.minute ||
    existing.kickoffIso !== merged.kickoffIso ||
    existing.homeOdds !== merged.homeOdds ||
    existing.drawOdds !== merged.drawOdds ||
    existing.awayOdds !== merged.awayOdds ||
    existing.bookmaker !== merged.bookmaker ||
    existing.competition !== merged.competition;

  if (hasChanged) {
    merged.updateVersion = (existing.updateVersion || 1) + 1;
    merged.recordUpdateTime = Date.now();
  } else {
    merged.updateVersion = existing.updateVersion || 1;
    merged.recordUpdateTime = existing.recordUpdateTime || Date.now();
  }

  return { merged, hasChanged, rejectedStaleTransition: !isTransitionPermitted };
}
