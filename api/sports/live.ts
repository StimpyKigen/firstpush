import {
  queryMarketFixtures,
  syncLiveScoresOnly,
  getSyncDiagnostics,
  getLocalDateStringEAT,
} from '../../src/lib/sportsFeedService.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve live fixtures.' });
  }
}
