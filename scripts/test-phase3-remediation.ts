import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clearBet365OddsCacheForTests,
  enrichFixturesWithBet365Odds,
  fetchBet365OddsForMatch,
} from '../src/lib/sportscoreOddsService';
import { ingestFixtures, queryMarketFixtures, makeMarketFixtureDedupeKey } from '../src/lib/sportsFeedService';
import { makeFreeMatchDedupeKey } from '../src/lib/freeMatches';
import { buildCanonicalFixtureDedupeKey } from '../src/lib/fixtureIdentity';
import {
  isValidKenyanPhone,
  normalizeKenyanPhone,
  formatE164KenyanPhone,
} from '../src/lib/phoneUtils';
import { normalizePhone, isValidPhone, isValidUsername } from '../src/lib/authStore';
import {
  normalizePhoneDigits as serverNormalizePhone,
  isValidKenyanPhone as serverIsValidPhone,
  isValidUsernameFormat as serverIsValidUsername,
} from '../src/lib/serverAuthService';
import { evaluateUsernameWithDictionary } from '../src/lib/moderationEngine';
import { createInitialPlayerProfile, calculateStarsFromRp } from '../src/lib/ratingEngine';
import {
  clearPunterRatingsCacheForTests,
  getPlayerProfile,
  getPunterStats,
} from '../src/lib/punterRatings';
import { useUserPicks } from '../src/lib/userPicksStore';
import {
  clearDirectoryCacheForTests,
  fetchAuthoritativePunters,
  getAllPunters,
} from '../src/lib/punterDirectory';

function pass(msg: string) {
  console.log(`PASS: ${msg}`);
}

