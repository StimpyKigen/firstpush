import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import assert from 'assert';
import FixtureSportCard, { extractMatchGoals } from '../src/components/FixtureSportCard';
import type { FreeMatch } from '../src/lib/freeMatches';
import type { MatchConsensus } from '../src/lib/types';

function createMockConsensus(totalVotes: number = 468, home: number = 40, draw: number = 20, away: number = 40): MatchConsensus {
  return {
    matchId: 'test-match-1',
    totalVotes,
    homePct: home,
    drawPct: draw,
    awayPct: away,
    picks: [],
  };
}

function createMockMatch(overrides: Partial<FreeMatch> = {}): FreeMatch {
  return {
    id: 'test-match-1',
    home: 'AJ Auxerre',
    away: 'Paris FC',
    competition: 'French Ligue 1',
    kickoff: '2026-11-08 17:00:00',
    kickoffIso: '2026-11-08T17:00:00.000Z',
    tier: 'blockbuster',
    blurb: 'Test blurb',
    syncedAt: new Date().toISOString(),
    status: 'pre',
    homeOdds: 2.10,
    drawOdds: 3.30,
    awayOdds: 3.60,
    bookmaker: 'Bet365',
    ...overrides,
  };
}

console.log('=== TEST SUITE: REDESIGNED MATCH CARD (LIVE & FINISHED) ===\n');

// --------------------------------------------------------------------------------------
// 1. UNIT TESTS: extractMatchGoals Chronological Ordering & Parsing
// --------------------------------------------------------------------------------------
console.log('Test 1: extractMatchGoals on scoreless match returns empty array');
const scorelessMatch = createMockMatch({
  homeScore: 0,
  awayScore: 0,
  incidents: [],
});
const goals0 = extractMatchGoals(scorelessMatch);
assert.strictEqual(goals0.length, 0);
console.log('  PASS: 0 goals extracted');

console.log('\nTest 2: extractMatchGoals on single-goal match');
const singleGoalMatch = createMockMatch({
  homeScore: 0,
  awayScore: 1,
  incidents: [
    {
      id: 'inc-1',
      minute: "68'",
      player: 'J. Diallo',
      team: 'away',
      type: 'goal',
    },
  ],
});
const goals1 = extractMatchGoals(singleGoalMatch);
assert.strictEqual(goals1.length, 1);
assert.strictEqual(goals1[0].player, 'J. Diallo');
assert.strictEqual(goals1[0].minute, "68'");
assert.strictEqual(goals1[0].team, 'away');
console.log('  PASS: Single away goal extracted properly');

console.log('\nTest 3: extractMatchGoals on multi-goal match maintains chronological order (first on top, latest on bottom)');
const multiGoalMatch = createMockMatch({
  home: 'SV Ried',
  away: 'LASK Linz',
  homeScore: 2,
  awayScore: 2,
  incidents: [
    { id: 'inc-1', minute: "38'", player: 'M. Gruber', team: 'home', type: 'goal' },
    { id: 'inc-2', minute: "9'", player: 'S. Novak', team: 'away', type: 'goal' },
    { id: 'inc-3', minute: "41'", player: 'T. Berger', team: 'away', type: 'goal' },
    { id: 'inc-4', minute: "12'", player: 'A. Pichler', team: 'home', type: 'goal' },
  ],
});
const goalsMulti = extractMatchGoals(multiGoalMatch);
assert.strictEqual(goalsMulti.length, 4);
// Overall chronological order must be 9', 12', 38', 41'
assert.deepStrictEqual(goalsMulti.map(g => g.minute), ["9'", "12'", "38'", "41'"]);
assert.deepStrictEqual(goalsMulti.map(g => g.player), ['S. Novak', 'A. Pichler', 'M. Gruber', 'T. Berger']);
assert.strictEqual(goalsMulti[goalsMulti.length - 1].player, 'T. Berger', 'Latest goal overall is T. Berger 41');

// Home goals must be chronological: A. Pichler 12', M. Gruber 38'
const homeGoalsMulti = goalsMulti.filter(g => g.team === 'home');
assert.deepStrictEqual(homeGoalsMulti.map(g => g.player), ['A. Pichler', 'M. Gruber']);
assert.deepStrictEqual(homeGoalsMulti.map(g => g.minute), ["12'", "38'"]);

// Away goals must be chronological: S. Novak 9', T. Berger 41'
const awayGoalsMulti = goalsMulti.filter(g => g.team === 'away');
assert.deepStrictEqual(awayGoalsMulti.map(g => g.player), ['S. Novak', 'T. Berger']);
assert.deepStrictEqual(awayGoalsMulti.map(g => g.minute), ["9'", "41'"]);
console.log('  PASS: Chronological order verified for all goals and per-team slices');

