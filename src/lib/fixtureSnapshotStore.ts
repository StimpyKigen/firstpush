/**
 * Shared Fixture Snapshot Store (Firestore with Local Disk Fallback)
 *
 * Persists fixtures in Firestore as one document per EAT match day:
 *   fixtureSnapshots/{YYYY-MM-DD}  -> { date, fixtures: MarketFixture[], updatedAt, count }
 *   fixtureSnapshots/_meta         -> { updatedAt, count, dates }
 *
 * Implements:
 * - Incremental upserts: updates existing records in place, appends new records, and preserves all unaffected records.
 * - Cross-day rescheduling: cleanly moves fixtures across days if kickoff date changes without duplicating.
 * - Live-score and terminal-status protection.
 * - Safe reconciliation: non-destructive updates that never prune fixtures unless full reconciliation is explicitly completed.
 * - Serverless-safe per-day chunking far below Firestore's 1 MiB document limit.
 * - Resilient fallback to persistent local cache when Firestore credentials are unavailable.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { MarketFixture } from './sportsFeedService.js';
import {
  formatEatDay,
  findMatchingExistingFixture,
  mergeMarketFixtureRecords,
} from './fixtureIdentity.js';
import {
  getAdminFirestore,
  resetFirebaseAdminForTests,
  resolveScopedServiceAccountRaw,
} from './serverFirebaseAdmin.js';

export { resolveScopedServiceAccountRaw };

const COLLECTION = 'fixtureSnapshots';
const META_DOC = '_meta';

export interface SaveSnapshotOptions {
  keepFromDate?: string;
  isCompleteReconciliation?: boolean;
  reconciliationScopeDates?: string[];
  source?: 'weekly_cron' | 'rolling_sync' | 'manual';
  forceAuthoritativeOverwrite?: boolean;
}

export interface SnapshotSaveStats {
  totalPersisted: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  datesWritten: string[];
}

/**
 * Enforces strict Production vs Preview state isolation:
 * When running in a non-production Vercel environment (`VERCEL_ENV !== 'production'`),
 * `FIREBASE_SERVICE_ACCOUNT` is ignored so Preview deployments can never read from or
 * write to Production's `fixtureSnapshots` collection. Preview deployments may optionally
 * supply `FIREBASE_SERVICE_ACCOUNT_PREVIEW` for a separate project, or fall back cleanly
 * to their isolated local disk snapshot cache.
 */
export function resetSnapshotStoreCacheForTests(): void {
  resetFirebaseAdminForTests();
}

async function getDb(): Promise<any | null> {
  if (!resolveScopedServiceAccountRaw()) {
    return null;
  }
  return getAdminFirestore({ allowAdc: false });
}

export function isSnapshotStoreConfigured(): boolean {
  return Boolean(resolveScopedServiceAccountRaw());
}

function getLocalCachePath(): string {
  const isVercel = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const dir = isVercel ? path.join(os.tmpdir(), '.mshindi-cache') : path.join(process.cwd(), '.cache');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return path.join(dir, 'sports_fixtures_snapshot.json');
}

function loadLocalDiskSnapshot(): { byDay: Record<string, MarketFixture[]>; updatedAt: string | null } {
  try {
    const filePath = getLocalCachePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          byDay: parsed.byDay || {},
          updatedAt: parsed.updatedAt || null,
        };
      }
    }
  } catch {}
  return { byDay: {}, updatedAt: null };
}

async function saveLocalDiskSnapshotAsync(byDay: Record<string, MarketFixture[]>, updatedAt: string): Promise<void> {
  try {
    const filePath = getLocalCachePath();
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    const payload = JSON.stringify({ updatedAt, byDay });
    await fs.promises.writeFile(tmpPath, payload, 'utf-8');
    await fs.promises.rename(tmpPath, filePath);
  } catch (err) {
    console.warn('[FixtureSnapshot] Local cache write notice:', err);
  }
}

