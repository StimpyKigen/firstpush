import { fetchSportScoreFixturesByDate, fetchSportScoreLiveFixtures, syncSportScoreCatalog, getDailyMarketHighlights } from '../src/lib/sportsFeedService';

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  console.log(`Testing SportScore fetch for today (${today}) and tomorrow (${tomorrow})...`);

  const live = await fetchSportScoreLiveFixtures();
  console.log(`Live fixtures count: ${live.length}`);

  const todayMatches = await fetchSportScoreFixturesByDate(today);
  console.log(`Today matches count: ${todayMatches.length}`);

  const tomorrowMatches = await fetchSportScoreFixturesByDate(tomorrow);
  console.log(`Tomorrow matches count: ${tomorrowMatches.length}`);

  const syncedCount = await syncSportScoreCatalog([today, tomorrow]);
  console.log(`Synced total count into store: ${syncedCount}`);

  const highlights = await getDailyMarketHighlights();
  console.log(`getDailyMarketHighlights count: ${highlights.length}`);
}

main().catch(console.error);
