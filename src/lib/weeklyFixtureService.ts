/**
 * Automated Weekly Football Fixture Fetching & Scheduling System
 *
 * Automatically fetches football fixtures from SportScore for a complete
 * Monday-to-Monday week in East African Time (Africa/Nairobi, UTC+3).
 *
 * Features:
 * - High-volume continental competitions (Europa, Conference, UCL) fetched via dedicated calls
 * - Big 5 European leagues directly fetched to bypass the upstream 200-match daily cap
 * - Curated ~27-28 domestic matches/day distributed across kickoff time slots
 * - High-number fixtures added directly on top without duplication
 * - Schedules automatic recurring ingestion every Monday at exactly 00:00 EAT
 * - Enforces live-score protection, idempotent upserts, and zero UI disruption.
 */

import fs from 'fs';
import path from 'path';
import {
  normalizeSportScoreMatch,
  ingestFixtures,
  isSimulatedReality,
  queryMarketFixtures,
  fetchSportScoreFixturesByCompetition,
  fetchSportScoreFixturesByDate,
  type MarketFixture,
} from './sportsFeedService';
import { isCompetitionEligible } from './competitionRegistry';
import { enrichFixturesWithBet365Odds } from './sportscoreOddsService';
import { isSnapshotStoreConfigured, saveFixtureSnapshot } from './fixtureSnapshotStore';

export interface WeeklyEatWindow {
  eatStartIso: string;
  eatEndIso: string;
  eatStartFormatted: string;
  eatEndFormatted: string;
  utcDates: string[];
  startMs: number;
  endMs: number;
}

export interface WeeklyIngestionLog {
  weeklyPeriod: {
    startEat: string;
    endEat: string;
    startUtcIso: string;
    endUtcIso: string;
  };
  scheduledExecutionTime?: string;
  actualExecutionTime: string;
  durationMs: number;
  datesRequested: string[];
  datesSucceeded: string[];
  datesFailed: string[];
  totalFixturesRetrieved: number;
  eligibleFixturesCount: number;
  newFixturesInserted: number;
  existingFixturesUpdated: number;
  duplicatesPrevented: number;
  status: 'completed' | 'partial' | 'failed' | 'in_progress';
  lastSuccessfulExecution?: string;
  errorLogs: string[];
}

const CACHE_DIR = path.join(process.cwd(), '.cache');
const LOG_FILE = path.join(CACHE_DIR, 'weekly_ingestion_log.json');

// Concurrency mutex
let isWeeklyIngestionRunning = false;
let nextScheduledRunTime: string | null = null;
let scheduledTimerRef: NodeJS.Timeout | null = null;
let latestIngestionLog: WeeklyIngestionLog | null = loadLatestLog();

function loadLatestLog(): WeeklyIngestionLog | null {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const raw = fs.readFileSync(LOG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[WeeklyScheduler] Could not read log file:', err);
  }
  return null;
}

function saveLatestLog(log: WeeklyIngestionLog): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), 'utf-8');
    latestIngestionLog = log;
  } catch (err) {
    console.warn('[WeeklyScheduler] Could not write log file:', err);
  }
}

/**
 * Helper to get date components specifically in Africa/Nairobi timezone (UTC+3)
 */
export function getEatDateParts(d: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    weekday: 'short',
    hour12: false,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour: parseInt(map.hour, 10),
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    weekday: map.weekday,
  };
}

/**
 * Creates a UTC Date representing the given year/month/day/hour/min in Africa/Nairobi (UTC+3)
 */
export function createEatDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute, second));
}

/**
 * Calculate the weekly period in East African Time.
 * Start: Monday 12:00 AM EAT (or today 12:00 AM EAT if startFromToday is true)
 * End: Following Monday 12:00 AM EAT (exclusive)
 *
 * Spans portions of UTC calendar dates.
 */
