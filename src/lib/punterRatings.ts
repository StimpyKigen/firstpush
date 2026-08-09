import { jackpots } from './mockData';
import {
  PlayerRatingProfile,
  createInitialPlayerProfile,
  calculateStarsFromRp,
} from './ratingEngine';

export interface PunterStat {
  stars: number; // 0-5 in 0.5 increments
  accuracyPct: number; // 0-100, weighted average correct-pick rate
  closestWins: number; // number of times crowned closest-to-the-winning-slip
  gamesTracked: number; // number of settled jackpots factored into this rating
  rp?: number;
  mmr?: number;
  tierName?: string;
}

const profileCache = new Map<string, PlayerRatingProfile>();

/**
 * Registry built from settled jackpots in mockData
 */
const registry = new Map<string, { totalCorrect: number; totalMatches: number; closestWins: number; entries: number }>();

jackpots.forEach((jp) => {
  if (!jp.leaderboard) return;
  jp.leaderboard.forEach((entry) => {
    const existing = registry.get(entry.username) ?? { totalCorrect: 0, totalMatches: 0, closestWins: 0, entries: 0 };
    existing.totalCorrect += entry.correct;
    existing.totalMatches += entry.totalMatches;
    existing.closestWins += entry.isClosest ? 1 : 0;
    existing.entries += 1;
    registry.set(entry.username, existing);
  });
});

export function getPlayerProfile(username: string): PlayerRatingProfile {
  const cached = profileCache.get(username);
  if (cached) return cached;

  const initial = createInitialPlayerProfile(username);
  
  // If user exists in settled jackpot registry, merge real stats
  const real = registry.get(username);
  if (real) {
    initial.totalJackpotsPlayed = Math.max(initial.totalJackpotsPlayed, real.entries);
    initial.top3Finishes = Math.max(initial.top3Finishes, real.closestWins);
    if (real.totalMatches > 0) {
      initial.accuracyPct = Math.round((real.totalCorrect / real.totalMatches) * 100);
      initial.totalCorrectPicks = real.totalCorrect;
      initial.totalPicksSubmitted = real.totalMatches;
    }
  }

  profileCache.set(username, initial);
  return initial;
}

export function getPunterStats(username: string): PunterStat {
  const profile = getPlayerProfile(username);
  return {
    stars: profile.stars,
    accuracyPct: profile.accuracyPct,
    closestWins: profile.top3Finishes,
    gamesTracked: profile.totalJackpotsPlayed,
    rp: profile.rp,
    mmr: profile.mmr,
    tierName: profile.tierName,
  };
}

export function getStarRating(username: string): number {
  return getPlayerProfile(username).stars;
}

export function calculateStarRating(accuracyPct: number, closestWins: number): number {
  // Backwards compatibility helper
  const rpEstimate = Math.round((accuracyPct * 4) + (closestWins * 75));
  return calculateStarsFromRp(rpEstimate).stars;
}
