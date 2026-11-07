/**
 * Live-update verification suite (run: npx tsx scripts/verify-live-updates.ts)
 *
 * Exercises the permanent live-update invariants documented in docs/LIVE_MATCH_UPDATES.md:
 *  1. Provider incident normalisation (using the REAL SportScore payload shape captured from
 *     https://sportscore.com/api/widget/match/ — type/type_id/side/player/is_goal/is_card/is_sub,
 *     goal incidents carrying home_score/away_score).
 *  2. Authoritative merge: stale/out-of-order data, FT never reverting, fixture refreshes never
 *     erasing live data, idempotency.
 *  3. Card notification tracker: goals + delayed scorer, cards, subs hidden, VAR, shootouts,
 *     reconnect replays, multiple goals.
 *  4. SSE broadcaster: delivery latency, multi-tab fan-out, reconnect/missed-event recovery,
 *     monotonic cross-instance IDs, out-of-order frame guard.
 */
import assert from 'assert';
import {
  normalizeSportScoreIncidents,
  parseSportScoreWidgetTimestamp,
  fetchAuthoritativeSportScoreMatchDetail,
  sanitizeSnapshotLoadedFixture,
  syncLiveScoresOnly,
  getWeeklyTargetDatesEAT,
  getLocalDateStringEAT,
  getSyncDiagnostics,
  ingestFixtures,
  queryMarketFixtures,
} from '../src/lib/sportsFeedService.js';
import { sanitizeFrontendFixtureLifecycle } from '../src/lib/footballApi.js';
import { resolveCanonicalCompetition } from '../src/lib/canonicalCompetitions.js';
import {
  getMatchScorePresentation,
  isCompletedMatch,
  type MatchPeriod,
  type MatchStatus,
} from '../src/lib/matchStatus.js';
import { mergeMarketFixtureRecords } from '../src/lib/fixtureIdentity.js';
import { LiveEventTracker, type TrackerMatchInput } from '../src/lib/liveCardEvents.js';
import { realtimeBroadcaster } from '../src/lib/realtimeBroadcaster.js';
import { isStaleRealtimeFrame } from '../src/lib/freeMatches.js';

let passed = 0;
function ok(name: string) {
  passed++;
  console.log(`  PASS  ${name}`);
}

// Shape captured verbatim from SportScore match widget (Cruzeiro v Bahia) — no mock scorelines invented.
const REAL_PROVIDER_INCIDENTS = [
  { time: 5, type: 'Substitution', type_id: 9, side: 'home', player: '', is_sub: true, player_in: 'Matías Viña', player_out: 'Fabrício Bruno' },
  { time: 19, type: 'Yellow card', type_id: 3, side: 'away', player: 'Nicolas Acevedo', is_card: true },
  { time: 32, type: 'Goal', type_id: 1, side: 'away', player: 'Cristian Olivera', is_goal: true, home_score: 0, away_score: 1 },
  { time: 47, type: 'Goal', type_id: 1, side: 'home', player: 'Kaio Jorge', is_goal: true, home_score: 1, away_score: 1 },
  { time: 61, type: 'VAR', type_id: 28, side: 'home', player: 'Gerson' },
  { time: 63, type: 'Penalty missed', type_id: 16, side: 'home', player: 'Kaio Jorge' },
  { time: 69, type: 'Goal', type_id: 1, side: 'home', player: 'Bruno Rodrigues', is_goal: true, home_score: 2, away_score: 1 },
];

function fx(over: Record<string, any> = {}): any {
  return {
    id: 'mkt-ss-test-1',
    providerId: 'test-1',
    home: 'Home FC',
    away: 'Away FC',
    competition: 'Test League',
    leagueCode: 'test-league',
    country: 'England',
    kickoffIso: new Date(Date.now() - 50 * 60000).toISOString(),
    kickoff: 'now',
    status: 'in',
    period: 'second_half',
    displayClock: "50'",
    minute: "50'",
    homeScore: 1,
    awayScore: 0,
    syncedAt: new Date(Date.now()).toISOString(),
    bookmaker: 'Market Consensus',
    homeOdds: 2, drawOdds: 3, awayOdds: 3,
    ...over,
  };
}
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();

function section1() {
  console.log('\n[1] Provider incident normalisation (real SportScore shape)');
  const { incidents, latestGoalscorer } = normalizeSportScoreIncidents(REAL_PROVIDER_INCIDENTS);
  const byType = (t: string) => incidents.filter((i) => i.type === t);
  assert.equal(byType('goal').length, 3);
  assert.equal(byType('yellow_card').length, 1);
  assert.equal(byType('substitution').length, 1);
  assert.equal(byType('var').length, 1, 'VAR incident recognised');
  assert.equal(byType('goal')[0].scoreAfter, '0 - 1');
  assert.equal(latestGoalscorer?.player, 'Bruno Rodrigues');
  ok('goal/card/sub/VAR classified; scoreAfter preserved; latest scorer correct');

  const again = normalizeSportScoreIncidents(REAL_PROVIDER_INCIDENTS).incidents.map((i) => i.id);
  assert.deepEqual(again, incidents.map((i) => i.id));
  assert.equal(new Set(again).size, again.length);
  ok('incident IDs stable across polls and unique');

  const unnamed = normalizeSportScoreIncidents([{ time: 70, type: 'Yellow card', type_id: 3, side: 'home', player: '', is_card: true }]);
  assert.equal(unnamed.incidents[0].player, '', 'no placeholder "Player" name is invented');
  ok('unidentified card keeps empty player (no invented name)');

  const shootout = normalizeSportScoreIncidents([{ time: 120, type: 'Penalty shootout', side: 'home', player: 'X' }]);
  assert.notEqual(shootout.incidents[0].type, 'penalty_goal');
  ok('penalty-shootout kicks are never classified as goals');
}

