import { formatLiveMatchClock, getMatchScorePresentation } from '../src/lib/matchStatus';

console.log('--- TEST: formatLiveMatchClock & Match Presentation ---');

// 1. Direct minute strings
console.assert(formatLiveMatchClock("24'") === "24'", 'Failed 24\'');
console.assert(formatLiveMatchClock("45+2'") === "45+2'", 'Failed 45+2\'');
console.assert(formatLiveMatchClock("78'") === "78'", 'Failed 78\'');
console.assert(formatLiveMatchClock("90+4'") === "90+4'", 'Failed 90+4\'');

// 2. Embedded minute strings
console.assert(formatLiveMatchClock("67 min") === "67'", 'Failed 67 min');
console.assert(formatLiveMatchClock("12m") === "12'", 'Failed 12m');

// 3. Halftime representations
console.assert(formatLiveMatchClock("HT") === "HT", 'Failed HT');
console.assert(formatLiveMatchClock("Half Time", 'halftime') === "HT", 'Failed Half Time');
console.assert(formatLiveMatchClock("halftime") === "HT", 'Failed halftime');

// 4. Elapsed calculation from kickoffIso
const now = Date.now();
const thirtyMinAgoIso = new Date(now - 32 * 60 * 1000).toISOString();
console.assert(formatLiveMatchClock("1st Half", 'first_half', thirtyMinAgoIso) === "32'", 'Failed elapsed 32\'');

const sixtyFiveMinAgoIso = new Date(now - 65 * 60 * 1000).toISOString();
// 65m - 15m HT interval = 50'
const secondHalfMinute = formatLiveMatchClock("2nd Half", 'second_half', sixtyFiveMinAgoIso);
console.assert(secondHalfMinute === "50'", `Failed 2nd half elapsed minute: expected 50', got ${secondHalfMinute}`);

// 5. getMatchScorePresentation
const livePresentation = getMatchScorePresentation(
  'in',
  '55\'',
  '18:00',
  2,
  1,
  thirtyMinAgoIso
);
console.assert(livePresentation.isLive === true, 'Live match should have isLive: true');
console.assert(livePresentation.badgeText === "55'", `Expected 55', got ${livePresentation.badgeText}`);
console.assert(livePresentation.badgeVariant === 'live', `Expected live variant, got ${livePresentation.badgeVariant}`);

const htPresentation = getMatchScorePresentation(
  'in',
  'HT',
  '18:00',
  1,
  0,
  null
);
console.assert(htPresentation.badgeText === 'HT', `Expected HT, got ${htPresentation.badgeText}`);
console.assert(htPresentation.badgeVariant === 'halftime', `Expected halftime variant, got ${htPresentation.badgeVariant}`);

const ftPresentation = getMatchScorePresentation(
  'ft',
  'FT',
  '18:00',
  3,
  1,
  null
);
console.assert(ftPresentation.badgeText === 'FT', `Expected FT, got ${ftPresentation.badgeText}`);
console.assert(ftPresentation.badgeVariant === 'finished', `Expected finished variant, got ${ftPresentation.badgeVariant}`);

console.log('✅ ALL MATCH STATUS & LIVE CLOCK TESTS PASSED!');