export async function fetchTargetedDayDocs(
  db: any,
  col: any,
  candidateDates: string[],
  allowCollectionFallback = false
): Promise<{
  existingDayMap: Map<string, MarketFixture[]>;
  metaDates: string[];
  updatedAt: string | null;
}> {
  const existingDayMap = new Map<string, MarketFixture[]>();
  let metaDates: string[] = [];
  let updatedAt: string | null = null;

  const metaSnap = await col.doc(META_DOC).get();
  if (metaSnap.exists) {
    const metaData = metaSnap.data();
    updatedAt = metaData?.updatedAt || null;
    if (Array.isArray(metaData?.dates)) {
      metaDates = metaData.dates.filter((d: any) => typeof d === 'string' && d !== META_DOC);
    }
  }

  const targetIds = Array.from(new Set([...candidateDates, ...metaDates])).filter(
    (id) => Boolean(id) && id !== META_DOC
  );

  if (targetIds.length > 0) {
    const refs = targetIds.map((dayId) => col.doc(dayId));
    const snaps = typeof db.getAll === 'function'
      ? await db.getAll(...refs)
      : await Promise.all(refs.map((ref: any) => ref.get()));
    for (const snap of snaps) {
      if (snap && snap.exists && snap.id !== META_DOC) {
        const list = snap.data()?.fixtures;
        if (Array.isArray(list)) {
          existingDayMap.set(snap.id, list);
        }
      }
    }
    return { existingDayMap, metaDates, updatedAt };
  }

  if (allowCollectionFallback) {
    const snap = await col.get();
    snap.forEach((doc: any) => {
      const data = doc.data();
      if (doc.id === META_DOC) {
        updatedAt = data?.updatedAt || updatedAt;
        return;
      }
      if (Array.isArray(data?.fixtures)) {
        existingDayMap.set(doc.id, data.fixtures);
      }
    });
  }

  return { existingDayMap, metaDates, updatedAt };
}

/**
 * Incrementally saves fixtures into persistent storage.
 * 
 * Guarantees:
 * 1. Existing fixtures for the target days are read first and merged incrementally.
 * 2. New fixtures are added without deleting previously stored fixtures.
 * 3. Existing fixtures are updated in place with live-score and status protection.
 * 4. Cross-day kickoff shifts safely move records without leaving ghost duplicates.
 * 5. Stale day pruning ONLY occurs if options.isCompleteReconciliation is true.
 * 6. Returns total number of persisted fixtures across all affected days.
 */
export async function saveFixtureSnapshot(
  fixtures: MarketFixture[],
  optionsOrKeepFromDate?: SaveSnapshotOptions | string
): Promise<number> {
  const options: SaveSnapshotOptions =
    typeof optionsOrKeepFromDate === 'string'
      ? { keepFromDate: optionsOrKeepFromDate }
      : optionsOrKeepFromDate || {};

  const stats = await saveFixtureSnapshotWithStats(fixtures, options);
  return stats.totalPersisted;
}

/**
 * Enhanced incremental save returning detailed synchronization telemetry.
 */
