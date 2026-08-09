import crypto from 'crypto';

// Secret key for HMAC token signing & verification (fallback to environment or server secret)
const SERVER_SECRET = process.env.AD_REWARD_JWT_SECRET || process.env.GEMINI_API_KEY || 'mshindi_secure_ad_reward_secret_key_2026_x89f';

export interface AdChallengeRecord {
  challengeId: string;
  userId: string;
  roomId: string;
  adProvider: string;
  issuedAt: number;
  expiresAt: number;
  status: 'pending' | 'redeemed' | 'expired' | 'rejected';
  minWatchDurationSeconds: number;
  clientIp?: string;
  userAgent?: string;
}

export interface RewardedAccessRecord {
  rewardId: string; // matches challengeId
  userId: string;
  roomId: string;
  adProvider: string;
  verificationStatus: 'verified' | 'rejected' | 'pending';
  issuedTime: number;
  expirationTime: number; // exact 15 minutes (900,000ms)
  redeemedStatus: boolean;
  ipAddress?: string;
  deviceUserAgent?: string;
  tokenId: string;
  tokenSignature: string;
}

export interface SignedRoomTokenPayload {
  tokenId: string;
  userId: string;
  roomId: string;
  issuedAt: number;
  expiresAt: number;
  adProvider: string;
  signature: string;
}

export interface AuditLogEntry {
  id: string;
  eventType:
    | 'REWARD_REQUESTED'
    | 'REWARD_VERIFIED'
    | 'REWARD_REJECTED'
    | 'TOKEN_ISSUED'
    | 'TOKEN_EXPIRED'
    | 'DUPLICATE_REWARD_ATTEMPT'
    | 'FRAUD_DETECTION_EVENT'
    | 'AUTHORIZATION_FAILURE'
    | 'AUTHORIZATION_SUCCESS';
  userId: string;
  roomId: string;
  details: string;
  ipAddress?: string;
  timestamp: number;
  meta?: Record<string, any>;
}

// In-Memory Thread-Safe State Stores (with cleanup intervals)
const challengesStore = new Map<string, AdChallengeRecord>();
const rewardsStore = new Map<string, RewardedAccessRecord>(); // Key: rewardId
const activeTokensStore = new Map<string, SignedRoomTokenPayload>(); // Key: `${userId}_${roomId}`
const auditLogsStore: AuditLogEntry[] = [];

// Rate Limiting Map: User/IP -> count & resetTime
interface AdRateBucket {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, AdRateBucket>();

// Periodic memory garbage collection (cleans expired challenges every 2 mins)
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of challengesStore.entries()) {
    if (now > challenge.expiresAt + 60_000 && challenge.status !== 'redeemed') {
      challengesStore.delete(id);
    }
  }
  for (const [key, token] of activeTokensStore.entries()) {
    if (now > token.expiresAt) {
      activeTokensStore.delete(key);
    }
  }
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (now > bucket.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 120_000);

// --- Cryptographic Helper Functions ---

export function generateHmacSignature(data: string): string {
  return crypto.createHmac('sha256', SERVER_SECRET).update(data).digest('hex');
}

export function verifyHmacSignature(data: string, signature: string): boolean {
  try {
    const expected = generateHmacSignature(data);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export function logAuditEvent(
  eventType: AuditLogEntry['eventType'],
  userId: string,
  roomId: string,
  details: string,
  ipAddress?: string,
  meta?: Record<string, any>
) {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    eventType,
    userId: userId || 'unknown_user',
    roomId: roomId || 'global_room',
    details,
    ipAddress,
    timestamp: Date.now(),
    meta,
  };
  auditLogsStore.unshift(entry);
  if (auditLogsStore.length > 1000) {
    auditLogsStore.pop();
  }
  console.log(`[SEC_AUDIT] [${entry.eventType}] User: ${entry.userId} Room: ${entry.roomId} - ${entry.details}`);
}

// --- Rate Limiting Helper ---
export function checkAdRateLimit(key: string, limit: number = 6, windowMs: number = 60_000): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  let bucket = rateLimitStore.get(key);

  if (!bucket || now > bucket.resetTime) {
    bucket = { count: 1, resetTime: now + windowMs };
    rateLimitStore.set(key, bucket);
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.resetTime - now };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 };
}