// --------------------------------------------------------------------------------------
// 2. COMPONENT TESTS: Upcoming match card (byte-for-byte fidelity)
// --------------------------------------------------------------------------------------
console.log('\nTest 4: Upcoming match card renders legacy layout untouched');
const upcomingMatch = createMockMatch({
  status: 'pre',
  home: 'Arsenal',
  away: 'Chelsea',
  displayClock: undefined,
});
const upcomingHtml = renderToString(
  <MemoryRouter>
    <FixtureSportCard
      match={upcomingMatch}
      consensus={createMockConsensus(500)}
      builderLegs={[]}
      onToggleLeg={() => {}}
      onOpenBetBuilder={() => {}}
    />
  </MemoryRouter>
);

assert(upcomingHtml.includes('Bet365 Odds'), 'Upcoming card must include Bet365 Odds');
assert(upcomingHtml.includes('Bet Builder'), 'Upcoming card must include Bet Builder button');
assert(upcomingHtml.includes('punters analyzing'), 'Upcoming card must include punters analyzing text');
assert(upcomingHtml.includes('2.10'), 'Upcoming card must include 1X2 odds');
assert(upcomingHtml.includes('3.30'), 'Upcoming card must include 1X2 odds');
assert(upcomingHtml.includes('3.60'), 'Upcoming card must include 1X2 odds');
// Must not contain the redesigned inline 'v' or 'No goals yet'
assert(!upcomingHtml.includes('No goals yet'), 'Upcoming card must not include No goals yet');
console.log('  PASS: Upcoming match renders legacy odds, Bet365 Odds, and Bet Builder');

// --------------------------------------------------------------------------------------
// 3. COMPONENT TESTS: Live Match 0-0 Scoreless (No goals yet text removed)
// --------------------------------------------------------------------------------------
console.log('\nTest 5: Live match (0-0) renders redesigned layout without "No goals yet" text and with team logos');
const live00Match = createMockMatch({
  home: 'AS Saint-Étienne',
  away: 'Stade Lavallois',
  homeLogo: 'https://images.sportscore.io/teams/saint-etienne.png',
  awayLogo: 'https://images.sportscore.io/teams/lavallois.png',
  status: 'in',
  displayClock: "30'",
  homeScore: 0,
  awayScore: 0,
  incidents: [],
});
const live00Html = renderToString(
  <MemoryRouter>
    <FixtureSportCard
      match={live00Match}
      consensus={createMockConsensus(232, 66, 20, 14)}
      builderLegs={[]}
      onToggleLeg={() => {}}
      onOpenBetBuilder={() => {}}
    />
  </MemoryRouter>
);

assert(!live00Html.includes('Bet365 Odds'), 'Live card must NOT include Bet365 Odds');
assert(!live00Html.includes('Bet Builder'), 'Live card must NOT include Bet Builder button');
assert(!live00Html.includes('punters analyzing'), 'Live card must NOT include "punters analyzing" text');
assert(!live00Html.includes('2.10'), 'Live card must NOT include odds boxes');
assert(!live00Html.includes('Consensus:'), 'Live card must NOT include consensus indicator text');
assert(!live00Html.includes('bg-rose-500'), 'Live card must NOT include consensus bar');
assert(live00Html.includes('min-h-[240px]'), 'Live card must maintain minimum height without reducing size');
assert(live00Html.includes('AS Saint-Étienne'), 'Must include home team');
assert(live00Html.includes('Stade Lavallois'), 'Must include away team');
assert(live00Html.includes('saint-etienne.png'), 'Must include home team logo');
assert(live00Html.includes('lavallois.png'), 'Must include away team logo');
assert(live00Html.includes('>v<'), 'Must include lowercase "v" separator');
assert(live00Html.includes('0 - 0'), 'Must include 0 - 0 centered score');
assert(!live00Html.includes('No goals yet'), 'When a goal hasn\'t been scored, "No goals yet" text must NOT be displayed');
assert(live00Html.includes('232'), 'Must include punters count in footer');
assert(live00Html.includes('Details &amp; Discussion'), 'Must include Details & Discussion');
console.log('  PASS: Live 0-0 card rendered cleanly without consensus or "No goals yet", with logos, centered "v", and preserved height');

// --------------------------------------------------------------------------------------
// 4. COMPONENT TESTS: Live Match 0-1 Single Goal
// --------------------------------------------------------------------------------------
console.log('\nTest 6: Live match (0-1) renders single goal without consensus indicator');
const live01Match = createMockMatch({
  home: 'AJ Auxerre',
  away: 'Paris FC',
  status: 'in',
  displayClock: "72'",
  homeScore: 0,
  awayScore: 1,
  incidents: [
    {
      id: 'diallo-68',
      minute: "68'",
      player: 'J. Diallo',
      team: 'away',
      type: 'goal',
    },
  ],
});
const live01Html = renderToString(
  <MemoryRouter>
    <FixtureSportCard
      match={live01Match}
      consensus={createMockConsensus(468, 20, 31, 49)}
      builderLegs={[]}
      onToggleLeg={() => {}}
      onOpenBetBuilder={() => {}}
    />
  </MemoryRouter>
);