function section2() {
  console.log('\n[2] Authoritative merge & fixture-refresh protection');
  // FT can never revert to HT/live via older data
  const ft = fx({ status: 'post', period: 'full_time', displayClock: 'FT', homeScore: 2, awayScore: 1, syncedAt: iso(0) });
  const olderHt = fx({ status: 'in', period: 'halftime', displayClock: 'HT', homeScore: 1, awayScore: 1, syncedAt: iso(-60_000), isAuthoritativeCorrection: false });
  let r = mergeMarketFixtureRecords(ft, olderHt, { isAuthoritativeCorrection: true });
  assert.equal(r.merged.status, 'post');
  assert.equal(r.merged.homeScore, 2);
  ok('FT never reverts to HT/live even from an "authoritative" older response');

  // Older score never replaces newer score (stale observation)
  const live21 = fx({ homeScore: 2, awayScore: 1, syncedAt: iso(0) });
  const staleScore = fx({ homeScore: 1, awayScore: 1, syncedAt: iso(-30_000) });
  r = mergeMarketFixtureRecords(live21, staleScore, { isAuthoritativeCorrection: true });
  assert.equal(r.merged.homeScore, 2);
  assert.equal(r.merged.awayScore, 1);
  ok('older provider response cannot replace a newer score');

  // Newer response does apply (including legitimate VAR correction downwards)
  const newer = fx({ homeScore: 1, awayScore: 1, syncedAt: iso(+5_000) });
  r = mergeMarketFixtureRecords(live21, newer, { isAuthoritativeCorrection: true });
  assert.equal(r.merged.homeScore, 1);
  ok('genuinely newer authoritative data (e.g. disallowed goal) still applies');

  // Future fixture fetch (scheduled data, 0-0/null, 'pre') can never erase a live score
  const scheduled = fx({ status: 'pre', period: 'scheduled', homeScore: null, awayScore: null, displayClock: '', minute: '', syncedAt: iso(+10_000) });
  r = mergeMarketFixtureRecords(live21, scheduled);
  assert.equal(r.merged.status, 'in');
  assert.equal(r.merged.homeScore, 2);
  ok('scheduled-fixture refresh cannot reset a live match or its score');

  // Completed match remains completed after later fixture sync
  r = mergeMarketFixtureRecords(ft, scheduled);
  assert.equal(r.merged.status, 'post');
  assert.equal(r.merged.homeScore, 2);
  assert.equal(r.merged.awayScore, 1);
  ok('completed match stays completed after subsequent fixture synchronisation');

  // Period progression HT -> 2H -> ET -> PEN -> FT(AP) follows forward transitions only
  let cur = fx({ status: 'in', period: 'first_half', displayClock: "30'", homeScore: 0, awayScore: 0, syncedAt: iso(0) });
  const steps: Array<[string, string, string]> = [
    ['in', 'halftime', 'HT'],
    ['in', 'second_half', "46'"],
    ['in', 'extra_time', "95'"],
    ['in', 'penalties', 'PEN'],
    ['post', 'after_penalties', 'AP'],
  ];
  let t = 1000;
  for (const [status, period, clock] of steps) {
    cur = mergeMarketFixtureRecords(cur, fx({ status, period, displayClock: clock, minute: clock, homeScore: 1, awayScore: 1, syncedAt: iso(t) }), { isAuthoritativeCorrection: true }).merged;
    t += 1000;
    assert.equal(cur.period, period);
  }
  assert.equal(cur.status, 'post');
  const regress = mergeMarketFixtureRecords(cur, fx({ status: 'in', period: 'first_half', syncedAt: iso(-60_000) }), { isAuthoritativeCorrection: true });
  assert.equal(regress.merged.status, 'post');
  ok('HT → 2H → ET → penalties → FT progress forward and cannot be reversed');

  // Idempotent: re-applying the same record reports no change
  const same = mergeMarketFixtureRecords(live21, { ...live21 });
  assert.equal(same.hasChanged, false);
  ok('re-applying an identical provider record is a no-op (idempotent upsert)');

  // Stale response still contributes NEW incidents additively, never removes known ones
  const withInc = fx({ syncedAt: iso(0), incidents: normalizeSportScoreIncidents(REAL_PROVIDER_INCIDENTS.slice(0, 3)).incidents });
  const staleMore = fx({ syncedAt: iso(-5000), incidents: normalizeSportScoreIncidents(REAL_PROVIDER_INCIDENTS.slice(0, 2)).incidents });
  r = mergeMarketFixtureRecords(withInc, staleMore);
  assert.equal(r.merged.incidents?.length, 3);
  ok('stale response cannot delete known incidents');
}

function matchInput(over: Partial<TrackerMatchInput> = {}): TrackerMatchInput {
  return { id: 'm1', status: 'in', period: 'second_half', homeScore: 0, awayScore: 0, incidents: [], ...over };
}