// --- Core Rewarded Ad Business Logic ---

/**
 * 1. Issue a unique, cryptographically signed single-use ad challenge.
 */
export function createAdChallenge(
  userId: string,
  roomId: string,
  adProvider: string = 'google_admob',
  clientIp?: string,
  userAgent?: string
): { success: boolean; challengeId?: string; nonce?: string; signature?: string; minWatchDurationSeconds?: number; error?: string } {
  if (!userId || !roomId) {
    return { success: false, error: 'Invalid parameters: userId and roomId are required.' };
  }

  // Rate limiting check
  const rateKey = `rate_${userId}_${clientIp || 'ip'}`;
  const rateResult = checkAdRateLimit(rateKey, 5, 60_000); // max 5 ad requests / min
  if (!rateResult.allowed) {
    logAuditEvent('FRAUD_DETECTION_EVENT', userId, roomId, `Rate limit exceeded for ad challenge. Retry in ${Math.ceil(rateResult.retryAfterMs / 1000)}s`, clientIp);
    return { success: false, error: `Too many reward requests. Please wait ${Math.ceil(rateResult.retryAfterMs / 1000)} seconds before watching another ad.` };
  }

  const now = Date.now();
  const challengeId = `ch_${now}_${crypto.randomBytes(6).toString('hex')}`;
  const nonce = crypto.randomBytes(12).toString('hex');
  const minWatchDurationSeconds = 6;
  const expiresAt = now + 3 * 60 * 1000; // 3 minute expiration window

  const challengeDataToSign = `${challengeId}:${userId}:${roomId}:${nonce}:${expiresAt}`;
  const signature = generateHmacSignature(challengeDataToSign);

  const challenge: AdChallengeRecord = {
    challengeId,
    userId,
    roomId,
    adProvider,
    issuedAt: now,
    expiresAt,
    status: 'pending',
    minWatchDurationSeconds,
    clientIp,
    userAgent,
  };

  challengesStore.set(challengeId, challenge);

  logAuditEvent('REWARD_REQUESTED', userId, roomId, `Ad challenge created (${challengeId}) via ${adProvider}`, clientIp, { nonce });

  return {
    success: true,
    challengeId,
    nonce,
    signature,
    minWatchDurationSeconds,
  };
}

/**
 * 2. Verify completed rewarded ad & issue signed 15-minute access token.
 */