export async function saveFixtureSnapshotWithStats(
  fixtures: MarketFixture[],
  options?: SaveSnapshotOptions
): Promise<SnapshotSaveStats> {
  const db = await getDb();
  const keepFromDate = options?.keepFromDate;
  const isCompleteReconciliation = Boolean(options?.isCompleteReconciliation);

  // Group incoming fixtures by EAT match day
  const incomingByDay = new Map<string, MarketFixture[]>();
  for (const f of fixtures) {
    const day = formatEatDay(f.kickoffIso);
    if (!day) continue;
    if (keepFromDate && day < keepFromDate && !isCompleteReconciliation) continue;
    if (!incomingByDay.has(day)) incomingByDay.set(day, []);
    incomingByDay.get(day)!.push(f);
  }

  const nowIso = new Date().toISOString();
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  const datesWrittenSet = new Set<string>();

  // =========================================================================
  // Strategy A: Cloud Firestore Storage (when service account is configured)
  // =========================================================================
  if (db) {
    const col = db.collection(COLLECTION);
    const batch = db.batch();

    // 1. Load targeted day documents (_meta.dates + incoming days) instead of scanning entire collection
    let existingDayMap = new Map<string, MarketFixture[]>();
    try {
      const targeted = await fetchTargetedDayDocs(db, col, Array.from(incomingByDay.keys()), true);
      existingDayMap = targeted.existingDayMap;
    } catch (readErr) {
      console.warn('[FixtureSnapshot] Error pre-fetching targeted day documents:', readErr);
    }

    // Index all existing fixtures by day and item for fast cross-day lookups
    const allExistingFlat: { day: string; fixture: MarketFixture }[] = [];
    for (const [day, list] of existingDayMap) {
      for (const item of list) {
        allExistingFlat.push({ day, fixture: item });
      }
    }

    // Days modified during this sync
    const modifiedDays = new Set<string>();

    for (const [day, incomingList] of incomingByDay) {
      datesWrittenSet.add(day);
      modifiedDays.add(day);

      const currentDayList = existingDayMap.get(day) || [];
      const currentDayMap = new Map<string, MarketFixture>();
      for (const item of currentDayList) {
        currentDayMap.set(item.id, item);
      }

      for (const incoming of incomingList) {
        // Look within same day first
        let existing = findMatchingExistingFixture(incoming, currentDayMap.values());
        let previousDay: string | null = null;

        // If not found in same day, check if it was rescheduled from another day
        if (!existing) {
          for (const flat of allExistingFlat) {
            if (flat.day !== day) {
              const matched = findMatchingExistingFixture(incoming, [flat.fixture]);
              if (matched) {
                existing = matched;
                previousDay = flat.day;
                break;
              }
            }
          }
        }

        if (!existing) {
          // Genuinely new fixture
          currentDayMap.set(incoming.id, incoming);
          newCount++;
        } else {
          // If rescheduled from another day, remove from old day list
          if (previousDay && previousDay !== day) {
            const oldDayList = existingDayMap.get(previousDay) || [];
            const filteredOldDay = oldDayList.filter((item) => item.id !== existing!.id);
            existingDayMap.set(previousDay, filteredOldDay);
            modifiedDays.add(previousDay);
          }

          // Merge and update in current day
          const { merged, hasChanged } = mergeMarketFixtureRecords(existing, incoming, {
            forceAuthoritativeOverwrite: options?.forceAuthoritativeOverwrite,
          });
          currentDayMap.set(existing.id, merged);
          if (hasChanged) {
            updatedCount++;
          } else {
            unchangedCount++;
          }
        }
      }

      existingDayMap.set(day, Array.from(currentDayMap.values()));
    }

    // 2. Batch write all modified day documents
    for (const day of modifiedDays) {
      const list = existingDayMap.get(day) || [];
      const cleanList = JSON.parse(JSON.stringify(list));
      batch.set(col.doc(day), {
        date: day,
        updatedAt: nowIso,
        count: cleanList.length,
        fixtures: cleanList,
      });
    }

    // 3. Safe reconciliation: only prune historical documents if explicitly complete
    if (isCompleteReconciliation && keepFromDate) {
      try {
        const existingDocs = await col.listDocuments();
        for (const ref of existingDocs) {
          if (ref.id !== META_DOC && ref.id < keepFromDate) {
            batch.delete(ref);
            existingDayMap.delete(ref.id);
          }
        }
      } catch (pruneErr) {
        console.warn('[FixtureSnapshot] Pruning notice:', pruneErr);
      }
    }

    // 4. Update _meta document with all available dates
    const allDates = Array.from(existingDayMap.keys()).sort();
    batch.set(col.doc(META_DOC), {
      updatedAt: nowIso,
      dates: allDates,
      lastSyncSource: options?.source || 'unknown',
    });

    await batch.commit();

    let totalPersisted = 0;
    for (const list of existingDayMap.values()) {
      totalPersisted += list.length;
    }

    return {
      totalPersisted,
      newCount,
      updatedCount,
      unchangedCount,
      datesWritten: Array.from(datesWrittenSet),
    };
  }

  // =========================================================================
  // Strategy B: Local Disk Fallback (offline / local dev / test suite)
  // =========================================================================
  const localSnapshot = loadLocalDiskSnapshot();
  const byDay = localSnapshot.byDay;

  // Flatten all existing fixtures for cross-day rescheduling lookup
  const allExistingFlat: { day: string; fixture: MarketFixture }[] = [];
  for (const [day, list] of Object.entries(byDay)) {
    if (Array.isArray(list)) {
      for (const item of list) {
        allExistingFlat.push({ day, fixture: item });
      }
    }
  }

  for (const [day, incomingList] of incomingByDay) {
    datesWrittenSet.add(day);
    const existingList = byDay[day] || [];
    const dayMap = new Map<string, MarketFixture>();

    for (const item of existingList) {
      dayMap.set(item.id, item);
    }

    for (const incoming of incomingList) {
      // 1. Look within same day
      let existing = findMatchingExistingFixture(incoming, dayMap.values());
      let previousDay: string | null = null;

      // 2. Look across other days (rescheduled match check)
      if (!existing) {
        for (const flat of allExistingFlat) {
          if (flat.day !== day) {
            const matched = findMatchingExistingFixture(incoming, [flat.fixture]);
            if (matched) {
              existing = matched;
              previousDay = flat.day;
              break;
            }
          }
        }
      }

      if (!existing) {
        dayMap.set(incoming.id, incoming);
        newCount++;
      } else {
        // If match rescheduled to another day, remove from old day list
        if (previousDay && previousDay !== day) {
          const oldList = byDay[previousDay] || [];
          byDay[previousDay] = oldList.filter((item) => item.id !== existing!.id);
        }

        const { merged, hasChanged } = mergeMarketFixtureRecords(existing, incoming, {
          forceAuthoritativeOverwrite: options?.forceAuthoritativeOverwrite,
        });
        dayMap.set(existing.id, merged);
        if (hasChanged) {
          updatedCount++;
        } else {
          unchangedCount++;
        }
      }
    }

    byDay[day] = Array.from(dayMap.values());
  }

  // Safe reconciliation for local disk
  if (isCompleteReconciliation && keepFromDate) {
    for (const dayKey of Object.keys(byDay)) {
      if (dayKey < keepFromDate) {
        delete byDay[dayKey];
      }
    }
  }

  await saveLocalDiskSnapshotAsync(byDay, nowIso);

  let totalPersisted = 0;
  for (const list of Object.values(byDay)) {
    if (Array.isArray(list)) totalPersisted += list.length;
  }

  return {
    totalPersisted,
    newCount,
    updatedCount,
    unchangedCount,
    datesWritten: Array.from(datesWrittenSet),
  };
}

/**
 * Loads every stored fixture across all match days from Firestore (or local fallback).
 * Returns empty array when unconfigured or empty.
 */
export async function loadFixtureSnapshot(): Promise<{ fixtures: MarketFixture[]; updatedAt: string | null }> {
  const db = await getDb();

  // Firestore path: targeted batch getAll using _meta.dates (fallback to collection scan only if _meta missing)
  if (db) {
    try {
      const col = db.collection(COLLECTION);
      const { existingDayMap, updatedAt } = await fetchTargetedDayDocs(db, col, [], true);
      const fixtures: MarketFixture[] = [];
      for (const list of existingDayMap.values()) {
        fixtures.push(...list);
      }
      return { fixtures, updatedAt };
    } catch (err) {
      console.warn('[FixtureSnapshot] Failed to load Firestore snapshot:', err);
    }
  }

  // Local disk fallback path
  const local = loadLocalDiskSnapshot();
  const flat: MarketFixture[] = [];
  for (const list of Object.values(local.byDay)) {
    if (Array.isArray(list)) flat.push(...list);
  }
  return { fixtures: flat, updatedAt: local.updatedAt };
}
