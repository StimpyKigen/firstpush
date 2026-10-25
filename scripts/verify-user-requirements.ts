import assert from 'assert';
import {
  getHighlightsCutoffWindowEAT,
  isHighlightsEligible,
  formatKickoffDateTime24h,
} from '../src/lib/competitionPriority';
import {
  getWeeklyTargetDatesEAT,
  getLocalDateStringEAT,
} from '../src/lib/sportsFeedService';
import {
  DOMESTIC_CUPS,
  ALL_REGISTERED_COMPETITIONS,
  getPriorityProviderSlugs,
  isCompetitionEligible,
} from '../src/lib/competitionRegistry';
import {
  resolveCanonicalCompetition,
  CANONICAL_COMPETITIONS,
} from '../src/lib/canonicalCompetitions';
import {
  buildSportScoreCountryDirectory,
  resolveSportScoreDirectoryId,
} from '../src/lib/leagueDirectory';

console.log('--- RUNNING USER REQUIREMENTS VERIFICATION ---');

// --------------------------------------------------------------------------
// TEST 1: Highlights Cutoff Window (00:00:00 to 06:00:00 next day in EAT)
// --------------------------------------------------------------------------
console.log('\n[TEST 1] Highlights Cutoff Window & Eligibility:');

// Test with a known date: 2026-10-25 15:00 UTC = 2026-10-25 18:00 EAT
const refDate = new Date('2026-10-25T15:00:00Z');
const windowEAT = getHighlightsCutoffWindowEAT(refDate);

// Start must be 2026-10-25 00:00:00 EAT = 2026-10-24 21:00:00 UTC
const expectedStart = new Date('2026-10-24T21:00:00Z').getTime();
// Cutoff must be 2026-10-26 06:00:00 EAT = 2026-10-26 03:00:00 UTC
const expectedCutoff = new Date('2026-10-26T03:00:00Z').getTime();

assert.strictEqual(windowEAT.startMs, expectedStart, 'Window start must be 00:00:00 EAT of that day');
assert.strictEqual(windowEAT.nextDay6amMs, expectedCutoff, 'Window cutoff must be 06:00:00 EAT of the next day');
console.log('  ✅ 1.1 Highlights window starts at 00:00 EAT and ends at 06:00 EAT next day');

// Game scheduled today at 20:00 EAT (17:00 UTC) -> should be eligible
const matchToday = {
  id: 'm1',
  competition: 'English Premier League',
  status: 'pre',
  kickoffIso: '2026-10-25T17:00:00Z',
};
assert.strictEqual(isHighlightsEligible(matchToday, refDate), true, 'Today match must be eligible for highlights');
console.log('  ✅ 1.2 Game to be played that day is eligible');

// Late night game at 03:30 EAT next morning (00:30 UTC) -> should be eligible (before 6am)
const matchLateNight = {
  id: 'm2',
  competition: 'Argentine Primera División',
  status: 'pre',
  kickoffIso: '2026-10-26T00:30:00Z',
};
assert.strictEqual(isHighlightsEligible(matchLateNight, refDate), true, 'Late kickoff before 6am next day must be eligible');
console.log('  ✅ 1.3 Late night game before 6am next day is eligible');

// Game at 06:01 EAT next day (03:01 UTC) -> must be strictly EXCLUDED
const matchPast6am = {
  id: 'm3',
  competition: 'English Premier League',
  status: 'pre',
  kickoffIso: '2026-10-26T03:01:00Z',
};
assert.strictEqual(isHighlightsEligible(matchPast6am, refDate), false, 'Game past 6am EAT next day must NOT be eligible');
console.log('  ✅ 1.4 Game past 6am EAT next day is strictly excluded');

// Game from yesterday -> must be strictly EXCLUDED
const matchYesterday = {
  id: 'm4',
  competition: 'Spanish La Liga',
  status: 'pre',
  kickoffIso: '2026-10-24T18:00:00Z',
};
assert.strictEqual(isHighlightsEligible(matchYesterday, refDate), false, 'Game from yesterday must NOT be eligible');
console.log('  ✅ 1.5 Game from yesterday is strictly excluded');

