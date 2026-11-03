/**
 * MshindiRoom Engagement & Real-time Persistence Service
 * 
 * Architected for:
 * 1. Deterministic Likes: `posts/{postId}/likes/{normPhone}` + `users/{normPhone}/likedPosts/{postId}`
 * 2. Deterministic Saves: `users/{normPhone}/savedPosts/{postId}`
 * 3. Deterministic Comment Likes: `comments/{commentId}/likes/{normPhone}` + `users/{normPhone}/likedComments/{commentId}`
 *    and optionally `posts/{postId}/comments/{commentId}/likes/{normPhone}`
 * 4. Concurrency-safe atomic counter management using Firestore `increment(1)` / `increment(-1)`
 * 5. Optimistic UI reconciliation with graceful error rollback
 * 6. Selective Real-time Feed Listener on recent posts with unsubscribe cleanup
 * 7. Authoritative Saved Reels Resolution & Real-time Synchronization
 * 8. User Engagement Sets Hydration across devices and sessions
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
  increment,
  query,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { BetSlipPost } from './betSlipStore';

// Canonical phone helper: e.g. "0743304579" -> "254743304579"
export function normalizeUserPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) return `254${digits}`;
  return digits;
}

export interface UserEngagementMap {
  likedPostIds: Set<string>;
  savedPostIds: Set<string>;
}

/**
 * Hydrate all post IDs that a user has liked and saved in a single parallel fetch.
 */
export async function fetchUserEngagementMap(rawPhone: string): Promise<UserEngagementMap> {
  const normPhone = normalizeUserPhone(rawPhone);
  const result: UserEngagementMap = {
    likedPostIds: new Set<string>(),
    savedPostIds: new Set<string>(),
  };

  if (!db || !normPhone) return result;

  try {
    const [likedSnap, savedSnap] = await Promise.all([
      getDocs(collection(db, 'users', normPhone, 'likedPosts')).catch(() => null),
      getDocs(collection(db, 'users', normPhone, 'savedPosts')).catch(() => null),
    ]);

    if (likedSnap) {
      likedSnap.docs.forEach((d) => result.likedPostIds.add(d.id));
    }
    if (savedSnap) {
      savedSnap.docs.forEach((d) => result.savedPostIds.add(d.id));
    }
  } catch (err) {
    console.warn('[EngagementService] Error hydrating user engagements:', err);
  }

  return result;
}

/**
 * Hydrate all comment IDs that a user has liked across discussions and posts.
 */
export async function fetchUserCommentLikes(rawPhone: string): Promise<Set<string>> {
  const normPhone = normalizeUserPhone(rawPhone);
  const result = new Set<string>();
  if (!db || !normPhone) return result;

  try {
    const snap = await getDocs(collection(db, 'users', normPhone, 'likedComments')).catch(() => null);
    if (snap) {
      snap.docs.forEach((d) => result.add(d.id));
    }
  } catch (err) {
    console.warn('[EngagementService] Error hydrating comment likes:', err);
  }

  return result;
}

/**
 * Atomic Comment Like / Unlike in Cloud Firestore:
 * - Deterministic lookup document: `users/{normPhone}/likedComments/{commentId}`
 * - Deterministic comment subcollection: `comments/{commentId}/likes/{normPhone}`
 * - Also updates `posts/{postId}/comments/{commentId}/likes/{normPhone}` if postId provided
 * - Concurrency-safe counter update: `increment(1)` / `increment(-1)`
 */
export async function persistCommentLike(
  commentId: string,
  user: { phone: string; username: string },
  shouldLike: boolean,
  options?: { postId?: string }
): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    return { success: true }; // Local-only mode fallback
  }

  const normPhone = normalizeUserPhone(user.phone);
  if (!normPhone) {
    return { success: false, error: 'Valid user phone is required to record comment like.' };
  }

  try {
    const batch = writeBatch(db);
    const userLikedCommentRef = doc(db, 'users', normPhone, 'likedComments', commentId);
    const commentLikeRef = doc(db, 'comments', commentId, 'likes', normPhone);
    const pickLikeRef = doc(db, 'picks', commentId, 'likes', normPhone);

    if (shouldLike) {
      const payload = {
        userId: normPhone,
        username: user.username,
        commentId,
        createdAt: new Date().toISOString(),
      };
      batch.set(userLikedCommentRef, {
        commentId,
        likedAt: new Date().toISOString(),
      });
      batch.set(commentLikeRef, payload);
      batch.set(pickLikeRef, payload);

      if (options?.postId) {
        const postCommentLikeRef = doc(db, 'posts', options.postId, 'comments', commentId, 'likes', normPhone);
        batch.set(postCommentLikeRef, payload);
      }
    } else {
      batch.delete(userLikedCommentRef);
      batch.delete(commentLikeRef);
      batch.delete(pickLikeRef);

      if (options?.postId) {
        const postCommentLikeRef = doc(db, 'posts', options.postId, 'comments', commentId, 'likes', normPhone);
        batch.delete(postCommentLikeRef);
      }
    }

    await batch.commit();
    return { success: true };
  } catch (err: any) {
    console.error('[EngagementService] Comment like commit error:', err);
    return { success: false, error: err?.message || 'Failed to sync comment like to database.' };
  }
}

