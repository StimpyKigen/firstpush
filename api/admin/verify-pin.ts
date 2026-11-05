import { verifyAdminPinCredentials } from '../../src/lib/adminAuthService.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method not allowed.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const result = verifyAdminPinCredentials(body.phone, body.pin);
    if (!result.valid) {
      const status = result.error?.includes('Unauthorized') ? 403 : 401;
      return res.status(status).json(result);
    }
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: err?.message || 'Verification error' });
  }
}

