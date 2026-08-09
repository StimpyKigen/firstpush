/**
 * MshindiRoom Production Rating & Skill Engine
 * 
 * Features:
 * - Hidden Reputation Points (RP) & Public 5-Star System
 * - Hidden MMR (Matchmaking & Skill Rating)
 * - Near-Miss Mastery & Absolute Accuracy Multipliers
 * - Logarithmic Difficulty Scaling (Odds-Weighted)
 * - Non-Punitive Streak Management (-20% on miss)
 * - Rolling Consistency Calculations (10, 25, 50 Jackpots)
 * - Inactivity Decay Engine (30d, 60d, 90d)
 * - High-Precision Profile Metrics
 */

export interface PlayerRatingProfile {
  userId: string;
  username: string;
  avatarSeed?: number;
  
  // Core Ratings
  rp: number;                     // Hidden Reputation Points
  mmr: number;                    // Hidden MMR (1000 - 3000+)
  stars: number;                  // Public 0.5 - 5.0 Star visual
  tierName: string;               // Rookie, Rising, Skilled, Elite, Legend
  
  // Performance Statistics
  totalJackpotsPlayed: number;
  jackpotsWon: number;
  top3Finishes: number;
  perfectSlips: number;
  totalCorrectPicks: number;
  totalPicksSubmitted: number;
  accuracyPct: number;             // Overall prediction accuracy %
  
  // Streaks & Consistency
  currentStreak: number;          // Consecutive high-performance jackpots
  longestStreak: number;          // Career best streak
  averageCorrectPicks: number;     // Average correct picks per jackpot
  consistencyRating: number;      // 0-100 Consistency index
  skillIndex: number;             // 0-100 Skill composite score
  bestFinishRank: number;         // Historical best rank (1 = Winner)
  
  // Rolling Performance Accuracy (%)
  last10Accuracy: number;
  last25Accuracy: number;
  last50Accuracy: number;
  
  // Activity Metadata
  lastActiveTimestamp: number;    // Date.now() timestamp
  totalDecayApplied: number;      // Accumulated RP lost to inactivity
}

export interface JackpotSettlementUserSubmission {
  userId: string;
  username: string;
  rank: number;
  totalParticipants: number;
  correctPicks: number;
  totalMatches: number;
  oddsList?: number[];             // Decimal odds of each correct match pick
}

export interface SettlementResultForUser {
  userId: string;
  rpGained: number;
  oldRp: number;
  newRp: number;
  oldStars: number;
  newStars: number;
  mmrChange: number;
  breakdown: {
    rankBonus: number;
    accuracyBonus: number;
    nearMissBonus: number;
    difficultyMultiplier: number;
    streakBonus: number;
    consistencyBonus: number;
  };
}

// ======================= STAR TIER MAP =======================

export interface StarTier {
  minRp: number;
  maxRp: number;
  stars: number;
  name: string;
}

export const STAR_TIERS: StarTier[] = [
  { minRp: 0, maxRp: 49, stars: 1.0, name: '⭐ Rookie Predictor' },
  { minRp: 50, maxRp: 149, stars: 2.0, name: '⭐⭐ Rising Player' },
  { minRp: 150, maxRp: 349, stars: 3.0, name: '⭐⭐⭐ Skilled Predictor' },
  { minRp: 350, maxRp: 699, stars: 4.0, name: '⭐⭐⭐⭐ Elite Predictor' },
  { minRp: 700, maxRp: Infinity, stars: 5.0, name: '⭐⭐⭐⭐⭐ Legend' },
];

/**
 * Calculates public star rating (0.5 to 5.0 in 0.5 step increments) based on RP
 */
