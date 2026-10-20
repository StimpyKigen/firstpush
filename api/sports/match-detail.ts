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
    const upstreamRes = await fetch(
      `https://sportscore.com/api/widget/match/?sport=football&slug=${encodeURIComponent(slug)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
        },
      }
    );

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: 'SportScore match detail not found.' });
    }

    const data = await upstreamRes.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('SportScore match detail proxy error:', err);
    return res.status(500).json({ error: 'Failed to fetch match details from upstream.' });
  }
}
