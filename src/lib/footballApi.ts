export interface HighlightFixture {
  id: string;
  home: string;
  away: string;
  homeLogo?: string;
  awayLogo?: string;
  competition: string;
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
  status?: 'pre' | 'in' | 'post';
  displayClock?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  result?: '1' | 'X' | '2';
}

export function parseAmericanToDecimalOdds(moneylineStr?: string | number): number | null {
  if (moneylineStr === undefined || moneylineStr === null) return null;
  const str = String(moneylineStr).trim();
  if (!str) return null;

  // Handle direct decimal string inputs like "1.85", "2.40"
  const floatVal = parseFloat(str);
  if (!Number.isNaN(floatVal) && floatVal > 1.01 && floatVal < 100 && !str.startsWith('+') && !str.startsWith('-')) {
    return +floatVal.toFixed(2);
  }

  const num = parseInt(str.replace('+', ''), 10);
  if (Number.isNaN(num) || num === 0) return null;

  if (num < 0) {
    // Negative moneyline e.g. -150 -> 1 + (100 / 150) = 1.67
    return +(1 + 100 / Math.abs(num)).toFixed(2);
  } else {
    // Positive moneyline e.g. +250 -> 1 + (250 / 100) = 3.50
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
let lastFetchedTime = 0;

// Hydrate initial cache from sessionStorage for instant zero-latency loads
try {
  const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('mshindi_football_cache_v2') : null;
  if (stored) {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      cachedFixtures = parsed;
      lastFetchedTime = Date.now();
    }
  }
} catch {
  // ignore storage error
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
  let month = parseInt(p.month, 10) - 1; // 0-indexed
  let day = parseInt(p.day, 10);
  let hour = parseInt(p.hour, 10);

  // Before 3:00 AM EAT, current/fixture date belongs to previous day's match slate
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

export async function fetchDailyHighlightFixtures(): Promise<HighlightFixture[]> {
  // Return cached if fetched less than 60s ago to conserve user data bandwidth
  if (cachedFixtures.length > 0 && Date.now() - lastFetchedTime < 60_000) {
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
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
    const res = await fetch('/api/sports/daily-fixtures', controller ? { signal: controller.signal } : {});
    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.fixtures) && data.fixtures.length > 0) {
        const mapped: HighlightFixture[] = data.fixtures.map((m: any) => {
          const tier = inferTier(m.competition || 'Premier League', m.home, m.away);
          const blurb = buildBlurb(m.home, m.away, m.competition || 'Premier League', m.status);
          const fid = m.id?.startsWith('mkt-') ? m.id : `mkt-${m.id || `${m.home}-${m.away}`.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          return {
            id: fid,
            home: m.home,
            away: m.away,
            competition: m.competition || 'Premier League',
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
            bookmaker: 'Market Consensus',
            syncedAt: `Live Consensus · ${syncTimeLabel}`,
            status: m.status || 'pre',
            displayClock: m.status === 'in' ? 'LIVE' : m.status === 'post' ? 'FT' : '',
            homeScore: null,
            awayScore: null,
          };
        });

        if (mapped.length > 0) {
          cachedFixtures = mapped;
          lastFetchedTime = Date.now();
          try {
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.setItem('mshindi_football_cache_v2', JSON.stringify(mapped));
            }
          } catch {
            // ignore storage error
          }
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

  const runCheck = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    void Promise.resolve(onRefresh());
  };

  runCheck();

  // Poll live fixtures every 60 seconds
  setInterval(runCheck, 60_000);

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        runCheck();
      }
    });
  }
}
