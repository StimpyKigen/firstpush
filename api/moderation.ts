import { handleModerationHttpRequest } from '../src/lib/serverModerationService.js';
import {
  applyCorsPolicy,
  applyStandardSecurityHeaders,
  parseSafeJsonBody,
} from '../src/lib/httpSecurity.js';
import { enforceEndpointRateLimit } from '../src/lib/rateLimitService.js';

function resolveModerationPathname(req: any): string {
  const endpointParam = req?.query?.endpoint;
  if (endpointParam) {
    const joined = Array.isArray(endpointParam) ? endpointParam.join('/') : String(endpointParam);
    const cleaned = joined.replace(/^\/+|\/+$/g, '');
    if (cleaned) {
      return `/api/moderation/${cleaned}`;
    }
  }

  const rawUrl = String(req?.url || '/api/moderation/dictionary');
  const pathname = rawUrl.split('?')[0] || '/api/moderation/dictionary';
  return pathname;
}

export default async function handler(req: any, res: any) {
  applyStandardSecurityHeaders(req, res, { isApi: true });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const cors = applyCorsPolicy(req, res, {
    methods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, x-user-token, x-firebase-id-token, x-admin-token',
  });
  if (cors.preflightHandled) {
    return;
  }

  const pathname = resolveModerationPathname(req);
  const method = String(req?.method || 'GET').toUpperCase();

  // Distributed rate limit on report submissions and moderation checks
  if (pathname.endsWith('/reports') && method === 'POST') {
    const ok = await enforceEndpointRateLimit(req, res, {
      namespace: 'moderation_report_submit',
      windowMs: 15 * 60_000,
      maxRequests: 12,
      routeLabel: pathname,
    });
    if (!ok) return;
  } else {
    const ok = await enforceEndpointRateLimit(req, res, {
      namespace: 'moderation_api',
      windowMs: 60_000,
      maxRequests: 120,
      routeLabel: pathname,
    });
    if (!ok) return;
  }

  const parsed = parseSafeJsonBody(req, { maxBytes: 1 * 1024 * 1024 });
  if (!parsed.ok) {
    return res.status(parsed.statusCode).json({ success: false, error: parsed.error });
  }

  try {
    const result = await handleModerationHttpRequest({
      method,
      pathname,
      headers: req.headers || {},
      query: req.query || {},
      body: parsed.body,
    });
    return res.status(result.statusCode).json(result.payload);
  } catch {
    return res.status(500).json({
      success: false,
      error: 'Server moderation service error.',
    });
  }
}

