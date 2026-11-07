/**
 * One-Time / On-Demand Server-Side Snapshot Re-Sync & Corruption Repair Task
 *
 * Re-syncs and overwrites already-corrupted documents in Firestore `fixtureSnapshots`
 * (or local disk snapshot fallback) for recent matchdays using the fixed per-competition
 * (`fetchSportScoreFixturesByCompetition`, concurrency 3) + authoritative widget detail
 * (`fetchAuthoritativeSportScoreMatchDetail`, concurrency 4) fetch paths.
 *
 * Usage:
 *   npx tsx scripts/resync-corrupted-snapshots.ts --dry-run
 *   npx tsx scripts/resync-corrupted-snapshots.ts --days=3
 *   npx tsx scripts/resync-corrupted-snapshots.ts --dates=2026-11-06,2026-11-07
 */

import 'dotenv/config';
import {
  fetchSportScoreFixturesByCompetition,
  fetchAuthoritativeSportScoreMatchDetail,
  normalizeSportScoreMatch,
  resolveFixtureCompetitionSlug,
  getLocalDateStringEAT,
  type MarketFixture,
} from '../src/lib/sportsFeedService.js';
import {
  loadFixtureSnapshot,
  saveFixtureSnapshotWithStats,
  isSnapshotStoreConfigured,
} from '../src/lib/fixtureSnapshotStore.js';
import { findMatchingExistingFixture } from '../src/lib/fixtureIdentity.js';
import { resolveCanonicalCompetition, getPriorityProviderSlugs } from '../src/lib/canonicalCompetitions.js';

interface CliOptions {
  days: number;
  dates: string[] | null;
  dryRun: boolean;
}

function parseCliArgs(argv: string[]): CliOptions {
  let days = 3;
  let dates: string[] | null = null;
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '-n') {
      dryRun = true;
    } else if (arg.startsWith('--days=')) {
      const parsed = Number(arg.slice('--days='.length));
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 14) {
        days = Math.floor(parsed);
      }
    } else if (arg.startsWith('--dates=')) {
      const list = arg
        .slice('--dates='.length)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
      if (list.length > 0) {
        dates = Array.from(new Set(list)).sort();
      }
    }
  }

  return { days, dates, dryRun };
}

function computeRecentEatDates(days: number, nowMs: number = Date.now()): string[] {
  const result: string[] = [];
  for (let offset = -(days - 1); offset <= 0; offset++) {
    const dStr = getLocalDateStringEAT(new Date(nowMs + offset * 86_400_000));
    if (dStr && !result.includes(dStr)) {
      result.push(dStr);
    }
  }
  return result.sort();
}

function reclassifyFixtureCompetition(f: MarketFixture): MarketFixture {
  const canon = resolveCanonicalCompetition({
    competition: f.competition,
    country: f.country,
    leagueCode: f.leagueCode,
    providerId: f.providerId || f.id,
    home: f.home,
    away: f.away,
  });
  return {
    ...f,
    competitionId: canon.id,
    competition: canon.name,
  };
}

