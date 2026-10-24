/**
 * End-to-End Test Suite for Sports Fixture PDF Parsing & Ingestion Pipeline
 * 
 * Verifies:
 * 1. Complete PDF extraction across all pages with zero fixture loss (100/100 matches in media_1792667207847.pdf)
 * 2. Multi-page context: Reset per page; orphan heading at bottom of page 1 carries forward; stale context never bleeds across pages
 * 3. Accurate country and competition resolution:
 *    - Spain - Segunda Rfef, Group IV
 *    - Spain Amateur - Tercera Division, Group 3
 *    - Portugal - Primeira Liga
 *    - Belgium - Super League, Women
 *    - International Clubs - CAF Champions League
 *    - Brazil - U20 Carioca, Serie A2 (must NEVER match bra_serie_a)
 *    - Similar league names across different countries (Premier League in England, Malta, Armenia, Bahrain, Egypt, Kenya)
 * 4. Reliable identification of match ID, date, time, home team, away team
 * 5. Optional odds resilience (fixtures without odds must NOT be dropped)
 * 6. Non-fixture content positive exclusion (headers, column titles, page numbers, footers, paybills, licensing, URLs, email)
 * 7. Idempotent batch database ingestion with deduplication and no 100-match cap (>100 fixtures batch test)
 */

