import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { fetchSportpesaMegaMirror, fetchBetikaMidweekMirror } from './src/lib/jackpotMirrorService';
import {
  discoverAllLeagues,
  queryMarketFixtures,
  getDailyMarketHighlights,
  getMarketResults,
  getSyncDiagnostics,
  executeRollingSyncCycle,
  syncLiveScoresOnly,
  fetchAuthoritativeSportScoreMatchDetail,
  getLocalDateStringEAT,
  ingestAdminFixtures,
  clearAllFixtures,
  getSavedAdminFixtures,
  getSavedAdminBatches,
  deleteAdminBatch,
  startLiveTelemetryCoordinator,
} from './src/lib/sportsFeedService';
import { realtimeBroadcaster } from './src/lib/realtimeBroadcaster';
import {
  fetchBet365OddsForMatch,
  isValidSportScoreSlug,
  sanitizeSportScoreMatchPath,
} from './src/lib/sportscoreOddsService';
import {
  extractPdfTextServer,
  decodePdfBase64Payload,
  PdfParseSecurityError,
} from './src/lib/serverPdfParser';
import {
  getSavedHomepageFeedAsync,
  saveHomepageFeedAsync,
  cleanupExpiredCarouselPostsAsync,
  savePermanentMediaAsset,
  getPermanentMediaAsset,
  MediaValidationError,
} from './src/lib/serverHomepageFeed';
import {
  verifyAdminPinCredentials,
  verifyAdminRequestAsync,
  revokeAdminTokenAsync,
  MAX_ADMIN_TOKEN_TTL_MS,
  constantTimeEqualText,
} from './src/lib/adminAuthService';
import { getDevAllowedHosts } from './src/lib/devAllowedHosts';
import {
  handleTokenEconomyHttpRequest,
  enforceAuthenticatedChatCooldown,
} from './src/lib/serverTokenEconomy';
import { handleSubscriptionHttpRequest } from './src/lib/serverSubscriptionService';
import { handleAuthHttpRequest } from './src/lib/serverAuthService';
import {
  ADMIN_SESSION_COOKIE_NAME,
  appendSetCookieHeader,
  buildClearCookieHeader,
  buildSessionCookieHeader,
  getCookieFromHeaders,
  isHttpsRequest,
} from './src/lib/firebaseIdTokenVerifier';
import { parseJackpotWebpageText } from './src/lib/jackpotWebParser';
import {
  initWeeklyFixtureScheduler,
  getWeeklySchedulerStatus,
  executeWeeklyIngestion,
} from './src/lib/weeklyFixtureService';
import {
  applyCorsPolicy,
  applyStandardSecurityHeaders,
} from './src/lib/httpSecurity';
import {
  createExpressRateLimiter,
  extractTrustedClientIp,
} from './src/lib/rateLimitService';
import {
  recordSecurityEvent,
  querySecurityEvents,
} from './src/lib/securityAuditLogger';
import { handleModerationHttpRequest } from './src/lib/serverModerationService';

