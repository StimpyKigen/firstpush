import { handleTokenEconomyHttpRequest } from '../src/lib/serverTokenEconomy.js';

function resolveTokenEconomyPathname(req: any): string {
  const endpointParam = req?.query?.endpoint;
  if (endpointParam) {
    const joined = Array.isArray(endpointParam) ? endpointParam.join('/') : String(endpointParam);
    const cleaned = joined.replace(/^\/+|\/+$/g, '');
    if (cleaned === 'mpesa-verify-code' || cleaned === 'mpesa/verify-code') {
      return '/api/mpesa/verify-code';
    }
    if (cleaned) {
      return `/api/tokens/${cleaned}`;
    }
  }

  const rawUrl = String(req?.url || '/api/tokens');
  const pathname = rawUrl.split('?')[0] || '/api/tokens';
  return pathname;
}

export default async function handler(req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-user-token, x-firebase-id-token, x-user-uid, x-user-phone, x-admin-token, x-admin-phone'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : req.body || {};
    const pathname = resolveTokenEconomyPathname(req);
    const result = await handleTokenEconomyHttpRequest({
      method: req.method || 'GET',
      pathname,
      headers: req.headers || {},
      query: req.query || {},
      body,
    });
    return res.status(result.statusCode).json(result.payload);
  } catch {
    return res.status(500).json({
      success: false,
      error: 'Server token economy error.',
    });
  }
}
