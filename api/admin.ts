import { savePermanentMediaAsset } from '../src/lib/serverHomepageFeed.js';
import { verifyAdminPinCredentials, verifyAdminRequest } from '../src/lib/adminAuthService.js';
import {
  getSavedAdminFixtures,
  getSavedAdminBatches,
  ingestAdminFixtures,
  clearAllFixtures,
  deleteAdminBatch,
} from '../src/lib/sportsFeedService.js';
import { extractPdfTextServer } from '../src/lib/serverPdfParser.js';

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

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-admin-token, x-admin-phone, x-admin-pin'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const body = typeof req.body === 'string' && req.body ? JSON.parse(req.body) : req.body || {};

  // 1. Super-Admin PIN Verification (/api/admin/verify-pin)
  if (subpathLower === 'verify-pin') {
    if (req.method !== 'POST') {
      return res.status(405).json({ valid: false, error: 'Method not allowed.' });
    }
    try {
      const result = verifyAdminPinCredentials(body.phone, body.pin);
      if (!result.valid) {
        const status = result.error?.includes('Unauthorized') ? 403 : 401;
        return res.status(status).json({
          success: false,
          valid: false,
          error: result.error,
        });
      }
      return res.status(200).json({
        success: true,
        valid: true,
        token: result.adminToken,
        adminToken: result.adminToken,
        message: 'Super-admin authenticated successfully.',
      });
    } catch (err: any) {
      return res.status(500).json({ valid: false, error: err?.message || 'Verification error' });
    }
  }

  // 2. Authoritative Media Asset Upload (/api/admin/upload-media)
  if (subpathLower === 'upload-media') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    try {
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

  // 3. Admin Fixtures Management (/api/admin/fixtures & /api/admin/fixtures/batch/:id)
  if (subpathLower === 'fixtures') {
    try {
      if (req.method === 'GET') {
        const fixtures = getSavedAdminFixtures();
        const batches = getSavedAdminBatches();
        return res.status(200).json({ success: true, count: fixtures.length, fixtures, batches });
      }
      if (req.method === 'POST') {
        const authCheck = verifyAdminRequest(req.headers || {}, body);
        if (!authCheck.authorized) {
          return res.status(403).json({
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
        const authCheck = verifyAdminRequest(req.headers || {}, body);
        if (!authCheck.authorized) {
          return res.status(403).json({
            success: false,
            error: authCheck.reason || 'Forbidden: Administrator permissions required.',
          });
        }
        clearAllFixtures();
        return res.status(200).json({ success: true, message: 'All fixtures cleared from match slate.' });
      }
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to process admin fixtures' });
    }
  }

  if (subpathLower.startsWith('fixtures/batch/')) {
    if (req.method !== 'DELETE') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    try {
      const authCheck = verifyAdminRequest(req.headers || {}, body);
      if (!authCheck.authorized) {
        return res.status(403).json({
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
      return res.status(500).json({ success: false, error: err?.message || 'Failed to remove batch' });
    }
  }

  // 4. Server-Side PDF Fixture Parser (/api/admin/parse-pdf)
  if (subpathLower === 'parse-pdf') {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    try {
      const base64 = body.base64;
      if (!base64) {
        return res.status(400).json({ success: false, error: 'base64 PDF data is required.' });
      }
      const buffer = Buffer.from(base64, 'base64');
      const text = extractPdfTextServer(buffer);
      return res.status(200).json({ success: true, text });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Failed to parse PDF on server' });
    }
  }

  return res.status(404).json({ success: false, error: `Unknown admin endpoint: ${subpath || '/'}` });
}