async function runTests() {
  console.log('=== PHASE 3 REMEDIATION TESTS (ODDS, VALIDATORS, DEDUPE, PUNTER INTEGRITY) ===');

  // 1. FND-009: Negative caching, in-flight deduplication, and snapshot odds retention
  clearBet365OddsCacheForTests();
  const originalFetch = globalThis.fetch;
  let fetchCalls: string[] = [];

  const sampleOddsHtml = `
    <div class="fb-odds-book__chip">BET365</div>
    <table class="fb-odds-table">
      <tbody>
        <tr class="fb-odds-row--prematch">
          <td><span class="pr">2.15</span></td>
          <td><span class="pr">3.25</span></td>
          <td><span class="pr">3.40</span></td>
        </tr>
      </tbody>
    </table>
  `;

  globalThis.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : String(input?.url || input);
    fetchCalls.push(url);
    if (url.includes('/api/auth/directory')) {
      return new Response(
        JSON.stringify({
          success: true,
          punters: [{ username: 'RealKenyapunter_254', avatarId: 'lion', verifiedWithSms: true }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (url.includes('404-no-odds')) {
      return new Response('Not Found', { status: 404 });
    }
    await new Promise((r) => setTimeout(r, 25));
    return new Response(sampleOddsHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }) as any;

  try {
    // 1a. Negative caching for 404 missing odds (2 calls -> 1 HTTP request)
    fetchCalls = [];
    const missPath = '/football/match/404-no-odds-vs-fc-test/abc123def456/';
    const miss1 = await fetchBet365OddsForMatch(missPath);
    const miss2 = await fetchBet365OddsForMatch(missPath);
    assert.equal(miss1, null);
    assert.equal(miss2, null);
    assert.equal(fetchCalls.length, 1, 'Repeated 404 odds lookup within negative TTL must make only 1 HTTP call');
    pass('3.1a Bet365 404 negative cache suppresses redundant fetches');

    // 1b. Concurrent in-flight request deduplication (2 concurrent calls -> 1 HTTP request)
    fetchCalls = [];
    const concurrentPath = '/football/match/arsenal-vs-chelsea-phase3/xyz987uvw654/';
    const [o1, o2] = await Promise.all([
      fetchBet365OddsForMatch(concurrentPath),
      fetchBet365OddsForMatch(concurrentPath),
    ]);
    assert.equal(fetchCalls.length, 1, 'Concurrent fetchBet365OddsForMatch calls must share one in-flight request');
    assert.equal(o1?.bookmaker, 'Bet365');
    assert.equal(o2?.homeOdds, o1?.homeOdds);
    pass('3.1b Bet365 in-flight request deduplication verified');

    // 1c. Weekly fixture ingestion ordering: enrichFixturesWithBet365Odds runs BEFORE ingestFixtures
    const weeklySource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'weeklyFixtureService.ts'),
      'utf-8'
    );
    const enrichPos = weeklySource.indexOf('await enrichFixturesWithBet365Odds(allEligibleFixtures');
    const ingestPos = weeklySource.indexOf('ingestFixtures(allEligibleFixtures');
    assert.ok(enrichPos > 0 && ingestPos > enrichPos, 'enrichFixturesWithBet365Odds must run before ingestFixtures');

    // Verify enrich-then-ingest retains Bet365 odds in fixturesStore (queryMarketFixtures)
    const testFixture: any = {
      id: 'mkt-ss-phase3-odds-test',
      matchId: 'phase3odds999',
      matchUrl: concurrentPath,
      home: 'Arsenal',
      away: 'Chelsea',
      competition: 'Premier League',
      leagueCode: 'premier',
      kickoffIso: new Date(Date.now() + 86400000).toISOString(),
      status: 'pre',
      homeOdds: 1.9,
      drawOdds: 3.1,
      awayOdds: 4.0,
    };
    await enrichFixturesWithBet365Odds([testFixture], 5, 2);
    ingestFixtures([testFixture], false);
    const stored = queryMarketFixtures({ scope: 'all' }).find((f) => f.id === 'mkt-ss-phase3-odds-test');
    assert.equal(stored?.bookmaker, 'Bet365');
    assert.equal(stored?.homeOdds, 2.15);
    pass('3.1c Enrich-before-ingest retains authentic Bet365 odds in authoritative store');

    // 2. FND-017: Unified Kenyan phone, username, and cross-timezone EAT deduplication
    const phoneSamples = [
      ['0712345678', true, '254712345678'],
      ['+254712345678', true, '254712345678'],
      ['254110000111', true, '254110000111'],
      ['712345678', true, '254712345678'],
      ['1234567890', false, '1234567890'],
      ['07123', false, '07123'],
    ] as const;

    for (const [input, expectedValid, expectedNorm] of phoneSamples) {
      assert.equal(normalizeKenyanPhone(input), expectedNorm);
      assert.equal(normalizePhone(input), expectedNorm);
      assert.equal(serverNormalizePhone(input), expectedNorm);
      assert.equal(isValidKenyanPhone(input), expectedValid, `phoneUtils validity for ${input}`);
      assert.equal(isValidPhone(input), expectedValid, `authStore validity for ${input}`);
      assert.equal(serverIsValidPhone(input), expectedValid, `serverAuthService validity for ${input}`);
    }
    assert.equal(formatE164KenyanPhone('0743304579'), '+254743304579');

    const usernameSamples = [
      ['Tipster_254', true],
      ['ab', false],
      ['TooLongUsername17', false],
      ['Bad<Script>', false],
      ['Kenya_King99', true],
    ] as const;

    for (const [uname, expectedValid] of usernameSamples) {
      assert.equal(isValidUsername(uname), expectedValid, `authStore username ${uname}`);
      assert.equal(serverIsValidUsername(uname), expectedValid, `serverAuthService username ${uname}`);
      assert.equal(evaluateUsernameWithDictionary(uname, []).isAllowed, expectedValid, `moderation username ${uname}`);
    }

    // Cross-timezone EAT fixture deduplication parity (21:30 UTC == 00:30 EAT next day!)
    const utcLate = {
      home: 'Arsenal FC',
      away: 'Chelsea',
      kickoffIso: '2026-11-14T21:30:00.000Z', // 2026-11-15 00:30 EAT!
    };
    const eatNextDay = {
      home: 'Arsenal',
      away: 'Chelsea FC',
      kickoffIso: '2026-11-15T00:30:00+03:00',
    };
    assert.equal(
      buildCanonicalFixtureDedupeKey(utcLate),
      buildCanonicalFixtureDedupeKey(eatNextDay),
      '21:30 UTC and 00:30+03:00 EAT must resolve to the same canonical EAT day key'
    );
    assert.equal(
      makeMarketFixtureDedupeKey(utcLate),
      makeFreeMatchDedupeKey(eatNextDay),
      'Server MarketFixture & Client FreeMatch dedupe keys must agree across EAT midnight'
    );
    assert.ok(buildCanonicalFixtureDedupeKey(utcLate).endsWith('___15_11'), 'EAT day key must reflect Nov 15');

    const useAuthFlowSource = fs.readFileSync(path.join(process.cwd(), 'src', 'lib', 'useAuthFlow.ts'), 'utf-8');
    assert.ok(useAuthFlowSource.includes('checkUsernameAvailability('), 'useAuthFlow must wire /api/auth/availability');
    pass('3.2 Unified phone, username, availability, and EAT timezone deduplication parity verified');

    // 3. FND-018: Zero fabricated rookie stats, unified pick edit tracking, authoritative directory
    clearPunterRatingsCacheForTests();
    const realNewProfile = createInitialPlayerProfile('FreshRealUser99');
    assert.equal(realNewProfile.accuracyPct, 0);
    assert.equal(realNewProfile.totalJackpotsPlayed, 0);
    assert.equal(realNewProfile.rp, 0);
    assert.equal(realNewProfile.stars, 1.0);

    const fetchedRealStats = getPunterStats('AnotherNewPunter');
    assert.equal(fetchedRealStats.accuracyPct, 0);
    assert.equal(fetchedRealStats.gamesTracked, 0);
    assert.equal(fetchedRealStats.stars, 1.0);

    const showcaseStats = getPlayerProfile('MshindiPro');
    assert.equal(
      showcaseStats.stars,
      calculateStarsFromRp(showcaseStats.rp).stars,
      'Showcase profile stars must stay consistent with RP calculation'
    );

    // Pick edits consolidated into useUserPicks
    assert.equal(useUserPicks.getState().canEditPick('pick-phase3-1'), true);
    useUserPicks.getState().incrementPickEdit('pick-phase3-1');
    assert.equal(useUserPicks.getState().canEditPick('pick-phase3-1'), true);
    useUserPicks.getState().incrementPickEdit('pick-phase3-1');
    assert.equal(useUserPicks.getState().canEditPick('pick-phase3-1'), false);

    // Authoritative directory hydration merges /api/auth/directory without fabricated stats
    clearDirectoryCacheForTests();
    const hydrated = await fetchAuthoritativePunters('');
    const realEntry = hydrated.find((p) => p.username === 'RealKenyapunter_254');
    assert.ok(realEntry, 'Authoritative /api/auth/directory punter must appear in directory');
    assert.equal(realEntry?.isRegisteredAccount, true);
    assert.equal(realEntry?.isShowcase, false);
    assert.equal(realEntry?.accuracyPct, 0, 'Real directory punter must not have fabricated accuracy');

    const seedEntry = getAllPunters().find((p) => p.username === 'MshindiPro');
    assert.equal(seedEntry?.isShowcase, true, 'Showcase seed punters must be explicitly tagged');
    pass('3.3 Real baseline rookie ratings, unified pick-edit tracking, and authoritative directory verified');

    console.log('ALL PHASE 3 REMEDIATION TESTS PASSED');
  } finally {
    globalThis.fetch = originalFetch;
    clearBet365OddsCacheForTests();
    clearPunterRatingsCacheForTests();
    clearDirectoryCacheForTests();
  }
}

runTests().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});

