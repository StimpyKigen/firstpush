import { create } from 'zustand';
import type { ParsedSlip } from './betSlipParser';
import { sanitizeExternalHttpUrl, hasDangerousUrlScheme } from './urlSecurity';
import {
  persistPostLike,
  persistPostSave,
  fetchUserEngagementMap,
  subscribeToCommunityPosts,
  persistNewPostToFirestore,
  resolveSavedReels,
} from './engagementService';

export interface BuiltSlipLeg {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string;
  market: string; // e.g. "1X2", "Double Chance", "Over/Under 2.5", "BTTS", "Handicap"
  pick: string; // e.g. "Arsenal Win (1)", "Over 2.5 Goals", "GG (Yes)"
  odds: number;
  status?: 'pending' | 'won' | 'lost';
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface BuiltSlipData {
  legs: BuiltSlipLeg[];
  totalOdds: number;
  stake?: number;
  estimatedReturn?: number;
  bookieCode?: string;
  bookieLink?: string;
  bookmaker?: string;
  status?: 'pending' | 'won' | 'lost';
}

export interface BetSlipPost {
  id: string;
  postedBy: string;
  postedByPhone?: string;
  postedByAvatarSeed: number;
  url: string;
  bookmaker?: string;
  isCode?: boolean;
  note: string;
  tags: string[];
  likes: number;
  shares?: number;
  saves?: number;
  likedByMe?: boolean;
  savedByMe?: boolean;
  savedAtTimestamp?: string;
  createdAt: string;
  updatedAt?: string;
  parsed?: ParsedSlip | null;
  parseError?: string;
  builtSlip?: BuiltSlipData | null;
  comments?: { id: string; user: string; text: string; createdAt: string }[];
}

interface BetSlipStoreState {
  posts: BetSlipPost[];
  userLikedIds: Set<string>;
  userSavedIds: Set<string>;
  builderLegs: BuiltSlipLeg[];
  toggleBuilderLeg: (leg: BuiltSlipLeg) => void;
  removeBuilderLeg: (legId: string) => void;
  clearBuilderLegs: () => void;
  setBuilderLegs: (legs: BuiltSlipLeg[]) => void;
  addPost: (data: {
    postedBy: string;
    postedByPhone?: string;
    postedByAvatarSeed: number;
    url: string;
    bookmaker?: string;
    isCode?: boolean;
    note: string;
    tags: string[];
    builtSlip?: BuiltSlipData | null;
  }) => string;
  updateBookieDetails: (
    postId: string,
    details: { bookieCode?: string; bookieLink?: string; bookmaker?: string }
  ) => void;
  setParsed: (postId: string, parsed: ParsedSlip | null, parseError?: string) => void;
  toggleLike: (
    postId: string,
    user?: { phone: string; username: string }
  ) => Promise<{ success: boolean; liked: boolean; error?: string }>;
  toggleSave: (
    postId: string,
    userPhone?: string
  ) => Promise<{ success: boolean; saved: boolean; error?: string }>;
  incrementShare: (postId: string) => void;
  addComment: (postId: string, user: string, text: string) => void;
  initFeedSubscription: () => () => void;
  syncUserEngagements: (userPhone: string) => Promise<void>;
  loadSavedReels: (userPhone: string) => Promise<BetSlipPost[]>;
  isSavedReelsLoading: boolean;
}

const INITIAL_POSTS: BetSlipPost[] = [
  {
    id: 'post-builder-1',
    postedBy: 'Kip_Punter',
    postedByAvatarSeed: 88,
    url: 'SP-99214',
    bookmaker: 'SportPesa',
    isCode: true,
    note: 'Built 3-leg high confidence accumulator with EPL & Champions League value picks! Odds total @ 4.85x.',
    tags: ['Value Pick', 'Bet Builder', 'EPL'],
    likes: 38,
    shares: 12,
    saves: 19,
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    builtSlip: {
      totalOdds: 4.85,
      stake: 500,
      estimatedReturn: 2425,
      bookieCode: 'SP-99214',
      bookmaker: 'SportPesa',
      status: 'pending',
      legs: [
        {
          id: 'leg-1',
          matchId: 'free-m1',
          homeTeam: 'Arsenal',
          awayTeam: 'Coventry City',
          competition: 'English Premier League',
          kickoff: 'Today 22:00 EAT',
          market: 'Match Result (1X2)',
          pick: 'Arsenal Win (1)',
          odds: 1.32,
          status: 'pending',
          homeScore: null,
          awayScore: null,
        },
        {
          id: 'leg-2',
          matchId: 'free-m3',
          homeTeam: 'Sunderland',
          awayTeam: 'Leeds United',
          competition: 'English Championship',
          kickoff: 'Today 17:00 EAT',
          market: 'Over / Under',
          pick: 'Over 2.5 Goals',
          odds: 1.88,
          status: 'pending',
          homeScore: null,
          awayScore: null,
        },
        {
          id: 'leg-3',
          matchId: 'free-m4',
          homeTeam: 'Deportivo Alavés',
          awayTeam: 'Getafe',
          competition: 'Spanish LALIGA',
          kickoff: 'Today 19:00 EAT',
          market: 'Double Chance',
          pick: 'Alavés or Draw (1X)',
          odds: 1.95,
          status: 'pending',
          homeScore: null,
          awayScore: null,
        },
      ],
    },
  },
  {
    id: 'post-1',
    postedBy: 'MwangiPicks',
    postedByAvatarSeed: 12,
    url: 'https://www.betika.com/en-ke/share/slip-771892',
    bookmaker: 'Betika',
    isCode: false,
    note: 'Combined 4 high-probability double chances for tonight.',
    tags: ['Value Pick', 'Multibet'],
    likes: 24,
    shares: 7,
    saves: 11,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    parsed: {
      id: 'parsed-1',
      bookmaker: 'Betika',
      title: 'Betika Multibet Shared Slip',
      sourceUrl: 'https://www.betika.com/en-ke/share/slip-771892',
      summary: 'Betika slip ready to open.',
      selections: [],
      fetchedAt: 'Today 18:30 EAT',
    },
  },
  {
    id: 'post-2',
    postedBy: 'Kamau_Betting',
    postedByAvatarSeed: 45,
    url: 'A8B9C22',
    bookmaker: '22Bet',
    isCode: true,
    note: 'Booking code for 22Bet weekend multibet. Copy and load on 22Bet app!',
    tags: ['Long Shot', '22Bet'],
    likes: 41,
    shares: 15,
    saves: 22,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

export const useBetSlipStore = create<BetSlipStoreState>((set, get) => ({
  posts: INITIAL_POSTS,
  userLikedIds: new Set<string>(),
  userSavedIds: new Set<string>(),
  builderLegs: [],
  isSavedReelsLoading: false,

  toggleBuilderLeg: (leg) => {
    set((state) => {
      const existingIdx = state.builderLegs.findIndex(
        (l) => l.matchId === leg.matchId && l.market === leg.market
      );

      if (existingIdx >= 0) {
        if (state.builderLegs[existingIdx].pick === leg.pick) {
          // Same pick -> toggle off
          return {
            builderLegs: state.builderLegs.filter((_, idx) => idx !== existingIdx),
          };
        }
        // Update pick in market
        const updated = [...state.builderLegs];
        updated[existingIdx] = leg;
        return { builderLegs: updated };
      }

      return { builderLegs: [...state.builderLegs, leg] };
    });
  },

  removeBuilderLeg: (legId) => {
    set((state) => ({
      builderLegs: state.builderLegs.filter((l) => l.id !== legId),
    }));
  },

  clearBuilderLegs: () => {
    set({ builderLegs: [] });
  },

  setBuilderLegs: (legs) => {
    set({ builderLegs: legs });
  },

  addPost: ({ postedBy, postedByPhone, postedByAvatarSeed, url, bookmaker, isCode, note, tags, builtSlip }) => {
    const id = `post-${Date.now().toString(36)}`;
    const safeUrl = isCode
      ? (hasDangerousUrlScheme(url) ? '' : url.trim())
      : (sanitizeExternalHttpUrl(url, { bareDomainToHttps: true }) || '');
    const safeBuiltSlip = builtSlip
      ? {
          ...builtSlip,
          bookieLink: builtSlip.bookieLink
            ? sanitizeExternalHttpUrl(builtSlip.bookieLink, { bareDomainToHttps: true }) || undefined
            : undefined,
        }
      : null;

    const newPost: BetSlipPost = {
      id,
      postedBy,
      postedByPhone,
      postedByAvatarSeed,
      url: safeUrl,
      bookmaker,
      isCode: isCode || !safeUrl,
      note,
      tags,
      builtSlip: safeBuiltSlip,
      likes: 0,
      shares: 0,
      saves: 0,
      createdAt: new Date().toISOString(),
      parsed: undefined,
    };
    set((state) => ({ posts: [newPost, ...state.posts] }));

    // Non-blocking fire-and-forget sync to Cloud Firestore
    persistNewPostToFirestore(newPost).catch((err) => {
      console.warn('[BetSlipStore] Post cloud sync notice:', err);
    });

    return id;
  },

  updateBookieDetails: (postId, { bookieCode, bookieLink, bookmaker }) => {
    const sanitizedLink = bookieLink
      ? sanitizeExternalHttpUrl(bookieLink, { bareDomainToHttps: true }) || undefined
      : undefined;
    const safeCode = bookieCode && !hasDangerousUrlScheme(bookieCode) ? bookieCode.trim() : undefined;

    set((state) => ({
      posts: state.posts.map((p) => {
        if (p.id !== postId) return p;
        const updatedBuilt = p.builtSlip
          ? {
              ...p.builtSlip,
              bookieCode: safeCode || p.builtSlip.bookieCode,
              bookieLink: sanitizedLink || p.builtSlip.bookieLink,
              bookmaker: bookmaker || p.builtSlip.bookmaker,
            }
          : null;
        
        const newUrl = sanitizedLink || safeCode || p.url;
        const isCode = !sanitizedLink && Boolean(safeCode);

        return {
          ...p,
          url: newUrl,
          isCode,
          bookmaker: bookmaker || p.bookmaker,
          builtSlip: updatedBuilt,
        };
      }),
    }));
  },

  setParsed: (postId, parsed, parseError) => {
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId ? { ...p, parsed, parseError } : p
      ),
    }));
  },

  toggleLike: async (postId, user) => {
    let nextLiked = false;
    let originalLiked = false;
    let originalLikes = 0;

    // 1. Optimistic Local State Update
    set((state) => {
      const target = state.posts.find((p) => p.id === postId);
      if (!target) return state;

      originalLiked = Boolean(target.likedByMe);
      originalLikes = target.likes;
      nextLiked = !originalLiked;
      const nextLikes = nextLiked ? originalLikes + 1 : Math.max(0, originalLikes - 1);

      const nextLikedIds = new Set(state.userLikedIds);
      if (nextLiked) {
        nextLikedIds.add(postId);
      } else {
        nextLikedIds.delete(postId);
      }

      return {
        userLikedIds: nextLikedIds,
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, likedByMe: nextLiked, likes: nextLikes } : p
        ),
      };
    });

