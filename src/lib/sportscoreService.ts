/**
 * SportScore Match Center & Standings Service
 * Proxies through backend /api/sports/match-detail and /api/sports/standings
 */

import { extractSportScoreMatchSlug } from './fixtureIdentity';

export interface SportScoreIncident {
  time: number | string;
  added_time?: number;
  type: string;
  type_id?: number;
  player?: string;
  assist?: string;
  player_in?: string;
  player_out?: string;
  side: 'home' | 'away';
  is_goal?: boolean;
  is_card?: boolean;
  is_sub?: boolean;
  home_score?: number;
  away_score?: number;
}

export interface SportScoreStat {
  name: string;
  type?: number;
  home: string | number;
  away: string | number;
}

export interface SportScorePlayer {
  name: string;
  number: number | string;
  position: string;
  rating?: number | string;
  captain?: boolean;
}

export interface SportScoreMatchDetail {
  home_team: string;
  away_team: string;
  home?: string;
  away?: string;
  home_logo?: string;
  away_logo?: string;
  home_score?: number | null;
  away_score?: number | null;
  home_ht_score?: number | null;
  away_ht_score?: number | null;
  status?: string;
  status_text?: string;
  live_minute?: number | string | null;
  kickoff?: string;
  time?: string;
  url?: string;
  competition?: string;
  competition_logo?: string;
  venue?: string;
  referee?: string;
  incidents?: SportScoreIncident[];
  stats?: SportScoreStat[];
  lineups?: {
    confirmed?: boolean;
    home_formation?: string;
    away_formation?: string;
    home_coach?: string | null;
    away_coach?: string | null;
    home_xi?: SportScorePlayer[];
    away_xi?: SportScorePlayer[];
    home_subs?: SportScorePlayer[];
    away_subs?: SportScorePlayer[];
  };
  h2h?: {
    summary?: {
      home_wins?: number;
      draws?: number;
      away_wins?: number;
    };
    matches?: Array<{
      date: string;
      home: string;
      away: string;
      home_score: number;
      away_score: number;
      competition?: string;
    }>;
  };
  tracker?: {
    id?: string;
    profile?: string;
    sport?: string;
  };
}

export interface SportScoreStandingRow {
  position: number;
  pos?: number;
  team: string;
  team_logo?: string;
  played: number;
  p?: number;
  won: number;
  w?: number;
  drawn: number;
  d?: number;
  lost: number;
  l?: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  gd?: number;
  points: number;
  pts?: number;
}

export interface SportScoreStandingsResponse {
  competition: string;
  season?: string;
  standings: SportScoreStandingRow[];
  tables?: Array<{
    name?: string;
    rows: Array<{
      pos: number;
      team: string;
      team_logo?: string;
      p: number;
      w: number;
      d: number;
      l: number;
      gd: number;
      pts: number;
    }>;
  }>;
}

export type SportScoreStandings = SportScoreStandingsResponse;

const matchDetailCache = new Map<string, { data: SportScoreMatchDetail; ts: number }>();
const standingsCache = new Map<string, { data: SportScoreStandingsResponse; ts: number }>();

const LIVE_DETAIL_CACHE_TTL_MS = 5 * 1000; // 5s for active live matches
const STATIC_DETAIL_CACHE_TTL_MS = 45 * 1000; // 45s for finished/upcoming matches
const STANDINGS_CACHE_TTL = 5 * 60 * 1000; // 5m for standings

function normalizeTeamForSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export function buildMatchSlug(homeTeam: string, awayTeam: string, matchUrl?: string): string {
  if (matchUrl) {
    const extracted = extractSportScoreMatchSlug({ matchUrl, home: homeTeam, away: awayTeam });
    if (extracted) return extracted;
  }
  return `${normalizeTeamForSlug(homeTeam)}-vs-${normalizeTeamForSlug(awayTeam)}`;
}

/**
 * Unwraps and normalizes raw SportScore `/api/widget/match/` payloads (`{ sport, match, updated }` or flat)
 * into a consistent `SportScoreMatchDetail` object.
 */
