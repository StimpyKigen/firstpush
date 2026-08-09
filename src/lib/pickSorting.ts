import type { GamblerPick } from './types';
import { getStarRating } from './punterRatings';

export function computeVisibilityScore(pick: GamblerPick): number {
  const likesScore = (pick.likes || 0) * 2;
  const ratingScore = getStarRating(pick.username) * 3;
  const lengthBonus = pick.reasoning.length > 50 ? 1 : 0;
  return likesScore + ratingScore + lengthBonus;
}

export function sortPicksByVisibility(picks: GamblerPick[]): GamblerPick[] {
  return [...picks].sort((a, b) => {
    const scoreA = computeVisibilityScore(a);
    const scoreB = computeVisibilityScore(b);
    return scoreB - scoreA;
  });
}

export function getTopPick(sortedPicks: GamblerPick[]): GamblerPick | null {
  if (sortedPicks.length === 0) return null;
  const top = sortedPicks[0];
  return top;
}
