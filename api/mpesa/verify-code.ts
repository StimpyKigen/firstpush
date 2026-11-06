import { handleTokenEconomyHttpRequest } from '../../src/lib/serverTokenEconomy.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-user-token, x-user-uid, x-user-phone, x-user-pin-hash'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const body = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : req.body || {};
    const result = await handleTokenEconomyHttpRequest({
      method: req.method || 'POST',
      pathname: '/api/mpesa/verify-code',
      headers: req.headers || {},
      query: req.query || {},
      body,
    });
    return res.status(result.statusCode).json(result.payload);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Payment verification error.',
    });
  }
}

