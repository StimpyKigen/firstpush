import {
  type ContinentId,
  type CompetitionType,
  type CanonicalCompetition,
  CANONICAL_COMPETITIONS,
  resolveCanonicalCompetition,
  getCountryMeta,
} from './canonicalCompetitions';

export { type ContinentId, type CompetitionType, getCountryMeta, type CountryMeta } from './canonicalCompetitions';

export interface ContinentMeta {
  id: ContinentId;
  name: string;
  flag: string;
  order: number;
}

export const CONTINENTS: ContinentMeta[] = [
  { id: 'all', name: 'All Continents & Leagues', flag: '🌍', order: 0 },
  { id: 'european_competitions', name: 'European Competitions (UEFA)', flag: '🏆', order: 1 },
  { id: 'europe', name: 'European Domestic Leagues', flag: '🇪🇺', order: 2 },
  { id: 'south_america', name: 'South America', flag: '🌎', order: 3 },
  { id: 'africa', name: 'Africa', flag: '🌍', order: 4 },
  { id: 'asia', name: 'Asia & Middle East', flag: '🌏', order: 5 },
  { id: 'north_america', name: 'North & Central America', flag: '🌎', order: 6 },
  { id: 'international', name: 'International & FIFA', flag: '🌐', order: 7 },
  { id: 'oceania', name: 'Oceania', flag: '🌏', order: 8 },
];

export function getCompetitionTypeLabel(type: CompetitionType): string {
  switch (type) {
    case 'domestic_league':
      return 'Top Division';
    case 'lower_division':
      return 'Lower Tier';
    case 'domestic_cup':
      return 'Cup';
    case 'super_cup':
      return 'Super Cup';
    case 'continental_club':
      return 'Continental';
    case 'international':
      return 'International';
    case 'women':
      return 'Women';
    case 'youth':
      return 'Youth';
    case 'reserve_amateur':
      return 'Amateur';
    default:
      return '';
  }
}

export interface LeagueMetadataResult {
  canonicalId: string;
  standardName: string;
  country: string;
  countryCode: string;
  countryName: string;
  continent: ContinentId;
  competitionType: CompetitionType;
  typeLabel: string;
  rank: number;
  flag: string;
}

/**
 * Returns verified league metadata powered by the Canonical Competition Identity System.
 */
export function getLeagueMetadata(
  competition: string,
  country?: string,
  leagueCode?: string,
  competitionId?: string
): LeagueMetadataResult {
  // If a verified canonical ID is already supplied, look it up directly
  if (competitionId && CANONICAL_COMPETITIONS[competitionId]) {
    const canon = CANONICAL_COMPETITIONS[competitionId];
    return {
      canonicalId: canon.id,
      standardName: canon.name,
      country: canon.countryName || canon.country,
      countryCode: canon.countryCode,
      countryName: canon.countryName || canon.country,
      continent: canon.continent,
      competitionType: canon.competitionType || canon.type,
      typeLabel: getCompetitionTypeLabel(canon.competitionType || canon.type),
      rank: canon.rank ?? canon.priorityRank,
      flag: canon.flag,
    };
  }

  // Resolve canonical identity from provider competition, country, and league code
  const resolved: CanonicalCompetition = resolveCanonicalCompetition({
    competition,
    country,
    leagueCode,
  });

  return {
    canonicalId: resolved.id,
    standardName: resolved.name,
    country: resolved.countryName || resolved.country,
    countryCode: resolved.countryCode,
    countryName: resolved.countryName || resolved.country,
    continent: resolved.continent,
    competitionType: resolved.competitionType || resolved.type,
    typeLabel: getCompetitionTypeLabel(resolved.competitionType || resolved.type),
    rank: resolved.rank ?? resolved.priorityRank,
    flag: resolved.flag,
  };
}

export interface DirectoryCompetitionItem {
  id: string;
  name: string;
  competitionType: CompetitionType;
  typeLabel: string;
  count: number;
  rank: number;
  flag: string;
  countryName: string;
}

export interface DirectoryCountryGroup {
  countryName: string;
  countryCode: string;
  flag: string;
  totalCount: number;
  competitions: DirectoryCompetitionItem[];
}

export interface DirectoryContinentGroup {
  id: ContinentId;
  name: string;
  flag: string;
  totalCount: number;
  countries: DirectoryCountryGroup[];
  competitions: DirectoryCompetitionItem[]; // Flat list for quick continent filtering
}

export interface HierarchicalDirectory {
  featured: DirectoryCompetitionItem[];
  international: DirectoryCompetitionItem[];
  continents: DirectoryContinentGroup[];
}

