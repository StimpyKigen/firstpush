import { resolveCanonicalCompetition, CANONICAL_COMPETITIONS } from '../src/lib/canonicalCompetitions';
import { getLeagueMetadata } from '../src/lib/leagueDirectory';
import { getCompetitionPriorityScore, sortHighlightsComparator, sortUpcomingComparator } from '../src/lib/competitionPriority';
import { BUNDLED_SPORTS_CATALOGUE } from '../src/data/bundledSportsCatalogue';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

console.log('=== 1. CANONICAL COMPETITION IDENTITY RESOLUTION ===');
// English Premier League
const epl = resolveCanonicalCompetition({ competition: 'Premier League', country: 'England', leagueCode: 'premier' });
assert(epl.id === 'eng_premier_league', 'England + Premier League resolves to eng_premier_league');
assert(epl.name === 'English Premier League', 'epl display name is English Premier League');
assert(epl.continent === 'europe', 'epl continent is europe');

// Foreign Premier Leagues must NOT resolve to eng_premier_league
const egypt = resolveCanonicalCompetition({ competition: 'Egyptian Premier League', country: 'Egypt', leagueCode: 'egypt' });
assert(egypt.id === 'egy_premier_league', 'Egyptian Premier League resolves to egy_premier_league');
assert(egypt.continent === 'africa', 'egypt continent is africa');

const kenya = resolveCanonicalCompetition({ competition: 'Kenyan Premier League', country: 'Kenya', leagueCode: 'kenya' });
assert(kenya.id === 'ken_premier_league', 'Kenyan Premier League resolves to ken_premier_league');
assert(kenya.continent === 'africa', 'kenya continent is africa');

const russia = resolveCanonicalCompetition({ competition: 'Russian Premier League', country: 'Russia' });
assert(russia.id === 'rus_premier_league', 'Russian Premier League resolves to rus_premier_league');

const canada = resolveCanonicalCompetition({ competition: 'Canadian Premier League', country: 'Canada' });
assert(canada.id === 'can_premier_league', 'Canadian Premier League resolves to can_premier_league');
assert(canada.continent === 'north_america', 'canada continent is north_america');

// Spanish La Liga
const laliga = resolveCanonicalCompetition({ competition: 'La Liga', country: 'Spain', leagueCode: 'spain1' });
assert(laliga.id === 'esp_la_liga', 'Spain + La Liga resolves to esp_la_liga');
assert(laliga.continent === 'europe', 'laliga continent is europe');

// Spanish Segunda Division (Tier 2) must NOT resolve to esp_la_liga
const segunda = resolveCanonicalCompetition({ competition: 'Segunda Division', country: 'Spain', leagueCode: 'spain2' });
assert(segunda.id === 'esp_segunda', 'Spanish Segunda resolves to esp_segunda');
assert(segunda.tier === 2, 'Spanish Segunda tier is 2');

// Foreign Primera Divisions must NOT resolve to esp_la_liga
const costaRica = resolveCanonicalCompetition({ competition: 'Primera Division', country: 'Costa Rica' });
assert(costaRica.id === 'cri_primera_division', 'Costa Rica Primera Division resolves to cri_primera_division');
assert(costaRica.continent === 'north_america', 'costa rica continent is north_america');

const chile = resolveCanonicalCompetition({ competition: 'Primera Division', country: 'Chile' });
assert(chile.id === 'chl_primera_division', 'Chile Primera Division resolves to chl_primera_division');
assert(chile.continent === 'south_america', 'chile continent is south_america');

const argentina = resolveCanonicalCompetition({ competition: 'Primera División Argentina', country: 'Argentina' });
assert(argentina.id === 'arg_primera_division', 'Argentina Primera Division resolves to arg_primera_division');
assert(argentina.continent === 'south_america', 'argentina continent is south_america');

console.log('\n=== 2. LEAGUE DIRECTORY METADATA ===');
const metaEpl = getLeagueMetadata('Premier League', 'England', 'premier');
assert(metaEpl.canonicalId === 'eng_premier_league', 'getLeagueMetadata for EPL returns canonicalId eng_premier_league');
assert(metaEpl.continent === 'europe', 'getLeagueMetadata for EPL returns europe');