function section3() {
  console.log('\n[3] Fixture-card event tracker');
  const T = new LiveEventTracker();
  const inc = (over: any) => normalizeSportScoreIncidents([over]).incidents[0];

  // seed
  assert.equal(T.process(matchInput()).notifications.length, 0);

  // 0-0 -> 1-0, scorer not yet known
  let res = T.process(matchInput({ homeScore: 1 }));
  assert.equal(res.notifications.length, 1);
  assert.equal(res.notifications[0].kind, 'goal');
  assert.equal(res.notifications[0].side, 'home');
  assert.equal(res.notifications[0].player, undefined);
  assert.equal(res.glow.home, true);
  ok('score 0–0 → 1–0 shows glow + "Goal" under scoring team without scorer');

  // delayed scorer enriches the SAME notification, no duplicate goal
  const goalInc = inc({ time: 12, type: 'Goal', type_id: 1, side: 'home', player: 'A. Striker', is_goal: true, home_score: 1, away_score: 0 });
  res = T.process(matchInput({ homeScore: 1, incidents: [goalInc] }));
  assert.equal(res.notifications.length, 0, 'no duplicate Goal notification');
  assert.equal(res.enrichments.length, 1);
  assert.equal(res.enrichments[0].notificationId, 'goal:m1:home:1');
  assert.equal(res.enrichments[0].player, 'A. Striker');
  assert.equal(res.enrichments[0].minute, "12'");
  ok('delayed scorer event enriches the existing goal (no duplicate notification)');

  // replay (SSE reconnect / live_snapshot) -> nothing
  res = T.process(matchInput({ homeScore: 1, incidents: [goalInc] }));
  assert.equal(res.notifications.length + res.enrichments.length, 0);
  ok('replayed snapshot after reconnect does not replay notifications');

  // stale lower score then back to correct -> no re-announce
  T.process(matchInput({ homeScore: 0, incidents: [goalInc] }));
  res = T.process(matchInput({ homeScore: 1, incidents: [goalInc] }));
  assert.equal(res.notifications.length, 0);
  ok('stale snapshot going backwards then forwards does not fake a goal');

  // scorer arrives together with score; away goal
  const awayGoal = inc({ time: 30, type: 'Goal', type_id: 1, side: 'away', player: 'B. Winger', is_goal: true, home_score: 1, away_score: 1 });
  res = T.process(matchInput({ homeScore: 1, awayScore: 1, incidents: [goalInc, awayGoal] }));
  assert.equal(res.notifications[0].side, 'away');
  assert.equal(res.notifications[0].player, 'B. Winger');
  assert.equal(res.glow.away, true);
  ok('score + scorer together: scorer name and minute attached to correct team');

  // scorer incident BEFORE the score update
  const T2 = new LiveEventTracker();
  T2.process(matchInput({ id: 'm2' }));
  const early = inc({ time: 5, type: 'Goal', type_id: 1, side: 'home', player: 'C. Early', is_goal: true, home_score: 1, away_score: 0 });
  assert.equal(T2.process(matchInput({ id: 'm2', incidents: [early] })).notifications.length, 0);
  res = T2.process(matchInput({ id: 'm2', homeScore: 1, incidents: [early] }));
  assert.equal(res.notifications.length, 1);
  assert.equal(res.notifications[0].player, 'C. Early');
  ok('incident arriving before score update is held and attributed once the score confirms it');

  // multiple goals simultaneously (2 home goals at once) with scorers
  const T3 = new LiveEventTracker();
  T3.process(matchInput({ id: 'm3' }));
  const g1 = inc({ time: 10, type: 'Goal', type_id: 1, side: 'home', player: 'P1', is_goal: true, home_score: 1, away_score: 0 });
  const g2 = inc({ time: 11, type: 'Goal', type_id: 1, side: 'home', player: 'P2', is_goal: true, home_score: 2, away_score: 0 });
  res = T3.process(matchInput({ id: 'm3', homeScore: 2, incidents: [g1, g2] }));
  assert.deepEqual(res.notifications.map((n) => n.player), ['P1', 'P2']);
  ok('multiple simultaneous goals produce one notification each with the right scorer');

  // cards
  const T4 = new LiveEventTracker();
  T4.process(matchInput({ id: 'm4' }));
  const yc = inc({ time: 20, type: 'Yellow card', type_id: 3, side: 'home', player: 'Y. Player', is_card: true });
  const rc = inc({ time: 21, type: 'Red card', type_id: 4, side: 'away', player: 'R. Player', is_card: true });
  const unk = inc({ time: 22, type: 'Yellow card', type_id: 3, side: 'away', player: '', is_card: true });
  const sub = inc({ time: 23, type: 'Substitution', type_id: 9, side: 'home', player: '', is_sub: true, player_in: 'In', player_out: 'Out' });
  res = T4.process(matchInput({ id: 'm4', incidents: [yc, rc, unk, sub] }));
  assert.deepEqual(res.notifications.map((n) => [n.kind, n.player]), [['yellow_card', 'Y. Player'], ['red_card', 'R. Player']]);
  ok('named yellow/red cards shown; unidentified card and substitution never shown');

  // VAR: review then provider decision (decision text only when provider supplies it)
  const T5 = new LiveEventTracker();
  T5.process(matchInput({ id: 'm5' }));
  const varReview = inc({ time: 61, type: 'VAR', type_id: 28, side: 'home', player: 'Gerson' });
  res = T5.process(matchInput({ id: 'm5', incidents: [varReview] }));
  assert.equal(res.notifications[0].kind, 'var');
  assert.equal(res.notifications[0].decision, undefined);
  assert.equal(res.notifications[0].side, undefined, 'VAR is not attributed to a team without explicit data');
  const varDecided = inc({ time: 61, type: 'VAR', type_id: 28, side: 'home', player: 'Gerson', decision: 'Goal confirmed' });
  res = T5.process(matchInput({ id: 'm5', incidents: [varDecided] }));
  assert.equal(res.notifications[0].decision, 'Goal confirmed');
  res = T5.process(matchInput({ id: 'm5', incidents: [varDecided] }));
  assert.equal(res.notifications.length, 0);
  ok('VAR shown while reviewing; provider-reported decision shown once available; nothing invented');

  // shootout: score changes never count as goals
  const T6 = new LiveEventTracker();
  T6.process(matchInput({ id: 'm6', homeScore: 1, awayScore: 1 }));
  res = T6.process(matchInput({ id: 'm6', status: 'in', period: 'penalties', homeScore: 2, awayScore: 1 }));
  assert.equal(res.notifications.length, 0);
  res = T6.process(matchInput({ id: 'm6', status: 'post', period: 'after_penalties', homeScore: 5, awayScore: 4 }));
  assert.equal(res.notifications.length, 0);
  ok('penalty-shootout score changes are never mistaken for goals');

  // score correction (disallowed goal) then real goal
  const T7 = new LiveEventTracker();
  T7.process(matchInput({ id: 'm7', homeScore: 1 }));
  assert.equal(T7.process(matchInput({ id: 'm7', homeScore: 0 })).notifications.length, 0);
  ok('score correction downwards is not a goal');

  // cold mount mid-match: history is not announced
  const T8 = new LiveEventTracker();
  res = T8.process(matchInput({ id: 'm8', homeScore: 2, incidents: [g1, g2, yc] }));
  assert.equal(res.notifications.length, 0);
  assert.equal(T8.process(matchInput({ id: 'm8', homeScore: 2, incidents: [g1, g2, yc] })).notifications.length, 0);
  ok('mounting mid-match never replays historical goals/cards');

  // pre-match: null -> 0 at kickoff is not a goal
  const T9 = new LiveEventTracker();
  T9.process(matchInput({ id: 'm9', status: 'pre', homeScore: null, awayScore: null }));
  res = T9.process(matchInput({ id: 'm9', status: 'in', homeScore: 0, awayScore: 0 }));
  assert.equal(res.notifications.length, 0);
  res = T9.process(matchInput({ id: 'm9', status: 'in', homeScore: 0, awayScore: 1 }));
  assert.equal(res.notifications.length, 1);
  ok('kickoff (null → 0–0) is not a goal; the first real goal is announced');
}

