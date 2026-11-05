import { savePermanentMediaAsset } from '../../src/lib/serverHomepageFeed.js';
import { verifyAdminRequest } from '../../src/lib/adminAuthService.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-admin-token, x-admin-phone, x-admin-pin'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const authCheck = verifyAdminRequest(req.headers || {}, body);
    if (!authCheck.authorized) {
      return res.status(403).json({
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

    const saved = savePermanentMediaAsset({ dataUrl, fileName, folder });
    return res.status(200).json({
      success: true,
      url: saved.publicUrl,
      dataUrl: saved.dataUrl,
      mimeType: saved.mimeType,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to upload media.',
    });
  }
}

