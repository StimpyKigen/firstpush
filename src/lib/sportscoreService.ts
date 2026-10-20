/**
 * SportScore Service
 * 
 * Provides match details, lineups, timeline incidents, standings, and live tracker
 * integration for football fixtures across all supported competitions.
 */

export interface SportScorePlayer {
  name: string;
  number?: number | string;
  position?: string; // 'G' | 'D' | 'M' | 'F'
  captain?: boolean;
  rating?: string;
}

export interface SportScoreLineup {
  home_formation?: string;
  away_formation?: string;
  home_coach?: string;
  away_coach?: string;
  confirmed?: boolean;
  home_xi?: SportScorePlayer[];
  home_subs?: SportScorePlayer[];
  away_xi?: SportScorePlayer[];
  away_subs?: SportScorePlayer[];
}

export interface SportScoreIncident {
  time: number;
  type: string;
  type_id?: number;
  side: 'home' | 'away';
  player?: string;
  is_goal?: boolean;
  is_card?: boolean;
  home_score?: number;
  away_score?: number;
}

export interface SportScoreTracker {
  id: string;
  profile?: string;
  sport: string;
}

export interface SportScoreMatchDetail {
  home: string;
  away: string;
  home_logo?: string;
  away_logo?: string;
  home_score?: number | null;
  away_score?: number | null;
  home_ht_score?: number | null;
  away_ht_score?: number | null;
  status: string;
  status_text: string;
  time: string;
  competition?: string;
  competition_logo?: string;
  competition_slug?: string;
  url?: string;
  live_minute?: number;
  incidents?: SportScoreIncident[];
  lineups?: SportScoreLineup;
  stats?: any[];
  tracker?: SportScoreTracker;
  referee?: string;
  venue?: string;
}

export interface SportScoreStandingRow {
  pos: number;
  team: string;
  team_logo?: string;
  team_slug?: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  promo_name?: string;
  promo_color?: string;
}

export interface SportScoreStandings {
  competition: string;
  competition_slug: string;
  competition_logo?: string;
  tables: Array<{
    group?: string;
    rows: SportScoreStandingRow[];
  }>;
}

// In-Memory cache to prevent redundant fetches
const detailCache = new Map<string, { data: SportScoreMatchDetail; expiresAt: number }>();
const standingsCache = new Map<string, { data: SportScoreStandings; expiresAt: number }>();

export function slugifyText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function buildMatchSlug(home: string, away: string): string {
  const hSlug = slugifyText(home);
  const aSlug = slugifyText(away);
  return `${hSlug}-vs-${aSlug}`;
}

export function buildCompetitionSlug(competition: string): string {
  return slugifyText(competition);
}

/**
 * Fetch detailed match data from SportScore (Lineups, Incidents, Halftime/Fulltime scores, Tracker)
 */
export async function fetchSportScoreMatchDetail(
  slugOrHome: string,
  away?: string
): Promise<SportScoreMatchDetail | null> {
  const matchSlug = away ? buildMatchSlug(slugOrHome, away) : slugOrHome;
  if (!matchSlug) return null;

  const now = Date.now();
  const cached = detailCache.get(matchSlug);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // 1. Try local proxy endpoint first (avoids CORS & benefits from server-side caching)
  try {
    const res = await fetch(`/api/sports/match-detail?slug=${encodeURIComponent(matchSlug)}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.match) {
        detailCache.set(matchSlug, { data: json.match, expiresAt: now + 60_000 });
        return json.match;
      }
    }
  } catch {
    // Fall back to direct upstream
  }

  // 2. Direct upstream fallback (SportScore widget API is CORS-enabled)
  try {
    const directRes = await fetch(
      `https://sportscore.com/api/widget/match/?sport=football&slug=${encodeURIComponent(matchSlug)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (directRes.ok) {
      const json = await directRes.json();
      if (json && json.match) {
        detailCache.set(matchSlug, { data: json.match, expiresAt: now + 60_000 });
        return json.match;
      }
    }
  } catch (err) {
    console.warn(`Could not load SportScore detail for ${matchSlug}:`, err);
  }

  return null;
}

/**
 * Fetch league standings table from SportScore
 */
export async function fetchSportScoreStandings(
  competitionNameOrSlug: string
): Promise<SportScoreStandings | null> {
  const compSlug = buildCompetitionSlug(competitionNameOrSlug);
  if (!compSlug) return null;

  const now = Date.now();
  const cached = standingsCache.get(compSlug);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // 1. Try local proxy endpoint first
  try {
    const res = await fetch(`/api/sports/standings?slug=${encodeURIComponent(compSlug)}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.tables) {
        standingsCache.set(compSlug, { data: json, expiresAt: now + 300_000 });
        return json;
      }
    }
  } catch {
    // Fall back to direct upstream
  }

  // 2. Direct upstream fallback
  try {
    const directRes = await fetch(
      `https://sportscore.com/api/widget/standings/?sport=football&slug=${encodeURIComponent(compSlug)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (directRes.ok) {
      const json = await directRes.json();
      if (json && json.tables) {
        standingsCache.set(compSlug, { data: json, expiresAt: now + 300_000 });
        return json;
      }
    }
  } catch (err) {
    console.warn(`Could not load SportScore standings for ${compSlug}:`, err);
  }

  return null;
}
