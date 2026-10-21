import {
  type ContinentId,
  type CanonicalCompetition,
  CANONICAL_COMPETITIONS,
  resolveCanonicalCompetition,
} from './canonicalCompetitions';

export { type ContinentId } from './canonicalCompetitions';

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
  { id: 'asia', name: 'Asia', flag: '🌏', order: 5 },
  { id: 'north_america', name: 'North America', flag: '🌎', order: 6 },
  { id: 'international', name: 'International & FIFA', flag: '🌐', order: 7 },
  { id: 'oceania', name: 'Oceania', flag: '🌏', order: 8 },
];

export interface LeagueMetadataResult {
  continent: ContinentId;
  rank: number;
  standardName: string;
  canonicalId: string;
}

/**
 * Returns verified league metadata powered by the Canonical Competition Identity System.
 * Replaces loose regex matching with strict, context-aware identity resolution.
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
      continent: canon.continent,
      rank: canon.rank ?? canon.priorityRank,
      standardName: canon.name,
      canonicalId: canon.id,
    };
  }

  // Resolve canonical identity from provider competition, country, and league code
  const resolved: CanonicalCompetition = resolveCanonicalCompetition({
    competition,
    country,
    leagueCode,
  });

  return {
    continent: resolved.continent,
    rank: resolved.rank ?? resolved.priorityRank,
    standardName: resolved.name,
    canonicalId: resolved.id,
  };
}
