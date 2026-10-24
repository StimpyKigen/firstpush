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
  objectPosition?: string;  // Image focal point (defaults to object-[right_top])
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
  la_liga: {
    id: 'la_liga',
    name: 'Spanish La Liga',
    bannerUrl: '/banners/la-liga.png',
    overlayOpacity: 0.32,
    objectPosition: 'object-[center_46%]',
    gradientOverlay: 'from-transparent via-[#FFF1F2]/20 to-[#FFFFF0]/35',
    cardBg: 'bg-gradient-to-b from-[#FFF1F2] via-[#FFF5F5] to-[#FFFFF0]',
    baseTint: 'bg-gradient-to-b from-[#E11D48]/8 via-[#E11D48]/2 to-transparent',
    borderColor: 'border-[#FB7185]/70',
    borderHoverColor: 'hover:border-[#E11D48]',
    oddsBorderColor: 'border-[#FB7185]/50 hover:border-[#E11D48]',
    consensusTrackBg: 'bg-[#FFE4E6]',
    dividerColor: 'border-[#FECDD3]',
    shadow: 'shadow-[0_2px_12px_rgba(225,29,72,0.08)] hover:shadow-[0_4px_18px_rgba(225,29,72,0.16)]',
  },
  ligue_1: {
    id: 'ligue_1',
    name: 'French Ligue 1',
    bannerUrl: '/banners/ligue-1.jpg',
    overlayOpacity: 0.32,
    objectPosition: 'object-[center_50%]',
    gradientOverlay: 'from-transparent via-[#F0FDF4]/20 to-[#FFFFF0]/35',
    cardBg: 'bg-gradient-to-b from-[#EDF5FF] via-[#F4F9FF] to-[#FFFFF0]',
    baseTint: 'bg-gradient-to-b from-[#0F1E4A]/12 via-[#84CC16]/4 to-transparent',
    borderColor: 'border-[#84CC16]/70',
    borderHoverColor: 'hover:border-[#0F1E4A]',
    oddsBorderColor: 'border-[#84CC16]/50 hover:border-[#0F1E4A]',
    consensusTrackBg: 'bg-[#ECFCCB]',
    dividerColor: 'border-[#D9F99D]',
    shadow: 'shadow-[0_2px_12px_rgba(15,30,74,0.09)] hover:shadow-[0_4px_18px_rgba(15,30,74,0.16)]',
  },
  bundesliga: {
    id: 'bundesliga',
    name: 'German Bundesliga',
    bannerUrl: '/banners/bundesliga.png',
    overlayOpacity: 0.32,
    objectPosition: 'object-[center_50%]',
    gradientOverlay: 'from-transparent via-[#FFF5F5]/20 to-[#FFFFF0]/35',
    cardBg: 'bg-gradient-to-b from-[#FFF5F5] via-[#FFFBFB] to-[#FFFFF0]',
    baseTint: 'bg-gradient-to-b from-[#DC2626]/8 via-[#DC2626]/2 to-transparent',
    borderColor: 'border-[#F87171]/70',
    borderHoverColor: 'hover:border-[#DC2626]',
    oddsBorderColor: 'border-[#F87171]/50 hover:border-[#DC2626]',
    consensusTrackBg: 'bg-[#FEE2E2]',
    dividerColor: 'border-[#FECACA]',
    shadow: 'shadow-[0_2px_12px_rgba(220,38,38,0.08)] hover:shadow-[0_4px_18px_rgba(220,38,38,0.16)]',
  },
  serie_a: {
    id: 'serie_a',
    name: 'Italian Serie A',
    bannerUrl: '/banners/serie-a.jpg',
    overlayOpacity: 0.32,
    objectPosition: 'object-[center_50%]',
    gradientOverlay: 'from-transparent via-[#E0F2FE]/20 to-[#FFFFF0]/35',
    cardBg: 'bg-gradient-to-b from-[#E0F2FE] via-[#F0F9FF] to-[#FFFFF0]',
    baseTint: 'bg-gradient-to-b from-[#0284C7]/10 via-[#0284C7]/3 to-transparent',
    borderColor: 'border-[#38BDF8]/70',
    borderHoverColor: 'hover:border-[#0284C7]',
    oddsBorderColor: 'border-[#38BDF8]/50 hover:border-[#0284C7]',
    consensusTrackBg: 'bg-[#BAE6FD]',
    dividerColor: 'border-[#7DD3FC]',
    shadow: 'shadow-[0_2px_12px_rgba(2,132,199,0.08)] hover:shadow-[0_4px_18px_rgba(2,132,199,0.16)]',
  },
};