export function calculateWeeklyEatWindow(refDate: Date = new Date(), startFromToday = false): WeeklyEatWindow {
  const eatNow = getEatDateParts(refDate);
  const dayOfWeekIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(eatNow.weekday);
  const daysFromMonday = (dayOfWeekIndex + 6) % 7; // Mon=0, Tue=1, ..., Sun=6

  const refEatMidnight = createEatDate(eatNow.year, eatNow.month, eatNow.day, 0, 0, 0);
  const mondayEat = startFromToday
    ? refEatMidnight
    : new Date(refEatMidnight.getTime() - daysFromMonday * 86_400_000);

  // Next Monday at 00:00:00 EAT
  const fullWeekMonday = new Date(refEatMidnight.getTime() - daysFromMonday * 86_400_000);
  const nextMondayEat = new Date(fullWeekMonday.getTime() + 7 * 86_400_000);

  // Collect the UTC calendar dates spanning this EAT weekly period
  const utcDates: string[] = [];
  let curUtc = new Date(Date.UTC(mondayEat.getUTCFullYear(), mondayEat.getUTCMonth(), mondayEat.getUTCDate()));
  const endUtcDate = new Date(Date.UTC(nextMondayEat.getUTCFullYear(), nextMondayEat.getUTCMonth(), nextMondayEat.getUTCDate()));

  while (curUtc.getTime() <= endUtcDate.getTime()) {
    const yyyy = curUtc.getUTCFullYear();
    const mm = String(curUtc.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(curUtc.getUTCDate()).padStart(2, '0');
    utcDates.push(`${yyyy}-${mm}-${dd}`);
    curUtc = new Date(curUtc.getTime() + 86_400_000);
  }

  const eatFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  return {
    eatStartIso: mondayEat.toISOString(),
    eatEndIso: nextMondayEat.toISOString(),
    eatStartFormatted: eatFormatter.format(mondayEat),
    eatEndFormatted: eatFormatter.format(nextMondayEat),
    utcDates,
    startMs: mondayEat.getTime(),
    endMs: nextMondayEat.getTime(),
  };
}

/**
 * Sleep helper for rate-limiting
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * High-volume continental competitions.
 * Fetched via dedicated endpoint calls and merged in full on top of daily fixtures.
 */
export const HIGH_VOLUME_CONTINENTAL_SLUGS = [
  'uefa-champions-league',
  'uefa-europa-league',
  'uefa-europa-conference-league',
];

/**
 * Big 5 European Domestic Leagues (1st Division).
 * Guaranteed to be fetched directly so the daily 200 cap never truncates them.
 */
export const MAJOR_DOMESTIC_SLUGS = [
  'english-premier-league',
  'spanish-la-liga',
  'bundesliga',
  'italian-serie-a',
  'french-ligue-1',
];

/**
 * Secondary Priority Whitelisted Competitions.
 * Key 2nd divisions and popular domestic leagues for daily variety.
 */
export const SECONDARY_PRIORITY_SLUGS = [
  'english-football-league-championship',
  'spanish-segunda-division',
  'german-bundesliga-2',
  'italian-serie-b',
  'french-ligue-2',
  'portuguese-primera-liga',
  'netherlands-eredivisie',
  'belgian-pro-league',
  'turkish-super-league',
  'scottish-premiership',
  'brazilian-serie-a',
  'saudi-professional-league',
];

/**
 * Concurrency-controlled batch fetching of competition fixtures for a given date
 */
async function fetchCompetitionsBatch(
  slugs: string[],
  date: string,
  concurrency = 6
): Promise<MarketFixture[]> {
  const all: MarketFixture[] = [];
  for (let i = 0; i < slugs.length; i += concurrency) {
    const batch = slugs.slice(i, i + concurrency);
    const results = await Promise.allSettled(
      batch.map((slug) => fetchSportScoreFixturesByCompetition(slug, date))
    );
    for (const res of results) {
      if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length > 0) {
        all.push(...res.value);
      }
    }
  }
  return all;
}

