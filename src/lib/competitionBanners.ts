/**
 * Competition Background Banners Registry
 * 
 * Provides official competition artwork banners for fixture cards.
 * Designed to be easily extensible as new competition banners are added.
 */

export interface CompetitionBannerConfig {
  id: string;
  name: string;
  bannerUrl: string;
  overlayOpacity?: number; // Faded opacity tuning for foreground contrast
  gradientOverlay?: string; // Optional custom gradient wash
}

export const COMPETITION_BANNERS: Record<string, CompetitionBannerConfig> = {
  uefa_champions_league: {
    id: 'uefa_champions_league',
    name: 'UEFA Champions League',
    bannerUrl: '/banners/uefa-champions-league.jpg',
    overlayOpacity: 0.16,
    gradientOverlay: 'from-[#FFFFF0]/70 via-[#FFFFF0]/85 to-[#FFFFF0]/92',
  },
};

/**
 * Returns the banner configuration if the competition matches a registered banner artwork.
 * Matches all UEFA Champions League fixtures (excluding CAF / AFC variants).
 */
export function getCompetitionBanner(competition: string): CompetitionBannerConfig | null {
  if (!competition) return null;
  const comp = competition.toLowerCase();

  // 1. UEFA Champions League
  if (
    (comp.includes('champions league') || comp.includes('ucl')) &&
    !comp.includes('caf') &&
    !comp.includes('afc') &&
    !comp.includes('women') &&
    !comp.includes('youth')
  ) {
    return COMPETITION_BANNERS.uefa_champions_league;
  }

  return null;
}