export function normalizeRawSportScoreDetail(rawPayload: any): SportScoreMatchDetail | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;
  const dm = rawPayload.match && typeof rawPayload.match === 'object' ? rawPayload.match : rawPayload;

  const homeTeam = String(dm.home_team || dm.home || '').trim();
  const awayTeam = String(dm.away_team || dm.away || '').trim();
  if (!homeTeam && !awayTeam) return null;

  const parseScore = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null;
    const n = Number(val);
    return Number.isNaN(n) ? null : n;
  };

  return {
    ...dm,
    home_team: homeTeam,
    away_team: awayTeam,
    home: homeTeam,
    away: awayTeam,
    home_logo: dm.home_logo || undefined,
    away_logo: dm.away_logo || undefined,
    home_score: parseScore(dm.home_score),
    away_score: parseScore(dm.away_score),
    home_ht_score: parseScore(dm.home_ht_score),
    away_ht_score: parseScore(dm.away_ht_score),
    status: dm.status || undefined,
    status_text: dm.status_text || undefined,
    live_minute: dm.live_minute ?? null,
    kickoff: dm.kickoff || dm.time || undefined,
    time: dm.time || dm.kickoff || undefined,
    url: dm.url || undefined,
    competition: dm.competition || undefined,
    competition_logo: dm.competition_logo || undefined,
    incidents: Array.isArray(dm.incidents) ? dm.incidents : [],
    stats: Array.isArray(dm.stats) ? dm.stats : [],
    lineups: dm.lineups || undefined,
    h2h: dm.h2h || undefined,
    tracker: dm.tracker || undefined,
  };
}

export async function fetchMatchDetailBySlug(slug: string, bypassCache = false): Promise<SportScoreMatchDetail | null> {
  if (!slug) return null;
  const cleanSlug = extractSportScoreMatchSlug({ matchSlug: slug, providerId: slug, id: slug }) || slug;

  const cached = matchDetailCache.get(cleanSlug);
  if (cached && !bypassCache) {
    const isCachedLive =
      cached.data.status === 'live' ||
      cached.data.status === 'in' ||
      (cached.data.live_minute !== null && cached.data.live_minute !== undefined);
    const ttl = isCachedLive ? LIVE_DETAIL_CACHE_TTL_MS : STATIC_DETAIL_CACHE_TTL_MS;
    if (Date.now() - cached.ts < ttl) {
      return cached.data;
    }
  }

  try {
    const signal =
      typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? AbortSignal.timeout(8000)
        : undefined;
    const res = await fetch(`/api/sports/match-detail?slug=${encodeURIComponent(cleanSlug)}`, {
      signal,
    });
    if (!res.ok) return null;
    const rawData = await res.json();
    const detail = normalizeRawSportScoreDetail(rawData);
    if (!detail) return null;

    matchDetailCache.set(cleanSlug, { data: detail, ts: Date.now() });
    return detail;
  } catch {
    return null;
  }
}

export const fetchSportScoreMatchDetail = fetchMatchDetailBySlug;

export async function fetchMatchDetail(
  homeTeam: string,
  awayTeam: string,
  matchUrl?: string
): Promise<SportScoreMatchDetail | null> {
  // 1. Try canonical slug from matchUrl if available
  if (matchUrl) {
    const urlSlug = extractSportScoreMatchSlug({ matchUrl, home: homeTeam, away: awayTeam });
    if (urlSlug) {
      const fromUrl = await fetchMatchDetailBySlug(urlSlug);
      if (fromUrl) return fromUrl;
    }
  }

  // 2. Race standard home-vs-away slug and away-vs-home fallback concurrently
  const primarySlug = buildMatchSlug(homeTeam, awayTeam);
  const reverseSlug = buildMatchSlug(awayTeam, homeTeam);
  if (reverseSlug === primarySlug) {
    return fetchMatchDetailBySlug(primarySlug);
  }

  const [primaryRes, reverseRes] = await Promise.all([
    fetchMatchDetailBySlug(primarySlug),
    fetchMatchDetailBySlug(reverseSlug),
  ]);
  return primaryRes || reverseRes || null;
}