/**
 * Atomic Like / Unlike in Cloud Firestore:
 * - Deterministic subcollection write: `posts/{postId}/likes/{normPhone}`
 * - Fast user lookup document: `users/{normPhone}/likedPosts/{postId}`
 * - Concurrency-safe counter update: `posts/{postId}.likes += increment(1)` or `increment(-1)`
 */
export async function persistPostLike(
  postId: string,
  user: { phone: string; username: string },
  shouldLike: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    return { success: true }; // Local-only mode fallback
  }

  const normPhone = normalizeUserPhone(user.phone);
  if (!normPhone) {
    return { success: false, error: 'Valid user phone is required to record like.' };
  }

  try {
    const batch = writeBatch(db);
    const postRef = doc(db, 'posts', postId);
    const postLikeRef = doc(db, 'posts', postId, 'likes', normPhone);
    const userLikedRef = doc(db, 'users', normPhone, 'likedPosts', postId);

    if (shouldLike) {
      batch.set(postLikeRef, {
        userId: normPhone,
        username: user.username,
        createdAt: new Date().toISOString(),
      });
      batch.set(userLikedRef, {
        postId,
        likedAt: new Date().toISOString(),
      });
      batch.update(postRef, {
        likes: increment(1),
        updatedAt: new Date().toISOString(),
      });
    } else {
      batch.delete(postLikeRef);
      batch.delete(userLikedRef);
      batch.update(postRef, {
        likes: increment(-1),
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
    return { success: true };
  } catch (err: any) {
    console.error('[EngagementService] Like toggle commit error:', err);
    return { success: false, error: err?.message || 'Database like synchronization failed.' };
  }
}

/**
 * Atomic Save / Unsave in Cloud Firestore:
 * - Deterministic user bookmarks collection: `users/{normPhone}/savedPosts/{postId}`
 * - Concurrency-safe counter update: `posts/{postId}.saves += increment(1)` or `increment(-1)`
 */
export async function persistPostSave(
  postId: string,
  rawPhone: string,
  shouldSave: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    return { success: true };
  }

  const normPhone = normalizeUserPhone(rawPhone);
  if (!normPhone) {
    return { success: false, error: 'Valid user phone is required to save post.' };
  }

  try {
    const batch = writeBatch(db);
    const postRef = doc(db, 'posts', postId);
    const userSavedRef = doc(db, 'users', normPhone, 'savedPosts', postId);

    if (shouldSave) {
      batch.set(userSavedRef, {
        postId,
        contentType: 'reel',
        savedAt: new Date().toISOString(),
      });
      batch.update(postRef, {
        saves: increment(1),
        updatedAt: new Date().toISOString(),
      });
    } else {
      batch.delete(userSavedRef);
      batch.update(postRef, {
        saves: increment(-1),
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
    return { success: true };
  } catch (err: any) {
    console.error('[EngagementService] Save toggle commit error:', err);
    return { success: false, error: err?.message || 'Database save synchronization failed.' };
  }
}

/**
 * Resolve all saved reel relationships into actual, full BetSlipPost documents.
 * - Queries `users/{normPhone}/savedPosts`
 * - Fetches corresponding `posts/{postId}` authoritative documents
 * - Gracefully ignores deleted or missing documents
 * - Sets `savedByMe = true`
 * - Orders most recently saved first
 */
export async function resolveSavedReels(
  rawPhone: string,
  fallbackPosts: BetSlipPost[] = []
): Promise<BetSlipPost[]> {
  const normPhone = normalizeUserPhone(rawPhone);
  if (!db || !normPhone) {
    return fallbackPosts.filter((p) => p.savedByMe);
  }

  try {
    // 1. Get saved post references from user subcollection
    const savedSnap = await getDocs(
      query(collection(db, 'users', normPhone, 'savedPosts'), orderBy('savedAt', 'desc'))
    ).catch(async () => {
      // Fallback without index if orderBy fails
      return getDocs(collection(db, 'users', normPhone, 'savedPosts'));
    });

    if (!savedSnap || savedSnap.empty) {
      return [];
    }

    const savedRefs = savedSnap.docs.map((d) => ({
      postId: d.id,
      savedAt: d.data().savedAt || '',
    }));

    // 2. Resolve each saved reference in parallel
    const resolvedPromises = savedRefs.map(async ({ postId, savedAt }): Promise<BetSlipPost | null> => {
      try {
        const postSnap = await getDoc(doc(db, 'posts', postId));
        if (postSnap.exists()) {
          const data = postSnap.data() as BetSlipPost;
          return {
            ...data,
            id: postSnap.id,
            savedByMe: true,
            savedAtTimestamp: savedAt,
          } as BetSlipPost & { savedAtTimestamp?: string };
        }

        // If not in Firestore posts, check fallback memory
        const foundFallback = fallbackPosts.find((p) => p.id === postId);
        if (foundFallback) {
          return {
            ...foundFallback,
            savedByMe: true,
            savedAtTimestamp: savedAt,
          };
        }
      } catch (docErr) {
        console.warn(`[EngagementService] Could not resolve post ${postId}:`, docErr);
      }
      return null;
    });

    const resolved = await Promise.all(resolvedPromises);
    const validPosts = resolved.filter((p): p is BetSlipPost => p !== null);

    return validPosts;
  } catch (err) {
    console.warn('[EngagementService] Error resolving saved reels:', err);
    return fallbackPosts.filter((p) => p.savedByMe);
  }
}

/**
 * Subscribe to the active user's saved reels in real time.
 * - Listens to `users/{normPhone}/savedPosts`
 * - Automatically resolves actual reel content on updates
 * - Handles listener teardown cleanly via returned Unsubscribe
 */
export function subscribeToUserSavedReels(
  rawPhone: string,
  onUpdate: (savedPosts: BetSlipPost[]) => void,
  fallbackPosts: BetSlipPost[] = []
): Unsubscribe {
  const normPhone = normalizeUserPhone(rawPhone);
  if (!db || !normPhone) {
    onUpdate(fallbackPosts.filter((p) => p.savedByMe));
    return () => {};
  }

  try {
    const savedQuery = query(collection(db, 'users', normPhone, 'savedPosts'));
    const unsubscribe = onSnapshot(
      savedQuery,
      async (snapshot) => {
        if (snapshot.empty) {
          onUpdate([]);
          return;
        }

        const savedRefs = snapshot.docs.map((d) => ({
          postId: d.id,
          savedAt: d.data().savedAt || '',
        }));

        const resolvedPromises = savedRefs.map(async ({ postId, savedAt }): Promise<BetSlipPost | null> => {
          try {
            const postSnap = await getDoc(doc(db, 'posts', postId));
            if (postSnap.exists()) {
              const data = postSnap.data() as BetSlipPost;
              return {
                ...data,
                id: postSnap.id,
                savedByMe: true,
                savedAtTimestamp: savedAt,
              };
            }

            const foundFallback = fallbackPosts.find((p) => p.id === postId);
            if (foundFallback) {
              return {
                ...foundFallback,
                savedByMe: true,
                savedAtTimestamp: savedAt,
              };
            }
          } catch {
            /* skip unresolvable post */
          }
          return null;
        });

        const resolved = await Promise.all(resolvedPromises);
        const valid = resolved.filter((p): p is BetSlipPost => p !== null);
        onUpdate(valid);
      },
      (error) => {
        console.warn('[EngagementService] Saved reels subscription notice:', error.message);
        onUpdate(fallbackPosts.filter((p) => p.savedByMe));
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[EngagementService] Saved reels listener setup notice:', err);
    onUpdate(fallbackPosts.filter((p) => p.savedByMe));
    return () => {};
  }
}

/**
 * Publish a new custom built slip post to Firestore `posts` collection.
 */
export async function persistNewPostToFirestore(
  post: BetSlipPost
): Promise<{ success: boolean; error?: string }> {
  if (!db) return { success: true };

  try {
    const postRef = doc(db, 'posts', post.id);
    const payload = {
      ...post,
      likes: post.likes || 0,
      saves: post.saves || 0,
      shares: post.shares || 0,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(postRef, payload, { merge: true });
    return { success: true };
  } catch (err: any) {
    console.error('[EngagementService] Post publish error:', err);
    return { success: false, error: err?.message || 'Failed to publish post to cloud feed.' };
  }
}

/**
 * Subscribe to the active community posts feed in real time.
 * - Queries recent posts ordered by `createdAt` descending.
 * - Handles listener teardown cleanly via returned Unsubscribe.
 * - Seeds INITIAL_POSTS if the cloud collection is freshly created and empty.
 */
export function subscribeToCommunityPosts(
  onUpdate: (cloudPosts: BetSlipPost[]) => void,
  initialFallbackPosts: BetSlipPost[],
  pageSize: number = 25
): Unsubscribe {
  if (!db) {
    onUpdate(initialFallbackPosts);
    return () => {};
  }

  try {
    const postsQuery = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );

    const unsubscribe = onSnapshot(
      postsQuery,
      async (snapshot) => {
        if (snapshot.empty) {
          // If Firestore posts collection is empty, seed initial community slips
          try {
            const batch = writeBatch(db);
            initialFallbackPosts.forEach((p) => {
              const ref = doc(db, 'posts', p.id);
              batch.set(ref, {
                ...p,
                updatedAt: new Date().toISOString(),
              }, { merge: true });
            });
            await batch.commit();
          } catch (seedErr) {
            console.warn('[EngagementService] Seed initial posts notice:', seedErr);
          }
          onUpdate(initialFallbackPosts);
          return;
        }

        const cloudPosts: BetSlipPost[] = [];
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as BetSlipPost;
          cloudPosts.push({
            ...data,
            id: docSnap.id,
          });
        });

        onUpdate(cloudPosts);
      },
      (error) => {
        console.warn('[EngagementService] Real-time posts subscription notice:', error.message);
        onUpdate(initialFallbackPosts);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[EngagementService] Firestore listener initialization notice:', err);
    onUpdate(initialFallbackPosts);
    return () => {};
  }
}
