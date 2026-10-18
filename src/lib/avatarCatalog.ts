export type AvatarCategory =
  | 'glyphs'
  | 'champions'
  | 'football'
  | 'animals'
  | 'fantasy'
  | 'futuristic'
  | 'human'
  | 'gaming'
  | 'luxury'
  | 'african'
  | 'abstract';

export type UnlockTier = 'starter' | 'silver' | 'gold' | 'diamond' | 'champion' | 'seasonal' | 'premium';

export interface AvatarOption {
  id: string;
  label: string;
  category: AvatarCategory;
  tier: UnlockTier;
  unlockRequirement: string;
  svgContent: string;
  tags: string[];
  isFeatured?: boolean;
  isCustom?: boolean;
}

export interface CategoryInfo {
  id: AvatarCategory;
  label: string;
  iconName: string;
  description: string;
}

export const AVATAR_CATEGORIES: CategoryInfo[] = [
  { id: 'glyphs', label: 'Glyphs', iconName: 'Shapes', description: 'Minimalist geometric silhouettes and abstract glyphs by Matt Houser' },
];

export const UNLOCK_TIER_CONFIG: Record<UnlockTier, { label: string; color: string; badgeBg: string; minJackpots?: number; minRating?: number; minWins?: number }> = {
  starter: { label: 'Starter', color: '#10b981', badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  silver: { label: 'Silver Tier', color: '#94a3b8', badgeBg: 'bg-slate-500/10 border-slate-400/30 text-slate-300', minJackpots: 10 },
  gold: { label: 'Gold Tier (3★)', color: '#f59e0b', badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', minRating: 3.0 },
  diamond: { label: 'Diamond (5 Wins)', color: '#38bdf8', badgeBg: 'bg-sky-500/10 border-sky-500/30 text-sky-300', minWins: 5 },
  champion: { label: 'Champion (5★)', color: '#ec4899', badgeBg: 'bg-pink-500/10 border-pink-500/30 text-pink-400', minRating: 4.8 },
  seasonal: { label: 'Special Event', color: '#8b5cf6', badgeBg: 'bg-purple-500/10 border-purple-500/30 text-purple-300' },
  premium: { label: 'VIP Exclusive', color: '#ef4444', badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400' },
};

import { GLYPHS_AVATARS } from './dicebearGlyphsData';

/**
 * AVATAR_CATALOG now strictly contains DiceBear Glyphs exclusively.
 */
export const AVATAR_CATALOG: AvatarOption[] = [...GLYPHS_AVATARS];

/**
 * Randomizing algorithm to assign a unique, evenly distributed DiceBear Glyph avatar.
 * Can be called with an optional seed (e.g. phone/username hash) or purely random.
 */
export function getRandomGlyphAvatar(seed?: string | number): AvatarOption {
  if (!GLYPHS_AVATARS || GLYPHS_AVATARS.length === 0) {
    throw new Error('No glyph avatars available');
  }

  if (seed !== undefined && seed !== null && seed !== '') {
    const str = String(seed);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % GLYPHS_AVATARS.length;
    return GLYPHS_AVATARS[index];
  }

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const index = arr[0] % GLYPHS_AVATARS.length;
    return GLYPHS_AVATARS[index];
  }

  const index = Math.floor(Math.random() * GLYPHS_AVATARS.length);
  return GLYPHS_AVATARS[index];
}

export function getAvatarById(id?: string | null): AvatarOption | undefined {
  if (!id) return undefined;
  const match = AVATAR_CATALOG.find((a) => a.id === id);
  if (match) return match;
  // If an account has an old legacy avatar id, map gracefully and deterministically to a glyph
  return getRandomGlyphAvatar(id);
}
