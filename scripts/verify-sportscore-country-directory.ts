import { BUNDLED_SPORTS_CATALOGUE } from '../src/data/bundledSportsCatalogue';
import {
  SPORTSCORE_COUNTRY_DIRECTORY_CONFIG,
  resolveSportScoreDirectoryId,
  buildSportScoreCountryDirectory,
} from '../src/lib/leagueDirectory';
import { isSimulatedReality } from '../src/lib/sportsFeedService';

console.log('=== 1. VERIFY EPL & LA LIGA DEDUPLICATION ===');
const fixtures = BUNDLED_SPORTS_CATALOGUE.fixtures as Array<any>;
const eplFixtures = fixtures.filter((f) =>
  f.competition === 'Premier League' || f.leagueCode === 'premier-league' || f.competitionId === 'eng_premier_league'
);
const laLigaFixtures = fixtures.filter((f) =>
  f.competition === 'La Liga' || f.leagueCode === 'la-liga' || f.competitionId === 'esp_la_liga'
);

console.log(`EPL Fixtures: ${eplFixtures.length}`);
console.log(`La Liga Fixtures: ${laLigaFixtures.length}`);

if (eplFixtures.length !== 10) {
  throw new Error(`Expected exactly 10 EPL fixtures, got ${eplFixtures.length}`);
}
if (laLigaFixtures.length !== 10) {
  throw new Error(`Expected exactly 10 La Liga fixtures, got ${laLigaFixtures.length}`);
}

// Check duplicate match keys
const checkDuplicates = (matches: any[], leagueName: string) => {
  const seen = new Set<string>();
  for (const m of matches) {
    const key = `${m.home.toLowerCase()} vs ${m.away.toLowerCase()} on ${(m.kickoffIso || '').slice(0, 10)}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate match found in ${leagueName}: ${key}`);
    }
    seen.add(key);
  }
};
checkDuplicates(eplFixtures, 'Premier League');
checkDuplicates(laLigaFixtures, 'La Liga');
console.log('✅ EPL and La Liga fixtures are deduplicated with 0 duplicate matches.');

console.log('\n=== 2. VERIFY DIRECTORY STRUCTURE & EXCLUSIONS ===');
const ids = SPORTSCORE_COUNTRY_DIRECTORY_CONFIG.map((c) => c.id);
const labels = SPORTSCORE_COUNTRY_DIRECTORY_CONFIG.map((c) => c.label);

// Check order: first 8 top European senior countries
const expectedFirst8 = ['England', 'Spain', 'Italy', 'Germany', 'France', 'Scotland', 'Portugal', 'Netherlands'];
for (let i = 0; i < expectedFirst8.length; i++) {
  if (labels[i] !== expectedFirst8[i]) {
    throw new Error(`Expected position ${i} to be "${expectedFirst8[i]}", got "${labels[i]}"`);
  }
}
console.log('✅ First 8 major European countries ordered correctly:', expectedFirst8.join(', '));

// Check next 3 international categories
const expectedNext3 = ['International Clubs', 'International', 'International Youth'];
for (let i = 0; i < expectedNext3.length; i++) {
  if (labels[8 + i] !== expectedNext3[i]) {
    throw new Error(`Expected position ${8 + i} to be "${expectedNext3[i]}", got "${labels[8 + i]}"`);
  }
}
console.log('✅ Next 3 International categories ordered correctly:', expectedNext3.join(', '));

// Check strict exclusions
const forbidden = ['simulated reality', 'srl', 'normal', 'shikisha bet', 'virtuals'];
for (const entry of SPORTSCORE_COUNTRY_DIRECTORY_CONFIG) {
  for (const f of forbidden) {
    if (entry.label.toLowerCase().includes(f) || entry.id.toLowerCase().includes(f)) {
      throw new Error(`Forbidden category found in directory: ${entry.label} (${entry.id})`);
    }
  }
}
console.log('✅ Strict exclusions confirmed: No Simulated Reality, SRL, Normal, Shikisha Bet, or Virtuals.');

