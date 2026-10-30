import { parseJackpotFixtureText } from '../src/lib/jackpotWebParser';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log('--- STARTING 15 ACCEPTANCE TESTS FOR JACKPOT FIXTURE PARSER ---');

const REF_DATE = '2026-10-30';

// -----------------------------------------------------------------------------
// Test 1: Exact supplied 17-fixture sample (Format A)
// -----------------------------------------------------------------------------
console.log('Running Test 1: Exact supplied 17-fixture sample...');
const SAMPLE_17_FIXTURES = `
1
Tomorrow 31/10/26 - 18:00
England
Coventry City
Sunderland AFC
home
3.10
draw
3.40
away
2.37

2
Today 30/10/26 - 21:00
France
OGC Nice
Stade Rennais FC
home
2.60
draw
3.60
away
2.65

3
Tomorrow 31/10/26 - 17:00
Spain
Deportivo Alaves
Getafe CF
home
2.15
draw
3.00
away
3.80

4
Tomorrow 31/10/26 - 19:30
Germany
VfL Wolfsburg
FC Augsburg
home
1.90
draw
3.60
away
3.90

5
Tomorrow 31/10/26 - 21:45
Italy
Torino FC
AC Monza
home
2.05
draw
3.20
away
3.95

6
Tomorrow 31/10/26 - 18:00
England
Blackburn Rovers
Queens Park Rangers
home
2.10
draw
3.30
away
3.50

7
Tomorrow 31/10/26 - 18:00
England
Preston North End
Plymouth Argyle
home
1.85
draw
3.50
away
4.20

8
Tomorrow 31/10/26 - 20:00
France
Stade Brest 29
AS Monaco
home
3.40
draw
3.60
away
2.05

9
Tomorrow 31/10/26 - 21:00
Spain
CA Osasuna
Real Valladolid
home
1.70
draw
3.50
away
5.25

10
Tomorrow 31/10/26 - 16:30
Germany
TSG Hoffenheim
St Pauli
home
1.80
draw
3.90
away
4.10

11
Sunday 01/11/26 - 15:00
Italy
Bologna FC
US Lecce
home
1.75
draw
3.40
away
5.00

12
Sunday 01/11/26 - 16:00
France
Le Havre AC
Montpellier HSC
home
2.40
draw
3.30
away
3.00

13
Sunday 01/11/26 - 17:00
England
Tottenham Hotspur
Aston Villa
home
1.95
draw
3.90
away
3.50

14
Sunday 01/11/26 - 18:30
Spain
Athletic Club
Real Betis
home
1.90
draw
3.50
away
4.10

15
Sunday 01/11/26 - 19:30
Germany
Borussia Moenchengladbach
Werder Bremen
home
2.30
draw
3.60
away
2.90

16
Sunday 01/11/26 - 20:00
Italy
Hellas Verona
AS Roma
home
4.20
draw
3.60
away
1.85

17
Sunday 01/11/26 - 22:00
France
FC Nantes
Olympique Marseille
home
3.80
draw
3.60
away
1.95
`;

const res1 = parseJackpotFixtureText(SAMPLE_17_FIXTURES, { referenceDate: REF_DATE });
assert(res1.totalDetected === 17, `Expected 17 detected, got ${res1.totalDetected}`);
assert(res1.totalValid === 17, `Expected 17 valid, got ${res1.totalValid}`);
assert(res1.fixtures[0].homeTeam === 'Coventry City', 'Fixture 1 home team mismatch');
assert(res1.fixtures[0].awayTeam === 'Sunderland AFC', 'Fixture 1 away team mismatch');
assert(res1.fixtures[0].kickoffDate === '2026-10-31', 'Fixture 1 date mismatch');
assert(res1.fixtures[0].kickoffTime === '18:00', 'Fixture 1 time mismatch');
assert(res1.fixtures[0].country === 'England', 'Fixture 1 country mismatch');
assert(res1.fixtures[0].leagueName === null, 'Fixture 1 leagueName should be null');
assert(res1.fixtures[0].originalOrder === 1, 'Fixture 1 originalOrder should be 1');

