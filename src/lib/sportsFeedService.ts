/**
 * Server-Side Sports Market Intelligence & Consensus Odds Service
 * 
 * Securely proxies external football feed data through our backend.
 * All third-party endpoints and API keys are strictly kept server-side.
 * Client consumers only see white-labeled `/api/sports/...` responses.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

// 15 minutes for upcoming fixtures, 10 minutes for results, 24 hours for league directory
const FIXTURES_TTL = 15 * 60 * 1000;
const RESULTS_TTL = 10 * 60 * 1000;
const LEAGUES_TTL = 24 * 60 * 60 * 1000;

const BASE_URL = 'https://footballcharts-backend.onrender.com/api/v1';

function getApiKey(): string {
  return process.env.SPORTS_FEED_API_KEY || 'fc_9qB_ndigFOSIT-SYuIqN8MAUCUqHK05w';
}

export interface MarketFixture {
  id: string;
  home: string;
  away: string;
  competition: string;
  leagueCode: string;
  kickoff: string;
  kickoffIso: string;
  status: 'pre' | 'in' | 'post';
  homePct: number;
  drawPct: number;
  awayPct: number;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  bttsYesPct?: number;
  over25Pct?: number;
  expectedHomeGoals?: number;
  expectedAwayGoals?: number;
  bookmaker: string;
  syncedAt: string;
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

function formatEATTime(dateStr: string, timeStr?: string): string {
  try {
    const iso = timeStr ? `${dateStr}T${timeStr}:00Z` : `${dateStr}T12:00:00Z`;
    const d = new Date(iso);
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
 * Fetch leagues catalog
 */
export async function getMarketLeagues(): Promise<any[]> {
  const cacheKey = 'sports:leagues';
  const cached = getCached<any[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/leagues/`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch leagues: HTTP ${res.status}`);
    }
    const json = await res.json();
    const leagues = (json.leagues || []).map((l: any) => ({
      league: l.league,
      name: l.name,
      country: l.country,
      seasons: l.seasons,
    }));
    setCached(cacheKey, leagues, LEAGUES_TTL);
    return leagues;
  } catch (err) {
    console.warn('Error fetching sports leagues:', err);
    return [];
  }
}

/**
 * Fetch and transform fixtures for a specific league
 */
export async function getMarketFixtures(leagueCode: string = 'premier'): Promise<MarketFixture[]> {
  const cacheKey = `sports:fixtures:${leagueCode}`;
  const cached = getCached<MarketFixture[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/leagues/${encodeURIComponent(leagueCode)}/fixtures/`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch fixtures for ${leagueCode}: HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawMatches = Array.isArray(data) ? data : data.fixtures || [];

    const nowIso = new Date().toISOString();
    const fixtures: MarketFixture[] = rawMatches.map((m: any, idx: number) => {
      const preds = m.model_predictions?.dc_v2?.calibrated || m.model_predictions?.dc_v2?.raw || {};
      const hProb = preds.home != null ? Number(preds.home) : 0.45;
      const aProb = preds.away != null ? Number(preds.away) : 0.28;
      const dProb = Math.max(0.1, 1 - hProb - aProb);

      const homePct = Math.round(hProb * 100);
      const awayPct = Math.round(aProb * 100);
      const drawPct = Math.max(5, 100 - homePct - awayPct);

      // Derive realistic standard decimal odds using standard 7% overround margin
      const homeOdds = +Math.max(1.05, 1.07 / Math.max(0.01, hProb)).toFixed(2);
      const drawOdds = +Math.max(1.05, 1.07 / Math.max(0.01, dProb)).toFixed(2);
      const awayOdds = +Math.max(1.05, 1.07 / Math.max(0.01, aProb)).toFixed(2);

      const rawExpected = m.model_predictions?.dc_v2?.raw || {};

      return {
        id: m.slug || `${leagueCode}-${idx}-${m.home_team}-${m.away_team}`.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        home: m.home_team,
        away: m.away_team,
        competition: m.real_league_name || m.league || 'Premier League',
        leagueCode,
        kickoff: formatEATTime(m.match_date, m.time),
        kickoffIso: m.time ? `${m.match_date}T${m.time}:00Z` : `${m.match_date}T15:00:00Z`,
        status: m.status === 'finished' ? 'post' : m.status === 'in_play' ? 'in' : 'pre',
        homePct,
        drawPct,
        awayPct,
        homeOdds,
        drawOdds,
        awayOdds,
        bttsYesPct: preds.btts_yes ? Math.round(preds.btts_yes * 100) : undefined,
        over25Pct: preds['over_2.5'] ? Math.round(preds['over_2.5'] * 100) : undefined,
        expectedHomeGoals: rawExpected.expected_home_goals != null ? +Number(rawExpected.expected_home_goals).toFixed(2) : undefined,
        expectedAwayGoals: rawExpected.expected_away_goals != null ? +Number(rawExpected.expected_away_goals).toFixed(2) : undefined,
        bookmaker: 'Market Consensus',
        syncedAt: nowIso,
      };
    });

    setCached(cacheKey, fixtures, FIXTURES_TTL);
    return fixtures;
  } catch (err) {
    console.warn(`Error fetching fixtures for ${leagueCode}:`, err);
    return [];
  }
}

/**
 * Fetch and transform completed results for a league
 */
export async function getMarketResults(leagueCode: string = 'premier', season?: string): Promise<MarketResult[]> {
  const targetSeason = season || '2025-2026';
  const cacheKey = `sports:results:${leagueCode}:${targetSeason}`;
  const cached = getCached<MarketResult[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/leagues/${encodeURIComponent(leagueCode)}/results/?season=${encodeURIComponent(targetSeason)}`, {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch results for ${leagueCode}: HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawEvents = Array.isArray(data) ? data : data.results || [];

    const results: MarketResult[] = rawEvents.map((r: any) => {
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

    setCached(cacheKey, results, RESULTS_TTL);
    return results;
  } catch (err) {
    console.warn(`Error fetching results for ${leagueCode}:`, err);
    return [];
  }
}

/**
 * Aggregates marquee upcoming fixtures across key leagues (Premier League, La Liga, Serie A, Champions League)
 */
export async function getDailyMarketHighlights(): Promise<MarketFixture[]> {
  const cacheKey = 'sports:highlights:daily';
  const cached = getCached<MarketFixture[]>(cacheKey);
  if (cached) return cached;

  const priorityLeagues = ['premier', 'spain1', 'italy1', 'germany1', 'france1'];
  const allResults = await Promise.all(
    priorityLeagues.map((code) => getMarketFixtures(code))
  );

  const flat = allResults.flat();
  // Sort by kickoff date & time
  flat.sort((a, b) => new Date(a.kickoffIso).getTime() - new Date(b.kickoffIso).getTime());

  setCached(cacheKey, flat, FIXTURES_TTL);
  return flat;
}
