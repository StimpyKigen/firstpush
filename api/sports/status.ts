import { getSyncDiagnostics } from '../../src/lib/sportsFeedService';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const diagnostics = getSyncDiagnostics();
    return res.status(200).json({ success: true, diagnostics });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve telemetry diagnostics.' });
  }
}