assert(res1.fixtures[1].homeTeam === 'OGC Nice', 'Fixture 2 home team mismatch');
assert(res1.fixtures[1].awayTeam === 'Stade Rennais FC', 'Fixture 2 away team mismatch');
assert(res1.fixtures[1].kickoffDate === '2026-10-30', 'Fixture 2 date mismatch');
assert(res1.fixtures[1].kickoffTime === '21:00', 'Fixture 2 time mismatch');
assert(res1.fixtures[1].country === 'France', 'Fixture 2 country mismatch');

assert(res1.fixtures[16].homeTeam === 'FC Nantes', 'Fixture 17 home team mismatch');
assert(res1.fixtures[16].originalOrder === 17, 'Fixture 17 originalOrder should be 17');
console.log('✓ Test 1 passed!');

// -----------------------------------------------------------------------------
// Test 2: Different date formats
// -----------------------------------------------------------------------------
console.log('Running Test 2: Different date formats...');
const sampleDates = [
  'Today 30/10/26 - 21:00\nEngland\nArsenal\nChelsea',
  'Tomorrow 31/10/26 - 18:00\nEngland\nArsenal\nChelsea',
  'Sunday 01/11/26 - 16:00\nEngland\nArsenal\nChelsea',
  '2026-11-01 16:00\nEngland\nArsenal\nChelsea',
  'Nov 1, 2026 4:00 PM\nEngland\nArsenal\nChelsea',
];
const res2a = parseJackpotFixtureText(sampleDates[0], { referenceDate: REF_DATE });
assert(res2a.fixtures[0]?.kickoffDate === '2026-10-30' && res2a.fixtures[0]?.kickoffTime === '21:00', 'Today format failed');

const res2b = parseJackpotFixtureText(sampleDates[1], { referenceDate: REF_DATE });
assert(res2b.fixtures[0]?.kickoffDate === '2026-10-31' && res2b.fixtures[0]?.kickoffTime === '18:00', 'Tomorrow format failed');

const res2c = parseJackpotFixtureText(sampleDates[2], { referenceDate: REF_DATE });
assert(res2c.fixtures[0]?.kickoffDate === '2026-11-01' && res2c.fixtures[0]?.kickoffTime === '16:00', 'Sunday DD/MM/YY format failed');

const res2d = parseJackpotFixtureText(sampleDates[3], { referenceDate: REF_DATE });
assert(res2d.fixtures[0]?.kickoffDate === '2026-11-01' && res2d.fixtures[0]?.kickoffTime === '16:00', 'ISO format failed');

const res2e = parseJackpotFixtureText(sampleDates[4], { referenceDate: REF_DATE });
assert(res2e.fixtures[0]?.kickoffDate === '2026-11-01' && res2e.fixtures[0]?.kickoffTime === '16:00', 'Month Day 12h format failed');
console.log('✓ Test 2 passed!');

// -----------------------------------------------------------------------------
// Test 3: Shared date and league heading (Format B)
// -----------------------------------------------------------------------------
console.log('Running Test 3: Shared date and league heading...');
const sample3 = `
Sunday 1 November 2026
England - Premier League

Liverpool
Arsenal
19:30

Chelsea
Manchester United
21:00
`;
const res3 = parseJackpotFixtureText(sample3, { referenceDate: REF_DATE });
assert(res3.totalDetected === 2, `Expected 2 fixtures, got ${res3.totalDetected}`);
assert(res3.fixtures[0].kickoffDate === '2026-11-01', 'Fixture 1 date failed');
assert(res3.fixtures[0].country === 'England', 'Fixture 1 country failed');
assert(res3.fixtures[0].leagueName === 'Premier League', 'Fixture 1 leagueName failed');
assert(res3.fixtures[0].kickoffTime === '19:30', 'Fixture 1 time failed');
assert(res3.fixtures[0].homeTeam === 'Liverpool' && res3.fixtures[0].awayTeam === 'Arsenal', 'Fixture 1 teams failed');

