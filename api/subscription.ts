import { handleSubscriptionHttpRequest } from '../src/lib/serverSubscriptionService.js';
import {
  applyCorsPolicy,
  applyStandardSecurityHeaders,
  parseSafeJsonBody,
} from '../src/lib/httpSecurity.js';

function resolveSubscriptionPathname(req: any): string {
  const endpointParam = req?.query?.endpoint;
  if (endpointParam) {
    const joined = Array.isArray(endpointParam) ? endpointParam.join('/') : String(endpointParam);
    const cleaned = joined.replace(/^\/+|\/+$/g, '');
    if (cleaned) {
      return `/api/subscription/${cleaned}`;
    }
  }

  const rawUrl = String(req?.url || '/api/subscription');
  const pathname = rawUrl.split('?')[0] || '/api/subscription';
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

  const parsed = parseSafeJsonBody(req, { maxBytes: 1 * 1024 * 1024 });
  if (!parsed.ok) {
    return res.status(parsed.statusCode).json({ success: false, error: parsed.error });
  }

  try {
    const pathname = resolveSubscriptionPathname(req);
    const result = await handleSubscriptionHttpRequest({
      method: req.method || 'GET',
      pathname,
      headers: req.headers || {},
      query: req.query || {},
      body: parsed.body,
    });
    return res.status(result.statusCode).json(result.payload);
  } catch {
    return res.status(500).json({
      success: false,
      error: 'Server subscription error.',
    });
  }
}