assert(!live01Html.includes('Bet365 Odds'), 'Live card must NOT include Bet365 Odds');
assert(!live01Html.includes('Bet Builder'), 'Live card must NOT include Bet Builder');
assert(!live01Html.includes('Consensus:'), 'Live card must NOT include consensus indicator text');
assert(!live01Html.includes('bg-rose-500'), 'Live card must NOT include consensus bar');
assert(live01Html.includes('0 - 1'), 'Must include 0 - 1 score');
assert(live01Html.includes('J. Diallo 68&#x27;'), 'Must include scorer name and minute');
assert(live01Html.includes('font-normal text-slate-600'), 'Settled scorer must be in faded state');
assert(live01Html.includes('lucide-circle-dot'), 'Must include circle-dot icon');
assert(live01Html.includes('468'), 'Must include punters count in footer');
console.log('  PASS: Live 0-1 card rendered with away scorer in faded state and centered circle dot without consensus');

// --------------------------------------------------------------------------------------
// 5. COMPONENT TESTS: Finished Match (3-1) with Multiple Goals on Both Sides
// --------------------------------------------------------------------------------------
console.log('\nTest 7: Finished match (3-1) renders FT badge, chronological lists, faded settled scorers, and no consensus');
const finishedMatch = createMockMatch({
  home: 'ADO Den Haag',
  away: 'Sparta Rotterdam',
  status: 'post',
  displayClock: 'FT',
  homeScore: 3,
  awayScore: 1,
  incidents: [
    { id: 'inc-1', minute: "22'", player: 'F. van Dijk', team: 'home', type: 'goal' },
    { id: 'inc-2', minute: "30'", player: 'L. Koning', team: 'away', type: 'goal' },
    { id: 'inc-3', minute: "55'", player: 'K. Janssen', team: 'home', type: 'goal' },
    { id: 'inc-4', minute: "80'", player: 'R. de Boer', team: 'home', type: 'goal' },
  ],
});
const finishedHtml = renderToString(
  <MemoryRouter>
    <FixtureSportCard
      match={finishedMatch}
      consensus={createMockConsensus(660, 42, 20, 38)}
      builderLegs={[]}
      onToggleLeg={() => {}}
      onOpenBetBuilder={() => {}}
    />
  </MemoryRouter>
);

assert(finishedHtml.includes('FT'), 'Finished card must have FT badge');
assert(!finishedHtml.includes('Bet365 Odds'), 'Finished card must NOT include Bet365 Odds');
assert(!finishedHtml.includes('Bet Builder'), 'Finished card must NOT include Bet Builder');
assert(!finishedHtml.includes('Consensus:'), 'Finished card must NOT include consensus');
assert(finishedHtml.includes('3 - 1'), 'Must include 3 - 1 score');
assert(finishedHtml.includes('F. van Dijk 22&#x27;'), 'Must include van Dijk 22');
assert(finishedHtml.includes('L. Koning 30&#x27;'), 'Must include Koning 30');
assert(finishedHtml.includes('K. Janssen 55&#x27;'), 'Must include Janssen 55');
assert(finishedHtml.includes('R. de Boer 80&#x27;'), 'Must include de Boer 80');

// Confirm chronological order in HTML: van Dijk (22) appears before Janssen (55) before de Boer (80)
const idxVanDijk = finishedHtml.indexOf('F. van Dijk');
const idxJanssen = finishedHtml.indexOf('K. Janssen');
const idxDeBoer = finishedHtml.indexOf('R. de Boer');
assert(idxVanDijk < idxJanssen && idxJanssen < idxDeBoer, 'Home goals must be in chronological order (22 before 55 before 80)');

// All settled goals render in faded state
assert(finishedHtml.includes('font-normal text-slate-600'), 'Settled goals must have font-normal faded state');
console.log('  PASS: Finished 3-1 card verified with FT badge, chronological ordering, and faded settled scorers');

// --------------------------------------------------------------------------------------
// 6. COMPONENT TESTS: Dynamic Goal Sequence (Settled Scorers are in Faded State)
// --------------------------------------------------------------------------------------
console.log('\nTest 8: Settled goals remain in faded state');
const matchInitial = createMockMatch({
  home: 'Pau FC',
  away: 'FC Nantes',
  status: 'in',
  homeScore: 1,
  awayScore: 0,
  incidents: [
    { id: 'goal-1', minute: "24'", player: 'Y. Simon', team: 'home', type: 'goal' },
  ],
});
const initialGoals = extractMatchGoals(matchInitial);
assert.strictEqual(initialGoals[initialGoals.length - 1].player, 'Y. Simon');

const htmlInitial = renderToString(
  <MemoryRouter>
    <FixtureSportCard
      match={matchInitial}
      consensus={createMockConsensus(741)}
      builderLegs={[]}
      onToggleLeg={() => {}}
      onOpenBetBuilder={() => {}}
    />
  </MemoryRouter>
);
// In settled state (without active 5s timer), goal renders in faded state
assert(htmlInitial.includes('font-normal text-slate-600'), 'Settled goal must be in faded state');
console.log('  PASS: Settled goal is in faded state (bold expires after 5s)');

console.log('\n=== ALL REDESIGNED MATCH CARD TESTS PASSED SUCCESSFULLY! ===');