assert(res3.fixtures[1].kickoffDate === '2026-11-01', 'Fixture 2 date failed');
assert(res3.fixtures[1].country === 'England', 'Fixture 2 country failed');
assert(res3.fixtures[1].leagueName === 'Premier League', 'Fixture 2 leagueName failed');
assert(res3.fixtures[1].kickoffTime === '21:00', 'Fixture 2 time failed');
assert(res3.fixtures[1].homeTeam === 'Chelsea' && res3.fixtures[1].awayTeam === 'Manchester United', 'Fixture 2 teams failed');
console.log('✓ Test 3 passed!');

// -----------------------------------------------------------------------------
// Test 4: Betting odds noise
// -----------------------------------------------------------------------------
console.log('Running Test 4: Betting odds noise...');
const sample4 = `
1
Tomorrow 31/10/26 - 18:00
England
Coventry City
Sunderland AFC
home
3.10
draw
3.40
away
2.37
`;
const res4 = parseJackpotFixtureText(sample4, { referenceDate: REF_DATE });
assert(res4.totalDetected === 1, `Expected 1 fixture, got ${res4.totalDetected}`);
assert(res4.fixtures[0].homeTeam === 'Coventry City', 'Home team should not contain odds or labels');
assert(res4.fixtures[0].awayTeam === 'Sunderland AFC', 'Away team should not contain odds or labels');
console.log('✓ Test 4 passed!');

// -----------------------------------------------------------------------------
// Test 5: Team names containing numbers
// -----------------------------------------------------------------------------
console.log('Running Test 5: Team names containing numbers...');
const sample5 = `
1
Tomorrow 31/10/26 - 18:00
Germany
1. FC Cologne
FC Schalke 04
`;
const res5 = parseJackpotFixtureText(sample5, { referenceDate: REF_DATE });
assert(res5.totalDetected === 1, 'Expected 1 fixture');
assert(res5.fixtures[0].homeTeam === '1. FC Cologne', `Expected '1. FC Cologne', got '${res5.fixtures[0].homeTeam}'`);
assert(res5.fixtures[0].awayTeam === 'FC Schalke 04', `Expected 'FC Schalke 04', got '${res5.fixtures[0].awayTeam}'`);
console.log('✓ Test 5 passed!');

// -----------------------------------------------------------------------------
// Test 6: Inline format
// -----------------------------------------------------------------------------
console.log('Running Test 6: Inline format...');
const sample6 = `1. 31/10/2026 18:00 England Premier League Coventry City vs Sunderland AFC`;
const res6 = parseJackpotFixtureText(sample6, { referenceDate: REF_DATE });
assert(res6.totalDetected === 1, 'Expected 1 inline fixture');
assert(res6.fixtures[0].homeTeam === 'Coventry City', 'Inline home team failed');
assert(res6.fixtures[0].awayTeam === 'Sunderland AFC', 'Inline away team failed');
assert(res6.fixtures[0].country === 'England', 'Inline country failed');
assert(res6.fixtures[0].leagueName === 'Premier League', 'Inline leagueName failed');
assert(res6.fixtures[0].kickoffDate === '2026-10-31', 'Inline date failed');
assert(res6.fixtures[0].kickoffTime === '18:00', 'Inline time failed');
console.log('✓ Test 6 passed!');

// -----------------------------------------------------------------------------
// Test 7: Missing league
// -----------------------------------------------------------------------------
console.log('Running Test 7: Missing league...');
const sample7 = `
Tomorrow 31/10/26 - 18:00
England
Coventry City
Sunderland AFC
`;
const res7 = parseJackpotFixtureText(sample7, { referenceDate: REF_DATE });
assert(res7.totalDetected === 1, 'Expected 1 fixture');
assert(res7.fixtures[0].country === 'England', 'Country should be England');
assert(res7.fixtures[0].leagueName === null, 'League name should be null when not provided');
console.log('✓ Test 7 passed!');

