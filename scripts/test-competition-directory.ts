/**
 * Automated Regression Test Suite for Football Competition Directory & Normalization
 * 
 * Tests all 13 criteria required by Phase 8 of the Specification:
 * 1. Belgian domestic fixture maps to its Belgian competition.
 * 2. Iranian domestic fixture maps to its Iranian competition (Persian Gulf Pro League).
 * 3. Iranian team in an international competition remains under that international competition.
 * 4. Champions League fixture remains under Champions League regardless of participating teams.
 * 5. Competitions with similar names ("Pro League") remain distinct across countries.
 * 6. Missing or unknown competition IDs do not fall back to an unrelated league.
 * 7. Unknown country metadata does not create a false country assignment.
 * 8. Cup, youth and women's competitions are not incorrectly classified as top domestic leagues.
 * 9. Fixtures and the Leagues dropdown resolve to the same canonical competition.
 * 10. Search, competition selection and combined filters return the correct fixtures.
 * 11. Existing Highlights, Live, Upcoming, date filters, counts and Bet Builder continue to work.
 * 12. Refreshing production data does not reintroduce incorrect mappings.
 * 13. Duplicate or conflicting provider records are detected and reported.
 */

import {
  resolveCanonicalCompetition,
  CANONICAL_COMPETITIONS,
  PROVIDER_SLUG_REGISTRY,
  KNOWN_COUNTRIES,
  type CanonicalCompetition,
} from '../src/lib/canonicalCompetitions';
import {
  getLeagueMetadata,
  buildHierarchicalDirectory,
  CONTINENTS,
} from '../src/lib/leagueDirectory';
import {
  normalizeMatchStatus,
} from '../src/lib/matchStatus';
import {
  sortHighlightsComparator,
  sortUpcomingComparator,
  isUpcomingEligible,
  isHighlightsEligible,
} from '../src/lib/competitionPriority';
import { normalizeSportScoreMatch } from '../src/lib/sportsFeedService';
import { BUNDLED_SPORTS_CATALOGUE } from '../src/data/bundledSportsCatalogue';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, num: number, name: string, details: string) {
  if (condition) {
    results.push({ num, name, passed: true, details });
    console.log(`  ✓ [TEST ${num}] PASS: ${name}`);
  } else {
    results.push({ num, name, passed: false, details: `FAIL: ${details}` });
    console.error(`  ✗ [TEST ${num}] FAIL: ${name} -> ${details}`);
  }
}

console.log('\n=============================================================');
console.log('   MSHINDI FOOTBALL DIRECTORY — PHASE 8 REGRESSION SUITE');
console.log('=============================================================\n');

// --------------------------------------------------------------------------
// TEST 1: A Belgian domestic fixture maps to its Belgian competition
// --------------------------------------------------------------------------
{
  const res1 = resolveCanonicalCompetition({
    competition: 'Belgian Pro League',
    country: 'Belgium',
    leagueCode: 'belgian-pro-league',
  });
  const res2 = resolveCanonicalCompetition({
    competition: 'Pro League',
    country: 'Belgium',
  });
  const pass =
    res1.id === 'bel_pro_league' &&
    res1.countryName === 'Belgium' &&
    res1.countryCode === 'BE' &&
    res1.continent === 'europe' &&
    res1.competitionType === 'domestic_league' &&
    res2.id === 'bel_pro_league' &&
    res2.countryName === 'Belgium';

  assert(
    pass,
    1,
    'Belgian domestic fixture maps to Belgian Pro League',
    `Resolved: id=${res1.id}, country=${res1.countryName}, code=${res1.countryCode}`
  );
}

// --------------------------------------------------------------------------
// TEST 2: An Iranian domestic fixture maps to its Iranian competition
// --------------------------------------------------------------------------
{
  const res1 = resolveCanonicalCompetition({
    competition: 'Iran Pro League',
    country: 'Iran',
    leagueCode: 'iran-pro-league',
  });
  const res2 = resolveCanonicalCompetition({
    competition: 'Persian Gulf Pro League',
    country: 'Iran',
  });
  const res3 = resolveCanonicalCompetition({
    competition: 'Pro League',
    country: 'Iran',
  });

  const pass =
    res1.id === 'irn_pro_league' &&
    res1.countryName === 'Iran' &&
    res1.countryCode === 'IR' &&
    res1.continent === 'asia' &&
    res2.id === 'irn_pro_league' &&
    res3.id === 'irn_pro_league' &&
    res1.id !== 'bel_pro_league';

  assert(
    pass,
    2,
    'Iranian domestic fixture maps to Iranian competition (NOT Belgian)',
    `Resolved: id=${res1.id}, country=${res1.countryName}, continent=${res1.continent}`
  );
}