/**
 * Builds the SportScore-aligned country & competition directory hierarchy
 */
export function buildHierarchicalDirectory(
  fixtures: Array<{ competition: string; country?: string; leagueCode?: string; competitionId?: string }>
): HierarchicalDirectory {
  // Map Continent -> Country -> Competition -> Count
  const continentData = new Map<
    ContinentId,
    Map<string, { countryMeta: ReturnType<typeof getCountryMeta>; comps: Map<string, DirectoryCompetitionItem> }>
  >();

  for (const c of CONTINENTS) {
    if (c.id !== 'all') {
      continentData.set(c.id, new Map());
    }
  }

  const featuredMap = new Map<string, DirectoryCompetitionItem>();
  const internationalMap = new Map<string, DirectoryCompetitionItem>();

  fixtures.forEach((f) => {
    const meta = getLeagueMetadata(f.competition, f.country, f.leagueCode, f.competitionId);
    const canon = CANONICAL_COMPETITIONS[meta.canonicalId];
    const cMeta = getCountryMeta(meta.countryName || meta.country);

    // Check if Featured
    if (canon?.isFeatured) {
      const existingF = featuredMap.get(meta.canonicalId) || {
        id: meta.canonicalId,
        name: meta.standardName,
        competitionType: meta.competitionType,
        typeLabel: meta.typeLabel,
        count: 0,
        rank: canon.priorityRank || 999,
        flag: canon.flag || meta.flag,
        countryName: canon.countryName || cMeta.name,
      };
      existingF.count++;
      featuredMap.set(meta.canonicalId, existingF);
    }

    // Check if International / Continental club competition
    if (meta.continent === 'european_competitions' || meta.continent === 'international' || meta.competitionType === 'continental_club' || meta.competitionType === 'international') {
      const existingI = internationalMap.get(meta.canonicalId) || {
        id: meta.canonicalId,
        name: meta.standardName,
        competitionType: meta.competitionType,
        typeLabel: meta.typeLabel,
        count: 0,
        rank: meta.rank,
        flag: canon?.flag || meta.flag,
        countryName: canon?.countryName || cMeta.name,
      };
      existingI.count++;
      internationalMap.set(meta.canonicalId, existingI);
    }

    const continentKey: ContinentId = meta.continent;
    const countriesMap = continentData.get(continentKey) || continentData.get('europe')!;

    if (!countriesMap.has(cMeta.name)) {
      countriesMap.set(cMeta.name, {
        countryMeta: cMeta,
        comps: new Map(),
      });
    }

    const cEntry = countriesMap.get(cMeta.name)!;
    const compItem = cEntry.comps.get(meta.canonicalId) || {
      id: meta.canonicalId,
      name: meta.standardName,
      competitionType: meta.competitionType,
      typeLabel: meta.typeLabel,
      count: 0,
      rank: meta.rank,
      flag: canon?.flag || meta.flag,
      countryName: cMeta.name,
    };
    compItem.count++;
    cEntry.comps.set(meta.canonicalId, compItem);
  });

  const continents: DirectoryContinentGroup[] = CONTINENTS.filter((c) => c.id !== 'all').map((c) => {
    const countriesMap = continentData.get(c.id);
    const countries: DirectoryCountryGroup[] = [];
    const flatComps: DirectoryCompetitionItem[] = [];

    if (countriesMap) {
      countriesMap.forEach(({ countryMeta, comps }) => {
        const compList = Array.from(comps.values()).sort((a, b) => a.rank - b.rank || b.count - a.count);
        const totalCount = compList.reduce((sum, item) => sum + item.count, 0);
        countries.push({
          countryName: countryMeta.name,
          countryCode: countryMeta.code,
          flag: countryMeta.flag,
          totalCount,
          competitions: compList,
        });
        flatComps.push(...compList);
      });
    }

    countries.sort((a, b) => b.totalCount - a.totalCount || a.countryName.localeCompare(b.countryName));
    flatComps.sort((a, b) => a.rank - b.rank || b.count - a.count);

    const totalCount = countries.reduce((sum, item) => sum + item.totalCount, 0);

    return {
      id: c.id,
      name: c.name,
      flag: c.flag,
      totalCount,
      countries,
      competitions: flatComps,
    };
  });

  const featured = Array.from(featuredMap.values()).sort((a, b) => a.rank - b.rank || b.count - a.count);
  const international = Array.from(internationalMap.values()).sort((a, b) => a.rank - b.rank || b.count - a.count);

  return {
    featured,
    international,
    continents,
  };
}