/**
 * Selects ~27-28 domestic/highlight league fixtures distributed across kickoff time slots,
 * and adds high-volume continental fixtures (Europa, Conference, UCL) directly on top without duplication.
 */
export function curateDailyFixtures(
  continentalFixtures: MarketFixture[],
  majorDomesticFixtures: MarketFixture[],
  secondaryFixtures: MarketFixture[],
  broadDailyFixtures: MarketFixture[],
  targetDomesticCount = 28
): MarketFixture[] {
  const continentalMap = new Map<string, MarketFixture>();
  for (const f of continentalFixtures) {
    const key = f.id || `${f.home.toLowerCase()}__${f.away.toLowerCase()}__${(f.kickoffIso || '').slice(0, 10)}`;
    continentalMap.set(key, f);
  }

  const domesticMap = new Map<string, MarketFixture>();
  for (const f of majorDomesticFixtures) {
    const key = f.id || `${f.home.toLowerCase()}__${f.away.toLowerCase()}__${(f.kickoffIso || '').slice(0, 10)}`;
    if (!continentalMap.has(key)) domesticMap.set(key, f);
  }
  for (const f of secondaryFixtures) {
    const key = f.id || `${f.home.toLowerCase()}__${f.away.toLowerCase()}__${(f.kickoffIso || '').slice(0, 10)}`;
    if (!continentalMap.has(key) && !domesticMap.has(key)) domesticMap.set(key, f);
  }
  for (const f of broadDailyFixtures) {
    const key = f.id || `${f.home.toLowerCase()}__${f.away.toLowerCase()}__${(f.kickoffIso || '').slice(0, 10)}`;
    if (!continentalMap.has(key) && !domesticMap.has(key)) domesticMap.set(key, f);
  }

  const majorKeys = new Set(
    majorDomesticFixtures.map((f) => f.id || `${f.home.toLowerCase()}__${f.away.toLowerCase()}__${(f.kickoffIso || '').slice(0, 10)}`)
  );
  const domesticList = Array.from(domesticMap.values());

  let selectedDomestic: MarketFixture[] = [];
  if (domesticList.length <= targetDomesticCount) {
    selectedDomestic = domesticList;
  } else {
    // Preserve 100% of Big 5 European major fixtures
    const mandatoryMajors = domesticList.filter((f) => majorKeys.has(f.id));
    const otherDomestic = domesticList.filter((f) => !majorKeys.has(f.id));

    // Sort other domestic by kickoff time to distribute evenly across the day
    otherDomestic.sort((a, b) => {
      const tA = a.kickoffIso ? new Date(a.kickoffIso).getTime() : 0;
      const tB = b.kickoffIso ? new Date(b.kickoffIso).getTime() : 0;
      return tA - tB;
    });

    const slotsRemaining = Math.max(0, targetDomesticCount - mandatoryMajors.length);
    const step = otherDomestic.length > slotsRemaining ? otherDomestic.length / slotsRemaining : 1;
    const additional: MarketFixture[] = [];
    for (let i = 0; i < slotsRemaining && otherDomestic.length > 0; i++) {
      const idx = Math.min(Math.floor(i * step), otherDomestic.length - 1);
      additional.push(otherDomestic[idx]);
    }

    selectedDomestic = [...mandatoryMajors, ...additional];
  }

  // High-volume continental fixtures (Europa, Conference, UCL) added directly on top without duplication
  return [...selectedDomestic, ...Array.from(continentalMap.values())];
}

/**
 * Execute a complete weekly fixture ingestion cycle
 */