/**
 * Returns the banner configuration if the competition matches a registered banner artwork.
 *
 * Domestic league banners (Premier League, La Liga, Ligue 1, Bundesliga, Serie A) are awarded
 * on COUNTRY + LEAGUE together, never on the league name alone. A "Premier League" from
 * Ukraine, Bahrain or Egypt must never inherit the English Premier League artwork.
 * Continental competitions (UEFA Champions / Europa / Conference League) are matched by name
 * because they have no domestic country.
 */

/** Lower-case, accent-free, punctuation-free key used for exact name comparisons. */
function bannerKey(value: string | undefined): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Country spellings that identify each domestic banner league's home country. */
const BANNER_COUNTRY_NAMES: Record<string, string[]> = {
  premier_league: ['england', 'english', 'united kingdom', 'uk', 'great britain', 'gb eng'],
  la_liga: ['spain', 'spanish', 'espana'],
  ligue_1: ['france', 'french'],
  bundesliga: ['germany', 'german', 'deutschland'],
  serie_a: ['italy', 'italian', 'italia'],
};

/** Exact league titles (normalised) that qualify for a domestic banner when the country matches. */
const BANNER_LEAGUE_NAMES: Record<string, string[]> = {
  premier_league: ['premier league', 'english premier league', 'epl', 'barclays premier league'],
  la_liga: ['la liga', 'laliga', 'spanish la liga', 'primera division', 'la liga ea sports', 'laliga ea sports'],
  ligue_1: ['ligue 1', 'french ligue 1', 'france ligue 1', 'ligue 1 uber eats', 'league 1'],
  bundesliga: ['bundesliga', 'german bundesliga', '1 bundesliga'],
  serie_a: ['serie a', 'italian serie a', 'serie a tim', 'serie a enilive'],
};

/** Titles that already carry the country adjective, so they are safe without a country field. */
const BANNER_SELF_QUALIFIED: Record<string, string[]> = {
  premier_league: ['english premier league', 'epl', 'barclays premier league'],
  la_liga: ['spanish la liga', 'la liga ea sports', 'laliga ea sports'],
  ligue_1: ['french ligue 1', 'france ligue 1'],
  bundesliga: ['german bundesliga'],
  serie_a: ['italian serie a'],
};

/** Canonical competition ids, with the country each one belongs to. */
const BANNER_BY_ID: Record<string, keyof typeof COMPETITION_BANNERS> = {
  uefa_champions_league: 'uefa_champions_league',
  uefa_europa_league: 'uefa_europa_league',
  uefa_conference_league: 'uefa_conference_league',
  eng_premier_league: 'premier_league',
  esp_la_liga: 'la_liga',
  fra_ligue_1: 'ligue_1',
  ger_bundesliga: 'bundesliga',
  ita_serie_a: 'serie_a',
};

/** Countries / scopes that mean "no specific domestic country" (continental or unknown). */
const NON_DOMESTIC_COUNTRIES = new Set([
  '',
  'general',
  'other',
  'europe',
  'uefa',
  'world',
  'international',
  'international clubs',
]);

export function getCompetitionBanner(
  competition: string,
  competitionId?: string,
  country?: string
): CompetitionBannerConfig | null {
  const countryKey = bannerKey(country);
  const hasDomesticCountry = !NON_DOMESTIC_COUNTRIES.has(countryKey);

  // 1. Canonical id (verified by the parser / provider). Domestic ids must agree with the country.
  if (competitionId && BANNER_BY_ID[competitionId]) {
    const bannerKeyName = BANNER_BY_ID[competitionId];
    const homeCountries = BANNER_COUNTRY_NAMES[bannerKeyName];
    if (!homeCountries || !hasDomesticCountry || homeCountries.includes(countryKey)) {
      return COMPETITION_BANNERS[bannerKeyName];
    }
    return null;
  }

  if (!competition) return null;
  const comp = competition.toLowerCase().trim();
  const compKey = bannerKey(competition);

  // 2. Domestic leagues: league title AND country must both match.
  for (const bannerName of Object.keys(BANNER_LEAGUE_NAMES) as Array<keyof typeof BANNER_LEAGUE_NAMES>) {
    if (!BANNER_LEAGUE_NAMES[bannerName].includes(compKey)) continue;
    if (hasDomesticCountry) {
      if (BANNER_COUNTRY_NAMES[bannerName].includes(countryKey)) {
        return COMPETITION_BANNERS[bannerName as keyof typeof COMPETITION_BANNERS];
      }
      return null; // same league name, different country: no banner
    }
    // No country information: only accept titles that already name the country.
    if (BANNER_SELF_QUALIFIED[bannerName].includes(compKey)) {
      return COMPETITION_BANNERS[bannerName as keyof typeof COMPETITION_BANNERS];
    }
    return null;
  }

  // 3. Continental UEFA competitions never belong to a domestic country.
  if (hasDomesticCountry) return null;

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

  return null;
}
