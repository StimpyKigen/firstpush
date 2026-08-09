import { useSyncExternalStore } from 'react';
import { AdAnalyticsData, AdConfig, AdImpressionLog, AdProviderId, RoomAccessToken } from './types';
import { useWallet } from '../store';

const AD_CONFIG_STORAGE_KEY = 'mshindi_ad_config_v1';
const AD_TOKENS_STORAGE_KEY = 'mshindi_ad_tokens_v1';
const AD_IMPRESSIONS_STORAGE_KEY = 'mshindi_ad_impressions_v1';

export const DEFAULT_AD_CONFIG: AdConfig = {
  adsEnabled: true,
  preferredDuration: 8, // 6-10s preferred default
  maxPreferredDuration: 15,
  absoluteMaxDuration: 20,
  tokenDurationMinutes: 15, // 15 mins temporary token
  providerPriority: ['google_admob', 'unity_ads', 'direct_sponsored', 'house_ads', 'simulated_test'],
  fallbackProvider: 'house_ads',
  retryAttempts: 3,
  houseAdPriority: false,
  perRoomAdsEnabled: {},
};

// Internal State
let currentConfig: AdConfig = loadStoredConfig();
let activeTokens: Map<string, RoomAccessToken> = loadStoredTokens(); // Key: `${userId}_${roomId}`
let impressionLogs: AdImpressionLog[] = loadStoredImpressions();

export interface AdStoreSnapshot {
  config: AdConfig;
  tokens: Map<string, RoomAccessToken>;
  impressions: AdImpressionLog[];
  analytics: AdAnalyticsData;
}

let cachedSnapshot: AdStoreSnapshot = createSnapshot();

const listeners = new Set<() => void>();

function notifyListeners() {
  cachedSnapshot = createSnapshot();
  listeners.forEach((listener) => listener());
}

function createSnapshot(): AdStoreSnapshot {
  // Purge expired tokens automatically
  const now = Date.now();
  let tokensChanged = false;
  activeTokens.forEach((token, key) => {
    if (token.expiresAt <= now) {
      activeTokens.delete(key);
      tokensChanged = true;
    }
  });

  if (tokensChanged) {
    saveStoredTokens(activeTokens);
  }

  // Calculate analytics metrics from impression logs
  const requests = impressionLogs.length;
  const served = impressionLogs.filter((i) => i.duration > 0).length;
  const completed = impressionLogs.filter((i) => i.completed).length;
  const skipped = impressionLogs.filter((i) => i.skipped).length;
  const tokensGenerated = activeTokens.size;
  const estimatedRevenueKsh = impressionLogs.reduce((acc, curr) => acc + (curr.estimatedRevenueKsh || 0), 0);

  return {
    config: { ...currentConfig },
    tokens: new Map(activeTokens),
    impressions: [...impressionLogs],
    analytics: {
      requests,
      served,
      completed,
      skipped,
      tokensGenerated,
      purchasesAfterAds: 0,
      estimatedRevenueKsh,
    },
  };
}

function loadStoredConfig(): AdConfig {
  try {
    const raw = localStorage.getItem(AD_CONFIG_STORAGE_KEY);
    return raw ? { ...DEFAULT_AD_CONFIG, ...JSON.parse(raw) } : { ...DEFAULT_AD_CONFIG };
  } catch {
    return { ...DEFAULT_AD_CONFIG };
  }
}

