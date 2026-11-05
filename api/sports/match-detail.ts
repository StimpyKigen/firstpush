import { fetchAuthoritativeSportScoreMatchDetail } from '../../src/lib/sportsFeedService.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const slug = req.query?.slug as string;
  if (!slug) {
    return res.status(400).json({ error: 'Match slug is required.' });
  }

  try {
    const detail = await fetchAuthoritativeSportScoreMatchDetail(slug, { ingestIntoStore: true });
    if (!detail) {
      return res.status(404).json({ error: 'SportScore match detail not found.' });
    }

    if (detail.normalized_status === 'in') {
      res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=10, stale-while-revalidate=20');
    }
    return res.status(200).json(detail);
  } catch (err: any) {
    console.error('SportScore match detail proxy error:', err);
    return res.status(500).json({ error: 'Failed to fetch match details from upstream.' });
  }
}
