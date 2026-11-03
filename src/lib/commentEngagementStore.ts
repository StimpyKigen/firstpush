import { create } from 'zustand';
import {
  fetchUserCommentLikes,
  persistCommentLike,
  normalizeUserPhone,
} from './engagementService';

interface CommentEngagementState {
  likedCommentIds: Set<string>;
  extraCommentLikes: Record<string, number>;
  userHydratedPhone: string | null;
  isLoading: boolean;

  hydrateUserCommentLikes: (rawPhone: string) => Promise<void>;
  isCommentLiked: (commentId: string) => boolean;
  getCommentLikes: (commentId: string, baseLikes?: number) => number;
  toggleCommentLike: (
    commentId: string,
    user: { phone: string; username: string },
    options?: { postId?: string; baseLikes?: number }
  ) => Promise<{ success: boolean; liked: boolean; error?: string }>;
}

const LOCAL_STORAGE_KEY_PREFIX = 'mshindi_user_liked_comments_';

function getLocalLikedCache(normPhone: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${normPhone}`);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set<string>(arr);
      }
    }
  } catch {
    /* ignore parse errors */
  }
  return new Set<string>();
}

function saveLocalLikedCache(normPhone: string, set: Set<string>) {
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_KEY_PREFIX}${normPhone}`,
      JSON.stringify(Array.from(set))
    );
  } catch {
    /* ignore storage errors */
  }
}

export const useCommentEngagementStore = create<CommentEngagementState>((set, get) => ({
  likedCommentIds: new Set<string>(),
  extraCommentLikes: {},
  userHydratedPhone: null,
  isLoading: false,

  hydrateUserCommentLikes: async (rawPhone: string) => {
    if (!rawPhone) return;
    const normPhone = normalizeUserPhone(rawPhone);
    if (!normPhone) return;

    // 1. Immediately apply cached likes from localStorage to eliminate any visual flash
    const localCached = getLocalLikedCache(normPhone);
    if (localCached.size > 0 && get().userHydratedPhone !== normPhone) {
      set({
        likedCommentIds: new Set([...get().likedCommentIds, ...localCached]),
        userHydratedPhone: normPhone,
      });
    }

    set({ isLoading: true });

    try {
      // 2. Fetch authoritative likes from Cloud Firestore
      const remoteLikedSet = await fetchUserCommentLikes(normPhone);

      // Merge and update
      const mergedSet = new Set([...localCached, ...remoteLikedSet]);
      saveLocalLikedCache(normPhone, mergedSet);

      set({
        likedCommentIds: mergedSet,
        userHydratedPhone: normPhone,
        isLoading: false,
      });
    } catch (err) {
      console.warn('[CommentEngagementStore] Hydration notice:', err);
      set({ isLoading: false });
    }
  },

  isCommentLiked: (commentId: string) => {
    return get().likedCommentIds.has(commentId);
  },

  getCommentLikes: (commentId: string, baseLikes: number = 0) => {
    const extra = get().extraCommentLikes[commentId] || 0;
    return Math.max(0, baseLikes + extra);
  },

  toggleCommentLike: async (commentId, user, options) => {
    const normPhone = normalizeUserPhone(user.phone);
    if (!normPhone) {
      return { success: false, liked: false, error: 'Valid phone required to like comments' };
    }

    const currentlyLiked = get().likedCommentIds.has(commentId);
    const nextLiked = !currentlyLiked;
    const currentExtra = get().extraCommentLikes[commentId] || 0;
    const nextExtra = nextLiked ? currentExtra + 1 : currentExtra - 1;

    // 1. Optimistic Local State Update (Instant UI feedback)
    const nextLikedSet = new Set(get().likedCommentIds);
    if (nextLiked) {
      nextLikedSet.add(commentId);
    } else {
      nextLikedSet.delete(commentId);
    }

    set((state) => ({
      likedCommentIds: nextLikedSet,
      extraCommentLikes: {
        ...state.extraCommentLikes,
        [commentId]: nextExtra,
      },
    }));

    // Cache locally for seamless continuity
    saveLocalLikedCache(normPhone, nextLikedSet);

    // 2. Persist to Cloud Firestore
    const res = await persistCommentLike(commentId, user, nextLiked, {
      postId: options?.postId,
    });

    if (!res.success) {
      // Rollback optimistic update on error
      const rollbackLikedSet = new Set(get().likedCommentIds);
      if (currentlyLiked) {
        rollbackLikedSet.add(commentId);
      } else {
        rollbackLikedSet.delete(commentId);
      }

      set((state) => ({
        likedCommentIds: rollbackLikedSet,
        extraCommentLikes: {
          ...state.extraCommentLikes,
          [commentId]: currentExtra,
        },
      }));

      saveLocalLikedCache(normPhone, rollbackLikedSet);
      return { success: false, liked: currentlyLiked, error: res.error };
    }

    return { success: true, liked: nextLiked };
  },
}));

