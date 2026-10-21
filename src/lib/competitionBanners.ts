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
  uefa_conference_league: {
    id: 'uefa_conference_league',
    name: 'UEFA Conference League',
    bannerUrl: '/banners/uefa-conference-league.jpg',
    overlayOpacity: 0.32,
    gradientOverlay: 'from-transparent via-[#ECFDF5]/20 to-[#FFFFF0]/35',
    cardBg: 'bg-gradient-to-b from-[#E6F4EA] via-[#F2FAF4] to-[#FFFFF0]',
    baseTint: 'bg-gradient-to-b from-[#059669]/12 via-[#059669]/4 to-transparent',
    borderColor: 'border-[#34D399]/70',
    borderHoverColor: 'hover:border-[#059669]',
    oddsBorderColor: 'border-[#34D399]/50 hover:border-[#059669]',
    consensusTrackBg: 'bg-[#D1FAE5]',
    dividerColor: 'border-[#A7F3D0]',
    shadow: 'shadow-[0_2px_12px_rgba(5,150,105,0.09)] hover:shadow-[0_4px_18px_rgba(5,150,105,0.16)]',
  },
  premier_league: {
    id: 'premier_league',
    name: 'English Premier League',
    bannerUrl: '/banners/premier-league.jpg',
    overlayOpacity: 0.32,
    gradientOverlay: 'from-transparent via-[#E0FBF6]/20 to-[#FFFFF0]/35',
    cardBg: 'bg-gradient-to-b from-[#E6FCF5] via-[#F0FDF8] to-[#FFFFF0]',
    baseTint: 'bg-gradient-to-b from-[#0D9488]/10 via-[#0D9488]/3 to-transparent',
    borderColor: 'border-[#2DD4BF]/70',
    borderHoverColor: 'hover:border-[#0D9488]',
    oddsBorderColor: 'border-[#2DD4BF]/50 hover:border-[#0D9488]',
    consensusTrackBg: 'bg-[#CCFBF1]',
    dividerColor: 'border-[#99F6E4]',
    shadow: 'shadow-[0_2px_12px_rgba(13,148,136,0.09)] hover:shadow-[0_4px_18px_rgba(13,148,136,0.16)]',
  },
};

/**
 * Returns the banner configuration if the competition matches a registered banner artwork.
 * Matches UEFA Champions League, UEFA Europa League, UEFA Conference League, and English Premier League fixtures.
 */
export function getCompetitionBanner(competition: string, competitionId?: string): CompetitionBannerConfig | null {
  if (competitionId) {
    if (competitionId === 'uefa_champions_league') return COMPETITION_BANNERS.uefa_champions_league;
    if (competitionId === 'uefa_europa_league') return COMPETITION_BANNERS.uefa_europa_league;
    if (competitionId === 'uefa_conference_league') return COMPETITION_BANNERS.uefa_conference_league;
    if (competitionId === 'eng_premier_league') return COMPETITION_BANNERS.premier_league;
  }

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

  // 3. UEFA Conference League
  if (
    (comp.includes('conference league') || comp.includes('uecl')) &&
    !comp.includes('women') &&
    !comp.includes('youth') &&
    !comp.includes('u19') &&
    !comp.includes('u20') &&
    !comp.includes('u21')
  ) {
    return COMPETITION_BANNERS.uefa_conference_league;
  }

  // 4. English Premier League
  if (
    (comp === 'premier league' ||
      comp.startsWith('premier league') ||
      comp.includes('english premier league') ||
      comp === 'epl' ||
      comp.startsWith('epl ')) &&
    !comp.includes('egypt') &&
    !comp.includes('kenya') &&
    !comp.includes('kazakhstan') &&
    !comp.includes('russia') &&
    !comp.includes('ghana') &&
    !comp.includes('south africa') &&
    !comp.includes('singapore') &&
    !comp.includes('israel') &&
    !comp.includes('women') &&
    !comp.includes('youth') &&
    !comp.includes('u18') &&
    !comp.includes('u19') &&
    !comp.includes('u20') &&
    !comp.includes('u21') &&
    !comp.includes('u23') &&
    !comp.includes('2')
  ) {
    return COMPETITION_BANNERS.premier_league;
  }

  return null;
}
