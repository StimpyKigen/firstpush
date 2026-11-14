import {
  discoverAllLeagues,
  queryMarketFixtures,
  getDailyMarketHighlights,
  getMarketResults,
  getSyncDiagnostics,
  executeRollingSyncCycle,
  syncLiveScoresOnly,
  fetchAuthoritativeSportScoreMatchDetail,
  getLocalDateStringEAT,
} from '../src/lib/sportsFeedService.js';
import { realtimeBroadcaster } from '../src/lib/realtimeBroadcaster.js';
import {
  fetchBet365OddsForMatch,
  isValidSportScoreSlug,
  sanitizeSportScoreMatchPath,
} from '../src/lib/sportscoreOddsService.js';
import { executeWeeklyIngestion, getWeeklySchedulerStatus } from '../src/lib/weeklyFixtureService.js';
import { isSnapshotStoreConfigured } from '../src/lib/fixtureSnapshotStore.js';
import { verifyAdminRequest, constantTimeEqualText } from '../src/lib/adminAuthService.js';
import { enforceAuthenticatedChatCooldown } from '../src/lib/serverTokenEconomy.js';

function verifyCronBearerHeader(req: any): boolean {
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (!cronSecret) return false;
  const authHeader = String(req?.headers?.authorization || req?.headers?.Authorization || '');
  return Boolean(authHeader && constantTimeEqualText(authHeader, `Bearer ${cronSecret}`));
}

export const config = {
  // Support SSE streaming and weekly fixture ingestion within Vercel Node runtime
  maxDuration: 60,
};

// Rate limit cold-start eager sync triggers from anonymous GET requests
let lastColdStartSyncAt = 0;
const COLD_START_SYNC_COOLDOWN_MS = 60_000;