export function verifyAndGrantRewardToken(
  userId: string,
  roomId: string,
  challengeId: string,
  watchDurationSeconds: number,
  adProvider: string,
  clientSignature?: string,
  clientIp?: string,
  userAgent?: string
): { success: boolean; token?: string; tokenPayload?: SignedRoomTokenPayload; error?: string; code?: string } {
  const now = Date.now();

  // 1. Retrieve challenge record
  const challenge = challengesStore.get(challengeId);
  if (!challenge) {
    logAuditEvent('REWARD_REJECTED', userId, roomId, `Invalid or non-existent challenge ID (${challengeId})`, clientIp);
    return { success: false, error: 'Invalid or expired reward challenge session.', code: 'INVALID_CHALLENGE' };
  }

  // 2. User & Room ownership verification
  if (challenge.userId !== userId || challenge.roomId !== roomId) {
    logAuditEvent('FRAUD_DETECTION_EVENT', userId, roomId, `User or Room mismatch on challenge verification! Expected ${challenge.userId}/${challenge.roomId}, got ${userId}/${roomId}`, clientIp);
    return { success: false, error: 'Challenge session user mismatch. Request rejected.', code: 'USER_MISMATCH' };
  }

  // 3. Expiration Check
  if (now > challenge.expiresAt) {
    challenge.status = 'expired';
    logAuditEvent('REWARD_REJECTED', userId, roomId, `Ad challenge expired before completion (${challengeId})`, clientIp);
    return { success: false, error: 'Reward challenge session expired. Please attempt ad again.', code: 'CHALLENGE_EXPIRED' };
  }

  // 4. Anti-Replay Check (Single-use challenge)
  if (challenge.status === 'redeemed') {
    logAuditEvent('DUPLICATE_REWARD_ATTEMPT', userId, roomId, `REPLAY ATTACK PREVENTED! Challenge ${challengeId} was already redeemed.`, clientIp);
    return { success: false, error: 'This reward payload has already been redeemed.', code: 'DUPLICATE_CLAIM' };
  }

  // 5. Anti-Automation & Minimum Watch Duration Verification
  if (typeof watchDurationSeconds !== 'number' || watchDurationSeconds < challenge.minWatchDurationSeconds) {
    logAuditEvent('FRAUD_DETECTION_EVENT', userId, roomId, `Suspicious fast ad completion! Duration: ${watchDurationSeconds}s (required min: ${challenge.minWatchDurationSeconds}s)`, clientIp);
    return { success: false, error: 'Ad was completed too quickly. Full video playback is required.', code: 'WATCH_DURATION_TOO_SHORT' };
  }

  // 6. Cryptographic Client Signature Verification (if provided)
  if (clientSignature) {
    const dataToVerify = `${challengeId}:${userId}:${roomId}`;
    const expectedSig = generateHmacSignature(dataToVerify);
    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(clientSignature))) {
      logAuditEvent('FRAUD_DETECTION_EVENT', userId, roomId, `Tampered or invalid client signature on challenge verification`, clientIp);
      return { success: false, error: 'Invalid request signature signature check failed.', code: 'SIGNATURE_INVALID' };
    }
  }

  // 7. Atomically mark challenge as REDEEMED (prevents race conditions)
  challenge.status = 'redeemed';

  // 8. Generate 15-Minute Cryptographically Signed Token
  const tokenId = `token_${now}_${crypto.randomBytes(8).toString('hex')}`;
  const tokenDurationMs = 15 * 60 * 1000; // 15 minutes exact
  const issuedAt = now;
  const expiresAt = now + tokenDurationMs;

  const rawTokenData = `${tokenId}:${userId}:${roomId}:${issuedAt}:${expiresAt}:${adProvider}`;
  const tokenSignature = generateHmacSignature(rawTokenData);

  const tokenPayload: SignedRoomTokenPayload = {
    tokenId,
    userId,
    roomId,
    issuedAt,
    expiresAt,
    adProvider,
    signature: tokenSignature,
  };

  // Encode as base64 signed token string
  const signedTokenString = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');

  // Store active token in memory
  activeTokensStore.set(`${userId}_${roomId}`, tokenPayload);

  // Store Rewarded Access Record in server database
  const accessRecord: RewardedAccessRecord = {
    rewardId: challengeId,
    userId,
    roomId,
    adProvider,
    verificationStatus: 'verified',
    issuedTime: issuedAt,
    expirationTime: expiresAt,
    redeemedStatus: true,
    ipAddress: clientIp,
    deviceUserAgent: userAgent,
    tokenId,
    tokenSignature,
  };
  rewardsStore.set(challengeId, accessRecord);

  logAuditEvent('REWARD_VERIFIED', userId, roomId, `Ad verified. Granted 15-min access token (${tokenId})`, clientIp, { provider: adProvider });
  logAuditEvent('TOKEN_ISSUED', userId, roomId, `Signed 15-min token issued until ${new Date(expiresAt).toISOString()}`, clientIp);

  return {
    success: true,
    token: signedTokenString,
    tokenPayload,
  };
}

/**
 * 3. Verify room access authorization token or premium status.
 */
