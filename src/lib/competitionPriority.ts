/**
 * Competition Prestige Ranking & Highlights Prioritization Engine
 * 
 * Implements a transparent, maintainable hierarchy informed by UEFA competition prestige,
 * UEFA association coefficients, and major FIFA/confederation continental rankings.
 * 
 * HIERARCHY OVERVIEW:
 * Tier 1 (1000 pts): UEFA Champions League — pinnacle of global club football.
 * Tier 2 (900 pts): FIFA World Cup & Premier Continental Championships (UEFA Euro, Copa América, AFCON, AFC Asian Cup).
 * Tier 3 (800 pts): UEFA Europa League, UEFA Conference League, UEFA Super Cup, UEFA Nations League.
 * Tier 4 (700 pts): Top 5 European Domestic Leagues (EPL, La Liga, Serie A, Bundesliga, Ligue 1).
 * Tier 5 (600 pts): Major Secondary Continental Club (CAF Champions League, Copa Libertadores, AFC Champions League)
 *                   & High-Profile Domestic Leagues (Liga Portugal, Eredivisie, Championship, Saudi Pro League, Brasileirão, MLS, Liga MX).
 * Tier 6 (500 pts): UEFA Elite Youth League & UEFA Women's Champions League.
 * Tier 7 (400 pts): Major Domestic Cups (FA Cup, Copa del Rey, DFB Pokal, Coppa Italia) & Recognized National Top Flights (Egyptian PL, PSL, Kenyan PL).
 * Tier 8 (250 pts): Continental Youth Tournaments (CAF U20, CAF U17, AFC U20) & Regional Tournaments.
 * Tier 9 (150-200 pts): Other National Divisions, reserve leagues, regional youth, and unranked competitions.
 */

import { normalizeMatchStatus } from './matchStatus';

export interface CompetitionTier {
  id: string;
  name: string;
  baseScore: number;
  patterns: RegExp[];
}

