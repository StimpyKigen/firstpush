import { executeWeeklyIngestion } from '../../src/lib/weeklyFixtureService.js';
import { isSnapshotStoreConfigured } from '../../src/lib/fixtureSnapshotStore.js';

/**
 * Vercel Cron target. Fetches the week's fixtures from SportScore (competition-targeted,
 * curated, deduplicated) and persists them to the shared Firestore snapshot that
 * /api/sports/daily-fixtures serves from.
 *
 * Auth: Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when CRON_SECRET is set.
 */
export default async function handler(req: any, res: any) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, error: 'CRON_SECRET is not configured.' });
  }
  if (req.headers?.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }
  if (!isSnapshotStoreConfigured()) {
    return res.status(503).json({ success: false, error: 'FIREBASE_SERVICE_ACCOUNT is not configured.' });
  }

  try {
    const log = await executeWeeklyIngestion({ force: true, startFromToday: true, targetDomesticCount: 28 });
    // executeWeeklyIngestion persists the shared Firestore snapshot itself.
    return res.status(200).json({ success: true, log });
  } catch (err: any) {
    console.error('[Cron weekly-sync] failed:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Weekly sync failed.' });
  }
}
