import type { MatchPeriod, MatchStatus } from './matchStatus';

export interface HighlightFixture {
  id: string;
  providerId?: string;
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
  lastSyncTime?: string;
  status?: MatchStatus;
  period?: MatchPeriod;
  periodSequence?: number;
  displayClock?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeHtScore?: number | null;
  awayHtScore?: number | null;
  result?: '1' | 'X' | '2';
  bttsYesPct?: number;
  over15Pct?: number;
  over25Pct?: number;
  over35Pct?: number;
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

import { BUNDLED_SPORTS_CATALOGUE } from '../data/bundledSportsCatalogue';
import { resolveCanonicalCompetition } from './canonicalCompetitions';

function mapBundledToHighlights(): HighlightFixture[] {
  // Pre-loaded fixtures removed per user mandate
  return [];
}

let cachedFixtures: HighlightFixture[] = [];
let lastFetchedTime = 0;

// Hydrate admin uploaded fixtures from localStorage if available
try {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('mshindi_uploaded_fixtures') : null;
  if (stored) {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      cachedFixtures = parsed.map((m: any) => {
        const canon = resolveCanonicalCompetition({
          competition: m.competition,
          country: m.country,
          leagueCode: m.leagueCode,
          providerId: m.providerId || m.id,
        });
        const compName = m.competition || canon.name;
        const tier = inferTier(compName, m.home, m.away);
        const blurb = buildBlurb(m.home, m.away, compName, m.status);
        return {
          id: m.id,
          home: m.home,
          away: m.away,
          competition: compName,
          competitionId: m.competitionId || canon.id,
          leagueCode: m.leagueCode,
          country: m.country || canon.country,
          kickoff: m.kickoff,
          kickoffIso: m.kickoffIso,
          tier,
          blurb,
          homePct: m.homePct || 33,
          drawPct: m.drawPct || 34,
          awayPct: m.awayPct || 33,
          homeOdds: m.homeOdds || 2.00,
          drawOdds: m.drawOdds || 3.30,
          awayOdds: m.awayOdds || 3.50,
          bookmaker: m.bookmaker || 'Uploaded Market Consensus',
          syncedAt: m.syncedAt || 'Uploaded',
          status: m.status || 'pre',
          displayClock: m.displayClock || '',
          homeScore: m.homeScore !== undefined ? m.homeScore : null,
          awayScore: m.awayScore !== undefined ? m.awayScore : null,
          bttsYesPct: m.bttsYesPct,
          over15Pct: m.over15Pct,
          over25Pct: m.over25Pct,
          over35Pct: m.over35Pct,
        };
      });
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

export function getLocalDateStringEAT(dateInput: Date | string | number = new Date()): string {
  const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
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

export async function fetchDailyHighlightFixtures(force = false): Promise<HighlightFixture[]> {
  const hasLiveMatches = cachedFixtures.some((f) => f.status === 'in');
  const cacheTtlMs = hasLiveMatches ? 8_000 : 30_000;

  // Return cached if not forced and fetched within active TTL
  if (!force && cachedFixtures.length > 0 && Date.now() - lastFetchedTime < cacheTtlMs) {
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
    const timeoutId = controller ? setTimeout(() => controller.abort(), 25000) : null;
    // 25s timeout allows cold starts on Render/Vercel to complete without premature abort
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.API_BASE_URL || 'http://localhost:3000');
    const res = await fetch(`${baseUrl}/api/sports/daily-fixtures`, controller ? { signal: controller.signal } : {});
    if (timeoutId) clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.fixtures) && data.fixtures.length > 0) {
        const mapped: HighlightFixture[] = data.fixtures.map((m: any) => {
          const canon = resolveCanonicalCompetition({
            competition: m.competition,
            country: m.country,
            leagueCode: m.leagueCode,
            providerId: m.providerId || m.id,
          });
          const compName = m.competitionId && m.competition ? m.competition : canon.name;
          const tier = inferTier(compName, m.home, m.away);
          const blurb = buildBlurb(m.home, m.away, compName, m.status);
          const fid = m.id?.startsWith('mkt-') ? m.id : `mkt-${m.id || `${m.home}-${m.away}`.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          return {
            id: fid,
            providerId: m.providerId || fid,
            home: m.home,
            away: m.away,
            competition: compName,
            competitionId: m.competitionId || canon.id,
            leagueCode: m.leagueCode,
            country: m.country || canon.country,
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
            lastSyncTime: m.lastSyncTime || m.syncedAt,
            status: m.status || 'pre',
            period: m.period,
            periodSequence: m.periodSequence,
            displayClock: m.displayClock || (m.status === 'in' ? 'LIVE' : m.status === 'post' ? 'FT' : ''),
            homeScore: m.homeScore !== undefined ? m.homeScore : null,
            awayScore: m.awayScore !== undefined ? m.awayScore : null,
            homeHtScore: m.homeHtScore !== undefined ? m.homeHtScore : null,
            awayHtScore: m.awayHtScore !== undefined ? m.awayHtScore : null,
            bttsYesPct: m.bttsYesPct,
            over15Pct: m.over15Pct,
            over25Pct: m.over25Pct,
            over35Pct: m.over35Pct,
          };
        });

        if (mapped.length > 0) {
          cachedFixtures = mapped;
          lastFetchedTime = Date.now();
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('mshindi_football_cache_v3', JSON.stringify(mapped));
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

  let timerHandle: NodeJS.Timeout | null = null;

  const runCheck = async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    try {
      await Promise.resolve(onRefresh());
    } catch (err) {
      console.warn('Sync iteration error:', err);
    } finally {
      scheduleNext();
    }
  };

  const scheduleNext = () => {
    if (timerHandle) clearTimeout(timerHandle);
    // If active live matches are occurring, poll rapidly every 12 seconds
    const hasLive = cachedFixtures.some((f) => f.status === 'in');
    const delayMs = hasLive ? 12_000 : 45_000;
    timerHandle = setTimeout(runCheck, delayMs);
  };

  // Immediate initial check
  void runCheck();

  // Instant recovery when user switches back to tab
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void runCheck();
      }
    });
  }

  // Instant recovery on network reconnection
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      void runCheck();
    });

    window.addEventListener('focus', () => {
      if (Date.now() - lastFetchedTime > 12_000) {
        void runCheck();
      }
    });
  }
}
