import { BUNDLED_SPORTS_CATALOGUE } from '../src/data/bundledSportsCatalogue';
import { getLeagueMetadata, buildHierarchicalDirectory } from '../src/lib/leagueDirectory';
import { isHighlightsEligible, isUpcomingEligible, sortHighlightsComparator, sortUpcomingComparator } from '../src/lib/competitionPriority';

function run() {
  const fixtures = BUNDLED_SPORTS_CATALOGUE.fixtures as any[];
  console.log(`Checking ${fixtures.length} fixtures...`);

  const topLeagues = [
    { id: 'ger_bundesliga', name: 'German Bundesliga', country: 'Germany' },
    { id: 'ita_serie_a', name: 'Italian Serie A', country: 'Italy' },
    { id: 'fra_ligue_1', name: 'French Ligue 1', country: 'France' },
    { id: 'ned_eredivisie', name: 'Dutch Eredivisie', country: 'Netherlands' },
  ];

  for (const league of topLeagues) {
    const matchesForLeague = fixtures.filter((m) => {
      const meta = getLeagueMetadata(m.competition, m.country, m.leagueCode, m.competitionId);
      return meta.canonicalId === league.id || m.competitionId === league.id;
    });

    console.log(`\n=== League: ${league.name} (${league.id}) ===`);
    console.log(`Total Matches: ${matchesForLeague.length}`);
    if (matchesForLeague.length === 0) {
      throw new Error(`Expected matches for ${league.name}, found 0!`);
    }

    const highlightsEligible = matchesForLeague.filter(isHighlightsEligible);
    console.log(`Highlights Eligible: ${highlightsEligible.length}`);

    const now = new Date('2026-10-21T12:00:00Z').getTime();
    const upcomingEligible = matchesForLeague.filter((m) => isUpcomingEligible(m, now));
    console.log(`Upcoming Eligible (from 2026-10-21): ${upcomingEligible.length}`);

    // Print sample match
    const sample = matchesForLeague[0];
    console.log(`Sample: ${sample.home} vs ${sample.away} (${sample.kickoffIso})`);
    console.log(`  Odds: 1=${sample.homeOdds}, X=${sample.drawOdds}, 2=${sample.awayOdds}`);
    console.log(`  Probs: 1=${sample.homePct}%, X=${sample.drawPct}%, 2=${sample.awayPct}%`);
  }

  // Country filtering verification
  for (const league of topLeagues) {
    const countryFilter = `country:${league.country.toLowerCase()}`;
    const targetCountry = countryFilter.replace('country:', '').toLowerCase();
    const matchesForCountry = fixtures.filter((m) => {
      const meta = getLeagueMetadata(m.competition, m.country, m.leagueCode, m.competitionId);
      const compCountry = (meta.countryName || meta.country || '').toLowerCase();
      return compCountry === targetCountry;
    });
    console.log(`Country filter "${countryFilter}": ${matchesForCountry.length} matches`);
    if (matchesForCountry.length === 0) {
      throw new Error(`Expected matches for country ${league.country}, found 0!`);
    }
  }

  console.log('\nALL VERIFICATIONS PASSED SUCCESSFULLY!');
}

run();