function verifyCronSecretBearer(authHeader?: string | string[]): boolean {
  const cronSecret = (process.env.CRON_SECRET || '').trim();
  if (!cronSecret) return false;
  const headerStr = Array.isArray(authHeader) ? authHeader[0] || '' : String(authHeader || '');
  return constantTimeEqualText(headerStr, `Bearer ${cronSecret}`);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  const isProd = process.env.NODE_ENV === 'production';

  // Trust first proxy hop (e.g. Cloudflare, Cloud Run, nginx)
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Defense-in-depth Security Headers Middleware (CSP, HSTS, Frame Protection, Referrer/Permissions Policy)
  app.use((req, res, next) => {
    const isApi = req.path.startsWith('/api/');
    applyStandardSecurityHeaders(req, res, { isApi, isDev: !isProd });
    next();
  });

  // Trusted-Origin CORS & Preflight Middleware on /api/*
  app.use('/api', (req, res, next) => {
    const cors = applyCorsPolicy(req, res, {
      methods: 'GET, POST, DELETE, OPTIONS',
      allowHeaders:
        'Content-Type, Authorization, Last-Event-ID, x-user-token, x-firebase-id-token, x-admin-token',
    });
    if (cors.preflightHandled) {
      return;
    }
    next();
  });

  // Large JSON body parser strictly scoped to PDF & permanent media upload routes
  const largeUploadJsonParser = express.json({ limit: '15mb' });
  const defaultJsonParser = express.json({ limit: '1mb' });
  app.use('/api/admin/parse-pdf', largeUploadJsonParser);
  app.use('/api/admin/upload-media', largeUploadJsonParser);
  app.use('/api/homepage-feed/upload-media', largeUploadJsonParser);
  app.use((req, res, next) => {
    if (
      req.path === '/api/admin/parse-pdf' ||
      req.path === '/api/admin/upload-media' ||
      req.path === '/api/homepage-feed/upload-media'
    ) {
      return next();
    }
    return defaultJsonParser(req, res, next);
  });

  // Controlled JSON syntax & payload-size error handler (prevents 500/HTML stack traces)
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
      return res.status(413).json({
        success: false,
        error: 'Request payload exceeds maximum allowed size.',
      });
    }
    if (err && (err instanceof SyntaxError || err.type === 'entity.parse.failed' || err.status === 400)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON request body.',
      });
    }
    return next(err);
  });

  // Distributed Rate Limiting Rules (MSH-029)
  const generalApiLimiter = createExpressRateLimiter({
    namespace: 'express_general_api',
    windowMs: 60_000,
    maxRequests: 120,
  });
  const geminiAiLimiter = createExpressRateLimiter({
    namespace: 'express_gemini_ai',
    windowMs: 60_000,
    maxRequests: 20,
  });
  const adminAuthLimiter = createExpressRateLimiter({
    namespace: 'admin_verify_pin',
    windowMs: 60_000,
    maxRequests: 20,
  });
  const moderationReportLimiter = createExpressRateLimiter({
    namespace: 'moderation_report_submit',
    windowMs: 15 * 60_000,
    maxRequests: 12,
  });

  app.use('/api/', generalApiLimiter);
  app.use('/api/gemini/', geminiAiLimiter);
  app.use('/api/admin/verify-pin', adminAuthLimiter);
  app.post('/api/moderation/reports', moderationReportLimiter);

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'Mshindi Projo Backend', timestamp: new Date().toISOString() });
  });

  // Admin Fixtures Management APIs
  app.get('/api/admin/fixtures', (req: Request, res: Response) => {
    try {
      const fixtures = getSavedAdminFixtures();
      const batches = getSavedAdminBatches();
      res.json({ success: true, count: fixtures.length, fixtures, batches });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to get admin fixtures' });
    }
  });

  app.post('/api/admin/fixtures', async (req: Request, res: Response) => {
    try {
      const authCheck = await verifyAdminRequestAsync(req.headers as any, req.body);
      if (!authCheck.authorized) {
        return res.status(authCheck.storeUnavailable ? 503 : 403).json({
          success: false,
          error: authCheck.reason || 'Forbidden: Administrator permissions required.',
        });
      }
      const fixtures = Array.isArray(req.body?.fixtures) ? req.body.fixtures : [];
      const fileName = req.body?.fileName || 'uploaded-fixtures.pdf';
      const sectoredCount = req.body?.sectoredCount || 1;
      const result = ingestAdminFixtures(fixtures, { fileName, sectoredCount });
      res.json({
        success: true,
        count: result.totalCount,
        addedCount: result.addedCount,
        batches: result.batches,
        message: `Successfully processed ${fixtures.length} fixtures (${result.addedCount} new, total ${result.totalCount}).`,
      });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to ingest admin fixtures' });
    }
  });

  app.delete('/api/admin/fixtures/batch/:id', async (req: Request, res: Response) => {
    try {
      const authCheck = await verifyAdminRequestAsync(req.headers as any, req.body);
      if (!authCheck.authorized) {
        return res.status(authCheck.storeUnavailable ? 503 : 403).json({
          success: false,
          error: authCheck.reason || 'Forbidden: Administrator permissions required.',
        });
      }
      deleteAdminBatch(req.params.id);
      res.json({ success: true, message: 'Batch removed successfully.', batches: getSavedAdminBatches() });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to remove batch' });
    }
  });

  app.delete('/api/admin/fixtures', async (req: Request, res: Response) => {
    try {
      const authCheck = await verifyAdminRequestAsync(req.headers as any, req.body);
      if (!authCheck.authorized) {
        return res.status(authCheck.storeUnavailable ? 503 : 403).json({
          success: false,
          error: authCheck.reason || 'Forbidden: Administrator permissions required.',
        });
      }
      clearAllFixtures();
      res.json({ success: true, message: 'All fixtures cleared from match slate.' });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to clear fixtures' });
    }
  });

  app.post('/api/admin/parse-pdf', async (req: Request, res: Response) => {
    try {
      const authCheck = await verifyAdminRequestAsync(req.headers as any, req.body);
      if (!authCheck.authorized) {
        return res.status(authCheck.storeUnavailable ? 503 : 403).json({
          success: false,
          error: authCheck.reason || 'Forbidden: Administrator permissions required.',
        });
      }
      const buffer = decodePdfBase64Payload(req.body?.base64);
      const text = extractPdfTextServer(buffer);
      res.json({ success: true, text });
    } catch (err: any) {
      if (err instanceof PdfParseSecurityError) {
        void recordSecurityEvent({
          category: 'PDF_SECURITY',
          severity: 'critical',
          action: 'pdf_bomb_or_malformed_blocked',
          outcome: 'blocked',
          actorId: 'ADMIN:254743304579',
          ip: extractTrustedClientIp(req),
          route: '/api/admin/parse-pdf',
          details: { message: err.message, statusCode: err.statusCode },
        });
        return res.status(err.statusCode).json({ success: false, error: err.message });
      }
      res.status(500).json({ success: false, error: 'Failed to parse PDF on server' });
    }
  });

  app.get('/api/admin/security-logs', async (req: Request, res: Response) => {
    const authCheck = await verifyAdminRequestAsync(req.headers as any, {});
    if (!authCheck.authorized) {
      await recordSecurityEvent({
        category: 'ADMIN',
        severity: 'high',
        action: 'unauthorized_security_logs_read',
        outcome: 'blocked',
        ip: extractTrustedClientIp(req),
        route: '/api/admin/security-logs',
      });
      return res.status(authCheck.storeUnavailable ? 503 : 403).json({
        success: false,
        error: authCheck.reason || 'Forbidden: Administrator permissions required.',
      });
    }
    const limit = Number(req.query?.limit || 50);
    const onlyAlerts = String(req.query?.alerts || '') === 'true';
    const data = await querySecurityEvents({ limit, onlyAlerts });
    return res.json({ success: true, ...data });
  });

  // Homepage Editorial Feed APIs (Carousels & Video/Custom Embeds + 24h Story Cleanup)
  app.get('/api/homepage-feed', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
    if (String(req.query.action || '').toLowerCase() === 'cleanup') {
      const hasCron = verifyCronSecretBearer(req.headers.authorization);
      const adminCheck = hasCron ? { authorized: true } : await verifyAdminRequestAsync(req.headers as any, {});
      if (!adminCheck.authorized) {
        return res.status(adminCheck.storeUnavailable ? 503 : 403).json({
          success: false,
          error: adminCheck.storeUnavailable
            ? adminCheck.reason || 'Session revocation store unavailable.'
            : 'Forbidden: Valid CRON_SECRET or administrator credentials required for cleanup.',
        });
      }
      try {
        const result = await cleanupExpiredCarouselPostsAsync();
        return res.json({
          success: true,
          action: 'cleanup',
          serverTime: result.serverTime,
          removedIds: result.removedIds,
          purgedMediaUrls: result.purgedMediaUrls,
          remainingCarouselCount: result.remainingCarouselCount,
          firestoreUpdated: result.firestoreUpdated,
        });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err?.message || 'Cleanup failed' });
      }
    }

    try {
      const feed = await getSavedHomepageFeedAsync();
      res.json({ success: true, serverTime: new Date().toISOString(), feed });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to get homepage feed' });
    }
  });

  app.post('/api/homepage-feed', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
    try {
      const feed = req.body || {};
      const action = String(req.query.action || feed.action || '').toLowerCase();
      if (action === 'cleanup') {
        const hasCron = verifyCronSecretBearer(req.headers.authorization);
        const adminCheck = hasCron ? { authorized: true } : await verifyAdminRequestAsync(req.headers as any, feed);
        if (!adminCheck.authorized) {
          return res.status(adminCheck.storeUnavailable ? 503 : 403).json({
            success: false,
            error: adminCheck.storeUnavailable
              ? adminCheck.reason || 'Session revocation store unavailable.'
              : 'Forbidden: Valid CRON_SECRET or administrator credentials required for cleanup.',
          });
        }
        const result = await cleanupExpiredCarouselPostsAsync();
        return res.json({
          success: true,
          action: 'cleanup',
          serverTime: result.serverTime,
          removedIds: result.removedIds,
          purgedMediaUrls: result.purgedMediaUrls,
          remainingCarouselCount: result.remainingCarouselCount,
          firestoreUpdated: result.firestoreUpdated,
        });
      }

      const authCheck = await verifyAdminRequestAsync(req.headers as any, feed);
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
        res.json({
          success: true,
          serverTime: new Date().toISOString(),
          feed: result.feed,
          firestoreSaved: result.firestoreSaved,
          diskSaved: result.diskSaved,
        });
      } else {
        res.status(400).json({ success: false, error: 'Invalid feed payload' });
      }
    } catch {
      res.status(500).json({ success: false, error: 'Failed to save homepage feed' });
    }
  });

  // Media Upload API (Authoritative Server Storage for Feed & Admin Media)
  app.post('/api/admin/upload-media', async (req: Request, res: Response) => {
    try {
      const authCheck = await verifyAdminRequestAsync(req.headers as any, req.body);
      if (!authCheck.authorized) {
        return res.status(authCheck.storeUnavailable ? 503 : 403).json({
          success: false,
          error: authCheck.reason || 'Forbidden: Administrator permissions required.',
        });
      }

      const { dataUrl, fileName, folder = 'feed' } = req.body || {};
      if (!dataUrl || !fileName) {
        return res.status(400).json({ success: false, error: 'dataUrl and fileName are required' });
      }

      const saved = savePermanentMediaAsset({ dataUrl, fileName, folder });
      res.json({
        success: true,
        url: saved.publicUrl,
        dataUrl: saved.dataUrl,
        mimeType: saved.mimeType,
      });
    } catch (err: any) {
      if (err instanceof MediaValidationError) {
        return res.status(400).json({ success: false, error: err.message });
      }
      console.error('[UploadMedia] Server error:', err);
      res.status(500).json({ success: false, error: 'Failed to upload media' });
    }
  });

  // Dynamic Permanent Media Serving Route (survives container restarts via data/homepage_media.json)
  app.get('/images/uploads/:folder/:fileName', (req: Request, res: Response) => {
    try {
      const asset = getPermanentMediaAsset(req.params.folder, req.params.fileName);
      if (asset) {
        res.setHeader('Content-Type', asset.mimeType);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(asset.buffer);
      }
    } catch {}
    return res.status(404).json({ success: false, error: 'Media asset not found.' });
  });

  // Never allow /images/uploads/* to fall through to express.static or SPA index.html
  app.use('/images/uploads', (_req: Request, res: Response) => {
    return res.status(404).json({ success: false, error: 'Media asset not found.' });
  });

  /**
   * Super-Admin PIN Verification Endpoint
   * Securely validates administrator PIN on backend and issues signed admin token
   */
  app.post('/api/admin/verify-pin', async (req: Request, res: Response) => {
    try {
      const { phone, pin } = req.body || {};
      const clientIp = extractTrustedClientIp(req);
      const result = verifyAdminPinCredentials(phone, pin);
      if (!result.valid) {
        const status = result.misconfigured
          ? 503
          : result.error?.includes('Unauthorized')
            ? 403
            : 401;
        await recordSecurityEvent({
          category: 'ADMIN',
          severity: status === 403 ? 'high' : 'warning',
          action: 'admin_verify_pin_failed',
          outcome: 'failure',
          actorId: typeof phone === 'string' ? phone.slice(0, 32) : null,
          ip: clientIp,
          route: '/api/admin/verify-pin',
          details: { status },
        });
        return res.status(status).json({
          success: false,
          valid: false,
          error: result.error,
        });
      }
      await recordSecurityEvent({
        category: 'ADMIN',
        severity: 'info',
        action: 'admin_verify_pin_succeeded',
        outcome: 'allowed',
        actorId: 'ADMIN:254743304579',
        ip: clientIp,
        route: '/api/admin/verify-pin',
      });

      if (result.adminToken) {
        const adminCookie = buildSessionCookieHeader(
          ADMIN_SESSION_COOKIE_NAME,
          result.adminToken,
          Math.max(60, Math.floor(MAX_ADMIN_TOKEN_TTL_MS / 1000)),
          isHttpsRequest(req)
        );
        appendSetCookieHeader(res, adminCookie);
      }

      return res.json({
        success: true,
        valid: true,
        token: result.adminToken,
        adminToken: result.adminToken,
        message: 'Super-admin authenticated successfully.',
      });
    } catch (err) {
      return res.status(500).json({ success: false, valid: false, error: 'Admin authentication error.' });
    }
  });

  app.post('/api/admin/logout', async (req: Request, res: Response) => {
    const headerTok = String(req.headers['x-admin-token'] || '').trim();
    const cookieTok = getCookieFromHeaders(req.headers as any, ADMIN_SESSION_COOKIE_NAME);
    const bodyTok = typeof req.body?.adminToken === 'string' ? req.body.adminToken.trim() : '';
    const tok = cookieTok || headerTok || bodyTok;
    if (tok) {
      await revokeAdminTokenAsync(tok);
    }
    appendSetCookieHeader(res, buildClearCookieHeader(ADMIN_SESSION_COOKIE_NAME, isHttpsRequest(req)));
    return res.json({ success: true, loggedOut: true });
  });

  /**
   * Authoritative Server-Side User Authentication & Session Endpoints (/api/auth/*)
   */
  app.all(['/api/auth', '/api/auth/*'], async (req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const result = await handleAuthHttpRequest({
        method: req.method,
        pathname: req.path,
        headers: req.headers as any,
        query: req.query as any,
        body: req.body,
        secureCookie: isHttpsRequest(req),
      });
      if (result.setCookies && result.setCookies.length > 0) {
        for (const cookie of result.setCookies) {
          appendSetCookieHeader(res, cookie);
        }
      }
      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          res.setHeader(k, v);
        }
      }
      return res.status(result.statusCode).json(result.payload);
    } catch {
      return res.status(500).json({ success: false, error: 'Server authentication error.' });
    }
  });

  /**
   * Authoritative Server-Side Mshindi Token Economy & M-Pesa Payment Verification Endpoints
   */
  app.post('/api/mpesa/verify-code', async (req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const result = await handleTokenEconomyHttpRequest({
        method: 'POST',
        pathname: '/api/mpesa/verify-code',
        headers: req.headers as any,
        query: req.query as any,
        body: req.body,
      });
      return res.status(result.statusCode).json(result.payload);
    } catch {
      return res.status(500).json({ success: false, error: 'Payment verification error.' });
    }
  });

  app.all(['/api/tokens', '/api/tokens/*'], async (req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const result = await handleTokenEconomyHttpRequest({
        method: req.method,
        pathname: req.path,
        headers: req.headers as any,
        query: req.query as any,
        body: req.body,
      });
      return res.status(result.statusCode).json(result.payload);
    } catch {
      return res.status(500).json({ success: false, error: 'Server token economy error.' });
    }
  });

  app.all(['/api/subscription', '/api/subscription/*'], async (req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const result = await handleSubscriptionHttpRequest({
        method: req.method,
        pathname: req.path,
        headers: req.headers as any,
        query: req.query as any,
        body: req.body,
      });
      return res.status(result.statusCode).json(result.payload);
    } catch {
      return res.status(500).json({ success: false, error: 'Server subscription error.' });
    }
  });

  app.all(['/api/moderation', '/api/moderation/*'], async (req: Request, res: Response) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const result = await handleModerationHttpRequest({
        method: req.method,
        pathname: req.path,
        headers: req.headers as any,
        query: req.query as any,
        body: req.body,
      });
      return res.status(result.statusCode).json(result.payload);
    } catch {
      return res.status(500).json({ success: false, error: 'Server moderation error.' });
    }
  });

  // Live Mirrored Jackpot API
  app.get('/api/jackpots/mirror', async (req, res) => {
    try {
      const [sportpesaMega, betikaMidweek] = await Promise.all([
        fetchSportpesaMegaMirror(),
        fetchBetikaMidweekMirror(),
      ]);

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        jackpots: {
          sportpesaMega,
          betikaMidweek,
        },
      });
    } catch (err: any) {
      console.error('Jackpot Mirror API Error:', err);
      res.status(500).json({ error: 'Failed to fetch mirrored jackpot data' });
    }
  });

  // =========================================================================
  // SECURE SPORTS MARKET INTELLIGENCE & CONSENSUS ODDS API ENDPOINTS
  // =========================================================================

  app.get('/api/sports/leagues', async (req: Request, res: Response) => {
    try {
      const leagues = await discoverAllLeagues();
      res.json({ success: true, count: leagues.length, leagues });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve sports leagues.' });
    }
  });

  app.get('/api/sports/fixtures', async (req: Request, res: Response) => {
    try {
      const scope = (req.query.scope as any) || 'all';
      const league = req.query.league as string;
      const country = req.query.country as string;
      const date = req.query.date as string;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const fixtures = queryMarketFixtures({ scope, league, country, date, limit });
      res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
      res.json({ success: true, count: fixtures.length, fixtures });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve market fixtures.' });
    }
  });

  app.get('/api/sports/live', async (req: Request, res: Response) => {
    try {
      const diag = getSyncDiagnostics();
      const liveAgeMs = diag.lastLiveSyncTime ? Date.now() - new Date(diag.lastLiveSyncTime).getTime() : Infinity;
      if (liveAgeMs > 8_000) {
        await syncLiveScoresOnly();
      }
      const liveFixtures = queryMarketFixtures({ scope: 'live' });
      const now = new Date();
      const todayStr = getLocalDateStringEAT(now);
      const yesterdayStr = getLocalDateStringEAT(new Date(now.getTime() - 24 * 3600 * 1000));
      const recentlyFinished = [
        ...queryMarketFixtures({ scope: 'finished', date: todayStr }),
        ...queryMarketFixtures({ scope: 'finished', date: yesterdayStr }),
      ];
      res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
      res.json({
        success: true,
        count: liveFixtures.length,
        fixtures: liveFixtures,
        recentlyFinished,
        lastLiveSyncTime: getSyncDiagnostics().lastLiveSyncTime,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve live fixtures.' });
    }
  });

  app.get('/api/sports/results', async (req: Request, res: Response) => {
    try {
      const league = (req.query.league as string) || 'premier';
      const season = req.query.season as string;
      const results = await getMarketResults(league, season);
      res.json({ success: true, league, count: results.length, results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve match results.' });
    }
  });

  app.get('/api/sports/daily-fixtures', async (req: Request, res: Response) => {
    try {
      const highlights = await getDailyMarketHighlights();
      res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
      res.json({ success: true, count: highlights.length, fixtures: highlights });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve daily fixtures.' });
    }
  });


  // Real-Time Server-Sent Events (SSE) Stream Endpoints
  app.get('/api/sports/stream', (req: Request, res: Response) => {
    realtimeBroadcaster.registerClient(req, res);
    void syncLiveScoresOnly();
  });

  app.get('/api/sports/stream/status', (req: Request, res: Response) => {
    res.json({ success: true, metrics: realtimeBroadcaster.getMetrics() });
  });
  app.get('/api/sports/status', (req: Request, res: Response) => {
    try {
      const diagnostics = getSyncDiagnostics();
      res.json({ success: true, diagnostics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve telemetry diagnostics.' });
    }
  });

  app.post('/api/sports/sync', async (req: Request, res: Response) => {
    const hasCron = verifyCronSecretBearer(req.headers.authorization);
    const adminCheck = hasCron ? { authorized: true } : await verifyAdminRequestAsync(req.headers as any, req.body);
    if (!adminCheck.authorized) {
      return res.status(adminCheck.storeUnavailable ? 503 : 403).json({
        success: false,
        error: adminCheck.reason || 'Forbidden: Administrator permissions required.',
      });
    }
    try {
      const result = await executeRollingSyncCycle();
      res.json({ success: true, result, diagnostics: getSyncDiagnostics() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to execute synchronization.' });
    }
  });

  app.post('/api/sports/sync-live', async (req: Request, res: Response) => {
    const hasCron = verifyCronSecretBearer(req.headers.authorization);
    const adminCheck = hasCron ? { authorized: true } : await verifyAdminRequestAsync(req.headers as any, req.body);
    if (!adminCheck.authorized) {
      return res.status(adminCheck.storeUnavailable ? 503 : 403).json({
        success: false,
        error: adminCheck.reason || 'Forbidden: Administrator permissions required.',
      });
    }
    try {
      const result = await syncLiveScoresOnly();
      res.json({ success: true, result, diagnostics: getSyncDiagnostics() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to execute live synchronization.' });
    }
  });

  // Automated Weekly SportScore Fixture Ingestion APIs
  app.get('/api/sports/weekly-sync/status', (req: Request, res: Response) => {
    try {
      const status = getWeeklySchedulerStatus();
      res.json({ success: true, ...status });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to retrieve weekly sync status' });
    }
  });

  app.post('/api/sports/weekly-sync', async (req: Request, res: Response) => {
    const hasCron = verifyCronSecretBearer(req.headers.authorization);
    const adminCheck = hasCron ? { authorized: false } : await verifyAdminRequestAsync(req.headers as any, req.body);
    if (!adminCheck.authorized) {
      if (adminCheck.storeUnavailable && !hasCron) {
        return res.status(503).json({
          success: false,
          error: adminCheck.reason || 'Session revocation store unavailable.',
        });
      }
      const cronSecret = (process.env.CRON_SECRET || '').trim();
      if (!cronSecret) {
        return res.status(503).json({ success: false, error: 'CRON_SECRET is not configured.' });
      }
      if (!hasCron) {
        return res.status(401).json({ success: false, error: 'Unauthorized.' });
      }
    }
    try {
      const force = Boolean(req.body?.force);
      const startFromToday = req.body?.startFromToday !== undefined ? Boolean(req.body?.startFromToday) : true;
      const targetDomesticCount = req.body?.targetDomesticCount ? Number(req.body?.targetDomesticCount) : 28;
      const log = await executeWeeklyIngestion({ force, startFromToday, targetDomesticCount });
      res.json({ success: true, log });
    } catch {
      res.status(500).json({ success: false, error: 'Failed to execute weekly ingestion' });
    }
  });

  app.get('/api/sports/match-detail', async (req: Request, res: Response) => {
    try {
      const slug = String(req.query.slug || '').trim();
      if (!isValidSportScoreSlug(slug)) {
        return res.status(400).json({ error: 'Valid match slug is required.' });
      }

      const upstreamRes = await fetch(
        `https://sportscore.com/api/widget/match/?sport=football&slug=${encodeURIComponent(slug)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            Accept: 'application/json',
          },
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).json({ error: 'SportScore match detail not found.' });
      }

      const data = await upstreamRes.json();
      const isLive = data.match?.status === 'live' || data.match?.status === 'in' || String(data.match?.status_text || '').toLowerCase().includes('half');
      if (isLive) {
        res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      }
      return res.json(data);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch match details.' });
    }
  });

  app.get('/api/sports/match-odds', async (req: Request, res: Response) => {
    try {
      const safePath = sanitizeSportScoreMatchPath(req.query.url);
      if (!safePath) {
        return res.status(400).json({ success: false, error: 'Valid SportScore match URL is required.' });
      }

      const odds = await fetchBet365OddsForMatch(safePath);
      if (!odds) {
        return res.status(404).json({ success: false, error: 'Bet365 odds not available for this match.' });
      }

      res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600');
      return res.json({ success: true, odds });
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to retrieve match odds.' });
    }
  });

  app.get('/api/sports/standings', async (req: Request, res: Response) => {
    try {
      const slug = String(req.query.slug || '').trim();
      if (!isValidSportScoreSlug(slug)) {
        return res.status(400).json({ error: 'Valid competition slug is required.' });
      }

      const upstreamRes = await fetch(
        `https://sportscore.com/api/widget/standings/?sport=football&slug=${encodeURIComponent(slug)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            Accept: 'application/json',
          },
          redirect: 'error',
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).json({ error: 'SportScore standings not found.' });
      }

      const data = await upstreamRes.json();
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
      return res.json(data);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch standings.' });
    }
  });

  app.all('/api/sports/chat-cooldown', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    const result = await enforceAuthenticatedChatCooldown({
      headers: req.headers as any,
      body: req.body,
      query: req.query as any,
    });
    return res.status(result.statusCode).json(result.payload);
  });


  // Gemini AI Ava 24/7 Support Specialist API
  app.post('/api/gemini/support-chat', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is missing. Please set it in secrets.'
        });
      }

      const { message, history } = req.body;
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Message text is required.' });
      }
      if (message.length > 1000) {
        return res.status(400).json({ error: 'Message text exceeds maximum allowed limit of 1,000 characters.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `You are Ava, the friendly, smart, and ultra-helpful 24/7 AI Customer Support Specialist & Site Guide for MshindiRoom (Kenya's #1 Bet Slip Consensus & Punter Wager Platform).

Key Platform Details about MshindiRoom:
- What is MshindiRoom?: Kenya's premier punter community where sports fans analyze football bet slips, form consensus on 17-leg jackpots (SportPesa Mega Jackpot, Betika Midweek, MozzartBet 16, Odibets, etc.), play P2P wagers, build custom bet slips, rate punters, and view live gameweek leaderboards.
- Bookie Relationship: MshindiRoom is an analytical consensus community, NOT a licensed gambling operator. Punters place real bets directly on their bookies (SportPesa, Betika, etc.). MshindiRoom helps punters compare picks and pool knowledge.
- Jackpot Consensus Rooms vs Bet Builder (Key Differences):
  1. **Jackpot Rooms**: Fixed 13-17 match pools provided by bookmakers (SportPesa Mega Jackpot, Betika Midweek, MozzartBet, etc.) where all punters analyze the same fixed match list. Unlocking a room (flat rate of KSh 10 via M-Pesa, wallet balance, or Mshindi Tokens) reveals live community consensus percentages across all legs, 17-leg slip generators, verified punter chat, and qualifies your submitted slip for the Gameweek Leaderboard crown and Rating Points (RP).
  2. **Bet Builder**: A 100% FREE interactive custom accumulator tool. Instead of pre-set jackpot pools, you select individual daily matches, pick your outcomes (1X2, Over/Under 2.5, Both Teams To Score, Double Chance), aggregate odds in real-time, generate copyable bookie slip codes (SportPesa, Betika, Mozzart, 22Bet, Odibets), or share your custom multi-leg slip in the community slip feed.
- Gameweek Leaderboard & Crown: The eligible punter whose slip comes closest to the official winning jackpot outcome takes the #1 Leaderboard Crown! Equal scores are tied and settled by earliest slip submission time.
- 5-Star Punter Rating: Ratings range from 1.0 to 5.0 stars in half-star steps. They increase as slip accuracy improves over time and gain a bonus when crowned #1 in a jackpot.
- P2P Bets: Custom 1v1 wagers where punters challenge friends or community members on specific matches using M-Pesa escrow or room tokens.
- M-Pesa Deposits & Withdrawals: Automated M-Pesa Express (STK Push) for instant wallet top-ups, room unlocks, and withdrawals.
- Mobile PWA App: Users can install MshindiRoom to their home screen on Android or iPhone from the Profile page or footer for full offline access and consensus push alerts.
- Support Email: support@mshindiroom.co.ke

Strict Rules for Ava:
- STRICT UNLOCK FEE: The flat fee rate for Jackpot Rooms is strictly **KSh 10** for every punter (payable via M-Pesa, wallet balance, or Mshindi Tokens). Bet Builder is **100% FREE** to use. NEVER mention KSh 20, KSh 50, or any other price.
- CLEAR FEATURE COMPARISON: When asked about Bet Builder or Jackpot Rooms, clearly explain that Jackpot Rooms are fixed bookmaker pools (SportPesa, Betika) for the Leaderboard Crown (KSh 10 unlock), whereas Bet Builder is a free custom multi-match accumulator tool for daily fixtures.
- STRICT FACTUAL RESTRAINT: When explaining jackpot analysis, consensus data, or prizes, NEVER add foreign or external information, fake bookmaker bonuses, or unverified claims. Stick strictly to MshindiRoom's platform rules and features.
- Respond in a warm, polite, encouraging Kenyan customer support style.
- Use clear bullet points or bold formatting for step-by-step instructions.
- Keep answers concise, clear, and direct (max 2-3 short paragraphs).
- Always end with a helpful invitation for follow-up questions if needed.`;

      // Construct validated conversation context if history is supplied
      let formattedContents: any = message.trim();
      if (history !== undefined) {
        if (!Array.isArray(history) || history.length > 30) {
          return res.status(400).json({ error: 'Invalid chat history format.' });
        }
        const recentHistory = history
          .slice(-6)
          .filter((item: any) => item && typeof item.text === 'string' && item.text.trim().length > 0)
          .map((item: any) => ({
            role: item.sender === 'user' ? 'user' : 'model',
            parts: [{ text: item.text.trim().slice(0, 1000) }],
          }));
        recentHistory.push({
          role: 'user',
          parts: [{ text: message.trim() }],
        });
        formattedContents = recentHistory;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.6,
        },
      });

      res.json({
        success: true,
        text: response.text || "I'm Ava, your MshindiRoom support assistant! How else can I help you today?",
      });
    } catch (err: any) {
      console.error('Ava Support API Error:', err);
      res.status(500).json({ error: 'Failed to process support message.' });
    }
  });

  // Gemini AI Mshindi Advisor API
  app.post('/api/gemini/advisor', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is missing. Please set it in secrets.'
        });
      }

      const { prompt, mode } = req.body || {};
      if (prompt !== undefined && typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Advisor prompt must be a string.' });
      }
      const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
      if (cleanPrompt.length > 1500) {
        return res.status(400).json({ error: 'Advisor prompt exceeds maximum allowed limit of 1,500 characters.' });
      }
      const allowedModes = new Set(['standard', 'trivia', 'prediction']);
      const cleanMode = mode === undefined ? 'standard' : String(mode).trim().toLowerCase();
      if (!allowedModes.has(cleanMode)) {
        return res.status(400).json({ error: 'Invalid advisor mode.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let systemInstruction = "You are 'Mshindi AI Advisor', an expert AI sports analyst, trivia creator, and competition guide for Mshindi Projo platform in Kenya / East Africa.";
      if (cleanMode === 'trivia') {
        systemInstruction += " Generate 3 exciting, multiple-choice trivia questions with 4 options and 1 correct answer index about sports, history, or general knowledge. Format clearly.";
      } else if (cleanMode === 'prediction') {
        systemInstruction += " Provide insightful sports statistics, head-to-head analysis, and probable score predictions with key match highlights.";
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: cleanPrompt || 'Provide a daily sports highlight tip and trivia fact for Mshindi champions!',
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({
        success: true,
        text: response.text || 'Keep playing and winning on Mshindi Projo!'
      });
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      res.status(500).json({ error: 'Failed to generate AI response.' });
    }
  });

  // Gemini AI Jackpot Webpage Parser API (Admin Extension)
  app.post('/api/gemini/parse-jackpot-text', async (req, res) => {
    try {
      const adminKeyHeader = String(req.headers['x-admin-key'] || '');
      const configuredSecret = (process.env.ADMIN_SECRET || '').trim();
      const hasValidAdminSecret = Boolean(
        configuredSecret && adminKeyHeader && constantTimeEqualText(adminKeyHeader, configuredSecret)
      );
      const adminCheck = hasValidAdminSecret
        ? { authorized: true }
        : await verifyAdminRequestAsync(req.headers as any, req.body);
      if (!adminCheck.authorized && !hasValidAdminSecret) {
        return res.status(adminCheck.storeUnavailable ? 503 : 403).json({
          success: false,
          error: adminCheck.reason || 'Forbidden: Valid administrator authentication required to access jackpot parser.',
        });
      }

      const { rawText, bookie, legCount } = req.body;
      if (!rawText || !rawText.trim()) {
        return res.status(400).json({ error: 'Raw webpage text is required for parsing.' });
      }

      const targetLegs = Number(legCount) || 17;
      let matches: any[] = [];

      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const systemInstruction = `You are an expert sports betting jackpot fixture parser for Kenyan sportsbooks (SportPesa, Betika, MozzartBet, Odibets, Shabiki, BangBet, PariPesa, 22Bet, 1xBet, BetAfriq).
Given raw text copied and pasted from a betting jackpot webpage, accurately extract exactly ${targetLegs} football match fixtures sequentially in the exact jackpot order from Leg 1 to Leg ${targetLegs}.
STRICT RULES:
1. Ignore all non-match related text: site headers, footers, navigation links, login/register buttons, promotional banners, jackpot rules, bonus info, and marketing copy.
2. For each fixture extract:
   - home: Clean Home team name only (e.g. 'Arsenal')
   - away: Clean Away team name only (e.g. 'Chelsea')
   - competition: League or country competition (e.g. 'English Premier League', 'Spanish La Liga', 'Italian Serie A', 'German Bundesliga', etc.)
   - kickoff: Kick-off date and time formatted nicely (e.g. 'Sat 24 Oct · 17:00 EAT')
   - homePct: Estimated win percentage integer (20 to 75)
   - drawPct: Estimated draw percentage integer (20 to 40)
   - awayPct: Estimated away percentage integer (20 to 75)
3. Ensure the arrangement strictly matches the first leg to the last leg.
Return valid JSON with key 'matches' containing exactly ${targetLegs} items.`;

          const prompt = `Bookmaker: ${bookie || 'Kenyan Sportsbook'}\nTarget number of games/legs: ${targetLegs}\n\nRaw Webpage Content:\n${rawText.slice(0, 12000)}`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          });

          let parsed: any = { matches: [] };
          try {
            parsed = JSON.parse(response.text || '{}');
          } catch {
            console.warn('Failed to parse Gemini output as JSON directly');
          }
          if (Array.isArray(parsed?.matches) && parsed.matches.length > 0) {
            matches = parsed.matches;
          }
        } catch (aiErr) {
          console.warn('Gemini AI parsing encountered error, falling back to deterministic parser:', aiErr);
        }
      }

      // High-precision deterministic parser fallback if AI returned empty or is not available
      if (matches.length === 0) {
        matches = parseJackpotWebpageText(rawText, targetLegs);
      }

      res.json({
        success: true,
        bookie,
        legCount: matches.length,
        matches,
      });
    } catch (err: any) {
      console.error('Jackpot Parser Error:', err);
      // Even on general error, attempt fallback
      const { rawText, targetLegs } = req.body || {};
      const fallbackMatches = rawText ? parseJackpotWebpageText(rawText, Number(targetLegs) || 17) : [];
      if (fallbackMatches.length > 0) {
        return res.json({ success: true, legCount: fallbackMatches.length, matches: fallbackMatches });
      }
      res.status(500).json({ error: 'Failed to parse jackpot webpage text' });
    }
  });

  // Dynamic SEO Endpoints: Robots.txt & Sitemap.xml
  app.get('/robots.txt', (req: Request, res: Response) => {
    res.type('text/plain');
    res.send(`User-agent: *
Allow: /
Allow: /free
Allow: /free/
Allow: /room/
Allow: /leaderboard
Allow: /how-it-works
Allow: /slips
Allow: /privacy
Allow: /terms
Allow: /p2p

Disallow: /wallet
Disallow: /profile
Disallow: /auth
Disallow: /api/

Sitemap: https://mshindi.co.ke/sitemap.xml
`);
  });

  app.get('/sitemap.xml', (req: Request, res: Response) => {
    res.type('application/xml');
    const today = new Date().toISOString().split('T')[0];
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://mshindi.co.ke/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/free</loc>
    <lastmod>${today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/leaderboard</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/how-it-works</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/slips</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/p2p</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/room/sportpesa-mega</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/room/betika-midweek</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/room/mozzart-daily</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/privacy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/terms</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
</urlset>`);
  });

  // Global Error Handler Middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  // Vite development middleware vs Static Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: getDevAllowedHosts(),
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    // Hashed build assets in /assets/ are immutable for 1 year
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true,
      fallthrough: false,
    }));

    // Other static files (sw.js, version.json, manifest.json, icons, banners)
    app.use(express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        const base = path.basename(filePath).toLowerCase();
        if (base === 'sw.js' || base === 'version.json' || base === 'index.html') {
          res.setHeader('Cache-Control', 'public, max-age=0, no-cache, no-store, must-revalidate');
        } else if (base === 'manifest.json') {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        }
      },
    }));

    app.get('*', (req, res) => {
      if (
        req.path.startsWith('/assets/') ||
        req.path === '/sw.js' ||
        req.path === '/version.json' ||
        req.path === '/manifest.json' ||
        req.path === '/theme-init.js'
      ) {
        return res.status(404).end();
      }
      res.setHeader('Cache-Control', 'public, max-age=0, no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Continuous automated SportScore scraping disabled per user mandate

  // Automated weekly SportScore fixture scheduler (Every Monday 00:00:00 Africa/Nairobi)
  initWeeklyFixtureScheduler();

  // Central live telemetry coordinator: polls SportScore live endpoint only when clients are connected
  startLiveTelemetryCoordinator(10_000);

  // Scheduled server-side 24-hour carousel story cleanup (runs on startup + every 10 minutes)
  void cleanupExpiredCarouselPostsAsync().catch(() => {});
  const carouselCleanupTimer = setInterval(() => {
    void cleanupExpiredCarouselPostsAsync().catch(() => {});
  }, 10 * 60 * 1000);
  if (typeof carouselCleanupTimer.unref === 'function') {
    carouselCleanupTimer.unref();
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mshindi Projo Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