// -----------------------------------------------------------------------------
// Test 8: Missing away team
// -----------------------------------------------------------------------------
console.log('Running Test 8: Missing away team...');
const sample8 = `
1
Tomorrow 31/10/26 - 18:00
England
Coventry City
`;
const res8 = parseJackpotFixtureText(sample8, { referenceDate: REF_DATE });
assert(res8.totalDetected === 1, 'Expected 1 detected candidate');
assert(res8.fixtures[0].validationStatus === 'requires_review', 'Should require review when away team is missing');
assert(res8.fixtures[0].homeTeam === 'Coventry City', 'Home team should be preserved');
assert(res8.fixtures[0].awayTeam === '', 'Away team should remain empty');
console.log('✓ Test 8 passed!');

// -----------------------------------------------------------------------------
// Test 9: Different fixture separators
// -----------------------------------------------------------------------------
console.log('Running Test 9: Different fixture separators...');
const sample9 = `
Team A vs Team B
Team C v Team D
Team E versus Team F
Team G @ Team H
`;
const res9 = parseJackpotFixtureText(sample9, { referenceDate: REF_DATE });
assert(res9.totalDetected === 4, `Expected 4 separator fixtures, got ${res9.totalDetected}`);
assert(res9.fixtures[0].homeTeam === 'Team A' && res9.fixtures[0].awayTeam === 'Team B', 'vs separator failed');
assert(res9.fixtures[1].homeTeam === 'Team C' && res9.fixtures[1].awayTeam === 'Team D', 'v separator failed');
assert(res9.fixtures[2].homeTeam === 'Team E' && res9.fixtures[2].awayTeam === 'Team F', 'versus separator failed');
assert(res9.fixtures[3].homeTeam === 'Team G' && res9.fixtures[3].awayTeam === 'Team H', '@ separator failed');
console.log('✓ Test 9 passed!');

// -----------------------------------------------------------------------------
// Test 10: Unrelated bookmaker content
// -----------------------------------------------------------------------------
console.log('Running Test 10: Unrelated bookmaker content...');
const sample10 = `
WELCOME TO MEGA JACKPOT
Log in | Register
Download our App
Deposit now and win Ksh 350,000,000!

1. Arsenal vs Chelsea 31/10/2026 18:00
Bet Slip (0)
Min Stake: 10 KES

2. Liverpool vs Man City 31/10/2026 20:30

Responsible Gambling. BCLB Licence No 0001234. All rights reserved.
`;
const res10 = parseJackpotFixtureText(sample10, { referenceDate: REF_DATE });
assert(res10.totalDetected === 2, `Expected exactly 2 valid fixtures, got ${res10.totalDetected}`);
assert(res10.fixtures[0].homeTeam === 'Arsenal' && res10.fixtures[0].awayTeam === 'Chelsea', 'Match 1 failed');
assert(res10.fixtures[1].homeTeam === 'Liverpool' && res10.fixtures[1].awayTeam === 'Man City', 'Match 2 failed');
console.log('✓ Test 10 passed!');

// -----------------------------------------------------------------------------
// Test 11: Missing fixture numbers
// -----------------------------------------------------------------------------
console.log('Running Test 11: Missing fixture numbers...');
const sample11 = `
Arsenal vs Chelsea 31/10/2026 18:00
Real Madrid vs Barcelona 31/10/2026 21:00
Bayern Munich vs Dortmund 31/10/2026 22:30
`;
const res11 = parseJackpotFixtureText(sample11, { referenceDate: REF_DATE });
assert(res11.totalDetected === 3, 'Expected 3 fixtures');
assert(res11.fixtures[0].originalOrder === 1, 'First fixture should have originalOrder 1');
assert(res11.fixtures[1].originalOrder === 2, 'Second fixture should have originalOrder 2');
assert(res11.fixtures[2].originalOrder === 3, 'Third fixture should have originalOrder 3');
console.log('✓ Test 11 passed!');