import fs from 'fs';
import path from 'path';
import { extractPdfTextServer, extractPdfPagesServer } from '../src/lib/serverPdfParser';
import { parseFixturesText, parseSingleFixtureLine, detectCompetitionHeader, isNonFixtureLine } from '../src/lib/fixturePdfParser';
import { ingestAdminFixtures, clearAllFixtures, getSavedAdminFixtures } from '../src/lib/sportsFeedService';
import { appendUploadedFreeMatches } from '../src/lib/freeMatches';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('  FIXTURE PDF PARSING & INGESTION PIPELINE END-TO-END TEST SUITE');
  console.log('================================================================\n');

  const pdfPath = 'C:\\Users\\kipto\\.gemini\\antigravity-ide\\brain\\a9059717-8319-47aa-b19f-6a5bbf05445a\\.user_uploaded\\media_1792667207847.pdf';

  // -------------------------------------------------------------------------
  // SUITE 1: REAL PDF PARSING (media_1792667207847.pdf)
  // -------------------------------------------------------------------------
  console.log('--- TEST SUITE 1: Real Multi-Page PDF (media_1792667207847.pdf) ---');
  assert(fs.existsSync(pdfPath), 'Supplied PDF media_1792667207847.pdf exists');

  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfPages = extractPdfPagesServer(pdfBuffer);
  assert(pdfPages.length === 4, `Extracted all 4 pages from PDF (found ${pdfPages.length})`);

  const rawPdfText = extractPdfTextServer(pdfBuffer);
  const parseResult = parseFixturesText(rawPdfText);

  assert(parseResult.fixtures.length === 100, `Parsed exactly 100/100 fixtures without loss (found ${parseResult.fixtures.length})`);
  assert(parseResult.marketFixtures.length === 100, `Generated exactly 100 market fixtures (found ${parseResult.marketFixtures.length})`);
  assert(parseResult.stats.acceptedCount === 100, `All 100 fixtures accepted (accepted: ${parseResult.stats.acceptedCount})`);
  assert(parseResult.stats.reviewRequiredCount === 0, `Zero review required rows on valid official PDF (found ${parseResult.stats.reviewRequiredCount})`);
  assert(parseResult.stats.rejectedCount === 0, `Zero rejected rows on official fixtures (found ${parseResult.stats.rejectedCount})`);

  // Verify match IDs
  const fixturesWithId = parseResult.fixtures.filter(f => f.matchId && /^\d{4}$/.test(f.matchId));
  assert(fixturesWithId.length === 100, `Every one of the 100 fixtures has a valid 4-digit Match ID (found ${fixturesWithId.length})`);

  // Check specific first and last fixtures
  const firstFixture = parseResult.fixtures[0];
  assert(firstFixture.matchId === '4729', `First fixture match ID is 4729 (actual: ${firstFixture.matchId})`);
  assert(firstFixture.homeTeam === 'Gia Dinh', `First fixture home team is Gia Dinh (actual: ${firstFixture.homeTeam})`);
  assert(firstFixture.awayTeam === 'PHO Hien FC', `First fixture away team is PHO Hien FC (actual: ${firstFixture.awayTeam})`);
  assert(firstFixture.country === 'Vietnam', `First fixture country is Vietnam (actual: ${firstFixture.country})`);
  assert(firstFixture.competition === 'V-League 2', `First fixture competition is V-League 2 (actual: ${firstFixture.competition})`);

  const lastFixture = parseResult.fixtures[99];
  assert(lastFixture.matchId === '3742', `Last fixture match ID is 3742 (actual: ${lastFixture.matchId})`);
  assert(lastFixture.homeTeam === 'CD Motagua', `Last fixture home team is CD Motagua (actual: ${lastFixture.homeTeam})`);
  assert(lastFixture.awayTeam === 'LD Alajuelense', `Last fixture away team is LD Alajuelense (actual: ${lastFixture.awayTeam})`);
  assert(lastFixture.country === 'International Clubs', `Last fixture country is International Clubs (actual: ${lastFixture.country})`);
  assert(lastFixture.competition === 'CONCACAF Central American Cup', `Last fixture competition is CONCACAF Central American Cup (actual: ${lastFixture.competition})`);

  // -------------------------------------------------------------------------
  // SUITE 2: MULTI-PAGE BOUNDARY CONTEXT & ORPHAN HEADING RESOLUTION
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Multi-Page Boundary Context & Stale Context Prevention ---');
  // 1. Armenia - Premier League appeared at the bottom of Page 1 with 0 fixtures on Page 1.
  // It must correctly head 2956 Sardarapat FC vs Urartu at the top of Page 2.
  const armeniaMatch = parseResult.fixtures.find(f => f.matchId === '2956');
  assert(!!armeniaMatch, 'Found fixture 2956 (Sardarapat FC vs Urartu)');
  assert(armeniaMatch?.country === 'Armenia', `2956 Sardarapat FC country is Armenia (actual: ${armeniaMatch?.country})`);
  assert(armeniaMatch?.competition === 'Premier League', `2956 Sardarapat FC competition is Premier League (actual: ${armeniaMatch?.competition})`);

  // 2. Synthetic test: Verify stale context NEVER bleeds across pages if previous page consumed its heading
  const syntheticMultiPage = `
Sports Betting Homepage > Upcoming Games
ke.sportpesa.com Page 1 of 2
Brazil - U20 Carioca, Serie A2
1111 22-10-2026 - 15:00 TeamAlpha TeamBeta 2.00 3.00 3.50
ke.sportpesa.com Page 1 of 2
--- PAGE BREAK ---
Sports Betting Homepage > Upcoming Games
ke.sportpesa.com Page 2 of 2
2222 22-10-2026 - 16:00 TeamGamma TeamDelta 2.10 3.20 3.10
France - Ligue 2
3333 22-10-2026 - 17:00 TeamEpsilon TeamZeta 1.90 3.40 4.00
ke.sportpesa.com Page 2 of 2
`;
  const synthResult = parseFixturesText(syntheticMultiPage);
  assert(synthResult.fixtures.length === 3, `Parsed all 3 fixtures across 2 pages (found ${synthResult.fixtures.length})`);
  
  const unheadedMatch = synthResult.fixtures.find(f => f.matchId === '2222');
  assert(!!unheadedMatch, 'Found match 2222 from page 2');
  assert(unheadedMatch?.status === 'review_required', `Match 2222 lacking heading is flagged as review_required (actual: ${unheadedMatch?.status})`);
  assert(unheadedMatch?.competition !== 'U20 Carioca, Serie A2', `Match 2222 did NOT inherit stale Brazil context from page 1!`);
  
  const headedMatch = synthResult.fixtures.find(f => f.matchId === '3333');
  assert(headedMatch?.country === 'France' && headedMatch?.competition === 'Ligue 2', `Match 3333 after explicit heading correctly assigned to France Ligue 2`);

  // -------------------------------------------------------------------------
  // SUITE 3: ACCURATE COUNTRY & COMPETITION IDENTIFICATION (REQ 3)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: Accurate Country & Competition Qualifier Preservation ---');
  
  // 1. Brazil - U20 Carioca, Serie A2 must NOT be hijacked to bra_serie_a
  const cariocaMatch = parseResult.fixtures.find(f => f.matchId === '3884');
  assert(!!cariocaMatch, 'Found fixture 3884 (Olaria AC RJ vs Audax Rio EC RJ)');
  assert(cariocaMatch?.country === 'Brazil', `3884 country is Brazil (actual: ${cariocaMatch?.country})`);
  assert(cariocaMatch?.competition === 'U20 Carioca, Serie A2', `3884 competition preserves exact qualifier "U20 Carioca, Serie A2" (actual: ${cariocaMatch?.competition})`);
  assert(cariocaMatch?.competitionId !== 'bra_serie_a', `3884 competitionId is NOT hijacked to bra_serie_a (actual: ${cariocaMatch?.competitionId})`);

  // 2. Spain - Segunda Rfef, Group IV
  const spainRfefHeader = detectCompetitionHeader('Spain - Segunda Rfef, Group IV');
  assert(spainRfefHeader?.country === 'Spain', `Spain - Segunda Rfef, Group IV country is Spain`);
  assert(spainRfefHeader?.league === 'Segunda Rfef, Group IV', `Spain - Segunda Rfef, Group IV league preserves Group IV`);
  const spainRfefParsed = parseSingleFixtureLine('4001 24-10-2026 - 17:00 CD Coria CP Cacereno 2.10 3.00 3.20', spainRfefHeader!.country, spainRfefHeader!.league);
  assert(spainRfefParsed?.competition === 'Segunda Rfef, Group IV', `Segunda Rfef, Group IV competition preserves Group IV verbatim (actual: ${spainRfefParsed?.competition})`);
  assert(spainRfefParsed?.competitionId !== 'esp_la_liga' && spainRfefParsed?.competitionId !== 'esp_segunda', `Segunda Rfef is not hijacked to esp_la_liga or esp_segunda`);

  // 3. Spain Amateur - Tercera Division, Group 3
  const spainAmateurHeader = detectCompetitionHeader('Spain Amateur - Tercera Division, Group 3');
  assert(spainAmateurHeader?.country === 'Spain Amateur', `Spain Amateur heading country is Spain Amateur (actual: ${spainAmateurHeader?.country})`);
  assert(spainAmateurHeader?.league === 'Tercera Division, Group 3', `Spain Amateur heading league is Tercera Division, Group 3`);
  const spainAmateurParsed = parseSingleFixtureLine('4002 24-10-2026 - 18:00 CD Laredo UM Escobedo 1.80 3.20 4.10', spainAmateurHeader!.country, spainAmateurHeader!.league);
  assert(spainAmateurParsed?.competition === 'Tercera Division, Group 3', `Tercera Division, Group 3 preserved verbatim`);

  // 4. Portugal - Primeira Liga
  const portugalHeader = detectCompetitionHeader('Portugal - Primeira Liga');
  const portugalParsed = parseSingleFixtureLine('4003 24-10-2026 - 20:00 Benfica Porto 2.10 3.30 3.40', portugalHeader!.country, portugalHeader!.league);
  assert(portugalParsed?.country === 'Portugal', `Portugal Primeira Liga country is Portugal`);
  assert(portugalParsed?.competition === 'Primeira Liga', `Portugal Primeira Liga competition is Primeira Liga`);
  assert(portugalParsed?.competitionId === 'por_primeira_liga', `Portugal Primeira Liga resolves to por_primeira_liga canonical ID`);

  // 5. Belgium - Super League, Women
  const belgiumWomenHeader = detectCompetitionHeader('Belgium - Super League, Women');
  const belgiumWomenParsed = parseSingleFixtureLine('4004 24-10-2026 - 15:00 Anderlecht W Standard Liege W 1.40 4.20 5.50', belgiumWomenHeader!.country, belgiumWomenHeader!.league);
  assert(belgiumWomenParsed?.country === 'Belgium', `Belgium Women country is Belgium`);
  assert(belgiumWomenParsed?.competition === 'Super League, Women', `Belgium Women preserves "Super League, Women" (actual: ${belgiumWomenParsed?.competition})`);
  assert(belgiumWomenParsed?.competitionId !== 'bel_pro_league', `Belgium Super League Women is NOT hijacked to Belgian Pro League bel_pro_league`);

  // 6. International Clubs - CAF Champions League
  const cafHeader = detectCompetitionHeader('International Clubs - CAF Champions League');
  assert(cafHeader?.country === 'International Clubs', `CAF Champions League country is International Clubs`);
  const cafParsed = parseSingleFixtureLine('4005 24-10-2026 - 21:00 Al Ahly Esperance 1.70 3.40 4.80', cafHeader!.country, cafHeader!.league);
  assert(cafParsed?.country === 'International Clubs', `CAF fixture country is International Clubs`);
  assert(cafParsed?.competition === 'CAF Champions League', `CAF fixture competition is CAF Champions League`);
  assert(cafParsed?.competitionId === 'caf_champions_league', `CAF fixture resolves to caf_champions_league`);

  // 7. Same league name in different countries (Premier League)
  const maltaHeader = detectCompetitionHeader('Malta - Premier League, Opening Round');
  const maltaParsed = parseSingleFixtureLine('4006 24-10-2026 - 19:00 Birkirkara Floriana 2.80 3.20 2.22', maltaHeader!.country, maltaHeader!.league);
  assert(maltaParsed?.country === 'Malta', `Malta Premier League country is Malta`);
  assert(maltaParsed?.competition === 'Premier League, Opening Round', `Malta Premier League preserves Opening Round`);
  assert(maltaParsed?.competitionId !== 'eng_premier_league', `Malta Premier League is NOT hijacked to English Premier League`);

  const bahrainHeader = detectCompetitionHeader('Bahrain - Premier League');
  const bahrainParsed = parseSingleFixtureLine('4007 24-10-2026 - 19:00 Sitra Riffa 5.40 3.60 1.53', bahrainHeader!.country, bahrainHeader!.league);
  assert(bahrainParsed?.country === 'Bahrain', `Bahrain Premier League country is Bahrain`);
  assert(bahrainParsed?.competitionId !== 'eng_premier_league', `Bahrain Premier League is NOT hijacked to English Premier League`);

  // 8. International Women's Competitions
  const copaW = parseResult.fixtures.find(f => f.matchId === '1641');
  assert(copaW?.country === 'International Clubs', `Libertad Limpeño match country is International Clubs`);
  assert(copaW?.competition.includes('Women') === true, `Copa Libertadores Women preserves Women qualifier`);
  assert(copaW?.competition.includes('Group D') === true, `Copa Libertadores Women preserves Group D qualifier`);

  // -------------------------------------------------------------------------
  // SUITE 4: MISSING BETTING ODDS RESILIENCE (REQ 4)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: Optional Odds Handling ---');
  // Fixture with NO odds (schedule only) must NOT be dropped!
  const noOddsRowTab = '9901\t24-10-2026 - 15:00\tArsenal\tChelsea';
  const noOddsParsedTab = parseSingleFixtureLine(noOddsRowTab, 'England', 'Premier League');
  assert(!!noOddsParsedTab, 'Tab fixture without any odds parses successfully');
  assert(noOddsParsedTab?.matchId === '9901', 'Match ID 9901 extracted from row without odds');
  assert(noOddsParsedTab?.homeTeam === 'Arsenal' && noOddsParsedTab?.awayTeam === 'Chelsea', 'Teams extracted without odds');
  assert(noOddsParsedTab?.odds === undefined, 'Odds are undefined when missing');

  const noOddsRowText = '9902 24-10-2026 - 17:30 Liverpool Manchester United';
  const noOddsParsedText = parseSingleFixtureLine(noOddsRowText, 'England', 'Premier League');
  assert(!!noOddsParsedText, 'Space-delimited fixture without any odds parses successfully');
  assert(noOddsParsedText?.matchId === '9902', 'Match ID 9902 extracted from space-delimited text without odds');
  assert(noOddsParsedText?.homeTeam === 'Liverpool' && noOddsParsedText?.awayTeam === 'Manchester United', 'Teams extracted correctly');

  // Verify parseFixturesText handles fixtures without odds and creates MarketFixture
  const slateWithMissingOdds = `
England - Premier League
9901 24-10-2026 - 15:00 Arsenal Chelsea
9902 24-10-2026 - 17:30 Liverpool Manchester United
9903 24-10-2026 - 20:00 Man City Tottenham 1.50 4.20 6.00
`;
  const missingOddsSlateResult = parseFixturesText(slateWithMissingOdds);
  assert(missingOddsSlateResult.fixtures.length === 3, `All 3 fixtures parsed including rows without odds (found ${missingOddsSlateResult.fixtures.length})`);
  assert(missingOddsSlateResult.marketFixtures.length === 3, `MarketFixtures created for all 3 matches`);
  assert(missingOddsSlateResult.marketFixtures[0].homeOdds === 2.50, `Default consensus odds provided for unquoted match`);

  // -------------------------------------------------------------------------
  // SUITE 5: NON-FIXTURE CONTENT POSITIVE EXCLUSION (REQ 5)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 5: Non-Fixture Content Exclusion ---');
  const nonFixtureSamples = [
    'Sports Betting Homepage > Upcoming Games Thursday, October, 22th, 2026',
    'SportPesa',
    'ke.sportpesa.com',
    'ke.sportpesa.com Page 1 of 4',
    'Page 2 of 4',
    '3 WAY DOUBLE CHANCE OVER/UNDER 2.50',
    'ID\tDATE\tTEAM 1\tTEAM 2\tSCORE',
    'Home\tDraw\tAway\t1 or X\tX or 2\t1 or 2\tOver\tUnder\tYes\tNo',
    'Paybill 955100 / 955700',
    'Need help? Contact us Gambling may have adverse effects if not taken in moderation.',
    'SPORTPESA LEGAL AND COMPLIANCE LICENCE',
    'is duly licensed by GRA under License Number GRAK/2026/PG056841.',
    'Casino products are provided by Standard Global East Africa Limited which',
    'mailto:care@ke.sportpesa.com',
    'https://www.facebook.com/SportPesaOfficial',
    'https://twitter.com/sportpesa',
    'https://traffic.sussdigital.com/AEUBZA',
    'https://www.tiktok.com/@sportpesa',
  ];

  for (const sample of nonFixtureSamples) {
    assert(isNonFixtureLine(sample), `Identified as non-fixture: "${sample.slice(0, 40)}..."`);
    const parsed = parseSingleFixtureLine(sample, 'General', 'Top League');
    assert(parsed === null, `Positive fixture validation rejected non-fixture: "${sample.slice(0, 40)}..."`);
  }

  // -------------------------------------------------------------------------
  // SUITE 6: IDEMPOTENT IMPORTS & DUPLICATE ACCUMULATION (REQ 6)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 6: Idempotent Ingestion & Deduplication ---');
  clearAllFixtures();
  assert(getSavedAdminFixtures().length === 0, 'Cleaned test fixtures slate');

  // Ingest real PDF matches first time
  const batch1 = ingestAdminFixtures(parseResult.marketFixtures, { fileName: 'official-fixtures-run1.pdf' });
  assert(batch1.totalCount === 100, `First ingestion has totalCount = 100 (actual: ${batch1.totalCount})`);
  assert(batch1.addedCount === 100, `First ingestion addedCount = 100 (actual: ${batch1.addedCount})`);

  // Ingest identical matches second time (should be completely idempotent!)
  const batch2 = ingestAdminFixtures(parseResult.marketFixtures, { fileName: 'official-fixtures-run2.pdf' });
  assert(batch2.totalCount === 100, `Idempotent second ingestion keeps totalCount = 100 without duplicates (actual: ${batch2.totalCount})`);
  assert(batch2.addedCount === 0, `Second ingestion addedCount = 0 (actual: ${batch2.addedCount})`);

  // Test client appendUploadedFreeMatches idempotency
  const clientMatches = parseResult.marketFixtures.map(m => ({
    id: m.id,
    matchId: m.matchId,
    home: m.home,
    away: m.away,
    competition: m.competition,
    country: m.country,
    kickoff: m.kickoff,
    kickoffIso: m.kickoffIso,
    tier: 'blockbuster' as const,
    blurb: '',
    syncedAt: m.syncedAt,
  }));
  const clientRes1 = appendUploadedFreeMatches(clientMatches);
  const clientRes2 = appendUploadedFreeMatches(clientMatches);
  assert(clientRes2.addedCount === 0, `Client appendUploadedFreeMatches is idempotent with 0 added duplicates`);

  // -------------------------------------------------------------------------
  // SUITE 7: LARGE BATCH SCALING (>100 FIXTURES WITHOUT ARBITRARY CAP) (REQ 1)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST SUITE 7: Large Batch Scaling (>100 Fixtures without Caps) ---');
  clearAllFixtures();

  // Generate 150 synthetic fixtures across 6 pages
  const syntheticPages: string[] = [];
  let currentMid = 6000;
  for (let page = 1; page <= 6; page++) {
    const pageLines = [
      `Sports Betting Homepage > Upcoming Games`,
      `ke.sportpesa.com Page ${page} of 6`,
      `Country${page} - League Tier ${page}`,
    ];
    for (let m = 1; m <= 25; m++) {
      currentMid++;
      pageLines.push(`${currentMid}\t25-10-2026 - 15:00\tHomeTeam_${currentMid}\tAwayTeam_${currentMid}\t2.10\t3.20\t3.30\t1.28\t1.65\t1.30\t4.50\t1.18\t1.70\t2.00`);
    }
    pageLines.push(`ke.sportpesa.com Page ${page} of 6`);
    syntheticPages.push(pageLines.join('\n'));
  }
  const largeBatchText = syntheticPages.join('\n--- PAGE BREAK ---\n');

  const largeResult = parseFixturesText(largeBatchText);
  assert(largeResult.fixtures.length === 150, `Parsed all 150 fixtures in multi-page batch without truncation (found ${largeResult.fixtures.length})`);
  assert(largeResult.stats.totalPages === 6, `Processed all 6 pages (found ${largeResult.stats.totalPages})`);
  assert(largeResult.stats.acceptedCount === 150, `Accepted all 150 fixtures (accepted: ${largeResult.stats.acceptedCount})`);
  assert(Object.keys(largeResult.sectoredLeagues).length === 6, `Identified all 6 distinct sectored leagues`);

  // Ingest into storage without cap
  const largeIngest = ingestAdminFixtures(largeResult.marketFixtures, { fileName: 'large-batch-150.pdf' });
  assert(largeIngest.totalCount === 150, `Ingested all 150 fixtures into storage with no 100-match limit (totalCount: ${largeIngest.totalCount})`);

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! ZERO ERRORS.`);
  console.log('================================================================\n');
}

runTestSuite().catch(err => {
  console.error('\nTEST SUITE FAILED WITH ERROR:', err);
  process.exit(1);
});