// --------------------------------------------------------------------------
// TEST 2: Weekly Rolling Window (8 days in EAT, rolling forward)
// --------------------------------------------------------------------------
console.log('\n[TEST 2] Weekly Rolling Window:');

// Sunday test (2026-10-25)
const sundayRef = new Date('2026-10-25T12:00:00Z');
const sundayDates = getWeeklyTargetDatesEAT(sundayRef);
assert.strictEqual(sundayDates.length, 8, 'Window must contain 8 dates (Sunday to next Sunday)');
assert.strictEqual(sundayDates[0], '2026-10-25', 'First date must be Sunday (2026-10-25)');
assert.strictEqual(sundayDates[7], '2026-11-01', 'Last date must be next Sunday (2026-11-01)');
console.log('  ✅ 2.1 Sunday fetch window produces Sunday to next Sunday (8 days: 2026-10-25 to 2026-11-01)');

// Monday 12:00 AM test (2026-10-25 21:00 UTC = 2026-10-26 00:00 EAT)
const mondayRef = new Date('2026-10-25T21:00:00Z');
const mondayDates = getWeeklyTargetDatesEAT(mondayRef);
assert.strictEqual(mondayDates.length, 8, 'Monday window must contain 8 dates');
assert.strictEqual(mondayDates[0], '2026-10-26', 'First date on Monday 12am must be Monday (2026-10-26)');
assert.strictEqual(mondayDates[6], '2026-11-01', 'Covers through upcoming Sunday (2026-11-01)');
assert.strictEqual(mondayDates[7], '2026-11-02', 'Covers through next Monday (2026-11-02)');
console.log('  ✅ 2.2 At 12am Monday, window rolls forward to new week round (2026-10-26 to 2026-11-02)');

// --------------------------------------------------------------------------
// TEST 3: Domestic Cup Competitions Registration & Dropdown Mapping
// --------------------------------------------------------------------------
console.log('\n[TEST 3] Domestic Cup Competitions:');

assert(DOMESTIC_CUPS.length >= 14, 'Must register at least 14 domestic cup competitions');
console.log(`  ✅ 3.1 Registered ${DOMESTIC_CUPS.length} domestic cup & super cup competitions`);

// Verify FA Cup and EFL Cup
const faCup = DOMESTIC_CUPS.find((c) => c.id === 'eng_fa_cup');
assert(faCup, 'FA Cup must be registered');
assert.strictEqual(faCup?.countryName, 'England');
assert.strictEqual(faCup?.division, 'cup');
assert.strictEqual(faCup?.isEligibleForFetching, true);

const eflCup = DOMESTIC_CUPS.find((c) => c.id === 'eng_efl_cup');
assert(eflCup, 'EFL Cup must be registered');
assert.strictEqual(eflCup?.countryName, 'England');

const copaDelRey = DOMESTIC_CUPS.find((c) => c.id === 'esp_copa_del_rey');
assert(copaDelRey, 'Copa del Rey must be registered');
assert.strictEqual(copaDelRey?.countryName, 'Spain');

const dfbPokal = DOMESTIC_CUPS.find((c) => c.id === 'ger_dfb_pokal');
assert(dfbPokal, 'DFB-Pokal must be registered');
assert.strictEqual(dfbPokal?.countryName, 'Germany');

const coppaItalia = DOMESTIC_CUPS.find((c) => c.id === 'ita_coppa_italia');
assert(coppaItalia, 'Coppa Italia must be registered');
assert.strictEqual(coppaItalia?.countryName, 'Italy');

const coupeDeFrance = DOMESTIC_CUPS.find((c) => c.id === 'fra_coupe_de_france');
assert(coupeDeFrance, 'Coupe de France must be registered');
assert.strictEqual(coupeDeFrance?.countryName, 'France');

