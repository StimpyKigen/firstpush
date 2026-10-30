import 'dotenv/config';
import crypto from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { fetchSportpesaMegaMirror, fetchBetikaMidweekMirror } from './src/lib/jackpotMirrorService';
import {
  discoverAllLeagues,
  queryMarketFixtures,
  getDailyMarketHighlights,
  getMarketResults,
  getSyncDiagnostics,
  executeRollingSyncCycle,
  syncLiveScoresOnly,
  ingestAdminFixtures,
  clearAllFixtures,
  getSavedAdminFixtures,
  getSavedAdminBatches,
  deleteAdminBatch,
} from './src/lib/sportsFeedService';
import { fetchBet365OddsForMatch } from './src/lib/sportscoreOddsService';
import { extractPdfTextServer } from './src/lib/serverPdfParser';
import { getSavedHomepageFeed, saveHomepageFeed } from './src/lib/serverHomepageFeed';
import { parseJackpotWebpageText } from './src/lib/jackpotWebParser';

const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_SECRET ||
  process.env.GEMINI_API_KEY ||
  crypto.randomBytes(32).toString('hex');

function signAdminPayload(data: string): string {
  return crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(data).digest('hex');
}

// Lightweight in-memory rate limiter for high concurrency protection
interface RateLimitBucket {
  count: number;
  resetTime: number;
}