function resolveSportsSubpath(req: any): string {
  const endpointParam = req?.query?.endpoint;
  if (endpointParam) {
    const joined = Array.isArray(endpointParam) ? endpointParam.join('/') : String(endpointParam);
    const cleaned = joined.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (cleaned) return cleaned;
  }

  const rawUrl = String(req?.url || '');
  const pathname = (rawUrl.split('?')[0] || '').replace(/\/+$/, '').toLowerCase();

  if (pathname.startsWith('/api/cron/')) {
    return pathname.replace(/^\/api\/cron\//, '');
  }
  if (pathname.startsWith('/api/sports/')) {
    return pathname.replace(/^\/api\/sports\//, '');
  }
  return '';
}

export default async function handler(req: any, res: any) {
  const subpath = resolveSportsSubpath(req);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Last-Event-ID, x-user-token, x-firebase-id-token, x-admin-token, x-admin-phone'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Real-Time SSE Stream (/api/sports/stream)
  if (subpath === 'stream') {
    return realtimeBroadcaster.registerClient(req, res);
  }

  // 2. Real-Time SSE Stream Metrics (/api/sports/stream/status)
  if (subpath === 'stream/status') {
    return res.status(200).json({ success: true, metrics: realtimeBroadcaster.getMetrics() });
  }

  // 3. Daily Curated Market Highlights (/api/sports/daily-fixtures)
  if (subpath === 'daily-fixtures') {
    try {
      const highlights = await getDailyMarketHighlights();
      res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
      return res.status(200).json({ success: true, count: highlights.length, fixtures: highlights });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to retrieve daily fixtures.' });
    }
  }

  // 4. Market Fixtures Query (/api/sports/fixtures)
  if (subpath === 'fixtures') {
    try {
      const scope = (req.query?.scope as any) || 'all';
      const league = req.query?.league as string;
      const country = req.query?.country as string;
      const date = req.query?.date as string;
      const limit = req.query?.limit ? Number(req.query.limit) : undefined;

      let fixtures = queryMarketFixtures({ scope, league, country, date, limit });

      // If empty on cold start, trigger eager sync at most once per cooldown window
      if (fixtures.length === 0 && scope === 'all' && !league && !country && !date) {
        const now = Date.now();
        if (now - lastColdStartSyncAt >= COLD_START_SYNC_COOLDOWN_MS) {
          lastColdStartSyncAt = now;
          await executeRollingSyncCycle();
          fixtures = queryMarketFixtures({ scope, league, country, date, limit });
        }
      }

      res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
      return res.status(200).json({ success: true, count: fixtures.length, fixtures });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to retrieve market fixtures.' });
    }
  }

  // 5. Leagues Catalog (/api/sports/leagues)
  if (subpath === 'leagues') {
    try {
      const leagues = await discoverAllLeagues();
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
      return res.status(200).json({ success: true, count: leagues.length, leagues });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to retrieve sports leagues.' });
    }
  }

  // 6. Live Fixtures & Recently Finished Reconciliation (/api/sports/live)
  if (subpath === 'live') {
    try {
      const diag = getSyncDiagnostics();
      const liveAgeMs = diag.lastLiveSyncTime ? Date.now() - new Date(diag.lastLiveSyncTime).getTime() : Infinity;
      if (liveAgeMs > 8_000) {
        await syncLiveScoresOnly();
      }

      const liveFixtures = queryMarketFixtures({ scope: 'live' });
      const now = new Date();
      const todayStr = getLocalDateStringEAT(now);
      const yesterdayDate = new Date(now.getTime() - 24 * 3600 * 1000);
      const yesterdayStr = getLocalDateStringEAT(yesterdayDate);

      // Include finished matches from both today and yesterday (EAT) so late-night fixtures
      // kicking off at 22:00/23:00 EAT and finishing after midnight EAT are always reconciled!
      const finishedToday = queryMarketFixtures({ scope: 'finished', date: todayStr });
      const finishedYesterday = queryMarketFixtures({ scope: 'finished', date: yesterdayStr });
      const recentlyFinished = [...finishedToday, ...finishedYesterday];

      res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
      return res.status(200).json({
        success: true,
        count: liveFixtures.length,
        fixtures: liveFixtures,
        recentlyFinished,
        lastLiveSyncTime: getSyncDiagnostics().lastLiveSyncTime,
      });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to retrieve live fixtures.' });
    }
  }

  // 7. Authoritative SportScore Match Detail Proxy (/api/sports/match-detail)
  if (subpath === 'match-detail') {
    const slug = String(req.query?.slug || '').trim();
    if (!isValidSportScoreSlug(slug)) {
      return res.status(400).json({ error: 'Valid match slug is required.' });
    }

    try {
      // Keep match-detail proxy read-only (ingestIntoStore: false) so reading detail never pollutes live fixturesStore
      const detail = await fetchAuthoritativeSportScoreMatchDetail(slug, { ingestIntoStore: false });
      if (!detail) {
        return res.status(404).json({ error: 'SportScore match detail not found.' });
      }

      if (detail.normalized_status === 'in') {
        res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=10, stale-while-revalidate=20');
      }
      return res.status(200).json(detail);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch match details from upstream.' });
    }
  }

  // 8. SportScore League Standings Proxy (/api/sports/standings)
  if (subpath === 'standings') {
    const slug = String(req.query?.slug || '').trim();
    if (!isValidSportScoreSlug(slug)) {
      return res.status(400).json({ error: 'Valid competition slug is required.' });
    }

    try {
      const upstreamRes = await fetch(
        `https://sportscore.com/api/widget/standings/?sport=football&slug=${encodeURIComponent(slug)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            Accept: 'application/json',
          },
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).json({ error: 'SportScore standings not found.' });
      }

      const data = await upstreamRes.json();
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
      return res.status(200).json(data);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch standings from upstream.' });
    }
  }

  // 9. Sync Diagnostics & Telemetry Status (/api/sports/status)
  if (subpath === 'status') {
    try {
      const diagnostics = getSyncDiagnostics();
      return res.status(200).json({ success: true, diagnostics });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to retrieve telemetry diagnostics.' });
    }
  }

  // 10. Match Results (/api/sports/results)
  if (subpath === 'results') {
    try {
      const league = (req.query?.league as string) || 'premier';
      const season = req.query?.season as string;
      const results = await getMarketResults(league, season);
      return res.status(200).json({ success: true, league, count: results.length, results });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to retrieve match results.' });
    }
  }

  // 11. Bet365 Match Odds Proxy (/api/sports/match-odds)
  if (subpath === 'match-odds') {
    const safePath = sanitizeSportScoreMatchPath(req.query?.url);
    if (!safePath) {
      return res.status(400).json({ success: false, error: 'Valid SportScore match URL is required.' });
    }
    try {
      const odds = await fetchBet365OddsForMatch(safePath);
      if (!odds) {
        return res.status(404).json({ success: false, error: 'Bet365 odds not available for this match.' });
      }
      res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600');
      return res.status(200).json({ success: true, odds });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to retrieve match odds.' });
    }
  }

  // 12. Chat Cooldown Enforcement (/api/sports/chat-cooldown)
  if (subpath === 'chat-cooldown') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    let body: any = {};
    try {
      body = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : req.body || {};
    } catch {
      return res.status(400).json({ success: false, allowed: false, error: 'Invalid JSON request body.' });
    }
    const cooldownRes = await enforceAuthenticatedChatCooldown({
      headers: req.headers || {},
      body,
      query: req.query || {},
    });
    return res.status(cooldownRes.statusCode).json(cooldownRes.payload);
  }

  // 12. Manual/On-Demand Rolling or Live Sync (/api/sports/sync & /api/sports/sync-live)
  if (subpath === 'sync') {
    let body: any = {};
    try {
      body = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : req.body || {};
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid JSON request body.' });
    }
    const adminCheck = verifyAdminRequest(req.headers || {}, body);
    const hasValidCronSecret = verifyCronBearerHeader(req);
    if (!adminCheck.authorized && !hasValidCronSecret) {
      return res.status(403).json({
        success: false,
        error: adminCheck.reason || 'Forbidden: Administrator permissions required.',
      });
    }
    try {
      const result = await executeRollingSyncCycle();
      return res.status(200).json({ success: true, result, diagnostics: getSyncDiagnostics() });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to execute synchronization.' });
    }
  }

  if (subpath === 'sync-live') {
    let body: any = {};
    try {
      body = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : req.body || {};
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid JSON request body.' });
    }
    const adminCheck = verifyAdminRequest(req.headers || {}, body);
    const hasValidCronSecret = verifyCronBearerHeader(req);
    if (!adminCheck.authorized && !hasValidCronSecret) {
      return res.status(403).json({
        success: false,
        error: adminCheck.reason || 'Forbidden: Administrator permissions required.',
      });
    }
    try {
      const result = await syncLiveScoresOnly();
      return res.status(200).json({ success: true, result, diagnostics: getSyncDiagnostics() });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to execute live synchronization.' });
    }
  }

  // 13. Weekly Sync Status (/api/sports/weekly-sync/status)
  if (subpath === 'weekly-sync/status') {
    try {
      const status = getWeeklySchedulerStatus();
      return res.status(200).json({ success: true, ...status });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to retrieve weekly sync status.' });
    }
  }

  // 14. Vercel Cron & Admin Weekly Fixture Ingestion (/api/sports/weekly-sync & /api/cron/weekly-sync)
  if (subpath === 'weekly-sync' || subpath === 'cron-weekly-sync') {
    let body: any = {};
    try {
      body = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : req.body || {};
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid JSON request body.' });
    }
    const adminCheck = verifyAdminRequest(req.headers || {}, body);

    if (!adminCheck.authorized) {
      const secret = (process.env.CRON_SECRET || '').trim();
      if (!secret) {
        return res.status(503).json({ success: false, error: 'CRON_SECRET is not configured.' });
      }
      if (!verifyCronBearerHeader(req)) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }
      if (!isSnapshotStoreConfigured()) {
        return res.status(503).json({ success: false, error: 'FIREBASE_SERVICE_ACCOUNT is not configured.' });
      }
    }

    try {
      const force = body.force !== undefined ? Boolean(body.force) : true;
      const startFromToday = body.startFromToday !== undefined ? Boolean(body.startFromToday) : true;
      const targetDomesticCount = body.targetDomesticCount ? Number(body.targetDomesticCount) : 28;
      const log = await executeWeeklyIngestion({ force, startFromToday, targetDomesticCount });
      return res.status(200).json({ success: true, log });
    } catch (err: any) {
      console.error('[Cron weekly-sync] failed:', err);
      return res.status(500).json({ success: false, error: 'Weekly sync failed.' });
    }
  }

  return res.status(404).json({ success: false, error: `Unknown sports endpoint: ${subpath || '/'}` });
}