const COMPETITION_SLUG_MAP: Record<string, string> = {
  'english premier league': 'premier-league',
  'premier league': 'premier-league',
  'epl': 'premier-league',
  'la liga': 'laliga',
  'spanish la liga': 'laliga',
  'serie a': 'serie-a',
  'italian serie a': 'serie-a',
  'bundesliga': 'bundesliga',
  'german bundesliga': 'bundesliga',
  'ligue 1': 'ligue-1',
  'french ligue 1': 'ligue-1',
  'uefa champions league': 'uefa-champions-league',
  'champions league': 'uefa-champions-league',
  'uefa europa league': 'uefa-europa-league',
  'europa league': 'uefa-europa-league',
  'eredivisie': 'eredivisie',
  'primeira liga': 'primeira-liga',
  'championship': 'championship',
  'efl championship': 'championship',
};

export function resolveCompetitionSlug(competitionName: string): string {
  const clean = competitionName.toLowerCase().trim();
  if (COMPETITION_SLUG_MAP[clean]) return COMPETITION_SLUG_MAP[clean];
  for (const [key, val] of Object.entries(COMPETITION_SLUG_MAP)) {
    if (clean.includes(key)) return val;
  }
  return normalizeTeamForSlug(competitionName);
}

export const buildCompetitionSlug = resolveCompetitionSlug;

export async function fetchStandingsByCompetition(competitionName: string): Promise<SportScoreStandingsResponse | null> {
  const slug = resolveCompetitionSlug(competitionName);
  const cached = standingsCache.get(slug);
  if (cached && Date.now() - cached.ts < STANDINGS_CACHE_TTL) {
    return cached.data;
  }

  try {
    const signal =
      typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
        ? AbortSignal.timeout(8000)
        : undefined;
    const res = await fetch(`/api/sports/standings?slug=${encodeURIComponent(slug)}`, { signal });
    if (!res.ok) return null;
    const raw = await res.json();
    const data = raw?.standings || raw?.tables ? raw : raw?.data || raw;
    if (!data) return null;

    // Normalize tables/standings so both `standings` and `tables[0].rows` consumers work
    const rows: SportScoreStandingRow[] = Array.isArray(data.standings)
      ? data.standings
      : Array.isArray(data.tables?.[0]?.rows)
      ? data.tables[0].rows.map((r: any) => ({
          ...r,
          position: r.position ?? r.pos,
          pos: r.pos ?? r.position,
          played: r.played ?? r.p,
          p: r.p ?? r.played,
          won: r.won ?? r.w,
          w: r.w ?? r.won,
          drawn: r.drawn ?? r.d,
          d: r.d ?? r.drawn,
          lost: r.lost ?? r.l,
          l: r.l ?? r.lost,
          goal_diff: r.goal_diff ?? r.gd ?? 0,
          gd: r.gd ?? r.goal_diff ?? 0,
          points: r.points ?? r.pts,
          pts: r.pts ?? r.points,
        }))
      : [];

    if (rows.length === 0 && !Array.isArray(data.tables)) return null;

    const normalized: SportScoreStandingsResponse = {
      ...data,
      competition: data.competition || competitionName,
      standings: rows,
      tables: Array.isArray(data.tables)
        ? data.tables
        : [
            {
              name: data.competition || competitionName,
              rows: rows.map((r) => ({
                pos: r.pos ?? r.position,
                team: r.team,
                team_logo: r.team_logo,
                p: r.p ?? r.played,
                w: r.w ?? r.won,
                d: r.d ?? r.drawn,
                l: r.l ?? r.lost,
                gd: r.gd ?? r.goal_diff ?? 0,
                pts: r.pts ?? r.points,
              })),
            },
          ],
    };

    standingsCache.set(slug, { data: normalized, ts: Date.now() });
    return normalized;
  } catch {
    return null;
  }
}

export const fetchSportScoreStandings = fetchStandingsByCompetition;
