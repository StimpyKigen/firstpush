import { getSavedHomepageFeed, saveHomepageFeed } from '../src/lib/serverHomepageFeed';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const feed = getSavedHomepageFeed();
      res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=10, must-revalidate');
      return res.status(200).json({ success: true, feed });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Failed to retrieve homepage feed.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const feed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (feed && Array.isArray(feed.carouselItems) && Array.isArray(feed.videoItems)) {
        saveHomepageFeed(feed);
        return res.status(200).json({ success: true, feed });
      }
      return res.status(400).json({ success: false, error: 'Invalid feed payload: carouselItems and videoItems arrays required.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Failed to persist homepage feed.' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed.' });
}