function saveStoredConfig(config: AdConfig) {
  try {
    localStorage.setItem(AD_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

function loadStoredTokens(): Map<string, RoomAccessToken> {
  const map = new Map<string, RoomAccessToken>();
  try {
    const raw = localStorage.getItem(AD_TOKENS_STORAGE_KEY);
    if (raw) {
      const arr: RoomAccessToken[] = JSON.parse(raw);
      const now = Date.now();
      arr.forEach((token) => {
        if (token.expiresAt > now) {
          map.set(`${token.userId}_${token.roomId}`, token);
        }
      });
    }
  } catch {
    // ignore
  }
  return map;
}

function saveStoredTokens(tokens: Map<string, RoomAccessToken>) {
  try {
    const arr = Array.from(tokens.values());
    localStorage.setItem(AD_TOKENS_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

function loadStoredImpressions(): AdImpressionLog[] {
  try {
    const raw = localStorage.getItem(AD_IMPRESSIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredImpressions(impressions: AdImpressionLog[]) {
  try {
    // Keep max 500 recent logs
    const trimmed = impressions.slice(-500);
    localStorage.setItem(AD_IMPRESSIONS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export const adStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): AdStoreSnapshot {
    return cachedSnapshot;
  },

  getConfig(): AdConfig {
    return currentConfig;
  },

  updateConfig(newPartialConfig: Partial<AdConfig>) {
    currentConfig = { ...currentConfig, ...newPartialConfig };
    saveStoredConfig(currentConfig);
    notifyListeners();
  },

  /**
   * Check room access permissions.
   * Return permanent purchase status, temporary token validity, or ad required.
   */
  canAccessRoom(userId: string, roomId: string): {
    allowed: boolean;
    reason: 'permanent_purchase' | 'active_token' | 'ad_required';
    token?: RoomAccessToken;
  } {
    // 1. Check permanent unlock in wallet store
    const isPermanentlyUnlocked = useWallet.getState().isRoomUnlocked(roomId);
    if (isPermanentlyUnlocked) {
      return { allowed: true, reason: 'permanent_purchase' };
    }

    // 2. Check if global ads disabled or per-room ads disabled
    if (!currentConfig.adsEnabled || currentConfig.perRoomAdsEnabled[roomId] === false) {
      return { allowed: true, reason: 'permanent_purchase' };
    }

    // 3. Check active room access token
    const tokenKey = `${userId}_${roomId}`;
    const token = activeTokens.get(tokenKey);
    const now = Date.now();

    if (token && token.expiresAt > now) {
      return { allowed: true, reason: 'active_token', token };
    }

    return { allowed: false, reason: 'ad_required' };
  },

  /**
   * Generates a new Room Access Token valid for `tokenDurationMinutes` upon watching ad.
   */
  grantRoomAccessToken(userId: string, roomId: string, provider: AdProviderId, signedTokenString?: string, customExpiresAt?: number): RoomAccessToken {
    const now = Date.now();
    const durationMs = currentConfig.tokenDurationMinutes * 60 * 1000;
    const expiresAt = customExpiresAt || (now + durationMs);

    const token: RoomAccessToken = {
      tokenId: `token-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      roomId,
      issuedAt: now,
      expiresAt,
      adProviderUsed: provider,
      signedTokenString,
    };

    activeTokens.set(`${userId}_${roomId}`, token);
    saveStoredTokens(activeTokens);
    notifyListeners();
    return token;
  },

  /**
   * Request Backend Challenge for Rewarded Ad (Server-Side Verification)
   */
  async requestBackendChallenge(userId: string, roomId: string, adProvider: AdProviderId): Promise<{ success: boolean; challengeId?: string; nonce?: string; minWatchDurationSeconds?: number; error?: string }> {
    try {
      const res = await fetch('/api/rewarded-ads/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roomId, adProvider }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to request ad challenge from backend.' };
      }
      return {
        success: true,
        challengeId: data.challengeId,
        nonce: data.nonce,
        minWatchDurationSeconds: data.minWatchDurationSeconds || 6,
      };
    } catch (err: any) {
      return { success: false, error: 'Network or backend error initiating ad challenge.' };
    }
  },

  /**
   * Verify completed ad with Backend SSV Engine & obtain signed 15-minute token
   */
  async verifyBackendReward(
    userId: string,
    roomId: string,
    challengeId: string,
    watchDurationSeconds: number,
    adProvider: AdProviderId
  ): Promise<{ success: boolean; token?: RoomAccessToken; error?: string }> {
    try {
      const res = await fetch('/api/rewarded-ads/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roomId, challengeId, watchDurationSeconds, adProvider }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Backend rejected reward claim.' };
      }

      // Grant token locally with server signature
      const signedTokenString = data.token;
      const expiresAt = data.tokenPayload?.expiresAt;
      const token = adStore.grantRoomAccessToken(userId, roomId, adProvider, signedTokenString, expiresAt);

      return { success: true, token };
    } catch (err: any) {
      return { success: false, error: 'Server connection failed while verifying ad reward.' };
    }
  },

  /**
   * Perform backend room authorization middleware check
   */
  async verifyBackendRoomAccess(userId: string, roomId: string, isPremiumSubscriber: boolean = false): Promise<{ allowed: boolean; reason?: string; error?: string }> {
    try {
      const existingToken = activeTokens.get(`${userId}_${roomId}`);
      const res = await fetch('/api/rewarded-ads/verify-room-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          roomId,
          token: existingToken?.signedTokenString,
          isPremiumSubscriber,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.allowed) {
        if (existingToken && data.reason === 'token_expired') {
          activeTokens.delete(`${userId}_${roomId}`);
          saveStoredTokens(activeTokens);
          notifyListeners();
        }
        return { allowed: false, reason: data.reason || 'unauthorized', error: data.error || 'Access denied.' };
      }
      return { allowed: true, reason: data.reason };
    } catch {
      // Fallback to local check if offline
      const check = adStore.canAccessRoom(userId, roomId);
      return { allowed: check.allowed, reason: check.reason };
    }
  },

  /**
   * Revoke or invalidate token (e.g. when user purchases permanent access)
   */
  invalidateRoomToken(userId: string, roomId: string) {
    const key = `${userId}_${roomId}`;
    if (activeTokens.has(key)) {
      activeTokens.delete(key);
      saveStoredTokens(activeTokens);
      notifyListeners();
    }
  },

  /**
   * Record impression analytics
   */
  recordImpression(log: Omit<AdImpressionLog, 'id'>) {
    const fullLog: AdImpressionLog = {
      ...log,
      id: `imp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    impressionLogs = [fullLog, ...impressionLogs];
    saveStoredImpressions(impressionLogs);
    notifyListeners();
  },

  /**
   * Reset stats/impressions
   */
  clearImpressions() {
    impressionLogs = [];
    saveStoredImpressions([]);
    notifyListeners();
  },
};

export function useAdStore() {
  return useSyncExternalStore(adStore.subscribe, adStore.getSnapshot, adStore.getSnapshot);
}
