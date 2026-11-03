/**
 * Automated Weekly Football Fixture Fetching & Scheduling System
 *
 * Automatically fetches all football fixtures from SportScore for a complete
 * Monday-to-Monday week in East African Time (Africa/Nairobi, UTC+3).
 *
 * Schedules automatic recurring ingestion every Monday at exactly 00:00 EAT.
 * Enforces live-score protection, idempotent upserts, and zero UI disruption.
 */

import fs from 'fs';
import path from 'path';
import {
  normalizeSportScoreMatch,
  ingestFixtures,
  isSimulatedReality,
  queryMarketFixtures,
  type MarketFixture,
} from './sportsFeedService';
import { isCompetitionEligible } from './competitionRegistry';
import { enrichFixturesWithBet365Odds } from './sportscoreOddsService';

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
 * Start: Monday 12:00 AM EAT
 * End: Following Monday 12:00 AM EAT (exclusive)
 *
 * Spans portions of exactly eight UTC calendar dates.
 */
export function calculateWeeklyEatWindow(refDate: Date = new Date()): WeeklyEatWindow {
  const eatNow = getEatDateParts(refDate);
  const dayOfWeekIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(eatNow.weekday);
  const daysFromMonday = (dayOfWeekIndex + 6) % 7; // Mon=0, Tue=1, ..., Sun=6

  const refEatMidnight = createEatDate(eatNow.year, eatNow.month, eatNow.day, 0, 0, 0);
  const mondayEat = new Date(refEatMidnight.getTime() - daysFromMonday * 86_400_000);
  const nextMondayEat = new Date(mondayEat.getTime() + 7 * 86_400_000);

  // Collect the 8 UTC calendar dates spanning this EAT weekly period
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
 * Fetch fixtures for a single UTC date from SportScore with retry and pagination
 */
export async function fetchSportScoreDailyPage(
  date: string,
  limit = 200,
  maxRetries = 3
): Promise<{ matches: any[]; totalReportedCount?: number; error?: string }> {
  let offset = 0;
  let hasMore = true;
  const allMatches: any[] = [];
  let reportedCount: number | undefined;
  const seenFirstSignatures = new Set<string>();

  while (hasMore) {
    let attempt = 0;
    let pageSuccess = false;
    let lastError = '';

    while (attempt < maxRetries && !pageSuccess) {
      attempt++;
      try {
        const url = `https://sportscore.com/api/v1/fixtures/?sport=football&date=${encodeURIComponent(date)}&limit=${limit}&offset=${offset}`;
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 12_000) : null;

        const res = await fetch(url, {
          headers: {
            Accept: 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
          },
          signal: controller ? controller.signal : undefined,
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const rawMatches: any[] = Array.isArray(json.matches) ? json.matches : [];
          if (json.count !== undefined) {
            reportedCount = json.count;
          }

          if (rawMatches.length === 0) {
            hasMore = false;
            pageSuccess = true;
            break;
          }

          // Loop guard if provider ignores offset and repeats the first match
          const firstSig = rawMatches[0]?.url || `${rawMatches[0]?.home}-${rawMatches[0]?.away}-${rawMatches[0]?.time}`;
          if (firstSig && seenFirstSignatures.has(firstSig)) {
            hasMore = false;
            pageSuccess = true;
            break;
          }
          seenFirstSignatures.add(firstSig);

          allMatches.push(...rawMatches);
          offset += rawMatches.length;

          if (reportedCount !== undefined && offset >= reportedCount) {
            hasMore = false;
          }
          if (rawMatches.length < limit) {
            hasMore = false;
          }

          pageSuccess = true;
        } else {
          lastError = `HTTP ${res.status} from SportScore for date ${date} (offset ${offset})`;
          // Exponential backoff before retry
          await delay(1000 * Math.pow(2, attempt - 1));
        }
      } catch (err: any) {
        lastError = `Network/timeout error for date ${date}: ${err?.message || err}`;
        await delay(1000 * Math.pow(2, attempt - 1));
      }
    }

    if (!pageSuccess) {
      return { matches: allMatches, totalReportedCount: reportedCount, error: lastError };
    }

    // Rate-limit delay between pages for the same date
    if (hasMore) {
      await delay(200);
    }
  }

  return { matches: allMatches, totalReportedCount: reportedCount };
}

/**
 * Execute a complete weekly fixture ingestion cycle
 */
export async function executeWeeklyIngestion(options?: {
  refDate?: Date;
  force?: boolean;
}): Promise<WeeklyIngestionLog> {
  if (isWeeklyIngestionRunning) {
    throw new Error('Weekly fixture ingestion is already in progress.');
  }

  isWeeklyIngestionRunning = true;
  const startTime = Date.now();
  const windowInfo = calculateWeeklyEatWindow(options?.refDate || new Date());
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
  console.log(`[WeeklyIngestion] Spanning 8 UTC dates: ${datesRequested.join(', ')}`);

  const allEligibleFixtures: MarketFixture[] = [];
  const seenMatchKeys = new Set<string>();

  try {
    for (const utcDate of datesRequested) {
      console.log(`[WeeklyIngestion] Fetching SportScore daily fixtures for UTC date: ${utcDate}...`);
      const { matches, error } = await fetchSportScoreDailyPage(utcDate, 200, 3);

      if (error && matches.length === 0) {
        datesFailed.push(utcDate);
        errorLogs.push(`Date ${utcDate} failed: ${error}`);
        console.warn(`[WeeklyIngestion] ${error}`);
      } else {
        datesSucceeded.push(utcDate);
        if (error) {
          errorLogs.push(`Date ${utcDate} completed partially with warning: ${error}`);
        }
      }

      log.totalFixturesRetrieved += matches.length;

      // Filter and normalize matches within the exact intended EAT weekly window
      for (const m of matches) {
        if (!m.home || !m.away) continue;
        if (isSimulatedReality({ competition: m.competition, country: m.country, home: m.home, away: m.away })) {
          continue;
        }

        const isoTime = m.time || m.start_at || nowIso;
        const matchDate = new Date(isoTime);
        const matchTimeMs = matchDate.getTime();

        // STRICT TIMEZONE INTERVAL CHECK:
        // Must fall within Monday 00:00:00 EAT and following Monday 00:00:00 EAT (exclusive)
        if (Number.isNaN(matchTimeMs) || matchTimeMs < windowInfo.startMs || matchTimeMs >= windowInfo.endMs) {
          continue;
        }

        const normalized = normalizeSportScoreMatch(m, nowIso);

        // Filter against MshindiRoom's Centralized Competition Priority Registry (4 Tiers)
        const isEligible = isCompetitionEligible({
          id: normalized.competitionId,
          providerId: normalized.providerId,
          slug: normalized.leagueCode,
          competition: normalized.competition,
          country: normalized.country,
        });

        if (!isEligible) {
          continue;
        }

        // Deduplication signature within this weekly run
        const dedupeKey = `${normalized.home.toLowerCase()}__${normalized.away.toLowerCase()}__${(normalized.kickoffIso || '').slice(0, 10)}`;
        if (seenMatchKeys.has(dedupeKey)) {
          log.duplicatesPrevented++;
          continue;
        }
        seenMatchKeys.add(dedupeKey);

        allEligibleFixtures.push(normalized);
      }

      // Friendly spacing between daily API requests
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
    const ingestedCount = ingestFixtures(allEligibleFixtures, false);

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
 * Start the backend weekly scheduler.
 * Executes automatically every Monday at 00:00 Africa/Nairobi time.
 */
export function initWeeklyFixtureScheduler(): void {
  if (scheduledTimerRef) {
    clearTimeout(scheduledTimerRef);
  }

  const scheduleNextRun = () => {
    const { ms, targetDateFormatted } = getMsUntilNextMondayEAT();
    nextScheduledRunTime = targetDateFormatted;
    console.log(`[WeeklyScheduler] Next automated run scheduled for: ${targetDateFormatted} (in ${(ms / 3_600_000).toFixed(2)} hours)`);

    // In Node.js, setTimeout delay is capped at 2^31 - 1 (~24.8 days), 7 days is ~604.8m ms, which safely fits in signed 32-bit integer!
    scheduledTimerRef = setTimeout(async () => {
      console.log(`[WeeklyScheduler] Triggering scheduled Monday 00:00 EAT fixture ingestion...`);
      try {
        await executeWeeklyIngestion();
      } catch (err) {
        console.error('[WeeklyScheduler] Ingestion error on scheduled run:', err);
      } finally {
        scheduleNextRun();
      }
    }, ms);
  };

  scheduleNextRun();

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
 * Diagnostics & Status summary for API endpoint
 */
export function getWeeklySchedulerStatus() {
  const windowInfo = calculateWeeklyEatWindow();
  const nextInfo = getMsUntilNextMondayEAT();

  return {
    isIngestionRunning: isWeeklyIngestionRunning,
    currentWeeklyPeriod: {
      start: windowInfo.eatStartFormatted,
      end: windowInfo.eatEndFormatted,
      spannedUtcDates: windowInfo.utcDates,
    },
    nextScheduledRun: nextScheduledRunTime || nextInfo.targetDateFormatted,
    hoursUntilNextRun: +(nextInfo.ms / 3_600_000).toFixed(2),
    latestLog: latestIngestionLog,
  };
}

