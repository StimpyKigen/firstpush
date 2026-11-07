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

const COLLECTION = 'fixtureSnapshots';
const META_DOC = '_meta';

let cachedDb: any | null | undefined;
let loggedPreviewIsolationNotice = false;

export interface SaveSnapshotOptions {
  keepFromDate?: string;
  isCompleteReconciliation?: boolean;
  reconciliationScopeDates?: string[];
  source?: 'weekly_cron' | 'rolling_sync' | 'manual';
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
export function resolveScopedServiceAccountRaw(): string | undefined {
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv && vercelEnv !== 'production') {
    const previewRaw = process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW?.trim();
    if (!previewRaw && process.env.FIREBASE_SERVICE_ACCOUNT && !loggedPreviewIsolationNotice) {
      loggedPreviewIsolationNotice = true;
      console.info(
        `[FixtureSnapshot] Isolating VERCEL_ENV="${vercelEnv}" from Production FIREBASE_SERVICE_ACCOUNT (falling back to isolated local cache unless FIREBASE_SERVICE_ACCOUNT_PREVIEW is configured).`
      );
    }
    return previewRaw || undefined;
  }
  return process.env.FIREBASE_SERVICE_ACCOUNT?.trim() || undefined;
}

export function resetSnapshotStoreCacheForTests(): void {
  cachedDb = undefined;
  loggedPreviewIsolationNotice = false;
}

function parseServiceAccount(): Record<string, any> | null {
  const raw = resolveScopedServiceAccountRaw();
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
    const json = JSON.parse(text);
    if (typeof json.private_key === 'string') {
      json.private_key = json.private_key.replace(/\\n/g, '\n');
    }
    return json;
  } catch (err) {
    console.warn('[FixtureSnapshot] Scoped Firebase service account is not valid JSON/base64:', err);
    return null;
  }
}

async function getDb(): Promise<any | null> {
  if (cachedDb !== undefined) return cachedDb;
  const creds = parseServiceAccount();
  if (!creds) {
    cachedDb = null;
    return null;
  }
  try {
    const admin = await import('firebase-admin');
    const mod: any = (admin as any).default || admin;
    const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
    const isNonProdVercel = Boolean(vercelEnv && vercelEnv !== 'production');
    let app: any;
    if (isNonProdVercel) {
      const previewAppName = 'mshindi-fixture-snapshot-preview';
      const existingPreviewApp = Array.isArray(mod.apps)
        ? mod.apps.find((a: any) => a?.name === previewAppName)
        : null;
      app = existingPreviewApp || mod.initializeApp({ credential: mod.credential.cert(creds) }, previewAppName);
    } else {
      app = mod.apps?.length
        ? mod.app()
        : mod.initializeApp({ credential: mod.credential.cert(creds) });
    }
    cachedDb = mod.firestore(app);
    return cachedDb;
  } catch (err) {
    console.warn('[FixtureSnapshot] Could not initialise firebase-admin:', err);
    cachedDb = null;
    return null;
  }
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

function saveLocalDiskSnapshot(byDay: Record<string, MarketFixture[]>, updatedAt: string): void {
  try {
    const filePath = getLocalCachePath();
    const data = {
      updatedAt,
      byDay,
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[FixtureSnapshot] Local cache write notice:', err);
  }
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

    // 1. Load all existing day documents to handle cross-day rescheduling seamlessly
    const existingDayMap = new Map<string, MarketFixture[]>();
    try {
      const snap = await col.get();
      snap.forEach((doc: any) => {
        if (doc.id !== META_DOC) {
          const list = doc.data()?.fixtures;
          if (Array.isArray(list)) {
            existingDayMap.set(doc.id, list);
          }
        }
      });
    } catch (readErr) {
      console.warn('[FixtureSnapshot] Error pre-fetching existing day documents:', readErr);
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
          const { merged, hasChanged } = mergeMarketFixtureRecords(existing, incoming);
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

        const { merged, hasChanged } = mergeMarketFixtureRecords(existing, incoming);
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

  saveLocalDiskSnapshot(byDay, nowIso);

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

  // Firestore path
  if (db) {
    try {
      const snap = await db.collection(COLLECTION).get();
      const fixtures: MarketFixture[] = [];
      let updatedAt: string | null = null;
      snap.forEach((doc: any) => {
        const data = doc.data();
        if (doc.id === META_DOC) {
          updatedAt = data.updatedAt || null;
          return;
        }
        if (Array.isArray(data.fixtures)) {
          fixtures.push(...data.fixtures);
        }
      });
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