export function calculateStarsFromRp(rp: number): { stars: number; tierName: string; nextTierRp: number; progressPct: number } {
  const safeRp = Math.max(0, rp);
  
  if (safeRp >= 700) {
    return { stars: 5.0, tierName: '⭐⭐⭐⭐⭐ Legend', nextTierRp: 700, progressPct: 100 };
  }
  
  if (safeRp < 50) {
    const stars = Math.min(1.5, 1.0 + Math.floor(safeRp / 25) * 0.5);
    const progressPct = Math.round((safeRp / 50) * 100);
    return { stars, tierName: '⭐ Rookie Predictor', nextTierRp: 50, progressPct };
  }
  
  if (safeRp < 150) {
    const stars = Math.min(2.5, 2.0 + Math.floor((safeRp - 50) / 50) * 0.5);
    const progressPct = Math.round(((safeRp - 50) / 100) * 100);
    return { stars, tierName: '⭐⭐ Rising Player', nextTierRp: 150, progressPct };
  }
  
  if (safeRp < 350) {
    const stars = Math.min(3.5, 3.0 + Math.floor((safeRp - 150) / 100) * 0.5);
    const progressPct = Math.round(((safeRp - 150) / 200) * 100);
    return { stars, tierName: '⭐⭐⭐ Skilled Predictor', nextTierRp: 350, progressPct };
  }
  
  // 350 - 699 RP
  const stars = Math.min(4.5, 4.0 + Math.floor((safeRp - 350) / 175) * 0.5);
  const progressPct = Math.round(((safeRp - 350) / 350) * 100);
  return { stars, tierName: '⭐⭐⭐⭐ Elite Predictor', nextTierRp: 700, progressPct };
}

// ======================= RATING CALCULATIONS =======================

/**
 * Calculate RP awarded for a single jackpot settlement
 */
export function calculateJackpotRpEarnings(
  submission: JackpotSettlementUserSubmission,
  currentStreak: number,
  last10AvgAccuracyPct: number
): { totalRpGained: number; breakdown: SettlementResultForUser['breakdown'] } {
  const { rank, totalParticipants, correctPicks, totalMatches, oddsList } = submission;
  const accuracyRatio = totalMatches > 0 ? correctPicks / totalMatches : 0;
  const accuracyPct = Math.round(accuracyRatio * 100);
  const missedMatches = Math.max(0, totalMatches - correctPicks);
  
  // 1. Rank Bonus
  let rankBonus = 0;
  const percentile = totalParticipants > 0 ? (rank / totalParticipants) * 100 : 100;
  
  if (rank === 1) rankBonus = 50;
  else if (rank === 2) rankBonus = 35;
  else if (rank === 3) rankBonus = 25;
  else if (percentile <= 10) rankBonus = 15;
  else if (percentile <= 25) rankBonus = 5;
  
  // 2. Accuracy Bonus
  let accuracyBonus = 0;
  if (accuracyPct >= 80) accuracyBonus = 10;
  else if (accuracyPct >= 70) accuracyBonus = 7;
  else if (accuracyPct >= 60) accuracyBonus = 5;
  else if (accuracyPct >= 50) accuracyBonus = 2;
  
  // 3. Near-Miss Mastery Bonus
  let nearMissBonus = 0;
  if (missedMatches === 0) nearMissBonus = 40;      // Perfect Slip
  else if (missedMatches === 1) nearMissBonus = 25; // 1 match off
  else if (missedMatches === 2) nearMissBonus = 15; // 2 matches off
  else if (missedMatches === 3) nearMissBonus = 8;  // 3 matches off
  
  // 4. Difficulty Multiplier (Odds-Weighted, Logarithmic Cap at 2.0x)
  let difficultyMultiplier = 1.0;
  if (oddsList && oddsList.length > 0) {
    const rawSum = oddsList.reduce((acc, odds) => acc + Math.log(Math.max(1.0, odds)), 0);
    const rawIndex = 1 + 0.1 * rawSum;
    difficultyMultiplier = Math.min(2.0, Math.max(1.0, Number(rawIndex.toFixed(2))));
  }
  
  // 5. Streak Bonus (Consecutive high performances: Top 25% or >= 60% accuracy)
  let streakBonus = 0;
  if (currentStreak >= 10) streakBonus = 25;
  else if (currentStreak >= 5) streakBonus = 10;
  else if (currentStreak >= 3) streakBonus = 5;
  
  // 6. Rolling Consistency Bonus
  let consistencyBonus = 0;
  if (last10AvgAccuracyPct >= 65) consistencyBonus += 5;
  
  // Base sum multiplied by difficulty
  const basePoints = rankBonus + accuracyBonus + nearMissBonus;
  const scaledBase = Math.round(basePoints * difficultyMultiplier);
  const totalRpGained = scaledBase + streakBonus + consistencyBonus;
  
  return {
    totalRpGained,
    breakdown: {
      rankBonus,
      accuracyBonus,
      nearMissBonus,
      difficultyMultiplier,
      streakBonus,
      consistencyBonus,
    },
  };
}

