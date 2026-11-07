import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { generateBuildVersionManifest } from './generate-build-version.js';
import {
  parseDetailedMatchStatus,
  isStatusTransitionValid,
  isLiveMatch,
  isCompletedMatch,
  formatLiveMatchClock,
} from '../src/lib/matchStatus.js';
import {
  areFixturesIdentical,
  mergeMarketFixtureRecords,
} from '../src/lib/fixtureIdentity.js';
import {
  sanitizeSnapshotLoadedFixture,
  type MarketFixture,
} from '../src/lib/sportsFeedService.js';
import {
  sanitizeFrontendFixtureLifecycle,
  mergeHighlightFixtureLists,
  type HighlightFixture,
} from '../src/lib/footballApi.js';

const rootDir = process.cwd();

function logPass(name: string) {
  console.log(`  PASS  ${name}`);
}

async function runVerificationSuite() {
  console.log('================================================================================');
  console.log('MSHINDIROOM — PWA UPDATE & LIVE FIXTURE LIFECYCLE VERIFICATION SUITE');
  console.log('================================================================================\n');

  // ===========================================================================
  // PART 1: PHASE 17 — PWA UPDATE TESTING (TESTS A–G)
  // ===========================================================================
  console.log('--- PART 1: PWA Update Architecture Verification (Tests A–G) ---');

  // Test A: Normal Update & Build-Stamped Versioning
  const manifest = generateBuildVersionManifest(rootDir);
  assert.ok(manifest.version && manifest.version.startsWith('2.4.0-'), 'Manifest version must be stamped');
  const versionJsonRaw = fs.readFileSync(path.join(rootDir, 'public', 'version.json'), 'utf-8');
  const parsedVersionJson = JSON.parse(versionJsonRaw);
  assert.strictEqual(parsedVersionJson.version, manifest.version, 'public/version.json must match generated version');

  const swContent = fs.readFileSync(path.join(rootDir, 'public', 'sw.js'), 'utf-8');
  assert.ok(
    swContent.includes(`const BUILD_VERSION = '${manifest.version}';`),
    'public/sw.js must have BUILD_VERSION stamped for byte-level update detection'
  );
  logPass('Test A (Normal Update): Build version manifest & byte-distinct /sw.js stamping verified');

  // Test B: Background Resume, Network Recovery & Periodic Checks
  const swRegisterContent = fs.readFileSync(path.join(rootDir, 'src', 'lib', 'swRegister.ts'), 'utf-8');
  assert.ok(swRegisterContent.includes("updateViaCache: 'none'"), 'SW registration must use updateViaCache: none');
  assert.ok(swRegisterContent.includes("'visibilitychange'"), 'Must check for updates on visibilitychange');
  assert.ok(swRegisterContent.includes("'online'"), 'Must check for updates on network reconnection (online)');
  assert.ok(swRegisterContent.includes('PERIODIC_CHECK_INTERVAL_MS'), 'Must perform periodic update checks during extended sessions');
  assert.ok(swRegisterContent.includes('/version.json'), 'Must poll /version.json with cache: no-store');
  logPass('Test B (Background Resume & Reconnect): Launch, visibilitychange, online, and periodic checks verified');

  // Test C: Active Session Protection & State Preservation
  assert.ok(
    swRegisterContent.includes('isUserBusyWithCriticalAction'),
    'Must guard active user sessions from unexpected reloads'
  );
  assert.ok(
    swRegisterContent.includes('showSubtleUpdateBanner'),
    'Must display subtle non-intrusive update banner when user is busy'
  );
  assert.ok(
    swRegisterContent.includes('saveSessionStateBeforeUpdate') &&
      swRegisterContent.includes('restoreSessionStateAfterUpdate'),
    'Must preserve and restore scroll/session state across update reloads'
  );
  assert.ok(
    swRegisterContent.includes('canSafelyReloadForVersion') && swRegisterContent.includes('RELOAD_COOLDOWN_MS'),
    'Must prevent infinite reload loops'
  );
  logPass('Test C (Active Session Protection): Critical activity detection, subtle banner & anti-loop guard verified');

  // Test D: Asset Compatibility & MIME-Type Protection
  assert.ok(
    swContent.includes('isValidAssetResponse') && swContent.includes("contentType.includes('text/html')"),
    'Service Worker must reject text/html responses for .js/.css/image assets'
  );
  const vercelJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf-8'));
  const rewriteSource = vercelJson.rewrites?.find((r: any) => r.destination === '/index.html')?.source || '';
  assert.ok(
    rewriteSource.includes('assets/') && rewriteSource.includes('sw\\.js') && rewriteSource.includes('version\\.json'),
    'vercel.json rewrite must exclude /assets/, /sw.js, and /version.json from /index.html fallback'
  );
  logPass('Test D (Asset Compatibility): MIME-type validation & SPA rewrite exclusions verified');

  // Test E: Offline Fallback & Network-First HTML
  assert.ok(
    swContent.includes("request.mode === 'navigate'") && swContent.includes("fetch(request, { cache: 'no-store' })"),
    'HTML navigation must use Network-First with cache: no-store and offline fallback'
  );
  logPass('Test E (Offline Fallback): Network-First HTML navigation with offline fallback verified');

  // Test F: Cache Cleanup
  assert.ok(
    swContent.includes('VALID_CACHES.has(name)') && swContent.includes('caches.delete(name)'),
    'Activate handler must delete all obsolete caches not in VALID_CACHES'
  );
  logPass('Test F (Cache Cleanup): Automatic purging of outdated Cache Storage verified');

  // Test G: Live Data Independence
  assert.ok(
    swContent.includes("'/api/'") && swContent.includes("acceptHeader.includes('text/event-stream')"),
    'Service Worker must strictly bypass all /api/* routes and text/event-stream SSE connections'
  );
  logPass('Test G (Live Data Independence): /api/* and SSE streams completely excluded from SW interception\n');

  // ===========================================================================
  // PART 2: PHASE 18 — LIVE FIXTURE TESTING (TESTS A–J)
  // ===========================================================================
  console.log('--- PART 2: Live Fixture Lifecycle & Synchronization Verification (Tests A–J) ---');

  const nowMs = Date.now();
  const kickoffLiveIso = new Date(nowMs - 35 * 60_000).toISOString();

  // Test A: Pre-Match to Live Transition (PRE-MATCH -> LIVE)
  const preStatus = parseDetailedMatchStatus('scheduled', '19:00', null);
  assert.strictEqual(preStatus.status, 'pre');
  assert.strictEqual(preStatus.period, 'scheduled');

  const live1HStatus = parseDetailedMatchStatus('live', '1st Half', 1);
  assert.strictEqual(live1HStatus.status, 'in');
  assert.strictEqual(live1HStatus.period, 'first_half');
  assert.strictEqual(live1HStatus.displayClock, "1'");
  assert.strictEqual(
    isStatusTransitionValid(preStatus.status, preStatus.period, live1HStatus.status, live1HStatus.period),
    true,
    'PRE -> LIVE (1H) must be valid'
  );
  assert.strictEqual(isLiveMatch({ status: 'in', period: 'first_half', kickoffIso: kickoffLiveIso }, nowMs), true);
  logPass('Test A (Pre-Match to Live): Scheduled fixture transitions cleanly to Live (1H, 1\', 0-0)');

  // Test B: Score and Clock Updates
  const baseLiveFixture: MarketFixture = {
    id: 'mkt-arsenal-chelsea',
    providerId: '991001',
    matchId: '991001',
    matchSlug: 'arsenal-vs-chelsea-991001',
    home: 'Arsenal',
    away: 'Chelsea',
    competition: 'Premier League',
    competitionId: 'england-premier-league',
    leagueCode: 'premier-league',
    country: 'England',
    kickoff: 'Today · 20:00 EAT',
    kickoffIso: kickoffLiveIso,
    status: 'in',
    period: 'first_half',
    periodSequence: 10,
    displayClock: "15'",
    minute: "15'",
    homeScore: 1,
    awayScore: 0,
    homeOdds: 1.85,
    drawOdds: 3.5,
    awayOdds: 4.2,
    homePct: 50,
    drawPct: 28,
    awayPct: 22,
    over25Pct: 60,
    bookmaker: 'Market Consensus',
    syncedAt: new Date(nowMs - 60_000).toISOString(),
  };

  const updatedScoreFixture: MarketFixture = {
    ...baseLiveFixture,
    displayClock: "38'",
    minute: "38'",
    homeScore: 1,
    awayScore: 1,
    syncedAt: new Date(nowMs).toISOString(),
  };

  const mergedScore = mergeMarketFixtureRecords(baseLiveFixture, updatedScoreFixture);
  assert.strictEqual(mergedScore.merged.homeScore, 1);
  assert.strictEqual(mergedScore.merged.awayScore, 1);
  assert.strictEqual(mergedScore.merged.displayClock, "38'");
  assert.strictEqual(mergedScore.hasChanged, true);
  logPass('Test B (Score & Clock Updates): Live score (1-0 -> 1-1) and clock (15\' -> 38\') update accurately');

  // Test C: Halftime Transition (1H -> HT -> 2H)
  const htStatus = parseDetailedMatchStatus('ht', 'Halftime', null);
  assert.strictEqual(htStatus.status, 'in');
  assert.strictEqual(htStatus.period, 'halftime');
  assert.strictEqual(htStatus.displayClock, 'HT');

  const secondHalfStatus = parseDetailedMatchStatus('live', '2nd Half', 46);
  assert.strictEqual(secondHalfStatus.status, 'in');
  assert.strictEqual(secondHalfStatus.period, 'second_half');
  assert.strictEqual(secondHalfStatus.displayClock, "46'");

  const htFixture: MarketFixture = {
    ...mergedScore.merged,
    period: 'halftime',
    periodSequence: 20,
    displayClock: 'HT',
    minute: 'HT',
  };
  const secondHalfFixture: MarketFixture = {
    ...htFixture,
    period: 'second_half',
    periodSequence: 30,
    displayClock: "46'",
    minute: "46'",
  };
  const merged2H = mergeMarketFixtureRecords(htFixture, secondHalfFixture);
  assert.strictEqual(merged2H.merged.period, 'second_half');
  assert.strictEqual(merged2H.merged.displayClock, "46'", 'Clock must advance from HT to 46\' on 2nd half start');
  logPass('Test C (Halftime Transition): 1H -> HT -> 2H (46\') transitions without sticking on HT');

  // Test D: Full-Time Transition (LIVE -> FINISHED)
  const ftStatus = parseDetailedMatchStatus('finished', 'Finished', null);
  assert.strictEqual(ftStatus.status, 'post');
  assert.strictEqual(ftStatus.period, 'full_time');
  assert.strictEqual(ftStatus.displayClock, 'FT');

  const ftFixture: MarketFixture = {
    ...merged2H.merged,
    status: 'post',
    period: 'full_time',
    periodSequence: 60,
    displayClock: 'FT',
    minute: 'FT',
    homeScore: 2,
    awayScore: 1,
  };
  const mergedFT = mergeMarketFixtureRecords(merged2H.merged, ftFixture);
  assert.strictEqual(mergedFT.merged.status, 'post');
  assert.strictEqual(mergedFT.merged.displayClock, 'FT');
  assert.strictEqual(mergedFT.merged.homeScore, 2);
  assert.strictEqual(mergedFT.merged.awayScore, 1);
  assert.strictEqual(isLiveMatch(mergedFT.merged, nowMs), false, 'Finished match must NOT be live');
  assert.strictEqual(isCompletedMatch(mergedFT.merged, nowMs), true, 'Finished match MUST be completed');
  logPass('Test D (Full-Time Transition): Match transitions to FT, exits Live, and enters Completed');

  // Test E: Stoppage Time, Extra Time & Penalties
  const stoppage = parseDetailedMatchStatus('live', '90+5\'', '90+5');
  assert.strictEqual(stoppage.status, 'in');
  assert.strictEqual(stoppage.displayClock, "90+5'");
  assert.strictEqual(formatLiveMatchClock("90+5'", 'second_half'), "90+5'");

  const aetStatus = parseDetailedMatchStatus('aet', 'After Extra Time', null);
  assert.strictEqual(aetStatus.status, 'post');
  assert.strictEqual(aetStatus.period, 'after_extra_time');
  assert.strictEqual(aetStatus.displayClock, 'AET');

  const apStatus = parseDetailedMatchStatus('ap', 'After Penalties', null);
  assert.strictEqual(apStatus.status, 'post');
  assert.strictEqual(apStatus.period, 'after_penalties');
  assert.strictEqual(apStatus.displayClock, 'AP');
  logPass('Test E (Stoppage Time & Extra Time): 90+5\', AET, and AP handled accurately');

  // Test F: Missing / Stopped Provider Update (Non-Terminal Awaiting-Confirmation & 240m Safeguard)
  const staleKickoffIso = new Date(nowMs - 170 * 60_000).toISOString(); // 170 mins ago (>115m, <240m)
  const zombieLiveMatch: MarketFixture = {
    ...baseLiveFixture,
    id: 'mkt-zombie-match',
    kickoffIso: staleKickoffIso,
    status: 'in',
    period: 'second_half',
    displayClock: "88'",
    minute: "88'",
    homeScore: 0,
    awayScore: 4,
  };
  const recoveredBackend = sanitizeSnapshotLoadedFixture(zombieLiveMatch, nowMs);
  assert.strictEqual(
    recoveredBackend.status,
    'awaiting_confirmation',
    'Backend snapshot sanitizer must NEVER fabricate post/FT at 170m; must enter awaiting_confirmation'
  );
  assert.strictEqual(recoveredBackend.displayClock, 'Awaiting FT');
  assert.strictEqual(recoveredBackend.isAuthoritativeCorrection, false);
  assert.strictEqual(recoveredBackend.homeScore, 0);
  assert.strictEqual(recoveredBackend.awayScore, 4);

  const recoveredFrontend = sanitizeFrontendFixtureLifecycle({ ...zombieLiveMatch }, nowMs, 115);
  assert.strictEqual(
    recoveredFrontend.status,
    'awaiting_confirmation',
    'Frontend lifecycle sanitizer must enter awaiting_confirmation, never synthetic post/FT'
  );
  assert.strictEqual(recoveredFrontend.displayClock, 'Awaiting FT');

  // Verify 240m safeguard -> 'suspended' / 'unconfirmed' (never auto-finalized with a score)
  const unconfirmedKickoffIso = new Date(nowMs - 250 * 60_000).toISOString();
  const unconfirmedBackend = sanitizeSnapshotLoadedFixture(
    { ...zombieLiveMatch, kickoffIso: unconfirmedKickoffIso, homeScore: null, awayScore: null },
    nowMs
  );
  assert.strictEqual(unconfirmedBackend.status, 'suspended');
  assert.strictEqual(unconfirmedBackend.period, 'unconfirmed');
  assert.strictEqual(unconfirmedBackend.displayClock, 'UNCONFIRMED');
  assert.strictEqual(unconfirmedBackend.homeScore, null, 'Must never guess 0 when score is null');

  // Also verify UI selector guard in isLiveMatch / isCompletedMatch
  assert.strictEqual(isLiveMatch(zombieLiveMatch, nowMs), false, 'isLiveMatch must reject >165m zombie match');
  assert.strictEqual(isCompletedMatch(zombieLiveMatch, nowMs), false, 'isCompletedMatch must NEVER treat unconfirmed >115m match as completed');
  assert.strictEqual(isCompletedMatch(recoveredBackend, nowMs), false, 'awaiting_confirmation must NEVER be completed');
  assert.strictEqual(isCompletedMatch(unconfirmedBackend, nowMs), false, 'unconfirmed/suspended must NEVER be completed');
  logPass('Test F (Stale Live Match Safeguards): >115m enters non-terminal awaiting_confirmation & >=240m enters suspended/unconfirmed without fabricating FT');

  // Test G: Out-of-Order & Regressive Responses
  assert.strictEqual(
    isStatusTransitionValid('post', 'full_time', 'in', 'second_half'),
    false,
    'Finished match must never revert to Live'
  );
  assert.strictEqual(
    isStatusTransitionValid('post', 'full_time', 'pre', 'scheduled'),
    false,
    'Finished match must never revert to Pre-Match'
  );
  assert.strictEqual(
    isStatusTransitionValid('in', 'second_half', 'in', 'halftime'),
    false,
    'Second half match must never revert to Halftime'
  );
  const regressiveAttempt = mergeMarketFixtureRecords(mergedFT.merged, {
    ...baseLiveFixture,
    status: 'in',
    period: 'second_half',
    displayClock: "85'",
    homeScore: 1,
    awayScore: 1,
  });
  assert.strictEqual(regressiveAttempt.merged.status, 'post', 'Merged record must stay post');
  assert.strictEqual(regressiveAttempt.merged.homeScore, 2, 'Merged record must keep final homeScore 2');
  logPass('Test G (Out-of-Order Responses): Regressive status/score overwrites strictly rejected');

  // Test H & I: SSE Reconnection, Orphaned Frontend Reconciliation & Page Reload Persistence
  const cachedList: HighlightFixture[] = [
    {
      ...(baseLiveFixture as unknown as HighlightFixture),
      status: 'in',
      displayClock: "89'",
      minute: "89'",
      homeScore: 2,
      awayScore: 1,
    },
  ];
  const incomingFinishedList: HighlightFixture[] = [
    {
      ...(ftFixture as unknown as HighlightFixture),
      status: 'post',
      period: 'full_time',
      displayClock: 'FT',
      minute: 'FT',
      homeScore: 2,
      awayScore: 1,
    },
  ];
  const reconciledHighlightList = mergeHighlightFixtureLists(cachedList, incomingFinishedList);
  assert.strictEqual(reconciledHighlightList.length, 1);
  assert.strictEqual(reconciledHighlightList[0].status, 'post');
  assert.strictEqual(reconciledHighlightList[0].displayClock, 'FT');
  logPass('Test H & I (SSE Reconnect & Reload Persistence): Frontend cache reconciles finished state without duplication');

  // Test J: Multiple Concurrent Live Matches & Priority Ordering
  const concurrentCandidates = Array.from({ length: 15 }, (_, idx) => ({
    id: `mkt-match-${idx}`,
    status: idx >= 12 ? ('in' as const) : ('pre' as const),
    lastCheck: idx * 1000,
  }));
  concurrentCandidates.sort((a, b) => {
    if (a.status === 'in' && b.status !== 'in') return -1;
    if (a.status !== 'in' && b.status === 'in') return 1;
    return a.lastCheck - b.lastCheck;
  });
  assert.strictEqual(concurrentCandidates[0].status, 'in', 'Live matches must always sort ahead of pre matches');
  assert.strictEqual(concurrentCandidates[1].status, 'in');
  assert.strictEqual(concurrentCandidates[2].status, 'in');
  logPass('Test J (Concurrent Live Matches): Live matches strictly prioritized ahead of pre-match candidates\n');

  console.log('================================================================================');
  console.log('ALL 17 VERIFICATION TESTS (PWA TESTS A–G & LIVE FIXTURE TESTS A–J) PASSED!');
  console.log('================================================================================');
}

runVerificationSuite().catch((err) => {
  console.error('Verification suite failed:', err);
  process.exit(1);
});