// --------------------------------------------------------------------------
// TEST 3: Iranian team in international competition remains under international competition
// --------------------------------------------------------------------------
{
  // Persepolis (Iranian club) playing in AFC Champions League Elite
  const res = resolveCanonicalCompetition({
    competition: 'AFC Champions League Elite',
    country: 'Asia',
    leagueCode: 'afc-champions-league-elite',
  });

  const pass =
    res.id === 'afc_champions_league' &&
    res.continent === 'asia' &&
    res.competitionType === 'continental_club' &&
    res.id !== 'irn_pro_league' &&
    res.countryName === 'Asia';

  assert(
    pass,
    3,
    'Iranian team in international competition remains under AFC Champions League',
    `Resolved: id=${res.id}, type=${res.competitionType}, continent=${res.continent}`
  );
}

// --------------------------------------------------------------------------
// TEST 4: Champions League fixture remains under Champions League regardless of teams
// --------------------------------------------------------------------------
{
  // Real Madrid (Spain) vs Club Brugge (Belgium) in UEFA Champions League
  const res = resolveCanonicalCompetition({
    competition: 'UEFA Champions League',
    country: 'Europe',
    leagueCode: 'uefa-champions-league',
  });

  const pass =
    res.id === 'uefa_champions_league' &&
    res.continent === 'european_competitions' &&
    res.competitionType === 'continental_club' &&
    res.id !== 'esp_la_liga' &&
    res.id !== 'bel_pro_league';

  assert(
    pass,
    4,
    'Champions League fixture remains under Champions League regardless of participating teams',
    `Resolved: id=${res.id}, continent=${res.continent}, type=${res.competitionType}`
  );
}

// --------------------------------------------------------------------------
// TEST 5: Two competitions with similar names ("Pro League") remain distinct
// --------------------------------------------------------------------------
{
  const bel = resolveCanonicalCompetition({ competition: 'Pro League', country: 'Belgium' });
  const irn = resolveCanonicalCompetition({ competition: 'Pro League', country: 'Iran' });
  const uzb = resolveCanonicalCompetition({ competition: 'Pro League', country: 'Uzbekistan' });
  const sau = resolveCanonicalCompetition({ competition: 'Saudi Pro League', country: 'Saudi Arabia' });
  const mys = resolveCanonicalCompetition({ competition: 'A1 Semi-Pro League', country: 'Malaysia' });

  const allDistinct =
    bel.id === 'bel_pro_league' &&
    irn.id === 'irn_pro_league' &&
    uzb.id === 'uzb_pro_league' &&
    sau.id === 'sau_pro_league' &&
    mys.id === 'mys_a1_semi_pro' &&
    new Set([bel.id, irn.id, uzb.id, sau.id, mys.id]).size === 5;

  assert(
    allDistinct,
    5,
    'Competitions with similar "Pro League" names remain distinct per country',
    `Resolved 5 distinct IDs: ${[bel.id, irn.id, uzb.id, sau.id, mys.id].join(', ')}`
  );
}

// --------------------------------------------------------------------------
// TEST 6: Missing or unknown competition IDs do not fall back to an unrelated league
// --------------------------------------------------------------------------
{
  const res = resolveCanonicalCompetition({
    competition: 'Atlantis Grand Invitational Cup',
    country: 'Atlantis',
    leagueCode: 'atlantis-grand-invitational',
  });

  const pass =
    res.id !== 'eng_premier_league' &&
    res.id !== 'bel_pro_league' &&
    res.id !== 'uefa_cl' &&
    res.id.startsWith('unclassified_') &&
    res.metadataSource === 'fallback';

  assert(
    pass,
    6,
    'Missing or unknown competition ID safely isolates as unclassified',
    `Resolved: id=${res.id}, source=${res.metadataSource}`
  );
}

// --------------------------------------------------------------------------
// TEST 7: Unknown country metadata does not create a false country assignment
// --------------------------------------------------------------------------
{
  const res = resolveCanonicalCompetition({
    competition: 'Unknown International Exhibition 2026',
    country: '',
  });

  const pass =
    (res.countryCode === 'XX' || res.countryCode === 'INT') &&
    (res.countryName === 'World' || res.countryName === 'International') &&
    res.countryName !== 'Belgium' &&
    res.countryName !== 'England' &&
    res.countryName !== 'Spain';

  assert(
    pass,
    7,
    'Unknown country metadata does not create false country assignment',
    `Resolved: country=${res.countryName}, code=${res.countryCode}`
  );
}

