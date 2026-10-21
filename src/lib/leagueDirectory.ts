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
