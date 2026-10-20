import {
  parseFixtureKickoffMs,
  isUpcomingEligible,
  sortUpcomingComparator,
  sortHighlightsComparator,
  getDeviceLocalDateString,
  formatDeviceLocalTime,
  getCompetitionPriorityScore,
} from '../src/lib/competitionPriority';
import { normalizeMatchStatus } from '../src/lib/matchStatus';
import { BUNDLED_SPORTS_CATALOGUE } from '../src/data/bundledSportsCatalogue';
import { getLeagueMetadata } from '../src/lib/leagueDirectory';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('================================================================');
console.log('   MSHINDI REAL-TIME DEVICE CLOCK UPCOMING TEST SUITE           ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// Requirement 1: At 14:28, a 14:30 fixture is first in Upcoming.
// Requirement 2: A 14:00 fixture is excluded from Upcoming.
// -----------------------------------------------------------------------------
console.log('Test 1 & 2: Chronological Ordering & Cutoff relative to Device Clock (14:28)');
{
  const mockDeviceClock1428 = new Date('2026-10-20T14:28:00Z').getTime();

  const mockFixtures = [
    { id: 'match-a', home: 'Team A', away: 'Away A', kickoffIso: '2026-10-20T14:00:00Z', status: 'pre' },
    { id: 'match-b', home: 'Team B', away: 'Away B', kickoffIso: '2026-10-20T14:15:00Z', status: 'pre' },
    { id: 'match-d', home: 'Team D', away: 'Away D', kickoffIso: '2026-10-20T15:00:00Z', status: 'pre' },
    { id: 'match-c', home: 'Team C', away: 'Away C', kickoffIso: '2026-10-20T14:30:00Z', status: 'pre' },
  ];

  // Match A (14:00) and Match B (14:15) must be excluded
  assert(isUpcomingEligible(mockFixtures[0], mockDeviceClock1428) === false, 'Match A (14:00) excluded at 14:28');
  assert(isUpcomingEligible(mockFixtures[1], mockDeviceClock1428) === false, 'Match B (14:15) excluded at 14:28');

  // Match C (14:30) and Match D (15:00) must be included
  assert(isUpcomingEligible(mockFixtures[2], mockDeviceClock1428) === true, 'Match D (15:00) included at 14:28');
  assert(isUpcomingEligible(mockFixtures[3], mockDeviceClock1428) === true, 'Match C (14:30) included at 14:28');

  // Filter and sort Upcoming list
  const upcomingList = mockFixtures
    .filter((f) => isUpcomingEligible(f, mockDeviceClock1428))
    .sort(sortUpcomingComparator);

  assert(upcomingList.length === 2, `Upcoming list has exactly 2 matches (got ${upcomingList.length})`);
  assert(upcomingList[0].id === 'match-c', 'Match C (14:30) is FIRST in Upcoming list');
  assert(upcomingList[1].id === 'match-d', 'Match D (15:00) is SECOND in Upcoming list');
}

// -----------------------------------------------------------------------------
// Requirement 3: A fixture starting exactly at the current instant is excluded.
// -----------------------------------------------------------------------------
console.log('\nTest 3: Fixture starting exactly at current instant is strictly excluded');
{
  const exactInstant = new Date('2026-10-20T14:28:00.000Z').getTime();
  const fixtureAtExactInstant = {
    id: 'match-exact',
    home: 'Exact FC',
    away: 'Now FC',
    kickoffIso: '2026-10-20T14:28:00.000Z',
    status: 'pre',
  };

  assert(
    isUpcomingEligible(fixtureAtExactInstant, exactInstant) === false,
    'Match at exactly 14:28:00.000 is excluded when device time is 14:28:00.000 (kickoffMs > nowMs strictly)'
  );

  // 1 millisecond later
  const fixture1MsLater = {
    id: 'match-future-1ms',
    home: 'Future FC',
    away: 'Upcoming FC',
    kickoffIso: '2026-10-20T14:28:00.001Z',
    status: 'pre',
  };
  assert(
    isUpcomingEligible(fixture1MsLater, exactInstant) === true,
    'Match starting 1ms in the future is included'
  );
}

// -----------------------------------------------------------------------------
// Requirement 4: A future fixture in a different time zone is compared correctly.
// -----------------------------------------------------------------------------
console.log('\nTest 4: Correct epoch comparison across timezones with offsets');
{
  const mockDeviceClockUTC = new Date('2026-10-20T14:28:00Z').getTime();

  // 17:30 in UTC+3 (EAT) is 14:30 UTC -> Future by 2 minutes
  const eatFutureFixture = {
    id: 'eat-future',
    kickoffIso: '2026-10-20T17:30:00+03:00',
    status: 'pre',
  };

  // 10:20 in UTC-4 (EDT) is 14:20 UTC -> Past by 8 minutes
  const edtPastFixture = {
    id: 'edt-past',
    kickoffIso: '2026-10-20T10:20:00-04:00',
    status: 'pre',
  };

  // 23:35 in UTC+9 (JST) is 14:35 UTC -> Future by 7 minutes
  const jstFutureFixture = {
    id: 'jst-future',
    kickoffIso: '2026-10-20T23:35:00+09:00',
    status: 'pre',
  };

  assert(isUpcomingEligible(eatFutureFixture, mockDeviceClockUTC) === true, '17:30+03:00 (14:30 UTC) is upcoming');
  assert(isUpcomingEligible(edtPastFixture, mockDeviceClockUTC) === false, '10:20-04:00 (14:20 UTC) is excluded');
  assert(isUpcomingEligible(jstFutureFixture, mockDeviceClockUTC) === true, '23:35+09:00 (14:35 UTC) is upcoming');

  // Verify sorting across mixed time zone formats
  const mixedTz = [jstFutureFixture, eatFutureFixture].sort(sortUpcomingComparator);
  assert(mixedTz[0].id === 'eat-future', 'Mixed TZ sort: 14:30 UTC sorted before 14:35 UTC');
  assert(mixedTz[1].id === 'jst-future', 'Mixed TZ sort: 14:35 UTC sorted second');
}

// -----------------------------------------------------------------------------
// Requirement 5: A live match with a future or incorrect kickoff timestamp is still excluded.
// -----------------------------------------------------------------------------
console.log('\nTest 5: Live / completed matches with future timestamps are strictly excluded');
{
  const mockDeviceClock = new Date('2026-10-20T14:00:00Z').getTime();

  const liveWithFutureKickoff = {
    id: 'live-future',
    kickoffIso: '2026-10-20T16:00:00Z', // Timestamp in future
    status: 'in', // Provider reports live
    statusText: '1H 24\'',
  };

  const finishedWithFutureKickoff = {
    id: 'post-future',
    kickoffIso: '2026-10-20T18:00:00Z',
    status: 'post',
    statusText: 'FT',
  };

  assert(
    isUpcomingEligible(liveWithFutureKickoff, mockDeviceClock) === false,
    'Live match with future kickoff is excluded from Upcoming'
  );
  assert(
    isUpcomingEligible(finishedWithFutureKickoff, mockDeviceClock) === false,
    'Finished match with future kickoff is excluded from Upcoming'
  );
}

// -----------------------------------------------------------------------------
// Requirement 6: A postponed fixture is excluded.
// -----------------------------------------------------------------------------
console.log('\nTest 6: Postponed, cancelled, abandoned, and suspended fixtures are excluded');
{
  const futureIso = '2026-10-20T20:00:00Z';
  const mockDeviceClock = new Date('2026-10-20T14:00:00Z').getTime();

  assert(isUpcomingEligible({ kickoffIso: futureIso, status: 'postponed' }, mockDeviceClock) === false, 'Postponed fixture excluded');
  assert(isUpcomingEligible({ kickoffIso: futureIso, status: 'cancelled' }, mockDeviceClock) === false, 'Cancelled fixture excluded');
  assert(isUpcomingEligible({ kickoffIso: futureIso, status: 'abandoned' }, mockDeviceClock) === false, 'Abandoned fixture excluded');
  assert(isUpcomingEligible({ kickoffIso: futureIso, status: 'suspended' }, mockDeviceClock) === false, 'Suspended fixture excluded');
  assert(isUpcomingEligible({ kickoffIso: futureIso, status: 'pre', statusText: 'Match Postponed' }, mockDeviceClock) === false, 'StatusText Postponed excluded');
}

// -----------------------------------------------------------------------------
// Requirement 7: The Upcoming list updates without a page reload as time passes.
// -----------------------------------------------------------------------------
console.log('\nTest 7: Dynamic time progression drops elapsed fixtures automatically');
{
  const fixtures = [
    { id: 'match-1430', kickoffIso: '2026-10-20T14:30:00Z', status: 'pre' },
    { id: 'match-1445', kickoffIso: '2026-10-20T14:45:00Z', status: 'pre' },
    { id: 'match-1500', kickoffIso: '2026-10-20T15:00:00Z', status: 'pre' },
  ];

  // Tick 1: at 14:28:00
  let currentClock = new Date('2026-10-20T14:28:00Z').getTime();
  let list = fixtures.filter((f) => isUpcomingEligible(f, currentClock)).sort(sortUpcomingComparator);
  assert(list.length === 3 && list[0].id === 'match-1430', 'At 14:28: 3 upcoming, 14:30 is first');

  // Tick 2: clock moves to 14:30:01 (match-1430 has started)
  currentClock = new Date('2026-10-20T14:30:01Z').getTime();
  list = fixtures.filter((f) => isUpcomingEligible(f, currentClock)).sort(sortUpcomingComparator);
  assert(list.length === 2, `At 14:30:01: 14:30 match removed (remaining: ${list.length})`);
  assert(list[0].id === 'match-1445', 'At 14:30:01: match-1445 automatically becomes new first item');

  // Tick 3: clock moves to 14:45:01 (match-1445 has started)
  currentClock = new Date('2026-10-20T14:45:01Z').getTime();
  list = fixtures.filter((f) => isUpcomingEligible(f, currentClock)).sort(sortUpcomingComparator);
  assert(list.length === 1 && list[0].id === 'match-1500', 'At 14:45:01: match-1500 is only upcoming match');

  // Tick 4: clock moves to 15:00:01 (all matches have started)
  currentClock = new Date('2026-10-20T15:00:01Z').getTime();
  list = fixtures.filter((f) => isUpcomingEligible(f, currentClock)).sort(sortUpcomingComparator);
  assert(list.length === 0, 'At 15:00:01: Upcoming list is empty without page reload');
}

// -----------------------------------------------------------------------------
// Requirement 8: Today and Tomorrow filters use the device's local calendar date.
// -----------------------------------------------------------------------------
console.log('\nTest 8: Today & Tomorrow date boundaries use device local calendar');
{
  // Test local date generator
  const sampleDate = new Date(2026, 9, 20); // 2026-10-20 in local system
  const dateStr = getDeviceLocalDateString(sampleDate);
  assert(dateStr === '2026-10-20', `Local date formatted as YYYY-MM-DD: got "${dateStr}"`);

  // Test midnight transition:
  const beforeMidnight = new Date(2026, 9, 20, 23, 59, 50).getTime();
  const todayBefore = getDeviceLocalDateString(beforeMidnight);
  const tomorrowBeforeObj = new Date(beforeMidnight);
  tomorrowBeforeObj.setDate(tomorrowBeforeObj.getDate() + 1);
  const tomorrowBefore = getDeviceLocalDateString(tomorrowBeforeObj);

  assert(todayBefore === '2026-10-20', 'Before midnight today is 2026-10-20');
  assert(tomorrowBefore === '2026-10-21', 'Before midnight tomorrow is 2026-10-21');

  // After midnight tick:
  const afterMidnight = new Date(2026, 9, 21, 0, 0, 15).getTime();
  const todayAfter = getDeviceLocalDateString(afterMidnight);
  const tomorrowAfterObj = new Date(afterMidnight);
  tomorrowAfterObj.setDate(tomorrowAfterObj.getDate() + 1);
  const tomorrowAfter = getDeviceLocalDateString(tomorrowAfterObj);

  assert(todayAfter === '2026-10-21', 'After midnight today automatically flips to 2026-10-21');
  assert(tomorrowAfter === '2026-10-22', 'After midnight tomorrow automatically flips to 2026-10-22');
}

// -----------------------------------------------------------------------------
// Requirement 9: Competition filtering continues to work.
// -----------------------------------------------------------------------------
console.log('\nTest 9: Competition filtering works with moving clock cutoff');
{
  const mockClock = new Date('2026-10-20T12:00:00Z').getTime();

  // Filter all UCL fixtures that are upcoming relative to mockClock
  const upcomingUCL = BUNDLED_SPORTS_CATALOGUE.fixtures.filter((f) => {
    const isUpcoming = isUpcomingEligible(f, mockClock);
    const meta = getLeagueMetadata(f.competition);
    return isUpcoming && meta.standardName === 'UEFA Champions League';
  }).sort(sortUpcomingComparator);

  assert(upcomingUCL.length === 9, `UCL competition filter preserves all 9 matches (found: ${upcomingUCL.length})`);
  const earliestUclMs = parseFixtureKickoffMs(upcomingUCL[0]);
  const expected1645Ms = new Date('2026-10-20T16:45:00Z').getTime();
  assert(
    earliestUclMs === expected1645Ms,
    `Earliest UCL match (16:45 UTC) is first: "${upcomingUCL[0].home} vs ${upcomingUCL[0].away}" at 16:45 UTC`
  );
}

// -----------------------------------------------------------------------------
// Requirement 10: Highlights ordering remains unchanged.
// -----------------------------------------------------------------------------
console.log('\nTest 10: Highlights competition-priority ranking remains intact');
{
  const uclMatch = {
    id: 'ucl-1',
    competition: 'UEFA Champions League',
    status: 'pre',
    kickoffIso: '2026-10-20T19:00:00Z',
  };
  const premierMatch = {
    id: 'pl-1',
    competition: 'Premier League',
    status: 'pre',
    kickoffIso: '2026-10-20T14:30:00Z', // Earlier kickoff, but lower prestige tier
  };

  // In Highlights: UCL (Tier 1 = 1000 pts) MUST come before Premier League (Tier 4 = 750 pts)
  const highlightsSort = [premierMatch, uclMatch].sort(sortHighlightsComparator);
  assert(highlightsSort[0].id === 'ucl-1', 'Highlights order: UCL (Tier 1) ranks BEFORE Premier League (Tier 4)');

  // In Upcoming: Premier League (14:30) MUST come before UCL (19:00) due to strict chronological ordering
  const upcomingSort = [uclMatch, premierMatch].sort(sortUpcomingComparator);
  assert(upcomingSort[0].id === 'pl-1', 'Upcoming order: 14:30 PL comes BEFORE 19:00 UCL (strictly chronological)');
}

// -----------------------------------------------------------------------------
// Requirement 11: Missing or invalid kickoff timestamps do not crash interface or get treated as valid.
// -----------------------------------------------------------------------------
console.log('\nTest 11: Missing or invalid timestamps handled safely without crash');
{
  const invalidFixtures = [
    { id: 'inv-1', status: 'pre' }, // Missing kickoffIso and kickoff
    { id: 'inv-2', kickoffIso: null, status: 'pre' },
    { id: 'inv-3', kickoffIso: undefined, status: 'pre' },
    { id: 'inv-4', kickoffIso: '', status: 'pre' },
    { id: 'inv-5', kickoffIso: 'not-a-valid-date', status: 'pre' },
    { id: 'inv-6', kickoffIso: 'TBD', status: 'pre' },
    { id: 'inv-7', kickoffIso: 'Invalid Date', status: 'pre' },
    null,
    undefined,
  ];

  invalidFixtures.forEach((f, idx) => {
    let result = false;
    let didCrash = false;
    try {
      result = isUpcomingEligible(f as any);
    } catch {
      didCrash = true;
    }
    assert(!didCrash, `Invalid fixture #${idx + 1} did not crash parser`);
    assert(result === false, `Invalid fixture #${idx + 1} is excluded from Upcoming`);
  });

  // Verify parseFixtureKickoffMs returns null for invalid inputs
  assert(parseFixtureKickoffMs(null) === null, 'parseFixtureKickoffMs(null) is null');
  assert(parseFixtureKickoffMs(undefined) === null, 'parseFixtureKickoffMs(undefined) is null');
  assert(parseFixtureKickoffMs({ kickoffIso: 'gibberish' }) === null, 'parseFixtureKickoffMs("gibberish") is null');
  assert(parseFixtureKickoffMs({ kickoffIso: '' }) === null, 'parseFixtureKickoffMs("") is null');
}

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${testsPassed} passed, ${testsFailed} failed`);
console.log('================================================================');

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