export async function executeWeeklyIngestion(options?: {
  refDate?: Date;
  force?: boolean;
  startFromToday?: boolean;
  targetDomesticCount?: number;
}): Promise<WeeklyIngestionLog> {
  if (isWeeklyIngestionRunning) {
    throw new Error('Weekly fixture ingestion is already in progress.');
  }

  isWeeklyIngestionRunning = true;
  const startTime = Date.now();
  const startFromToday = options?.startFromToday ?? false;
  const targetDomesticCount = options?.targetDomesticCount ?? 28;
  const windowInfo = calculateWeeklyEatWindow(options?.refDate || new Date(), startFromToday);
  const nowIso = new Date().toISOString();

  const datesRequested = windowInfo.utcDates;
  const datesSucceeded: string[] = [];
  const datesFailed: string[] = [];
  const errorLogs: string[] = [];

  const log: WeeklyIngestionLog = {
    weeklyPeriod: {
      startEat: windowInfo.eatStartFormatted,
      endEat: windowInfo.eatEndFormatted,
      startUtcIso: windowInfo.eatStartIso,
      endUtcIso: windowInfo.eatEndIso,
    },
    scheduledExecutionTime: nowIso,
    actualExecutionTime: nowIso,
    durationMs: 0,
    datesRequested,
    datesSucceeded,
    datesFailed,
    totalFixturesRetrieved: 0,
    eligibleFixturesCount: 0,
    newFixturesInserted: 0,
    existingFixturesUpdated: 0,
    duplicatesPrevented: 0,
    status: 'in_progress',
    errorLogs,
  };

  saveLatestLog(log);
  console.log(`[WeeklyIngestion] Starting weekly ingestion for period: ${windowInfo.eatStartFormatted} -> ${windowInfo.eatEndFormatted}`);
  console.log(`[WeeklyIngestion] Spanning UTC dates: ${datesRequested.join(', ')}`);

  const allEligibleFixtures: MarketFixture[] = [];
  const seenMatchKeys = new Set<string>();

  try {
    for (const utcDate of datesRequested) {
      console.log(`[WeeklyIngestion] Processing SportScore fixtures for UTC date: ${utcDate}...`);
      try {
        // 1. Dedicated fetch for high-volume continental cups (Europa, Conference, UCL)
        const continentalMatches = await fetchCompetitionsBatch(HIGH_VOLUME_CONTINENTAL_SLUGS, utcDate, 3);

        // 2. Dedicated fetch for Big 5 major European domestic leagues
        const majorDomesticMatches = await fetchCompetitionsBatch(MAJOR_DOMESTIC_SLUGS, utcDate, 5);

        // 3. Dedicated fetch for secondary priority leagues
        const secondaryMatches = await fetchCompetitionsBatch(SECONDARY_PRIORITY_SLUGS, utcDate, 6);

        // 4. Broad daily feed for remaining eligible top flights and domestic cups
        const dailyBroadMatches = await fetchSportScoreFixturesByDate(utcDate);

        // 5. Curate day's fixtures: ~27-28 domestic matches across kickoff time slots,
        // and add high-volume continental matches directly on top without duplication
        const curatedDayMatches = curateDailyFixtures(
          continentalMatches,
          majorDomesticMatches,
          secondaryMatches,
          dailyBroadMatches,
          targetDomesticCount
        );

        datesSucceeded.push(utcDate);
        log.totalFixturesRetrieved += (continentalMatches.length + majorDomesticMatches.length + secondaryMatches.length + dailyBroadMatches.length);

        for (const f of curatedDayMatches) {
          const isoTime = f.kickoffIso || nowIso;
          const matchTimeMs = new Date(isoTime).getTime();

          // Interval check against intended weekly window
          if (Number.isNaN(matchTimeMs) || matchTimeMs < windowInfo.startMs || matchTimeMs >= windowInfo.endMs) {
            continue;
          }

          const dedupeKey = f.id || `${f.home.toLowerCase()}__${f.away.toLowerCase()}__${(f.kickoffIso || '').slice(0, 10)}`;
          if (seenMatchKeys.has(dedupeKey)) {
            log.duplicatesPrevented++;
            continue;
          }
          seenMatchKeys.add(dedupeKey);
          allEligibleFixtures.push(f);
        }
      } catch (dateErr: any) {
        datesFailed.push(utcDate);
        errorLogs.push(`Date ${utcDate} error: ${dateErr?.message || dateErr}`);
        console.warn(`[WeeklyIngestion] Error on date ${utcDate}:`, dateErr);
      }

      // Respectful spacing between date batches
      await delay(250);
    }

    log.eligibleFixturesCount = allEligibleFixtures.length;

    // Snapshot existing fixtures before ingestion to compute inserted vs updated counts
    const existingSnap = queryMarketFixtures({ scope: 'all' });
    const existingIdSet = new Set(existingSnap.map((f) => f.id));

    let newCount = 0;
    let updatedCount = 0;

    for (const f of allEligibleFixtures) {
      if (existingIdSet.has(f.id)) {
        updatedCount++;
      } else {
        newCount++;
      }
    }

    // Safely upsert fixtures with monotonic status progression and live score protection
    ingestFixtures(allEligibleFixtures, false);

    log.newFixturesInserted = newCount;
    log.existingFixturesUpdated = updatedCount;

    // Enrich top fixtures with real Bet365 odds
    if (allEligibleFixtures.length > 0) {
      try {
        await enrichFixturesWithBet365Odds(allEligibleFixtures, 30, 8);
      } catch (oddsErr) {
        console.warn('[WeeklyIngestion] Bet365 odds enrichment notice:', oddsErr);
      }
    }

    log.durationMs = Date.now() - startTime;
    // Persist to the shared Firestore snapshot so every serverless instance serves the same fixtures
    if (isSnapshotStoreConfigured()) {
      try {
        const keepFrom = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Nairobi',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(Date.now() - 86_400_000));
        const saved = await saveFixtureSnapshot(queryMarketFixtures({ scope: 'all' }), keepFrom);
        console.log(`[WeeklyIngestion] Persisted ${saved} fixtures to Firestore snapshot.`);
      } catch (snapErr: any) {
        log.errorLogs.push(`Snapshot persistence failed: ${snapErr?.message || snapErr}`);
        console.warn('[WeeklyIngestion] Snapshot persistence notice:', snapErr);
      }
    }
    if (datesFailed.length === 0) {
      log.status = 'completed';
      log.lastSuccessfulExecution = new Date().toISOString();
    } else if (datesSucceeded.length > 0) {
      log.status = 'partial';
      log.lastSuccessfulExecution = new Date().toISOString();
    } else {
      log.status = 'failed';
    }

    saveLatestLog(log);
    console.log(
      `[WeeklyIngestion] Finished weekly ingestion in ${(log.durationMs / 1000).toFixed(1)}s. ` +
        `Eligible: ${log.eligibleFixturesCount}, New: ${log.newFixturesInserted}, Updated: ${log.existingFixturesUpdated}, Status: ${log.status}`
    );

    return log;
  } catch (err: any) {
    log.status = 'failed';
    log.durationMs = Date.now() - startTime;
    log.errorLogs.push(`Fatal ingestion error: ${err?.message || err}`);
    saveLatestLog(log);
    console.error('[WeeklyIngestion] Fatal error during weekly ingestion:', err);
    throw err;
  } finally {
    isWeeklyIngestionRunning = false;
  }
}