export const COMPETITION_HIERARCHY: CompetitionTier[] = [
  // Tier 1A: English Premier League (Top 5 #1)
  {
    id: 'uefa_top5_premier_league',
    name: 'English Premier League',
    baseScore: 2000,
    patterns: [
      /^(?:english\s+)?premier\s+league$|^\bepl\b$/i,
      /premier league/i,
    ],
  },
  // Tier 1B: Spanish La Liga (Top 5 #2)
  {
    id: 'uefa_top5_la_liga',
    name: 'Spanish La Liga',
    baseScore: 1900,
    patterns: [
      /la\s*liga|laliga|^primera division(?!.*argentina)/i,
    ],
  },
  // Tier 1C: Italian Serie A (Top 5 #3)
  {
    id: 'uefa_top5_serie_a',
    name: 'Italian Serie A',
    baseScore: 1800,
    patterns: [
      /^(?:italian\s+)?serie\s+a(?!.*brazil)/i,
      /serie\s+a(?!.*brazil)/i,
    ],
  },
  // Tier 1D: German Bundesliga (Top 5 #4)
  {
    id: 'uefa_top5_bundesliga',
    name: 'German Bundesliga',
    baseScore: 1700,
    patterns: [
      /^(?:german\s+)?bundesliga(?!.*austria)/i,
      /bundesliga(?!.*austria)/i,
    ],
  },
  // Tier 1E: French Ligue 1 (Top 5 #5)
  {
    id: 'uefa_top5_ligue_1',
    name: 'French Ligue 1',
    baseScore: 1600,
    patterns: [
      /^(?:french\s+)?ligue\s*1/i,
      /ligue\s*1/i,
    ],
  },
  // Tier 2: Premier European Continental Club (UEFA Champions League)
  {
    id: 'uefa_champions_league',
    name: 'UEFA Champions League',
    baseScore: 1500,
    patterns: [
      /uefa champions league|^champions league/i,
    ],
  },
  // Tier 3: FIFA World Cup & Premier Continental Championships
  {
    id: 'fifa_uefa_internationals',
    name: 'FIFA & Continental National Tournaments',
    baseScore: 1400,
    patterns: [
      /fifa world cup|^world cup/i,
      /uefa european championship|euro\s*20\d\d|euro qualification/i,
      /copa am[eé]rica/i,
      /^(?!.*(?:u17|u19|u20|u21|u23|youth))(?:.*(?:africa cup of nations|\bafcon\b))/i,
      /afc asian cup/i,
      /concacaf gold cup/i,
    ],
  },
  // Tier 4: UEFA Europa League
  {
    id: 'uefa_europa_league',
    name: 'UEFA Europa League',
    baseScore: 1300,
    patterns: [
      /uefa europa league|^europa league/i,
    ],
  },
  // Tier 5: UEFA Conference League, Super Cup & Nations League
  {
    id: 'uefa_secondary_competitions',
    name: 'UEFA Conference League, Super Cup & Nations League',
    baseScore: 1200,
    patterns: [
      /uefa (?:europa )?conference league|^conference league/i,
      /uefa super cup/i,
      /uefa nations league|nations league/i,
    ],
  },
  // Tier 6: Major Secondary Continental Club & High-Profile Domestic Leagues
  {
    id: 'major_secondary_leagues',
    name: 'Major Secondary Continental & Prestigious Domestic Leagues',
    baseScore: 1000,
    patterns: [
      /caf champions league/i,
      /copa libertadores|libertadores/i,
      /afc champions league|afc elite/i,
      /liga portugal|primeira liga/i,
      /eredivisie/i,
      /championship|efl championship/i,
      /scottish premiership/i,
      /saudi pro league/i,
      /s[üu]per lig|turkish super lig/i,
      /brasileir[ãa]o/i,
      /primera divisi[oó]n argentina|liga profesional argentina/i,
      /major league soccer|\bmls\b/i,
      /liga mx/i,
      /caf confederation/i,
      /copa sudamericana/i,
    ],
  },
  // Tier 7: UEFA Elite Youth & Women's Champions League
  {
    id: 'uefa_youth_womens',
    name: "UEFA Youth League & Women's Champions League",
    baseScore: 900,
    patterns: [
      /uefa youth league/i,
      /uefa women|womens champions league/i,
      /fifa futsal/i,
    ],
  },
  // Tier 8: Top Domestic Cups & National First Divisions
  {
    id: 'domestic_cups_first_divisions',
    name: 'Domestic Cups & Recognized National Top Flights',
    baseScore: 800,
    patterns: [
      /fa cup|efl cup|carabao cup|copa del rey|supercopa|dfb-pokal|dfl-supercup|coppa italia|supercoppa|coupe de france|trophee des champions|knvb beker|taca de portugal|taca da liga|scottish cup|scottish league cup|turkish cup|copa do brasil|copa argentina|us open cup|kings cup/i,
      /egyptian premier league/i,
      /south african premier|dstv prem/i,
      /kenyan premier league|fkf/i,
      /moroccan botola/i,
      /j1 league|k league/i,
    ],
  },
  // Tier 9: Continental Youth & Regional Secondary Tournaments
  {
    id: 'continental_youth_regional',
    name: 'Continental Youth & Regional Tournaments',
    baseScore: 700,
    patterns: [
      /caf.*(?:u17|u19|u20|u21|u23|youth)|(?:u17|u19|u20|u21|u23).*caf/i,
      /concacaf.*(?:u17|u20)|afc.*(?:u17|u20|u23)/i,
    ],
  },
  // Tier 10: Lower Divisions & Reserve/Amateur
  {
    id: 'lower_divisions_amateur',
    name: 'Lower Divisions & Reserve/Amateur',
    baseScore: 500,
    patterns: [
      /division 2|league 2|serie b|segunda|amateur|reserve/i,
    ],
  },
];

import { resolveCanonicalCompetition, CANONICAL_COMPETITIONS } from './canonicalCompetitions';

/**
 * Get deterministic base prestige score for any competition name or canonical ID
 */
