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
 * Tier 8 (200 pts): Other National Divisions & Recognized Regional Leagues.
 * Tier 9 (100 pts): Reserve leagues, regional youth, and unranked competitions.
 */

import { normalizeMatchStatus } from './matchStatus';

export interface CompetitionTier {
  id: string;
  name: string;
  baseScore: number;
  patterns: RegExp[];
}

export const COMPETITION_HIERARCHY: CompetitionTier[] = [
  // Tier 1: Premier European Club Tournament
  {
    id: 'uefa_champions_league',
    name: 'UEFA Champions League',
    baseScore: 1000,
    patterns: [
      /uefa champions league|^champions league/i,
    ],
  },
  // Tier 2: FIFA World Cup & Premier Continental National-Team Tournaments
  {
    id: 'fifa_uefa_internationals',
    name: 'FIFA & Continental National Tournaments',
    baseScore: 900,
    patterns: [
      /fifa world cup|^world cup/i,
      /uefa european championship|euro\s*20\d\d|euro qualification/i,
      /copa am[eé]rica/i,
      /africa cup of nations|afcon/i,
      /afc asian cup/i,
      /concacaf gold cup/i,
    ],
  },
  // Tier 3: Other UEFA Continental Club Tournaments & Super Cup
  {
    id: 'uefa_secondary_competitions',
    name: 'UEFA Europa, Conference League & Nations League',
    baseScore: 800,
    patterns: [
      /uefa europa league|^europa league/i,
      /uefa (?:europa )?conference league|^conference league/i,
      /uefa super cup/i,
      /uefa nations league|nations league/i,
    ],
  },
  // Tier 4: UEFA Top 5 Domestic Leagues (UEFA Association Club Coefficient Top 5)
  {
    id: 'uefa_top5_domestic',
    name: 'Top 5 European Leagues (ENG, ESP, ITA, GER, FRA)',
    baseScore: 700,
    patterns: [
      /premier league|english premier league|\bepl\b/i,
      /la liga|laliga|primera division(?! argentina)/i,
      /serie a(?! brazil)/i,
      /bundesliga/i,
      /ligue 1/i,
    ],
  },
  // Tier 5: Major Secondary Continental Club & High-Profile Domestic Leagues
  {
    id: 'major_secondary_leagues',
    name: 'Major Secondary Continental & Prestigious Domestic Leagues',
    baseScore: 600,
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
  // Tier 6: UEFA Elite Youth & Women's Champions League
  {
    id: 'uefa_youth_womens',
    name: "UEFA Youth League & Women's Champions League",
    baseScore: 500,
    patterns: [
      /uefa youth league/i,
      /uefa women|womens champions league/i,
      /fifa futsal/i,
    ],
  },
  // Tier 7: Top Domestic Cups & National First Divisions
  {
    id: 'domestic_cups_first_divisions',
    name: 'Domestic Cups & Recognized National Top Flights',
    baseScore: 400,
    patterns: [
      /fa cup|copa del rey|dfb-pokal|coppa italia|coupe de france/i,
      /egyptian premier league/i,
      /south african premier|dstv prem/i,
      /kenyan premier league|fkf/i,
      /moroccan botola/i,
      /j1 league|k league/i,
    ],
  },
];

/**
 * Get deterministic base prestige score for any competition name
 */
export function getCompetitionPriorityScore(competitionName: string): number {
  if (!competitionName) return 100;
  const comp = competitionName.toLowerCase();

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
  status?: string | null;
  statusText?: string | null;
  kickoffIso?: string | null;
  id: string;
}): number {
  const basePrestige = getCompetitionPriorityScore(fixture.competition);
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
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a fixture's kickoff into HH:mm in the user's local device timezone.
 */
export function formatDeviceLocalTime(kickoffIso?: string, fallback: string = ''): string {
  if (!kickoffIso) return fallback;
  const d = new Date(kickoffIso);
  if (isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Formats a fixture's kickoff into DD/MM HH:mm in the user's local device timezone (24h system).
 * Example: "21/10 19:45"
 */
export function formatKickoffDateTime24h(kickoffIso?: string, fallback: string = ''): string {
  if (kickoffIso) {
    const d = new Date(kickoffIso);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${minutes}`;
    }
  }

  if (fallback) {
    const d = new Date(fallback);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${minutes}`;
    }
    return fallback;
  }

  return '';
}

/**
 * Highlights ordering comparator:
 * 1. Competition prestige + status score (descending)
 * 2. Kickoff time (ascending, earliest upcoming first)
 * 3. Stable deterministic tie-breaker (fixture ID)
 */
export function sortHighlightsComparator<T extends { competition: string; status?: any; statusText?: any; kickoffIso?: any; kickoff?: any; id: string }>(
  a: T,
  b: T
): number {
  const rankA = getHighlightRank(a);
  const rankB = getHighlightRank(b);

  if (rankA !== rankB) {
    return rankB - rankA; // Higher score first
  }

  // Secondary: kickoff timestamp (earliest first)
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
    return timeA - timeB; // Strictly chronological
  }
  return a.id.localeCompare(b.id);
}

/**
 * Check if fixture is eligible for the Upcoming tab:
 * - Must be not-yet-started (status normalized to 'pre').
 * - Strictly excludes live ('in'), completed ('post'), postponed, cancelled, abandoned, and suspended fixtures.
 * - Must have a valid future kickoff timestamp relative to the device clock (nowMs).
 * - A fixture starting at exactly the current instant (kickoffMs === nowMs) or in the past is strictly excluded.
 * - Missing or invalid timestamps are safely excluded and never crash.
 */
export function isUpcomingEligible(
  fixture: { status?: any; statusText?: any; kickoffIso?: any; kickoff?: any } | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!fixture) return false;

  // 1. Normalized status check: only 'pre' (scheduled / unstarted) is eligible
  const norm = normalizeMatchStatus(fixture.status, fixture.statusText);
  if (norm !== 'pre') {
    return false;
  }

  // 2. Parse kickoff timestamp to UTC epoch milliseconds
  const kickoffMs = parseFixtureKickoffMs(fixture);
  if (kickoffMs === null) {
    return false;
  }

  // 3. Device clock real-time check: strictly future
  return kickoffMs > nowMs;
}

/**
 * Check if fixture is eligible for the Highlights experience:
 * - Excludes cancelled or postponed fixtures.
 * - Highlights top and major tier matches (base score >= 400 or any live match).
 */
export function isHighlightsEligible(fixture: { competition: string; status?: any; statusText?: any }): boolean {
  const norm = normalizeMatchStatus(fixture.status, fixture.statusText);
  if (norm === 'cancelled' || norm === 'postponed' || norm === 'abandoned') {
    return false;
  }
  if (norm === 'in') return true; // Any live game is eligible for Highlights spotlight
  const prestige = getCompetitionPriorityScore(fixture.competition);
  return prestige >= 400; // Tier 1 through Tier 7
}
