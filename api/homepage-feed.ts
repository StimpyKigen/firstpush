import {
  getSavedHomepageFeedAsync,
  saveHomepageFeedAsync,
  cleanupExpiredCarouselPostsAsync,
} from '../src/lib/serverHomepageFeed.js';
import { verifyAdminRequestAsync, constantTimeEqualText } from '../src/lib/adminAuthService.js';
import {
  applyCorsPolicy,
  applyStandardSecurityHeaders,
  parseSafeJsonBody,
} from '../src/lib/httpSecurity.js';
import { enforceEndpointRateLimit } from '../src/lib/rateLimitService.js';

async function isAuthorizedCleanupRequest(
  req: any,
  body?: any
): Promise<{ authorized: boolean; storeUnavailable?: boolean }> {
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  const authHeader = String(req?.headers?.authorization || req?.headers?.Authorization || '');
  if (cronSecret && authHeader && constantTimeEqualText(authHeader, `Bearer ${cronSecret}`)) {
    return { authorized: true };
  }
  const adminCheck = await verifyAdminRequestAsync(req?.headers || {}, body || {});
  return { authorized: adminCheck.authorized, storeUnavailable: adminCheck.storeUnavailable };
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
  applyStandardSecurityHeaders(req, res, { isApi: true });
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');

  const cors = applyCorsPolicy(req, res, {
    methods: 'GET, POST, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, x-admin-token',
  });
  if (cors.preflightHandled) {
    return;
  }

  const rateOk = await enforceEndpointRateLimit(req, res, {
    namespace: 'homepage_feed_api',
    windowMs: 60_000,
    maxRequests: 120,
    routeLabel: '/api/homepage-feed',
  });
  if (!rateOk) {
    return;
  }

  let parsedBody: any = {};
  if (req.method === 'POST') {
    const parsed = parseSafeJsonBody(req, { maxBytes: 10 * 1024 * 1024 });
    if (!parsed.ok) {
      return res.status(parsed.statusCode).json({ success: false, error: parsed.error });
    }
    parsedBody = parsed.body;
  }
  const action = getActionParam(req, parsedBody);

  // Scheduled / Admin Idempotent 24-Hour Expired Carousel Story Cleanup
  if (action === 'cleanup') {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    const cleanupAuth = await isAuthorizedCleanupRequest(req, parsedBody);
    if (!cleanupAuth.authorized) {
      return res.status(cleanupAuth.storeUnavailable ? 503 : 403).json({
        success: false,
        error: cleanupAuth.storeUnavailable
          ? 'Session revocation store unavailable.'
          : 'Forbidden: Valid CRON_SECRET or administrator credentials required for cleanup.',
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
      const authCheck = await verifyAdminRequestAsync(req.headers || {}, feed);
      if (!authCheck.authorized) {
        return res.status(authCheck.storeUnavailable ? 503 : 403).json({
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
