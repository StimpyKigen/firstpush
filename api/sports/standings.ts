export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const slug = req.query?.slug as string;
  if (!slug) {
    return res.status(400).json({ error: 'Competition slug is required.' });
  }

  try {
    const upstreamRes = await fetch(
      `https://sportscore.com/api/widget/standings/?sport=football&slug=${encodeURIComponent(slug)}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Accept: 'application/json',
        },
      }
    );

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).json({ error: 'SportScore standings not found.' });
    }

    const data = await upstreamRes.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('SportScore standings proxy error:', err);
    return res.status(500).json({ error: 'Failed to fetch standings from upstream.' });
  }
}
