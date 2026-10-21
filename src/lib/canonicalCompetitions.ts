/**
 * Canonical Football Competition Registry & Identity Resolver
 * 
 * Enforces strict, verified competition identity using SportScore as source of truth.
 * 
 * CRITICAL IDENTITY INVARIANTS:
 * 1. Never identify a competition using loose substring or team names alone.
 * 2. Provider ID/slug, verified country, and competition type are evaluated together.
 * 3. Never match foreign "Pro League" competitions (Iran, Saudi, Uzbekistan, Malaysia) to Belgian Pro League.
 * 4. Never treat foreign "Premier League" competitions (Egypt, Kenya, Russia, etc.) as the English Premier League.
 * 5. Never treat foreign "Primera Division" competitions (Costa Rica, Chile, Argentina, etc.) as Spanish La Liga.
 * 6. Priority ranking is strictly separated from competition classification.
 * 7. International and continental club competitions must never be assigned to a domestic country.
 */

export type ContinentId =
  | 'all'
  | 'european_competitions'
  | 'europe'
  | 'south_america'
  | 'africa'
  | 'asia'
  | 'north_america'
  | 'international'
  | 'oceania';

export type CompetitionType =
  | 'domestic_league'   // Top domestic division
  | 'lower_division'    // Lower tier divisions (Championship, Segunda, Division 2, J2/J3)
  | 'domestic_cup'      // National knockouts (FA Cup, Copa del Rey, Thai FA Cup, Hazfi Cup)
  | 'super_cup'         // Season openers / super cups (Community Shield, Supercopa)
  | 'continental_club'  // Multi-nation club championships (UCL, UEL, UECL, AFC Champions League)
  | 'international'     // National teams (World Cup, AFCON, Asian Cup, Nations League)
  | 'women'             // Women's domestic or international football
  | 'youth'             // U17-U23 youth leagues and tournaments
  | 'reserve_amateur'   // Reserve squads, amateur and semi-pro leagues
  | 'other';

export interface CanonicalCompetition {
  id: string; // Stable internal unique ID e.g. 'eng_premier_league', 'irn_pro_league'
  provider: 'SportScore';
  providerId?: string; // Upstream SportScore alphanumeric ID (e.g. '9vjxm8gh22r6odg', 'kjw2r09hln4rz84')
  providerSlug: string; // Stable SportScore slug e.g. 'belgian-pro-league', 'iran-pro-league'
  providerSlugs: string[]; // Known aliases and provider codes
  name: string; // Standard display name e.g. 'English Premier League'
  country: string; // Primary country display e.g. 'England', 'Belgium', 'Iran'
  countryCode: string; // ISO 2-letter or standard code e.g. 'BE', 'IR', 'GB-ENG'
  countryName: string; // Clean country name
  continent: ContinentId;
  competitionType: CompetitionType;
  type: CompetitionType; // Alias for backward compatibility
  tier: number; // 1 = Top division, 2 = Second division, etc.
  rank: number; // Directory ranking within country/continent
  displayPriority: number; // Configurable ranking score (100 - 1000)
  priorityRank: number; // Lower number = higher prestige/priority
  prestigeScore: number; // 1000-point prestige score for Highlights sorting
  flag: string; // Emoji flag or icon
  isFeatured: boolean; // Highlights eligibility
  active: boolean; // Availability status
  metadataSource: 'verified_sportscore' | 'reconciled' | 'fallback';
}

export interface CountryMeta {
  code: string;
  name: string;
  continent: ContinentId;
  flag: string;
}

/**
 * Authoritative Country Database for Football Competitions
 */