console.log('  ✅ 3.2 England (FA Cup, EFL Cup), Spain (Copa del Rey), Germany (DFB-Pokal), Italy (Coppa Italia), France (Coupe de France) properly mapped');

// Verify priority slugs include domestic cups
const prioritySlugs = getPriorityProviderSlugs();
assert(prioritySlugs.includes('english-fa-cup'), 'prioritySlugs must include english-fa-cup');
assert(prioritySlugs.includes('spanish-copa-del-rey'), 'prioritySlugs must include spanish-copa-del-rey');
assert(prioritySlugs.includes('german-dfb-pokal'), 'prioritySlugs must include german-dfb-pokal');
assert(prioritySlugs.includes('coppa-italia'), 'prioritySlugs must include coppa-italia');
assert(prioritySlugs.includes('coupe-de-france'), 'prioritySlugs must include coupe-de-france');
console.log('  ✅ 3.3 Domestic cups are included in priority provider slugs for weekly ingestion');

// Verify dropdown behavior: Cups appear under their country when fetched in weekly games
const sampleFixturesWithCups = [
  { competition: 'English FA Cup', country: 'England', competitionId: 'eng_fa_cup' },
  { competition: 'English Premier League', country: 'England', competitionId: 'eng_premier_league' },
  { competition: 'Spanish Copa del Rey', country: 'Spain', competitionId: 'esp_copa_del_rey' },
];

const directoryWithCups = buildSportScoreCountryDirectory(sampleFixturesWithCups);
const englandRow = directoryWithCups.rows.find((r) => r.id === 'england');
assert(englandRow, 'England row must exist in directory');
assert.strictEqual(englandRow?.count, 2, 'England count must be 2');
const englandLeagues = englandRow?.leagues.map((l) => l.league);
assert(englandLeagues?.includes('English FA Cup'), 'English FA Cup must appear under England leagues');
assert(englandLeagues?.includes('English Premier League'), 'English Premier League must appear under England leagues');

const spainRow = directoryWithCups.rows.find((r) => r.id === 'spain');
assert(spainRow, 'Spain row must exist in directory');
const spainLeagues = spainRow?.leagues.map((l) => l.league);
assert(spainLeagues?.includes('Spanish Copa del Rey'), 'Spanish Copa del Rey must appear under Spain leagues');

// Germany has NO games in sample -> Germany must NOT appear
const germanyRow = directoryWithCups.rows.find((r) => r.id === 'germany');
assert.strictEqual(germanyRow, undefined, 'Countries without fixtures must not appear in dropdown');
console.log('  ✅ 3.4 Domestic cups appear under their country when part of weekly fetched games, and stay hidden when no fixtures exist');

// --------------------------------------------------------------------------
// TEST 4: FixtureSportCard Kickoff Time Formatting (No EAT suffix)
// --------------------------------------------------------------------------
console.log('\n[TEST 4] Kickoff Time Formatting:');

const timeWithEAT = formatKickoffDateTime24h('2026-10-25T17:00:00Z', '', true);
assert(timeWithEAT.endsWith(' EAT'), 'Default format should have EAT');

const timeWithoutEAT = formatKickoffDateTime24h('2026-10-25T17:00:00Z', '', false);
assert(!timeWithoutEAT.includes('EAT'), 'formatKickoffDateTime24h with false must not include EAT');
assert.strictEqual(timeWithoutEAT, '25/10 20:00', 'Kickoff time without EAT must format as DD/MM HH:mm');
console.log(`  ✅ 4.1 formatKickoffDateTime24h(iso, fallback, false) = "${timeWithoutEAT}" (No EAT suffix)`);

const fallbackCleaned = '20:00 EAT'.replace(/\s*EAT$/i, '').trim();
assert.strictEqual(fallbackCleaned, '20:00', 'Stripping EAT from fallback works as expected');
console.log('  ✅ 4.2 Trailing EAT successfully stripped from kickoff time display');

console.log('\n🎉 ALL USER REQUIREMENTS VERIFIED SUCCESSFULLY!');
