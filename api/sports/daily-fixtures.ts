import { getDailyMarketHighlights } from '../../src/lib/sportsFeedService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const highlights = await getDailyMarketHighlights();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({ success: true, count: highlights.length, fixtures: highlights });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve daily fixtures.' });
  }
}