async function runResync(): Promise<void> {
  const opts = parseCliArgs(process.argv.slice(2));
  const targetDates = opts.dates ?? computeRecentEatDates(opts.days);
  const targetDateSet = new Set(targetDates);

  console.log('========================================================================');
  console.log('MSHINDIROOM — FIRESTORE FIXTURE SNAPSHOT RE-SYNC & CORRUPTION REPAIR');
  console.log('========================================================================');
  console.log(`Mode             : ${opts.dryRun ? 'DRY-RUN (no writes)' : 'LIVE WRITE'}`);
  console.log(`Storage Backend  : ${isSnapshotStoreConfigured() ? 'Cloud Firestore (fixtureSnapshots)' : 'Local Disk Fallback'}`);
  console.log(`Target Matchdays : ${targetDates.join(', ')}`);

  // 1. Load existing snapshot records
  const { fixtures: existingAll, updatedAt: prevUpdatedAt } = await loadFixtureSnapshot();
  const existingInScope = existingAll.filter((f) => {
    const eatDay = f.kickoffIso ? getLocalDateStringEAT(f.kickoffIso) : '';
    const utcDay = f.kickoffIso ? f.kickoffIso.slice(0, 10) : '';
    return targetDateSet.has(eatDay) || targetDateSet.has(utcDay);
  });

  console.log(
    `Loaded Snapshot  : ${existingAll.length} total fixtures (${existingInScope.length} in target matchdays, last updated: ${prevUpdatedAt || 'n/a'})\n`
  );

  // 2. Build (competitionSlug, date) pairs from priority slugs + all competitions present in target matchdays
  const compDatePairs = new Map<string, { compSlug: string; dateStr: string }>();
  const prioritySlugs = getPriorityProviderSlugs();

  for (const d of targetDates) {
    for (const slug of prioritySlugs) {
      compDatePairs.set(`${slug}__${d}`, { compSlug: slug, dateStr: d });
    }
  }

  for (const ef of existingInScope) {
    const slug = resolveFixtureCompetitionSlug(ef);
    if (!slug) continue;
    const utcDay = ef.kickoffIso ? ef.kickoffIso.slice(0, 10) : '';
    const eatDay = ef.kickoffIso ? getLocalDateStringEAT(ef.kickoffIso) : '';
    for (const d of [utcDay, eatDay]) {
      if (d && targetDateSet.has(d)) {
        compDatePairs.set(`${slug}__${d}`, { compSlug: slug, dateStr: d });
      }
    }
  }

  const pairList = Array.from(compDatePairs.values());
  console.log(`[Step 1/3] Polling ${pairList.length} (competition, date) pairs (concurrency capped at 3)...`);

  const authoritativeMap = new Map<string, MarketFixture>();
  const COMP_CONCURRENCY = 3;
  for (let i = 0; i < pairList.length; i += COMP_CONCURRENCY) {
    const batch = pairList.slice(i, i + COMP_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(({ compSlug, dateStr }) => fetchSportScoreFixturesByCompetition(compSlug, dateStr))
    );
    for (const res of settled) {
      if (res.status === 'fulfilled') {
        for (const item of res.value) {
          const reclassified = reclassifyFixtureCompetition({
            ...item,
            isAuthoritativeCorrection: true,
            observedAtMs: Date.now(),
          });
          authoritativeMap.set(reclassified.id, reclassified);
        }
      }
    }
  }
  console.log(`           Retrieved ${authoritativeMap.size} fixtures via per-competition endpoints.`);

  // 3. Authoritative widget cross-check for every existing past-kickoff / live / finished / awaiting fixture
  const nowMs = Date.now();
  const detailCandidates = existingInScope.filter((f) => {
    const kMs = f.kickoffIso ? new Date(f.kickoffIso).getTime() : NaN;
    const hasKickedOff = Number.isFinite(kMs) && kMs <= nowMs;
    return (
      hasKickedOff ||
      f.status === 'in' ||
      f.status === 'post' ||
      f.status === 'awaiting_confirmation' ||
      f.status === 'suspended'
    );
  });

  console.log(`[Step 2/3] Cross-checking ${detailCandidates.length} fixtures against authoritative widget detail (concurrency 4)...`);
  const DETAIL_CONCURRENCY = 4;
  let widgetConfirmedCount = 0;

  for (let i = 0; i < detailCandidates.length; i += DETAIL_CONCURRENCY) {
    const batch = detailCandidates.slice(i, i + DETAIL_CONCURRENCY);
    await Promise.allSettled(
      batch.map(async (candidate) => {
        const detail = await fetchAuthoritativeSportScoreMatchDetail(candidate, { ingestIntoStore: false });
        if (!detail) return;
        widgetConfirmedCount++;
        const nowIso = new Date().toISOString();
        const normalizedFromWidget = reclassifyFixtureCompetition({
          ...normalizeSportScoreMatch(
            {
              id: detail.id,
              home: detail.home,
              away: detail.away,
              home_logo: detail.home_logo || candidate.homeLogo,
              away_logo: detail.away_logo || candidate.awayLogo,
              home_score: detail.home_score,
              away_score: detail.away_score,
              home_ht_score: detail.home_ht_score,
              away_ht_score: detail.away_ht_score,
              status: detail.status,
              status_text: detail.status_text,
              live_minute: detail.live_minute,
              time: detail.kickoff_iso || candidate.kickoffIso,
              competition: detail.competition || candidate.competition,
              country: candidate.country,
              url: detail.url || candidate.matchUrl,
              incidents: detail.match?.incidents,
            },
            nowIso,
            detail.normalized_status === 'in',
            true
          ),
          id: candidate.id,
          observedAtMs: Date.now(),
          isAuthoritativeCorrection: true,
        });
        authoritativeMap.set(candidate.id, normalizedFromWidget);
      })
    );
  }
  console.log(`           Confirmed ${widgetConfirmedCount}/${detailCandidates.length} fixtures via widget match-detail.`);

  // 4. Also reclassify any existing in-scope fixture not returned upstream (e.g. competition metadata fix)
  for (const existing of existingInScope) {
    const matched = findMatchingExistingFixture(existing, authoritativeMap.values());
    if (!matched) {
      const reclassified = reclassifyFixtureCompetition(existing);
      if (
        reclassified.competitionId !== existing.competitionId ||
        reclassified.competition !== existing.competition
      ) {
        authoritativeMap.set(existing.id, {
          ...reclassified,
          isAuthoritativeCorrection: true,
          observedAtMs: Date.now(),
        });
      }
    }
  }

  // 5. Audit & report every repaired discrepancy
  const authoritativeList = Array.from(authoritativeMap.values());
  const discrepancies: string[] = [];

  for (const incoming of authoritativeList) {
    const prev = findMatchingExistingFixture(incoming, existingInScope);
    if (!prev) continue;

    const prevScore = `${prev.homeScore ?? '-'} - ${prev.awayScore ?? '-'}`;
    const nextScore = `${incoming.homeScore ?? '-'} - ${incoming.awayScore ?? '-'}`;
    const prevState = `${prev.status}/${prev.displayClock || prev.period || ''}`;
    const nextState = `${incoming.status}/${incoming.displayClock || incoming.period || ''}`;

    const scoreDiff = prev.homeScore !== incoming.homeScore || prev.awayScore !== incoming.awayScore;
    const statusDiff = prev.status !== incoming.status || prev.period !== incoming.period;
    const compDiff = prev.competitionId !== incoming.competitionId || prev.competition !== incoming.competition;

    if (scoreDiff || statusDiff || compDiff) {
      discrepancies.push(
        `  * ${prev.home} vs ${prev.away} [${getLocalDateStringEAT(prev.kickoffIso)}]: ` +
          `score (${prevScore} -> ${nextScore}), state (${prevState} -> ${nextState}), ` +
          `comp (${prev.competition} -> ${incoming.competition})`
      );
    }
  }

  console.log(`\n[Step 3/3] Discrepancies repaired (${discrepancies.length}):`);
  if (discrepancies.length === 0) {
    console.log('  (No corrupted score, status, or competition records detected in target matchdays.)');
  } else {
    for (const line of discrepancies) {
      console.log(line);
    }
  }

  if (opts.dryRun) {
    console.log('\nDRY-RUN complete: skipped writing repaired records to snapshot storage.');
    return;
  }

  const stats = await saveFixtureSnapshotWithStats(authoritativeList, {
    isCompleteReconciliation: false,
    source: 'manual',
    forceAuthoritativeOverwrite: true,
  });

  console.log('\nSnapshot Re-Sync Complete:');
  console.log(`  Total Persisted : ${stats.totalPersisted}`);
  console.log(`  Updated Records : ${stats.updatedCount}`);
  console.log(`  New Records     : ${stats.newCount}`);
  console.log(`  Unchanged       : ${stats.unchangedCount}`);
  console.log(`  Dates Written   : ${stats.datesWritten.join(', ') || 'none'}`);
}

runResync()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[ResyncSnapshots] Fatal error:', err?.message || err);
    process.exit(1);
  });

