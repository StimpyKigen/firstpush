import { queryMarketFixtures, syncLiveScoresOnly } from '../../src/lib/sportsFeedService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let liveFixtures = queryMarketFixtures({ scope: 'live' });

    // If zero live in cold-start store, trigger fast background live check
    if (liveFixtures.length === 0) {
      await syncLiveScoresOnly();
      liveFixtures = queryMarketFixtures({ scope: 'live' });
    }

    res.setHeader('Cache-Control', 'public, max-age=3, s-maxage=5, must-revalidate');
    return res.status(200).json({ success: true, count: liveFixtures.length, fixtures: liveFixtures });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve live fixtures.' });
  }
}
