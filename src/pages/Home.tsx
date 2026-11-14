import React, { useState, useEffect, useSyncExternalStore, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Play, Clock, MessageSquare, Heart } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import {
  subscribeToHomepageFeed,
  getHomepageFeedSnapshot,
  refreshHomepageFeed,
  toggleHomepagePostLike,
  getActiveCarouselItems,
  getAuthoritativeNowMs,
  type HomepageCarouselItem,
  type HomepageVideoItem,
} from '../lib/homepageFeedStore';
import {
  subscribeToFreeMatches,
  getFreeMatchesSnapshot,
  refreshFreeMatches,
  freeMatchConsensus,
  type FreeMatch,
} from '../lib/freeMatches';
import {
  sortHighlightsComparator,
  formatKickoffDateTime24h,
} from '../lib/competitionPriority';
import { useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';
import { EditorialCarouselSkeleton } from '../components/skeleton';
import {
  CAROUSEL_BATCH_SIZE,
  loadCarouselInBatchesOfThree,
  preloadCarouselStoryItem,
  preloadCarouselImage,
} from '../lib/carouselImagePreloader';
import {
  getReadyCarouselRenderUrl,
  isCarouselItemImageReady,
  pruneCarouselImageCache,
} from '../lib/carouselImageCache';
import FixtureSportCard from '../components/FixtureSportCard';
import QuickBetBuilderModal, { type MatchForBuilder } from '../components/QuickBetBuilderModal';
import { useBetSlipStore } from '../lib/betSlipStore';
import { showToast } from '../lib/notificationStore';
import { useHistoryPageState } from '../lib/navigationHistory';
import { sanitizeExternalHttpUrl } from '../lib/urlSecurity';

/** Authoritative 10-second automatic transition interval per slide (10,000 ms). */
export const CAROUSEL_AUTO_ADVANCE_MS = 10_000;
const CAROUSEL_FADE_HALF_MS = 400;

interface CommittedCarouselSlide {
  item: HomepageCarouselItem;
  renderUrl: string;
}

let hasHomeCarouselInitiallyLoaded = false;

/**
 * Extracts standard 11-character YouTube video ID from various URL formats
 */
function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:embed\/|v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function resolveVideoPlayerSrc(video: HomepageVideoItem, videoId: string | null): string | null {
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1`;
  }
  const safeEmbedUrl = sanitizeExternalHttpUrl(video.embedUrl);
  if (!safeEmbedUrl) return null;
  return safeEmbedUrl.includes('?')
    ? `${safeEmbedUrl}&autoplay=1&playsinline=1`
    : `${safeEmbedUrl}?autoplay=1&playsinline=1`;
}

export default function Home() {
  // Subscribe to live homepage feed store
  const feed = useSyncExternalStore(
    subscribeToHomepageFeed,
    getHomepageFeedSnapshot,
    getHomepageFeedSnapshot
  );

  const currentUser = useCurrentUser();
  const openAuthWall = useAuthWallStore((s) => s.openAuthWall);

  // Server-authoritative clock state for accurate 24-hour story countdowns & immediate expiration
  const [authoritativeNowMs, setAuthoritativeNowMs] = useState<number>(() => getAuthoritativeNowMs());

  const publishedPhotos = useMemo(() => {
    return getActiveCarouselItems(feed, authoritativeNowMs);
  }, [feed, authoritativeNowMs]);

  // Tick authoritative clock every second when carousel posts exist (paused while tab/PWA is hidden)
  useEffect(() => {
    setAuthoritativeNowMs(getAuthoritativeNowMs());
    if (feed.carouselItems.length === 0) return;

    let tickTimer: ReturnType<typeof setInterval> | null = null;
    const startTick = () => {
      if (tickTimer) clearInterval(tickTimer);
      tickTimer = setInterval(() => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') {
          setAuthoritativeNowMs(getAuthoritativeNowMs());
        }
      }, 1000);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        setAuthoritativeNowMs(getAuthoritativeNowMs());
      }
    };

    startTick();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      if (tickTimer) clearInterval(tickTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [feed.carouselItems.length]);

  const publishedVideos = useMemo(() => {
    return feed.videoItems
      .filter(
        (v) =>
          v.published &&
          v.isActive !== false &&
          v.status !== 'archived' &&
          !['video-1', 'video-2'].includes(v.id) &&
          !v.youtubeUrl?.includes('aqz-KE-bpKQ') &&
          !v.youtubeUrl?.includes('kJQP7kiw5Fk')
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [feed.videoItems]);

  // Track whether initial feed lookup has settled so we never dismiss the initial skeleton prematurely
  const [isInitialFeedResolved, setIsInitialFeedResolved] = useState<boolean>(
    () => hasHomeCarouselInitiallyLoaded || publishedPhotos.length > 0
  );

  // Proactively sync homepage feed on mount across all visitors, devices, and versions
  useEffect(() => {
    let mounted = true;
    const safetyTimer = setTimeout(() => {
      if (mounted) setIsInitialFeedResolved(true);
    }, 4500);

    refreshHomepageFeed()
      .catch(() => {})
      .finally(() => {
        clearTimeout(safetyTimer);
        if (mounted) {
          setAuthoritativeNowMs(getAuthoritativeNowMs());
          setIsInitialFeedResolved(true);
        }
      });

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Subscribe to live Free Matches store for popular top fixtures
  const allFreeMatches = useSyncExternalStore(
    subscribeToFreeMatches,
    getFreeMatchesSnapshot,
    getFreeMatchesSnapshot
  );

  // Sync free matches on mount if cache is not populated
  useEffect(() => {
    if (allFreeMatches.length === 0) {
      refreshFreeMatches().catch(() => {});
    }
  }, [allFreeMatches.length]);

  // Top 5 Highlighted Fixtures sorted by popularity
  const topFixtures = useMemo(() => {
    return [...allFreeMatches]
      .filter((m) => m && m.id && m.home && m.away)
      .sort(sortHighlightsComparator)
      .slice(0, 5);
  }, [allFreeMatches]);

  // Bet slip store legs and toggle handler for full-size desktop FixtureSportCard
  const builderLegs = useBetSlipStore((s) => s.builderLegs);
  const toggleBuilderLeg = useBetSlipStore((s) => s.toggleBuilderLeg);
  const [selectedMatchForBuilder, setSelectedMatchForBuilder] = useState<MatchForBuilder | null>(null);

  const handleToggleLeg = (match: FreeMatch, market: string, pick: string, odds: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) {
      openAuthWall({
        actionType: 'builder_pick',
        title: 'Sign In to Make Selections',
        message: 'Sign up or log in to select market odds and add selections to your Bet Builder slip.',
      });
      return;
    }

    const legId = `${match.id}-${market}-${pick}`;
    const exists = builderLegs.some((l) => l.id === legId);

    toggleBuilderLeg({
      id: legId,
      matchId: match.id,
      homeTeam: match.home,
      awayTeam: match.away,
      competition: match.competition,
      kickoff: match.kickoff,
      market,
      pick,
      odds,
      status: 'pending',
    });

    if (exists) {
      showToast({ type: 'info', title: 'Pick Removed', message: `Removed ${pick} from Bet Builder` });
    } else {
      showToast({ type: 'success', title: 'Added to Bet Builder!', message: `Added ${pick} (@ ${odds.toFixed(2)}x)` });
    }
  };

  // Minimalistic video likes state persisted in localStorage
  const [likedVideoIds, setLikedVideoIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('mshindi_liked_videos');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleToggleLikeVideo = (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLikedVideoIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      try {
        localStorage.setItem('mshindi_liked_videos', JSON.stringify([...next]));
      } catch {}
      return next;
    });
    toggleHomepagePostLike(videoId, currentUser?.phone || 'visitor').catch(() => {});
  };

  // Active Carousel Slide Index — preserved per history entry
  const [activeCarouselIndex, setActiveCarouselIndex] = useHistoryPageState<number>('home_carouselIdx', 0);

  // Initial load state: show EditorialCarouselSkeleton ONLY once on first load until the first batch
  // of up to 3 active photographs (`CAROUSEL_BATCH_SIZE = 3`) is downloaded, decoded, and cached.
  // Never show another full skeleton between subsequent batches or slide transitions.
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState<boolean>(() => {
    if (!hasHomeCarouselInitiallyLoaded) return false;
    if (publishedPhotos.length === 0) return true;
    return publishedPhotos.some((item) => isCarouselItemImageReady(item));
  });

  // Atomic committed slide state: guarantees photograph and caption ALWAYS belong to the exact same post
  // and transition together only after the target photograph has loaded and decoded.
  const [displayedSlide, setDisplayedSlide] = useState<CommittedCarouselSlide | null>(() => {
    if (publishedPhotos.length === 0) return null;
    const safeIdx = activeCarouselIndex >= 0 && activeCarouselIndex < publishedPhotos.length ? activeCarouselIndex : 0;
    const candidate = publishedPhotos[safeIdx] || publishedPhotos[0];
    const readyUrl = candidate ? getReadyCarouselRenderUrl(candidate) : null;
    if (candidate && readyUrl) {
      return { item: candidate, renderUrl: readyUrl };
    }
    const fallbackReady = publishedPhotos.find((p) => getReadyCarouselRenderUrl(p) !== null);
    if (fallbackReady) {
      const fbUrl = getReadyCarouselRenderUrl(fallbackReady);
      if (fbUrl) return { item: fallbackReady, renderUrl: fbUrl };
    }
    return null;
  });

  const [isCarouselFading, setIsCarouselFading] = useState(false);
  const [indicatorGlide, setIndicatorGlide] = useState<{
    step: number;
    direction: 'next' | 'prev' | null;
    targetIdx: number;
  }>(() => ({
    step: 0,
    direction: null,
    targetIdx: activeCarouselIndex >= 0 ? activeCarouselIndex : 0,
  }));
  const isTransitioningRef = useRef(false);
  const transitionTokenRef = useRef(0);
  const activeIndexRef = useRef(activeCarouselIndex);
  const publishedPhotosRef = useRef<HomepageCarouselItem[]>(publishedPhotos);
  const displayedSlideRef = useRef<CommittedCarouselSlide | null>(displayedSlide);
  const knownPostIdsRef = useRef<Set<string>>(new Set());
  const hasSeededKnownIdsRef = useRef(false);

  // Timer management refs for 10-second auto-advance (tab-switch & PWA-minimize aware, zero overlap)
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideStartedAtMsRef = useRef<number>(Date.now());
  const accumulatedSlideMsRef = useRef<number>(0);

  useEffect(() => {
    activeIndexRef.current = activeCarouselIndex;
  }, [activeCarouselIndex]);

  useEffect(() => {
    publishedPhotosRef.current = publishedPhotos;
  }, [publishedPhotos]);

  useEffect(() => {
    displayedSlideRef.current = displayedSlide;
  }, [displayedSlide]);

  // Progressive 3-by-3 batch loading:
  // 1. Downloads, decodes & caches first 3 images before removing initial EditorialCarouselSkeleton.
  // 2. Continues downloading remaining images in background batches of 3 (`3..5`, `6..8`, ...).
  // 3. Prunes expired/replaced image cache entries automatically.
  const progressiveFeedSignature = useMemo(
    () => publishedPhotos.map((p) => `${p.id}:${p.imageVersion || p.imageUrl}`).join('|'),
    [publishedPhotos]
  );
  const isEmptyFeedConfirmed = isInitialFeedResolved && publishedPhotos.length === 0;

  useEffect(() => {
    if (publishedPhotos.length === 0) {
      if (!isEmptyFeedConfirmed) {
        return;
      }
      hasHomeCarouselInitiallyLoaded = true;
      setHasInitiallyLoaded(true);
      setDisplayedSlide(null);
      void pruneCarouselImageCache([]);
      return;
    }

    const abortController = new AbortController();

    void loadCarouselInBatchesOfThree(publishedPhotos, {
      signal: abortController.signal,
      onInitialBatchReady: (firstBatchResults) => {
        if (abortController.signal.aborted) return;

        // Seed initial committed slide if none is displayed yet
        if (!displayedSlideRef.current) {
          const latestList = publishedPhotosRef.current;
          const desiredIdx =
            activeIndexRef.current >= 0 && activeIndexRef.current < latestList.length
              ? activeIndexRef.current
              : 0;
          const chosenIdx = desiredIdx < firstBatchResults.length ? desiredIdx : 0;
          const chosenItem = latestList[chosenIdx] || latestList[0];
          if (chosenItem) {
            const readyUrl =
              getReadyCarouselRenderUrl(chosenItem) ||
              firstBatchResults[chosenIdx]?.renderUrl ||
              chosenItem.imageUrl;
            const committed: CommittedCarouselSlide = { item: chosenItem, renderUrl: readyUrl };
            displayedSlideRef.current = committed;
            setDisplayedSlide(committed);
            setActiveCarouselIndex(chosenIdx);
            slideStartedAtMsRef.current = Date.now();
            accumulatedSlideMsRef.current = 0;
          }
        }

        if (!hasSeededKnownIdsRef.current) {
          knownPostIdsRef.current = new Set(publishedPhotosRef.current.map((p) => p.id));
          hasSeededKnownIdsRef.current = true;
        }

        hasHomeCarouselInitiallyLoaded = true;
        setHasInitiallyLoaded(true);
      },
    });

    return () => {
      abortController.abort();
    };
  }, [isEmptyFeedConfirmed, progressiveFeedSignature, setActiveCarouselIndex]);

  /**
   * Transitions to `targetIdx` ONLY once the target slide's photograph has finished loading & decoding.
   * Retains the current photograph + caption while waiting so a new caption NEVER renders over an old photo.
   */
  const goToSlide = useCallback(
    async (
      targetIdx: number,
      options?: { forceImmediateNewStory?: boolean; direction?: 'next' | 'prev' }
    ) => {
      const list = publishedPhotosRef.current;
      if (list.length === 0) return;

      const normalizedIdx = ((targetIdx % list.length) + list.length) % list.length;
      const targetPhoto = list[normalizedIdx];
      if (!targetPhoto) return;

      const currentCommitted = displayedSlideRef.current;
      if (
        !options?.forceImmediateNewStory &&
        currentCommitted &&
        currentCommitted.item.id === targetPhoto.id &&
        currentCommitted.item.imageVersion === targetPhoto.imageVersion
      ) {
        return;
      }

      const requestToken = ++transitionTokenRef.current;

      // Ensure target image is downloaded, cached in Cache Storage, and hardware-decoded BEFORE swapping
      let resolvedRenderUrl = getReadyCarouselRenderUrl(targetPhoto);
      if (!resolvedRenderUrl) {
        const loadRes = await preloadCarouselStoryItem(targetPhoto, 'high');
        if (requestToken !== transitionTokenRef.current) {
          return; // Superseded by newer navigation or live push
        }
        if (!loadRes.ok && list.length > 1 && !options?.forceImmediateNewStory) {
          // Gracefully skip broken image without blocking the carousel
          const fallbackIdx = (normalizedIdx + 1) % list.length;
          if (fallbackIdx !== normalizedIdx) {
            const fallbackItem = list[fallbackIdx];
            const fallbackReady = fallbackItem ? getReadyCarouselRenderUrl(fallbackItem) : null;
            if (fallbackItem && fallbackReady) {
              resolvedRenderUrl = fallbackReady;
              return goToSlide(fallbackIdx, { direction: options?.direction || 'next' });
            }
          }
        }
        resolvedRenderUrl = loadRes.renderUrl || targetPhoto.imageUrl;
      }

      // Re-verify target post is still unexpired in the latest active list
      const latestList = publishedPhotosRef.current;
      const latestMatchIdx = latestList.findIndex((p) => p.id === targetPhoto.id);
      if (latestMatchIdx === -1) {
        if (latestList.length > 0) {
          void goToSlide(0, { forceImmediateNewStory: true, direction: 'next' });
        }
        return;
      }
      const freshestTarget = latestList[latestMatchIdx];

      const resolvedDirection: 'next' | 'prev' =
        options?.direction ||
        (latestList.length > 1 &&
        latestMatchIdx === (activeIndexRef.current - 1 + latestList.length) % latestList.length
          ? 'prev'
          : 'next');

      isTransitioningRef.current = true;
      setIsCarouselFading(true);
      setIndicatorGlide((prev) => ({
        step: prev.step + (resolvedDirection === 'next' ? 1 : -1),
        direction: resolvedDirection,
        targetIdx: latestMatchIdx,
      }));

      setTimeout(() => {
        if (requestToken !== transitionTokenRef.current) {
          setIsCarouselFading(false);
          isTransitioningRef.current = false;
          return;
        }

        const nextCommitted: CommittedCarouselSlide = {
          item: freshestTarget,
          renderUrl: resolvedRenderUrl || freshestTarget.imageUrl,
        };
        displayedSlideRef.current = nextCommitted;
        setDisplayedSlide(nextCommitted);
        setActiveCarouselIndex(latestMatchIdx);
        setIsCarouselFading(false);

        // Reset 10-second slide visibility window from the moment the new slide appears
        slideStartedAtMsRef.current = Date.now();
        accumulatedSlideMsRef.current = 0;

        // Preload & decode the upcoming slide in advance
        const upcoming = publishedPhotosRef.current[(latestMatchIdx + 1) % publishedPhotosRef.current.length];
        if (upcoming) {
          void preloadCarouselImage(upcoming.imageUrl, 'high', upcoming.imageVersion);
        }

        setTimeout(() => {
          if (requestToken === transitionTokenRef.current) {
            isTransitioningRef.current = false;
          }
        }, CAROUSEL_FADE_HALF_MS);
      }, CAROUSEL_FADE_HALF_MS);
    },
    [setActiveCarouselIndex]
  );

  // Reconcile live updates:
  // - New admin story published -> make Slide 0 immediately once decoded without reloading page
  // - Caption edited on active story -> update caption atomically in place
  // - Photo replaced on active story -> decode replacement image first, then swap atomically
  // - Active story expired or deleted -> advance immediately to next active story
  useEffect(() => {
    if (!hasInitiallyLoaded) return;

    if (publishedPhotos.length === 0) {
      displayedSlideRef.current = null;
      setDisplayedSlide(null);
      knownPostIdsRef.current.clear();
      return;
    }

    const topStory = publishedPhotos[0];
    if (
      hasSeededKnownIdsRef.current &&
      topStory &&
      !knownPostIdsRef.current.has(topStory.id)
    ) {
      knownPostIdsRef.current = new Set(publishedPhotos.map((p) => p.id));
      void goToSlide(0, { forceImmediateNewStory: true });
      return;
    }
    knownPostIdsRef.current = new Set(publishedPhotos.map((p) => p.id));

    const current = displayedSlideRef.current;
    if (!current) {
      void goToSlide(0, { forceImmediateNewStory: true });
      return;
    }

    const matchingIdx = publishedPhotos.findIndex((p) => p.id === current.item.id);
    if (matchingIdx === -1) {
      // Currently displayed story expired or was deleted: transition immediately
      const fallbackIdx = Math.min(activeIndexRef.current, publishedPhotos.length - 1);
      void goToSlide(Math.max(0, fallbackIdx), { forceImmediateNewStory: true });
      return;
    }

    if (matchingIdx !== activeIndexRef.current) {
      setActiveCarouselIndex(matchingIdx);
    }

    const updatedItem = publishedPhotos[matchingIdx];
    if (updatedItem.imageVersion !== current.item.imageVersion || updatedItem.imageUrl !== current.item.imageUrl) {
      // Admin replaced the photograph on the active slide: decode new photo before swapping
      void preloadCarouselStoryItem(updatedItem, 'high').then((res) => {
        if (displayedSlideRef.current?.item.id === updatedItem.id) {
          const nextCommitted: CommittedCarouselSlide = {
            item: updatedItem,
            renderUrl: res.renderUrl || updatedItem.imageUrl,
          };
          displayedSlideRef.current = nextCommitted;
          setDisplayedSlide(nextCommitted);
          void pruneCarouselImageCache(publishedPhotosRef.current);
        }
      });
    } else if (
      updatedItem.heading !== current.item.heading ||
      updatedItem.caption !== current.item.caption ||
      updatedItem.source !== current.item.source ||
      updatedItem.link !== current.item.link ||
      updatedItem.expiresAt !== current.item.expiresAt
    ) {
      // Metadata-only edit on active slide: update text in place without re-downloading image
      const nextCommitted: CommittedCarouselSlide = {
        item: updatedItem,
        renderUrl: current.renderUrl,
      };
      displayedSlideRef.current = nextCommitted;
      setDisplayedSlide(nextCommitted);
    }
  }, [publishedPhotos, hasInitiallyLoaded, goToSlide, setActiveCarouselIndex]);

  // Active playing video ID (thumbnail-first playback)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // Committed Active Photo & Synchronized Metadata
  const currentPhoto = displayedSlide?.item || null;
  const currentRenderImageUrl = displayedSlide?.renderUrl || currentPhoto?.imageUrl || '';

  // Carousel Next / Prev Navigation
  const nextSlide = useCallback(() => {
    if (publishedPhotosRef.current.length > 1 && !isTransitioningRef.current) {
      void goToSlide((activeIndexRef.current + 1) % publishedPhotosRef.current.length, {
        direction: 'next',
      });
    }
  }, [goToSlide]);

  const prevSlide = useCallback(() => {
    if (publishedPhotosRef.current.length > 1 && !isTransitioningRef.current) {
      void goToSlide(
        (activeIndexRef.current - 1 + publishedPhotosRef.current.length) %
          publishedPhotosRef.current.length,
        { direction: 'prev' }
      );
    }
  }, [goToSlide]);

  // Carousel Touch Swipe Listeners
  const carouselTouchStartX = useRef<number | null>(null);
  const carouselTouchEndX = useRef<number | null>(null);
  const minSwipeDistance = 45;

  const handleCarouselTouchStart = (e: React.TouchEvent) => {
    carouselTouchEndX.current = null;
    carouselTouchStartX.current = e.targetTouches[0].clientX;
  };

  const handleCarouselTouchMove = (e: React.TouchEvent) => {
    carouselTouchEndX.current = e.targetTouches[0].clientX;
  };

  const handleCarouselTouchEnd = () => {
    if (carouselTouchStartX.current === null || carouselTouchEndX.current === null) return;
    const distance = carouselTouchStartX.current - carouselTouchEndX.current;
    if (distance > minSwipeDistance) {
      nextSlide();
    } else if (distance < -minSwipeDistance) {
      prevSlide();
    }
  };

  // 10-Second Automatic Carousel Transition Timer (Single non-overlapping controller, visibility-aware)
  useEffect(() => {
    const clearAutoTimer = () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };

    if (!hasInitiallyLoaded || publishedPhotos.length <= 1 || !currentPhoto) {
      clearAutoTimer();
      return;
    }

    const scheduleNextAdvance = (delayMs: number) => {
      clearAutoTimer();
      slideStartedAtMsRef.current = Date.now();
      autoAdvanceTimerRef.current = setTimeout(async () => {
        autoAdvanceTimerRef.current = null;
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        const total = publishedPhotosRef.current.length;
        if (total > 1) {
          await goToSlide((activeIndexRef.current + 1) % total, { direction: 'next' });
        }
      }, delayMs);
    };

    const elapsedInCurrentSlice = Math.max(0, Date.now() - slideStartedAtMsRef.current);
    const totalElapsed = accumulatedSlideMsRef.current + elapsedInCurrentSlice;
    const initialRemaining = Math.max(1500, CAROUSEL_AUTO_ADVANCE_MS - totalElapsed);

    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      scheduleNextAdvance(
        totalElapsed >= CAROUSEL_AUTO_ADVANCE_MS ? CAROUSEL_AUTO_ADVANCE_MS : initialRemaining
      );
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        accumulatedSlideMsRef.current += Math.max(0, Date.now() - slideStartedAtMsRef.current);
        clearAutoTimer();
      } else {
        const remaining = Math.max(1500, CAROUSEL_AUTO_ADVANCE_MS - accumulatedSlideMsRef.current);
        scheduleNextAdvance(Math.min(CAROUSEL_AUTO_ADVANCE_MS, remaining));
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      clearAutoTimer();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [hasInitiallyLoaded, publishedPhotos.length, currentPhoto?.id, activeCarouselIndex, goToSlide]);

  // Outside Tap (Not Scroll) Detection to Pause Active Video & Return Mshindi Play Button
  useEffect(() => {
    if (!activeVideoId) return;

    let pointerStartX = 0;
    let pointerStartY = 0;
    let hasScrolled = false;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
      pointerStartX = x;
      pointerStartY = y;
      hasScrolled = false;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
      if (Math.hypot(x - pointerStartX, y - pointerStartY) > 10) {
        hasScrolled = true;
      }
    };

    const onPointerUp = (e: MouseEvent | TouchEvent) => {
      if (hasScrolled) return; // User was scrolling, do not pause

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isInside = target.closest(`[data-video-card-id="${activeVideoId}"]`);
      if (!isInside) {
        setActiveVideoId(null);
      }
    };

    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp, { passive: true });
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mouseup', onPointerUp);

    return () => {
      window.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mouseup', onPointerUp);
    };
  }, [activeVideoId]);

  // Video Play Click Handler
  const handlePlayVideo = (video: HomepageVideoItem) => {
    if (!currentUser) {
      openAuthWall({
        actionType: 'video',
        title: 'Sign In to Play Highlights',
        message: 'Sign up or log in to stream full match video highlights, press conferences, and tactical reviews.',
      });
      return;
    }
    setActiveVideoId(video.id);
  };

  return (
    <div className="bg-[#FFFFF0] dark:bg-[#202522] text-slate-900 dark:text-[#F4F5EF] min-h-screen">
      <SeoHead
        title="MshindiRoom — Kenya's Premier Sports Consensus & Jackpot Arena"
        description="Pool consensus with Kenya's top punters for SportPesa Mega Jackpot, Betika Midweek & Mozzart Daily. View crowd picks, share bet slips & track bookie predictions."
        canonicalUrl="https://mshindi.co.ke/"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "MshindiRoom",
          "url": "https://mshindi.co.ke/",
          "description": "Kenya's Premier Jackpot Consensus & Football Community Platform",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://mshindi.co.ke/free?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }}
      />

      {/* =========================================================================
          1. WEEKLY EDITORIAL NEWS (REDESIGNED CAROUSEL CONSOLE)
          - Uniform faded green background (#02241b) across the entire section
          - Edge-to-edge full width with NO borders, hugging top & bottom separator
          - 'Weekly Editorial' in pure white with no background/border
          - Left: 3:4 active photo alone with smoothly faded edges & dots below
          - Right: Big news heading on top of the smaller caption text
          - Mobile: Side-by-side (photo on left, text on right) with proportional text
          ========================================================================= */}
      {!hasInitiallyLoaded ? (
        <section className="theme-protected w-full bg-[#02241b] text-white">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pt-4 pb-4 sm:pt-6 sm:pb-16 relative overflow-hidden">
            <div className="text-left mb-3 sm:mb-10 relative z-10 px-1 sm:px-0">
              <span className="text-white font-bold text-xs uppercase tracking-wider block mb-1">
                Weekly Editorial
              </span>
              <h1 className="font-extrabold text-xl sm:text-3xl lg:text-4xl text-white tracking-tight">
                Top Stories &amp; Matchday Perspectives
              </h1>
            </div>
            <EditorialCarouselSkeleton />
          </div>
        </section>
      ) : publishedPhotos.length > 0 && currentPhoto ? (
        <section className="theme-protected w-full bg-[#02241b] text-white">
          <div
            className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 pt-4 pb-4 sm:pt-6 sm:pb-16 relative overflow-hidden"
            onTouchStart={handleCarouselTouchStart}
            onTouchMove={handleCarouselTouchMove}
            onTouchEnd={handleCarouselTouchEnd}
          >
            {/* Section Heading in Crisp White with NO background and NO border */}
            <div className="text-left mb-3 sm:mb-10 relative z-10 px-1 sm:px-0">
              <span className="text-white font-bold text-xs uppercase tracking-wider block mb-1">
                Weekly Editorial
              </span>
              <h1 className="font-extrabold text-xl sm:text-3xl lg:text-4xl text-white tracking-tight">
                Top Stories &amp; Matchday Perspectives
              </h1>
            </div>

            {/* Desktop: Caption hugs photo with controlled allowance; Mobile: compact 1-screen fit */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:gap-6 lg:gap-7 relative z-10 animate-editorial-fade-in">
              {/* PHOTO CONTAINER: Compact on mobile for 1-screen fit, neatly hugging text on desktop */}
              <div className="w-full sm:w-auto sm:shrink-0 flex flex-col items-start px-1 sm:px-0">
                <div
                  className={`relative w-[180px] xs:w-[200px] sm:w-[280px] lg:w-[320px] aspect-[3/4] min-h-0 sm:min-h-[360px] lg:min-h-[415px] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.65)] bg-[#06372a] transition-opacity duration-500 ease-in-out ${
                    isCarouselFading ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  {/* Active Photo: Strictly from committed decoded cache entry, synchronized atomically with caption */}
                  <img
                    src={currentRenderImageUrl}
                    alt={currentPhoto.heading || currentPhoto.caption || 'Active carousel story'}
                    loading="eager"
                    decoding="async"
                    sizes="(max-width: 640px) 200px, (max-width: 1024px) 280px, 320px"
                    className="w-full h-full object-cover"
                  />

                  {/* Subtle inner border for crisp edge definition without fading */}
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl sm:rounded-2xl lg:rounded-3xl pointer-events-none" />
                </div>

                {/* Stories Gliding Indicator Dots (Max 3 regardless of active count, middle as main active indicator) */}
                {publishedPhotos.length > 1 && (
                  <div className="mt-2 overflow-hidden px-0.5 py-0.5">
                    {publishedPhotos.length === 2 ? (
                      <div className="flex items-center gap-1.5" role="tablist" aria-label="Carousel stories">
                        {publishedPhotos.map((story, idx) => {
                          const isCurrent =
                            isCarouselFading
                              ? indicatorGlide.targetIdx === idx
                              : story.id === currentPhoto.id;
                          return (
                            <button
                              key={story.id}
                              type="button"
                              role="tab"
                              aria-selected={isCurrent}
                              aria-label={`Story ${idx + 1} of 2`}
                              onClick={() => {
                                if (!isCurrent && !isTransitioningRef.current) {
                                  void goToSlide(idx, {
                                    direction: idx > activeCarouselIndex ? 'next' : 'prev',
                                  });
                                }
                              }}
                              className={`carousel-glide-dot h-1.5 rounded-full cursor-pointer ${
                                isCurrent
                                  ? 'w-5 bg-[#D4AF37]'
                                  : 'w-1.5 bg-white/30 hover:bg-white/55'
                              }`}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        role="tablist"
                        aria-label="Carousel stories"
                        className={`flex items-center gap-1.5 ${
                          indicatorGlide.direction === 'next'
                            ? Math.abs(indicatorGlide.step) % 2 === 0
                              ? 'carousel-dots-glide-next-a'
                              : 'carousel-dots-glide-next-b'
                            : indicatorGlide.direction === 'prev'
                            ? Math.abs(indicatorGlide.step) % 2 === 0
                              ? 'carousel-dots-glide-prev-a'
                              : 'carousel-dots-glide-prev-b'
                            : ''
                        }`}
                      >
                        {([-1, 0, 1] as const).map((slotOffset) => {
                          const virtualKey = indicatorGlide.step + slotOffset;
                          const isMainCenter = slotOffset === 0;
                          const isEnteringEdge =
                            (indicatorGlide.direction === 'next' && slotOffset === 1) ||
                            (indicatorGlide.direction === 'prev' && slotOffset === -1);

                          return (
                            <button
                              key={`glide-dot-${virtualKey}`}
                              type="button"
                              role="tab"
                              aria-selected={isMainCenter}
                              aria-label={
                                slotOffset === -1
                                  ? 'Previous story'
                                  : slotOffset === 1
                                  ? 'Next story'
                                  : `Current story (${activeCarouselIndex + 1} of ${publishedPhotos.length})`
                              }
                              onClick={() => {
                                if (isTransitioningRef.current) return;
                                if (slotOffset === -1) {
                                  prevSlide();
                                } else if (slotOffset === 1) {
                                  nextSlide();
                                }
                              }}
                              className={`carousel-glide-dot h-1.5 rounded-full cursor-pointer ${
                                isMainCenter
                                  ? 'w-5 bg-[#D4AF37]'
                                  : 'w-1.5 bg-white/30 hover:bg-white/55'
                              } ${isEnteringEdge ? 'carousel-glide-dot-enter' : ''}`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Photo & News Source Credit: Italic at bottom left under the Carousel photo */}
                {currentPhoto.source && currentPhoto.source.trim() ? (
                  <p
                    className={`mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-slate-400/80 italic tracking-wide text-left transition-opacity duration-500 ease-in-out ${
                      isCarouselFading ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    Source: <span className="text-slate-300 font-medium italic">{currentPhoto.source}</span>
                  </p>
                ) : null}
              </div>

              {/* TEXT CONTAINER: Hugs photo with sm:gap-6 lg:gap-7 allowance on desktop, 1-screen fit on mobile */}
              <div
                className={`flex-1 flex flex-col justify-start space-y-1.5 sm:space-y-3.5 text-left px-1 sm:px-0 pt-2 sm:pt-1 max-w-2xl lg:max-w-3xl transition-opacity duration-500 ease-in-out ${
                  isCarouselFading ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {/* Thick prominent heading on mobile and desktop (decreased by 25%) */}
                {currentPhoto.heading && currentPhoto.heading.trim() ? (
                  <h2 className="text-sm xs:text-base sm:text-lg md:text-2xl lg:text-3xl xl:text-4xl font-black text-[#D4AF37] leading-tight tracking-tight drop-shadow-md">
                    {currentPhoto.heading}
                  </h2>
                ) : null}

                {/* Thicker font-bold on mobile, refined font size on desktop */}
                {currentPhoto.caption && currentPhoto.caption.trim() ? (
                  <p className="text-xs xs:text-sm sm:text-sm md:text-base lg:text-lg xl:text-xl text-slate-100 font-bold sm:font-normal leading-snug sm:leading-relaxed max-w-xl sm:max-w-2xl lg:max-w-3xl drop-shadow-sm">
                    {currentPhoto.caption}
                  </p>
                ) : null}

                {currentPhoto.link && (
                  <a
                    href={currentPhoto.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-bold text-[#4ADE80] hover:text-[#22c55e] transition-colors uppercase tracking-wider pt-0.5 sm:pt-1.5 group w-fit"
                  >
                    <span>Continue Reading</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* =========================================================================
          2. TOP FIXTURES (HIGHLIGHTED POPULAR MATCHES)
          - Warm ivory background (#FFFFF0)
          - Eyebrow: 'Top Fixtures' with exact same font styling as 'Weekly Editorial'
          - Subheading: 'Join in on the Discussions of these Highlighted fixtures'
            with exact same font size & weight as 'Top Stories & Match Perspectives'
          - Headings in line vertically with other headings (max-w-7xl mx-auto px-2 sm:px-6 lg:px-8)
          - Desktop: Original full-size FixtureSportCard spanning from absolute left to absolute right across desktop
          - Mobile: Compact card sizes, 2 side by side on row 1, 2 on row 2, 1 on row 3 (grid-cols-2)
          ========================================================================= */}
      <section className="w-full bg-[#FFFFF0] text-slate-900 pt-6 pb-6 sm:pt-[21px] sm:pb-14 border-b border-amber-900/10">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 mb-4 sm:mb-8">
          {/* Section Heading in line vertically with other headings */}
          <div className="text-left px-1 sm:px-0">
            <span className="text-[#006C54] font-bold text-xs uppercase tracking-wider block mb-1">
              Top Fixtures
            </span>
            <h2 className="font-extrabold text-xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
              Join in on the Discussions of these Highlighted fixtures
            </h2>
          </div>
        </div>

        {/* DESKTOP VIEW: Original full-size FixtureSportCard spanning from absolute left to absolute right across screen */}
        <div className="hidden md:block w-full px-3 sm:px-6 lg:px-8 xl:px-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 sm:gap-4.5 w-full">
            {topFixtures.length === 0 ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={`desktop-fixture-skel-${idx}`}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs animate-pulse min-h-[220px]"
                >
                  <div className="h-3 w-20 bg-slate-200 rounded mb-4" />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-200" />
                      <div className="h-3.5 w-28 bg-slate-200 rounded" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-200" />
                      <div className="h-3.5 w-28 bg-slate-200 rounded" />
                    </div>
                  </div>
                  <div className="mt-6 pt-3 border-t border-slate-100 h-6 bg-slate-100 rounded" />
                </div>
              ))
            ) : (
              topFixtures.map((m) => (
                <FixtureSportCard
                  key={m.id}
                  match={m}
                  consensus={
                    freeMatchConsensus[m.id] || {
                      homePct: m.homePct || 33,
                      drawPct: m.drawPct || 34,
                      awayPct: m.awayPct || 33,
                      totalVotes: 142,
                      picks: [],
                      matchId: m.id,
                    }
                  }
                  builderLegs={builderLegs}
                  onToggleLeg={(market, pick, odds, e) => handleToggleLeg(m, market, pick, odds, e)}
                  onOpenBetBuilder={(matchData) => setSelectedMatchForBuilder(matchData)}
                />
              ))
            )}
          </div>
        </div>

        {/* MOBILE VIEW: Compact cards (2 on row 1, 2 on row 2, 1 on row 3) */}
        <div className="block md:hidden max-w-7xl mx-auto px-2">
          <div className="grid grid-cols-2 gap-2.5">
            {topFixtures.length === 0 ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div
                  key={`mobile-fixture-skel-${idx}`}
                  className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-2xs animate-pulse flex flex-col justify-between min-h-[125px]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <div className="h-2.5 w-14 bg-slate-200 rounded" />
                      <div className="h-2.5 w-10 bg-slate-200 rounded" />
                    </div>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <div className="w-4 h-4 rounded-full bg-slate-200 shrink-0" />
                          <div className="h-3 w-16 bg-slate-200 rounded" />
                        </div>
                        <div className="h-3 w-3 bg-slate-200 rounded" />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-1">
                          <div className="w-4 h-4 rounded-full bg-slate-200 shrink-0" />
                          <div className="h-3 w-16 bg-slate-200 rounded" />
                        </div>
                        <div className="h-3 w-3 bg-slate-200 rounded" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="h-2.5 w-12 bg-slate-200 rounded" />
                    <div className="h-2.5 w-8 bg-slate-200 rounded" />
                  </div>
                </div>
              ))
            ) : (
              topFixtures.map((m) => {
                const isLive = m.status === 'in';
                const isFinished = m.status === 'post';
                const hasScores =
                  (isLive || isFinished) &&
                  ((m.homeScore !== null && m.homeScore !== undefined) ||
                    (m.awayScore !== null && m.awayScore !== undefined));

                return (
                  <Link
                    key={m.id}
                    to={`/free/${m.id}`}
                    onClick={(e) => {
                      if (!currentUser) {
                        e.preventDefault();
                        openAuthWall({
                          actionType: 'details',
                          title: 'Sign In for Details & Discussions',
                          message:
                            'Sign up or log in to view match intelligence, tactical lineups, pitch tracker, and join live fan discussions.',
                        });
                      }
                    }}
                    className="bg-white border border-slate-200/90 hover:border-[#006C54] rounded-xl p-2.5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer text-left select-none"
                  >
                    <div>
                      {/* Top Row: League & Status */}
                      <div className="flex items-center justify-between gap-1 mb-2 text-xs">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate max-w-[85px]">
                          {m.competition || 'Football'}
                        </span>
                        {isLive ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 animate-pulse shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                            <span>{m.displayClock || 'LIVE'}</span>
                          </span>
                        ) : isFinished ? (
                          <span className="text-[10px] font-bold text-black bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                            FT
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-600 flex items-center gap-1 shrink-0">
                            <Clock size={11} className="text-slate-400" />
                            <span>{formatKickoffDateTime24h(m.kickoffIso || m.kickoff, m.kickoff)}</span>
                          </span>
                        )}
                      </div>

                      {/* Teams and Scores */}
                      <div className="space-y-1.5">
                        {/* Home Team */}
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            {m.homeLogo ? (
                              <img
                                src={m.homeLogo}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                className="w-4 h-4 object-contain shrink-0"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {m.home.charAt(0)}
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-slate-800 group-hover:text-[#006C54] transition-colors truncate">
                              {m.home}
                            </span>
                          </div>
                          {hasScores && (
                            <span className="text-xs font-extrabold text-slate-900 shrink-0">
                              {m.homeScore ?? 0}
                            </span>
                          )}
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            {m.awayLogo ? (
                              <img
                                src={m.awayLogo}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                referrerPolicy="no-referrer"
                                className="w-4 h-4 object-contain shrink-0"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {m.away.charAt(0)}
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-slate-800 group-hover:text-[#006C54] transition-colors truncate">
                              {m.away}
                            </span>
                          </div>
                          {hasScores && (
                            <span className="text-xs font-extrabold text-slate-900 shrink-0">
                              {m.awayScore ?? 0}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Footer: Discussion Prompt */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium truncate">
                        <MessageSquare size={11} className="text-[#006C54] shrink-0" />
                        <span className="truncate">Discussion</span>
                      </div>
                      <span className="text-[10px] font-bold text-[#006C54] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 shrink-0">
                        Join Discussion <span>→</span>
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. VIDEOS AND HIGHLIGHTS SECTION (COMPACT THUMBNAIL-FIRST DESIGN)
          - Background color of the gold accent (#D4AF37) covering the whole section
          - Edge-to-edge full width same as the topmost green section
          - Eyebrow: 'Video & Highlights'
          - Big heading: 'Tune in to Post-match Highlights, Post-match Punditry and other Featured Videos'
          - Desktop: Spanning from absolute left all the way to absolute right across desktop
          - Minimalistic heart icon on bottom right of video cards
          ========================================================================= */}
      <section
        className={`theme-protected w-full bg-[#D4AF37] text-slate-900 pt-6 sm:pt-6 ${
          currentUser
            ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-16'
            : 'pb-6 sm:pb-16'
        }`}
      >
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 mb-6 sm:mb-8">
          <div className="text-left px-1 sm:px-0">
            <span className="text-slate-900/80 font-bold text-xs uppercase tracking-wider block mb-1">
              Video &amp; Highlights
            </span>
            <h2 className="font-extrabold text-xl sm:text-3xl lg:text-4xl text-slate-950 tracking-tight">
              Tune in to Post-match Highlights, Post-match Punditry and other Featured Videos
            </h2>
          </div>
        </div>

        {publishedVideos.length === 0 ? (
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <div className="bg-white/90 border border-slate-200 rounded-2xl p-8 text-center text-slate-600 text-xs max-w-md mx-auto shadow-2xs">
              No Highlights and Media Published
            </div>
          </div>
        ) : (
          <>
            {/* DESKTOP VIEW: Video grid spanning left to right with compact max-w-[340px] iframe sizing as before */}
            <div className="hidden md:block w-full px-3 sm:px-6 lg:px-8 xl:px-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 w-full">
                {publishedVideos.map((video) => {
                  const videoId = extractYouTubeId(video.embedUrl) || extractYouTubeId(video.youtubeUrl);
                  const safeIframeSrc = resolveVideoPlayerSrc(video, videoId);
                  const isPlaying = activeVideoId === video.id;
                  const isLiked = likedVideoIds.has(video.id);

                  return (
                    <div
                      key={video.id}
                      data-video-card-id={video.id}
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col max-w-[340px] w-full mx-auto"
                    >
                      {/* Responsive 16:9 Video Player / Thumbnail Area */}
                      <div className="relative w-full aspect-[16/9] bg-black overflow-hidden group select-none">
                        {isPlaying && safeIframeSrc ? (
                          /* Native Video Iframe (Autoplay immediately without secondary YouTube button) */
                          <iframe
                            src={safeIframeSrc}
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            referrerPolicy="no-referrer"
                            className="w-full h-full border-0"
                          />
                        ) : (
                          /* Thumbnail-First Presentation (No overlaid text or title, central emerald/gold button) */
                          <div className="relative w-full h-full">
                            {videoId ? (
                              <img
                                src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (target.src.includes('maxresdefault.jpg')) {
                                    target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                  }
                                }}
                                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                <Play size={32} className="text-[#006C54]" />
                              </div>
                            )}

                            {/* Subtle dark backdrop overlay */}
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

                            {/* Prominent MshindiRoom-Branded Play Button (Emerald with Ivory White Play Icon) */}
                            <button
                              type="button"
                              onClick={() => handlePlayVideo(video)}
                              className="absolute inset-0 flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006C54]"
                              aria-label={`Play ${video.title}`}
                            >
                              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-[#006C54] hover:bg-[#005441] shadow-[0_4px_24px_rgba(0,108,84,0.65)] flex items-center justify-center group-hover:scale-110 active:scale-95 transition-all duration-300">
                                <Play size={24} fill="#FFFFF0" className="ml-1 text-[#FFFFF0]" />
                              </div>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Video Metadata / Title Below Player with Heart Like Icon on bottom right */}
                      <div
                        className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 flex-1 bg-white ${!isPlaying ? 'cursor-pointer' : ''}`}
                        onClick={() => !isPlaying && handlePlayVideo(video)}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="mt-0.5 text-[#006C54] shrink-0">
                            <Play size={15} fill="currentColor" />
                          </div>
                          <h3 className="font-semibold text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2">
                            {video.title}
                          </h3>
                        </div>

                        {/* Minimalistic Heart Icon on bottom right */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleLikeVideo(video.id, e)}
                          className="p-1.5 -mr-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50/50 transition-colors shrink-0 cursor-pointer select-none focus:outline-none"
                          aria-label={isLiked ? 'Unlike video' : 'Like video'}
                          title={isLiked ? 'Liked' : 'Like this video'}
                        >
                          <Heart
                            size={18}
                            fill={isLiked ? '#e11d48' : 'none'}
                            className={`transition-transform duration-200 ${
                              isLiked ? 'text-rose-600 scale-110' : 'text-slate-400 hover:scale-110'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* MOBILE VIEW: Compact Sideward Scroll with Smooth Snap & Heart button */}
            <div className="block md:hidden">
              <div
                data-scroll-restore-id="home-mobile-videos"
                className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 px-4 sm:px-0 -mx-4 sm:mx-0 no-scrollbar"
              >
                {publishedVideos.map((video) => {
                  const videoId = extractYouTubeId(video.embedUrl) || extractYouTubeId(video.youtubeUrl);
                  const safeIframeSrc = resolveVideoPlayerSrc(video, videoId);
                  const isPlaying = activeVideoId === video.id;
                  const isLiked = likedVideoIds.has(video.id);

                  return (
                    <div
                      key={video.id}
                      data-video-card-id={video.id}
                      className="w-[70vw] max-w-[275px] shrink-0 snap-center bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col"
                    >
                      {/* Responsive 16:9 Video Player / Thumbnail Area */}
                      <div className="relative w-full aspect-[16/9] bg-black overflow-hidden group select-none">
                        {isPlaying && safeIframeSrc ? (
                          <iframe
                            src={safeIframeSrc}
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            referrerPolicy="no-referrer"
                            className="w-full h-full border-0"
                          />
                        ) : (
                          <div className="relative w-full h-full">
                            {videoId ? (
                              <img
                                src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                                alt=""
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (target.src.includes('maxresdefault.jpg')) {
                                    target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                  }
                                }}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                <Play size={28} className="text-[#006C54]" />
                              </div>
                            )}

                            {/* Subtle dark backdrop overlay */}
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

                            {/* Prominent MshindiRoom-Branded Play Button (Emerald with Ivory White Play Icon) */}
                            <button
                              type="button"
                              onClick={() => handlePlayVideo(video)}
                              className="absolute inset-0 flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006C54]"
                              aria-label={`Play ${video.title}`}
                            >
                              <div className="w-14 h-14 rounded-full bg-[#006C54] hover:bg-[#005441] shadow-[0_4px_20px_rgba(0,108,84,0.65)] flex items-center justify-center active:scale-95 transition-all">
                                <Play size={20} fill="#FFFFF0" className="ml-1 text-[#FFFFF0]" />
                              </div>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Video Title Row with Heart button */}
                      <div
                        className={`p-3 flex items-center justify-between gap-2 bg-white ${!isPlaying ? 'cursor-pointer' : ''}`}
                        onClick={() => !isPlaying && handlePlayVideo(video)}
                      >
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <div className="mt-0.5 text-[#006C54] shrink-0">
                            <Play size={14} fill="currentColor" />
                          </div>
                          <h3 className="font-semibold text-xs text-slate-900 leading-snug truncate">
                            {video.title}
                          </h3>
                        </div>

                        {/* Minimalistic Heart Icon on bottom right */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleLikeVideo(video.id, e)}
                          className="p-1 -mr-0.5 rounded-full text-slate-400 hover:text-rose-500 transition-colors shrink-0 cursor-pointer select-none focus:outline-none"
                          aria-label={isLiked ? 'Unlike video' : 'Like video'}
                          title={isLiked ? 'Liked' : 'Like this video'}
                        >
                          <Heart
                            size={16}
                            fill={isLiked ? '#e11d48' : 'none'}
                            className={`transition-transform duration-200 ${
                              isLiked ? 'text-rose-600 scale-110' : 'text-slate-400'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Quick Bet Builder Modal */}
      {selectedMatchForBuilder && (
        <QuickBetBuilderModal
          match={selectedMatchForBuilder}
          isOpen={Boolean(selectedMatchForBuilder)}
          onClose={() => setSelectedMatchForBuilder(null)}
        />
      )}
    </div>
  );
}
