import { realtimeBroadcaster } from '../../src/lib/realtimeBroadcaster.js';

export const config = {
  // Support streaming responses on Vercel Node runtime
  maxDuration: 60,
};

export default function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Last-Event-ID');
    return res.status(200).end();
  }

  return realtimeBroadcaster.registerClient(req, res);
}