// ============================================================================
// SPORTSCORE-ALIGNED COUNTRY DIRECTORY ARCHITECTURE
// ============================================================================

export interface SportScoreDirectoryCategory {
  id: string;
  label: string;
  country?: string;
  kind?: 'senior' | 'amateur' | 'international_clubs' | 'international' | 'international_youth';
  aliases?: string[];
}

export interface SportScoreDirectoryRow {
  id: string;
  label: string;
  count: number;
}

/**
 * Exact SportScore country and competition directory configuration and order.
 * Strictly preserves requested spelling, casing, and order.
 * 'Normal', 'Shikisha Bet', 'Virtuals', and 'Simulated Reality' are excluded.
 */
export const SPORTSCORE_COUNTRY_DIRECTORY_CONFIG: SportScoreDirectoryCategory[] = [
  // 1-8 Major European Senior Countries
  { id: 'england', label: 'England', country: 'England', kind: 'senior' },
  { id: 'spain', label: 'Spain', country: 'Spain', kind: 'senior' },
  { id: 'italy', label: 'Italy', country: 'Italy', kind: 'senior' },
  { id: 'germany', label: 'Germany', country: 'Germany', kind: 'senior' },
  { id: 'france', label: 'France', country: 'France', kind: 'senior' },
  { id: 'scotland', label: 'Scotland', country: 'Scotland', kind: 'senior' },
  { id: 'portugal', label: 'Portugal', country: 'Portugal', kind: 'senior' },
  { id: 'netherlands', label: 'Netherlands', country: 'Netherlands', kind: 'senior', aliases: ['holland', 'dutch'] },

  // 9-11 International Competitions
  { id: 'international_clubs', label: 'International Clubs', kind: 'international_clubs' },
  { id: 'international', label: 'International', kind: 'international' },
  { id: 'international_youth', label: 'International Youth', kind: 'international_youth' },

  // Remaining Country and Specialized Directories
  { id: 'argentina', label: 'Argentina', country: 'Argentina' },
  { id: 'armenia', label: 'Armenia', country: 'Armenia' },
  { id: 'australia', label: 'Australia', country: 'Australia' },
  { id: 'austria', label: 'Austria', country: 'Austria', kind: 'senior' },
  { id: 'austria_amateur', label: 'Austria Amateur', country: 'Austria', kind: 'amateur' },
  { id: 'azerbaijan', label: 'Azerbaijan', country: 'Azerbaijan' },
  { id: 'bahrain', label: 'Bahrain', country: 'Bahrain' },
  { id: 'belarus', label: 'Belarus', country: 'Belarus' },
  { id: 'belgium', label: 'Belgium', country: 'Belgium' },
  { id: 'bolivia', label: 'Bolivia', country: 'Bolivia' },
  { id: 'bosnia_and_herzegovina', label: 'Bosnia and Herzegovina', country: 'Bosnia and Herzegovina', aliases: ['bosnia & herzegovina', 'bosnia'] },
  { id: 'brazil', label: 'Brazil', country: 'Brazil' },
  { id: 'bulgaria', label: 'Bulgaria', country: 'Bulgaria' },
  { id: 'cameroon', label: 'Cameroon', country: 'Cameroon' },
  { id: 'canada', label: 'Canada', country: 'Canada' },
  { id: 'chile', label: 'Chile', country: 'Chile' },
  { id: 'china', label: 'China', country: 'China' },
  { id: 'colombia', label: 'Colombia', country: 'Colombia' },
  { id: 'costa_rica', label: 'Costa Rica', country: 'Costa Rica' },
  { id: 'croatia', label: 'Croatia', country: 'Croatia' },
  { id: 'cyprus', label: 'Cyprus', country: 'Cyprus' },
  { id: 'czechia', label: 'Czechia', country: 'Czechia', aliases: ['czech republic', 'czech'] },
  { id: 'denmark', label: 'Denmark', country: 'Denmark' },
  { id: 'ecuador', label: 'Ecuador', country: 'Ecuador' },
  { id: 'egypt', label: 'Egypt', country: 'Egypt' },
  { id: 'el_salvador', label: 'El Salvador', country: 'El Salvador' },
  { id: 'england_amateur', label: 'England Amateur', country: 'England', kind: 'amateur' },
  { id: 'estonia', label: 'Estonia', country: 'Estonia' },
  { id: 'faroe_islands', label: 'Faroe Islands', country: 'Faroe Islands' },
  { id: 'finland', label: 'Finland', country: 'Finland' },
  { id: 'georgia', label: 'Georgia', country: 'Georgia' },
  { id: 'greece', label: 'Greece', country: 'Greece' },
  { id: 'guatemala', label: 'Guatemala', country: 'Guatemala' },
  { id: 'hungary', label: 'Hungary', country: 'Hungary' },
  { id: 'iceland', label: 'Iceland', country: 'Iceland' },
  { id: 'india', label: 'India', country: 'India' },
  { id: 'iran', label: 'Iran', country: 'Iran' },
  { id: 'iraq', label: 'Iraq', country: 'Iraq' },
  { id: 'ireland', label: 'Ireland', country: 'Ireland', aliases: ['republic of ireland'] },
  { id: 'israel', label: 'Israel', country: 'Israel' },
  { id: 'japan', label: 'Japan', country: 'Japan' },
  { id: 'jordan', label: 'Jordan', country: 'Jordan' },
  { id: 'kazakhstan', label: 'Kazakhstan', country: 'Kazakhstan' },
  { id: 'kosovo', label: 'KOSOVO', country: 'Kosovo' },
  { id: 'latvia', label: 'Latvia', country: 'Latvia' },
  { id: 'lithuania', label: 'Lithuania', country: 'Lithuania' },
  { id: 'luxembourg', label: 'Luxembourg', country: 'Luxembourg' },
  { id: 'malta', label: 'Malta', country: 'Malta' },
  { id: 'mexico', label: 'Mexico', country: 'Mexico' },
  { id: 'montenegro', label: 'Montenegro', country: 'Montenegro' },
  { id: 'northern_ireland', label: 'Northern Ireland', country: 'Northern Ireland' },
  { id: 'norway', label: 'Norway', country: 'Norway' },
  { id: 'panama', label: 'Panama', country: 'Panama' },
  { id: 'paraguay', label: 'Paraguay', country: 'Paraguay' },
  { id: 'peru', label: 'Peru', country: 'Peru' },
  { id: 'poland', label: 'Poland', country: 'Poland' },
  { id: 'qatar', label: 'Qatar', country: 'Qatar' },
  { id: 'republic_of_korea', label: 'Republic of Korea', country: 'Republic of Korea', aliases: ['south korea', 'korea', 'korea republic'] },
  { id: 'romania', label: 'Romania', country: 'Romania' },
  { id: 'russia', label: 'Russia', country: 'Russia' },
  { id: 'rwanda', label: 'Rwanda', country: 'Rwanda' },
  { id: 'saudi_arabia', label: 'Saudi Arabia', country: 'Saudi Arabia' },
  { id: 'serbia', label: 'Serbia', country: 'Serbia' },
  { id: 'singapore', label: 'Singapore', country: 'Singapore' },
  { id: 'slovakia', label: 'Slovakia', country: 'Slovakia' },
  { id: 'slovenia', label: 'Slovenia', country: 'Slovenia' },
  { id: 'spain_amateur', label: 'Spain Amateur', country: 'Spain', kind: 'amateur' },
  { id: 'sweden', label: 'Sweden', country: 'Sweden', kind: 'senior' },
  { id: 'sweden_amateur', label: 'Sweden Amateur', country: 'Sweden', kind: 'amateur' },
  { id: 'switzerland', label: 'Switzerland', country: 'Switzerland' },
  { id: 'turkiye', label: 'Turkiye', country: 'Turkiye', aliases: ['turkey'] },
  { id: 'ukraine', label: 'Ukraine', country: 'Ukraine' },
  { id: 'united_arab_emirates', label: 'United Arab Emirates', country: 'United Arab Emirates', aliases: ['uae'] },
  { id: 'uruguay', label: 'Uruguay', country: 'Uruguay' },
  { id: 'usa', label: 'USA', country: 'USA', aliases: ['united states', 'us'] },
  { id: 'uzbekistan', label: 'Uzbekistan', country: 'Uzbekistan' },
  { id: 'venezuela', label: 'Venezuela', country: 'Venezuela' },
  { id: 'vietnam', label: 'Vietnam', country: 'Vietnam' },
  { id: 'wales', label: 'Wales', country: 'Wales' },
];

