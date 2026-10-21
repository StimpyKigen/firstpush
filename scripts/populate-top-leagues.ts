import fs from 'fs';
import path from 'path';
import { BUNDLED_SPORTS_CATALOGUE } from '../src/data/bundledSportsCatalogue';
import { resolveCanonicalCompetition } from '../src/lib/canonicalCompetitions';
import { normalizeSportScoreMatch } from '../src/lib/sportsFeedService';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        return await res.json();
      }
      console.warn(`[HTTP ${res.status}] Attempt ${attempt} for ${url}`);
    } catch (err: any) {
      console.warn(`[Error] Attempt ${attempt} for ${url}: ${err?.message || err}`);
    }
    await sleep(600 * attempt);
  }
  return null;
}

async function run() {
  const priorityLeagues = [
    { slug: 'bundesliga', label: 'German Bundesliga', code: 'germany1', country: 'Germany' },
    { slug: 'italian-serie-a', label: 'Italian Serie A', code: 'italy1', country: 'Italy' },
    { slug: 'french-ligue-1', label: 'French Ligue 1', code: 'france1', country: 'France' },
    { slug: 'netherlands-eredivisie', label: 'Netherlands Eredivisie', code: 'holland1', country: 'Netherlands' },
    { slug: 'english-premier-league', label: 'English Premier League', code: 'premier', country: 'England' },
    { slug: 'spanish-la-liga', label: 'Spanish La Liga', code: 'spain1', country: 'Spain' },
    { slug: 'belgian-pro-league', label: 'Belgian Pro League', code: 'belgium1', country: 'Belgium' },
  ];

  const dates = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'];
  const nowIso = new Date().toISOString();
  const fetchedFixtures: any[] = [];

  for (const item of priorityLeagues) {
    let leagueCount = 0;
    for (const d of dates) {
      const url = `https://sportscore.com/api/v1/fixtures/?sport=football&competition=${item.slug}&date=${d}`;
      const data = await fetchWithRetry(url);
      if (data && Array.isArray(data.matches)) {
        for (const m of data.matches) {
          const normalized = normalizeSportScoreMatch(m, nowIso, false);
          // Ensure correct country and leagueCode if not populated
          if (!normalized.country || normalized.country === 'International') {
            normalized.country = item.country;
          }
          if (!normalized.leagueCode) {
            normalized.leagueCode = item.code;
          }
          fetchedFixtures.push(normalized);
          leagueCount++;
        }
      }
      await sleep(200); // Be courteous to SportScore API
    }
    console.log(`Fetched ${leagueCount} matches for ${item.label}`);
  }

  console.log(`Total new priority fixtures fetched: ${fetchedFixtures.length}`);

  // Create lookup map with existing fixtures
  const existingMap = new Map<string, any>();

  // Add new fetched fixtures first (so they take highest precedence)
  fetchedFixtures.forEach((f) => {
    existingMap.set(f.id, f);
  });

  // Keep existing catalogue fixtures that do not collide
  const existingList = (BUNDLED_SPORTS_CATALOGUE.fixtures as any[]) || [];
  let existingKept = 0;
  for (const f of existingList) {
    if (!f || !f.id) continue;
    if (!existingMap.has(f.id)) {
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
      existingMap.set(f.id, f);
      existingKept++;
    }
  }

  const finalList = Array.from(existingMap.values());
  console.log(`Final catalogue size: ${finalList.length} (New: ${fetchedFixtures.length}, Kept: ${existingKept})`);

  // Ensure leagues array has entries for all priority leagues
  const currentLeagues = [...(BUNDLED_SPORTS_CATALOGUE.leagues as any[])];
  const requiredLeagues = [
    { league: 'bundesliga', name: 'German Bundesliga', country: 'Germany', priorityTier: 'top' },
    { league: 'italian-serie-a', name: 'Italian Serie A', country: 'Italy', priorityTier: 'top' },
    { league: 'french-ligue-1', name: 'French Ligue 1', country: 'France', priorityTier: 'top' },
    { league: 'netherlands-eredivisie', name: 'Netherlands Eredivisie', country: 'Netherlands', priorityTier: 'top' },
    { league: 'english-premier-league', name: 'English Premier League', country: 'England', priorityTier: 'top' },
    { league: 'spanish-la-liga', name: 'Spanish La Liga', country: 'Spain', priorityTier: 'top' },
    { league: 'belgian-pro-league', name: 'Belgian Pro League', country: 'Belgium', priorityTier: 'top' },
  ];

  requiredLeagues.forEach((req) => {
    const idx = currentLeagues.findIndex((l) => l.league === req.league || l.name === req.name);
    if (idx === -1) {
      currentLeagues.push(req);
    } else {
      currentLeagues[idx] = { ...currentLeagues[idx], ...req };
    }
  });

  const updatedCatalogue = {
    ...BUNDLED_SPORTS_CATALOGUE,
    fixtures: finalList,
    leagues: currentLeagues,
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
  console.log(`Saved updated catalogue to ${targetPath}`);

  // Clear cache file if present
  const cachePath = path.join(process.cwd(), '.cache/sports_fixtures.json');
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    console.log('Removed stale .cache/sports_fixtures.json');
  }
}

run().catch(console.error);