export const KNOWN_COUNTRIES: Record<string, CountryMeta> = {
  // Europe
  england: { code: 'GB-ENG', name: 'England', continent: 'europe', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  spain: { code: 'ES', name: 'Spain', continent: 'europe', flag: '🇪🇸' },
  germany: { code: 'DE', name: 'Germany', continent: 'europe', flag: '🇩🇪' },
  italy: { code: 'IT', name: 'Italy', continent: 'europe', flag: '🇮🇹' },
  france: { code: 'FR', name: 'France', continent: 'europe', flag: '🇫🇷' },
  belgium: { code: 'BE', name: 'Belgium', continent: 'europe', flag: '🇧🇪' },
  netherlands: { code: 'NL', name: 'Netherlands', continent: 'europe', flag: '🇳🇱' },
  portugal: { code: 'PT', name: 'Portugal', continent: 'europe', flag: '🇵🇹' },
  scotland: { code: 'GB-SCT', name: 'Scotland', continent: 'europe', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  turkey: { code: 'TR', name: 'Turkey', continent: 'europe', flag: '🇹🇷' },
  russia: { code: 'RU', name: 'Russia', continent: 'europe', flag: '🇷🇺' },
  ukraine: { code: 'UA', name: 'Ukraine', continent: 'europe', flag: '🇺🇦' },
  czechia: { code: 'CZ', name: 'Czech Republic', continent: 'europe', flag: '🇨🇿' },
  'czech republic': { code: 'CZ', name: 'Czech Republic', continent: 'europe', flag: '🇨🇿' },
  romania: { code: 'RO', name: 'Romania', continent: 'europe', flag: '🇷🇴' },
  denmark: { code: 'DK', name: 'Denmark', continent: 'europe', flag: '🇩🇰' },
  greece: { code: 'GR', name: 'Greece', continent: 'europe', flag: '🇬🇷' },
  poland: { code: 'PL', name: 'Poland', continent: 'europe', flag: '🇵🇱' },
  switzerland: { code: 'CH', name: 'Switzerland', continent: 'europe', flag: '🇨🇭' },
  austria: { code: 'AT', name: 'Austria', continent: 'europe', flag: '🇦🇹' },
  norway: { code: 'NO', name: 'Norway', continent: 'europe', flag: '🇳🇴' },
  sweden: { code: 'SE', name: 'Sweden', continent: 'europe', flag: '🇸🇪' },
  croatia: { code: 'HR', name: 'Croatia', continent: 'europe', flag: '🇭🇷' },
  serbia: { code: 'RS', name: 'Serbia', continent: 'europe', flag: '🇷🇸' },
  bulgaria: { code: 'BG', name: 'Bulgaria', continent: 'europe', flag: '🇧🇬' },
  hungary: { code: 'HU', name: 'Hungary', continent: 'europe', flag: '🇭🇺' },
  slovakia: { code: 'SK', name: 'Slovakia', continent: 'europe', flag: '🇸🇰' },
  slovenia: { code: 'SI', name: 'Slovenia', continent: 'europe', flag: '🇸🇮' },
  estonia: { code: 'EE', name: 'Estonia', continent: 'europe', flag: '🇪🇪' },
  latvia: { code: 'LV', name: 'Latvia', continent: 'europe', flag: '🇱🇻' },
  lithuania: { code: 'LT', name: 'Lithuania', continent: 'europe', flag: '🇱🇹' },
  finland: { code: 'FI', name: 'Finland', continent: 'europe', flag: '🇫🇮' },
  iceland: { code: 'IS', name: 'Iceland', continent: 'europe', flag: '🇮🇸' },
  ireland: { code: 'IE', name: 'Ireland', continent: 'europe', flag: '🇮🇪' },
  moldova: { code: 'MD', name: 'Moldova', continent: 'europe', flag: '🇲🇩' },
  'north macedonia': { code: 'MK', name: 'North Macedonia', continent: 'europe', flag: '🇲🇰' },
  malta: { code: 'MT', name: 'Malta', continent: 'europe', flag: '🇲🇹' },
  'bosnia and herzegovina': { code: 'BA', name: 'Bosnia & Herzegovina', continent: 'europe', flag: '🇧🇦' },

  // Asia
  iran: { code: 'IR', name: 'Iran', continent: 'asia', flag: '🇮🇷' },
  'saudi arabia': { code: 'SA', name: 'Saudi Arabia', continent: 'asia', flag: '🇸🇦' },
  japan: { code: 'JP', name: 'Japan', continent: 'asia', flag: '🇯🇵' },
  'south korea': { code: 'KR', name: 'South Korea', continent: 'asia', flag: '🇰🇷' },
  korea: { code: 'KR', name: 'South Korea', continent: 'asia', flag: '🇰🇷' },
  china: { code: 'CN', name: 'China', continent: 'asia', flag: '🇨🇳' },
  thailand: { code: 'TH', name: 'Thailand', continent: 'asia', flag: '🇹🇭' },
  uzbekistan: { code: 'UZ', name: 'Uzbekistan', continent: 'asia', flag: '🇺🇿' },
  malaysia: { code: 'MY', name: 'Malaysia', continent: 'asia', flag: '🇲🇾' },
  indonesia: { code: 'ID', name: 'Indonesia', continent: 'asia', flag: '🇮🇩' },
  bangladesh: { code: 'BD', name: 'Bangladesh', continent: 'asia', flag: '🇧🇩' },
  myanmar: { code: 'MM', name: 'Myanmar', continent: 'asia', flag: '🇲🇲' },
  india: { code: 'IN', name: 'India', continent: 'asia', flag: '🇮🇳' },
  vietnam: { code: 'VN', name: 'Vietnam', continent: 'asia', flag: '🇻🇳' },
  qatar: { code: 'QA', name: 'Qatar', continent: 'asia', flag: '🇶🇦' },
  uae: { code: 'AE', name: 'United Arab Emirates', continent: 'asia', flag: '🇦🇪' },
  'united arab emirates': { code: 'AE', name: 'United Arab Emirates', continent: 'asia', flag: '🇦🇪' },
  iraq: { code: 'IQ', name: 'Iraq', continent: 'asia', flag: '🇮🇶' },
  kuwait: { code: 'KW', name: 'Kuwait', continent: 'asia', flag: '🇰🇼' },
  jordan: { code: 'JO', name: 'Jordan', continent: 'asia', flag: '🇯🇴' },
  oman: { code: 'OM', name: 'Oman', continent: 'asia', flag: '🇴🇲' },
  bahrain: { code: 'BH', name: 'Bahrain', continent: 'asia', flag: '🇧🇭' },
  lebanon: { code: 'LB', name: 'Lebanon', continent: 'asia', flag: '🇱🇧' },
  syria: { code: 'SY', name: 'Syria', continent: 'asia', flag: '🇸🇾' },
  tajikistan: { code: 'TJ', name: 'Tajikistan', continent: 'asia', flag: '🇹🇯' },
  israel: { code: 'IL', name: 'Israel', continent: 'asia', flag: '🇮🇱' },
  singapore: { code: 'SG', name: 'Singapore', continent: 'asia', flag: '🇸🇬' },
  'hong kong': { code: 'HK', name: 'Hong Kong', continent: 'asia', flag: '🇭🇰' },
  maldives: { code: 'MV', name: 'Maldives', continent: 'asia', flag: '🇲🇻' },

  // Africa
  kenya: { code: 'KE', name: 'Kenya', continent: 'africa', flag: '🇰🇪' },
  egypt: { code: 'EG', name: 'Egypt', continent: 'africa', flag: '🇪🇬' },
  morocco: { code: 'MA', name: 'Morocco', continent: 'africa', flag: '🇲🇦' },
  'south africa': { code: 'ZA', name: 'South Africa', continent: 'africa', flag: '🇿🇦' },
  ghana: { code: 'GH', name: 'Ghana', continent: 'africa', flag: '🇬🇭' },
  nigeria: { code: 'NG', name: 'Nigeria', continent: 'africa', flag: '🇳🇬' },
  ethiopia: { code: 'ET', name: 'Ethiopia', continent: 'africa', flag: '🇪🇹' },
  uganda: { code: 'UG', name: 'Uganda', continent: 'africa', flag: '🇺🇬' },
  tanzania: { code: 'TZ', name: 'Tanzania', continent: 'africa', flag: '🇹🇿' },
  algeria: { code: 'DZ', name: 'Algeria', continent: 'africa', flag: '🇩🇿' },
  tunisia: { code: 'TN', name: 'Tunisia', continent: 'africa', flag: '🇹🇳' },
  'dr congo': { code: 'CD', name: 'DR Congo', continent: 'africa', flag: '🇨🇩' },
  libya: { code: 'LY', name: 'Libya', continent: 'africa', flag: '🇱🇾' },
  liberia: { code: 'LR', name: 'Liberia', continent: 'africa', flag: '🇱🇷' },
  burundi: { code: 'BI', name: 'Burundi', continent: 'africa', flag: '🇧🇮' },
  malawi: { code: 'MW', name: 'Malawi', continent: 'africa', flag: '🇲🇼' },
  senegal: { code: 'SN', name: 'Senegal', continent: 'africa', flag: '🇸🇳' },
  cameroon: { code: 'CM', name: 'Cameroon', continent: 'africa', flag: '🇨🇲' },
  zambia: { code: 'ZM', name: 'Zambia', continent: 'africa', flag: '🇿🇲' },
  zimbabwe: { code: 'ZW', name: 'Zimbabwe', continent: 'africa', flag: '🇿🇼' },
  angola: { code: 'AO', name: 'Angola', continent: 'africa', flag: '🇦🇴' },
  rwanda: { code: 'RW', name: 'Rwanda', continent: 'africa', flag: '🇷🇼' },

  // South America
  brazil: { code: 'BR', name: 'Brazil', continent: 'south_america', flag: '🇧🇷' },
  argentina: { code: 'AR', name: 'Argentina', continent: 'south_america', flag: '🇦🇷' },
  colombia: { code: 'CO', name: 'Colombia', continent: 'south_america', flag: '🇨🇴' },
  chile: { code: 'CL', name: 'Chile', continent: 'south_america', flag: '🇨🇱' },
  uruguay: { code: 'UY', name: 'Uruguay', continent: 'south_america', flag: '🇺🇾' },
  paraguay: { code: 'PY', name: 'Paraguay', continent: 'south_america', flag: '🇵🇾' },
  peru: { code: 'PE', name: 'Peru', continent: 'south_america', flag: '🇵🇪' },
  ecuador: { code: 'EC', name: 'Ecuador', continent: 'south_america', flag: '🇪🇨' },
  bolivia: { code: 'BO', name: 'Bolivia', continent: 'south_america', flag: '🇧🇴' },
  venezuela: { code: 'VE', name: 'Venezuela', continent: 'south_america', flag: '🇻🇪' },

  // North America
  usa: { code: 'US', name: 'United States', continent: 'north_america', flag: '🇺🇸' },
  'united states': { code: 'US', name: 'United States', continent: 'north_america', flag: '🇺🇸' },
  mexico: { code: 'MX', name: 'Mexico', continent: 'north_america', flag: '🇲🇽' },
  canada: { code: 'CA', name: 'Canada', continent: 'north_america', flag: '🇨🇦' },
  'costa rica': { code: 'CR', name: 'Costa Rica', continent: 'north_america', flag: '🇨🇷' },
  panama: { code: 'PA', name: 'Panama', continent: 'north_america', flag: '🇵🇦' },
  guatemala: { code: 'GT', name: 'Guatemala', continent: 'north_america', flag: '🇬🇹' },
  jamaica: { code: 'JM', name: 'Jamaica', continent: 'north_america', flag: '🇯🇲' },
  honduras: { code: 'HN', name: 'Honduras', continent: 'north_america', flag: '🇭🇳' },
  'el salvador': { code: 'SV', name: 'El Salvador', continent: 'north_america', flag: '🇸🇻' },

  // Oceania
  australia: { code: 'AU', name: 'Australia', continent: 'oceania', flag: '🇦🇺' },
  'new zealand': { code: 'NZ', name: 'New Zealand', continent: 'oceania', flag: '🇳🇿' },

  // Continental / International Scope
  international: { code: 'INT', name: 'International', continent: 'international', flag: '🌐' },
  europe: { code: 'EUR', name: 'Europe', continent: 'european_competitions', flag: '🏆' },
  asia: { code: 'ASI', name: 'Asia', continent: 'asia', flag: '🌏' },
  africa: { code: 'AFR', name: 'Africa', continent: 'africa', flag: '🌍' },
  'south america': { code: 'SAM', name: 'South America', continent: 'south_america', flag: '🌎' },
  'north america': { code: 'NAM', name: 'North America', continent: 'north_america', flag: '🌎' },
};

/**
 * Helper to retrieve canonical country metadata
 */
export function getCountryMeta(countryNameOrCode?: string): CountryMeta {
  if (!countryNameOrCode) return KNOWN_COUNTRIES.international;
  const key = countryNameOrCode.toLowerCase().trim();
  if (KNOWN_COUNTRIES[key]) return KNOWN_COUNTRIES[key];

  for (const [k, meta] of Object.entries(KNOWN_COUNTRIES)) {
    if (meta.code.toLowerCase() === key || meta.name.toLowerCase() === key) {
      return meta;
    }
  }

  // Safe fallback
  return {
    code: 'INT',
    name: countryNameOrCode,
    continent: 'international',
    flag: '⚽',
  };
}

/**
 * Primary Canonical Competitions Registry
 */
export const CANONICAL_COMPETITIONS: Record<string, CanonicalCompetition> = {
  // =========================================================================
  // 1. European Club Competitions (UEFA)
  // =========================================================================
  uefa_champions_league: {
    id: 'uefa_champions_league',
    provider: 'SportScore',
    providerSlug: 'uefa-champions-league',
    name: 'UEFA Champions League',
    country: 'Europe',
    countryCode: 'EUR',
    countryName: 'Europe',
    continent: 'european_competitions',
    competitionType: 'continental_club',
    type: 'continental_club',
    tier: 1,
    rank: 1,
    displayPriority: 1000,
    priorityRank: 10,
    prestigeScore: 1000,
    flag: '🏆',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['uefa-champions-league', 'champions-league', 'ucl'],
  },
  uefa_europa_league: {
    id: 'uefa_europa_league',
    provider: 'SportScore',
    providerSlug: 'uefa-europa-league',
    name: 'UEFA Europa League',
    country: 'Europe',
    countryCode: 'EUR',
    countryName: 'Europe',
    continent: 'european_competitions',
    competitionType: 'continental_club',
    type: 'continental_club',
    tier: 2,
    rank: 2,
    displayPriority: 800,
    priorityRank: 20,
    prestigeScore: 800,
    flag: '🏆',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['uefa-europa-league', 'europa-league', 'uel'],
  },
  uefa_conference_league: {
    id: 'uefa_conference_league',
    provider: 'SportScore',
    providerId: 'p4jwq2gh754m0ve',
    providerSlug: 'uefa-europa-conference-league',
    name: 'UEFA Conference League',
    country: 'Europe',
    countryCode: 'EUR',
    countryName: 'Europe',
    continent: 'european_competitions',
    competitionType: 'continental_club',
    type: 'continental_club',
    tier: 3,
    rank: 3,
    displayPriority: 800,
    priorityRank: 30,
    prestigeScore: 800,
    flag: '🏆',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['uefa-conference-league', 'uefa-europa-conference-league', 'conference-league', 'uecl'],
  },
  uefa_super_cup: {
    id: 'uefa_super_cup',
    provider: 'SportScore',
    providerSlug: 'uefa-super-cup',
    name: 'UEFA Super Cup',
    country: 'Europe',
    countryCode: 'EUR',
    countryName: 'Europe',
    continent: 'european_competitions',
    competitionType: 'super_cup',
    type: 'super_cup',
    tier: 1,
    rank: 4,
    displayPriority: 800,
    priorityRank: 40,
    prestigeScore: 800,
    flag: '🏆',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['uefa-super-cup'],
  },
  uefa_youth_league: {
    id: 'uefa_youth_league',
    provider: 'SportScore',
    providerSlug: 'uefa-youth-league',
    name: 'UEFA Youth League',
    country: 'Europe',
    countryCode: 'EUR',
    countryName: 'Europe',
    continent: 'european_competitions',
    competitionType: 'youth',
    type: 'youth',
    tier: 9,
    rank: 5,
    displayPriority: 500,
    priorityRank: 90,
    prestigeScore: 500,
    flag: '🏆',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['uefa-youth-league'],
  },
  uefa_nations_league: {
    id: 'uefa_nations_league',
    provider: 'SportScore',
    providerSlug: 'uefa-nations-league',
    name: 'UEFA Nations League',
    country: 'Europe',
    countryCode: 'EUR',
    countryName: 'Europe',
    continent: 'european_competitions',
    competitionType: 'international',
    type: 'international',
    tier: 1,
    rank: 6,
    displayPriority: 800,
    priorityRank: 50,
    prestigeScore: 800,
    flag: '🇪🇺',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['uefa-nations-league', 'nations-league'],
  },

  // =========================================================================
  // 2. Top 5 European Domestic Leagues
  // =========================================================================
  eng_premier_league: {
    id: 'eng_premier_league',
    provider: 'SportScore',
    providerSlug: 'premier-league',
    name: 'English Premier League',
    country: 'England',
    countryCode: 'GB-ENG',
    countryName: 'England',
    continent: 'europe',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 1,
    displayPriority: 700,
    priorityRank: 100,
    prestigeScore: 700,
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['premier', 'england/premier-league', 'premier-league', 'english-premier-league'],
  },
  esp_la_liga: {
    id: 'esp_la_liga',
    provider: 'SportScore',
    providerSlug: 'la-liga',
    name: 'Spanish La Liga',
    country: 'Spain',
    countryCode: 'ES',
    countryName: 'Spain',
    continent: 'europe',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 2,
    displayPriority: 700,
    priorityRank: 110,
    prestigeScore: 700,
    flag: '🇪🇸',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['spain1', 'spain/la-liga', 'la-liga', 'laliga', 'spanish-la-liga'],
  },
  ita_serie_a: {
    id: 'ita_serie_a',
    provider: 'SportScore',
    providerSlug: 'serie-a',
    name: 'Italian Serie A',
    country: 'Italy',
    countryCode: 'IT',
    countryName: 'Italy',
    continent: 'europe',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 3,
    displayPriority: 700,
    priorityRank: 120,
    prestigeScore: 700,
    flag: '🇮🇹',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['italy1', 'italy/serie-a', 'serie-a', 'italian-serie-a'],
  },
  ger_bundesliga: {
    id: 'ger_bundesliga',
    provider: 'SportScore',
    providerSlug: 'bundesliga',
    name: 'German Bundesliga',
    country: 'Germany',
    countryCode: 'DE',
    countryName: 'Germany',
    continent: 'europe',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 4,
    displayPriority: 700,
    priorityRank: 130,
    prestigeScore: 700,
    flag: '🇩🇪',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['germany1', 'germany/bundesliga', 'bundesliga', 'german-bundesliga'],
  },
  fra_ligue_1: {
    id: 'fra_ligue_1',
    provider: 'SportScore',
    providerSlug: 'ligue-1',
    name: 'French Ligue 1',
    country: 'France',
    countryCode: 'FR',
    countryName: 'France',
    continent: 'europe',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 5,
    displayPriority: 700,
    priorityRank: 140,
    prestigeScore: 700,
    flag: '🇫🇷',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['france1', 'france/ligue-1', 'ligue-1', 'french-ligue-1'],
  },

  // =========================================================================
  // 3. Other Major European Domestic Leagues & Cups
  // =========================================================================
  eng_championship: {
    id: 'eng_championship',
    provider: 'SportScore',
    providerSlug: 'championship',
    name: 'EFL Championship',
    country: 'England',
    countryCode: 'GB-ENG',
    countryName: 'England',
    continent: 'europe',
    competitionType: 'lower_division',
    type: 'lower_division',
    tier: 2,
    rank: 6,
    displayPriority: 600,
    priorityRank: 200,
    prestigeScore: 600,
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['cha', 'championship', 'efl-championship'],
  },
  esp_segunda: {
    id: 'esp_segunda',
    provider: 'SportScore',
    providerSlug: 'segunda-division',
    name: 'Spanish Segunda División',
    country: 'Spain',
    countryCode: 'ES',
    countryName: 'Spain',
    continent: 'europe',
    competitionType: 'lower_division',
    type: 'lower_division',
    tier: 2,
    rank: 7,
    displayPriority: 550,
    priorityRank: 210,
    prestigeScore: 550,
    flag: '🇪🇸',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['spain2', 'segunda-division', 'laliga-hypermotion'],
  },
  por_primeira_liga: {
    id: 'por_primeira_liga',
    provider: 'SportScore',
    providerSlug: 'primeira-liga',
    name: 'Liga Portugal',
    country: 'Portugal',
    countryCode: 'PT',
    countryName: 'Portugal',
    continent: 'europe',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 8,
    displayPriority: 600,
    priorityRank: 220,
    prestigeScore: 600,
    flag: '🇵🇹',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['portugal1', 'primeira-liga', 'liga-portugal'],
  },
  ned_eredivisie: {
    id: 'ned_eredivisie',
    provider: 'SportScore',
    providerSlug: 'eredivisie',
    name: 'Dutch Eredivisie',
    country: 'Netherlands',
    countryCode: 'NL',
    countryName: 'Netherlands',
    continent: 'europe',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 9,
    displayPriority: 600,
    priorityRank: 230,
    prestigeScore: 600,
    flag: '🇳🇱',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['holland1', 'eredivisie', 'dutch-eredivisie'],
  },
  sco_premiership: {
    id: 'sco_premiership',
    provider: 'SportScore',
    providerSlug: 'scottish-premiership',
    name: 'Scottish Premiership',
    country: 'Scotland',
    countryCode: 'GB-SCT',
    countryName: 'Scotland',
    continent: 'europe',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 10,
    displayPriority: 550,
    priorityRank: 240,
    prestigeScore: 550,
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['scot-premier', 'scottish-premiership'],
  },
  tur_super_lig: {
    id: 'tur_super_lig',
    provider: 'SportScore',
    providerSlug: 'super-lig',
    name: 'Turkish Süper Lig',
    country: 'Turkey',
    countryCode: 'TR',
    countryName: 'Turkey',
    continent: 'europe',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 11,
    displayPriority: 550,
    priorityRank: 245,
    prestigeScore: 550,
    flag: '🇹🇷',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['turkey1', 'super-lig', 'turkish-super-lig'],
  },
  bel_pro_league: {
    id: 'bel_pro_league',
    provider: 'SportScore',
    providerId: '9vjxm8gh22r6odg',
    providerSlug: 'belgian-pro-league',
    name: 'Belgian Pro League',
    country: 'Belgium',
    countryCode: 'BE',
    countryName: 'Belgium',
    continent: 'europe',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 12,
    displayPriority: 600,
    priorityRank: 250,
    prestigeScore: 600,
    flag: '🇧🇪',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['belgian-pro-league', 'belgium1', 'jupiler-pro-league', 'pro-league-belgium'],
  },
  bel_challenger_pro: {
    id: 'bel_challenger_pro',
    provider: 'SportScore',
    providerId: 'gx7lm7ph5nm2wdk',
    providerSlug: 'belgian-challenger-pro-league',
    name: 'Belgian Challenger Pro League',
    country: 'Belgium',
    countryCode: 'BE',
    countryName: 'Belgium',
    continent: 'europe',
    competitionType: 'lower_division',
    type: 'lower_division',
    tier: 2,
    rank: 13,
    displayPriority: 450,
    priorityRank: 350,
    prestigeScore: 450,
    flag: '🇧🇪',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['belgian-challenger-pro-league', 'belgian-first-division-b'],
  },
  bel_cup: {
    id: 'bel_cup',
    provider: 'SportScore',
    providerId: 'p4jwq2gh0gm0veo',
    providerSlug: 'belgian-cup',
    name: 'Belgian Cup',
    country: 'Belgium',
    countryCode: 'BE',
    countryName: 'Belgium',
    continent: 'europe',
    competitionType: 'domestic_cup',
    type: 'domestic_cup',
    tier: 1,
    rank: 14,
    displayPriority: 500,
    priorityRank: 300,
    prestigeScore: 500,
    flag: '🇧🇪',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['belgian-cup', 'croky-cup'],
  },

  // =========================================================================
  // 4. Asian Competitions & Domestic Leagues (SportScore Verified)
  // =========================================================================
  afc_champions_league: {
    id: 'afc_champions_league',
    provider: 'SportScore',
    providerId: '9dn1m1ghjpmoepl',
    providerSlug: 'afc-champions-league',
    name: 'AFC Champions League',
    country: 'Asia',
    countryCode: 'ASI',
    countryName: 'Asia',
    continent: 'asia',
    competitionType: 'continental_club',
    type: 'continental_club',
    tier: 1,
    rank: 1,
    displayPriority: 600,
    priorityRank: 260,
    prestigeScore: 600,
    flag: '🌏',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['afc-champions-league', 'afc-champions-league-elite', 'afc-elite'],
  },
  afc_challenge_league: {
    id: 'afc_challenge_league',
    provider: 'SportScore',
    providerId: 'gpxwrxlhx0oryk0',
    providerSlug: 'afc-challenge-league',
    name: 'AFC Challenge League',
    country: 'Asia',
    countryCode: 'ASI',
    countryName: 'Asia',
    continent: 'asia',
    competitionType: 'continental_club',
    type: 'continental_club',
    tier: 3,
    rank: 2,
    displayPriority: 450,
    priorityRank: 380,
    prestigeScore: 450,
    flag: '🌏',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['afc-challenge-league'],
  },
  irn_pro_league: {
    id: 'irn_pro_league',
    provider: 'SportScore',
    providerId: 'kjw2r09hln4rz84',
    providerSlug: 'iran-pro-league',
    name: 'Iran Pro League',
    country: 'Iran',
    countryCode: 'IR',
    countryName: 'Iran',
    continent: 'asia',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 3,
    displayPriority: 500,
    priorityRank: 320,
    prestigeScore: 500,
    flag: '🇮🇷',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['iran-pro-league', 'persian-gulf-pro-league', 'iran1'],
  },
  irn_cup: {
    id: 'irn_cup',
    provider: 'SportScore',
    providerId: 'kdj2ryohkyyq1zp',
    providerSlug: 'iran-cup',
    name: 'Iran Hazfi Cup',
    country: 'Iran',
    countryCode: 'IR',
    countryName: 'Iran',
    continent: 'asia',
    competitionType: 'domestic_cup',
    type: 'domestic_cup',
    tier: 1,
    rank: 4,
    displayPriority: 400,
    priorityRank: 400,
    prestigeScore: 400,
    flag: '🇮🇷',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['iran-cup', 'hazfi-cup'],
  },
  uzb_pro_league: {
    id: 'uzb_pro_league',
    provider: 'SportScore',
    providerId: 'v2y8m4zh38gql07',
    providerSlug: 'uzbekistan-pro-league',
    name: 'Uzbekistan Pro League',
    country: 'Uzbekistan',
    countryCode: 'UZ',
    countryName: 'Uzbekistan',
    continent: 'asia',
    competitionType: 'lower_division',
    type: 'lower_division',
    tier: 2,
    rank: 5,
    displayPriority: 350,
    priorityRank: 420,
    prestigeScore: 350,
    flag: '🇺🇿',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['uzbekistan-pro-league', 'uzb-pro-league'],
  },
  mys_a1_semi_pro: {
    id: 'mys_a1_semi_pro',
    provider: 'SportScore',
    providerId: 'v2y8m4zhzo9ql07',
    providerSlug: 'malaysia-a1-semi-pro-league',
    name: 'Malaysia A1 Semi-Pro League',
    country: 'Malaysia',
    countryCode: 'MY',
    countryName: 'Malaysia',
    continent: 'asia',
    competitionType: 'reserve_amateur',
    type: 'reserve_amateur',
    tier: 3,
    rank: 6,
    displayPriority: 300,
    priorityRank: 450,
    prestigeScore: 300,
    flag: '🇲🇾',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['malaysia-a1-semi-pro-league', 'malaysia-semi-pro'],
  },
  tha_fa_cup: {
    id: 'tha_fa_cup',
    provider: 'SportScore',
    providerId: 'j1l4rjnh6znm7vx',
    providerSlug: 'thai-fa-cup',
    name: 'Thai FA Cup',
    country: 'Thailand',
    countryCode: 'TH',
    countryName: 'Thailand',
    continent: 'asia',
    competitionType: 'domestic_cup',
    type: 'domestic_cup',
    tier: 1,
    rank: 7,
    displayPriority: 400,
    priorityRank: 410,
    prestigeScore: 400,
    flag: '🇹🇭',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['thai-fa-cup', 'thailand-fa-cup'],
  },
  sau_pro_league: {
    id: 'sau_pro_league',
    provider: 'SportScore',
    providerSlug: 'saudi-pro-league',
    name: 'Saudi Pro League',
    country: 'Saudi Arabia',
    countryCode: 'SA',
    countryName: 'Saudi Arabia',
    continent: 'asia',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 8,
    displayPriority: 600,
    priorityRank: 205,
    prestigeScore: 600,
    flag: '🇸🇦',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['saudi1', 'saudi-pro-league', 'roshn-saudi-league'],
  },
  jpn_j1_league: {
    id: 'jpn_j1_league',
    provider: 'SportScore',
    providerId: 'z318q66hl1qo9jd',
    providerSlug: 'japanese-j1-league',
    name: 'Japanese J1 League',
    country: 'Japan',
    countryCode: 'JP',
    countryName: 'Japan',
    continent: 'asia',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 9,
    displayPriority: 550,
    priorityRank: 270,
    prestigeScore: 550,
    flag: '🇯🇵',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['japan1', 'japanese-j1-league', 'j1-league', 'j-league'],
  },
  jpn_j2_league: {
    id: 'jpn_j2_league',
    provider: 'SportScore',
    providerSlug: 'japanese-j2-league',
    name: 'Japanese J2 League',
    country: 'Japan',
    countryCode: 'JP',
    countryName: 'Japan',
    continent: 'asia',
    competitionType: 'lower_division',
    type: 'lower_division',
    tier: 2,
    rank: 10,
    displayPriority: 450,
    priorityRank: 360,
    prestigeScore: 450,
    flag: '🇯🇵',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['japanese-j2-league', 'j2-league'],
  },
  jpn_j3_league: {
    id: 'jpn_j3_league',
    provider: 'SportScore',
    providerSlug: 'japanese-j3-league',
    name: 'Japanese J3 League',
    country: 'Japan',
    countryCode: 'JP',
    countryName: 'Japan',
    continent: 'asia',
    competitionType: 'lower_division',
    type: 'lower_division',
    tier: 3,
    rank: 11,
    displayPriority: 400,
    priorityRank: 390,
    prestigeScore: 400,
    flag: '🇯🇵',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['japanese-j3-league', 'j3-league'],
  },
  jpn_we_league: {
    id: 'jpn_we_league',
    provider: 'SportScore',
    providerSlug: 'women-empowerment-league',
    name: 'Japan WE League',
    country: 'Japan',
    countryCode: 'JP',
    countryName: 'Japan',
    continent: 'asia',
    competitionType: 'women',
    type: 'women',
    tier: 1,
    rank: 12,
    displayPriority: 400,
    priorityRank: 400,
    prestigeScore: 400,
    flag: '🇯🇵',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['women-empowerment-league', 'we-league'],
  },
  idn_liga_1: {
    id: 'idn_liga_1',
    provider: 'SportScore',
    providerId: '56ypq3nhz53md7o',
    providerSlug: 'indonesian-super-league',
    name: 'Indonesian Liga 1',
    country: 'Indonesia',
    countryCode: 'ID',
    countryName: 'Indonesia',
    continent: 'asia',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 13,
    displayPriority: 400,
    priorityRank: 380,
    prestigeScore: 400,
    flag: '🇮🇩',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['indonesian-super-league', 'indonesia-liga-1'],
  },
  bgd_fed_cup: {
    id: 'bgd_fed_cup',
    provider: 'SportScore',
    providerId: '56ypq3nhzn2md7o',
    providerSlug: 'bangladesh-federation-cup',
    name: 'Bangladesh Federation Cup',
    country: 'Bangladesh',
    countryCode: 'BD',
    countryName: 'Bangladesh',
    continent: 'asia',
    competitionType: 'domestic_cup',
    type: 'domestic_cup',
    tier: 1,
    rank: 14,
    displayPriority: 350,
    priorityRank: 420,
    prestigeScore: 350,
    flag: '🇧🇩',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['bangladesh-federation-cup'],
  },
  mmr_u20: {
    id: 'mmr_u20',
    provider: 'SportScore',
    providerId: 'd23xmvkh4dgqg8n',
    providerSlug: 'myanmar-u20-league',
    name: 'Myanmar U20 League',
    country: 'Myanmar',
    countryCode: 'MM',
    countryName: 'Myanmar',
    continent: 'asia',
    competitionType: 'youth',
    type: 'youth',
    tier: 9,
    rank: 15,
    displayPriority: 250,
    priorityRank: 480,
    prestigeScore: 250,
    flag: '🇲🇲',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['myanmar-u20-league'],
  },
  mmr_women: {
    id: 'mmr_women',
    provider: 'SportScore',
    providerId: 'd23xmvkhxvwqg8n',
    providerSlug: 'mml-w',
    name: "Myanmar Women's League",
    country: 'Myanmar',
    countryCode: 'MM',
    countryName: 'Myanmar',
    continent: 'asia',
    competitionType: 'women',
    type: 'women',
    tier: 1,
    rank: 16,
    displayPriority: 250,
    priorityRank: 480,
    prestigeScore: 250,
    flag: '🇲🇲',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['mml-w', 'myanmar-women-league'],
  },
  aus_a_league: {
    id: 'aus_a_league',
    provider: 'SportScore',
    providerSlug: 'a-league',
    name: 'Australian A-League',
    country: 'Australia',
    countryCode: 'AU',
    countryName: 'Australia',
    continent: 'oceania',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 1,
    displayPriority: 500,
    priorityRank: 290,
    prestigeScore: 500,
    flag: '🇦🇺',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['australia1', 'a-league', 'australian-a-league'],
  },

  // =========================================================================
  // 5. African Leagues & Competitions
  // =========================================================================
  caf_champions_league: {
    id: 'caf_champions_league',
    provider: 'SportScore',
    providerSlug: 'caf-champions-league',
    name: 'CAF Champions League',
    country: 'Africa',
    countryCode: 'AFR',
    countryName: 'Africa',
    continent: 'africa',
    competitionType: 'continental_club',
    type: 'continental_club',
    tier: 1,
    rank: 1,
    displayPriority: 700,
    priorityRank: 150,
    prestigeScore: 700,
    flag: '🌍',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['caf-champions-league'],
  },
  caf_confederation_cup: {
    id: 'caf_confederation_cup',
    provider: 'SportScore',
    providerSlug: 'caf-confederation-cup',
    name: 'CAF Confederation Cup',
    country: 'Africa',
    countryCode: 'AFR',
    countryName: 'Africa',
    continent: 'africa',
    competitionType: 'continental_club',
    type: 'continental_club',
    tier: 2,
    rank: 2,
    displayPriority: 600,
    priorityRank: 160,
    prestigeScore: 600,
    flag: '🌍',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['caf-confederation-cup'],
  },
  caf_u20: {
    id: 'caf_u20',
    provider: 'SportScore',
    providerSlug: 'caf-u20-africa-cup-of-nations',
    name: 'CAF U20 Africa Cup of Nations',
    country: 'Africa',
    countryCode: 'AFR',
    countryName: 'Africa',
    continent: 'africa',
    competitionType: 'youth',
    type: 'youth',
    tier: 9,
    rank: 10,
    displayPriority: 250,
    priorityRank: 470,
    prestigeScore: 250,
    flag: '🌍',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['caf-u20-africa-cup-of-nations', 'caf-u20'],
  },
  ken_premier_league: {
    id: 'ken_premier_league',
    provider: 'SportScore',
    providerSlug: 'kenyan-premier-league',
    name: 'Kenyan Premier League',
    country: 'Kenya',
    countryCode: 'KE',
    countryName: 'Kenya',
    continent: 'africa',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 3,
    displayPriority: 650,
    priorityRank: 170,
    prestigeScore: 650,
    flag: '🇰🇪',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['kenya', 'kenyan-premier-league', 'fkf-premier-league'],
  },
  egy_premier_league: {
    id: 'egy_premier_league',
    provider: 'SportScore',
    providerSlug: 'egyptian-premier-league',
    name: 'Egyptian Premier League',
    country: 'Egypt',
    countryCode: 'EG',
    countryName: 'Egypt',
    continent: 'africa',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 4,
    displayPriority: 600,
    priorityRank: 180,
    prestigeScore: 600,
    flag: '🇪🇬',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['egypt', 'egyptian-premier-league'],
  },
  rsa_premiership: {
    id: 'rsa_premiership',
    provider: 'SportScore',
    providerSlug: 'south-african-premier-division',
    name: 'South African Premier Division',
    country: 'South Africa',
    countryCode: 'ZA',
    countryName: 'South Africa',
    continent: 'africa',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 5,
    displayPriority: 600,
    priorityRank: 190,
    prestigeScore: 600,
    flag: '🇿🇦',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['south-africa', 'dstv-premiership', 'psl-south-africa'],
  },
  mar_botola_pro: {
    id: 'mar_botola_pro',
    provider: 'SportScore',
    providerSlug: 'botola-pro',
    name: 'Moroccan Botola Pro',
    country: 'Morocco',
    countryCode: 'MA',
    countryName: 'Morocco',
    continent: 'africa',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 6,
    displayPriority: 550,
    priorityRank: 195,
    prestigeScore: 550,
    flag: '🇲🇦',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['morocco', 'botola-pro', 'botola'],
  },
  gha_premier_league: {
    id: 'gha_premier_league',
    provider: 'SportScore',
    providerSlug: 'ghana-premier-league',
    name: 'Ghana Premier League',
    country: 'Ghana',
    countryCode: 'GH',
    countryName: 'Ghana',
    continent: 'africa',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 7,
    displayPriority: 500,
    priorityRank: 280,
    prestigeScore: 500,
    flag: '🇬🇭',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['ghana-premier-league'],
  },
  eth_premier_league: {
    id: 'eth_premier_league',
    provider: 'SportScore',
    providerSlug: 'ethiopia-premier-league',
    name: 'Ethiopian Premier League',
    country: 'Ethiopia',
    countryCode: 'ET',
    countryName: 'Ethiopia',
    continent: 'africa',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 8,
    displayPriority: 500,
    priorityRank: 285,
    prestigeScore: 500,
    flag: '🇪🇹',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['ethiopia-premier-league'],
  },
  uga_premier_league: {
    id: 'uga_premier_league',
    provider: 'SportScore',
    providerSlug: 'uganda-premier-league',
    name: 'Uganda Premier League',
    country: 'Uganda',
    countryCode: 'UG',
    countryName: 'Uganda',
    continent: 'africa',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 9,
    displayPriority: 450,
    priorityRank: 310,
    prestigeScore: 450,
    flag: '🇺🇬',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['uganda-premier-league'],
  },

  // =========================================================================
  // 6. South American Competitions
  // =========================================================================
  conmebol_libertadores: {
    id: 'conmebol_libertadores',
    provider: 'SportScore',
    providerSlug: 'copa-libertadores',
    name: 'CONMEBOL Libertadores',
    country: 'South America',
    countryCode: 'SAM',
    countryName: 'South America',
    continent: 'south_america',
    competitionType: 'continental_club',
    type: 'continental_club',
    tier: 1,
    rank: 1,
    displayPriority: 750,
    priorityRank: 80,
    prestigeScore: 750,
    flag: '🏆',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['conmebol-libertadores', 'copa-libertadores', 'libertadores'],
  },
  conmebol_libertadores_femenino: {
    id: 'conmebol_libertadores_femenino',
    provider: 'SportScore',
    providerSlug: 'conmebol-copa-libertadores-femenino',
    name: 'CONMEBOL Libertadores Femenino',
    country: 'South America',
    countryCode: 'SAM',
    countryName: 'South America',
    continent: 'south_america',
    competitionType: 'women',
    type: 'women',
    tier: 1,
    rank: 2,
    displayPriority: 400,
    priorityRank: 340,
    prestigeScore: 400,
    flag: '🏆',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['conmebol-copa-libertadores-femenino'],
  },
  conmebol_sudamericana: {
    id: 'conmebol_sudamericana',
    provider: 'SportScore',
    providerSlug: 'copa-sudamericana',
    name: 'CONMEBOL Sudamericana',
    country: 'South America',
    countryCode: 'SAM',
    countryName: 'South America',
    continent: 'south_america',
    competitionType: 'continental_club',
    type: 'continental_club',
    tier: 2,
    rank: 3,
    displayPriority: 650,
    priorityRank: 85,
    prestigeScore: 650,
    flag: '🏆',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['conmebol-sudamericana', 'copa-sudamericana', 'sudamericana'],
  },
  bra_serie_a: {
    id: 'bra_serie_a',
    provider: 'SportScore',
    providerSlug: 'brasileirao-serie-a',
    name: 'Brazilian Série A',
    country: 'Brazil',
    countryCode: 'BR',
    countryName: 'Brazil',
    continent: 'south_america',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 4,
    displayPriority: 600,
    priorityRank: 202,
    prestigeScore: 600,
    flag: '🇧🇷',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['brazil1', 'brasileirao', 'serie-a-brazil'],
  },
  arg_primera_division: {
    id: 'arg_primera_division',
    provider: 'SportScore',
    providerSlug: 'primera-division-argentina',
    name: 'Argentine Primera División',
    country: 'Argentina',
    countryCode: 'AR',
    countryName: 'Argentina',
    continent: 'south_america',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 5,
    displayPriority: 550,
    priorityRank: 204,
    prestigeScore: 550,
    flag: '🇦🇷',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['argentina1', 'argentine-division-1', 'primera-division-argentina', 'liga-profesional-argentina'],
  },
  col_primera_a: {
    id: 'col_primera_a',
    provider: 'SportScore',
    providerSlug: 'categoria-primera-a',
    name: 'Colombian Primera A',
    country: 'Colombia',
    countryCode: 'CO',
    countryName: 'Colombia',
    continent: 'south_america',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 6,
    displayPriority: 500,
    priorityRank: 290,
    prestigeScore: 500,
    flag: '🇨🇴',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['categoria-primera-a', 'primera-a-colombia', 'liga-betplay'],
  },
  chl_primera_division: {
    id: 'chl_primera_division',
    provider: 'SportScore',
    providerSlug: 'primera-division-chile',
    name: 'Chilean Primera División',
    country: 'Chile',
    countryCode: 'CL',
    countryName: 'Chile',
    continent: 'south_america',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 7,
    displayPriority: 450,
    priorityRank: 295,
    prestigeScore: 450,
    flag: '🇨🇱',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['primera-division-chile', 'chilean-primera'],
  },
  ury_primera_division: {
    id: 'ury_primera_division',
    provider: 'SportScore',
    providerSlug: 'primera-division-uruguay',
    name: 'Uruguayan Primera División',
    country: 'Uruguay',
    countryCode: 'UY',
    countryName: 'Uruguay',
    continent: 'south_america',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 8,
    displayPriority: 450,
    priorityRank: 300,
    prestigeScore: 450,
    flag: '🇺🇾',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['primera-division-uruguay', 'uruguayan-primera'],
  },
  pry_primera_division: {
    id: 'pry_primera_division',
    provider: 'SportScore',
    providerSlug: 'primera-division-paraguay',
    name: 'Paraguayan Primera División',
    country: 'Paraguay',
    countryCode: 'PY',
    countryName: 'Paraguay',
    continent: 'south_america',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 9,
    displayPriority: 450,
    priorityRank: 305,
    prestigeScore: 450,
    flag: '🇵🇾',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['primera-division-paraguay', 'paraguayan-primera'],
  },

  // =========================================================================
  // 7. North American Competitions
  // =========================================================================
  concacaf_champions_cup: {
    id: 'concacaf_champions_cup',
    provider: 'SportScore',
    providerSlug: 'concacaf-champions-cup',
    name: 'CONCACAF Champions Cup',
    country: 'North America',
    countryCode: 'NAM',
    countryName: 'North America',
    continent: 'north_america',
    competitionType: 'continental_club',
    type: 'continental_club',
    tier: 1,
    rank: 1,
    displayPriority: 600,
    priorityRank: 88,
    prestigeScore: 600,
    flag: '🏆',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['concacaf-champions-cup', 'concacaf-champions-league'],
  },
  usa_mls: {
    id: 'usa_mls',
    provider: 'SportScore',
    providerSlug: 'major-league-soccer',
    name: 'Major League Soccer (MLS)',
    country: 'United States',
    countryCode: 'US',
    countryName: 'United States',
    continent: 'north_america',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 2,
    displayPriority: 600,
    priorityRank: 201,
    prestigeScore: 600,
    flag: '🇺🇸',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['mls', 'major-league-soccer'],
  },
  mex_liga_mx: {
    id: 'mex_liga_mx',
    provider: 'SportScore',
    providerId: '324d7a463a24c4cd35ef83456a1b8d05',
    providerSlug: 'mexico-liga-mx',
    name: 'Mexican Liga MX',
    country: 'Mexico',
    countryCode: 'MX',
    countryName: 'Mexico',
    continent: 'north_america',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 3,
    displayPriority: 600,
    priorityRank: 203,
    prestigeScore: 600,
    flag: '🇲🇽',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['mexico1', 'mexico-liga-mx', 'liga-mx'],
  },
  mex_liga_mx_femenil: {
    id: 'mex_liga_mx_femenil',
    provider: 'SportScore',
    providerId: '56ypq3nhzpzmd7o',
    providerSlug: 'mexico-liga-mx-femenil',
    name: 'Mexican Liga MX Femenil',
    country: 'Mexico',
    countryCode: 'MX',
    countryName: 'Mexico',
    continent: 'north_america',
    competitionType: 'women',
    type: 'women',
    tier: 1,
    rank: 4,
    displayPriority: 450,
    priorityRank: 330,
    prestigeScore: 450,
    flag: '🇲🇽',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['mexico-liga-mx-femenil', 'liga-mx-femenil'],
  },
  can_premier_league: {
    id: 'can_premier_league',
    provider: 'SportScore',
    providerSlug: 'canadian-premier-league',
    name: 'Canadian Premier League',
    country: 'Canada',
    countryCode: 'CA',
    countryName: 'Canada',
    continent: 'north_america',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 5,
    displayPriority: 450,
    priorityRank: 310,
    prestigeScore: 450,
    flag: '🇨🇦',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['canadian-premier-league'],
  },
  cri_primera_division: {
    id: 'cri_primera_division',
    provider: 'SportScore',
    providerId: 'jednm9whneryox8',
    providerSlug: 'costa-rica-primera-division',
    name: 'Costa Rican Primera División',
    country: 'Costa Rica',
    countryCode: 'CR',
    countryName: 'Costa Rica',
    continent: 'north_america',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 6,
    displayPriority: 450,
    priorityRank: 320,
    prestigeScore: 450,
    flag: '🇨🇷',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['costa-rica-primera-division', 'costa-rica-primera'],
  },
  cri_segunda_division: {
    id: 'cri_segunda_division',
    provider: 'SportScore',
    providerSlug: 'costa-rica-2-liga',
    name: 'Costa Rican Segunda División',
    country: 'Costa Rica',
    countryCode: 'CR',
    countryName: 'Costa Rica',
    continent: 'north_america',
    competitionType: 'lower_division',
    type: 'lower_division',
    tier: 2,
    rank: 7,
    displayPriority: 300,
    priorityRank: 440,
    prestigeScore: 300,
    flag: '🇨🇷',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['costa-rica-2-liga', 'costa-rica-liga-de-ascenso'],
  },

  // =========================================================================
  // 8. International & Other
  // =========================================================================
  rus_premier_league: {
    id: 'rus_premier_league',
    provider: 'SportScore',
    providerSlug: 'russian-premier-league',
    name: 'Russian Premier League',
    country: 'Russia',
    countryCode: 'RU',
    countryName: 'Russia',
    continent: 'europe',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 15,
    displayPriority: 500,
    priorityRank: 265,
    prestigeScore: 500,
    flag: '🇷🇺',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['russian-premier-league', 'russia-premier-league'],
  },
  kaz_premier_league: {
    id: 'kaz_premier_league',
    provider: 'SportScore',
    providerSlug: 'kazakhstan-premier-league',
    name: 'Kazakhstan Premier League',
    country: 'Kazakhstan',
    countryCode: 'KZ',
    countryName: 'Kazakhstan',
    continent: 'asia',
    competitionType: 'domestic_league',
    type: 'domestic_league',
    tier: 1,
    rank: 17,
    displayPriority: 450,
    priorityRank: 335,
    prestigeScore: 450,
    flag: '🇰🇿',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['kazakhstan-premier-league'],
  },
  fifa_world_cup: {
    id: 'fifa_world_cup',
    provider: 'SportScore',
    providerSlug: 'fifa-world-cup',
    name: 'FIFA World Cup',
    country: 'International',
    countryCode: 'INT',
    countryName: 'International',
    continent: 'international',
    competitionType: 'international',
    type: 'international',
    tier: 1,
    rank: 1,
    displayPriority: 1000,
    priorityRank: 1,
    prestigeScore: 1000,
    flag: '🌐',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['fifa-world-cup', 'world-cup'],
  },
  fifa_u17_women_world_cup: {
    id: 'fifa_u17_women_world_cup',
    provider: 'SportScore',
    providerSlug: 'fifa-u17-women-s-world-cup',
    name: "FIFA U-17 Women's World Cup",
    country: 'International',
    countryCode: 'INT',
    countryName: 'International',
    continent: 'international',
    competitionType: 'women',
    type: 'women',
    tier: 1,
    rank: 2,
    displayPriority: 450,
    priorityRank: 320,
    prestigeScore: 450,
    flag: '🌐',
    isFeatured: false,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['fifa-u17-women-s-world-cup'],
  },
  international_friendly: {
    id: 'international_friendly',
    provider: 'SportScore',
    providerSlug: 'international-friendly',
    name: 'International Friendlies',
    country: 'International',
    countryCode: 'INT',
    countryName: 'International',
    continent: 'international',
    competitionType: 'international',
    type: 'international',
    tier: 2,
    rank: 3,
    displayPriority: 500,
    priorityRank: 60,
    prestigeScore: 500,
    flag: '🌐',
    isFeatured: true,
    active: true,
    metadataSource: 'verified_sportscore',
    providerSlugs: ['international-friendly', 'friendlies'],
  },
};

/**
 * Explicit Provider Slug Registry mapping known provider identifiers directly to canonical IDs
 */
export const PROVIDER_SLUG_REGISTRY: Record<string, string> = {
  // UEFA
  'uefa-champions-league': 'uefa_champions_league',
  'champions-league': 'uefa_champions_league',
  'ucl': 'uefa_champions_league',
  'uefa-europa-league': 'uefa_europa_league',
  'europa-league': 'uefa_europa_league',
  'uel': 'uefa_europa_league',
  'uefa-europa-conference-league': 'uefa_conference_league',
  'uefa-conference-league': 'uefa_conference_league',
  'conference-league': 'uefa_conference_league',
  'uecl': 'uefa_conference_league',
  'uefa-super-cup': 'uefa_super_cup',
  'uefa-youth-league': 'uefa_youth_league',
  'uefa-nations-league': 'uefa_nations_league',

  // Top 5 Europe
  'premier': 'eng_premier_league',
  'premier-league': 'eng_premier_league',
  'english-premier-league': 'eng_premier_league',
  'spain1': 'esp_la_liga',
  'la-liga': 'esp_la_liga',
  'laliga': 'esp_la_liga',
  'spanish-la-liga': 'esp_la_liga',
  'italy1': 'ita_serie_a',
  'serie-a': 'ita_serie_a',
  'italian-serie-a': 'ita_serie_a',
  'germany1': 'ger_bundesliga',
  'bundesliga': 'ger_bundesliga',
  'german-bundesliga': 'ger_bundesliga',
  'france1': 'fra_ligue_1',
  'ligue-1': 'fra_ligue_1',
  'french-ligue-1': 'fra_ligue_1',

  // Other European
  'cha': 'eng_championship',
  'championship': 'eng_championship',
  'efl-championship': 'eng_championship',
  'spain2': 'esp_segunda',
  'segunda-division': 'esp_segunda',
  'portugal1': 'por_primeira_liga',
  'primeira-liga': 'por_primeira_liga',
  'liga-portugal': 'por_primeira_liga',
  'holland1': 'ned_eredivisie',
  'eredivisie': 'ned_eredivisie',
  'scot-premier': 'sco_premiership',
  'scottish-premiership': 'sco_premiership',
  'turkey1': 'tur_super_lig',
  'super-lig': 'tur_super_lig',
  'belgian-pro-league': 'bel_pro_league',
  'belgium1': 'bel_pro_league',
  'jupiler-pro-league': 'bel_pro_league',
  'belgian-challenger-pro-league': 'bel_challenger_pro',
  'belgian-cup': 'bel_cup',

  // Asia - CRITICAL DISAMBIGUATION
  'afc-champions-league': 'afc_champions_league',
  'afc-champions-league-elite': 'afc_champions_league',
  'afc-challenge-league': 'afc_challenge_league',
  'iran-pro-league': 'irn_pro_league',
  'persian-gulf-pro-league': 'irn_pro_league',
  'iran1': 'irn_pro_league',
  'iran-cup': 'irn_cup',
  'uzbekistan-pro-league': 'uzb_pro_league',
  'malaysia-a1-semi-pro-league': 'mys_a1_semi_pro',
  'thai-fa-cup': 'tha_fa_cup',
  'saudi-pro-league': 'sau_pro_league',
  'saudi1': 'sau_pro_league',
  'japanese-j1-league': 'jpn_j1_league',
  'japan1': 'jpn_j1_league',
  'japanese-j2-league': 'jpn_j2_league',
  'japanese-j3-league': 'jpn_j3_league',
  'women-empowerment-league': 'jpn_we_league',
  'indonesian-super-league': 'idn_liga_1',
  'bangladesh-federation-cup': 'bgd_fed_cup',
  'myanmar-u20-league': 'mmr_u20',
  'mml-w': 'mmr_women',
  'australia1': 'aus_a_league',
  'a-league': 'aus_a_league',

  // Africa
  'caf-champions-league': 'caf_champions_league',
  'caf-confederation-cup': 'caf_confederation_cup',
  'kenya': 'ken_premier_league',
  'kenyan-premier-league': 'ken_premier_league',
  'egypt': 'egy_premier_league',
  'egyptian-premier-league': 'egy_premier_league',
  'south-africa': 'rsa_premiership',
  'dstv-premiership': 'rsa_premiership',
  'morocco': 'mar_botola_pro',
  'botola': 'mar_botola_pro',
  'ghana-premier-league': 'gha_premier_league',
  'ethiopia-premier-league': 'eth_premier_league',
  'uganda-premier-league': 'uga_premier_league',

  // South America
  'conmebol-libertadores': 'conmebol_libertadores',
  'copa-libertadores': 'conmebol_libertadores',
  'conmebol-copa-libertadores-femenino': 'conmebol_libertadores_femenino',
  'conmebol-sudamericana': 'conmebol_sudamericana',
  'copa-sudamericana': 'conmebol_sudamericana',
  'brazil1': 'bra_serie_a',
  'brasileirao': 'bra_serie_a',
  'argentina1': 'arg_primera_division',
  'argentine-division-1': 'arg_primera_division',
  'categoria-primera-a': 'col_primera_a',

  // North America
  'concacaf-champions-cup': 'concacaf_champions_cup',
  'mls': 'usa_mls',
  'major-league-soccer': 'usa_mls',
  'mexico-liga-mx': 'mex_liga_mx',
  'mexico1': 'mex_liga_mx',
  'mexico-liga-mx-femenil': 'mex_liga_mx_femenil',
  'canadian-premier-league': 'can_premier_league',
  'costa-rica-primera-division': 'cri_primera_division',
  'costa-rica-2-liga': 'cri_segunda_division',

  // International
  'fifa-world-cup': 'fifa_world_cup',
  'fifa-u17-women-s-world-cup': 'fifa_u17_women_world_cup',
  'international-friendly': 'international_friendly',
};

/**
 * Resolved fallback competition for unclassified or unrecognized matches.
 * Strictly adheres to verified provider country/slug when present.
 */
export function getUnclassifiedCompetition(
  name: string,
  country?: string,
  leagueCode?: string
): CanonicalCompetition {
  const normName = (name || 'Other Competition').trim();
  const rawCountry = (country || '').trim();
  const slug = (leagueCode || '').toLowerCase().trim();

  // Try to determine country from explicit argument or known country matcher
  let countryMeta: CountryMeta | null = null;
  if (rawCountry && rawCountry.toLowerCase() !== 'international') {
    countryMeta = getCountryMeta(rawCountry);
  } else if (slug) {
    // Attempt to deduce country from slug prefix
    for (const [k, meta] of Object.entries(KNOWN_COUNTRIES)) {
      if (k !== 'international' && k !== 'europe' && (slug.startsWith(`${k}-`) || slug.startsWith(`${k}_`))) {
        countryMeta = meta;
        break;
      }
    }
  }

  if (!countryMeta) {
    countryMeta = KNOWN_COUNTRIES.international;
  }

  // Deduce competition type
  let compType: CompetitionType = 'other';
  const nLower = normName.toLowerCase();
  const sLower = slug.toLowerCase();
  if (nLower.includes('women') || nLower.includes('femen') || sLower.includes('women') || sLower.includes('femenil') || sLower.endsWith('-w')) {
    compType = 'women';
  } else if (nLower.includes('u17') || nLower.includes('u18') || nLower.includes('u19') || nLower.includes('u20') || nLower.includes('u21') || nLower.includes('u23') || nLower.includes('youth')) {
    compType = 'youth';
  } else if (nLower.includes('cup') || nLower.includes('copa') || sLower.includes('cup') || sLower.includes('fa-cup')) {
    compType = 'domestic_cup';
  } else if (nLower.includes('super cup') || nLower.includes('supercup') || sLower.includes('super-cup')) {
    compType = 'super_cup';
  } else if (nLower.includes('semi-pro') || nLower.includes('amateur') || nLower.includes('reserve')) {
    compType = 'reserve_amateur';
  } else if (nLower.includes('division 2') || nLower.includes('league 2') || nLower.includes('liga ii') || sLower.includes('division-2') || sLower.includes('liga-ii') || sLower.includes('j2') || sLower.includes('j3')) {
    compType = 'lower_division';
  } else if (nLower.includes('league') || nLower.includes('division') || nLower.includes('liga') || nLower.includes('premiership')) {
    compType = 'domestic_league';
  }

  const safeSlug = slug || normName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
  const uniqueId = `unclassified_${safeSlug}`;

  return {
    id: uniqueId,
    provider: 'SportScore',
    providerSlug: slug || safeSlug,
    providerSlugs: slug ? [slug] : [],
    name: normName,
    country: countryMeta.name,
    countryCode: countryMeta.code,
    countryName: countryMeta.name,
    continent: countryMeta.continent,
    competitionType: compType,
    type: compType,
    tier: compType === 'domestic_league' ? 1 : compType === 'lower_division' ? 2 : 9,
    rank: 99,
    displayPriority: 200,
    priorityRank: 999,
    prestigeScore: 150,
    flag: countryMeta.flag || '⚽',
    isFeatured: false,
    active: true,
    metadataSource: 'fallback',
  };
}

/**
 * Robust Canonical Competition Identity Resolver
 * Evaluates provider slug, verified country, and competition title in tandem.
 */
export function resolveCanonicalCompetition(input: {
  competition?: string;
  leagueCode?: string;
  country?: string;
  providerId?: string;
}): CanonicalCompetition {
  const comp = (input.competition || '').trim();
  const compLower = comp.toLowerCase();
  const code = (input.leagueCode || '').toLowerCase().trim();
  const country = (input.country || '').trim();
  const countryLower = country.toLowerCase();
  const provId = (input.providerId || '').toLowerCase().trim();

  // 1. Direct Canonical ID Lookup (Fast-path)
  if (code && CANONICAL_COMPETITIONS[code]) {
    return CANONICAL_COMPETITIONS[code];
  }

  // 2. Direct Provider Slug / Code Match via explicit registry
  if (code && PROVIDER_SLUG_REGISTRY[code]) {
    const targetId = PROVIDER_SLUG_REGISTRY[code];
    if (CANONICAL_COMPETITIONS[targetId]) {
      return CANONICAL_COMPETITIONS[targetId];
    }
  }

  // 3. Match by providerId or providerSlug in CANONICAL_COMPETITIONS
  for (const canon of Object.values(CANONICAL_COMPETITIONS)) {
    if (provId && (canon.providerId === provId || canon.providerSlug === provId)) {
      return canon;
    }
    if (code && canon.providerSlugs.includes(code)) {
      // Disambiguate if code could collide
      if (code === 'premier' && (countryLower.includes('egypt') || countryLower.includes('kenya') || countryLower.includes('russia'))) {
        // foreign premier, skip false match
      } else {
        return canon;
      }
    }
  }

  // 4. UEFA Continental Club Competitions (Multi-national, NEVER domestic)
  if (
    compLower.includes('uefa champions league') ||
    compLower === 'champions league' ||
    provId.includes('uefa-champions-league')
  ) {
    if (compLower.includes('youth')) return CANONICAL_COMPETITIONS.uefa_youth_league;
    if (!compLower.includes('women')) return CANONICAL_COMPETITIONS.uefa_champions_league;
  }
  if (compLower.includes('uefa europa league') || compLower === 'europa league') {
    return CANONICAL_COMPETITIONS.uefa_europa_league;
  }
  if (
    compLower.includes('conference league') ||
    compLower.includes('uefa europa conference') ||
    compLower.includes('uefa conference')
  ) {
    return CANONICAL_COMPETITIONS.uefa_conference_league;
  }
  if (compLower.includes('uefa super cup')) {
    return CANONICAL_COMPETITIONS.uefa_super_cup;
  }
  if (compLower.includes('uefa nations league') || compLower === 'nations league') {
    return CANONICAL_COMPETITIONS.uefa_nations_league;
  }

  // 5. ENGLISH PREMIER LEAGUE - STRICT DISAMBIGUATION
  // Must NOT match foreign "Premier League" competitions (Egypt, Kenya, Russia, Canada, etc.)
  const isForeignPremier =
    countryLower.includes('egypt') ||
    countryLower.includes('kenya') ||
    countryLower.includes('russia') ||
    countryLower.includes('kazakhstan') ||
    countryLower.includes('ghana') ||
    countryLower.includes('south africa') ||
    countryLower.includes('canada') ||
    countryLower.includes('singapore') ||
    countryLower.includes('israel') ||
    countryLower.includes('kuwait') ||
    countryLower.includes('ethiopia') ||
    countryLower.includes('uganda') ||
    compLower.includes('egypt') ||
    compLower.includes('kenya') ||
    compLower.includes('russia') ||
    compLower.includes('kazakhstan') ||
    compLower.includes('ghana') ||
    compLower.includes('south africa') ||
    compLower.includes('canada') ||
    compLower.includes('ethiopia') ||
    compLower.includes('uganda') ||
    compLower.includes('u21') ||
    compLower.includes('u18') ||
    compLower.includes('u23') ||
    compLower.includes('women') ||
    compLower.includes('premier league 2');

  if (!isForeignPremier) {
    if (
      code === 'premier' ||
      code === 'premier-league' ||
      provId.includes('england/premier-league') ||
      compLower === 'premier league' ||
      compLower === 'english premier league' ||
      compLower === 'epl' ||
      ((countryLower === 'england' || countryLower === 'united kingdom') &&
        (compLower.includes('premier') || code === 'premier'))
    ) {
      return CANONICAL_COMPETITIONS.eng_premier_league;
    }
  }

  // 6. SPANISH LA LIGA - STRICT DISAMBIGUATION
  // Must NOT match foreign "Primera Division" competitions (Costa Rica, Chile, Argentina, etc.)
  const isForeignPrimera =
    countryLower.includes('costa rica') ||
    countryLower.includes('chile') ||
    countryLower.includes('argentina') ||
    countryLower.includes('paraguay') ||
    countryLower.includes('uruguay') ||
    countryLower.includes('colombia') ||
    countryLower.includes('bolivia') ||
    countryLower.includes('venezuela') ||
    countryLower.includes('peru') ||
    compLower.includes('costa rica') ||
    compLower.includes('chile') ||
    compLower.includes('argentina') ||
    compLower.includes('paraguay') ||
    compLower.includes('uruguay') ||
    compLower.includes('colombia') ||
    compLower.includes('segunda') ||
    compLower.includes('laliga 2') ||
    compLower.includes('laliga2') ||
    compLower.includes('femenina') ||
    compLower.includes('liga f');

  if (!isForeignPrimera) {
    if (
      code === 'spain1' ||
      code === 'la-liga' ||
      provId.includes('spain/la-liga') ||
      compLower === 'la liga' ||
      compLower === 'laliga' ||
      compLower === 'spanish la liga' ||
      compLower === 'la liga ea sports' ||
      ((countryLower === 'spain' || countryLower === 'espana') &&
        (compLower === 'primera division' || compLower === 'la liga' || compLower.startsWith('laliga')))
    ) {
      return CANONICAL_COMPETITIONS.esp_la_liga;
    }
  }

  if (
    (countryLower === 'spain' || countryLower === 'espana') &&
    (compLower.includes('segunda') || compLower.includes('laliga 2') || code === 'spain2')
  ) {
    return CANONICAL_COMPETITIONS.esp_segunda;
  }

  // 7. BELGIAN PRO LEAGUE - STRICT DISAMBIGUATION
  // Invariant: MUST NOT match foreign "Pro League" competitions (Iran, Saudi, Uzbekistan, Malaysia, etc.)
  const isForeignProLeague =
    code.includes('iran') ||
    code.includes('uzbek') ||
    code.includes('malaysia') ||
    code.includes('saudi') ||
    countryLower === 'iran' ||
    countryLower === 'uzbekistan' ||
    countryLower === 'malaysia' ||
    countryLower === 'saudi arabia' ||
    compLower.includes('iran') ||
    compLower.includes('uzbek') ||
    compLower.includes('malaysia') ||
    compLower.includes('saudi') ||
    compLower.includes('persian gulf');

  if (!isForeignProLeague) {
    if (
      code === 'belgian-pro-league' ||
      code === 'belgium1' ||
      code === 'jupiler-pro-league' ||
      provId === '9vjxm8gh22r6odg' ||
      compLower === 'belgian pro league' ||
      compLower === 'belgium pro league' ||
      compLower === 'jupiler pro league' ||
      ((countryLower === 'belgium' || countryLower === 'belgique') &&
        (compLower.includes('pro league') || compLower === 'first division a' || code === 'belgium1'))
    ) {
      if (!compLower.includes('challenger') && !compLower.includes('division b') && code !== 'belgium2') {
        return CANONICAL_COMPETITIONS.bel_pro_league;
      }
    }
  }

  // Belgian Domestic Cup
  if (
    code === 'belgian-cup' ||
    code === 'belgium-cup' ||
    compLower === 'belgian cup' ||
    compLower === 'croky cup' ||
    (countryLower === 'belgium' && compLower.includes('cup'))
  ) {
    return CANONICAL_COMPETITIONS.bel_cup;
  }

  // 8. IRAN CUPS & LEAGUES
  if (
    code === 'iran-cup' ||
    code === 'hazfi-cup' ||
    compLower.includes('hazfi') ||
    (countryLower === 'iran' && compLower.includes('cup'))
  ) {
    return CANONICAL_COMPETITIONS.irn_cup;
  }

  // IRAN PRO LEAGUE (Persian Gulf Pro League)
  if (
    code === 'iran-pro-league' ||
    code === 'persian-gulf-pro-league' ||
    code === 'iran1' ||
    provId === 'kjw2r09hln4rz84' ||
    compLower === 'iran pro league' ||
    compLower === 'persian gulf pro league' ||
    (compLower.includes('pro league') && compLower.includes('iran')) ||
    (countryLower === 'iran' && (compLower.includes('pro league') || compLower === 'pro league' || compLower.includes('persian gulf') || !compLower))
  ) {
    if (!compLower.includes('azadegan') && !compLower.includes('division 2') && !compLower.includes('u21') && !compLower.includes('cup')) {
      return CANONICAL_COMPETITIONS.irn_pro_league;
    }
  }

  // 9. UZBEKISTAN & MALAYSIA PRO / SEMI-PRO
  if (
    code === 'uzbekistan-pro-league' ||
    compLower.includes('uzbekistan pro') ||
    (countryLower === 'uzbekistan' && (compLower.includes('pro') || compLower === 'pro league'))
  ) {
    return CANONICAL_COMPETITIONS.uzb_pro_league;
  }
  if (
    code === 'malaysia-a1-semi-pro-league' ||
    compLower.includes('malaysia a1') ||
    (countryLower === 'malaysia' && (compLower.includes('semi-pro') || compLower.includes('pro league') || compLower.includes('a1')))
  ) {
    return CANONICAL_COMPETITIONS.mys_a1_semi_pro;
  }

  // 10. SAUDI PRO LEAGUE
  if (code === 'saudi1' || code === 'saudi-pro-league' || compLower.includes('saudi pro') || compLower.includes('roshn')) {
    return CANONICAL_COMPETITIONS.sau_pro_league;
  }

  // 11. Other Top Domestic European
  if (
    code === 'italy1' ||
    code === 'serie-a' ||
    provId.includes('italy/serie-a') ||
    compLower === 'serie a' ||
    compLower === 'italian serie a' ||
    (countryLower === 'italy' && compLower.includes('serie a'))
  ) {
    if (!countryLower.includes('brazil') && !compLower.includes('brazil')) {
      return CANONICAL_COMPETITIONS.ita_serie_a;
    }
  }

  if (
    code === 'germany1' ||
    code === 'bundesliga' ||
    provId.includes('germany/bundesliga') ||
    compLower === 'bundesliga' ||
    compLower === 'german bundesliga' ||
    (countryLower === 'germany' && compLower.includes('bundesliga'))
  ) {
    if (!countryLower.includes('austria') && !compLower.includes('austria')) {
      return CANONICAL_COMPETITIONS.ger_bundesliga;
    }
  }

  if (
    code === 'france1' ||
    code === 'ligue-1' ||
    provId.includes('france/ligue-1') ||
    compLower === 'ligue 1' ||
    compLower === 'french ligue 1' ||
    (countryLower === 'france' && compLower.includes('ligue 1'))
  ) {
    return CANONICAL_COMPETITIONS.fra_ligue_1;
  }

  if (code === 'cha' || compLower === 'championship' || compLower === 'efl championship') {
    return CANONICAL_COMPETITIONS.eng_championship;
  }
  if (code === 'portugal1' || compLower.includes('primeira liga') || compLower.includes('liga portugal')) {
    return CANONICAL_COMPETITIONS.por_primeira_liga;
  }
  if (code === 'holland1' || compLower.includes('eredivisie')) {
    return CANONICAL_COMPETITIONS.ned_eredivisie;
  }
  if (code === 'scot-premier' || compLower.includes('scottish premiership')) {
    return CANONICAL_COMPETITIONS.sco_premiership;
  }
  if (code === 'turkey1' || compLower.includes('super lig') || compLower.includes('süper lig')) {
    return CANONICAL_COMPETITIONS.tur_super_lig;
  }

  // 12. African Leagues
  if (compLower.includes('caf champions league')) {
    return CANONICAL_COMPETITIONS.caf_champions_league;
  }
  if (compLower.includes('caf confederation')) {
    return CANONICAL_COMPETITIONS.caf_confederation_cup;
  }
  if (compLower.includes('caf u20') || compLower.includes('u20 africa cup') || compLower.includes('caf u17') || code === 'caf-u20') {
    return CANONICAL_COMPETITIONS.caf_u20;
  }
  if (code === 'egypt' || code === 'egyptian-premier-league' || (countryLower === 'egypt' && compLower.includes('premier'))) {
    return CANONICAL_COMPETITIONS.egy_premier_league;
  }
  if (code === 'kenya' || code === 'kenyan-premier-league' || (countryLower === 'kenya' && compLower.includes('premier'))) {
    return CANONICAL_COMPETITIONS.ken_premier_league;
  }
  if (countryLower.includes('south africa') && (compLower.includes('prem') || compLower.includes('psl'))) {
    return CANONICAL_COMPETITIONS.rsa_premiership;
  }
  if (code === 'morocco' || compLower.includes('botola')) {
    return CANONICAL_COMPETITIONS.mar_botola_pro;
  }
  if (code === 'ghana-premier-league' || (countryLower === 'ghana' && compLower.includes('premier'))) {
    return CANONICAL_COMPETITIONS.gha_premier_league;
  }
  if (code === 'ethiopia-premier-league' || (countryLower === 'ethiopia' && compLower.includes('premier'))) {
    return CANONICAL_COMPETITIONS.eth_premier_league;
  }
  if (code === 'uganda-premier-league' || (countryLower === 'uganda' && compLower.includes('premier'))) {
    return CANONICAL_COMPETITIONS.uga_premier_league;
  }

  // 13. South American Competitions
  if (compLower.includes('copa libertadores femenino') || code === 'conmebol-copa-libertadores-femenino') {
    return CANONICAL_COMPETITIONS.conmebol_libertadores_femenino;
  }
  if (compLower.includes('libertadores')) {
    return CANONICAL_COMPETITIONS.conmebol_libertadores;
  }
  if (compLower.includes('sudamericana')) {
    return CANONICAL_COMPETITIONS.conmebol_sudamericana;
  }
  if (code === 'brazil1' || compLower.includes('brasileir') || (countryLower === 'brazil' && compLower.includes('serie a'))) {
    return CANONICAL_COMPETITIONS.bra_serie_a;
  }
  if (code === 'argentina1' || compLower.includes('primera división argentina') || (countryLower === 'argentina' && compLower.includes('primera'))) {
    return CANONICAL_COMPETITIONS.arg_primera_division;
  }
  if (code === 'categoria-primera-a' || (countryLower === 'colombia' && compLower.includes('primera'))) {
    return CANONICAL_COMPETITIONS.col_primera_a;
  }
  if (countryLower === 'chile' && compLower.includes('primera')) {
    return CANONICAL_COMPETITIONS.chl_primera_division;
  }
  if (countryLower === 'uruguay' && compLower.includes('primera')) {
    return CANONICAL_COMPETITIONS.ury_primera_division;
  }
  if (countryLower === 'paraguay' && compLower.includes('primera')) {
    return CANONICAL_COMPETITIONS.pry_primera_division;
  }

  // 14. North America
  if (compLower.includes('concacaf champions')) {
    return CANONICAL_COMPETITIONS.concacaf_champions_cup;
  }
  if (code === 'mls' || compLower.includes('major league soccer') || compLower === 'mls') {
    return CANONICAL_COMPETITIONS.usa_mls;
  }
  if (code === 'mexico-liga-mx-femenil' || compLower.includes('liga mx femenil')) {
    return CANONICAL_COMPETITIONS.mex_liga_mx_femenil;
  }
  if (code === 'mexico1' || code === 'mexico-liga-mx' || compLower.includes('liga mx')) {
    return CANONICAL_COMPETITIONS.mex_liga_mx;
  }
  if (code === 'canadian-premier-league' || (countryLower === 'canada' && compLower.includes('premier'))) {
    return CANONICAL_COMPETITIONS.can_premier_league;
  }
  if (code === 'costa-rica-2-liga' || compLower.includes('costa rica 2')) {
    return CANONICAL_COMPETITIONS.cri_segunda_division;
  }
  if (code === 'costa-rica-primera-division' || (countryLower === 'costa rica' && compLower.includes('primera'))) {
    return CANONICAL_COMPETITIONS.cri_primera_division;
  }

  // 15. Other Specific Competitions
  if (countryLower === 'russia' && compLower.includes('premier')) {
    return CANONICAL_COMPETITIONS.rus_premier_league;
  }
  if (countryLower === 'kazakhstan' && compLower.includes('premier')) {
    return CANONICAL_COMPETITIONS.kaz_premier_league;
  }
  if (code === 'japanese-j1-league' || (countryLower === 'japan' && compLower.includes('j1'))) {
    return CANONICAL_COMPETITIONS.jpn_j1_league;
  }
  if (code === 'thai-fa-cup' || compLower.includes('thai fa cup')) {
    return CANONICAL_COMPETITIONS.tha_fa_cup;
  }

  // Safe Fallback: NEVER guess into a top flight league without verified metadata
  return getUnclassifiedCompetition(comp || code || 'Other Competition', country, code);
}
