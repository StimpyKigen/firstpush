import { handleSubscriptionHttpRequest } from '../src/lib/serverSubscriptionService.js';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-user-token, x-firebase-id-token, x-user-uid, x-user-phone, x-admin-token, x-admin-phone, x-admin-pin'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : req.body || {};
    const pathname = resolveSubscriptionPathname(req);
    const result = await handleSubscriptionHttpRequest({
      method: req.method || 'GET',
      pathname,
      headers: req.headers || {},
      query: req.query || {},
      body,
    });
    return res.status(result.statusCode).json(result.payload);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Server subscription error.',
    });
  }
}