console.log('\n=== 3. VERIFY RESOLUTION & SEPARATION LOGIC ===');
// Senior England vs Amateur England
const eplResolved = resolveSportScoreDirectoryId({
  competition: 'Premier League',
  country: 'England',
  leagueCode: 'premier-league',
  competitionId: 'eng_premier_league',
});
if (eplResolved !== 'england') {
  throw new Error(`EPL should resolve to 'england', got '${eplResolved}'`);
}

const eplAmateurResolved = resolveSportScoreDirectoryId({
  competition: 'Premier League 2 Division One',
  country: 'England',
  leagueCode: 'premier-league-2',
});
if (eplAmateurResolved !== 'england_amateur') {
  throw new Error(`Premier League 2 should resolve to 'england_amateur', got '${eplAmateurResolved}'`);
}

// Senior Spain vs Amateur Spain
const laLigaResolved = resolveSportScoreDirectoryId({
  competition: 'La Liga',
  country: 'Spain',
  leagueCode: 'la-liga',
  competitionId: 'esp_la_liga',
});
if (laLigaResolved !== 'spain') {
  throw new Error(`La Liga should resolve to 'spain', got '${laLigaResolved}'`);
}

const spainAmateurResolved = resolveSportScoreDirectoryId({
  competition: 'Tercera Division RFEF',
  country: 'Spain',
});
if (spainAmateurResolved !== 'spain_amateur') {
  throw new Error(`Tercera Division should resolve to 'spain_amateur', got '${spainAmateurResolved}'`);
}

// International Clubs vs International vs International Youth
const uclResolved = resolveSportScoreDirectoryId({
  competition: 'UEFA Champions League',
  country: 'Europe',
  competitionId: 'uefa_champions_league',
});
if (uclResolved !== 'international_clubs') {
  throw new Error(`UCL should resolve to 'international_clubs', got '${uclResolved}'`);
}

const worldCupResolved = resolveSportScoreDirectoryId({
  competition: 'FIFA World Cup',
  country: 'International',
  competitionId: 'fifa_world_cup',
});
if (worldCupResolved !== 'international') {
  throw new Error(`World Cup should resolve to 'international', got '${worldCupResolved}'`);
}

const u21EuroResolved = resolveSportScoreDirectoryId({
  competition: 'UEFA U21 Championship',
  country: 'International',
});
if (u21EuroResolved !== 'international_youth') {
  throw new Error(`UEFA U21 Championship should resolve to 'international_youth', got '${u21EuroResolved}'`);
}

// Simulated Reality Exclusion
const srlResolved = resolveSportScoreDirectoryId({
  competition: 'Premier League SRL',
  country: 'Simulated Reality',
});
if (srlResolved !== 'excluded') {
  throw new Error(`Simulated Reality fixture should resolve to 'excluded', got '${srlResolved}'`);
}

if (!isSimulatedReality({ competition: 'Premier League SRL' })) {
  throw new Error(`isSimulatedReality should return true for SRL`);
}
if (!isSimulatedReality({ competition: 'Simulated Reality League' })) {
  throw new Error(`isSimulatedReality should return true for Simulated Reality`);
}
if (isSimulatedReality({ competition: 'Premier League', home: 'Arsenal', away: 'Chelsea' })) {
  throw new Error(`isSimulatedReality false positive on normal EPL match`);
}
console.log('✅ Competition classification and separation logic fully verified.');

console.log('\n=== 4. VERIFY DIRECTORY BUILD WITH REAL DATA ===');
const dirResult = buildSportScoreCountryDirectory(fixtures);
console.log(`Total fixtures in directory: ${dirResult.totalMatches}`);
console.log(`Configured country categories: ${dirResult.rows.length}`);

// Sample counts
const englandRow = dirResult.rows.find((r) => r.id === 'england');
const spainRow = dirResult.rows.find((r) => r.id === 'spain');
const intlClubsRow = dirResult.rows.find((r) => r.id === 'international_clubs');
console.log(`England fixture count: ${englandRow?.count}`);
console.log(`Spain fixture count: ${spainRow?.count}`);
console.log(`International Clubs fixture count: ${intlClubsRow?.count}`);

if (!englandRow || englandRow.count === 0) {
  throw new Error('England directory count should be > 0');
}
if (!spainRow || spainRow.count === 0) {
  throw new Error('Spain directory count should be > 0');
}

console.log('\n✅ ALL VERIFICATION GATES PASSED PERFECTLY!');