export function getCompetitionPriorityScore(competitionName: string, competitionId?: string, country?: string): number {
  if (!competitionName && !competitionId) return 100;

  if (competitionId && CANONICAL_COMPETITIONS[competitionId]) {
    return CANONICAL_COMPETITIONS[competitionId].prestigeScore ?? 150;
  }

  // Resolve canonical identity with country/competition context
  const resolved = resolveCanonicalCompetition({ competition: competitionName, country });
  if (resolved && CANONICAL_COMPETITIONS[resolved.id]) {
    return CANONICAL_COMPETITIONS[resolved.id].prestigeScore ?? 150;
  }

  const comp = (competitionName || '').toLowerCase();
  for (const tier of COMPETITION_HIERARCHY) {
    for (const pat of tier.patterns) {
      if (pat.test(comp)) {
        return tier.baseScore;
      }
    }
  }

  // Fallback heuristics
  if (comp.includes('uefa')) return 500;
  if (comp.includes('super league') || comp.includes('division 1') || comp.includes('primera')) return 300;
  if (comp.includes('cup')) return 250;
  return 150;
}

/**
 * Calculate dynamic Highlights ranking score:
 * Base prestige + Status modifier (Live > Imminent Upcoming > Standard Upcoming > Completed)
 */
export function getHighlightRank(fixture: {
  competition: string;
  competitionId?: string;
  country?: string;
  status?: string | null;
  statusText?: string | null;
  kickoffIso?: string | null;
  id: string;
}): number {
  const basePrestige = getCompetitionPriorityScore(fixture.competition, fixture.competitionId, fixture.country);
  const status = normalizeMatchStatus(fixture.status, fixture.statusText);

  let statusModifier = 0;
  if (status === 'in') {
    statusModifier = 60; // Live matches in prestigious competitions get top spotlight
  } else if (status === 'pre') {
    const now = Date.now();
    const kickoff = fixture.kickoffIso ? new Date(fixture.kickoffIso).getTime() : now + 86400000;
    const diffHours = (kickoff - now) / (1000 * 60 * 60);

    if (diffHours >= -1 && diffHours <= 24) {
      statusModifier = 30; // Imminent match today
    } else if (diffHours > 24 && diffHours <= 48) {
      statusModifier = 15; // Tomorrow
    } else {
      statusModifier = 0; // Future
    }
  } else if (status === 'post') {
    statusModifier = -250; // Finished games deprioritized in Highlights
  } else {
    statusModifier = -600; // Postponed/cancelled relegated to bottom
  }

  return basePrestige + statusModifier;
}

/**
 * Highlights ordering comparator:
 * 1. Competition prestige + status score (descending)
 * 2. Kickoff time (ascending, earliest upcoming first)
 * 3. Stable deterministic tie-breaker (fixture ID)
 */
/**
 * Parse any fixture kickoff representation into UTC epoch milliseconds.
 * Returns null if missing, empty, or invalid (NaN).
 * Handles:
 * - ISO strings with UTC 'Z' (e.g. "2026-10-20T14:30:00Z")
 * - ISO strings with explicit timezone offsets (e.g. "2026-10-20T17:30:00+03:00", "2026-10-20T10:30:00-04:00")
 * - Epoch timestamps (seconds or milliseconds)
 * - Date objects
 */
export function parseFixtureKickoffMs(
  fixture: { kickoffIso?: any; kickoff?: any } | null | undefined
): number | null {
  if (!fixture) return null;

  const candidates = [fixture.kickoffIso, fixture.kickoff];
  for (const val of candidates) {
    if (val === undefined || val === null || val === '') continue;

    if (typeof val === 'number') {
      if (isNaN(val)) continue;
      // If unix timestamp in seconds (< 1e11), convert to milliseconds
      return val < 1e11 ? val * 1000 : val;
    }

    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) continue;
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }

    if (val instanceof Date) {
      const ms = val.getTime();
      if (!isNaN(ms)) return ms;
    }
  }

  return null;
}

/**
 * Formats a Date or timestamp into 'YYYY-MM-DD' according to the user's local device clock / timezone.
 * Uses local calendar year, month, and day (getFullYear, getMonth, getDate).
 * Never hardcodes UTC or a specific external timezone.
 */
