/**
 * Canonical Football Competition Registry & Identity Resolver
 * 
 * Enforces strict, verified competition identity.
 * CRITICAL IDENTITY INVARIANTS:
 * 1. Never identify a competition using loose name alone.
 * 2. Provider ID/slug, country, and competition type are evaluated together.
 * 3. Never treat foreign "Premier League" competitions (Egypt, Kenya, Russia, etc.) as the English Premier League.
 * 4. Never treat foreign "Primera Division" competitions (Costa Rica, Chile, Argentina, etc.) as Spanish La Liga.
 * 5. Priority ranking is strictly separated from competition classification.
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
  | 'domestic_league'
  | 'domestic_cup'
  | 'continental_club'
  | 'international'
  | 'other';

export interface CanonicalCompetition {
  id: string; // Stable internal ID e.g. 'eng_premier_league'
  name: string; // Standard display name e.g. 'English Premier League'
  country: string; // e.g. 'England'
  continent: ContinentId;
  type: CompetitionType;
  tier: number; // 1 = Top division, 2 = Second division, etc.
  rank: number; // Directory ranking within continent
  priorityRank: number; // Lower number = higher prestige/priority
  prestigeScore: number; // 1000-point prestige score
  flag: string; // Emoji flag or icon
  providerSlugs: string[]; // Known provider slugs/codes e.g. ['premier', 'england/premier-league']
}

export const CANONICAL_COMPETITIONS: Record<string, CanonicalCompetition> = {
  // --- European Club Competitions (UEFA) ---
  uefa_champions_league: {
    id: 'uefa_champions_league',
    name: 'UEFA Champions League',
    country: 'Europe',
    continent: 'european_competitions',
    type: 'continental_club',
    tier: 1,
    rank: 1,
    priorityRank: 10,
    prestigeScore: 1000,
    flag: '🏆',
    providerSlugs: ['uefa-champions-league', 'champions-league', 'ucl'],
  },
  uefa_europa_league: {
    id: 'uefa_europa_league',
    name: 'UEFA Europa League',
    country: 'Europe',
    continent: 'european_competitions',
    type: 'continental_club',
    tier: 2,
    rank: 2,
    priorityRank: 20,
    prestigeScore: 800,
    flag: '🏆',
    providerSlugs: ['uefa-europa-league', 'europa-league', 'uel'],
  },
  uefa_conference_league: {
    id: 'uefa_conference_league',
    name: 'UEFA Conference League',
    country: 'Europe',
    continent: 'european_competitions',
    type: 'continental_club',
    tier: 3,
    rank: 3,
    priorityRank: 30,
    prestigeScore: 800,
    flag: '🏆',
    providerSlugs: ['uefa-conference-league', 'uefa-europa-conference-league', 'conference-league', 'uecl'],
  },
  uefa_super_cup: {
    id: 'uefa_super_cup',
    name: 'UEFA Super Cup',
    country: 'Europe',
    continent: 'european_competitions',
    type: 'continental_club',
    tier: 1,
    rank: 4,
    priorityRank: 40,
    prestigeScore: 800,
    flag: '🏆',
    providerSlugs: ['uefa-super-cup'],
  },
  uefa_youth_league: {
    id: 'uefa_youth_league',
    name: 'UEFA Youth League',
    country: 'Europe',
    continent: 'european_competitions',
    type: 'continental_club',
    tier: 9,
    rank: 5,
    priorityRank: 90,
    prestigeScore: 500,
    flag: '🏆',
    providerSlugs: ['uefa-youth-league'],
  },
  uefa_nations_league: {
    id: 'uefa_nations_league',
    name: 'UEFA Nations League',
    country: 'Europe',
    continent: 'european_competitions',
    type: 'international',
    tier: 1,
    rank: 6,
    priorityRank: 50,
    prestigeScore: 800,
    flag: '🇪🇺',
    providerSlugs: ['uefa-nations-league', 'nations-league'],
  },

  // --- Top 5 European Domestic Leagues (Tier 1) ---
  eng_premier_league: {
    id: 'eng_premier_league',
    name: 'English Premier League',
    country: 'England',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 1,
    priorityRank: 100,
    prestigeScore: 700,
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    providerSlugs: ['premier', 'england/premier-league', 'premier-league'],
  },
  esp_la_liga: {
    id: 'esp_la_liga',
    name: 'Spanish La Liga',
    country: 'Spain',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 2,
    priorityRank: 110,
    prestigeScore: 700,
    flag: '🇪🇸',
    providerSlugs: ['spain1', 'la-liga', 'laliga', 'spain/la-liga'],
  },
  ita_serie_a: {
    id: 'ita_serie_a',
    name: 'Italian Serie A',
    country: 'Italy',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 3,
    priorityRank: 120,
    prestigeScore: 700,
    flag: '🇮🇹',
    providerSlugs: ['italy1', 'serie-a', 'italy/serie-a'],
  },
  ger_bundesliga: {
    id: 'ger_bundesliga',
    name: 'German Bundesliga',
    country: 'Germany',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 4,
    priorityRank: 130,
    prestigeScore: 700,
    flag: '🇩🇪',
    providerSlugs: ['germany1', 'bundesliga', 'germany/bundesliga'],
  },
  fra_ligue_1: {
    id: 'fra_ligue_1',
    name: 'French Ligue 1',
    country: 'France',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 5,
    priorityRank: 140,
    prestigeScore: 700,
    flag: '🇫🇷',
    providerSlugs: ['france1', 'ligue-1', 'france/ligue-1'],
  },

  // --- Other European Top Flights & Secondary Tiers ---
  eng_championship: {
    id: 'eng_championship',
    name: 'English Championship',
    country: 'England',
    continent: 'europe',
    type: 'domestic_league',
    tier: 2,
    rank: 8,
    priorityRank: 200,
    prestigeScore: 600,
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    providerSlugs: ['cha', 'championship', 'england/championship'],
  },
  esp_segunda: {
    id: 'esp_segunda',
    name: 'Spanish LaLiga 2',
    country: 'Spain',
    continent: 'europe',
    type: 'domestic_league',
    tier: 2,
    rank: 12,
    priorityRank: 210,
    prestigeScore: 300,
    flag: '🇪🇸',
    providerSlugs: ['spain2', 'laliga2', 'segunda-division'],
  },
  por_primeira_liga: {
    id: 'por_primeira_liga',
    name: 'Portuguese Primeira Liga',
    country: 'Portugal',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 6,
    priorityRank: 150,
    prestigeScore: 600,
    flag: '🇵🇹',
    providerSlugs: ['portugal1', 'primeira-liga', 'liga-portugal'],
  },
  ned_eredivisie: {
    id: 'ned_eredivisie',
    name: 'Dutch Eredivisie',
    country: 'Netherlands',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 7,
    priorityRank: 160,
    prestigeScore: 600,
    flag: '🇳🇱',
    providerSlugs: ['holland1', 'eredivisie', 'netherlands/eredivisie'],
  },
  sco_premiership: {
    id: 'sco_premiership',
    name: 'Scottish Premiership',
    country: 'Scotland',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 9,
    priorityRank: 170,
    prestigeScore: 600,
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    providerSlugs: ['scot-premier', 'scottish-premiership'],
  },
  tur_super_lig: {
    id: 'tur_super_lig',
    name: 'Turkish Süper Lig',
    country: 'Turkey',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 10,
    priorityRank: 180,
    prestigeScore: 600,
    flag: '🇹🇷',
    providerSlugs: ['turkey1', 'super-lig'],
  },
  bel_pro_league: {
    id: 'bel_pro_league',
    name: 'Belgian Pro League',
    country: 'Belgium',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 11,
    priorityRank: 190,
    prestigeScore: 600,
    flag: '🇧🇪',
    providerSlugs: ['belgium1', 'belgian-pro-league'],
  },
  rus_premier_league: {
    id: 'rus_premier_league',
    name: 'Russian Premier League',
    country: 'Russia',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 14,
    priorityRank: 220,
    prestigeScore: 600,
    flag: '🇷🇺',
    providerSlugs: ['russia1', 'russian-premier-league'],
  },
  kaz_premier_league: {
    id: 'kaz_premier_league',
    name: 'Kazakhstan Premier League',
    country: 'Kazakhstan',
    continent: 'europe',
    type: 'domestic_league',
    tier: 1,
    rank: 15,
    priorityRank: 230,
    prestigeScore: 400,
    flag: '🇰🇿',
    providerSlugs: ['kazakhstan-premier-league'],
  },

  // --- South America ---
  conmebol_libertadores: {
    id: 'conmebol_libertadores',
    name: 'CONMEBOL Libertadores',
    country: 'South America',
    continent: 'south_america',
    type: 'continental_club',
    tier: 1,
    rank: 1,
    priorityRank: 70,
    prestigeScore: 600,
    flag: '🌎',
    providerSlugs: ['copa-libertadores', 'libertadores'],
  },
  conmebol_sudamericana: {
    id: 'conmebol_sudamericana',
    name: 'CONMEBOL Sudamericana',
    country: 'South America',
    continent: 'south_america',
    type: 'continental_club',
    tier: 2,
    rank: 2,
    priorityRank: 80,
    prestigeScore: 600,
    flag: '🌎',
    providerSlugs: ['copa-sudamericana', 'sudamericana'],
  },
  bra_serie_a: {
    id: 'bra_serie_a',
    name: 'Brasileirão Série A',
    country: 'Brazil',
    continent: 'south_america',
    type: 'domestic_league',
    tier: 1,
    rank: 3,
    priorityRank: 145,
    prestigeScore: 600,
    flag: '🇧🇷',
    providerSlugs: ['brazil1', 'brasileirao', 'serie-a-brazil'],
  },
  arg_primera_division: {
    id: 'arg_primera_division',
    name: 'Argentine Primera División',
    country: 'Argentina',
    continent: 'south_america',
    type: 'domestic_league',
    tier: 1,
    rank: 4,
    priorityRank: 165,
    prestigeScore: 600,
    flag: '🇦🇷',
    providerSlugs: ['argentina1', 'primera-division-argentina', 'liga-profesional-argentina'],
  },
  chl_primera_division: {
    id: 'chl_primera_division',
    name: 'Chilean Primera División',
    country: 'Chile',
    continent: 'south_america',
    type: 'domestic_league',
    tier: 1,
    rank: 5,
    priorityRank: 250,
    prestigeScore: 400,
    flag: '🇨🇱',
    providerSlugs: ['chile1', 'chilean-primera-division'],
  },
  col_primera_a: {
    id: 'col_primera_a',
    name: 'Colombian Primera A',
    country: 'Colombia',
    continent: 'south_america',
    type: 'domestic_league',
    tier: 1,
    rank: 6,
    priorityRank: 255,
    prestigeScore: 400,
    flag: '🇨🇴',
    providerSlugs: ['colombia1', 'colombian-primera-a'],
  },
  ury_primera_division: {
    id: 'ury_primera_division',
    name: 'Uruguayan Primera División',
    country: 'Uruguay',
    continent: 'south_america',
    type: 'domestic_league',
    tier: 1,
    rank: 7,
    priorityRank: 260,
    prestigeScore: 400,
    flag: '🇺🇾',
    providerSlugs: ['uruguay-primera-division'],
  },
  pry_primera_division: {
    id: 'pry_primera_division',
    name: 'Paraguayan Primera División',
    country: 'Paraguay',
    continent: 'south_america',
    type: 'domestic_league',
    tier: 1,
    rank: 8,
    priorityRank: 265,
    prestigeScore: 400,
    flag: '🇵🇾',
    providerSlugs: ['paraguay-primera-division'],
  },

  // --- Africa ---
  caf_champions_league: {
    id: 'caf_champions_league',
    name: 'CAF Champions League',
    country: 'Africa',
    continent: 'africa',
    type: 'continental_club',
    tier: 1,
    rank: 1,
    priorityRank: 75,
    prestigeScore: 600,
    flag: '🌍',
    providerSlugs: ['caf-champions-league'],
  },
  caf_confederation_cup: {
    id: 'caf_confederation_cup',
    name: 'CAF Confederation Cup',
    country: 'Africa',
    continent: 'africa',
    type: 'continental_club',
    tier: 2,
    rank: 2,
    priorityRank: 85,
    prestigeScore: 600,
    flag: '🌍',
    providerSlugs: ['caf-confederation-cup', 'caf-confed'],
  },
  egy_premier_league: {
    id: 'egy_premier_league',
    name: 'Egyptian Premier League',
    country: 'Egypt',
    continent: 'africa',
    type: 'domestic_league',
    tier: 1,
    rank: 3,
    priorityRank: 240,
    prestigeScore: 400,
    flag: '🇪🇬',
    providerSlugs: ['egypt', 'egyptian-premier-league'],
  },
  ken_premier_league: {
    id: 'ken_premier_league',
    name: 'Kenyan Premier League',
    country: 'Kenya',
    continent: 'africa',
    type: 'domestic_league',
    tier: 1,
    rank: 6,
    priorityRank: 245,
    prestigeScore: 400,
    flag: '🇰🇪',
    providerSlugs: ['kenya', 'kenyan-premier-league', 'fkf-premier-league'],
  },
  rsa_premiership: {
    id: 'rsa_premiership',
    name: 'South African Premier Division',
    country: 'South Africa',
    continent: 'africa',
    type: 'domestic_league',
    tier: 1,
    rank: 4,
    priorityRank: 248,
    prestigeScore: 400,
    flag: '🇿🇦',
    providerSlugs: ['south-africa-premier', 'dstv-premiership', 'psl'],
  },
  mar_botola_pro: {
    id: 'mar_botola_pro',
    name: 'Moroccan Botola Pro',
    country: 'Morocco',
    continent: 'africa',
    type: 'domestic_league',
    tier: 1,
    rank: 5,
    priorityRank: 249,
    prestigeScore: 400,
    flag: '🇲🇦',
    providerSlugs: ['morocco', 'botola-pro'],
  },
  gha_premier_league: {
    id: 'gha_premier_league',
    name: 'Ghana Premier League',
    country: 'Ghana',
    continent: 'africa',
    type: 'domestic_league',
    tier: 1,
    rank: 7,
    priorityRank: 252,
    prestigeScore: 400,
    flag: '🇬🇭',
    providerSlugs: ['ghana-premier-league'],
  },

  // --- North America & Central America ---
  concacaf_champions_cup: {
    id: 'concacaf_champions_cup',
    name: 'CONCACAF Champions Cup',
    country: 'North America',
    continent: 'north_america',
    type: 'continental_club',
    tier: 1,
    rank: 1,
    priorityRank: 95,
    prestigeScore: 600,
    flag: '🌎',
    providerSlugs: ['concacaf-champions', 'concacaf-champions-cup'],
  },
  usa_mls: {
    id: 'usa_mls',
    name: 'Major League Soccer (MLS)',
    country: 'United States',
    continent: 'north_america',
    type: 'domestic_league',
    tier: 1,
    rank: 2,
    priorityRank: 175,
    prestigeScore: 600,
    flag: '🇺🇸',
    providerSlugs: ['mls', 'major-league-soccer'],
  },
  mex_liga_mx: {
    id: 'mex_liga_mx',
    name: 'Mexican Liga MX',
    country: 'Mexico',
    continent: 'north_america',
    type: 'domestic_league',
    tier: 1,
    rank: 3,
    priorityRank: 178,
    prestigeScore: 600,
    flag: '🇲🇽',
    providerSlugs: ['liga-mx', 'mexico1'],
  },
  can_premier_league: {
    id: 'can_premier_league',
    name: 'Canadian Premier League',
    country: 'Canada',
    continent: 'north_america',
    type: 'domestic_league',
    tier: 1,
    rank: 4,
    priorityRank: 270,
    prestigeScore: 400,
    flag: '🇨🇦',
    providerSlugs: ['canadian-premier-league'],
  },
  cri_primera_division: {
    id: 'cri_primera_division',
    name: 'Costa Rican Primera División',
    country: 'Costa Rica',
    continent: 'north_america',
    type: 'domestic_league',
    tier: 1,
    rank: 5,
    priorityRank: 275,
    prestigeScore: 400,
    flag: '🇨🇷',
    providerSlugs: ['costa-rica-primera-division'],
  },

  // --- Asia ---
  afc_champions_league: {
    id: 'afc_champions_league',
    name: 'AFC Champions League',
    country: 'Asia',
    continent: 'asia',
    type: 'continental_club',
    tier: 1,
    rank: 1,
    priorityRank: 92,
    prestigeScore: 600,
    flag: '🌏',
    providerSlugs: ['afc-champions-league', 'afc-elite'],
  },
  sau_pro_league: {
    id: 'sau_pro_league',
    name: 'Saudi Pro League',
    country: 'Saudi Arabia',
    continent: 'asia',
    type: 'domestic_league',
    tier: 1,
    rank: 2,
    priorityRank: 185,
    prestigeScore: 600,
    flag: '🇸🇦',
    providerSlugs: ['saudi1', 'saudi-pro-league', 'roshn-saudi'],
  },
  jpn_j1_league: {
    id: 'jpn_j1_league',
    name: 'Japanese J1 League',
    country: 'Japan',
    continent: 'asia',
    type: 'domestic_league',
    tier: 1,
    rank: 3,
    priorityRank: 195,
    prestigeScore: 600,
    flag: '🇯🇵',
    providerSlugs: ['j1-league', 'japan1'],
  },

  // --- Oceania ---
  aus_a_league: {
    id: 'aus_a_league',
    name: 'Australian A-League',
    country: 'Australia',
    continent: 'oceania',
    type: 'domestic_league',
    tier: 1,
    rank: 1,
    priorityRank: 280,
    prestigeScore: 500,
    flag: '🇦🇺',
    providerSlugs: ['a-league', 'australian-a-league'],
  },

  // --- International / FIFA ---
  fifa_world_cup: {
    id: 'fifa_world_cup',
    name: 'FIFA World Cup',
    country: 'International',
    continent: 'international',
    type: 'international',
    tier: 1,
    rank: 1,
    priorityRank: 1,
    prestigeScore: 900,
    flag: '🌐',
    providerSlugs: ['world-cup', 'fifa-world-cup'],
  },
  international_friendly: {
    id: 'international_friendly',
    name: 'International Friendlies',
    country: 'International',
    continent: 'international',
    type: 'international',
    tier: 2,
    rank: 2,
    priorityRank: 60,
    prestigeScore: 500,
    flag: '🌐',
    providerSlugs: ['international-friendly', 'friendlies'],
  },
};

/**
 * Resolved fallback competition for unclassified or unrecognized matches
 */