export function authorizeRoomAccess(
  userId: string,
  roomId: string,
  signedTokenString?: string,
  isPremiumSubscriber: boolean = false,
  clientIp?: string
): { allowed: boolean; reason: 'premium_subscription' | 'active_token' | 'ad_required' | 'token_expired' | 'invalid_token'; expiresAt?: number; remainingSeconds?: number; error?: string } {
  // Rule 1: Premium subscribers bypass system entirely
  if (isPremiumSubscriber) {
    logAuditEvent('AUTHORIZATION_SUCCESS', userId, roomId, `Access granted via Premium Subscription`, clientIp);
    return { allowed: true, reason: 'premium_subscription' };
  }

  // Rule 2: Check active token string or memory cache
  const activeCachedToken = activeTokensStore.get(`${userId}_${roomId}`);
  const now = Date.now();

  let tokenToVerify: SignedRoomTokenPayload | null = activeCachedToken || null;

  if (signedTokenString) {
    try {
      const decodedJson = Buffer.from(signedTokenString, 'base64').toString('utf-8');
      const parsed: SignedRoomTokenPayload = JSON.parse(decodedJson);

      // Verify HMAC Signature on Token
      const rawTokenData = `${parsed.tokenId}:${parsed.userId}:${parsed.roomId}:${parsed.issuedAt}:${parsed.expiresAt}:${parsed.adProvider}`;
      const isSigValid = verifyHmacSignature(rawTokenData, parsed.signature);

      if (!isSigValid) {
        logAuditEvent('AUTHORIZATION_FAILURE', userId, roomId, `FORGED TOKEN DETECTED! Signature verification failed.`, clientIp);
        return { allowed: false, reason: 'invalid_token', error: 'Tampered or forged access token.' };
      }

      tokenToVerify = parsed;
    } catch {
      logAuditEvent('AUTHORIZATION_FAILURE', userId, roomId, `Malformed access token payload string`, clientIp);
      return { allowed: false, reason: 'invalid_token', error: 'Malformed access token.' };
    }
  }

  if (!tokenToVerify) {
    logAuditEvent('AUTHORIZATION_FAILURE', userId, roomId, `No active room access token found. Ad required.`, clientIp);
    return { allowed: false, reason: 'ad_required', error: 'Room access requires a completed rewarded ad or premium membership.' };
  }

  // User & Room Verification
  if (tokenToVerify.userId !== userId || tokenToVerify.roomId !== roomId) {
    logAuditEvent('AUTHORIZATION_FAILURE', userId, roomId, `Token user/room mismatch (${tokenToVerify.userId}/${tokenToVerify.roomId})`, clientIp);
    return { allowed: false, reason: 'invalid_token', error: 'Access token does not belong to this user or room.' };
  }

  // Expiration Check (15 minutes)
  if (now >= tokenToVerify.expiresAt) {
    logAuditEvent('TOKEN_EXPIRED', userId, roomId, `Room access token expired`, clientIp);
    activeTokensStore.delete(`${userId}_${roomId}`);
    return { allowed: false, reason: 'token_expired', error: 'Your 15-minute room access token has expired. Watch another ad to renew access.' };
  }

  const remainingSeconds = Math.max(0, Math.floor((tokenToVerify.expiresAt - now) / 1000));

  logAuditEvent('AUTHORIZATION_SUCCESS', userId, roomId, `Valid 15-min token active. ${remainingSeconds}s remaining.`, clientIp);

  return {
    allowed: true,
    reason: 'active_token',
    expiresAt: tokenToVerify.expiresAt,
    remainingSeconds,
  };
}

export function getAuditLogs(userId?: string): AuditLogEntry[] {
  if (!userId) return [...auditLogsStore];
  return auditLogsStore.filter((log) => log.userId === userId);
}

export function getRewardedAccessRecords(userId?: string): RewardedAccessRecord[] {
  const records = Array.from(rewardsStore.values());
  if (!userId) return records;
  return records.filter((r) => r.userId === userId);
}
