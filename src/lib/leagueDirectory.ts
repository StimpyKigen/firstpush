export type ContinentId = 'all' | 'europe' | 'south_america' | 'africa' | 'asia' | 'north_america' | 'oceania';

export interface ContinentMeta {
  id: ContinentId;
  name: string;
  flag: string;
  order: number;
}

export const CONTINENTS: ContinentMeta[] = [
  { id: 'all', name: 'All Continents', flag: '🌍', order: 0 },
  { id: 'europe', name: 'Europe', flag: '🇪🇺', order: 1 },
  { id: 'south_america', name: 'South America', flag: '🌎', order: 2 },
  { id: 'africa', name: 'Africa', flag: '🌍', order: 3 },
  { id: 'asia', name: 'Asia', flag: '🌏', order: 4 },
  { id: 'north_america', name: 'North America', flag: '🌎', order: 5 },
  { id: 'oceania', name: 'Oceania', flag: '🌏', order: 6 },
];

// Normalized rank tiers: lower rank number = stronger league
const LEAGUE_STRENGTH_MAP: Array<{ pattern: RegExp; rank: number; continent: ContinentId; standardName: string }> = [
  // Europe
  { pattern: /uefa champions league|champions league/i, rank: 1, continent: 'europe', standardName: 'UEFA Champions League' },
  { pattern: /uefa europa league|europa league/i, rank: 2, continent: 'europe', standardName: 'UEFA Europa League' },
  { pattern: /uefa conference league|conference league/i, rank: 3, continent: 'europe', standardName: 'UEFA Conference League' },
  { pattern: /premier league|english premier league|epl/i, rank: 4, continent: 'europe', standardName: 'English Premier League' },
  { pattern: /la liga|laliga|primera division/i, rank: 5, continent: 'europe', standardName: 'Spanish La Liga' },
  { pattern: /serie a/i, rank: 6, continent: 'europe', standardName: 'Italian Serie A' },
  { pattern: /bundesliga/i, rank: 7, continent: 'europe', standardName: 'German Bundesliga' },
  { pattern: /ligue 1/i, rank: 8, continent: 'europe', standardName: 'French Ligue 1' },
  { pattern: /primeira liga|portuguese/i, rank: 9, continent: 'europe', standardName: 'Portuguese Primeira Liga' },
  { pattern: /eredivisie/i, rank: 10, continent: 'europe', standardName: 'Dutch Eredivisie' },
  { pattern: /championship|efl championship/i, rank: 11, continent: 'europe', standardName: 'English Championship' },
  { pattern: /scottish premiership|scottish premier/i, rank: 12, continent: 'europe', standardName: 'Scottish Premiership' },
  { pattern: /s[üu]per lig|turkish/i, rank: 13, continent: 'europe', standardName: 'Turkish Süper Lig' },
  { pattern: /liga f|primera division femenina/i, rank: 14, continent: 'europe', standardName: 'Spanish Liga F' },
  { pattern: /greek super league|super league greece/i, rank: 15, continent: 'europe', standardName: 'Greek Super League' },
  { pattern: /fa cup|copa del rey|dfb-pokal|coppa italia|coupe de france/i, rank: 16, continent: 'europe', standardName: 'European Domestic Cups' },
  { pattern: /uefa|europe/i, rank: 17, continent: 'europe', standardName: 'Other European Leagues' },

  // South America
  { pattern: /libertadores/i, rank: 1, continent: 'south_america', standardName: 'CONMEBOL Libertadores' },
  { pattern: /sudamericana/i, rank: 2, continent: 'south_america', standardName: 'CONMEBOL Sudamericana' },
  { pattern: /brasileir[ãa]o|serie a brazil|brazil serie a/i, rank: 3, continent: 'south_america', standardName: 'Brasileirão Série A' },
  { pattern: /argentine|primera divisi[oó]n argentina|liga profesional argentina/i, rank: 4, continent: 'south_america', standardName: 'Argentine Primera División' },
  { pattern: /colombian|primera a colombia|liga betplay/i, rank: 5, continent: 'south_america', standardName: 'Colombian Primera A' },
  { pattern: /conmebol|chile|uruguay|paraguay|peru|ecuador/i, rank: 6, continent: 'south_america', standardName: 'Other South American Leagues' },

  // Africa
  { pattern: /caf champions league/i, rank: 1, continent: 'africa', standardName: 'CAF Champions League' },
  { pattern: /caf confederation/i, rank: 2, continent: 'africa', standardName: 'CAF Confederation Cup' },
  { pattern: /egyptian premier league|egypt/i, rank: 3, continent: 'africa', standardName: 'Egyptian Premier League' },
  { pattern: /south african premier|psl|dstv prem/i, rank: 4, continent: 'africa', standardName: 'South African PSL' },
  { pattern: /botola|morocco/i, rank: 5, continent: 'africa', standardName: 'Moroccan Botola Pro' },
  { pattern: /kenyan premier league|kenya premier|fkf/i, rank: 6, continent: 'africa', standardName: 'Kenyan Premier League' },
  { pattern: /nigeria|npfl/i, rank: 7, continent: 'africa', standardName: 'Nigerian NPFL' },
  { pattern: /caf|africa|ghana|tanzania|zambia|tunisia|algeria/i, rank: 8, continent: 'africa', standardName: 'Other African Leagues' },

  // Asia
  { pattern: /afc champions league|afc elite/i, rank: 1, continent: 'asia', standardName: 'AFC Champions League' },
  { pattern: /saudi pro league|roshn saudi|saudi/i, rank: 2, continent: 'asia', standardName: 'Saudi Pro League' },
  { pattern: /j1 league|j-league|j league|japan/i, rank: 3, continent: 'asia', standardName: 'Japanese J1 League' },
  { pattern: /k league|k-league|korea/i, rank: 4, continent: 'asia', standardName: 'South Korean K League' },
  { pattern: /qatar stars league|qatar/i, rank: 5, continent: 'asia', standardName: 'Qatar Stars League' },
  { pattern: /uae pro league|uae/i, rank: 6, continent: 'asia', standardName: 'UAE Pro League' },
  { pattern: /indian super league|isl/i, rank: 7, continent: 'asia', standardName: 'Indian Super League' },
  { pattern: /afc|asia|china|csl|thailand|indonesia/i, rank: 8, continent: 'asia', standardName: 'Other Asian Leagues' },

  // North America
  { pattern: /concacaf champions/i, rank: 1, continent: 'north_america', standardName: 'CONCACAF Champions Cup' },
  { pattern: /liga mx/i, rank: 2, continent: 'north_america', standardName: 'Mexican Liga MX' },
  { pattern: /major league soccer|mls/i, rank: 3, continent: 'north_america', standardName: 'Major League Soccer (MLS)' },
  { pattern: /nwsl|women's soccer/i, rank: 4, continent: 'north_america', standardName: 'National Women’s Soccer League (NWSL)' },
  { pattern: /liga de expansi[oó]n|expansion mx/i, rank: 5, continent: 'north_america', standardName: 'Liga de Expansión MX' },
  { pattern: /usl championship|usl/i, rank: 6, continent: 'north_america', standardName: 'USL Championship' },
  { pattern: /canadian premier|concacaf/i, rank: 7, continent: 'north_america', standardName: 'Other North American Leagues' },

  // Oceania
  { pattern: /ofc champions/i, rank: 1, continent: 'oceania', standardName: 'OFC Champions League' },
  { pattern: /a-league|a league/i, rank: 2, continent: 'oceania', standardName: 'Australian A-League' },
  { pattern: /new zealand|ofc/i, rank: 3, continent: 'oceania', standardName: 'Other Oceania Leagues' },
];

export function getLeagueMetadata(competition: string): { continent: ContinentId; rank: number; standardName: string } {
  const comp = competition.toLowerCase();
  for (const entry of LEAGUE_STRENGTH_MAP) {
    if (entry.pattern.test(comp)) {
      return { continent: entry.continent, rank: entry.rank, standardName: entry.standardName };
    }
  }

  // Fallback heuristic if not matched directly
  if (comp.includes('mexico') || comp.includes('usa') || comp.includes('america')) {
    return { continent: 'north_america', rank: 99, standardName: competition };
  }
  if (comp.includes('brazil') || comp.includes('argentina') || comp.includes('copa')) {
    return { continent: 'south_america', rank: 99, standardName: competition };
  }
  if (comp.includes('africa') || comp.includes('kenya') || comp.includes('egypt')) {
    return { continent: 'africa', rank: 99, standardName: competition };
  }
  if (comp.includes('asia') || comp.includes('japan') || comp.includes('korea')) {
    return { continent: 'asia', rank: 99, standardName: competition };
  }
  if (comp.includes('australia') || comp.includes('zealand')) {
    return { continent: 'oceania', rank: 99, standardName: competition };
  }

  // Default to Europe (majority of global fixtures)
  return { continent: 'europe', rank: 99, standardName: competition };
}