export function getUnclassifiedCompetition(name: string, country?: string): CanonicalCompetition {
  const normName = name || 'Other Competition';
  const normCountry = country || 'International';

  let continent: ContinentId = 'international';
  const cLower = normCountry.toLowerCase();
  const nLower = normName.toLowerCase();

  if (nLower.includes('uefa') || nLower.includes('champions league') || nLower.includes('europa') || nLower.includes('conference league')) {
    continent = 'european_competitions';
  } else if (nLower.includes('caf') || nLower.includes('africa') || ['egypt', 'kenya', 'morocco', 'south africa', 'ghana', 'nigeria', 'algeria', 'tunisia', 'senegal', 'tanzania', 'uganda', 'zambia', 'cameroon', 'ivory coast'].some((k) => cLower.includes(k))) {
    continent = 'africa';
  } else if (nLower.includes('conmebol') || nLower.includes('copa') || ['brazil', 'argentina', 'colombia', 'chile', 'uruguay', 'paraguay', 'peru', 'ecuador', 'bolivia', 'venezuela'].some((k) => cLower.includes(k))) {
    continent = 'south_america';
  } else if (nLower.includes('concacaf') || ['usa', 'united states', 'mexico', 'canada', 'costa rica', 'panama', 'jamaica', 'honduras'].some((k) => cLower.includes(k))) {
    continent = 'north_america';
  } else if (nLower.includes('afc') || nLower.includes('asia') || ['saudi arabia', 'japan', 'korea', 'china', 'india', 'qatar', 'uae', 'indonesia', 'malaysia', 'thailand', 'vietnam', 'myanmar'].some((k) => cLower.includes(k))) {
    continent = 'asia';
  } else if (nLower.includes('ofc') || ['australia', 'new zealand'].some((k) => cLower.includes(k))) {
    continent = 'oceania';
  } else if (['england', 'spain', 'italy', 'germany', 'france', 'portugal', 'netherlands', 'scotland', 'turkey', 'belgium', 'europe', 'greece', 'poland', 'norway', 'sweden', 'denmark', 'switzerland', 'austria', 'croatia', 'ukraine', 'czechia'].some((k) => cLower.includes(k))) {
    continent = 'europe';
  }

  let prestigeScore = 150;
  if (/caf.*(?:u17|u19|u20|u21|u23|youth)|(?:u17|u19|u20|u21|u23).*caf/i.test(nLower) || /concacaf.*(?:u17|u20)|afc.*(?:u17|u20|u23)/i.test(nLower)) {
    prestigeScore = 250;
  }

  return {
    id: `unclassified_${normName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    name: normName,
    country: normCountry,
    continent,
    type: 'other',
    tier: 9,
    rank: 99,
    priorityRank: 999,
    prestigeScore,
    flag: '⚽',
    providerSlugs: [],
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

  // 1. Direct provider slug / code match
  if (code) {
    for (const canon of Object.values(CANONICAL_COMPETITIONS)) {
      if (canon.providerSlugs.includes(code)) {
        // Disambiguate if code could collide
        if (code === 'premier' && (countryLower.includes('egypt') || countryLower.includes('kenya'))) {
          // ignore false code match
        } else {
          return canon;
        }
      }
    }
  }

  // 2. UEFA Continental Club Competitions
  if (
    compLower.includes('uefa champions league') ||
    compLower === 'champions league' ||
    provId.includes('uefa-champions-league')
  ) {
    if (!compLower.includes('women') && !compLower.includes('youth')) {
      return CANONICAL_COMPETITIONS.uefa_champions_league;
    }
    if (compLower.includes('youth')) {
      return CANONICAL_COMPETITIONS.uefa_youth_league;
    }
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

  // 3. ENGLISH PREMIER LEAGUE - STRICT DISAMBIGUATION
  // Invariant: MUST NOT match Egyptian, Kenyan, Russian, Kazakhstan, Canadian, etc.
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
    compLower.includes('egypt') ||
    compLower.includes('kenya') ||
    compLower.includes('russia') ||
    compLower.includes('kazakhstan') ||
    compLower.includes('ghana') ||
    compLower.includes('south africa') ||
    compLower.includes('canada') ||
    compLower.includes('singapore') ||
    compLower.includes('israel') ||
    compLower.includes('kuwait') ||
    compLower.includes('u21') ||
    compLower.includes('u18') ||
    compLower.includes('u23') ||
    compLower.includes('women') ||
    compLower.includes('premier league 2') ||
    compLower.includes('league 2');

  if (!isForeignPremier) {
    if (
      code === 'premier' ||
      provId.includes('england/premier-league') ||
      provId.includes('premier-league') ||
      compLower === 'premier league' ||
      compLower === 'english premier league' ||
      compLower === 'epl' ||
      ((countryLower === 'england' || countryLower === 'united kingdom') &&
        (compLower.includes('premier') || code === 'premier'))
    ) {
      return CANONICAL_COMPETITIONS.eng_premier_league;
    }
  }

  // 4. SPANISH LA LIGA - STRICT DISAMBIGUATION
  // Invariant: MUST NOT match Costa Rica, Chile, Argentina, Paraguay, Uruguay Primera Division, or LaLiga 2
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
    compLower.includes('rfef') ||
    compLower.includes('femenina') ||
    compLower.includes('liga f');

  if (!isForeignPrimera) {
    if (
      code === 'spain1' ||
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

  // Check Spanish Segunda
  if (
    (countryLower === 'spain' || countryLower === 'espana') &&
    (compLower.includes('segunda') || compLower.includes('laliga 2') || compLower.includes('laliga2') || code === 'spain2')
  ) {
    return CANONICAL_COMPETITIONS.esp_segunda;
  }

  // 5. Other Top 5 Domestic
  if (
    code === 'italy1' ||
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
    provId.includes('france/ligue-1') ||
    compLower === 'ligue 1' ||
    compLower === 'french ligue 1' ||
    (countryLower === 'france' && compLower.includes('ligue 1'))
  ) {
    return CANONICAL_COMPETITIONS.fra_ligue_1;
  }

  // English Championship
  if (
    code === 'cha' ||
    provId.includes('championship') ||
    compLower === 'championship' ||
    compLower === 'efl championship' ||
    (countryLower === 'england' && compLower.includes('championship'))
  ) {
    return CANONICAL_COMPETITIONS.eng_championship;
  }

  // Portuguese & Dutch
  if (code === 'portugal1' || compLower.includes('primeira liga') || compLower.includes('liga portugal')) {
    return CANONICAL_COMPETITIONS.por_primeira_liga;
  }
  if (code === 'holland1' || compLower.includes('eredivisie')) {
    return CANONICAL_COMPETITIONS.ned_eredivisie;
  }

  // Scottish, Turkish, Belgian
  if (code === 'scot-premier' || compLower.includes('scottish premiership')) {
    return CANONICAL_COMPETITIONS.sco_premiership;
  }
  if (code === 'turkey1' || compLower.includes('super lig') || compLower.includes('süper lig')) {
    return CANONICAL_COMPETITIONS.tur_super_lig;
  }
  if (code === 'belgium1' || compLower.includes('pro league') || compLower.includes('belgian pro')) {
    return CANONICAL_COMPETITIONS.bel_pro_league;
  }

  // 6. African Leagues
  if (compLower.includes('caf champions league')) {
    return CANONICAL_COMPETITIONS.caf_champions_league;
  }
  if (compLower.includes('caf confederation')) {
    return CANONICAL_COMPETITIONS.caf_confederation_cup;
  }
  if (code === 'egypt' || countryLower === 'egypt' || compLower.includes('egyptian premier')) {
    return CANONICAL_COMPETITIONS.egy_premier_league;
  }
  if (code === 'kenya' || countryLower === 'kenya' || compLower.includes('kenyan premier') || compLower.includes('fkf')) {
    return CANONICAL_COMPETITIONS.ken_premier_league;
  }
  if (countryLower.includes('south africa') || compLower.includes('dstv prem') || compLower.includes('south african premier')) {
    return CANONICAL_COMPETITIONS.rsa_premiership;
  }
  if (code === 'morocco' || countryLower === 'morocco' || compLower.includes('botola')) {
    return CANONICAL_COMPETITIONS.mar_botola_pro;
  }
  if (countryLower === 'ghana' || compLower.includes('ghana premier')) {
    return CANONICAL_COMPETITIONS.gha_premier_league;
  }

  // 7. South American Competitions
  if (compLower.includes('libertadores')) {
    return CANONICAL_COMPETITIONS.conmebol_libertadores;
  }
  if (compLower.includes('sudamericana')) {
    return CANONICAL_COMPETITIONS.conmebol_sudamericana;
  }
  if (code === 'brazil1' || countryLower === 'brazil' || compLower.includes('brasileir') || compLower.includes('serie a brazil')) {
    return CANONICAL_COMPETITIONS.bra_serie_a;
  }
  if (code === 'argentina1' || countryLower === 'argentina' || compLower.includes('primera división argentina') || compLower.includes('liga profesional argentina')) {
    return CANONICAL_COMPETITIONS.arg_primera_division;
  }
  if (countryLower === 'chile' || compLower.includes('chilean primera')) {
    return CANONICAL_COMPETITIONS.chl_primera_division;
  }
  if (countryLower === 'colombia' || compLower.includes('primera a colombia') || compLower.includes('liga betplay')) {
    return CANONICAL_COMPETITIONS.col_primera_a;
  }
  if (countryLower === 'uruguay' || compLower.includes('uruguayan primera')) {
    return CANONICAL_COMPETITIONS.ury_primera_division;
  }
  if (countryLower === 'paraguay' || compLower.includes('paraguayan primera')) {
    return CANONICAL_COMPETITIONS.pry_primera_division;
  }

  // 8. North America
  if (compLower.includes('concacaf champions')) {
    return CANONICAL_COMPETITIONS.concacaf_champions_cup;
  }
  if (code === 'mls' || compLower.includes('major league soccer') || compLower === 'mls') {
    return CANONICAL_COMPETITIONS.usa_mls;
  }
  if (code === 'mexico1' || compLower.includes('liga mx')) {
    return CANONICAL_COMPETITIONS.mex_liga_mx;
  }
  if (countryLower === 'canada' || compLower.includes('canadian premier')) {
    return CANONICAL_COMPETITIONS.can_premier_league;
  }
  if (countryLower === 'costa rica' || compLower.includes('costa rica')) {
    return CANONICAL_COMPETITIONS.cri_primera_division;
  }

  // 9. Asia & Oceania
  if (compLower.includes('afc champions') || compLower.includes('afc elite')) {
    return CANONICAL_COMPETITIONS.afc_champions_league;
  }
  if (code === 'saudi1' || compLower.includes('saudi pro') || compLower.includes('roshn')) {
    return CANONICAL_COMPETITIONS.sau_pro_league;
  }
  if (code === 'japan1' || compLower.includes('j1 league') || compLower.includes('j-league')) {
    return CANONICAL_COMPETITIONS.jpn_j1_league;
  }
  if (compLower.includes('a-league') || compLower.includes('australian a-league')) {
    return CANONICAL_COMPETITIONS.aus_a_league;
  }

  // 10. Other specific leagues
  if (countryLower === 'russia' || compLower.includes('russian premier')) {
    return CANONICAL_COMPETITIONS.rus_premier_league;
  }
  if (countryLower === 'kazakhstan' || compLower.includes('kazakhstan premier')) {
    return CANONICAL_COMPETITIONS.kaz_premier_league;
  }

  // Safe Fallback: do NOT guess into top flight leagues
  return getUnclassifiedCompetition(comp || code || 'Other Competition', country);
}