/**
 * Calculates milliseconds until the next Monday at exactly 00:00:00 Africa/Nairobi time
 */
export function getMsUntilNextMondayEAT(refDate: Date = new Date()): {
  ms: number;
  targetDate: Date;
  targetDateFormatted: string;
} {
  const eatNow = getEatDateParts(refDate);
  const dayOfWeekIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(eatNow.weekday);
  const daysFromMonday = (dayOfWeekIndex + 6) % 7; // Mon=0, Tue=1, ..., Sun=6

  const refEatMidnight = createEatDate(eatNow.year, eatNow.month, eatNow.day, 0, 0, 0);

  // If today is Monday and current time is exactly 00:00:00, next Monday is in 7 days
  // Otherwise, upcoming Monday is (7 - daysFromMonday) days ahead
  let daysUntilUpcomingMonday = 7 - daysFromMonday;
  if (daysFromMonday === 0 && eatNow.hour === 0 && eatNow.minute === 0 && eatNow.second === 0) {
    daysUntilUpcomingMonday = 7;
  }

  const nextMondayMidnight = new Date(refEatMidnight.getTime() + daysUntilUpcomingMonday * 86_400_000);
  const diffMs = Math.max(1000, nextMondayMidnight.getTime() - refDate.getTime());

  const eatFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  return {
    ms: diffMs,
    targetDate: nextMondayMidnight,
    targetDateFormatted: eatFormatter.format(nextMondayMidnight),
  };
}