/**
 * Calculates Activity Decay for inactive users
 */
export function calculateInactivityDecay(currentRp: number, lastActiveTimestamp: number, nowTimestamp: number = Date.now()): { decayedRp: number; newRp: number } {
  const daysInactive = Math.floor((nowTimestamp - lastActiveTimestamp) / (1000 * 60 * 60 * 24));
  
  if (daysInactive < 30 || currentRp <= 0) {
    return { decayedRp: 0, newRp: currentRp };
  }
  
  let decayRate = 0;
  if (daysInactive >= 90) decayRate = 0.05;       // 5% for 90+ days
  else if (daysInactive >= 60) decayRate = 0.03;  // 3% for 60-89 days
  else if (daysInactive >= 30) decayRate = 0.01;  // 1% for 30-59 days
  
  // Max cap 15% cumulative decay
  const decayedRp = Math.min(Math.round(currentRp * decayRate), Math.round(currentRp * 0.15));
  const newRp = Math.max(0, currentRp - decayedRp);
  
  return { decayedRp, newRp };
}

/**
 * Updates a player's rating profile after a jackpot settlement
 */
export function updatePlayerProfileAfterSettlement(
  existingProfile: PlayerRatingProfile,
  submission: JackpotSettlementUserSubmission
): { updatedProfile: PlayerRatingProfile; result: SettlementResultForUser } {
  const isHighPerformance = submission.rank <= Math.max(3, Math.ceil(submission.totalParticipants * 0.25)) || (submission.correctPicks / submission.totalMatches) >= 0.6;
  
  // Non-punitive streak update: if high performance -> +1; else reduce by 20%
  let newStreak = existingProfile.currentStreak;
  if (isHighPerformance) {
    newStreak += 1;
  } else {
    newStreak = Math.floor(existingProfile.currentStreak * 0.8);
  }
  const newLongestStreak = Math.max(existingProfile.longestStreak, newStreak);
  
  // Calculate RP gain
  const { totalRpGained, breakdown } = calculateJackpotRpEarnings(
    submission,
    newStreak,
    existingProfile.last10Accuracy || existingProfile.accuracyPct
  );
  
  const oldRp = existingProfile.rp;
  const newRp = oldRp + totalRpGained;
  
  const oldStarMeta = calculateStarsFromRp(oldRp);
  const newStarMeta = calculateStarsFromRp(newRp);
  
  // Stats update
  const totalJackpotsPlayed = existingProfile.totalJackpotsPlayed + 1;
  const jackpotsWon = submission.rank === 1 ? existingProfile.jackpotsWon + 1 : existingProfile.jackpotsWon;
  const top3Finishes = submission.rank <= 3 ? existingProfile.top3Finishes + 1 : existingProfile.top3Finishes;
  const isPerfect = submission.correctPicks === submission.totalMatches;
  const perfectSlips = isPerfect ? existingProfile.perfectSlips + 1 : existingProfile.perfectSlips;
  
  const totalCorrectPicks = existingProfile.totalCorrectPicks + submission.correctPicks;
  const totalPicksSubmitted = existingProfile.totalPicksSubmitted + submission.totalMatches;
  const accuracyPct = Math.round((totalCorrectPicks / totalPicksSubmitted) * 100);
  
  const averageCorrectPicks = Number((totalCorrectPicks / totalJackpotsPlayed).toFixed(1));
  const bestFinishRank = existingProfile.bestFinishRank > 0 ? Math.min(existingProfile.bestFinishRank, submission.rank) : submission.rank;
  
  // Rolling accuracy simulation (using weighted average)
  const currentJackpotAccuracy = Math.round((submission.correctPicks / submission.totalMatches) * 100);
  const last10Accuracy = Math.round((existingProfile.last10Accuracy * 0.9) + (currentJackpotAccuracy * 0.1));
  const last25Accuracy = Math.round((existingProfile.last25Accuracy * 0.96) + (currentJackpotAccuracy * 0.04));
  const last50Accuracy = Math.round((existingProfile.last50Accuracy * 0.98) + (currentJackpotAccuracy * 0.02));
  
  // Hidden MMR Calculation (Elo-style shift based on rank percentile)
  const rankPercentile = (1 - (submission.rank / submission.totalParticipants)) * 100;
  const mmrChange = Math.round((rankPercentile - 50) * 0.4);
  const newMmr = Math.max(800, existingProfile.mmr + mmrChange);
  
  // Skill & Consistency Indices
  const consistencyRating = Math.min(100, Math.round(last10Accuracy * 0.7 + (newStreak * 3)));
  const skillIndex = Math.min(100, Math.round((accuracyPct * 0.4) + (newStarMeta.stars * 10) + (top3Finishes * 3)));

  const updatedProfile: PlayerRatingProfile = {
    ...existingProfile,
    rp: newRp,
    mmr: newMmr,
    stars: newStarMeta.stars,
    tierName: newStarMeta.tierName,
    totalJackpotsPlayed,
    jackpotsWon,
    top3Finishes,
    perfectSlips,
    totalCorrectPicks,
    totalPicksSubmitted,
    accuracyPct,
    currentStreak: newStreak,
    longestStreak: newLongestStreak,
    averageCorrectPicks,
    consistencyRating,
    skillIndex,
    bestFinishRank,
    last10Accuracy,
    last25Accuracy,
    last50Accuracy,
    lastActiveTimestamp: Date.now(),
  };

  const result: SettlementResultForUser = {
    userId: submission.userId,
    rpGained: totalRpGained,
    oldRp,
    newRp,
    oldStars: oldStarMeta.stars,
    newStars: newStarMeta.stars,
    mmrChange,
    breakdown,
  };

  return { updatedProfile, result };
}