    // 2. Cloud Firestore Atomic Persistence
    if (user && user.phone) {
      const res = await persistPostLike(postId, user, nextLiked);
      if (!res.success) {
        // Rollback optimistic update on failure
        set((state) => {
          const rollbackLikedIds = new Set(state.userLikedIds);
          if (originalLiked) {
            rollbackLikedIds.add(postId);
          } else {
            rollbackLikedIds.delete(postId);
          }

          return {
            userLikedIds: rollbackLikedIds,
            posts: state.posts.map((p) =>
              p.id === postId ? { ...p, likedByMe: originalLiked, likes: originalLikes } : p
            ),
          };
        });
        return { success: false, liked: originalLiked, error: res.error };
      }
    }

    return { success: true, liked: nextLiked };
  },

  toggleSave: async (postId, userPhone) => {
    let nextSaved = false;
    let originalSaved = false;
    let originalSaves = 0;

    // 1. Optimistic Local State Update
    set((state) => {
      const target = state.posts.find((p) => p.id === postId);
      if (!target) return state;

      originalSaved = Boolean(target.savedByMe);
      originalSaves = target.saves ?? 0;
      nextSaved = !originalSaved;
      const nextSaves = nextSaved ? originalSaves + 1 : Math.max(0, originalSaves - 1);

      const nextSavedIds = new Set(state.userSavedIds);
      if (nextSaved) {
        nextSavedIds.add(postId);
      } else {
        nextSavedIds.delete(postId);
      }

      return {
        userSavedIds: nextSavedIds,
        posts: state.posts.map((p) =>
          p.id === postId
            ? {
                ...p,
                savedByMe: nextSaved,
                saves: nextSaves,
                savedAtTimestamp: nextSaved ? new Date().toISOString() : undefined,
              }
            : p
        ),
      };
    });

    // 2. Cloud Firestore Atomic Persistence
    if (userPhone) {
      const res = await persistPostSave(postId, userPhone, nextSaved);
      if (!res.success) {
        // Rollback optimistic update on failure
        set((state) => {
          const rollbackSavedIds = new Set(state.userSavedIds);
          if (originalSaved) {
            rollbackSavedIds.add(postId);
          } else {
            rollbackSavedIds.delete(postId);
          }

          return {
            userSavedIds: rollbackSavedIds,
            posts: state.posts.map((p) =>
              p.id === postId ? { ...p, savedByMe: originalSaved, saves: originalSaves } : p
            ),
          };
        });
        return { success: false, saved: originalSaved, error: res.error };
      }
    }

    return { success: true, saved: nextSaved };
  },

  incrementShare: (postId) => {
    set((state) => ({
      posts: state.posts.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          shares: (p.shares ?? 0) + 1,
        };
      }),
    }));
  },

  addComment: (postId, user, text) => {
    set((state) => ({
      posts: state.posts.map((p) => {
        if (p.id !== postId) return p;
        const newComment = {
          id: `c-${Date.now().toString(36)}`,
          user,
          text,
          createdAt: 'Just now',
        };
        return {
          ...p,
          comments: [...(p.comments || []), newComment],
        };
      }),
    }));
  },

  initFeedSubscription: () => {
    return subscribeToCommunityPosts(
      (cloudPosts) => {
        const { userLikedIds, userSavedIds, posts: existingPosts } = get();
        // Preserve any previously resolved saved reels that may not be in the recent feed window
        const savedNotInFeed = existingPosts.filter(
          (ep) => userSavedIds.has(ep.id) && !cloudPosts.some((cp) => cp.id === ep.id)
        );

        const reconciled = [...cloudPosts, ...savedNotInFeed].map((p) => ({
          ...p,
          likedByMe: userLikedIds.has(p.id),
          savedByMe: userSavedIds.has(p.id),
        }));
        set({ posts: reconciled });
      },
      INITIAL_POSTS
    );
  },

  syncUserEngagements: async (userPhone) => {
    if (!userPhone) return;
    try {
      const [{ likedPostIds, savedPostIds }, resolvedSavedReels] = await Promise.all([
        fetchUserEngagementMap(userPhone),
        resolveSavedReels(userPhone, get().posts),
      ]);

      const currentPosts = get().posts;
      const postMap = new Map<string, BetSlipPost>();
      currentPosts.forEach((p) => postMap.set(p.id, p));

      // Merge resolved saved reels into store
      resolvedSavedReels.forEach((sp) => {
        postMap.set(sp.id, {
          ...sp,
          savedByMe: true,
          likedByMe: likedPostIds.has(sp.id),
        });
      });

      const mergedPosts = Array.from(postMap.values()).map((p) => ({
        ...p,
        likedByMe: likedPostIds.has(p.id),
        savedByMe: savedPostIds.has(p.id),
      }));

      set({
        userLikedIds: likedPostIds,
        userSavedIds: savedPostIds,
        posts: mergedPosts,
      });
    } catch (err) {
      console.warn('[BetSlipStore] Engagement hydration notice:', err);
    }
  },

  loadSavedReels: async (userPhone) => {
    if (!userPhone) return [];
    set({ isSavedReelsLoading: true });
    try {
      const resolved = await resolveSavedReels(userPhone, get().posts);
      set((state) => {
        const postMap = new Map<string, BetSlipPost>(state.posts.map((p) => [p.id, p]));
        resolved.forEach((sp) => {
          postMap.set(sp.id, { ...sp, savedByMe: true });
        });

        const nextSavedIds = new Set(state.userSavedIds);
        resolved.forEach((sp) => nextSavedIds.add(sp.id));

        return {
          posts: Array.from(postMap.values()),
          userSavedIds: nextSavedIds,
          isSavedReelsLoading: false,
        };
      });
      return resolved;
    } catch (err) {
      console.warn('[BetSlipStore] Error loading saved reels:', err);
      set({ isSavedReelsLoading: false });
      return [];
    }
  },
}));
