import { handleAuthHttpRequest } from '../src/lib/serverAuthService.js';
import { appendSetCookieHeader, isHttpsRequest } from '../src/lib/firebaseIdTokenVerifier.js';

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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-user-token, x-firebase-id-token, x-admin-token'
    );
    return res.status(200).end();
  }

  try {
    const body = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : req.body || {};
    const pathname = resolveAuthPathname(req);
    const result = await handleAuthHttpRequest({
      method: req.method || 'GET',
      pathname,
      headers: req.headers || {},
      query: req.query || {},
      body,
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
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Server authentication error.',
    });
  }
}

