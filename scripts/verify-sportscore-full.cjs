const fs = require('fs');

async function verifySportScoreSuite() {
  console.log('=====================================================');
  console.log('   SPORTSCORE API & FIXTURE INTEGRATION AUDIT SUITE  ');
  console.log('=====================================================\n');

  // Test 1: Live Matches
  console.log('--- 1. Testing Live Matches ---');
  try {
    const liveRes = await fetch('https://sportscore.com/api/v1/fixtures/?sport=football&status=live', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const liveData = await liveRes.json();
    console.log(`Live HTTP Status: ${liveRes.status}`);
    console.log(`Live Count: ${liveData.count || 0}`);
    if (liveData.matches && liveData.matches.length > 0) {
      const sample = liveData.matches[0];
      console.log(`Sample Live Match: ${sample.home} (${sample.home_score}) vs ${sample.away} (${sample.away_score})`);
      console.log(`Competition: ${sample.competition}`);
      console.log(`Status Text: ${sample.status_text} | Clock: ${sample.time}`);
      console.log(`Logos: Home=${sample.home_logo ? 'Yes' : 'No'}, Away=${sample.away_logo ? 'Yes' : 'No'}`);
    } else {
      console.log('No matches are live at this exact second.');
    }
  } catch (e) {
    console.error('Live matches error:', e.message);
  }

  // Test 2: Today and Rolling Future Dates
  console.log('\n--- 2. Testing Rolling Future Date Windows ---');
  const testDates = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];
  const competitionsDiscovered = new Set();
  let totalFixturesFound = 0;

  for (const d of testDates) {
    try {
      const res = await fetch(`https://sportscore.com/api/v1/fixtures/?sport=football&date=${d}&limit=100`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const data = await res.json();
      const count = data.matches ? data.matches.length : 0;
      totalFixturesFound += count;
      (data.matches || []).forEach(m => {
        if (m.competition) competitionsDiscovered.add(m.competition);
      });
      console.log(`Date: ${d} -> HTTP ${res.status} | Matches: ${count} | Sample: ${data.matches?.[0]?.home} vs ${data.matches?.[0]?.away} (${data.matches?.[0]?.competition})`);
    } catch (e) {
      console.error(`Date ${d} error:`, e.message);
    }
  }

  console.log(`\nTotal Fixtures retrieved across 5-day window: ${totalFixturesFound}`);
  console.log(`Total Unique Competitions discovered: ${competitionsDiscovered.size}`);
  console.log('Sample Competitions:', Array.from(competitionsDiscovered).slice(0, 12).join(', '));

  // Test 3: Match Details & Tracker Data
  console.log('\n--- 3. Testing Match Details & Live Tracker ---');
  try {
    const listRes = await fetch('https://sportscore.com/api/widget/matches/?sport=football&limit=3', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const listData = await listRes.json();
    const firstMatch = listData.matches?.[0];
    if (firstMatch && firstMatch.url) {
      const slug = firstMatch.url.split('/')[3];
      console.log(`Querying match detail for slug: ${slug}`);
      const detailRes = await fetch(`https://sportscore.com/api/widget/match/?sport=football&slug=${slug}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const detailData = await detailRes.json();
      console.log(`Match Detail HTTP ${detailRes.status} | Keys:`, Object.keys(detailData.match || {}));
      console.log('Has Timeline Events:', Boolean(detailData.match?.events));
      console.log('Has Lineups:', Boolean(detailData.match?.lineups));
    }
  } catch (e) {
    console.error('Match detail error:', e.message);
  }

  // Test 4: Betting Markets / Odds Audit
  console.log('\n--- 4. Testing Betting Markets & Odds Availability ---');
  try {
    const sampleRes = await fetch('https://sportscore.com/api/v1/fixtures/?sport=football&limit=10', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const sampleData = await sampleRes.json();
    const allMatches = sampleData.matches || [];
    const hasOddsFields = allMatches.some(m => m.odds || m.markets || m.bookmaker || m.probabilities);
    console.log(`Do SportScore fixtures include betting odds fields?: ${hasOddsFields ? 'YES' : 'NO'}`);
  } catch (e) {
    console.error('Betting check error:', e.message);
  }

  console.log('\n=====================================================');
  console.log('                  AUDIT COMPLETE                     ');
  console.log('=====================================================\n');
}

verifySportScoreSuite();
