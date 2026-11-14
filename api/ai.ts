import {
  buildHealthPayload,
  handleJackpotsMirrorRequest,
  handleGeminiSupportChatRequest,
  handleGeminiAdvisorRequest,
  handleGeminiParseJackpotTextRequest,
} from '../src/lib/serverAiService.js';
import {
  applyCorsPolicy,
  applyStandardSecurityHeaders,
  parseSafeJsonBody,
} from '../src/lib/httpSecurity.js';
import { enforceEndpointRateLimit } from '../src/lib/rateLimitService.js';

function resolveAiRoute(req: any): string {
  const endpointParam = req?.query?.endpoint;
  if (endpointParam) {
    const joined = Array.isArray(endpointParam) ? endpointParam.join('/') : String(endpointParam);
    const cleaned = joined.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (cleaned) return cleaned;
  }

  const rawUrl = String(req?.url || '').split('?')[0].replace(/\/+$/, '').toLowerCase();
  if (rawUrl === '/api/health') return 'health';
  if (rawUrl === '/api/jackpots/mirror') return 'jackpots-mirror';
  if (rawUrl.startsWith('/api/gemini/')) {
    return rawUrl.slice('/api/gemini/'.length).replace(/^\/+|\/+$/g, '');
  }
  return 'not-found';
}

export default async function handler(req: any, res: any) {
  applyStandardSecurityHeaders(req, res, { isApi: true });
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');

  const cors = applyCorsPolicy(req, res, {
    methods: 'GET, POST, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, x-admin-token, x-admin-key',
  });
  if (cors.preflightHandled) {
    return;
  }

  const route = resolveAiRoute(req);
  const isGeminiRoute =
    route === 'support-chat' || route === 'advisor' || route === 'parse-jackpot-text';

  const rateOk = await enforceEndpointRateLimit(req, res, {
    namespace: isGeminiRoute ? 'gemini_ai' : 'ai_public_api',
    windowMs: 60_000,
    maxRequests: isGeminiRoute ? 20 : 120,
    routeLabel: `/api/${isGeminiRoute ? `gemini/${route}` : route}`,
  });
  if (!rateOk) {
    return;
  }

  const method = String(req.method || 'GET').toUpperCase();
  let parsedBody: Record<string, any> = {};
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const parsed = parseSafeJsonBody(req, { maxBytes: 1 * 1024 * 1024 });
    if (!parsed.ok) {
      return res.status(parsed.statusCode).json({ success: false, error: parsed.error });
    }
    parsedBody = parsed.body;
  }

  if (route === 'health') {
    if (method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    const out = buildHealthPayload();
    return res.status(out.statusCode).json(out.payload);
  }

  if (route === 'jackpots-mirror' || route === 'mirror') {
    if (method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    const out = await handleJackpotsMirrorRequest();
    return res.status(out.statusCode).json(out.payload);
  }

  if (route === 'support-chat') {
    if (method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    const out = await handleGeminiSupportChatRequest(parsedBody);
    return res.status(out.statusCode).json(out.payload);
  }

  if (route === 'advisor') {
    if (method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    const out = await handleGeminiAdvisorRequest(parsedBody);
    return res.status(out.statusCode).json(out.payload);
  }

  if (route === 'parse-jackpot-text') {
    if (method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed.' });
    }
    const out = await handleGeminiParseJackpotTextRequest({
      headers: req.headers || {},
      body: parsedBody,
    });
    return res.status(out.statusCode).json(out.payload);
  }

  return res.status(404).json({
    success: false,
    error: `Unknown API endpoint: ${String(req.url || '').split('?')[0] || route}`,
  });
}