/**
 * Initialize the weekly Monday scheduler.
 * Runs once on application start and schedules execution for next Monday 12:00 AM EAT.
 */
export function initWeeklyFixtureScheduler(): void {
  if (scheduledTimerRef) {
    clearTimeout(scheduledTimerRef);
    scheduledTimerRef = null;
  }

  const { ms, targetDateFormatted } = getMsUntilNextMondayEAT();
  nextScheduledRunTime = targetDateFormatted;

  console.log(`[WeeklyScheduler] Initialized. Next automated weekly run scheduled for: ${targetDateFormatted} (in ${(ms / 3600000).toFixed(2)} hours)`);

  scheduledTimerRef = setTimeout(async () => {
    console.log(`[WeeklyScheduler] Triggering scheduled Monday 12:00 AM EAT weekly fixture ingestion...`);
    try {
      await executeWeeklyIngestion({ force: true });
    } catch (err) {
      console.error('[WeeklyScheduler] Error during scheduled weekly ingestion:', err);
    } finally {
      // Re-schedule for the next Monday
      initWeeklyFixtureScheduler();
    }
  }, ms);

  // On cold start / server reboot: check if the current weekly period has been ingested
  setTimeout(async () => {
    try {
      const windowInfo = calculateWeeklyEatWindow();
      const lastSuccess = latestIngestionLog?.lastSuccessfulExecution
        ? new Date(latestIngestionLog.lastSuccessfulExecution).getTime()
        : 0;

      // If never executed or last execution was before this week's Monday 00:00 EAT, catch up now
      if (!latestIngestionLog || lastSuccess < windowInfo.startMs || latestIngestionLog.status === 'failed') {
        console.log('[WeeklyScheduler] Server start check: Current weekly period fixtures not yet ingested. Triggering initial weekly ingestion...');
        await executeWeeklyIngestion();
      } else {
        console.log(`[WeeklyScheduler] Server start check: Weekly fixtures for ${windowInfo.eatStartFormatted} already ingested.`);
      }
    } catch (startErr) {
      console.warn('[WeeklyScheduler] Startup check notice:', startErr);
    }
  }, 3000);
}

/**
 * Returns current scheduler status and last execution telemetry
 */
export function getWeeklySchedulerStatus() {
  const windowInfo = calculateWeeklyEatWindow();
  const nextInfo = getMsUntilNextMondayEAT();

  return {
    schedulerActive: Boolean(scheduledTimerRef),
    nextScheduledRunTime: nextScheduledRunTime || nextInfo.targetDateFormatted,
    hoursUntilNextRun: +(nextInfo.ms / 3600000).toFixed(2),
    isIngestionRunning: isWeeklyIngestionRunning,
    currentWeeklyPeriod: {
      start: windowInfo.eatStartFormatted,
      end: windowInfo.eatEndFormatted,
      spannedUtcDates: windowInfo.utcDates,
    },
    latestIngestionLog,
  };
}
