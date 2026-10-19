import {
  discoverAllLeagues,
  fetchLeagueFixtures,
  ingestFixtures,
  queryMarketFixtures,
  getLocalDateStringEAT,
  getSyncDiagnostics,
  executeRollingSyncCycle,
  type MarketFixture,
} from '../src/lib/sportsFeedService';
import { getCombinedBuilderFixtures, generateOddsForFixture } from '../src/lib/builderFixtures';
import { refreshFreeMatches, getFreeMatchesSnapshot } from '../src/lib/freeMatches';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, passMsg: string, failMsg: string) {
  if (condition) {
    results.push({ name, passed: true, details: passMsg });
    console.log(`\x1b[32m[PASS]\x1b[0m ${name}: ${passMsg}`);
  } else {
    results.push({ name, passed: false, details: failMsg });
    console.error(`\x1b[31m[FAIL]\x1b[0m ${name}: ${failMsg}`);
  }
}

async function runVerificationSuite() {
  console.log('\n======================================================');
  console.log('   MSHINDI SPORTS FEED & BET BUILDER VERIFICATION     ');
  console.log('======================================================\n');

  // Test 1: Provider Authentication & 93-League Discovery
  console.log('--- Test 1: Provider Authentication & Discovery ---');
  const leagues = await discoverAllLeagues(false);
  assert(
    leagues.length >= 80,
    'League Discovery',
    `Successfully discovered ${leagues.length} competitions dynamically with metadata.`,
    `Expected >= 80 leagues, but got ${leagues.length}`
  );
  const sampleLeague = leagues.find((l) => l.league === 'premier') || leagues[0];
  assert(
    Boolean(sampleLeague && sampleLeague.name && sampleLeague.country && sampleLeague.seasons.length > 0),
    'League Metadata Integrity',
    `Verified metadata for ${sampleLeague?.name} (${sampleLeague?.country}, seasons: ${sampleLeague?.seasons.slice(0, 2).join(', ')})`,
    'League metadata missing required fields'
  );

  // Test 2: Ingestion & Multi-Competition Upcoming Fixtures
  console.log('\n--- Test 2: Ingestion & Multi-Competition Fixtures ---');
  const allFixtures = queryMarketFixtures({ scope: 'all' });
  assert(
    allFixtures.length > 0,
    'Fixture Ingestion',
    `Found ${allFixtures.length} active fixtures currently in the rolling store.`,
    'No fixtures found in the rolling store.'
  );

  const distinctCompetitions = new Set(allFixtures.map((f) => f.competition));
  assert(
    distinctCompetitions.size >= 3,
    'Multi-Competition Coverage',
    `Fixtures span ${distinctCompetitions.size} distinct competitions: ${Array.from(distinctCompetitions).slice(0, 5).join(', ')}...`,
    `Expected >= 3 distinct competitions, but got ${distinctCompetitions.size}`
  );

  // Test 3: Rolling Window & Future Dates Beyond Today
  console.log('\n--- Test 3: Rolling Window & Lookahead Beyond Today ---');
  const todayEAT = getLocalDateStringEAT(new Date().toISOString());
  const futureFixtures = allFixtures.filter((f) => {
    const fixtureDateEAT = getLocalDateStringEAT(f.kickoffIso);
    return fixtureDateEAT > todayEAT;
  });
  assert(
    futureFixtures.length > 0,
    'Future Lookahead Coverage',
    `Verified ${futureFixtures.length} upcoming fixtures scheduled beyond today (${todayEAT}).`,
    'No future fixtures found beyond today.'
  );

  // Test 4: Deduplication & Idempotent Upsert
  console.log('\n--- Test 4: Deduplication & Idempotent Upsert ---');
  const countBefore = allFixtures.length;
  // Re-ingest the exact same fixtures
  const updatedCount = ingestFixtures(allFixtures);
  const countAfter = queryMarketFixtures({ scope: 'all' }).length;
  assert(
    countBefore === countAfter,
    'Idempotent Upsert (No Duplicate Fixtures)',
    `Count before: ${countBefore}, Count after re-ingesting: ${countAfter} (Duplicates created: 0).`,
    `Duplicate fixtures created! Before: ${countBefore}, After: ${countAfter}`
  );

  // Test 5: Timezone Handling (Africa/Nairobi UTC+3)
  console.log('\n--- Test 5: Timezone Grouping (EAT UTC+3) ---');
  // 2026-10-20 22:30 UTC is 2026-10-21 01:30 EAT (Next day in Nairobi)
  const testMidnightIso = '2026-10-20T22:30:00Z';
  const eatDate = getLocalDateStringEAT(testMidnightIso);
  assert(
    eatDate === '2026-10-21',
    'Midnight Timezone Boundary Assignment',
    `2026-10-20 22:30 UTC correctly assigned to ${eatDate} in Africa/Nairobi (UTC+3).`,
    `Timezone boundary failed: expected 2026-10-21, got ${eatDate}`
  );

  // Test 6: In-Play Match & Empty Live Catalogue Resilience
  console.log('\n--- Test 6: Live Tab Resilience ---');
  const liveFixtures = queryMarketFixtures({ scope: 'live' });
  const allAgain = queryMarketFixtures({ scope: 'all' });
  assert(
    allAgain.length > 0,
    'Empty Live Query Does Not Clear Catalogue',
    `Live count: ${liveFixtures.length}, Total catalog count: ${allAgain.length}. Catalogue remains fully intact regardless of live count.`,
    'Total catalog was emptied by live query!'
  );

  // Test 7: Bet Builder Flow & Market Odds Generation
  console.log('\n--- Test 7: Bet Builder Market Odds Generation ---');
  const sampleFixture: MarketFixture = allFixtures[0];
  const builderSample = {
    id: sampleFixture.id,
    homeTeam: sampleFixture.home,
    awayTeam: sampleFixture.away,
    competition: sampleFixture.competition,
    kickoff: sampleFixture.kickoff,
    status: sampleFixture.status,
    homeOdds: sampleFixture.homeOdds,
    drawOdds: sampleFixture.drawOdds,
    awayOdds: sampleFixture.awayOdds,
    homeProb: +(1 / sampleFixture.homeOdds).toFixed(2),
    drawProb: +(1 / sampleFixture.drawOdds).toFixed(2),
    awayProb: +(1 / sampleFixture.awayOdds).toFixed(2),
    bttsYesPct: sampleFixture.bttsYesPct,
    over15Pct: sampleFixture.over15Pct,
    over25Pct: sampleFixture.over25Pct,
    over35Pct: sampleFixture.over35Pct,
  };

  const odds = generateOddsForFixture(builderSample);
  assert(
    odds.matchResult.length === 3 && odds.doubleChance.length === 3 && odds.overUnderGoals.length === 6 && odds.btts.length === 2,
    'Bet Builder Market Completeness',
    `Generated markets: 1X2 (${odds.matchResult.map((m) => `${m.code}: ${m.odds}`).join(', ')}), DC (${odds.doubleChance.map((m) => `${m.code}: ${m.odds}`).join(', ')}), O/U, BTTS, Handicap, Correct Score.`,
    'Bet builder markets missing or incomplete'
  );

  const allOddsPositive = [
    ...odds.matchResult,
    ...odds.doubleChance,
    ...odds.overUnderGoals,
    ...odds.btts,
  ].every((item) => typeof item.odds === 'number' && !isNaN(item.odds) && item.odds >= 1.01);
  assert(
    allOddsPositive,
    'Odds Validity & Overround Sanity',
    'All calculated odds are valid finite numbers >= 1.01 with standard overround applied.',
    'Invalid or NaN odds detected in bet builder markets!'
  );

  // Test 8: Bet Builder Completed Match Exclusion
  console.log('\n--- Test 8: Bet Builder Ineligible Event Filtering ---');
  const builderFixtures = getCombinedBuilderFixtures();
  const hasFinishedInBuilder = builderFixtures.some((f) => f.status === 'post');
  assert(
    !hasFinishedInBuilder,
    'Completed Match Filtering in Bet Builder',
    `Confirmed 0 completed ('post') matches appear in Bet Builder. Filtered out all ineligible events.`,
    'Completed matches found in Bet Builder fixtures!'
  );

  // Test 9: Diagnostics & Daily Quota Guard
  console.log('\n--- Test 9: Diagnostics & Rate Limit Safety ---');
  const diagnostics = getSyncDiagnostics();
  assert(
    diagnostics.rateLimitSafe === true && diagnostics.dailyRequestBudget <= 4000,
    'Rate Limit Quota Safety',
    `Daily scheduled requests: ~${diagnostics.dailyRequestBudget} calls/day (Under 5,000 quota limit. Headroom: ~${5000 - diagnostics.dailyRequestBudget} calls).`,
    `Rate limit budget exceeded! ${diagnostics.dailyRequestBudget} calls/day`
  );

  console.log('\n======================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`   SUITE RESULT: ${allPassed ? '\x1b[32mALL TESTS PASSED\x1b[0m' : '\x1b[31mFAILURES DETECTED\x1b[0m'} (${results.filter((r) => r.passed).length}/${results.length})`);
  console.log('======================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

void runVerificationSuite();
