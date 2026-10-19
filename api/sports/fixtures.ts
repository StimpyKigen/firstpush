import { queryMarketFixtures, executeRollingSyncCycle } from '../../src/lib/sportsFeedService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const scope = (req.query?.scope as any) || 'all';
    const league = req.query?.league as string;
    const country = req.query?.country as string;
    const date = req.query?.date as string;
    const limit = req.query?.limit ? Number(req.query.limit) : undefined;

    let fixtures = queryMarketFixtures({ scope, league, country, date, limit });

    // If empty on cold start, trigger eager sync once
    if (fixtures.length === 0 && scope === 'all' && !league && !country && !date) {
      await executeRollingSyncCycle();
      fixtures = queryMarketFixtures({ scope, league, country, date, limit });
    }

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({ success: true, count: fixtures.length, fixtures });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve market fixtures.' });
  }
}