function fakeClient() {
  const frames: Array<{ at: number; raw: string }> = [];
  const res: any = {
    writableEnded: false,
    headersSent: false,
    setHeader() {},
    writeHead() {},
    flushHeaders() {},
    write(raw: string) { frames.push({ at: performance.now(), raw }); return true; },
    end() { res.writableEnded = true; },
    on() {},
  };
  return { res, frames };
}

async function section4() {
  console.log('\n[4] SSE broadcaster: latency, multi-tab, reconnect recovery, IDs');
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ matches: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as any;
  try {
    const tabA = fakeClient();
    const tabB = fakeClient();
    realtimeBroadcaster.registerClient({ headers: {}, query: {}, on() {} }, tabA.res);
    realtimeBroadcaster.registerClient({ headers: {}, query: {}, on() {} }, tabB.res);

    const t0 = performance.now();
    const evt = realtimeBroadcaster.broadcastScoreUpdate('mkt-ss-lat', 1, 0, "10'", 'first_half', undefined, 'p-lat', 'in', null, null, 'slug', 'H', 'A', iso(0), 2);
    const lastA = tabA.frames[tabA.frames.length - 1];
    const lastB = tabB.frames[tabB.frames.length - 1];
    assert.ok(lastA.raw.includes('event: score_update'));
    assert.ok(lastB.raw.includes('event: score_update'));
    const latencyMs = Math.max(lastA.at, lastB.at) - t0;
    assert.ok(latencyMs < 50, `emit→socket latency ${latencyMs.toFixed(2)}ms`);
    ok(`multi-tab fan-out: both tabs received score_update in ${latencyMs.toFixed(2)} ms`);

    // monotonic, time-based IDs (safe across instances/restarts)
    const e1 = realtimeBroadcaster.emit('score_update', { homeScore: 1 }, { fixtureId: 'x1', force: true });
    const e2 = realtimeBroadcaster.emit('score_update', { homeScore: 2 }, { fixtureId: 'x1', force: true });
    assert.ok(e2.id > e1.id && e1.id > evt.id - 1);
    assert.ok(e1.id > 1_700_000_000_000, 'event IDs are wall-clock based so IDs from different instances stay ordered');
    ok('event IDs strictly increase and are wall-clock based (cross-instance safe)');

    // disconnect -> events missed -> reconnect with Last-Event-ID replays only the missed ones
    const lastSeenId = e2.id;
    const m1 = realtimeBroadcaster.emit('score_update', { homeScore: 3 }, { fixtureId: 'x1', force: true });
    const m2 = realtimeBroadcaster.emit('status_change', { status: 'post' }, { fixtureId: 'x1', force: true });
    const reconnect = fakeClient();
    realtimeBroadcaster.registerClient({ headers: { 'last-event-id': String(lastSeenId) }, query: {}, on() {} }, reconnect.res);
    const replayText = reconnect.frames.map((f) => f.raw).join('');
    assert.ok(replayText.includes(`id: ${m1.id}`) && replayText.includes(`id: ${m2.id}`), 'missed events replayed');
    assert.ok(!replayText.includes(`id: ${e1.id}\n`), 'already-seen events not replayed');
    ok('reconnect with Last-Event-ID recovers exactly the missed events');

    // out-of-order frame guard (client side)
    assert.equal(isStaleRealtimeFrame({ lastRealtimeAtMs: Date.parse(iso(0)) }, { timestamp: iso(-10_000) }), true);
    assert.equal(isStaleRealtimeFrame({ lastRealtimeAtMs: Date.parse(iso(-10_000)) }, { timestamp: iso(0) }), false);
    assert.equal(isStaleRealtimeFrame({}, { timestamp: iso(-10_000) }), false);
    ok('older SSE frames are dropped; newer frames apply');

    for (const c of [tabA, tabB, reconnect]) c.res.end();
    await new Promise((r) => setTimeout(r, 50));
  } finally {
    globalThis.fetch = origFetch;
  }
}