// -----------------------------------------------------------------------------
// Test 12: Large input (200+ fixtures)
// -----------------------------------------------------------------------------
console.log('Running Test 12: Large input (200+ fixtures)...');
const largeLines: string[] = [];
for (let i = 1; i <= 210; i++) {
  largeLines.push(`${i}. Team Home ${i} vs Team Away ${i} 31/10/2026 18:00 Premier League`);
}
const res12 = parseJackpotFixtureText(largeLines.join('\n'), { referenceDate: REF_DATE });
assert(res12.totalDetected === 210, `Expected 210 fixtures, got ${res12.totalDetected}`);
assert(res12.totalValid === 210, `Expected 210 valid, got ${res12.totalValid}`);
assert(res12.fixtures[209].originalOrder === 210, 'Last fixture originalOrder should be 210');
console.log('✓ Test 12 passed!');

// -----------------------------------------------------------------------------
// Test 13: Weekday/date mismatch
// -----------------------------------------------------------------------------
console.log('Running Test 13: Weekday/date mismatch...');
// 01/11/2026 is a Sunday. If text says "Monday 01/11/26", that is a conflict.
const sample13 = `
1
Monday 01/11/26 - 16:00
England
Arsenal
Chelsea
`;
const res13 = parseJackpotFixtureText(sample13, { referenceDate: REF_DATE });
assert(res13.totalDetected === 1, 'Expected 1 fixture');
assert(res13.fixtures[0].kickoffDate === '2026-11-01', 'Calendar date should not be silently changed');
assert(res13.fixtures[0].validationStatus === 'requires_review', 'Should be flagged for review due to weekday conflict');
console.log('✓ Test 13 passed!');

// -----------------------------------------------------------------------------
// Test 14: Multiple competitions context inheritance
// -----------------------------------------------------------------------------
console.log('Running Test 14: Multiple competitions...');
const sample14 = `
England - Premier League
Saturday 31 October 2026
Arsenal
Chelsea
17:00

Liverpool
Everton
19:30

Spain - La Liga
Real Madrid
Barcelona
21:00

Atletico Madrid
Sevilla
23:00
`;
const res14 = parseJackpotFixtureText(sample14, { referenceDate: REF_DATE });
assert(res14.totalDetected === 4, `Expected 4 fixtures, got ${res14.totalDetected}`);
assert(res14.fixtures[0].country === 'England' && res14.fixtures[0].leagueName === 'Premier League', 'Fixture 1 league failed');
assert(res14.fixtures[1].country === 'England' && res14.fixtures[1].leagueName === 'Premier League', 'Fixture 2 league failed');
assert(res14.fixtures[2].country === 'Spain' && res14.fixtures[2].leagueName === 'La Liga', 'Fixture 3 league failed');
assert(res14.fixtures[3].country === 'Spain' && res14.fixtures[3].leagueName === 'La Liga', 'Fixture 4 league failed');
console.log('✓ Test 14 passed!');

// -----------------------------------------------------------------------------
// Test 15: Duplicate-looking fixtures
// -----------------------------------------------------------------------------
console.log('Running Test 15: Duplicate-looking fixtures...');
const sample15 = `
1. Arsenal vs Chelsea 24/10/2026 17:00 Premier League
2. Arsenal vs Chelsea 31/10/2026 20:00 Champions League
`;
const res15 = parseJackpotFixtureText(sample15, { referenceDate: REF_DATE });
assert(res15.totalDetected === 2, 'Expected 2 fixtures');
assert(res15.fixtures[0].kickoffDate === '2026-10-24', 'First match date failed');
assert(res15.fixtures[1].kickoffDate === '2026-10-31', 'Second match date failed');
assert(res15.fixtures[0].originalOrder === 1 && res15.fixtures[1].originalOrder === 2, 'Orders should remain distinct');
console.log('✓ Test 15 passed!');

console.log('================================================================');
console.log('ALL 15 ACCEPTANCE TESTS PASSED WITH 100% ACCURACY AND SUCCESS!');
console.log('================================================================');

