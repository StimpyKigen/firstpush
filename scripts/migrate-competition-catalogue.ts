/**
 * Migration Script: Apply Verified Competition Directory Repairs
 * 
 * Safely updates `src/data/bundledSportsCatalogue.ts` with verified canonical identities.
 * Keeps an automatic rollback backup at `src/data/bundledSportsCatalogue.ts.bak`.
 * Clears runtime disk cache in `.cache/` to ensure immediate UI reflection.
 */

import fs from 'fs';
import path from 'path';
import { BUNDLED_SPORTS_CATALOGUE } from '../src/data/bundledSportsCatalogue';
import { resolveCanonicalCompetition } from '../src/lib/canonicalCompetitions';

async function migrateCatalogue() {
  console.log('========================================================================');
  console.log('       APPLYING CANONICAL COMPETITION REPAIRS TO CATALOGUE              ');
  console.log('========================================================================\n');

  const cataloguePath = path.join(process.cwd(), 'src/data/bundledSportsCatalogue.ts');
  const backupPath = path.join(process.cwd(), 'src/data/bundledSportsCatalogue.ts.bak');

  // 1. Create rollback backup
  fs.copyFileSync(cataloguePath, backupPath);
  console.log(`✅ Rollback backup created at: ${backupPath}`);

  const fixtures = (BUNDLED_SPORTS_CATALOGUE.fixtures as any[]) || [];
  let correctedCount = 0;
  let belMismatchesFixed = 0;

  const updatedFixtures = fixtures.map((f) => {
    const origCompId = f.competitionId;
    const canon = resolveCanonicalCompetition({
      competition: f.competition,
      leagueCode: f.leagueCode,
      country: f.country,
      providerId: f.providerId || f.id,
    });

    const isChanged =
      f.competitionId !== canon.id ||
      f.competition !== canon.name ||
      (f.country !== canon.countryName && f.country === 'International' && canon.countryName !== 'International');

    if (origCompId === 'bel_pro_league' && canon.id !== 'bel_pro_league') {
      belMismatchesFixed++;
    }

    if (isChanged) {
      correctedCount++;
    }

    return {
      ...f,
      competitionId: canon.id,
      competition: canon.name,
      country: canon.countryName || canon.country || f.country,
    };
  });

  // Also update leagues in the catalogue
  const leagues = (BUNDLED_SPORTS_CATALOGUE.leagues as any[]) || [];
  const updatedLeagues = leagues.map((l) => {
    const canon = resolveCanonicalCompetition({
      competition: l.name,
      leagueCode: l.league,
      country: l.country,
    });

    return {
      ...l,
      name: canon.name,
      country: canon.countryName || canon.country || l.country,
    };
  });

  const updatedCatalogue = {
    ...BUNDLED_SPORTS_CATALOGUE,
    fixtures: updatedFixtures,
    leagues: updatedLeagues,
  };

  const fileContent = `/**
 * Pre-bundled static snapshot of sports market intelligence & fixture catalogue.
 * Automatically hydrated during local sync cycles and fallback cold-starts.
 * Powers canonical competition identification and instant 0ms catalogue responses.
 */

export const BUNDLED_SPORTS_CATALOGUE = ${JSON.stringify(updatedCatalogue, null, 2)};
`;

  fs.writeFileSync(cataloguePath, fileContent, 'utf-8');
  console.log(`✅ Updated ${cataloguePath}: ${correctedCount} fixtures repaired (${belMismatchesFixed} foreign fixtures freed from Belgian Pro League)`);

  // Clear runtime disk caches
  const cacheFiles = [
    path.join(process.cwd(), '.cache/sports_fixtures.json'),
    path.join(process.cwd(), '.cache/sports_leagues.json'),
  ];

  cacheFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`🗑️ Cleared stale cache file: ${file}`);
    }
  });

  console.log('\n========================================================================');
  console.log('                     MIGRATION COMPLETED SUCCESSFULLY                   ');
  console.log('========================================================================');
}

migrateCatalogue().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