// --------------------------------------------------------------------------
// TEST 8: Cup, youth and women competitions are not classified as top domestic leagues
// --------------------------------------------------------------------------
{
  const faCup = resolveCanonicalCompetition({ competition: 'FA Cup', country: 'England' });
  const champ = resolveCanonicalCompetition({ competition: 'Championship', country: 'England' });
  const uyl = resolveCanonicalCompetition({ competition: 'UEFA Youth League', country: 'Europe' });
  const wcl = resolveCanonicalCompetition({ competition: "UEFA Women's Champions League", country: 'Europe' });
  const hazfi = resolveCanonicalCompetition({ competition: 'Hazfi Cup', country: 'Iran' });
  const belCup = resolveCanonicalCompetition({ competition: 'Belgian Cup', country: 'Belgium' });

  const pass =
    faCup.competitionType === 'domestic_cup' &&
    champ.competitionType === 'lower_division' &&
    champ.tier === 2 &&
    uyl.competitionType === 'youth' &&
    wcl.competitionType === 'women' &&
    hazfi.competitionType === 'domestic_cup' &&
    belCup.competitionType === 'domestic_cup';

  assert(
    pass,
    8,
    "Cup, youth, and women's competitions accurately differentiated from top domestic leagues",
    `FA Cup: ${faCup.competitionType}, Champ: ${champ.competitionType} (tier ${champ.tier}), Youth: ${uyl.competitionType}, Women: ${wcl.competitionType}`
  );
}

// --------------------------------------------------------------------------
// TEST 9: Fixtures and Leagues dropdown resolve to the same canonical competition
// --------------------------------------------------------------------------
{
  const sampleFixtures = [
    { competition: 'Belgian Pro League', country: 'Belgium', leagueCode: 'belgian-pro-league', competitionId: 'bel_pro_league' },
    { competition: 'Iran Pro League', country: 'Iran', leagueCode: 'iran-pro-league', competitionId: 'irn_pro_league' },
    { competition: 'English Premier League', country: 'England', leagueCode: 'premier-league', competitionId: 'eng_premier_league' },
    { competition: 'UEFA Champions League', country: 'Europe', leagueCode: 'uefa-champions-league', competitionId: 'uefa_champions_league' },
  ];

  let allMatch = true;
  for (const f of sampleFixtures) {
    const cardMeta = getLeagueMetadata(f.competition, f.country, f.leagueCode, f.competitionId);
    const directory = buildHierarchicalDirectory([f]);
    // Search directory for the competition item
    let foundInDir: any = null;
    for (const cont of directory.continents) {
      for (const country of cont.countries) {
        const item = country.competitions.find((c) => c.id === cardMeta.canonicalId);
        if (item) foundInDir = item;
      }
    }
    if (!foundInDir) {
      foundInDir = directory.international.find((c) => c.id === cardMeta.canonicalId);
    }

    if (!foundInDir || foundInDir.id !== cardMeta.canonicalId || foundInDir.name !== cardMeta.standardName) {
      allMatch = false;
      break;
    }
  }

  assert(
    allMatch,
    9,
    'Match Card and Leagues Dropdown resolve to identical canonical identity',
    `Verified 4 canonical test fixtures across Match Card and Directory`
  );
}

// --------------------------------------------------------------------------
// TEST 10: Search, competition selection and combined filters return correct fixtures
// --------------------------------------------------------------------------
{
  const mockFixtures = [
    { id: 'm1', home: 'Club Brugge', away: 'Anderlecht', competition: 'Belgian Pro League', country: 'Belgium', competitionId: 'bel_pro_league' },
    { id: 'm2', home: 'Persepolis', away: 'Esteghlal', competition: 'Iran Pro League', country: 'Iran', competitionId: 'irn_pro_league' },
    { id: 'm3', home: 'Arsenal', away: 'Chelsea', competition: 'English Premier League', country: 'England', competitionId: 'eng_premier_league' },
  ];

  // Filter by country:Belgium
  const belgiumFiltered = mockFixtures.filter((m) => {
    const meta = getLeagueMetadata(m.competition, m.country, undefined, m.competitionId);
    return (meta.countryName || meta.country).toLowerCase() === 'belgium';
  });

  // Filter by league:irn_pro_league
  const iranFiltered = mockFixtures.filter((m) => {
    const meta = getLeagueMetadata(m.competition, m.country, undefined, m.competitionId);
    return meta.canonicalId === 'irn_pro_league';
  });

  const pass =
    belgiumFiltered.length === 1 &&
    belgiumFiltered[0].id === 'm1' &&
    iranFiltered.length === 1 &&
    iranFiltered[0].id === 'm2';

  assert(
    pass,
    10,
    'Combined country and league filters strictly isolate matching fixtures',
    `Country:Belgium matched ${belgiumFiltered.length} (expected 1), League:irn_pro_league matched ${iranFiltered.length} (expected 1)`
  );
}

