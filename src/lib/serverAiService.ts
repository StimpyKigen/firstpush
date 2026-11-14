import { GoogleGenAI } from '@google/genai';
import { fetchSportpesaMegaMirror, fetchBetikaMidweekMirror } from './jackpotMirrorService.js';
import { verifyAdminRequestAsync, constantTimeEqualText } from './adminAuthService.js';
import { parseJackpotWebpageText } from './jackpotWebParser.js';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

export function getConfiguredGeminiModel(): string {
  const configured = String(process.env.GEMINI_MODEL || '').trim();
  return configured || DEFAULT_GEMINI_MODEL;
}

export interface AiHttpResponse {
  statusCode: number;
  payload: Record<string, any>;
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function buildHealthPayload(): AiHttpResponse {
  return {
    statusCode: 200,
    payload: {
      status: 'ok',
      name: 'Mshindi Projo Backend',
      timestamp: new Date().toISOString(),
    },
  };
}

export async function handleJackpotsMirrorRequest(): Promise<AiHttpResponse> {
  try {
    const [sportpesaMega, betikaMidweek] = await Promise.all([
      fetchSportpesaMegaMirror(),
      fetchBetikaMidweekMirror(),
    ]);

    return {
      statusCode: 200,
      payload: {
        success: true,
        timestamp: new Date().toISOString(),
        jackpots: {
          sportpesaMega,
          betikaMidweek,
        },
      },
    };
  } catch (err: any) {
    console.error('Jackpot Mirror API Error:', err);
    return {
      statusCode: 500,
      payload: { success: false, error: 'Failed to fetch mirrored jackpot data' },
    };
  }
}

export async function handleGeminiSupportChatRequest(body: Record<string, any>): Promise<AiHttpResponse> {
  try {
    const { message, history } = body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return {
        statusCode: 400,
        payload: { success: false, error: 'Message text is required.' },
      };
    }
    if (message.length > 1000) {
      return {
        statusCode: 400,
        payload: {
          success: false,
          error: 'Message text exceeds maximum allowed limit of 1,000 characters.',
        },
      };
    }

    let formattedContents: any = message.trim();
    if (history !== undefined) {
      if (!Array.isArray(history) || history.length > 30) {
        return {
          statusCode: 400,
          payload: { success: false, error: 'Invalid chat history format.' },
        };
      }
      const recentHistory = history
        .slice(-6)
        .filter((item: any) => item && typeof item.text === 'string' && item.text.trim().length > 0)
        .map((item: any) => ({
          role: item.sender === 'user' ? 'user' : 'model',
          parts: [{ text: item.text.trim().slice(0, 1000) }],
        }));
      recentHistory.push({
        role: 'user',
        parts: [{ text: message.trim() }],
      });
      formattedContents = recentHistory;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 400,
        payload: {
          success: false,
          error: 'GEMINI_API_KEY is missing. Please set it in secrets.',
        },
      };
    }

    const ai = createGeminiClient(apiKey);
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

    const response = await ai.models.generateContent({
      model: getConfiguredGeminiModel(),
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.6,
        abortSignal:
          typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
            ? AbortSignal.timeout(15000)
            : undefined,
      },
    });

    return {
      statusCode: 200,
      payload: {
        success: true,
        text:
          response.text ||
          "I'm Ava, your MshindiRoom support assistant! How else can I help you today?",
      },
    };
  } catch (err: any) {
    console.error('Ava Support API Error:', err);
    return {
      statusCode: 500,
      payload: { success: false, error: 'Failed to process support message.' },
    };
  }
}