// ======================= DEFAULT / MOCK FACTORY =======================

/**
 * Creates an initial or deterministic default profile for any user username
 */
export function createInitialPlayerProfile(username: string, seed: number = 1): PlayerRatingProfile {
  const hash = Math.abs(username.split('').reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0));
  
  // Seed realistic baseline scores based on username hash
  const totalJackpotsPlayed = 12 + (hash % 40);
  const accuracyPct = 52 + (hash % 32); // 52% - 84%
  const rp = 60 + (hash % 480);         // 60 - 540 RP
  const mmr = 1200 + (hash % 900);      // 1200 - 2100 MMR
  
  const starMeta = calculateStarsFromRp(rp);
  
  const jackpotsWon = (hash % 3 === 0) ? 1 + (hash % 3) : 0;
  const top3Finishes = jackpotsWon + (hash % 4);
  const perfectSlips = jackpotsWon > 0 ? (hash % 2) : 0;
  
  const totalPicksSubmitted = totalJackpotsPlayed * 17;
  const totalCorrectPicks = Math.round(totalPicksSubmitted * (accuracyPct / 100));
  
  return {
    userId: `user_${username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    username,
    avatarSeed: seed,
    rp,
    mmr,
    stars: starMeta.stars,
    tierName: starMeta.tierName,
    totalJackpotsPlayed,
    jackpotsWon,
    top3Finishes,
    perfectSlips,
    totalCorrectPicks,
    totalPicksSubmitted,
    accuracyPct,
    currentStreak: 1 + (hash % 5),
    longestStreak: 2 + (hash % 8),
    averageCorrectPicks: Number((17 * (accuracyPct / 100)).toFixed(1)),
    consistencyRating: Math.min(98, accuracyPct + 5),
    skillIndex: Math.min(99, Math.round(accuracyPct * 0.8 + starMeta.stars * 4)),
    bestFinishRank: jackpotsWon > 0 ? 1 : 2 + (hash % 12),
    last10Accuracy: Math.min(95, accuracyPct + (hash % 8)),
    last25Accuracy: accuracyPct,
    last50Accuracy: Math.max(45, accuracyPct - (hash % 5)),
    lastActiveTimestamp: Date.now() - (hash % 10) * 86400000,
    totalDecayApplied: 0,
  };
}