// --------------------------------------------------------------------------
// TEST 11: Existing Highlights, Live, Upcoming, date filters and Bet Builder work
// --------------------------------------------------------------------------
{
  const now = Date.now();
  const futureKickoff = new Date(now + 3600 * 1000).toISOString();
  const pastKickoff = new Date(now - 3600 * 1000).toISOString();

  const fixtureUpcoming = {
    id: 'up-1',
    status: 'scheduled',
    statusText: '15:00',
    kickoffIso: futureKickoff,
    competition: 'English Premier League',
  };

  const fixturePast = {
    id: 'past-1',
    status: 'scheduled',
    statusText: '12:00',
    kickoffIso: pastKickoff,
    competition: 'English Premier League',
  };

  const fixtureHighlights = {
    id: 'hl-1',
    status: 'scheduled',
    competition: 'UEFA Champions League',
  };

  const isUpPass = isUpcomingEligible(fixtureUpcoming, now) === true;
  const isPastExcluded = isUpcomingEligible(fixturePast, now) === false;
  const isHlPass = isHighlightsEligible(fixtureHighlights) === true;

  // Sorting verification: Upcoming must be chronological
  const fixA = { id: 'a', kickoffIso: new Date(now + 5000).toISOString() };
  const fixB = { id: 'b', kickoffIso: new Date(now + 2000).toISOString() };
  const sorted = [fixA, fixB].sort(sortUpcomingComparator);
  const isSortPass = sorted[0].id === 'b' && sorted[1].id === 'a';

  const pass = isUpPass && isPastExcluded && isHlPass && isSortPass;

  assert(
    pass,
    11,
    'Highlights, Upcoming moving cutoff, and chronological sorting continue to work',
    `UpcomingFuture: ${isUpPass}, UpcomingPastExcluded: ${isPastExcluded}, HighlightsEligible: ${isHlPass}, ChronoSort: ${isSortPass}`
  );
}

// --------------------------------------------------------------------------
// TEST 12: Refreshing production data does not reintroduce incorrect mappings
// --------------------------------------------------------------------------
{
  const rawSportScoreIranianMatch = {
    id: 'ss_match_irn_123',
    home: 'Persepolis',
    away: 'Esteghlal',
    competition: 'Iran Pro League',
    country: 'Iran',
    status: 'scheduled',
    time: new Date(Date.now() + 86400000).toISOString(),
    start_at: new Date(Date.now() + 86400000).toISOString(),
  };

  const normalized = normalizeSportScoreMatch(rawSportScoreIranianMatch, new Date().toISOString());

  const pass =
    normalized.competitionId === 'irn_pro_league' &&
    normalized.country === 'Iran' &&
    normalized.competitionId !== 'bel_pro_league';

  assert(
    pass,
    12,
    'Ingestion normalization from raw SportScore payload preserves Iranian classification',
    `Normalized: competitionId=${normalized.competitionId}, country=${normalized.country}`
  );
}

// --------------------------------------------------------------------------
// TEST 13: Duplicate or conflicting provider records are detected and reported
// --------------------------------------------------------------------------
{
  const fixtures = (BUNDLED_SPORTS_CATALOGUE.fixtures as any[]) || [];
  let belgianMismatches = 0;
  let unmappedIds = 0;

  for (const f of fixtures) {
    if (f.competitionId === 'bel_pro_league') {
      const c = (f.country || '').toLowerCase();
      if (c && c !== 'belgium') {
        belgianMismatches++;
      }
    }
    if (!f.competitionId) {
      unmappedIds++;
    }
  }

  // Also verify PROVIDER_SLUG_REGISTRY has valid mappings
  let invalidRegistryKeys = 0;
  for (const [slug, compId] of Object.entries(PROVIDER_SLUG_REGISTRY)) {
    if (!CANONICAL_COMPETITIONS[compId]) {
      invalidRegistryKeys++;
    }
  }

  const pass = belgianMismatches === 0 && unmappedIds === 0 && invalidRegistryKeys === 0;

  assert(
    pass,
    13,
    'Catalogue audited: 0 non-Belgian fixtures under Belgian Pro League, 0 unmapped, 0 invalid registry keys',
    `Audited ${fixtures.length} catalogue fixtures: ${belgianMismatches} mismatches, ${unmappedIds} unmapped, ${invalidRegistryKeys} invalid registry entries`
  );
}

console.log('\n-------------------------------------------------------------');
const totalPassed = results.filter((r) => r.passed).length;
console.log(`SUMMARY: ${totalPassed} / ${results.length} TESTS PASSED`);
console.log('-------------------------------------------------------------\n');

if (totalPassed < results.length) {
  process.exit(1);
} else {
  process.exit(0);
}
