/**
 * SportScore Bet365 Pre-Match Odds Ingestion & Enrichment Service
 * 
 * Fetches and parses official Bet365 pre-match 1X2 odds, over/under lines,
 * and derives margin-free consensus probabilities from SportScore match pages.
 * 
 * Features:
 * - HTML parser for SportScore Bet365 table (.fb-odds-table)
 * - Margin-free normalized implied probability calculations (1X2, Over 2.5, BTTS)
 * - In-memory and localStorage dual caching with 1-hour TTL
 * - Concurrency-limited batch enrichment for match slates
 * - Safe fallback to market consensus heuristics if odds are unavailable
 */

export interface ParsedBet365Odds {
  bookmaker: 'Bet365';
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  homePct: number;
  drawPct: number;
  awayPct: number;
  over25Pct: number;
  over15Pct: number;
  over35Pct: number;
  bttsYesPct: number;
  goalsLine?: number;
  overOdds?: number;
  underOdds?: number;
  openingHomeOdds?: number;
  openingDrawOdds?: number;
  openingAwayOdds?: number;
  asianHandicap?: {
    line: string;
    homeOdds: number;
    awayOdds: number;
  };
  fetchedAt: number;
}

// In-Memory Cache (URL/ID -> { data, expiresAt })
const oddsCache = new Map<string, { data: ParsedBet365Odds; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour for pre-match odds

// Client-side localStorage hydration
function hydrateClientCache(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem('mshindi_bet365_odds_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      const now = Date.now();
      for (const [key, item] of Object.entries(parsed)) {
        if (item && typeof item === 'object' && (item as any).expiresAt > now) {
          oddsCache.set(key, item as any);
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }
}

function persistClientCache(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const obj: Record<string, { data: ParsedBet365Odds; expiresAt: number }> = {};
    const now = Date.now();
    for (const [key, val] of oddsCache.entries()) {
      if (val.expiresAt > now) {
        obj[key] = val;
      }
    }
    localStorage.setItem('mshindi_bet365_odds_v1', JSON.stringify(obj));
  } catch {
    // Ignore storage quota errors
  }
}

// Initial client hydration
hydrateClientCache();

/**
 * Parses Bet365 1X2 odds, opening odds, and over/under lines from SportScore match page HTML
 */
export function parseSportScoreBet365Odds(html: string): ParsedBet365Odds | null {
  if (!html) return null;

  const chipIdx = html.indexOf('fb-odds-book__chip">BET365');
  if (chipIdx === -1) return null;

  const tableEnd = html.indexOf('</table>', chipIdx);
  if (tableEnd === -1) return null;

  const tableHtml = html.slice(chipIdx, tableEnd);

  // 1. Try to find pre-match odds row
  let rowMatch = tableHtml.match(/<tr class="[^"]*fb-odds-row--prematch[^"]*">([\s\S]*?)<\/tr>/i);
  let openingRowMatch = tableHtml.match(/<tr class="[^"]*fb-odds-row--opening[^"]*">([\s\S]*?)<\/tr>/i);

  // If pre-match row is missing, fall back to opening odds row
  if (!rowMatch && openingRowMatch) {
    rowMatch = openingRowMatch;
  }
  if (!rowMatch) return null;

  const rowHtml = rowMatch[1];

  // Extract all numeric prices formatted as <span class="pr">X.XX</span>
  const prices = Array.from(rowHtml.matchAll(/<span class="pr">([0-9.]+)<\/span>/g))
    .map((m) => parseFloat(m[1]))
    .filter((n) => !Number.isNaN(n) && n > 1.0);

  if (prices.length < 3) return null;

  const homeOdds = prices[0];
  const drawOdds = prices[1];
  const awayOdds = prices[2];

  if (!homeOdds || !drawOdds || !awayOdds || homeOdds <= 1 || drawOdds <= 1 || awayOdds <= 1) {
    return null;
  }

  // Parse opening odds if available
  let openingHomeOdds: number | undefined;
  let openingDrawOdds: number | undefined;
  let openingAwayOdds: number | undefined;

  if (openingRowMatch) {
    const openingPrices = Array.from(openingRowMatch[1].matchAll(/<span class="pr">([0-9.]+)<\/span>/g))
      .map((m) => parseFloat(m[1]))
      .filter((n) => !Number.isNaN(n) && n > 1.0);

    if (openingPrices.length >= 3) {
      openingHomeOdds = openingPrices[0];
      openingDrawOdds = openingPrices[1];
      openingAwayOdds = openingPrices[2];
    }
  }

  // Derive margin-free consensus probabilities
  const rawH = 1 / homeOdds;
  const rawD = 1 / drawOdds;
  const rawA = 1 / awayOdds;
  const marginSum = rawH + rawD + rawA;

  const homePct = Math.round((rawH / marginSum) * 100);
  const drawPct = Math.round((rawD / marginSum) * 100);
  const awayPct = Math.max(1, 100 - homePct - drawPct);

  // Parse Asian Handicap and Over/Under
  const lineMatch = rowHtml.match(/<td class="ln grp">([0-9.]+)<\/td>/);
  const goalsLine = lineMatch ? parseFloat(lineMatch[1]) : 2.5;

  let overOdds: number | undefined;
  let underOdds: number | undefined;
  let over25Pct = 50;

  // In the SportScore table, Asian handicap takes cells 3 & 4. Cells 5 & 6 are Over/Under
  if (prices.length >= 7) {
    overOdds = prices[5];
    underOdds = prices[6];
  } else if (prices.length >= 5) {
    // If AH is not present, cells 3 & 4 may be Over/Under
    overOdds = prices[3];
    underOdds = prices[4];
  }

  if (overOdds && underOdds && overOdds > 1 && underOdds > 1) {
    const rawO = 1 / overOdds;
    const rawU = 1 / underOdds;
    const oSum = rawO + rawU;
    const baseOverPct = Math.round((rawO / oSum) * 100);

    // Adjust for goals line relative to standard 2.5
    if (goalsLine === 2.5) {
      over25Pct = baseOverPct;
    } else if (goalsLine > 2.5) {
      over25Pct = Math.min(85, baseOverPct + Math.round((goalsLine - 2.5) * 12));
    } else if (goalsLine < 2.5 && goalsLine > 0) {
      over25Pct = Math.max(15, baseOverPct - Math.round((2.5 - goalsLine) * 12));
    }
  } else {
    // Heuristic estimation based on implied 1X2 balance
    over25Pct = Math.min(75, Math.max(35, Math.round(48 + (homePct - 40) * 0.2)));
  }

  const over15Pct = Math.min(92, Math.max(60, Math.round(over25Pct * 1.35)));
  const over35Pct = Math.max(15, Math.min(52, Math.round(over25Pct * 0.58)));

  // Calibrate BTTS probability from team strength disparity
  const disparity = Math.abs(homePct - awayPct);
  const bttsYesPct = Math.min(75, Math.max(38, Math.round(58 - disparity * 0.25)));

  return {
    bookmaker: 'Bet365',
    homeOdds,
    drawOdds,
    awayOdds,
    homePct,
    drawPct,
    awayPct,
    over25Pct,
    over15Pct,
    over35Pct,
    bttsYesPct,
    goalsLine,
    overOdds,
    underOdds,
    openingHomeOdds,
    openingDrawOdds,
    openingAwayOdds,
    fetchedAt: Date.now(),
  };
}

const DEFAULT_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Fetches Bet365 odds for a match URL (e.g. "/football/match/newcastle-united-vs-crystal-palace/23xmvkh6zjg9qg8/").
 * Automatically checks memory and localStorage cache before making network calls.
 */
export async function fetchBet365OddsForMatch(matchUrl: string): Promise<ParsedBet365Odds | null> {
  if (!matchUrl || !matchUrl.includes('/football/match/')) {
    return null;
  }

  const cacheKey = matchUrl.trim();
  const cached = oddsCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  try {
    const isClient = typeof window !== 'undefined';
    let html = '';

    if (isClient) {
      // In the browser, route through our backend proxy to prevent CORS blocking
      const proxyUrl = `/api/sports/match-odds?url=${encodeURIComponent(matchUrl)}`;
      const res = await fetch(proxyUrl, {
        headers: { Accept: 'application/json' },
        signal: typeof AbortSignal !== 'undefined' ? AbortSignal.timeout(8000) : undefined,
      });

      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.odds) {
          const odds: ParsedBet365Odds = json.odds;
          oddsCache.set(cacheKey, { data: odds, expiresAt: now + CACHE_TTL_MS });
          persistClientCache();
          return odds;
        }
      }
      return null;
    } else {
      // On the server, fetch directly from SportScore
      const fullUrl = `https://sportscore.com${matchUrl.startsWith('/') ? matchUrl : `/${matchUrl}`}`;
      const res = await fetch(fullUrl, {
        headers: DEFAULT_FETCH_HEADERS,
        signal: typeof AbortSignal !== 'undefined' ? AbortSignal.timeout(8000) : undefined,
      });

      if (!res.ok) {
        return null;
      }
      html = await res.text();
    }

    const odds = parseSportScoreBet365Odds(html);
    if (odds) {
      oddsCache.set(cacheKey, { data: odds, expiresAt: now + CACHE_TTL_MS });
      persistClientCache();
      return odds;
    }

    return null;
  } catch (err) {
    // Network or timeout notice: fail gracefully
    return null;
  }
}

