import { useSyncExternalStore } from 'react';
import { AVATAR_CATALOG, AvatarOption, AvatarCategory, UnlockTier, UNLOCK_TIER_CONFIG } from './avatarCatalog';

const FAVORITES_STORAGE_KEY = 'mshindi_favorite_avatars_v1';
const ADMIN_CUSTOM_AVATARS_KEY = 'mshindi_admin_custom_avatars_v1';
const DISABLED_AVATARS_KEY = 'mshindi_disabled_avatars_v1';
const FEATURED_AVATARS_KEY = 'mshindi_featured_avatars_v1';

// Internal State
let favoriteAvatarIds: Set<string> = new Set(loadStoredSet(FAVORITES_STORAGE_KEY));
let disabledAvatarIds: Set<string> = new Set(loadStoredSet(DISABLED_AVATARS_KEY));
let featuredAvatarIds: Set<string> = new Set(loadStoredSet(FEATURED_AVATARS_KEY));
let customAdminAvatars: AvatarOption[] = loadStoredCustomAvatars();

export interface AvatarStoreSnapshot {
  favorites: Set<string>;
  disabled: Set<string>;
  featured: Set<string>;
  custom: AvatarOption[];
}

// Stable cached snapshot to prevent React useSyncExternalStore infinite re-render loop
let cachedSnapshot: AvatarStoreSnapshot = {
  favorites: favoriteAvatarIds,
  disabled: disabledAvatarIds,
  featured: featuredAvatarIds,
  custom: customAdminAvatars,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  cachedSnapshot = {
    favorites: new Set(favoriteAvatarIds),
    disabled: new Set(disabledAvatarIds),
    featured: new Set(featuredAvatarIds),
    custom: [...customAdminAvatars],
  };
  listeners.forEach((listener) => listener());
}

function loadStoredSet(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredSet(key: string, items: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(items)));
  } catch {
    // ignore
  }
}

function loadStoredCustomAvatars(): AvatarOption[] {
  try {
    const raw = localStorage.getItem(ADMIN_CUSTOM_AVATARS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomAvatars(avatars: AvatarOption[]) {
  try {
    localStorage.setItem(ADMIN_CUSTOM_AVATARS_KEY, JSON.stringify(avatars));
  } catch {
    // ignore
  }
}

// User Context Interface for Unlock Verification
export interface UserStatsContext {
  jackpotsPlayed: number;
  ratingStars: number;
  jackpotWins: number;
  isVip?: boolean;
}

export function isAvatarUnlocked(avatar: AvatarOption, userStats: UserStatsContext): boolean {
  if (avatar.tier === 'starter') return true;
  const config = UNLOCK_TIER_CONFIG[avatar.tier];
  if (!config) return true;

  if (avatar.tier === 'silver' && userStats.jackpotsPlayed >= (config.minJackpots || 10)) return true;
  if (avatar.tier === 'gold' && userStats.ratingStars >= (config.minRating || 3.0)) return true;
  if (avatar.tier === 'diamond' && userStats.jackpotWins >= (config.minWins || 5)) return true;
  if (avatar.tier === 'champion' && userStats.ratingStars >= (config.minRating || 4.8)) return true;
  if (avatar.tier === 'seasonal' && userStats.jackpotsPlayed >= 1) return true;
  if (avatar.tier === 'premium' && (userStats.isVip || userStats.jackpotWins >= 10)) return true;

  return false;
}

export const avatarStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot(): AvatarStoreSnapshot {
    return cachedSnapshot;
  },

  toggleFavorite(avatarId: string) {
    favoriteAvatarIds = new Set(favoriteAvatarIds);
    if (favoriteAvatarIds.has(avatarId)) {
      favoriteAvatarIds.delete(avatarId);
    } else {
      favoriteAvatarIds.add(avatarId);
    }
    saveStoredSet(FAVORITES_STORAGE_KEY, favoriteAvatarIds);
    notifyListeners();
  },

  isFavorite(avatarId: string): boolean {
    return favoriteAvatarIds.has(avatarId);
  },

  // Admin Methods
  addCustomAvatar(newAvatar: Omit<AvatarOption, 'id'>) {
    const id = `admin-custom-${Date.now()}`;
    const fullAvatar: AvatarOption = {
      ...newAvatar,
      id,
      isCustom: true,
    };
    customAdminAvatars = [fullAvatar, ...customAdminAvatars];
    saveCustomAvatars(customAdminAvatars);
    notifyListeners();
  },

  toggleDisableAvatar(avatarId: string) {
    disabledAvatarIds = new Set(disabledAvatarIds);
    if (disabledAvatarIds.has(avatarId)) {
      disabledAvatarIds.delete(avatarId);
    } else {
      disabledAvatarIds.add(avatarId);
    }
    saveStoredSet(DISABLED_AVATARS_KEY, disabledAvatarIds);
    notifyListeners();
  },

  toggleFeatureAvatar(avatarId: string) {
    featuredAvatarIds = new Set(featuredAvatarIds);
    if (featuredAvatarIds.has(avatarId)) {
      featuredAvatarIds.delete(avatarId);
    } else {
      featuredAvatarIds.add(avatarId);
    }
    saveStoredSet(FEATURED_AVATARS_KEY, featuredAvatarIds);
    notifyListeners();
  },

  getAllActiveAvatars(): AvatarOption[] {
    const all = [...customAdminAvatars, ...AVATAR_CATALOG];
    return all.filter((a) => !disabledAvatarIds.has(a.id));
  },
};

export function useAvatarStore() {
  return useSyncExternalStore(avatarStore.subscribe, avatarStore.getSnapshot, avatarStore.getSnapshot);
}
