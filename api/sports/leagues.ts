import { discoverAllLeagues } from '../../src/lib/sportsFeedService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const leagues = await discoverAllLeagues();
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=172800');
    return res.status(200).json({ success: true, count: leagues.length, leagues });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve sports leagues.' });
  }
}