/**
 * Resolves any fixture to its unique SportScore Directory Category ID
 */
export function resolveSportScoreDirectoryId(f: {
  competition: string;
  country?: string;
  leagueCode?: string;
  competitionId?: string;
  providerId?: string;
}): string {
  const meta = getLeagueMetadata(f.competition, f.country, f.leagueCode, f.competitionId);
  const canon = CANONICAL_COMPETITIONS[meta.canonicalId];

  const compName = (canon?.name || meta.standardName || f.competition || '').toLowerCase();
  const cName = (canon?.countryName || meta.countryName || meta.country || f.country || '').toLowerCase().trim();
  const compType = canon?.competitionType || meta.competitionType;
  const lCode = (f.leagueCode || '').toLowerCase();

  // 0. Exclude Simulated Reality / SRL (does not exist in Mshindi architecture)
  const fullText = `${f.competition || ''} ${f.leagueCode || ''} ${f.country || ''} ${compName} ${cName}`.toLowerCase();
  if (fullText.includes('simulated reality') || /\b(srl)\b/i.test(fullText)) {
    return 'excluded';
  }

  // 1. Continental / International multi-country club competitions
  if (
    compType === 'continental_club' ||
    meta.continent === 'european_competitions' ||
    compName.includes('uefa champions league') ||
    compName.includes('uefa europa league') ||
    compName.includes('uefa conference') ||
    compName.includes('uefa youth league') ||
    compName.includes('uefa super cup') ||
    compName.includes('caf champions') ||
    compName.includes('caf confederation') ||
    compName.includes('afc champions') ||
    compName.includes('afc challenge') ||
    compName.includes('conmebol libertadores') ||
    compName.includes('conmebol sudamericana') ||
    compName.includes('concacaf champions') ||
    compName.includes('club world cup')
  ) {
    return 'international_clubs';
  }

  // Helper: check if competition is amateur / youth / reserve
  const isAmateurOrYouth =
    compType === 'reserve_amateur' ||
    compType === 'youth' ||
    /\b(u17|u18|u19|u20|u21|u23|youth|amateur|reserve|development|tercera|premier league 2|folksam|regionalliga|landesliga|division 2|division 3)\b/i.test(`${compName} ${lCode}`);

  // 2. International national-team competitions
  if (
    compType === 'international' ||
    meta.continent === 'international' ||
    cName === 'international' ||
    cName === 'world' ||
    compName.includes('world cup') ||
    compName.includes('nations league') ||
    compName.includes('international friendlies')
  ) {
    if (isAmateurOrYouth) {
      return 'international_youth';
    }
    return 'international';
  }

  // 3. Countries with dedicated Amateur categories
  if (cName === 'england') {
    return isAmateurOrYouth ? 'england_amateur' : 'england';
  }
  if (cName === 'spain') {
    return isAmateurOrYouth ? 'spain_amateur' : 'spain';
  }
  if (cName === 'austria') {
    return isAmateurOrYouth ? 'austria_amateur' : 'austria';
  }
  if (cName === 'sweden') {
    return isAmateurOrYouth ? 'sweden_amateur' : 'sweden';
  }

  // 4. Match against configured countries
  for (const entry of SPORTSCORE_COUNTRY_DIRECTORY_CONFIG) {
    if (entry.country && entry.kind !== 'amateur') {
      const matchCountry = entry.country.toLowerCase();
      if (cName === matchCountry || (entry.aliases && entry.aliases.includes(cName))) {
        return entry.id;
      }
    }
  }

  return 'other';
}

