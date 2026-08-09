/**
 * Firebase Firestore & Cloud Functions Integration for MshindiRoom Rating Engine
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  PlayerRatingProfile,
  JackpotSettlementUserSubmission,
  updatePlayerProfileAfterSettlement,
  createInitialPlayerProfile,
  calculateInactivityDecay
} from './ratingEngine';

/**
 * Fetch a user's player rating profile from Firestore (or fallback to generated defaults)
 */
export async function getPlayerRatingProfileFromFirestore(userId: string, username: string): Promise<PlayerRatingProfile> {
  if (!db) return createInitialPlayerProfile(username);
  try {
    const docRef = doc(db, 'playerRatings', userId);
    const snap = await getDoc(docRef);
    
    if (snap.exists()) {
      return snap.data() as PlayerRatingProfile;
    }
  } catch (err) {
    console.warn('Could not fetch player rating profile from Firestore, using initial generator:', err);
  }

  // Fallback / Initial bootstrap profile
  const initial = createInitialPlayerProfile(username);
  initial.userId = userId;
  return initial;
}

/**
 * Process a jackpot settlement for a single user in Firestore
 */
export async function processUserJackpotSettlementInFirestore(
  submission: JackpotSettlementUserSubmission
): Promise<PlayerRatingProfile> {
  const currentProfile = await getPlayerRatingProfileFromFirestore(submission.userId, submission.username);
  const { updatedProfile, result } = updatePlayerProfileAfterSettlement(currentProfile, submission);

  if (db) {
    try {
      const docRef = doc(db, 'playerRatings', submission.userId);
      await setDoc(docRef, updatedProfile, { merge: true });
      
      // Save to subcollection history log
      const historyRef = doc(db, `playerRatings/${submission.userId}/history`, `jackpot_${Date.now()}`);
      await setDoc(historyRef, {
        ...result,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Error saving settled rating update to Firestore:', err);
    }
  }

  return updatedProfile;
}

/**
 * Cloud Function Trigger Blueprint (Node.js / Firebase Functions v2 syntax)
 * Put this code inside functions/src/index.ts in production:
 */
export const FIREBASE_CLOUD_FUNCTION_SNIPPET = `
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { updatePlayerProfileAfterSettlement, calculateInactivityDecay } from './ratingEngine';

admin.initializeApp();

/**
 * Automatically update player ratings whenever a jackpot document changes status to 'settled'
 */
export const onJackpotSettled = onDocumentUpdated('jackpots/{jackpotId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return;
  if (before.status !== 'settled' && after.status === 'settled') {
    const leaderboard = after.leaderboard || [];
    const totalParticipants = leaderboard.length || 1;
    
    const db = admin.firestore();
    const batch = db.batch();

    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const userId = entry.userId || \`user_\${entry.username.toLowerCase()}\`;
      
      const ratingRef = db.collection('playerRatings').doc(userId);
      const docSnap = await ratingRef.get();
      
      let profile = docSnap.exists ? docSnap.data() : createInitialPlayerProfile(entry.username);
      
      const submission = {
        userId,
        username: entry.username,
        rank: entry.rank,
        totalParticipants,
        correctPicks: entry.correct,
        totalMatches: entry.totalMatches,
      };

      const { updatedProfile } = updatePlayerProfileAfterSettlement(profile, submission);
      batch.set(ratingRef, updatedProfile, { merge: true });
    }

    await batch.commit();
    console.log(\`Successfully processed rating updates for jackpot \${event.params.jackpotId}\`);
  }
});

/**
 * Daily scheduled decay function to reduce RP for users inactive > 30 days
 */
export const scheduledActivityDecay = onSchedule('every 24 hours', async (event) => {
  const db = admin.firestore();
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  
  const snapshot = await db.collection('playerRatings')
    .where('lastActiveTimestamp', '<=', now - thirtyDaysMs)
    .get();

  const batch = db.batch();
  let count = 0;

  snapshot.forEach((docSnap) => {
    const profile = docSnap.data();
    const { newRp, decayedRp } = calculateInactivityDecay(profile.rp, profile.lastActiveTimestamp, now);
    
    if (decayedRp > 0) {
      batch.update(docSnap.ref, {
        rp: newRp,
        totalDecayApplied: (profile.totalDecayApplied || 0) + decayedRp,
        updatedAt: now,
      });
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(\`Applied inactivity decay to \${count} inactive players.\`);
  }
});
`;
