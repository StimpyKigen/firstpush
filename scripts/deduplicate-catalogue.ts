import fs from 'fs';
import path from 'path';
import { BUNDLED_SPORTS_CATALOGUE } from '../src/data/bundledSportsCatalogue';
import { resolveCanonicalCompetition } from '../src/lib/canonicalCompetitions';

function run() {
  const existingList = (BUNDLED_SPORTS_CATALOGUE.fixtures as any[]) || [];
  console.log(`Starting catalogue fixture count: ${existingList.length}`);

  // Old synthetic entries to purge in favor of the official SportScore verified fixtures
  const oldSyntheticPrefixes = [
    'mkt-england/premier-league/',
    'mkt-spain/la-liga/',
  ];

  const filtered = existingList.filter((f) => {
    if (!f || !f.id) return false;
    for (const prefix of oldSyntheticPrefixes) {
      if (f.id.startsWith(prefix)) {
        console.log(`Removing synthetic duplicate: ${f.id} (${f.home} vs ${f.away})`);
        return false;
      }
    }
    return true;
  });

  // Re-canonicalize all fixtures
  for (const f of filtered) {
    const canon = resolveCanonicalCompetition({
      competition: f.competition,
      country: f.country,
      leagueCode: f.leagueCode,
      providerId: f.providerId || f.id,
    });
    f.competitionId = canon.id;
    f.competition = canon.name;
    if (canon.country && (!f.country || f.country === 'International')) {
      f.country = canon.country;
    }
  }

  const eplMatches = filtered.filter((f) => f.competitionId === 'eng_premier_league');
  const laligaMatches = filtered.filter((f) => f.competitionId === 'esp_la_liga');

  console.log(`\nCleaned Premier League: ${eplMatches.length} matches`);
  eplMatches.forEach((m) => console.log(`  - ${m.home} vs ${m.away} (${m.kickoffIso})`));

  console.log(`\nCleaned Spanish La Liga: ${laligaMatches.length} matches`);
  laligaMatches.forEach((m) => console.log(`  - ${m.home} vs ${m.away} (${m.kickoffIso})`));

  const updatedCatalogue = {
    ...BUNDLED_SPORTS_CATALOGUE,
    fixtures: filtered,
    lastUpdated: new Date().toISOString(),
  };

  const fileContent = `/**
 * Pre-bundled static snapshot of sports market intelligence & fixture catalogue.
 * Automatically hydrated during local sync cycles and fallback cold-starts.
 * Powers canonical competition identification and instant 0ms catalogue responses.
 */

export const BUNDLED_SPORTS_CATALOGUE = ${JSON.stringify(updatedCatalogue, null, 2)};
`;

  const targetPath = path.join(process.cwd(), 'src/data/bundledSportsCatalogue.ts');
  fs.writeFileSync(targetPath, fileContent, 'utf-8');
  console.log(`\nSuccessfully written deduplicated catalogue to ${targetPath}`);

  // Clear cache file
  const cachePath = path.join(process.cwd(), '.cache/sports_fixtures.json');
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    console.log('Cleared .cache/sports_fixtures.json');
  }
}

run();
