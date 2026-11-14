import { savePermanentMediaAssetAsync, MediaValidationError } from '../src/lib/serverHomepageFeed.js';
import {
  verifyAdminPinCredentials,
  verifyAdminRequestAsync,
  revokeAdminTokenAsync,
  MAX_ADMIN_TOKEN_TTL_MS,
} from '../src/lib/adminAuthService.js';
import {
  ADMIN_SESSION_COOKIE_NAME,
  appendSetCookieHeader,
  buildClearCookieHeader,
  buildSessionCookieHeader,
  getCookieFromHeaders,
  isHttpsRequest,
} from '../src/lib/firebaseIdTokenVerifier.js';
import {
  getSavedAdminFixtures,
  getSavedAdminBatches,
  ingestAdminFixtures,
  clearAllFixtures,
  deleteAdminBatch,
} from '../src/lib/sportsFeedService.js';
import {
  extractPdfTextServer,
  decodePdfBase64Payload,
  PdfParseSecurityError,
} from '../src/lib/serverPdfParser.js';
import {
  applyCorsPolicy,
  applyStandardSecurityHeaders,
  parseSafeJsonBody,
} from '../src/lib/httpSecurity.js';
import {
  enforceEndpointRateLimit,
  extractTrustedClientIp,
} from '../src/lib/rateLimitService.js';
import {
  recordSecurityEvent,
  querySecurityEvents,
} from '../src/lib/securityAuditLogger.js';