export async function handleGeminiAdvisorRequest(body: Record<string, any>): Promise<AiHttpResponse> {
  try {
    const { prompt, mode } = body || {};
    if (prompt !== undefined && typeof prompt !== 'string') {
      return {
        statusCode: 400,
        payload: { success: false, error: 'Advisor prompt must be a string.' },
      };
    }
    const cleanPrompt = typeof prompt === 'string' ? prompt.trim() : '';
    if (cleanPrompt.length > 1500) {
      return {
        statusCode: 400,
        payload: {
          success: false,
          error: 'Advisor prompt exceeds maximum allowed limit of 1,500 characters.',
        },
      };
    }
    const allowedModes = new Set(['standard', 'trivia', 'prediction']);
    const cleanMode = mode === undefined ? 'standard' : String(mode).trim().toLowerCase();
    if (!allowedModes.has(cleanMode)) {
      return {
        statusCode: 400,
        payload: { success: false, error: 'Invalid advisor mode.' },
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 400,
        payload: {
          success: false,
          error: 'GEMINI_API_KEY is missing. Please set it in secrets.',
        },
      };
    }

    const ai = createGeminiClient(apiKey);
    let systemInstruction =
      "You are 'Mshindi AI Advisor', an expert AI sports analyst, trivia creator, and competition guide for Mshindi Projo platform in Kenya / East Africa.";
    if (cleanMode === 'trivia') {
      systemInstruction +=
        ' Generate 3 exciting, multiple-choice trivia questions with 4 options and 1 correct answer index about sports, history, or general knowledge. Format clearly.';
    } else if (cleanMode === 'prediction') {
      systemInstruction +=
        ' Provide insightful sports statistics, head-to-head analysis, and probable score predictions with key match highlights.';
    }

    const response = await ai.models.generateContent({
      model: getConfiguredGeminiModel(),
      contents:
        cleanPrompt ||
        'Provide a daily sports highlight tip and trivia fact for Mshindi champions!',
      config: {
        systemInstruction,
        temperature: 0.7,
        abortSignal:
          typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
            ? AbortSignal.timeout(15000)
            : undefined,
      },
    });

    return {
      statusCode: 200,
      payload: {
        success: true,
        text: response.text || 'Keep playing and winning on Mshindi Projo!',
      },
    };
  } catch (err: any) {
    console.error('Gemini API Error:', err);
    return {
      statusCode: 500,
      payload: { success: false, error: 'Failed to generate AI response.' },
    };
  }
}

export async function handleGeminiParseJackpotTextRequest(params: {
  headers: Record<string, any>;
  body: Record<string, any>;
}): Promise<AiHttpResponse> {
  try {
    const headers = params.headers || {};
    const body = params.body || {};

    const adminKeyHeader = String(headers['x-admin-key'] || '');
    const configuredSecret = (process.env.ADMIN_SECRET || '').trim();
    const hasValidAdminSecret = Boolean(
      configuredSecret && adminKeyHeader && constantTimeEqualText(adminKeyHeader, configuredSecret)
    );
    const adminCheck = hasValidAdminSecret
      ? { authorized: true }
      : await verifyAdminRequestAsync(headers, body);
    if (!adminCheck.authorized && !hasValidAdminSecret) {
      return {
        statusCode: adminCheck.storeUnavailable ? 503 : 403,
        payload: {
          success: false,
          error:
            adminCheck.reason ||
            'Forbidden: Valid administrator authentication required to access jackpot parser.',
        },
      };
    }

    const { rawText, bookie, legCount } = body;
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return {
        statusCode: 400,
        payload: { success: false, error: 'Raw webpage text is required for parsing.' },
      };
    }

    const targetLegs = Number(legCount) || 17;
    let matches: any[] = [];

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = createGeminiClient(apiKey);
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
          model: getConfiguredGeminiModel(),
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: 'application/json',
            abortSignal:
              typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
                ? AbortSignal.timeout(15000)
                : undefined,
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

    if (matches.length === 0) {
      matches = parseJackpotWebpageText(rawText, targetLegs);
    }

    return {
      statusCode: 200,
      payload: {
        success: true,
        bookie,
        legCount: matches.length,
        matches,
      },
    };
  } catch (err: any) {
    console.error('Jackpot Parser Error:', err);
    const { rawText, targetLegs } = params.body || {};
    const fallbackMatches =
      typeof rawText === 'string' && rawText.trim()
        ? parseJackpotWebpageText(rawText, Number(targetLegs) || 17)
        : [];
    if (fallbackMatches.length > 0) {
      return {
        statusCode: 200,
        payload: { success: true, legCount: fallbackMatches.length, matches: fallbackMatches },
      };
    }
    return {
      statusCode: 500,
      payload: { success: false, error: 'Failed to parse jackpot webpage text' },
    };
  }
}