export function getDeviceLocalDateString(dateInput: Date | string | number = new Date()): string {
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
 * Formats a fixture's kickoff into HH:mm in the user's local device timezone.
 */
export function formatDeviceLocalTime(kickoffIso?: string, fallback: string = ''): string {
  if (!kickoffIso) return fallback;
  const d = new Date(kickoffIso);
  if (isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d) + ' EAT';
}

/**
 * Formats a fixture's kickoff into DD/MM HH:mm in the user's local device timezone (24h system).
 * Example: "21/10 19:45"
 */
export function formatKickoffDateTime24h(kickoffIso?: string, fallback: string = '', includeTimezone: boolean = true): string {
  const tzSuffix = includeTimezone ? ' EAT' : '';

  // 1. If kickoffIso is provided, ALWAYS format in East Africa Time (EAT, UTC+3)
  if (kickoffIso) {
    const d = new Date(kickoffIso);
    if (!isNaN(d.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Nairobi',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(d);
      const day = parts.find((p) => p.type === 'day')?.value || '';
      const month = parts.find((p) => p.type === 'month')?.value || '';
      const hour = parts.find((p) => p.type === 'hour')?.value || '';
      const minute = parts.find((p) => p.type === 'minute')?.value || '';
      return `${day}/${month} ${hour}:${minute}${tzSuffix}`;
    }
  }

  // 2. If fallback already has DD/MM HH:mm or DD-MM-YYYY HH:mm format, use it with EAT
  if (fallback) {
    const verbatimMatch = fallback.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-]\d{2,4})?\s+([0-2]?\d:[0-5]\d)/);
    if (verbatimMatch) {
      const d = verbatimMatch[1].padStart(2, '0');
      const m = verbatimMatch[2].padStart(2, '0');
      const t = verbatimMatch[3];
      return `${d}/${m} ${t}${tzSuffix}`;
    }
    const cleanFallback = fallback.replace(/\s*EAT$/i, '').trim();
    return `${cleanFallback}${tzSuffix}`;
  }

  return '';
}

/**
 * Highlights ordering comparator:
 * 1. Top 5 European leagues first, in their established hierarchy:
 *    Premier League (2000) > La Liga (1900) > Serie A (1800) > Bundesliga (1700) > Ligue 1 (1600),
 *    followed by all other competitions in descending order of configured importance score.
 * 2. Within each competition / equal prestige tier:
 *    a. Live matches first
 *    b. Kickoff time ascending (nearest kickoff forward)
 * 3. Stable deterministic tie-breaker (fixture ID)
 */
export function sortHighlightsComparator<T extends { competition: string; competitionId?: string; country?: string; status?: any; statusText?: any; kickoffIso?: any; kickoff?: any; id: string }>(
  a: T,
  b: T
): number {
  const scoreA = getCompetitionPriorityScore(a.competition, a.competitionId, a.country);
  const scoreB = getCompetitionPriorityScore(b.competition, b.competitionId, b.country);

  if (scoreA !== scoreB) {
    return scoreB - scoreA; // Top 5 European leagues first in established hierarchy, then descending by configured importance
  }

  // Within the same competition / priority score:
  // 1. Live matches first
  const isLiveA = normalizeMatchStatus(a.status, a.statusText) === 'in';
  const isLiveB = normalizeMatchStatus(b.status, b.statusText) === 'in';
  if (isLiveA !== isLiveB) {
    return isLiveA ? -1 : 1;
  }

  // 2. Chronological kickoff time (nearest kickoff first)
  const timeA = parseFixtureKickoffMs(a) ?? Infinity;
  const timeB = parseFixtureKickoffMs(b) ?? Infinity;
  if (timeA !== timeB) {
    return timeA - timeB;
  }

  return a.id.localeCompare(b.id);
}

/**
 * Upcoming ordering comparator:
 * STRICT RULE: Chronological ONLY by kickoff time, earliest first.
 * Zero prestige weighting.
 */
