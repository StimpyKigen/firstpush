import fs from 'fs';
import path from 'path';
import { BUNDLED_SPORTS_CATALOGUE } from '../src/data/bundledSportsCatalogue';
import { resolveCanonicalCompetition } from '../src/lib/canonicalCompetitions';
import { formatEATTime } from '../src/lib/sportsFeedService';

const BASE_URL = 'https://footballcharts-backend.onrender.com/api/v1';
const API_KEY = 'fc_9qB_ndigFOSIT-SYuIqN8MAUCUqHK05w';

async function fetchLeagueRaw(leagueCode: string) {
  try {
    const res = await fetch(`${BASE_URL}/leagues/${encodeURIComponent(leagueCode)}/fixtures/`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      signal: AbortSignal.timeout(35000),
    });
    if (!res.ok) {
      console.warn(`Failed to fetch ${leagueCode}: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.matches || data.fixtures || [];
  } catch (err: any) {
    console.warn(`Fetch error for ${leagueCode}:`, err?.message || err);
    return [];
  }
}

function normalizeRawFixture(m: any, leagueCode: string, canonId: string, canonName: string, defaultCountry: string) {
  const preds = m.model_predictions?.dc_v2?.calibrated || m.model_predictions?.dc_v2?.raw || {};
  const hProb = preds.home != null ? Math.max(0.02, Math.min(0.95, Number(preds.home))) : 0.45;
  const aProb = preds.away != null ? Math.max(0.02, Math.min(0.95, Number(preds.away))) : 0.28;
  const dProb = Math.max(0.05, 1 - hProb - aProb);

  const homePct = Math.round(hProb * 100);
  const awayPct = Math.round(aProb * 100);
  const drawPct = Math.max(5, 100 - homePct - awayPct);

  const homeOdds = +Math.max(1.05, 1.07 / Math.max(0.01, hProb)).toFixed(2);
  const drawOdds = +Math.max(1.05, 1.07 / Math.max(0.01, dProb)).toFixed(2);
  const awayOdds = +Math.max(1.05, 1.07 / Math.max(0.01, aProb)).toFixed(2);

  const homeTeam = String(m.home_team || 'Home Team').trim();
  const awayTeam = String(m.away_team || 'Away Team').trim();
  const providerId = m.slug || `${leagueCode}-${m.match_date}-${homeTeam}-vs-${awayTeam}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const uniqueId = `mkt-${providerId}`;
  const kickoffIso = m.time ? `${m.match_date}T${m.time}:00Z` : `${m.match_date}T15:00:00Z`;

  return {
    id: uniqueId,
    providerId,
    home: homeTeam,
    away: awayTeam,
    competition: canonName,
    competitionId: canonId,
    leagueCode,
    country: m.country || defaultCountry,
    kickoff: formatEATTime(m.match_date, m.time),
    kickoffIso,
    status: 'pre',
    displayClock: '',
    homeScore: null,
    awayScore: null,
    homePct,
    drawPct,
    awayPct,
    homeOdds,
    drawOdds,
    awayOdds,
    bttsYesPct: preds.btts_yes ? Math.round(preds.btts_yes * 100) : undefined,
    over15Pct: preds['over_1.5'] ? Math.round(preds['over_1.5'] * 100) : undefined,
    over25Pct: preds['over_2.5'] ? Math.round(preds['over_2.5'] * 100) : undefined,
    over35Pct: preds['over_3.5'] ? Math.round(preds['over_3.5'] * 100) : undefined,
    bookmaker: 'Market Consensus',
    syncedAt: new Date().toISOString(),
  };
}

async function main() {
  console.log('Fetching live Premier League and La Liga fixtures...');
  const [premierRaw, spainRaw] = await Promise.all([
    fetchLeagueRaw('premier'),
    fetchLeagueRaw('spain1'),
  ]);

  console.log(`Received ${premierRaw.length} Premier League fixtures, ${spainRaw.length} La Liga fixtures.`);

  const newFixtures: any[] = [];
  premierRaw.forEach((m) => {
    newFixtures.push(normalizeRawFixture(m, 'premier', 'eng_premier_league', 'English Premier League', 'England'));
  });
  spainRaw.forEach((m) => {
    newFixtures.push(normalizeRawFixture(m, 'spain1', 'esp_la_liga', 'Spanish La Liga', 'Spain'));
  });

  const existingMap = new Map<string, any>();
  newFixtures.forEach((f) => existingMap.set(f.id, f));

  // Process existing bundled catalogue
  const existingList = (BUNDLED_SPORTS_CATALOGUE.fixtures as any[]) || [];
  let correctedCount = 0;

  for (const f of existingList) {
    if (!f || !f.id) continue;
    if (existingMap.has(f.id)) continue; // Don't overwrite fresh ones

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
    correctedCount++;
  }

  const finalList = Array.from(existingMap.values());
  console.log(`Total fixtures in updated catalogue: ${finalList.length} (corrected ${correctedCount} existing records)`);

  const fileContent = `/**
 * Pre-bundled static snapshot of sports market intelligence & fixture catalogue.
 * Automatically hydrated during local sync cycles and fallback cold-starts.
 * Powers canonical competition identification and instant 0ms catalogue responses.
 */

export const BUNDLED_SPORTS_CATALOGUE = ${JSON.stringify({ ...BUNDLED_SPORTS_CATALOGUE, fixtures: finalList }, null, 2)};
`;

  const targetPath = path.join(process.cwd(), 'src/data/bundledSportsCatalogue.ts');
  fs.writeFileSync(targetPath, fileContent, 'utf-8');
  console.log(`Successfully written to ${targetPath}`);

  // Clear disk cache to ensure immediate hydration of updated fixtures
  const cachePath = path.join(process.cwd(), '.cache/sports_fixtures.json');
  if (fs.existsSync(cachePath)) {
    fs.unlinkSync(cachePath);
    console.log('Removed stale .cache/sports_fixtures.json');
  }
}

main().catch(console.error);