async function section5() {
  // Let any async onClientConnect tick from section4 settle cleanly before mocking fetch
  await new Promise((r) => setTimeout(r, 30));
  console.log('\n[5] SportScore widget ISO-8601 & epoch timestamp parser (fetchAuthoritativeSportScoreMatchDetail)');

  // 5a. Direct timestamp parser unit checks
  assert.equal(
    parseSportScoreWidgetTimestamp('2026-11-07T14:00:00+00:00'),
    '2026-11-07T14:00:00.000Z',
    'ISO-8601 string with +00:00 offset must parse without RangeError'
  );
  assert.equal(
    parseSportScoreWidgetTimestamp(1794060000),
    new Date(1794060000 * 1000).toISOString(),
    'Unix seconds number must parse accurately'
  );
  assert.equal(
    parseSportScoreWidgetTimestamp('1794060000'),
    new Date(1794060000 * 1000).toISOString(),
    'Numeric epoch string must parse accurately'
  );

  // Invalid dm.time logs raw value & returns undefined instead of throwing RangeError
  const loggedErrors: any[][] = [];
  const origConsoleError = console.error;
  console.error = (...args: any[]) => {
    loggedErrors.push(args);
  };
  try {
    assert.equal(parseSportScoreWidgetTimestamp('not-a-valid-date', 'test-slug'), undefined);
    assert.equal(loggedErrors.length, 1, 'invalid dm.time must log an explicit error');
    assert.equal(loggedErrors[0][1]?.rawTime, 'not-a-valid-date');
  } finally {
    console.error = origConsoleError;
  }
  ok('parseSportScoreWidgetTimestamp handles ISO strings, numeric epochs, and logs invalid values cleanly');

  // 5b. Full fetchAuthoritativeSportScoreMatchDetail with real ISO-string widget payload
  ingestFixtures([
    fx({
      id: 'mkt-ss-frosinone-vs-cagliari-k82rekhgdvd7rep',
      providerId: 'ss-frosinone-vs-cagliari-k82rekhgdvd7rep',
      matchId: 'k82rekhgdvd7rep',
      matchSlug: 'frosinone-vs-cagliari',
      matchUrl: '/football/match/frosinone-vs-cagliari/k82rekhgdvd7rep/',
      home: 'Cagliari',
      away: 'Frosinone',
      competition: 'Italian Serie A',
      competitionId: 'ita_serie_a',
      leagueCode: 'italian-serie-a',
      country: 'Italy',
      kickoffIso: '2026-11-07T14:00:00+00:00',
      status: 'in',
      period: 'first_half',
      displayClock: '1st Half',
      minute: '1st Half',
      homeScore: 1,
      awayScore: 0,
      syncedAt: '2026-11-07T14:52:05.594Z',
    }),
  ]);

  const realWidgetPayload = {
    sport: 'football',
    match: {
      home: 'Cagliari',
      away: 'Frosinone',
      home_score: '1',
      away_score: '0',
      home_ht_score: '1',
      away_ht_score: '0',
      status: 'live',
      status_text: '2nd half',
      time: '2026-11-07T14:00:00+00:00',
      competition: 'Italian Serie A',
      url: '/football/match/frosinone-vs-cagliari/k82rekhgdvd7rep/',
      live_minute: '60',
      incidents: [
        {
          time: 38,
          type: 'Goal',
          type_id: 1,
          side: 'home',
          player: 'Michel Adopo',
          is_goal: true,
          home_score: 1,
          away_score: 0,
        },
      ],
    },
  };

  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(realWidgetPayload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as any;

  try {
    const detail = await fetchAuthoritativeSportScoreMatchDetail('frosinone-vs-cagliari', {
      ingestIntoStore: true,
    });
    assert.ok(detail, 'fetchAuthoritativeSportScoreMatchDetail must NOT return null on ISO dm.time');
    assert.equal(detail.normalized_status, 'in');
    assert.equal(detail.normalized_period, 'second_half');
    assert.equal(detail.display_clock, "60'");
    assert.equal(detail.kickoff, '2026-11-07T14:00:00.000Z');
    assert.equal(detail.home_score, 1);
    assert.equal(detail.away_score, 0);

    const updatedInStore = queryMarketFixtures({ scope: 'live' }).find(
      (f) => f.matchId === 'k82rekhgdvd7rep'
    );
    assert.ok(updatedInStore, 'fixturesStore record must remain live and updated');
    assert.equal(updatedInStore?.period, 'second_half');
    assert.equal(updatedInStore?.displayClock, "60'");
    assert.equal(updatedInStore?.homeHtScore, 1);
    assert.equal(updatedInStore?.awayHtScore, 0);
  } finally {
    globalThis.fetch = origFetch;
  }
  ok('fetchAuthoritativeSportScoreMatchDetail parses real ISO-string widget payload and updates fixturesStore');
}

// ============================================================================
// SECTION 6 — No synthetic FT fabrication (>115m awaiting_confirmation & >=240m unconfirmed)
// ============================================================================
async function section6() {
  console.log('\n[6] Non-terminal >115m awaiting_confirmation & >=240m suspended/unconfirmed safeguards');

  const nowMs = Date.now();
  const runKey = nowMs.toString(36);
  const muglaFixtureId = `mkt-muglaspor-erokspor-${runKey}`;
  const muglaMatchId = `m9${runKey}`;
  const kickoff130mAgo = new Date(nowMs - 130 * 60_000).toISOString();

  // Seed a live match at 0-4 whose kickoff was 130 minutes ago (Muglaspor vs Erokspor scenario)
  // Note: set lastDetailCheckMs-friendly old syncedAt so it sorts at the head of remainingCandidates too.
  ingestFixtures(
    [
      {
        id: muglaFixtureId,
        providerId: `muglaspor-vs-erokspor-${muglaMatchId}`,
        matchId: muglaMatchId,
        matchSlug: `muglaspor-${runKey}-vs-erokspor`,
        matchUrl: `https://sportscore.com/football/match/muglaspor-${runKey}-vs-erokspor/${muglaMatchId}/`,
        home: `Muglaspor ${runKey}`,
        away: 'Erokspor',
        competition: 'Turkish 2. Lig',
        competitionId: 'tur-2-lig',
        country: 'Turkiye',
        leagueCode: 'TUR',
        kickoff: '16:00 EAT',
        kickoffIso: kickoff130mAgo,
        status: 'in',
        period: 'second_half',
        periodSequence: 30,
        displayClock: "87'",
        minute: "87'",
        homeScore: 0,
        awayScore: 4,
        homeOdds: 3.1,
        drawOdds: 3.3,
        awayOdds: 2.1,
        homePct: 29,
        drawPct: 27,
        awayPct: 44,
        bookmaker: 'Market Consensus',
        syncedAt: new Date(nowMs - 20 * 60_000).toISOString(),
      },
    ],
    true
  );

  // 6.1 Upstream fails (404) at 130 mins -> must NOT stamp status:'post' / 'FT'!
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('Not found', { status: 404 })) as any;
  try {
    await syncLiveScoresOnly();
  } finally {
    globalThis.fetch = origFetch;
  }

  const afterOutage = queryMarketFixtures({ scope: 'all' }).find((f) => f.id === muglaFixtureId);
  assert.ok(afterOutage, 'Match must still exist in store');
  assert.equal(afterOutage?.status, 'awaiting_confirmation', 'Match >115m with failed provider check must be awaiting_confirmation, NEVER post');
  assert.equal(afterOutage?.displayClock, 'Awaiting FT');
  assert.equal(afterOutage?.homeScore, 0);
  assert.equal(afterOutage?.awayScore, 4);
  assert.equal(isCompletedMatch(afterOutage, nowMs), false, 'awaiting_confirmation must NOT be treated as completed');
  ok('Match at 130m without provider confirmation enters awaiting_confirmation (never fabricated 0-4 FT)');

  // 6.2 Next poll: provider widget returns authoritative finished 0-5 -> match STILL gets polled and updates to 0-5 FT!
  const muglaFinishedWidget = {
    match: {
      id: muglaMatchId,
      home_team: `Muglaspor ${runKey}`,
      away_team: 'Erokspor',
      home_score: 0,
      away_score: 5,
      home_ht_score: 0,
      away_ht_score: 2,
      status: 'finished',
      status_text: 'FT',
      time: kickoff130mAgo,
      competition: 'Turkish 2. Lig',
      url: `/football/match/muglaspor-${runKey}-vs-erokspor/${muglaMatchId}/`,
      incidents: [],
    },
  };
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    if (url.includes('/api/widget/match/') && url.includes(`muglaspor-${runKey}-vs-erokspor`)) {
      return new Response(JSON.stringify(muglaFinishedWidget), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ matches: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as any;
  try {
    await syncLiveScoresOnly();
  } finally {
    globalThis.fetch = origFetch;
  }

  const afterRecovery = queryMarketFixtures({ scope: 'finished' }).find((f) => f.id === muglaFixtureId);
  assert.ok(afterRecovery, 'Match must transition to finished once provider explicitly confirms finished');
  assert.equal(afterRecovery?.status, 'post');
  assert.equal(afterRecovery?.displayClock, 'FT');
  assert.equal(afterRecovery?.homeScore, 0);
  assert.equal(afterRecovery?.awayScore, 5, 'Final score must be authoritative 0-5, not stale 0-4');
  ok('awaiting_confirmation match keeps polling and transitions cleanly to authoritative 0-5 FT');

  // 6.3 Safeguard at >=240m: marked 'suspended'/'unconfirmed', never auto-finalized with a score
  const kickoff250mAgo = new Date(nowMs - 250 * 60_000).toISOString();
  const unconfirmedSnap = sanitizeSnapshotLoadedFixture(
    {
      ...(afterOutage as any),
      id: 'mkt-250m-unconfirmed',
      kickoffIso: kickoff250mAgo,
      status: 'awaiting_confirmation',
      homeScore: 1,
      awayScore: 1,
    },
    nowMs
  );
  assert.equal(unconfirmedSnap.status, 'suspended');
  assert.equal(unconfirmedSnap.period, 'unconfirmed');
  assert.equal(unconfirmedSnap.displayClock, 'UNCONFIRMED');
  const pres = getMatchScorePresentation(
    unconfirmedSnap.status,
    unconfirmedSnap.displayClock,
    unconfirmedSnap.kickoff,
    unconfirmedSnap.homeScore,
    unconfirmedSnap.awayScore,
    unconfirmedSnap.kickoffIso
  );
  assert.equal(pres.shouldShowScore, false, 'Unconfirmed >=240m match must never display a finalized score');
  assert.equal(pres.isFinished, false);
  assert.equal(pres.badgeText, 'UNCONFIRMED');

  const clientUnconfirmed = sanitizeFrontendFixtureLifecycle(
    {
      status: 'in' as MatchStatus,
      period: 'second_half' as MatchPeriod,
      kickoffIso: kickoff250mAgo,
      homeScore: null,
      awayScore: null,
    },
    nowMs
  );
  assert.equal(clientUnconfirmed.status, 'suspended');
  assert.equal(clientUnconfirmed.period, 'unconfirmed');
  assert.equal(clientUnconfirmed.homeScore, null);
  ok('>=240m safeguard marks match suspended/unconfirmed and never auto-finalizes with a score');
}

// ============================================================================
// SECTION 7 — Per-competition + widget polling for post-10:00 UTC matches & lastSyncTimestamp isolation
// ============================================================================
async function section7() {
  console.log('\n[7] Per-competition live polling (post-10:00 UTC), yesterday window & lastSyncTimestamp isolation');

  // 7.1 getWeeklyTargetDatesEAT includes yesterday
  const fixedNow = new Date('2026-11-07T15:35:00Z'); // 18:35 EAT
  const targetDates = getWeeklyTargetDatesEAT(fixedNow);
  const expectedYesterday = getLocalDateStringEAT(new Date(fixedNow.getTime() - 86_400_000));
  const expectedToday = getLocalDateStringEAT(fixedNow);
  assert.equal(targetDates[0], expectedYesterday, 'First weekly target date must be yesterday EAT');
  assert.equal(targetDates[1], expectedToday, 'Second weekly target date must be today EAT');
  assert.equal(targetDates.length, 9, 'Rolling window must cover yesterday + today + 7 days (9 dates)');
  ok('getWeeklyTargetDatesEAT includes yesterday EAT for cross-midnight reconciliation');

  // 7.2 Post-10:00 UTC match (RB Leipzig vs FC Augsburg, 14:30 UTC) gets live updates via per-competition + widget
  // even when status=live would be empty and global date= truncates at 10:00 UTC, WITHOUT mutating lastSyncTime!
  const nowMs = Date.now();
  const rblRunKey = nowMs.toString(36);
  const rblFixtureId = `mkt-rbleipzig-augsburg-${rblRunKey}`;
  const rblMatchId = `rbl${rblRunKey}`;
  // Ensure kickoff UTC hour is >= 10 (e.g. 2026-11-07T14:30:00Z if running on 2026-11-07, or dynamic >=10:00 UTC)
  const baseKickoff = new Date(nowMs - 55 * 60_000);
  if (baseKickoff.getUTCHours() < 10) {
    baseKickoff.setUTCHours(14, 30, 0, 0);
  }
  const leipzigKickoffIso = baseKickoff.toISOString();

  ingestFixtures(
    [
      {
        id: rblFixtureId,
        providerId: `rb-leipzig-${rblRunKey}-vs-fc-augsburg-${rblMatchId}`,
        matchId: rblMatchId,
        matchSlug: `rb-leipzig-${rblRunKey}-vs-fc-augsburg`,
        matchUrl: `https://sportscore.com/football/match/rb-leipzig-${rblRunKey}-vs-fc-augsburg/${rblMatchId}/`,
        home: `RB Leipzig ${rblRunKey}`,
        away: 'FC Augsburg',
        competition: 'German Bundesliga',
        competitionId: 'ger_bundesliga',
        country: 'Germany',
        leagueCode: 'german-bundesliga',
        kickoff: '17:30 EAT',
        kickoffIso: leipzigKickoffIso,
        status: 'in',
        period: 'first_half',
        periodSequence: 10,
        displayClock: "34'",
        minute: "34'",
        homeScore: 0,
        awayScore: 1,
        homeOdds: 1.55,
        drawOdds: 4.2,
        awayOdds: 5.5,
        homePct: 58,
        drawPct: 24,
        awayPct: 18,
        bookmaker: 'Bet365',
        syncedAt: new Date(nowMs - 10 * 60_000).toISOString(),
      },
    ],
    true,
    { updateFullSyncTimestamp: false }
  );

  const fullSyncBefore = getSyncDiagnostics().lastSyncTime;
  const requestedUrls: string[] = [];
  let inFlight = 0;
  let maxConcurrency = 0;

  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    requestedUrls.push(url);
    inFlight++;
    if (inFlight > maxConcurrency) maxConcurrency = inFlight;
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;

    if (url.includes('competition=bundesliga')) {
      return new Response(
        JSON.stringify({
          matches: [
            {
              id: rblMatchId,
              home: `RB Leipzig ${rblRunKey}`,
              away: 'FC Augsburg',
              home_score: 2,
              away_score: 1,
              status: 'live',
              status_text: '1st half',
              time: leipzigKickoffIso,
              competition: 'German Bundesliga',
              country: 'Germany',
              url: `/football/match/rb-leipzig-${rblRunKey}-vs-fc-augsburg/${rblMatchId}/`,
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('/api/widget/match/') && url.includes(`rb-leipzig-${rblRunKey}-vs-fc-augsburg`)) {
      return new Response(
        JSON.stringify({
          match: {
            id: rblMatchId,
            home_team: `RB Leipzig ${rblRunKey}`,
            away_team: 'FC Augsburg',
            home_score: 3,
            away_score: 1,
            home_ht_score: 3,
            away_ht_score: 1,
            status: 'halftime',
            status_text: 'Half-time',
            time: leipzigKickoffIso.replace('Z', '+00:00'),
            competition: 'German Bundesliga',
            url: `/football/match/rb-leipzig-${rblRunKey}-vs-fc-augsburg/${rblMatchId}/`,
            incidents: [],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ matches: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as any;

  try {
    await syncLiveScoresOnly();
  } finally {
    globalThis.fetch = origFetch;
  }

  // Assert no status=live call and no global date= call without competition=
  assert.equal(
    requestedUrls.some((u) => u.includes('status=live')),
    false,
    'syncLiveScoresOnly must NOT depend on status=live'
  );
  assert.equal(
    requestedUrls.some((u) => u.includes('/api/v1/fixtures/') && u.includes('date=') && !u.includes('competition=')),
    false,
    'syncLiveScoresOnly must NOT call global date= endpoint for post-10:00 UTC matches'
  );
  assert.equal(
    requestedUrls.some((u) => u.includes('competition=bundesliga')),
    true,
    'syncLiveScoresOnly must poll fetchSportScoreFixturesByCompetition using verified providerSlug (bundesliga)'
  );
  assert.ok(maxConcurrency <= 4, `Concurrency must stay capped <= 4 (saw ${maxConcurrency})`);

  const updatedLeipzig = queryMarketFixtures({ scope: 'live' }).find((f) => f.id === rblFixtureId);
  assert.ok(updatedLeipzig, 'RB Leipzig vs FC Augsburg must be in live scope');
  assert.equal(updatedLeipzig?.homeScore, 3, 'Authoritative widget score 3-1 HT must win over stale 0-1 / 2-1');
  assert.equal(updatedLeipzig?.awayScore, 1);
  assert.equal(updatedLeipzig?.period, 'halftime');
  assert.equal(updatedLeipzig?.displayClock, 'HT');

  const fullSyncAfter = getSyncDiagnostics().lastSyncTime;
  assert.equal(fullSyncAfter, fullSyncBefore, 'Partial syncLiveScoresOnly must NEVER overwrite lastSyncTimestamp');
  ok('Post-10:00 UTC match (RB Leipzig vs FC Augsburg) updates 0-1 1H -> 3-1 HT via per-competition + widget without touching lastSyncTimestamp');
}

// ---------------------------------------------------------------------------
// 8. Release hygiene: Malaga vs Racing Santander Segunda classification & forceAuthoritativeOverwrite snapshot repair
// ---------------------------------------------------------------------------
function section8() {
  console.log('\n[8] Spanish Segunda División disambiguation & snapshot corruption repair');

  const malagaSegunda = resolveCanonicalCompetition({
    competition: 'Spanish La Liga',
    leagueCode: 'spanish-la-liga',
    country: 'Spain',
    providerId: 'malaga-vs-racing-santander-jw2r09hkv17lrz8',
    home: 'Malaga',
    away: 'Racing Santander',
  });
  assert.equal(malagaSegunda.id, 'esp_segunda', 'Malaga vs Racing Santander must resolve to esp_segunda');
  assert.equal(malagaSegunda.name, 'Spanish Segunda División');

  // Copa del Rey matchup between the same clubs must remain Copa del Rey
  const malagaCup = resolveCanonicalCompetition({
    competition: 'Copa del Rey',
    leagueCode: 'copa-del-rey',
    country: 'Spain',
    providerId: 'malaga-vs-racing-santander-cup1',
    home: 'Malaga',
    away: 'Racing Santander',
  });
  assert.equal(malagaCup.id, 'esp_copa_del_rey', 'Copa del Rey matchup must not be overridden');

  // Genuine Spanish La Liga matchup remains esp_la_liga
  const valenciaReal = resolveCanonicalCompetition({
    competition: 'Spanish La Liga',
    leagueCode: 'spanish-la-liga',
    country: 'Spain',
    providerId: 'valencia-cf-vs-real-madrid-xyz',
    home: 'Valencia CF',
    away: 'Real Madrid',
  });
  assert.equal(valenciaReal.id, 'esp_la_liga');

  // Explicit Segunda División / La Liga 2 / LaLiga Hypermotion variants
  for (const variant of ['Spanish Segunda División', 'Spanish Segunda Division', 'La Liga 2', 'LaLiga Hypermotion']) {
    const resolved = resolveCanonicalCompetition({ competition: variant, country: 'International' });
    assert.equal(resolved.id, 'esp_segunda', `Variant "${variant}" must resolve to esp_segunda`);
  }
  ok('Malaga vs Racing Santander & Segunda División variants resolve cleanly to Spanish Segunda División');

  // Verify forceAuthoritativeOverwrite repairs both corrupted 0-4 FT -> 0-5 FT and prematurely fabricated FT -> 3-1 HT
  const corruptedMugla = fx({
    id: 'mkt-repair-muglaspor',
    home: 'Muglaspor',
    away: 'Erokspor',
    status: 'post',
    period: 'full_time',
    periodSequence: 60,
    displayClock: 'FT',
    minute: 'FT',
    homeScore: 0,
    awayScore: 4,
    observedAtMs: 5_000,
  });
  const realMugla = fx({
    id: 'mkt-repair-muglaspor',
    home: 'Muglaspor',
    away: 'Erokspor',
    status: 'post',
    period: 'full_time',
    periodSequence: 60,
    displayClock: 'FT',
    minute: 'FT',
    homeScore: 0,
    awayScore: 5,
    observedAtMs: 6_000,
    isAuthoritativeCorrection: true,
  });
  const repairedMugla = mergeMarketFixtureRecords(corruptedMugla, realMugla, {
    forceAuthoritativeOverwrite: true,
  });
  assert.equal(repairedMugla.merged.homeScore, 0);
  assert.equal(repairedMugla.merged.awayScore, 5);
  assert.equal(repairedMugla.merged.status, 'post');

  const fabricatedFtLeipzig = fx({
    id: 'mkt-repair-leipzig',
    home: 'RB Leipzig',
    away: 'FC Augsburg',
    status: 'post',
    period: 'full_time',
    periodSequence: 60,
    displayClock: 'FT',
    minute: 'FT',
    homeScore: 0,
    awayScore: 1,
    observedAtMs: 9_000,
  });
  const authoritativeHtLeipzig = fx({
    id: 'mkt-repair-leipzig',
    home: 'RB Leipzig',
    away: 'FC Augsburg',
    status: 'in',
    period: 'halftime',
    periodSequence: 20,
    displayClock: 'HT',
    minute: 'HT',
    homeScore: 3,
    awayScore: 1,
    homeHtScore: 3,
    awayHtScore: 1,
    observedAtMs: 8_500,
    isAuthoritativeCorrection: true,
  });
  const repairedLeipzig = mergeMarketFixtureRecords(fabricatedFtLeipzig, authoritativeHtLeipzig, {
    forceAuthoritativeOverwrite: true,
  });
  assert.equal(repairedLeipzig.merged.status, 'in');
  assert.equal(repairedLeipzig.merged.period, 'halftime');
  assert.equal(repairedLeipzig.merged.displayClock, 'HT');
  assert.equal(repairedLeipzig.merged.homeScore, 3);
  assert.equal(repairedLeipzig.merged.awayScore, 1);
  ok('forceAuthoritativeOverwrite repairs corrupted 0-4 FT -> 0-5 FT and fabricated FT -> 3-1 HT');
}

(async () => {
  try {
    console.log('================================================================================');
    console.log('MSHINDIROOM — LIVE MATCH UPDATE VERIFICATION SUITE');
    console.log('================================================================================');
    section1();
    section2();
    section3();
    await section4();
    await section5();
    await section6();
    await section7();
    section8();
    console.log(`\nALL ${passed} LIVE-UPDATE CHECKS PASSED`);
    process.exit(0);
  } catch (err) {
    console.error('\nFAILED:', err);
    process.exit(1);
  }
})();

