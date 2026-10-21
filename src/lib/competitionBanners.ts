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
  baseTint?: string;        // Subtle tinted base layer
  borderColor?: string;     // Border color
  borderHoverColor?: string;// Border hover color
  oddsBorderColor?: string; // Matching odds button border
  consensusTrackBg?: string;// Consensus progress bar track
  dividerColor?: string;    // Footer divider line color
  shadow?: string;          // Drop shadow with competition tint
}

export const COMPETITION_BANNERS: Record<string, CompetitionBannerConfig> = {
  uefa_champions_league: {
    id: 'uefa_champions_league',
    name: 'UEFA Champions League',
    bannerUrl: '/banners/uefa-champions-league.jpg',
    overlayOpacity: 0.32,
    gradientOverlay: 'from-transparent via-[#EDF4FE]/20 to-[#FFFFF0]/35',
    cardBg: 'bg-gradient-to-b from-[#E3EFFE] via-[#F0F6FE] to-[#FFFFF0]',
    baseTint: 'bg-gradient-to-b from-[#0A3B8C]/12 via-[#0A3B8C]/4 to-transparent',
    borderColor: 'border-[#7BA7F8]',
    borderHoverColor: 'hover:border-[#0A3B8C]',
    oddsBorderColor: 'border-[#7BA7F8]/50 hover:border-[#0A3B8C]',
    consensusTrackBg: 'bg-[#DDE8F8]',
    dividerColor: 'border-[#D9E7F9]',
    shadow: 'shadow-[0_2px_12px_rgba(10,59,140,0.09)] hover:shadow-[0_4px_18px_rgba(10,59,140,0.16)]',
  },
  uefa_europa_league: {
    id: 'uefa_europa_league',
    name: 'UEFA Europa League',
    bannerUrl: '/banners/uefa-europa-league.jpg',
    overlayOpacity: 0.32,
    gradientOverlay: 'from-transparent via-[#FFF7ED]/20 to-[#FFFFF0]/35',
    cardBg: 'bg-gradient-to-b from-[#FFF2E5] via-[#FFF8F0] to-[#FFFFF0]',
    baseTint: 'bg-gradient-to-b from-[#EA580C]/12 via-[#EA580C]/4 to-transparent',
    borderColor: 'border-[#FB923C]/70',
    borderHoverColor: 'hover:border-[#EA580C]',
    oddsBorderColor: 'border-[#FB923C]/50 hover:border-[#EA580C]',
    consensusTrackBg: 'bg-[#FDE8D4]',
    dividerColor: 'border-[#FED7AA]',
    shadow: 'shadow-[0_2px_12px_rgba(234,88,12,0.09)] hover:shadow-[0_4px_18px_rgba(234,88,12,0.16)]',
  },
};

/**
 * Returns the banner configuration if the competition matches a registered banner artwork.
 * Matches all UEFA Champions League and UEFA Europa League fixtures.
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

  // 2. UEFA Europa League
  if (
    (comp.includes('europa league') || comp.includes('uel')) &&
    !comp.includes('conference') &&
    !comp.includes('women') &&
    !comp.includes('youth') &&
    !comp.includes('u19') &&
    !comp.includes('u20') &&
    !comp.includes('u21')
  ) {
    return COMPETITION_BANNERS.uefa_europa_league;
  }

  return null;
}