/**
 * Builds the SportScore Country Directory with real-time dynamic fixture counts
 */
export function buildSportScoreCountryDirectory(
  fixtures: Array<{ competition: string; country?: string; leagueCode?: string; competitionId?: string; providerId?: string }>,
  searchQuery = ''
): {
  rows: SportScoreDirectoryRow[];
  totalMatches: number;
} {
  const counts: Record<string, number> = {};
  for (const entry of SPORTSCORE_COUNTRY_DIRECTORY_CONFIG) {
    counts[entry.id] = 0;
  }

  let totalMatches = 0;
  for (const f of fixtures) {
    const dirId = resolveSportScoreDirectoryId(f);
    if (dirId === 'excluded') continue;
    if (counts[dirId] !== undefined) {
      counts[dirId]++;
    }
    totalMatches++;
  }

  const q = searchQuery.trim().toLowerCase();
  const allRows: SportScoreDirectoryRow[] = SPORTSCORE_COUNTRY_DIRECTORY_CONFIG.map((entry) => ({
    id: entry.id,
    label: entry.label,
    count: counts[entry.id] || 0,
  }));

  const filteredRows = q
    ? allRows.filter((r) => r.label.toLowerCase().includes(q))
    : allRows;

  return {
    rows: filteredRows,
    totalMatches,
  };
}
