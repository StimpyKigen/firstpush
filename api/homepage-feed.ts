import {
  getSavedHomepageFeedAsync,
  saveHomepageFeedAsync,
  cleanupExpiredCarouselPostsAsync,
} from '../src/lib/serverHomepageFeed.js';
import { verifyAdminRequest, constantTimeEqualText } from '../src/lib/adminAuthService.js';

function isAuthorizedCleanupRequest(req: any, body?: any): boolean {
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  const authHeader = String(req?.headers?.authorization || req?.headers?.Authorization || '');
  if (cronSecret && authHeader && constantTimeEqualText(authHeader, `Bearer ${cronSecret}`)) {
    return true;
  }
  return verifyAdminRequest(req?.headers || {}, body || {}).authorized;
}

function getActionParam(req: any, body?: any): string {
  const queryAction = req?.query?.action;
  if (typeof queryAction === 'string' && queryAction.trim()) {
    return queryAction.trim().toLowerCase();
  }
  const rawUrl = String(req?.url || '');
  const qIdx = rawUrl.indexOf('?');
  if (qIdx >= 0) {
    const params = new URLSearchParams(rawUrl.slice(qIdx + 1));
    const urlAction = params.get('action');
    if (urlAction) return urlAction.trim().toLowerCase();
  }
  if (body && typeof body.action === 'string') {
    return body.action.trim().toLowerCase();
  }
  return '';
}

export default async function handler(req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-admin-token, x-admin-phone'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let parsedBody: any = {};
  if (req.method === 'POST') {
    try {
      parsedBody = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : req.body || {};
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid JSON request body.' });
    }
  }
  const action = getActionParam(req, parsedBody);

  // Scheduled / Admin Idempotent 24-Hour Expired Carousel Story Cleanup
  if (action === 'cleanup') {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    if (!isAuthorizedCleanupRequest(req, parsedBody)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Valid CRON_SECRET or administrator credentials required for cleanup.',
      });
    }
    try {
      const result = await cleanupExpiredCarouselPostsAsync();
      return res.status(200).json({
        success: true,
        action: 'cleanup',
        serverTime: result.serverTime,
        removedIds: result.removedIds,
        purgedMediaUrls: result.purgedMediaUrls,
        remainingCarouselCount: result.remainingCarouselCount,
        firestoreUpdated: result.firestoreUpdated,
      });
    } catch {
      return res.status(500).json({
        success: false,
        error: 'Failed to execute expired carousel story cleanup.',
      });
    }
  }

  if (req.method === 'GET') {
    try {
      const feed = await getSavedHomepageFeedAsync();
      const serverTime = new Date().toISOString();
      return res.status(200).json({ success: true, serverTime, feed });
    } catch {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve homepage feed.',
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const feed = parsedBody;
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
        const serverTime = new Date().toISOString();
        return res.status(200).json({
          success: true,
          serverTime,
          feed: result.feed,
          firestoreSaved: result.firestoreSaved,
          diskSaved: result.diskSaved,
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Invalid feed payload: carouselItems and videoItems arrays required.',
      });
    } catch {
      return res.status(500).json({
        success: false,
        error: 'Failed to persist homepage feed.',
      });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed.' });
}
