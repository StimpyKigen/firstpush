import { handleAuthHttpRequest } from '../src/lib/serverAuthService.js';
import { appendSetCookieHeader, isHttpsRequest } from '../src/lib/firebaseIdTokenVerifier.js';
import {
  applyCorsPolicy,
  applyStandardSecurityHeaders,
  parseSafeJsonBody,
} from '../src/lib/httpSecurity.js';
import { enforceEndpointRateLimit } from '../src/lib/rateLimitService.js';

function resolveAuthPathname(req: any): string {
  const endpointParam = req?.query?.endpoint;
  if (endpointParam) {
    const joined = Array.isArray(endpointParam) ? endpointParam.join('/') : String(endpointParam);
    const cleaned = joined.replace(/^\/+|\/+$/g, '');
    if (cleaned) {
      return `/api/auth/${cleaned}`;
    }
  }

  const rawUrl = String(req?.url || '/api/auth/me');
  const pathname = rawUrl.split('?')[0] || '/api/auth/me';
  return pathname;
}

export default async function handler(req: any, res: any) {
  applyStandardSecurityHeaders(req, res, { isApi: true });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const cors = applyCorsPolicy(req, res, {
    methods: 'GET, POST, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, x-user-token, x-firebase-id-token, x-admin-token',
  });
  if (cors.preflightHandled) {
    return;
  }

  const pathname = resolveAuthPathname(req);
  const rateOk = await enforceEndpointRateLimit(req, res, {
    namespace: pathname.endsWith('/login') || pathname.endsWith('/register') ? 'auth_write' : 'auth_api',
    windowMs: 60_000,
    maxRequests: 60,
    routeLabel: pathname,
  });
  if (!rateOk) {
    return;
  }

  const parsed = parseSafeJsonBody(req, { maxBytes: 1 * 1024 * 1024 });
  if (!parsed.ok) {
    return res.status(parsed.statusCode).json({ success: false, error: parsed.error });
  }

  try {
    const result = await handleAuthHttpRequest({
      method: req.method || 'GET',
      pathname,
      headers: req.headers || {},
      query: req.query || {},
      body: parsed.body,
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
    return res.status(500).json({
      success: false,
      error: 'Server authentication error.',
    });
  }
}