function resolveAdminSubpath(req: any): string {
  const endpointParam = req?.query?.endpoint;
  if (endpointParam) {
    const joined = Array.isArray(endpointParam) ? endpointParam.join('/') : String(endpointParam);
    const cleaned = joined.replace(/^\/+|\/+$/g, '');
    if (cleaned) return cleaned;
  }

  const rawUrl = String(req?.url || '');
  const pathname = (rawUrl.split('?')[0] || '').replace(/\/+$/, '');
  if (pathname.startsWith('/api/admin/')) {
    return pathname.replace(/^\/api\/admin\//, '');
  }
  return '';
}

export default async function handler(req: any, res: any) {
  const subpath = resolveAdminSubpath(req);
  const subpathLower = subpath.toLowerCase();

  applyStandardSecurityHeaders(req, res, { isApi: true });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const cors = applyCorsPolicy(req, res, {
    methods: 'GET, POST, DELETE, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, x-admin-token',
  });
  if (cors.preflightHandled) {
    return;
  }

  const rateOk = await enforceEndpointRateLimit(req, res, {
    namespace: subpathLower === 'verify-pin' ? 'admin_verify_pin' : 'admin_api',
    windowMs: 60_000,
    maxRequests: subpathLower === 'verify-pin' ? 20 : 120,
    routeLabel: `/api/admin/${subpathLower}`,
  });
  if (!rateOk) {
    return;
  }

  const clientIp = extractTrustedClientIp(req);

  const maxBodyBytes =
    subpathLower === 'parse-pdf' || subpathLower === 'upload-media'
      ? 15 * 1024 * 1024
      : 2 * 1024 * 1024;
  const parsed = parseSafeJsonBody(req, { maxBytes: maxBodyBytes });
  if (!parsed.ok) {
    return res.status(parsed.statusCode).json({ success: false, error: parsed.error });
  }
  const body = parsed.body;

  // 1. Super-Admin PIN Verification (/api/admin/verify-pin)
  if (subpathLower === 'verify-pin') {
    if (req.method !== 'POST') {
      return res.status(405).json({ valid: false, error: 'Method not allowed.' });
    }
    try {
      const result = verifyAdminPinCredentials(body.phone, body.pin);
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
          actorId: typeof body.phone === 'string' ? body.phone.slice(0, 32) : null,
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
      return res.status(200).json({
        success: true,
        valid: true,
        token: result.adminToken,
        adminToken: result.adminToken,
        message: 'Super-admin authenticated successfully.',
      });
    } catch (err: any) {
      console.error('[api/admin] verify-pin error:', err);
      return res.status(500).json({ valid: false, error: 'Unable to verify administrator credentials right now.' });
    }
  }

  // 1b. Super-Admin Logout (/api/admin/logout)
  if (subpathLower === 'logout') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    const headerTok = String(req.headers?.['x-admin-token'] || '').trim();
    const cookieTok = getCookieFromHeaders(req.headers || {}, ADMIN_SESSION_COOKIE_NAME);
    const bodyTok = typeof body.adminToken === 'string' ? body.adminToken.trim() : '';
    const tok = cookieTok || headerTok || bodyTok;
    if (tok) {
      await revokeAdminTokenAsync(tok);
    }
    appendSetCookieHeader(res, buildClearCookieHeader(ADMIN_SESSION_COOKIE_NAME, isHttpsRequest(req)));
    return res.status(200).json({ success: true, loggedOut: true });
  }

  // 2. Authoritative Media Asset Upload (/api/admin/upload-media)
  if (subpathLower === 'upload-media') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    try {
      const authCheck = await verifyAdminRequestAsync(req.headers || {}, body);
      if (!authCheck.authorized) {
        return res.status(authCheck.storeUnavailable ? 503 : 403).json({
          success: false,
          error: authCheck.reason || 'Forbidden: Administrator permissions required.',
        });
      }

      const { dataUrl, fileName, folder = 'feed' } = body;
      if (!dataUrl || !fileName) {
        return res.status(400).json({
          success: false,
          error: 'dataUrl and fileName are required.',
        });
      }

      const saved = await savePermanentMediaAssetAsync({ dataUrl, fileName, folder });
      return res.status(200).json({
        success: true,
        url: saved.publicUrl,
        dataUrl: saved.dataUrl,
        mimeType: saved.mimeType,
      });
    } catch (err: any) {
      if (err instanceof MediaValidationError) {
        return res.status(400).json({
          success: false,
          error: err.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to upload media.',
      });
    }
  }

  // 3. Admin Fixtures Management (/api/admin/fixtures & /api/admin/fixtures/batch/:id)
  if (subpathLower === 'fixtures') {
    try {
      if (req.method === 'GET') {
        const fixtures = getSavedAdminFixtures();
        const batches = getSavedAdminBatches();
        return res.status(200).json({ success: true, count: fixtures.length, fixtures, batches });
      }
      if (req.method === 'POST') {
        const authCheck = await verifyAdminRequestAsync(req.headers || {}, body);
        if (!authCheck.authorized) {
          return res.status(authCheck.storeUnavailable ? 503 : 403).json({
            success: false,
            error: authCheck.reason || 'Forbidden: Administrator permissions required.',
          });
        }
        const fixtures = Array.isArray(body.fixtures) ? body.fixtures : [];
        const fileName = body.fileName || 'uploaded-fixtures.pdf';
        const sectoredCount = body.sectoredCount || 1;
        const result = ingestAdminFixtures(fixtures, { fileName, sectoredCount });
        return res.status(200).json({
          success: true,
          count: result.totalCount,
          addedCount: result.addedCount,
          batches: result.batches,
          message: `Successfully processed ${fixtures.length} fixtures (${result.addedCount} new, total ${result.totalCount}).`,
        });
      }
      if (req.method === 'DELETE') {
        const authCheck = await verifyAdminRequestAsync(req.headers || {}, body);
        if (!authCheck.authorized) {
          return res.status(authCheck.storeUnavailable ? 503 : 403).json({
            success: false,
            error: authCheck.reason || 'Forbidden: Administrator permissions required.',
          });
        }
        clearAllFixtures();
        return res.status(200).json({ success: true, message: 'All fixtures cleared from match slate.' });
      }
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    } catch (err: any) {
      console.error('[api/admin] fixtures error:', err);
      return res.status(500).json({ success: false, error: 'Failed to process admin fixtures' });
    }
  }

  if (subpathLower.startsWith('fixtures/batch/')) {
    if (req.method !== 'DELETE') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    try {
      const authCheck = await verifyAdminRequestAsync(req.headers || {}, body);
      if (!authCheck.authorized) {
        return res.status(authCheck.storeUnavailable ? 503 : 403).json({
          success: false,
          error: authCheck.reason || 'Forbidden: Administrator permissions required.',
        });
      }
      const batchId = subpath.slice('fixtures/batch/'.length);
      deleteAdminBatch(batchId);
      return res.status(200).json({
        success: true,
        message: 'Batch removed successfully.',
        batches: getSavedAdminBatches(),
      });
    } catch (err: any) {
      console.error('[api/admin] delete batch error:', err);
      return res.status(500).json({ success: false, error: 'Failed to remove batch' });
    }
  }

  // 4. Server-Side PDF Fixture Parser (/api/admin/parse-pdf)
  if (subpathLower === 'parse-pdf') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    try {
      const authCheck = await verifyAdminRequestAsync(req.headers || {}, body);
      if (!authCheck.authorized) {
        return res.status(authCheck.storeUnavailable ? 503 : 403).json({
          success: false,
          error: authCheck.reason || 'Forbidden: Administrator permissions required.',
        });
      }
      const buffer = decodePdfBase64Payload(body.base64);
      const text = extractPdfTextServer(buffer);
      return res.status(200).json({ success: true, text });
    } catch (err: any) {
      if (err instanceof PdfParseSecurityError) {
        await recordSecurityEvent({
          category: 'PDF_SECURITY',
          severity: 'critical',
          action: 'pdf_bomb_or_malformed_blocked',
          outcome: 'blocked',
          actorId: 'ADMIN:254743304579',
          ip: clientIp,
          route: '/api/admin/parse-pdf',
          details: { message: err.message, statusCode: err.statusCode },
        });
        return res.status(err.statusCode).json({ success: false, error: err.message });
      }
      return res.status(500).json({ success: false, error: 'Failed to parse PDF on server' });
    }
  }

  // 5. Security Audit Logs Viewer (/api/admin/security-logs)
  if (subpathLower === 'security-logs') {
    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    const authCheck = await verifyAdminRequestAsync(req.headers || {}, body);
    if (!authCheck.authorized) {
      await recordSecurityEvent({
        category: 'ADMIN',
        severity: 'high',
        action: 'unauthorized_security_logs_read',
        outcome: 'blocked',
        ip: clientIp,
        route: '/api/admin/security-logs',
      });
      return res.status(authCheck.storeUnavailable ? 503 : 403).json({
        success: false,
        error: authCheck.reason || 'Forbidden: Administrator permissions required.',
      });
    }
    const limit = Number(req?.query?.limit || 50);
    const onlyAlerts = String(req?.query?.alerts || '') === 'true';
    const data = await querySecurityEvents({ limit, onlyAlerts });
    return res.status(200).json({ success: true, ...data });
  }

  return res.status(404).json({ success: false, error: `Unknown admin endpoint: ${subpath || '/'}` });
}