/**
 * Concurrently enrich a list of fixtures with real Bet365 odds.
 * Uses a concurrency limit of 5 to protect server resources and upstream rate limits.
 */
export async function enrichFixturesWithBet365Odds<T extends {
  matchUrl?: string;
  url?: string;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  bookmaker?: string;
  homePct?: number;
  drawPct?: number;
  awayPct?: number;
  over25Pct?: number;
  over15Pct?: number;
  over35Pct?: number;
  bttsYesPct?: number;
}>(fixtures: T[], maxLimit = 35, concurrency = 5): Promise<T[]> {
  if (!fixtures || fixtures.length === 0) return fixtures;

  // Filter items that have a matchUrl and target the top matches
  const targetIndices: number[] = [];
  for (let i = 0; i < fixtures.length && targetIndices.length < maxLimit; i++) {
    const f = fixtures[i];
    const u = f.matchUrl || (f as any).url;
    if (u && typeof u === 'string' && u.includes('/football/match/')) {
      targetIndices.push(i);
    }
  }

  if (targetIndices.length === 0) return fixtures;

  // Process in concurrency chunks
  for (let c = 0; c < targetIndices.length; c += concurrency) {
    const chunkIndices = targetIndices.slice(c, c + concurrency);
    await Promise.allSettled(
      chunkIndices.map(async (idx) => {
        const item = fixtures[idx];
        const u = item.matchUrl || (item as any).url;
        const odds = await fetchBet365OddsForMatch(u);
        if (odds) {
          item.bookmaker = 'Bet365';
          item.homeOdds = odds.homeOdds;
          item.drawOdds = odds.drawOdds;
          item.awayOdds = odds.awayOdds;
          item.homePct = odds.homePct;
          item.drawPct = odds.drawPct;
          item.awayPct = odds.awayPct;
          item.over25Pct = odds.over25Pct;
          item.over15Pct = odds.over15Pct;
          item.over35Pct = odds.over35Pct;
          item.bttsYesPct = odds.bttsYesPct;
        }
      })
    );
  }

  return fixtures;
}