const metaEgypt = getLeagueMetadata('Egyptian Premier League', 'Egypt');
assert(metaEgypt.canonicalId === 'egy_premier_league', 'getLeagueMetadata for Egypt returns canonicalId egy_premier_league');
assert(metaEgypt.continent === 'africa', 'getLeagueMetadata for Egypt returns africa');

const metaCostaRica = getLeagueMetadata('Primera Division', 'Costa Rica');
assert(metaCostaRica.canonicalId === 'cri_primera_division', 'getLeagueMetadata for Costa Rica returns cri_primera_division');
assert(metaCostaRica.continent === 'north_america', 'getLeagueMetadata for Costa Rica returns north_america');

console.log('\n=== 3. BUNDLED SPORTS CATALOGUE AUDIT ===');
const fixtures = (BUNDLED_SPORTS_CATALOGUE.fixtures as any[]) || [];
assert(fixtures.length > 0, `Catalogue has fixtures (${fixtures.length} total)`);

const eplMatches = fixtures.filter((f) => f.competitionId === 'eng_premier_league');
assert(eplMatches.length >= 7, `Catalogue contains at least 7 English Premier League matches (found ${eplMatches.length})`);

// Ensure every single EPL match is from England
const nonEnglandEpl = eplMatches.filter((f) => f.country !== 'England' && f.country !== 'United Kingdom');
assert(nonEnglandEpl.length === 0, 'Zero non-English fixtures under eng_premier_league');

const laligaMatches = fixtures.filter((f) => f.competitionId === 'esp_la_liga');
assert(laligaMatches.length >= 7, `Catalogue contains at least 7 Spanish La Liga matches (found ${laligaMatches.length})`);

// Ensure every single La Liga match is from Spain
const nonSpainLaLiga = laligaMatches.filter((f) => f.country !== 'Spain');
assert(nonSpainLaLiga.length === 0, 'Zero non-Spanish fixtures under esp_la_liga');

console.log('\n=== 4. LEAGUE FILTERING REPLICATION ===');
function filterByLeague(target: string, list: any[]) {
  return list.filter((m) => {
    const meta = getLeagueMetadata(m.competition, m.country, m.leagueCode, m.competitionId);
    return (
      meta.canonicalId === target ||
      meta.standardName.toLowerCase() === target.toLowerCase() ||
      (m.competitionId && m.competitionId === target)
    );
  });
}

const filteredEpl = filterByLeague('eng_premier_league', fixtures);
assert(filteredEpl.length === eplMatches.length, `EPL filter returns exactly ${eplMatches.length} matches`);
assert(filteredEpl.every((m) => m.competitionId === 'eng_premier_league'), 'EPL filter only contains verified EPL matches');

const filteredLaLiga = filterByLeague('esp_la_liga', fixtures);
assert(filteredLaLiga.length === laligaMatches.length, `La Liga filter returns exactly ${laligaMatches.length} matches`);
assert(filteredLaLiga.every((m) => m.competitionId === 'esp_la_liga'), 'La Liga filter only contains verified La Liga matches');

console.log('\n=== 5. SORTING & HIERARCHY INDEPENDENCE ===');
// Chronological for upcoming
const sampleA = { id: 'm-1', kickoffIso: '2026-10-24T16:30:00Z', competition: 'English Premier League', competitionId: 'eng_premier_league' };
const sampleB = { id: 'm-2', kickoffIso: '2026-10-24T14:00:00Z', competition: 'Myanmar U20 League', competitionId: 'unclassified_myanmar' };

const chronologicalSort = [sampleA, sampleB].sort(sortUpcomingComparator);
assert(chronologicalSort[0].id === 'm-2', 'Upcoming comparator sorts strictly chronological by kickoff time (earlier kickoff first, independent of prestige)');

// Highlights prestige hierarchy
const highlightsSort = [sampleB, sampleA].sort(sortHighlightsComparator);
assert(highlightsSort[0].id === 'm-1', 'Highlights comparator spots higher prestige competition (English Premier League > Myanmar U20)');

console.log(`\n========================================`);
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
