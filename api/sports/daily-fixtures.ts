import { getDailyMarketHighlights } from '../../src/lib/sportsFeedService';

export default async function handler(req: any, res: any) {
  try {
    const highlights = await getDailyMarketHighlights();
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json({ success: true, count: highlights.length, fixtures: highlights });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve market fixtures.' });
  }
}