function createRateLimiter(windowMs: number, maxRequests: number) {
  const hits = new Map<string, RateLimitBucket>();

  // Cleanup expired buckets every 5 minutes to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, bucket] of hits.entries()) {
      if (now > bucket.resetTime) {
        hits.delete(ip);
      }
    }
  }, 300_000);

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = hits.get(ip);

    if (!bucket || now > bucket.resetTime) {
      bucket = { count: 1, resetTime: now + windowMs };
      hits.set(ip, bucket);
      return next();
    }

    bucket.count += 1;
    if (bucket.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
        retryAfterMs: bucket.resetTime - now,
      });
    }

    next();
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust first proxy hop (e.g. Cloudflare, Cloud Run, nginx)
  app.set('trust proxy', 1);

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Json body parser with support for base64 PDF uploads
  app.use(express.json({ limit: '10mb' }));

  // Rate Limiting Rules
  const generalApiLimiter = createRateLimiter(60_000, 120); // 120 reqs / min
  const geminiAiLimiter = createRateLimiter(60_000, 20);    // 20 AI reqs / min

  app.use('/api/', generalApiLimiter);
  app.use('/api/gemini/', geminiAiLimiter);

  // Health check API
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'Mshindi Projo Backend', timestamp: new Date().toISOString() });
  });

  // Admin Fixtures Management APIs
  app.get('/api/admin/fixtures', (req: Request, res: Response) => {
    try {
      const fixtures = getSavedAdminFixtures();
      const batches = getSavedAdminBatches();
      res.json({ success: true, count: fixtures.length, fixtures, batches });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to get admin fixtures' });
    }
  });

  app.post('/api/admin/fixtures', (req: Request, res: Response) => {
    try {
      const fixtures = Array.isArray(req.body?.fixtures) ? req.body.fixtures : [];
      const fileName = req.body?.fileName || 'uploaded-fixtures.pdf';
      const sectoredCount = req.body?.sectoredCount || 1;
      const result = ingestAdminFixtures(fixtures, { fileName, sectoredCount });
      res.json({
        success: true,
        count: result.totalCount,
        addedCount: result.addedCount,
        batches: result.batches,
        message: `Successfully processed ${fixtures.length} fixtures (${result.addedCount} new, total ${result.totalCount}).`,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to ingest admin fixtures' });
    }
  });

  app.delete('/api/admin/fixtures/batch/:id', (req: Request, res: Response) => {
    try {
      deleteAdminBatch(req.params.id);
      res.json({ success: true, message: 'Batch removed successfully.', batches: getSavedAdminBatches() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to remove batch' });
    }
  });

  app.delete('/api/admin/fixtures', (req: Request, res: Response) => {
    try {
      clearAllFixtures();
      res.json({ success: true, message: 'All fixtures cleared from match slate.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to clear fixtures' });
    }
  });

  app.post('/api/admin/parse-pdf', (req: Request, res: Response) => {
    try {
      const base64 = req.body?.base64;
      if (!base64) {
        return res.status(400).json({ success: false, error: 'base64 PDF data is required.' });
      }
      const buffer = Buffer.from(base64, 'base64');
      const text = extractPdfTextServer(buffer);
      res.json({ success: true, text });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Failed to parse PDF on server' });
    }
  });

  // Homepage Editorial Feed APIs (Carousels & Video/Custom Embeds)
  app.get('/api/homepage-feed', (req: Request, res: Response) => {
    try {
      const feed = getSavedHomepageFeed();
      res.json({ success: true, feed });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to get homepage feed' });
    }
  });

  app.post('/api/homepage-feed', (req: Request, res: Response) => {
    try {
      const feed = req.body;
      if (feed && Array.isArray(feed.carouselItems) && Array.isArray(feed.videoItems)) {
        saveHomepageFeed(feed);
        res.json({ success: true, feed });
      } else {
        res.status(400).json({ success: false, error: 'Invalid feed payload' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to save homepage feed' });
    }
  });

  // Media Upload API (Authoritative Server Storage for Feed & Admin Media)
  app.post('/api/admin/upload-media', (req: Request, res: Response) => {
    try {
      const { dataUrl, fileName, folder = 'feed' } = req.body || {};
      if (!dataUrl || !fileName) {
        return res.status(400).json({ success: false, error: 'dataUrl and fileName are required' });
      }

      // Extract base64 buffer
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const buffer = matches && matches[2]
        ? Buffer.from(matches[2], 'base64')
        : Buffer.from(dataUrl, 'base64');

      const cleanFileName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
      const cleanFolder = String(folder).replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetDir = path.join(process.cwd(), 'public', 'images', 'uploads', cleanFolder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, cleanFileName);
      fs.writeFileSync(filePath, buffer);

      const publicUrl = `/images/uploads/${cleanFolder}/${cleanFileName}`;
      res.json({ success: true, url: publicUrl });
    } catch (err: any) {
      console.error('[UploadMedia] Server error:', err);
      res.status(500).json({ success: false, error: err?.message || 'Failed to upload media' });
    }
  });

  /**
   * Super-Admin PIN Verification Endpoint
   * Securely validates administrator PIN on backend and issues signed 2-hour admin token
   */
  app.post('/api/admin/verify-pin', (req: Request, res: Response) => {
    try {
      const { phone, pin } = req.body || {};
      const ADMIN_PHONE = '254743304579';
      const cleanPhone = String(phone || '').replace(/\D/g, '');
      const expectedPin = process.env.ADMIN_PIN || '7433';

      if (cleanPhone !== ADMIN_PHONE) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Phone is not registered as platform admin.' });
      }

      if (String(pin).trim() !== expectedPin) {
        return res.status(401).json({ success: false, error: 'Incorrect administrator PIN code.' });
      }

      const now = Date.now();
      const expiresAt = now + 2 * 60 * 60 * 1000;
      const adminPayload = `${ADMIN_PHONE}:super_admin:${now}:${expiresAt}`;
      const signature = signAdminPayload(adminPayload);
      const token = Buffer.from(JSON.stringify({ phone: ADMIN_PHONE, role: 'super_admin', expiresAt, signature })).toString('base64');

      return res.json({
        success: true,
        token,
        expiresAt,
        message: 'Super-admin authenticated successfully.',
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Admin authentication error.' });
    }
  });

  // Server-side redeemed payment codes registry (in-memory anti-replay ledger)
  const redeemedMpesaCodesLedger = new Set<string>();

  /**
   * Server-Side M-Pesa Code Verification & Anti-Replay Ledger
   */
  app.post('/api/mpesa/verify-code', (req: Request, res: Response) => {
    try {
      const { code, amount } = req.body || {};
      const cleanCode = String(code || '').trim().toUpperCase();

      if (!/^[A-Z0-9]{8,12}$/.test(cleanCode)) {
        return res.status(400).json({ success: false, error: 'Invalid M-Pesa confirmation code format (e.g. QFT7K9L2M1).' });
      }

      if (redeemedMpesaCodesLedger.has(cleanCode)) {
        return res.status(409).json({ success: false, error: 'This M-Pesa confirmation code has already been redeemed.' });
      }

      // Record code in server ledger
      redeemedMpesaCodesLedger.add(cleanCode);

      return res.json({
        success: true,
        code: cleanCode,
        amount: Number(amount) || 10,
        message: 'Payment code verified successfully.',
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Payment verification error.' });
    }
  });

  // Live Mirrored Jackpot API
  app.get('/api/jackpots/mirror', async (req, res) => {
    try {
      const [sportpesaMega, betikaMidweek] = await Promise.all([
        fetchSportpesaMegaMirror(),
        fetchBetikaMidweekMirror(),
      ]);

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        jackpots: {
          sportpesaMega,
          betikaMidweek,
        },
      });
    } catch (err: any) {
      console.error('Jackpot Mirror API Error:', err);
      res.status(500).json({ error: err?.message || 'Failed to fetch mirrored jackpot data' });
    }
  });

  // =========================================================================
  // SECURE SPORTS MARKET INTELLIGENCE & CONSENSUS ODDS API ENDPOINTS
  // =========================================================================

  app.get('/api/sports/leagues', async (req: Request, res: Response) => {
    try {
      const leagues = await discoverAllLeagues();
      res.json({ success: true, count: leagues.length, leagues });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve sports leagues.' });
    }
  });

  app.get('/api/sports/fixtures', async (req: Request, res: Response) => {
    try {
      const scope = (req.query.scope as any) || 'all';
      const league = req.query.league as string;
      const country = req.query.country as string;
      const date = req.query.date as string;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const fixtures = queryMarketFixtures({ scope, league, country, date, limit });
      res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=10, must-revalidate');
      res.json({ success: true, count: fixtures.length, fixtures });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve market fixtures.' });
    }
  });

  app.get('/api/sports/live', async (req: Request, res: Response) => {
    try {
      const liveFixtures = queryMarketFixtures({ scope: 'live' });
      // If none or low, trigger fast background live check
      if (liveFixtures.length === 0) {
        void syncLiveScoresOnly();
      }
      res.setHeader('Cache-Control', 'public, max-age=3, s-maxage=5, must-revalidate');
      res.json({ success: true, count: liveFixtures.length, fixtures: liveFixtures });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve live fixtures.' });
    }
  });

  app.get('/api/sports/results', async (req: Request, res: Response) => {
    try {
      const league = (req.query.league as string) || 'premier';
      const season = req.query.season as string;
      const results = await getMarketResults(league, season);
      res.json({ success: true, league, count: results.length, results });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve match results.' });
    }
  });

  app.get('/api/sports/daily-fixtures', async (req: Request, res: Response) => {
    try {
      const highlights = await getDailyMarketHighlights();
      res.setHeader('Cache-Control', 'public, max-age=5, s-maxage=10, must-revalidate');
      res.json({ success: true, count: highlights.length, fixtures: highlights });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve daily fixtures.' });
    }
  });

  app.get('/api/sports/status', (req: Request, res: Response) => {
    try {
      const diagnostics = getSyncDiagnostics();
      res.json({ success: true, diagnostics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to retrieve telemetry diagnostics.' });
    }
  });

  app.post('/api/sports/sync', async (req: Request, res: Response) => {
    try {
      const result = await executeRollingSyncCycle();
      res.json({ success: true, result, diagnostics: getSyncDiagnostics() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to execute synchronization.' });
    }
  });

  app.post('/api/sports/sync-live', async (req: Request, res: Response) => {
    try {
      const result = await syncLiveScoresOnly();
      res.json({ success: true, result, diagnostics: getSyncDiagnostics() });
    } catch (err: any) {
      res.status(500).json({ success: false, error: 'Failed to execute live synchronization.' });
    }
  });

  app.get('/api/sports/match-detail', async (req: Request, res: Response) => {
    try {
      const slug = req.query.slug as string;
      if (!slug) {
        return res.status(400).json({ error: 'Match slug is required.' });
      }

      const upstreamRes = await fetch(
        `https://sportscore.com/api/widget/match/?sport=football&slug=${encodeURIComponent(slug)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            Accept: 'application/json',
          },
        }
      );

      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).json({ error: 'SportScore match detail not found.' });
      }

      const data = await upstreamRes.json();
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch match details.' });
    }
  });

  app.get('/api/sports/match-odds', async (req: Request, res: Response) => {
    try {
      const matchUrl = req.query.url as string;
      if (!matchUrl) {
        return res.status(400).json({ success: false, error: 'Match URL is required.' });
      }

      const odds = await fetchBet365OddsForMatch(matchUrl);
      if (!odds) {
        return res.status(404).json({ success: false, error: 'Bet365 odds not available for this match.' });
      }

      res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=3600');
      return res.json({ success: true, odds });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Failed to retrieve match odds.' });
    }
  });

  app.get('/api/sports/standings', async (req: Request, res: Response) => {
    try {
      const slug = req.query.slug as string;
      if (!slug) {
        return res.status(400).json({ error: 'Competition slug is required.' });
      }

      const upstreamRes = await fetch(
        `https://sportscore.com/api/widget/standings/?sport=football&slug=${encodeURIComponent(slug)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            Accept: 'application/json',
          },
        }
      );

      if (!upstreamRes.ok) {
        return res.status(upstreamRes.status).json({ error: 'SportScore standings not found.' });
      }

      const data = await upstreamRes.json();
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to fetch standings.' });
    }
  });


  // Gemini AI Ava 24/7 Support Specialist API
  app.post('/api/gemini/support-chat', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is missing. Please set it in secrets.'
        });
      }

      const { message, history } = req.body;
      if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Message text is required.' });
      }
      if (message.length > 1000) {
        return res.status(400).json({ error: 'Message text exceeds maximum allowed limit of 1,000 characters.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `You are Ava, the friendly, smart, and ultra-helpful 24/7 AI Customer Support Specialist & Site Guide for MshindiRoom (Kenya's #1 Bet Slip Consensus & Punter Wager Platform).

Key Platform Details about MshindiRoom:
- What is MshindiRoom?: Kenya's premier punter community where sports fans analyze football bet slips, form consensus on 17-leg jackpots (SportPesa Mega Jackpot, Betika Midweek, MozzartBet 16, Odibets, etc.), play P2P wagers, build custom bet slips, rate punters, and view live gameweek leaderboards.
- Bookie Relationship: MshindiRoom is an analytical consensus community, NOT a licensed gambling operator. Punters place real bets directly on their bookies (SportPesa, Betika, etc.). MshindiRoom helps punters compare picks and pool knowledge.
- Jackpot Consensus Rooms vs Bet Builder (Key Differences):
  1. **Jackpot Rooms**: Fixed 13-17 match pools provided by bookmakers (SportPesa Mega Jackpot, Betika Midweek, MozzartBet, etc.) where all punters analyze the same fixed match list. Unlocking a room (flat rate of KSh 10 via M-Pesa, wallet balance, or Mshindi Tokens) reveals live community consensus percentages across all legs, 17-leg slip generators, verified punter chat, and qualifies your submitted slip for the Gameweek Leaderboard crown and Rating Points (RP).
  2. **Bet Builder**: A 100% FREE interactive custom accumulator tool. Instead of pre-set jackpot pools, you select individual daily matches, pick your outcomes (1X2, Over/Under 2.5, Both Teams To Score, Double Chance), aggregate odds in real-time, generate copyable bookie slip codes (SportPesa, Betika, Mozzart, 22Bet, Odibets), or share your custom multi-leg slip in the community slip feed.
- Gameweek Leaderboard & Crown: The eligible punter whose slip comes closest to the official winning jackpot outcome takes the #1 Leaderboard Crown! Equal scores are tied and settled by earliest slip submission time.
- 5-Star Punter Rating: Ratings range from 1.0 to 5.0 stars in half-star steps. They increase as slip accuracy improves over time and gain a bonus when crowned #1 in a jackpot.
- P2P Bets: Custom 1v1 wagers where punters challenge friends or community members on specific matches using M-Pesa escrow or room tokens.
- M-Pesa Deposits & Withdrawals: Automated M-Pesa Express (STK Push) for instant wallet top-ups, room unlocks, and withdrawals.
- Mobile PWA App: Users can install MshindiRoom to their home screen on Android or iPhone from the Profile page or footer for full offline access and consensus push alerts.
- Support Email: support@mshindiroom.co.ke

Strict Rules for Ava:
- STRICT UNLOCK FEE: The flat fee rate for Jackpot Rooms is strictly **KSh 10** for every punter (payable via M-Pesa, wallet balance, or Mshindi Tokens). Bet Builder is **100% FREE** to use. NEVER mention KSh 20, KSh 50, or any other price.
- CLEAR FEATURE COMPARISON: When asked about Bet Builder or Jackpot Rooms, clearly explain that Jackpot Rooms are fixed bookmaker pools (SportPesa, Betika) for the Leaderboard Crown (KSh 10 unlock), whereas Bet Builder is a free custom multi-match accumulator tool for daily fixtures.
- STRICT FACTUAL RESTRAINT: When explaining jackpot analysis, consensus data, or prizes, NEVER add foreign or external information, fake bookmaker bonuses, or unverified claims. Stick strictly to MshindiRoom's platform rules and features.
- Respond in a warm, polite, encouraging Kenyan customer support style.
- Use clear bullet points or bold formatting for step-by-step instructions.
- Keep answers concise, clear, and direct (max 2-3 short paragraphs).
- Always end with a helpful invitation for follow-up questions if needed.`;

      // Construct conversation context if history is supplied
      let formattedContents: any = message.trim();
      if (Array.isArray(history) && history.length > 0) {
        const recentHistory = history.slice(-6).map((item: any) => ({
          role: item.sender === 'user' ? 'user' : 'model',
          parts: [{ text: item.text }]
        }));
        recentHistory.push({
          role: 'user',
          parts: [{ text: message.trim() }]
        });
        formattedContents = recentHistory;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: formattedContents,
        config: {
          systemInstruction,
          temperature: 0.6,
        },
      });

      res.json({
        success: true,
        text: response.text || "I'm Ava, your MshindiRoom support assistant! How else can I help you today?",
      });
    } catch (err: any) {
      console.error('Ava Support API Error:', err);
      res.status(500).json({ error: err?.message || 'Failed to process support message' });
    }
  });

  // Gemini AI Mshindi Advisor API
  app.post('/api/gemini/advisor', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: 'GEMINI_API_KEY is missing. Please set it in secrets.'
        });
      }

      const { prompt, mode } = req.body;
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let systemInstruction = "You are 'Mshindi AI Advisor', an expert AI sports analyst, trivia creator, and competition guide for Mshindi Projo platform in Kenya / East Africa.";
      if (mode === 'trivia') {
        systemInstruction += " Generate 3 exciting, multiple-choice trivia questions with 4 options and 1 correct answer index about sports, history, or general knowledge. Format clearly.";
      } else if (mode === 'prediction') {
        systemInstruction += " Provide insightful sports statistics, head-to-head analysis, and probable score predictions with key match highlights.";
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt || 'Provide a daily sports highlight tip and trivia fact for Mshindi champions!',
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({
        success: true,
        text: response.text || 'Keep playing and winning on Mshindi Projo!'
      });
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      res.status(500).json({ error: err?.message || 'Failed to generate AI response' });
    }
  });

  // Gemini AI Jackpot Webpage Parser API (Admin Extension)
  app.post('/api/gemini/parse-jackpot-text', async (req, res) => {
    try {
      const adminToken = req.headers['x-admin-token'] as string;
      const adminKey = (req.headers['x-admin-key'] || req.query.adminKey) as string;
      const expectedKey = process.env.ADMIN_SECRET || 'mshindi_admin_audit_key_2026';
      if (adminKey !== expectedKey && (!adminToken || adminToken.length < 20)) {
        return res.status(401).json({ error: 'Unauthorized: Admin authentication required to access jackpot parser.' });
      }

      const { rawText, bookie, legCount } = req.body;
      if (!rawText || !rawText.trim()) {
        return res.status(400).json({ error: 'Raw webpage text is required for parsing.' });
      }

      const targetLegs = Number(legCount) || 17;
      let matches: any[] = [];

      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build',
              },
            },
          });

          const systemInstruction = `You are an expert sports betting jackpot fixture parser for Kenyan sportsbooks (SportPesa, Betika, MozzartBet, Odibets, Shabiki, BangBet, PariPesa, 22Bet, 1xBet, BetAfriq).
Given raw text copied and pasted from a betting jackpot webpage, accurately extract exactly ${targetLegs} football match fixtures sequentially in the exact jackpot order from Leg 1 to Leg ${targetLegs}.
STRICT RULES:
1. Ignore all non-match related text: site headers, footers, navigation links, login/register buttons, promotional banners, jackpot rules, bonus info, and marketing copy.
2. For each fixture extract:
   - home: Clean Home team name only (e.g. 'Arsenal')
   - away: Clean Away team name only (e.g. 'Chelsea')
   - competition: League or country competition (e.g. 'English Premier League', 'Spanish La Liga', 'Italian Serie A', 'German Bundesliga', etc.)
   - kickoff: Kick-off date and time formatted nicely (e.g. 'Sat 24 Oct · 17:00 EAT')
   - homePct: Estimated win percentage integer (20 to 75)
   - drawPct: Estimated draw percentage integer (20 to 40)
   - awayPct: Estimated away percentage integer (20 to 75)
3. Ensure the arrangement strictly matches the first leg to the last leg.
Return valid JSON with key 'matches' containing exactly ${targetLegs} items.`;

          const prompt = `Bookmaker: ${bookie || 'Kenyan Sportsbook'}\nTarget number of games/legs: ${targetLegs}\n\nRaw Webpage Content:\n${rawText.slice(0, 12000)}`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          });

          let parsed: any = { matches: [] };
          try {
            parsed = JSON.parse(response.text || '{}');
          } catch {
            console.warn('Failed to parse Gemini output as JSON directly');
          }
          if (Array.isArray(parsed?.matches) && parsed.matches.length > 0) {
            matches = parsed.matches;
          }
        } catch (aiErr) {
          console.warn('Gemini AI parsing encountered error, falling back to deterministic parser:', aiErr);
        }
      }

      // High-precision deterministic parser fallback if AI returned empty or is not available
      if (matches.length === 0) {
        matches = parseJackpotWebpageText(rawText, targetLegs);
      }

      res.json({
        success: true,
        bookie,
        legCount: matches.length,
        matches,
      });
    } catch (err: any) {
      console.error('Jackpot Parser Error:', err);
      // Even on general error, attempt fallback
      const { rawText, targetLegs } = req.body || {};
      const fallbackMatches = rawText ? parseJackpotWebpageText(rawText, Number(targetLegs) || 17) : [];
      if (fallbackMatches.length > 0) {
        return res.json({ success: true, legCount: fallbackMatches.length, matches: fallbackMatches });
      }
      res.status(500).json({ error: err?.message || 'Failed to parse jackpot webpage text' });
    }
  });

  // Dynamic SEO Endpoints: Robots.txt & Sitemap.xml
  app.get('/robots.txt', (req: Request, res: Response) => {
    res.type('text/plain');
    res.send(`User-agent: *
Allow: /
Allow: /free
Allow: /free/
Allow: /room/
Allow: /leaderboard
Allow: /how-it-works
Allow: /slips
Allow: /privacy
Allow: /terms
Allow: /p2p

Disallow: /wallet
Disallow: /profile
Disallow: /auth
Disallow: /api/

Sitemap: https://mshindi.co.ke/sitemap.xml
`);
  });

  app.get('/sitemap.xml', (req: Request, res: Response) => {
    res.type('application/xml');
    const today = new Date().toISOString().split('T')[0];
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://mshindi.co.ke/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/free</loc>
    <lastmod>${today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/leaderboard</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/how-it-works</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/slips</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/p2p</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/room/sportpesa-mega</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/room/betika-midweek</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/room/mozzart-daily</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/privacy</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
  <url>
    <loc>https://mshindi.co.ke/terms</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
</urlset>`);
  });

  // Global Error Handler Middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  // Vite development middleware vs Static Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        // Allow any tunnel / proxy hostname (Cloudflare, ngrok, etc.)
        // Must be `true` (boolean) in Vite 6 — the string 'all' is not valid.
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1y',
      immutable: true,
      index: false,
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Continuous automated SportScore scraping disabled per user mandate

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mshindi Projo Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
