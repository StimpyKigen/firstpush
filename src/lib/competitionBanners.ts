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
  cardBg?: string;          // Gradient or background style for card
  borderColor?: string;     // Border color
  borderHoverColor?: string;// Border hover color
  oddsBorderColor?: string; // Matching odds button border
  shadow?: string;          // Drop shadow with competition tint
}

export const COMPETITION_BANNERS: Record<string, CompetitionBannerConfig> = {
  uefa_champions_league: {
    id: 'uefa_champions_league',
    name: 'UEFA Champions League',
    bannerUrl: '/banners/uefa-champions-league.jpg',
    overlayOpacity: 0.42,
    gradientOverlay: 'from-transparent via-[#EDF4FE]/35 to-[#FFFFF0]/80',
    cardBg: 'bg-gradient-to-b from-[#E3EFFE] via-[#F0F6FE] to-[#FFFFF0]',
    borderColor: 'border-[#7BA7F8]',
    borderHoverColor: 'hover:border-[#0A3B8C]',
    oddsBorderColor: 'border-[#BDD7FB] hover:border-[#0A3B8C]',
    shadow: 'shadow-[0_2px_12px_rgba(10,59,140,0.09)] hover:shadow-[0_4px_18px_rgba(10,59,140,0.16)]',
  },
};

/**
 * Returns the banner configuration if the competition matches a registered banner artwork.
 * Matches all UEFA Champions League fixtures (excluding CAF / AFC / CFA / OFC / CONCACAF / Women / Youth variants).
 */
export function getCompetitionBanner(competition: string): CompetitionBannerConfig | null {
  if (!competition) return null;
  const comp = competition.toLowerCase().trim();

  // 1. UEFA Champions League
  if (
    (comp.includes('champions league') || comp.includes('ucl')) &&
    !comp.includes('caf') &&
    !comp.includes('afc') &&
    !comp.includes('cfa') &&
    !comp.includes('ofc') &&
    !comp.includes('concacaf') &&
    !comp.includes('women') &&
    !comp.includes('youth') &&
    !comp.includes('u19') &&
    !comp.includes('u20') &&
    !comp.includes('u21')
  ) {
    return COMPETITION_BANNERS.uefa_champions_league;
  }

  return null;
}