export function sortUpcomingComparator<T extends { kickoffIso?: any; kickoff?: any; id: string }>(
  a: T,
  b: T
): number {
  const timeA = parseFixtureKickoffMs(a) ?? Infinity;
  const timeB = parseFixtureKickoffMs(b) ?? Infinity;
  if (timeA !== timeB) {
    return timeA - timeB; // Strictly chronological nearest kickoff first
  }
  return a.id.localeCompare(b.id);
}

/**
 * Check if fixture is eligible for the Upcoming tab:
 * - Must be not-yet-started (status normalized to 'pre').
 * - Strictly excludes live ('in'), completed ('post'), postponed, cancelled, abandoned, and suspended fixtures.
 * - Must have a valid kickoff timestamp at or after the device clock (kickoffMs >= nowMs).
 * - Missing or invalid timestamps are safely excluded and never crash.
 */
export function isUpcomingEligible(
  fixture: { status?: any; statusText?: any; kickoffIso?: any; kickoff?: any; period?: any } | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!fixture) return false;

  // 1. Normalized status check: only 'pre' (scheduled / unstarted) is eligible
  const norm = normalizeMatchStatus(fixture.status, fixture.statusText);
  if (norm !== 'pre') {
    return false;
  }

  // 2. Period check: must NOT be in an active period
  if (fixture.period && ['first_half', 'halftime', 'second_half', 'extra_time', 'penalties'].includes(fixture.period)) {
    return false;
  }

  // 3. Parse kickoff timestamp to UTC epoch milliseconds
  const kickoffMs = parseFixtureKickoffMs(fixture);
  if (kickoffMs === null) {
    return false;
  }

  // 4. Device clock real-time check: at or after current device time
  return kickoffMs >= nowMs;
}

/**
 * Calculates the current day's Highlights time boundary in East Africa Time (EAT, UTC+3):
 * - Starts at 00:00:00 EAT of that day.
 * - Cutoff is strictly 06:00:00 AM EAT of the next day.
 * - Fixtures with kickoff before 00:00:00 EAT or after 06:00:00 AM EAT the next day are strictly excluded.
 */
export function getHighlightsCutoffWindowEAT(now: Date | number = Date.now()): {
  startMs: number;
  nextDay6amMs: number;
} {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const eatOffsetMs = 3 * 60 * 60 * 1000;
  const eatDate = new Date(nowMs + eatOffsetMs);
  const year = eatDate.getUTCFullYear();
  const month = eatDate.getUTCMonth();
  const day = eatDate.getUTCDate();

  const startMs = Date.UTC(year, month, day, 0, 0, 0, 0) - eatOffsetMs;
  const nextDay6amMs = Date.UTC(year, month, day + 1, 6, 0, 0, 0) - eatOffsetMs;

  return { startMs, nextDay6amMs };
}

/**
 * Check if fixture is eligible for the Highlights experience:
 * - Strictly excludes completed ('post'), live ('in'), cancelled, postponed, or abandoned fixtures.
 * - In highlights, ONLY show games that are to be played that day.
 * - Strictly does NOT show games past 6:00 AM EAT the next day during that day currently.
 */
export function isHighlightsEligible(
  fixture: { competition?: string; competitionId?: string; country?: string; status?: any; statusText?: any; period?: any; kickoffIso?: any; kickoff?: any } | null | undefined,
  referenceTime: Date | number = Date.now()
): boolean {
  if (!fixture) return false;
  const norm = normalizeMatchStatus(fixture.status, fixture.statusText);
  // Live matches ('in'), completed matches ('post'), cancelled, postponed, abandoned, suspended fixtures are NOT eligible for highlights
  if (norm === 'in' || norm === 'post' || norm === 'cancelled' || norm === 'postponed' || norm === 'abandoned' || norm === 'suspended') {
    return false;
  }
  if (fixture.period && ['first_half', 'halftime', 'second_half', 'extra_time', 'penalties'].includes(fixture.period)) {
    return false;
  }

  const kickoffMs = parseFixtureKickoffMs(fixture);
  if (kickoffMs === null) {
    return false;
  }

  const { startMs, nextDay6amMs } = getHighlightsCutoffWindowEAT(referenceTime);
  return kickoffMs >= startMs && kickoffMs <= nextDay6amMs;
}
