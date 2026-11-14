/**
 * Authoritative Server-Side Peer-to-Peer (P2P) Escrow & Settlement Service (MSH-019)
 *
 * Moves all P2P bet creation, stake escrow locking, join matching, cancellations,
 * mutual winner confirmation, dispute locking, and pot payout settlement off client
 * localStorage into a server-authoritative transaction engine.
 *
 * Persists to Cloud Firestore (`p2pBets`) when Admin SDK is active, with local disk fallback.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
  authenticateTokenRequestAsync,
  adjustAuthoritativeKshBalanceForP2p,
  getAuthoritativeUserWallet,
  normalizeCanonicalUid,
} from './serverTokenEconomy.js';
import { verifyAdminRequestAsync, ADMIN_PHONE_NORMALIZED } from './adminAuthService.js';
import { evaluateServerModeration } from './serverModerationService.js';
import { getAdminFirestore, resetFirebaseAdminForTests } from './serverFirebaseAdmin.js';
import { recordSecurityEvent } from './securityAuditLogger.js';
import { extractTrustedClientIp } from './rateLimitService.js';

export type BetCategory = 'Sports' | 'Politics' | 'Gaming' | 'Weather' | 'Pop Culture' | 'Custom';
export type BetStatus =
  | 'awaiting_opponent'
  | 'active'
  | 'disputed'
  | 'settled'
  | 'cancelled'
  | 'declined';
export type Side = 'creator' | 'opponent';

export interface ServerP2PBet {
  id: string;
  code: string;
  creatorUid: string;
  creatorUsername: string;
  opponentUid?: string | null;
  opponentUsername?: string | null;
  title: string;
  description?: string;
  category: BetCategory;
  creatorSidePick: string;
  opponentSidePick: string;
  creatorStake: number;
  opponentStake: number;
  oddsLabel: string;
  status: BetStatus;
  proposedWinnerByCreator?: Side | null;
  proposedWinnerByOpponent?: Side | null;
  winner?: Side | null;
  createdAt: string;
  settleBy?: string;
  settledAt?: string;
}

const VALID_CATEGORIES = new Set<BetCategory>([
  'Sports',
  'Politics',
  'Gaming',
  'Weather',
  'Pop Culture',
  'Custom',
]);
const MIN_STAKE_KSH = 10;
const MAX_STAKE_KSH = 100_000;

const DATA_DIR = path.join(process.cwd(), 'data');
const PRIMARY_P2P_FILE = path.join(DATA_DIR, 'p2p_bets.json');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), '.mshindi-cache')
  : path.join(process.cwd(), '.cache');
const FALLBACK_P2P_FILE = path.join(CACHE_DIR, 'p2p_bets.json');

let memoryBets: ServerP2PBet[] | null = null;
let p2pLock: Promise<any> = Promise.resolve();

export function resetP2pServerForTests(): void {
  memoryBets = [];
  resetFirebaseAdminForTests();
}

function withP2pLock<T>(task: () => Promise<T> | T): Promise<T> {
  const next = p2pLock.then(() => task(), () => task());
  p2pLock = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function getP2pFirestore(): Promise<any | null> {
  return getAdminFirestore();
}

function loadLocalBets(): ServerP2PBet[] {
  if (memoryBets !== null) return memoryBets;

  for (const filePath of [PRIMARY_P2P_FILE, FALLBACK_P2P_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(parsed)) {
          memoryBets = parsed;
          return memoryBets;
        }
      }
    } catch {
      // Fallback
    }
  }

  memoryBets = [];
  return memoryBets;
}

function persistLocalBets(bets: ServerP2PBet[]): void {
  const serialized = JSON.stringify(bets.slice(0, 2000));
  for (const [dir, filePath] of [
    [DATA_DIR, PRIMARY_P2P_FILE],
    [CACHE_DIR, FALLBACK_P2P_FILE],
  ] as const) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, serialized, 'utf-8');
      return;
    } catch {
      // Ignore read-only path
    }
  }
}

async function persistBetFirestore(bet: ServerP2PBet): Promise<void> {
  const db = await getP2pFirestore();
  if (!db) return;
  try {
    await db.collection('p2pBets').doc(bet.id).set(bet);
  } catch {
    // Non-fatal
  }
}

function sanitizeBetForClient(bet: ServerP2PBet, viewerUid: string, isAdmin: boolean) {
  const isParticipant = bet.creatorUid === viewerUid || bet.opponentUid === viewerUid;
  return {
    id: bet.id,
    code: isParticipant || isAdmin || bet.status === 'awaiting_opponent' ? bet.code : undefined,
    creatorUsername: bet.creatorUsername,
    opponentUsername: bet.opponentUsername || undefined,
    title: bet.title,
    description: bet.description || undefined,
    category: bet.category,
    creatorSidePick: bet.creatorSidePick,
    opponentSidePick: bet.opponentSidePick,
    creatorStake: bet.creatorStake,
    opponentStake: bet.opponentStake,
    oddsLabel: bet.oddsLabel,
    status: bet.status,
    proposedWinnerByCreator: bet.proposedWinnerByCreator ?? null,
    proposedWinnerByOpponent: bet.proposedWinnerByOpponent ?? null,
    winner: bet.winner ?? null,
    createdAt: bet.createdAt,
    settleBy: bet.settleBy,
    settledAt: bet.settledAt,
    mySide:
      bet.creatorUid === viewerUid
        ? 'creator'
        : bet.opponentUid === viewerUid
          ? 'opponent'
          : null,
  };
}

function generateSecureInviteCode(existingBets: ServerP2PBet[]): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const existing = new Set(existingBets.map((b) => b.code.toUpperCase()));
  for (let attempt = 0; attempt < 20; attempt++) {
    const bytes = crypto.randomBytes(6);
    let candidate = '';
    for (let i = 0; i < 6; i++) {
      candidate += chars[bytes[i] % chars.length];
    }
    if (!existing.has(candidate)) return candidate;
  }
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

export async function handleP2pHttpRequest(params: {
  method: string;
  pathname: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, any>;
  body: any;
}): Promise<{ statusCode: number; payload: any }> {
  const method = (params.method || 'GET').toUpperCase();
  const pathname = (params.pathname || '').replace(/\/+$/, '').toLowerCase();
  const headers = params.headers || {};
  const query = params.query || {};
  const body = params.body || {};
  const ip = extractTrustedClientIp(headers);

  // Admin dispute resolution endpoint (`/api/tokens/p2p/admin-resolve`)
  if (pathname.endsWith('/admin-resolve')) {
    if (method !== 'POST') {
      return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
    }
    const adminAuth = await verifyAdminRequestAsync(headers, body);
    if (!adminAuth.authorized) {
      await recordSecurityEvent({
        category: 'P2P_ESCROW',
        severity: 'high',
        action: 'unauthorized_p2p_admin_resolve',
        outcome: 'blocked',
        ip,
        route: pathname,
      });
      return {
        statusCode: adminAuth.storeUnavailable ? 503 : 403,
        payload: { success: false, error: adminAuth.reason || 'Forbidden: Admin privileges required.' },
      };
    }

    const betId = String(body.id || '').trim();
    const winner = body.winner as Side;
    if (!betId || (winner !== 'creator' && winner !== 'opponent')) {
      return { statusCode: 400, payload: { success: false, error: 'Valid bet id and winner side (creator|opponent) are required.' } };
    }

    return withP2pLock(async () => {
      const bets = loadLocalBets();
      const bet = bets.find((b) => b.id === betId);
      if (!bet) return { statusCode: 404, payload: { success: false, error: 'Bet not found.' } };
      if (bet.status !== 'disputed' && bet.status !== 'active') {
        return { statusCode: 400, payload: { success: false, error: `Cannot resolve bet in status '${bet.status}'.` } };
      }
      const winnerUid = winner === 'creator' ? bet.creatorUid : bet.opponentUid;
      if (!winnerUid) {
        return { statusCode: 400, payload: { success: false, error: 'Winning side participant UID missing.' } };
      }
      const pot = bet.creatorStake + bet.opponentStake;
      const payoutRes = await adjustAuthoritativeKshBalanceForP2p({
        userUid: winnerUid,
        deltaKsh: pot,
        idempotencyKey: `p2p-admin-resolve:${bet.id}:${winner}`,
      });
      if (!payoutRes.success) {
        return { statusCode: payoutRes.statusCode || 500, payload: { success: false, error: payoutRes.error } };
      }
      bet.status = 'settled';
      bet.winner = winner;
      bet.settledAt = new Date().toISOString();
      persistLocalBets(bets);
      await persistBetFirestore(bet);
      await recordSecurityEvent({
        category: 'P2P_ESCROW',
        severity: 'info',
        action: 'p2p_dispute_resolved_by_admin',
        outcome: 'allowed',
        actorId: `ADMIN:${ADMIN_PHONE_NORMALIZED}`,
        ip,
        route: pathname,
        details: { betId: bet.id, winner, potKsh: pot },
      });
      return { statusCode: 200, payload: { success: true, bet: sanitizeBetForClient(bet, winnerUid, true) } };
    });
  }

  // All non-admin P2P routes strictly require an authenticated user session
  const authCheck = await authenticateTokenRequestAsync(headers, { ...query, ...body });
  if (!authCheck.authenticated || !authCheck.userUid) {
    return {
      statusCode: authCheck.statusCode || 401,
      payload: { success: false, error: authCheck.error || 'Authentication required for P2P wagering.' },
    };
  }
  const callerUid = normalizeCanonicalUid(authCheck.userUid);
  const isAdmin = Boolean(authCheck.isAdmin);

  // 1. LIST AUTHORIZED P2P BETS (`GET /api/tokens/p2p`)
  if (method === 'GET' && pathname.endsWith('/p2p')) {
    const db = await getP2pFirestore();
    let bets = loadLocalBets();
    if (db) {
      try {
        const snap = await db.collection('p2pBets').orderBy('createdAt', 'desc').limit(300).get();
        if (!snap.empty) {
          bets = snap.docs.map((docSnap: any) => docSnap.data() as ServerP2PBet);
          memoryBets = bets;
        }
      } catch {
        // Fallback to local state
      }
    }

    const visible = bets
      .filter((b) => isAdmin || b.creatorUid === callerUid || b.opponentUid === callerUid || b.status === 'awaiting_opponent')
      .map((b) => sanitizeBetForClient(b, callerUid, isAdmin));
    return { statusCode: 200, payload: { success: true, bets: visible } };
  }

  // 2. CREATE P2P BET (`POST /api/tokens/p2p/create`)
  if (method === 'POST' && pathname.endsWith('/p2p/create')) {
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 140) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
    const category = (VALID_CATEGORIES.has(body.category) ? body.category : 'Custom') as BetCategory;
    const creatorSidePick = typeof body.creatorSidePick === 'string' ? body.creatorSidePick.trim().slice(0, 120) : '';
    const opponentSidePick = typeof body.opponentSidePick === 'string' ? body.opponentSidePick.trim().slice(0, 120) : '';
    const settleBy = typeof body.settleBy === 'string' ? body.settleBy.trim().slice(0, 100) : undefined;

    const creatorStake = Math.trunc(Number(body.creatorStake));
    const opponentStake = Math.trunc(Number(body.opponentStake));

    if (!title || !creatorSidePick || !opponentSidePick) {
      return { statusCode: 400, payload: { success: false, error: 'Title and both sides of the bet are required.' } };
    }
    if (
      !Number.isFinite(creatorStake) ||
      !Number.isFinite(opponentStake) ||
      creatorStake !== Number(body.creatorStake) ||
      opponentStake !== Number(body.opponentStake) ||
      creatorStake < MIN_STAKE_KSH ||
      creatorStake > MAX_STAKE_KSH ||
      opponentStake < MIN_STAKE_KSH ||
      opponentStake > MAX_STAKE_KSH
    ) {
      return {
        statusCode: 400,
        payload: { success: false, error: `Stakes must be whole numbers between KSh ${MIN_STAKE_KSH} and KSh ${MAX_STAKE_KSH.toLocaleString()}.` },
      };
    }

    const modCheck = await evaluateServerModeration(`${title} ${description} ${creatorSidePick} ${opponentSidePick} ${settleBy || ''}`);
    if (!modCheck.isAllowed) {
      return {
        statusCode: 400,
        payload: { success: false, error: modCheck.reason || 'Bet content violated community safety policy.' },
      };
    }

    return withP2pLock(async () => {
      const bets = loadLocalBets();
      const betId = `p2p-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
      const callerWallet = await getAuthoritativeUserWallet({
        userUid: callerUid,
        username: typeof body.creatorUsername === 'string' ? body.creatorUsername : undefined,
      });

      const debitRes = await adjustAuthoritativeKshBalanceForP2p({
        userUid: callerUid,
        username: callerWallet.username,
        deltaKsh: -creatorStake,
        idempotencyKey: `p2p-create:${betId}`,
      });
      if (!debitRes.success) {
        return {
          statusCode: debitRes.statusCode || 400,
          payload: { success: false, error: debitRes.error, wallet: callerWallet },
        };
      }

      const impliedOdds = (opponentStake / creatorStake).toFixed(2);
      const created: ServerP2PBet = {
        id: betId,
        code: generateSecureInviteCode(bets),
        creatorUid: callerUid,
        creatorUsername: callerWallet.username,
        opponentUid: null,
        opponentUsername: null,
        title,
        description,
        category,
        creatorSidePick,
        opponentSidePick,
        creatorStake,
        opponentStake,
        oddsLabel: `${impliedOdds}x return (KSh ${opponentStake} vs KSh ${creatorStake})`,
        status: 'awaiting_opponent',
        proposedWinnerByCreator: null,
        proposedWinnerByOpponent: null,
        winner: null,
        createdAt: new Date().toISOString(),
        settleBy,
      };

      bets.unshift(created);
      persistLocalBets(bets);
      await persistBetFirestore(created);

      return {
        statusCode: 201,
        payload: {
          success: true,
          bet: sanitizeBetForClient(created, callerUid, isAdmin),
          wallet: debitRes.wallet,
        },
      };
    });
  }

  // 3. JOIN P2P BET (`POST /api/tokens/p2p/join`)
  if (method === 'POST' && pathname.endsWith('/p2p/join')) {
    const code = String(body.code || '').trim().toUpperCase();
    if (!code) {
      return { statusCode: 400, payload: { success: false, error: 'Invite code is required.' } };
    }

    return withP2pLock(async () => {
      const bets = loadLocalBets();
      const bet = bets.find((b) => b.code.toUpperCase() === code);
      if (!bet) {
        return { statusCode: 404, payload: { success: false, error: 'No P2P bet found with that invite code.' } };
      }
      if (bet.status !== 'awaiting_opponent') {
        return { statusCode: 400, payload: { success: false, error: `This bet is already ${bet.status}.` } };
      }
      if (bet.creatorUid === callerUid) {
        return { statusCode: 400, payload: { success: false, error: 'You cannot join your own P2P bet.' } };
      }

      const callerWallet = await getAuthoritativeUserWallet({
        userUid: callerUid,
        username: typeof body.opponentUsername === 'string' ? body.opponentUsername : undefined,
      });

      const debitRes = await adjustAuthoritativeKshBalanceForP2p({
        userUid: callerUid,
        username: callerWallet.username,
        deltaKsh: -bet.opponentStake,
        idempotencyKey: `p2p-join:${bet.id}:${callerUid}`,
      });
      if (!debitRes.success) {
        return {
          statusCode: debitRes.statusCode || 400,
          payload: { success: false, error: debitRes.error, wallet: callerWallet },
        };
      }

      bet.opponentUid = callerUid;
      bet.opponentUsername = callerWallet.username;
      bet.status = 'active';
      persistLocalBets(bets);
      await persistBetFirestore(bet);

      return {
        statusCode: 200,
        payload: {
          success: true,
          bet: sanitizeBetForClient(bet, callerUid, isAdmin),
          wallet: debitRes.wallet,
        },
      };
    });
  }

  // 4. CANCEL OR DECLINE BET (`POST /api/tokens/p2p/cancel` | `/p2p/decline`)
  if (method === 'POST' && (pathname.endsWith('/p2p/cancel') || pathname.endsWith('/p2p/decline'))) {
    const isDecline = pathname.endsWith('/p2p/decline');
    const betId = String(body.id || '').trim();
    const providedCode = String(body.code || '').trim().toUpperCase();
    if (!betId) {
      return { statusCode: 400, payload: { success: false, error: 'Bet id is required.' } };
    }

    return withP2pLock(async () => {
      const bets = loadLocalBets();
      const bet = bets.find((b) => b.id === betId);
      if (!bet) {
        return { statusCode: 404, payload: { success: false, error: 'Bet not found.' } };
      }

      const isCreator = bet.creatorUid === callerUid;
      const isCodeHolderDecline = isDecline && providedCode && providedCode === bet.code.toUpperCase();
      if (!isCreator && !isAdmin && !isCodeHolderDecline) {
        await recordSecurityEvent({
          category: 'IDOR',
          severity: 'high',
          action: isDecline ? 'unauthorized_p2p_decline' : 'unauthorized_p2p_cancel',
          outcome: 'blocked',
          actorId: callerUid,
          ip,
          route: pathname,
          details: { betId: bet.id },
        });
        return { statusCode: 403, payload: { success: false, error: 'Forbidden: Only the bet creator can cancel this wager.' } };
      }

      if (bet.status !== 'awaiting_opponent') {
        return { statusCode: 400, payload: { success: false, error: `Cannot cancel/decline bet in status '${bet.status}'.` } };
      }

      const refundRes = await adjustAuthoritativeKshBalanceForP2p({
        userUid: bet.creatorUid,
        deltaKsh: bet.creatorStake,
        idempotencyKey: `p2p-refund:${bet.id}`,
      });
      if (!refundRes.success) {
        return { statusCode: refundRes.statusCode || 500, payload: { success: false, error: refundRes.error } };
      }

      bet.status = isDecline ? 'declined' : 'cancelled';
      persistLocalBets(bets);
      await persistBetFirestore(bet);

      const viewerWallet = isCreator ? refundRes.wallet : await getAuthoritativeUserWallet({ userUid: callerUid });
      return {
        statusCode: 200,
        payload: {
          success: true,
          bet: sanitizeBetForClient(bet, callerUid, isAdmin),
          wallet: viewerWallet,
        },
      };
    });
  }

  // 5. PROPOSE WINNER & ATOMICALLY SETTLE POT (`POST /api/tokens/p2p/propose-winner`)
  if (method === 'POST' && pathname.endsWith('/p2p/propose-winner')) {
    const betId = String(body.id || '').trim();
    const winner = body.winner as Side;
    if (!betId || (winner !== 'creator' && winner !== 'opponent')) {
      return { statusCode: 400, payload: { success: false, error: 'Valid bet id and winner (creator|opponent) are required.' } };
    }

    return withP2pLock(async () => {
      const bets = loadLocalBets();
      const bet = bets.find((b) => b.id === betId);
      if (!bet) {
        return { statusCode: 404, payload: { success: false, error: 'Bet not found.' } };
      }

      // Derive caller's side STRICTLY from authenticated session UID (ignore client-supplied `proposer`)
      const actualSide: Side | null =
        bet.creatorUid === callerUid
          ? 'creator'
          : bet.opponentUid === callerUid
            ? 'opponent'
            : null;
      if (!actualSide) {
        await recordSecurityEvent({
          category: 'IDOR',
          severity: 'high',
          action: 'unauthorized_p2p_propose_winner',
          outcome: 'blocked',
          actorId: callerUid,
          ip,
          route: pathname,
          details: { betId: bet.id },
        });
        return { statusCode: 403, payload: { success: false, error: 'Forbidden: You are not a participant in this P2P bet.' } };
      }

      if (bet.status !== 'active') {
        return { statusCode: 400, payload: { success: false, error: `Bet is '${bet.status}' and cannot accept outcome proposals.` } };
      }

      if (actualSide === 'creator') {
        if (bet.proposedWinnerByCreator) {
          return { statusCode: 400, payload: { success: false, error: 'You have already submitted your outcome confirmation.' } };
        }
        bet.proposedWinnerByCreator = winner;
      } else {
        if (bet.proposedWinnerByOpponent) {
          return { statusCode: 400, payload: { success: false, error: 'You have already submitted your outcome confirmation.' } };
        }
        bet.proposedWinnerByOpponent = winner;
      }

      if (bet.proposedWinnerByCreator && bet.proposedWinnerByOpponent) {
        if (bet.proposedWinnerByCreator === bet.proposedWinnerByOpponent) {
          const finalWinner = bet.proposedWinnerByCreator;
          const winnerUid = finalWinner === 'creator' ? bet.creatorUid : bet.opponentUid;
          if (!winnerUid) {
            return { statusCode: 500, payload: { success: false, error: 'Settling failed: missing winner identity.' } };
          }
          const pot = bet.creatorStake + bet.opponentStake;
          const payoutRes = await adjustAuthoritativeKshBalanceForP2p({
            userUid: winnerUid,
            deltaKsh: pot,
            idempotencyKey: `p2p-settle:${bet.id}:${finalWinner}`,
          });
          if (!payoutRes.success) {
            return { statusCode: payoutRes.statusCode || 500, payload: { success: false, error: payoutRes.error } };
          }
          bet.status = 'settled';
          bet.winner = finalWinner;
          bet.settledAt = new Date().toISOString();
        } else {
          bet.status = 'disputed';
          await recordSecurityEvent({
            category: 'P2P_ESCROW',
            severity: 'warning',
            action: 'p2p_bet_disputed',
            outcome: 'allowed',
            actorId: callerUid,
            ip,
            route: pathname,
            details: { betId: bet.id },
          });
        }
      }

      persistLocalBets(bets);
      await persistBetFirestore(bet);

      const viewerWallet = await getAuthoritativeUserWallet({ userUid: callerUid });
      return {
        statusCode: 200,
        payload: {
          success: true,
          bet: sanitizeBetForClient(bet, callerUid, isAdmin),
          wallet: viewerWallet,
        },
      };
    });
  }

  return { statusCode: 404, payload: { success: false, error: `Unsupported P2P route: ${pathname}` } };
}
