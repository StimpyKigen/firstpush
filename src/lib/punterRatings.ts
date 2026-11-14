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

const SHOWCASE_SEED_HANDLES = new Set([
  'mshindipro', 'juma_master', 'kip_punter', 'otieno_tips', 'nairobi_king',
  'mwangipicks', 'kamau_betting', 'achieng_bets', 'wanjiku_picks',
  'nairobinostradamus', 'bankeronly254', 'slipdoctorke', 'formguidefred',
  'mtaaanalyst', 'chezakamawewe', 'hustlerodds', 'kipchogepredictor',
  'kiprotichpicks', 'oddsmasterke', 'mjengomoneyman', 'betkingkisumu',
  'bundamathematician', 'punterwaeastlando', 'jackpotjuma', 'coachotieno_tips',
  'mamambogamillions', 'riskitforbiskit', 'tenbobtycoon', 'doublechancedan',
  'goalrushgathoni', 'ligisokalegend', 'ketepakelvin', 'zaostatszone',
  'punditpatuma', 'overunderoscar', 'homeadvantagehilda',
]);

export function clearPunterRatingsCacheForTests(): void {
  profileCache.clear();
}

export function getPlayerProfile(username: string): PlayerRatingProfile {
  const clean = String(username || '').trim();
  const cached = profileCache.get(clean);
  if (cached) return cached;

  const real = registry.get(clean);
  const isShowcase = Boolean(real || SHOWCASE_SEED_HANDLES.has(clean.toLowerCase()));
  const initial = createInitialPlayerProfile(clean, 1, { showcase: isShowcase });

  // If user exists in settled jackpot registry, merge settled stats AND recompute RP/stars consistently
  if (real) {
    initial.totalJackpotsPlayed = Math.max(initial.totalJackpotsPlayed, real.entries);
    initial.top3Finishes = real.closestWins;
    if (real.totalMatches > 0) {
      initial.accuracyPct = Math.round((real.totalCorrect / real.totalMatches) * 100);
      initial.totalCorrectPicks = real.totalCorrect;
      initial.totalPicksSubmitted = real.totalMatches;
      initial.averageCorrectPicks = Number(((real.totalCorrect / real.entries) || 0).toFixed(1));
    }
    const recomputedRp = Math.max(
      0,
      Math.round(initial.accuracyPct * 4 + initial.top3Finishes * 75 + real.entries * 8)
    );
    const starMeta = calculateStarsFromRp(recomputedRp);
    initial.rp = recomputedRp;
    initial.stars = starMeta.stars;
    initial.tierName = starMeta.tierName;
    initial.mmr = 1000 + recomputedRp;
    initial.skillIndex = Math.min(99, Math.round(initial.accuracyPct * 0.8 + starMeta.stars * 4));
  }

  profileCache.set(clean, initial);
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
