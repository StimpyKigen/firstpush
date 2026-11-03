/**
 * Shared Fixture Snapshot Store (Firestore, server-side only)
 *
 * Serverless instances (Vercel) do not share memory or disk, so fixtures ingested by the
 * weekly cron must be persisted somewhere every instance can read. This module stores the
 * curated fixtures in Firestore as one document per EAT match day:
 *
 *   fixtureSnapshots/{YYYY-MM-DD}  -> { date, fixtures: MarketFixture[], updatedAt }
 *   fixtureSnapshots/_meta         -> { updatedAt, count, dates }
 *
 * Per-day documents keep every document far below Firestore's 1 MiB limit.
 * Requires env FIREBASE_SERVICE_ACCOUNT (service-account JSON, raw or base64).
 * When it is missing, all functions are safe no-ops and callers fall back to live sync.
 */

import type { MarketFixture } from './sportsFeedService.js';

const COLLECTION = 'fixtureSnapshots';
const META_DOC = '_meta';

let cachedDb: any | null | undefined;

function eatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function parseServiceAccount(): Record<string, any> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
    const json = JSON.parse(text);
    if (typeof json.private_key === 'string') {
      json.private_key = json.private_key.replace(/\\n/g, '\n');
    }
    return json;
  } catch (err) {
    console.warn('[FixtureSnapshot] FIREBASE_SERVICE_ACCOUNT is not valid JSON/base64:', err);
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
    const app = mod.apps?.length
      ? mod.app()
      : mod.initializeApp({ credential: mod.credential.cert(creds) });
    cachedDb = mod.firestore(app);
    return cachedDb;
  } catch (err) {
    console.warn('[FixtureSnapshot] Could not initialise firebase-admin:', err);
    cachedDb = null;
    return null;
  }
}

export function isSnapshotStoreConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
}

/**
 * Persist fixtures grouped by EAT match day. Days older than `keepFromDate` are pruned.
 * Returns the number of fixtures written.
 */
export async function saveFixtureSnapshot(fixtures: MarketFixture[], keepFromDate?: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const byDay = new Map<string, MarketFixture[]>();
  for (const f of fixtures) {
    const day = eatDate(f.kickoffIso);
    if (!day) continue;
    if (keepFromDate && day < keepFromDate) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(f);
  }

  const updatedAt = new Date().toISOString();
  const col = db.collection(COLLECTION);
  const batch = db.batch();
  let total = 0;

  for (const [day, list] of byDay) {
    // JSON round trip strips `undefined` values, which Firestore rejects.
    batch.set(col.doc(day), { date: day, updatedAt, count: list.length, fixtures: JSON.parse(JSON.stringify(list)) });
    total += list.length;
  }

  batch.set(col.doc(META_DOC), { updatedAt, count: total, dates: Array.from(byDay.keys()).sort() });

  // Prune stale day documents
  if (keepFromDate) {
    const existing = await col.listDocuments();
    for (const ref of existing) {
      if (ref.id !== META_DOC && ref.id < keepFromDate) batch.delete(ref);
    }
  }

  await batch.commit();
  return total;
}

/**
 * Load every stored fixture (all day documents). Returns [] when unconfigured or empty.
 */
export async function loadFixtureSnapshot(): Promise<{ fixtures: MarketFixture[]; updatedAt: string | null }> {
  const db = await getDb();
  if (!db) return { fixtures: [], updatedAt: null };

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
      if (Array.isArray(data.fixtures)) fixtures.push(...data.fixtures);
    });
    return { fixtures, updatedAt };
  } catch (err) {
    console.warn('[FixtureSnapshot] Failed to load snapshot:', err);
    return { fixtures: [], updatedAt: null };
  }
}

