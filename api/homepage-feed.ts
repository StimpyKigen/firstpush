import {
  getSavedHomepageFeedAsync,
  saveHomepageFeedAsync,
} from '../src/lib/serverHomepageFeed.js';
import { verifyAdminRequest } from '../src/lib/adminAuthService.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-admin-token, x-admin-phone, x-admin-pin'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const feed = await getSavedHomepageFeedAsync();
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.status(200).json({ success: true, feed });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to retrieve homepage feed.',
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const feed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const authCheck = verifyAdminRequest(req.headers || {}, feed);
      if (!authCheck.authorized) {
        return res.status(403).json({
          success: false,
          error: authCheck.reason || 'Forbidden: Administrator permissions required.',
        });
      }

      if (feed && Array.isArray(feed.carouselItems) && Array.isArray(feed.videoItems)) {
        const result = await saveHomepageFeedAsync(feed, {
          allowReplaceAll: Boolean(feed.allowReplaceAll),
        });
        return res.status(200).json({
          success: true,
          feed: result.feed,
          firestoreSaved: result.firestoreSaved,
          diskSaved: result.diskSaved,
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid feed payload: carouselItems and videoItems arrays required.',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to persist homepage feed.',
      });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed.' });
}
