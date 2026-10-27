import React, { useState, useEffect, useSyncExternalStore, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Play, Clock, MessageSquare, Heart } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import {
  subscribeToHomepageFeed,
  getHomepageFeedSnapshot,
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
import { normalizeMatchStatus } from '../lib/matchStatus';
import { useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';
import { EditorialCarouselSkeleton } from '../components/skeleton';
import {
  useCarouselCardLoader,
  preloadCarouselImage,
} from '../lib/carouselImagePreloader';
import FixtureSportCard from '../components/FixtureSportCard';
import QuickBetBuilderModal, { type MatchForBuilder } from '../components/QuickBetBuilderModal';
import { useBetSlipStore } from '../lib/betSlipStore';
import { showToast } from '../lib/notificationStore';

/**
 * Extracts standard 11-character YouTube video ID from various URL formats
 */
function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:embed\/|v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
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

  const publishedPhotos = useMemo(() => {
    return feed.carouselItems
      .filter(
        (i) => i.published && Boolean(i.imageUrl && i.imageUrl.trim()) && !['slide-1', 'slide-2', 'slide-3'].includes(i.id)
      )
      .sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 9999;
        const orderB = typeof b.order === 'number' ? b.order : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [feed.carouselItems]);
  const publishedVideos = feed.videoItems.filter((v) => v.published);

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
  };

  // Initial load state: only show skeleton loader while fetching carousels on mount.
  // Once the carousels start showing, hasInitiallyLoaded turns true permanently
  // so that NO skeleton loader ever shows again during slide transitions or auto-rotation.
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  useEffect(() => {
    if (hasInitiallyLoaded) return;

    if (publishedPhotos.length > 0) {
      // Preload all active photos immediately in parallel
      publishedPhotos.forEach((photo) => {
        if (photo.imageUrl) {
          preloadCarouselImage(photo.imageUrl, 'high');
        }
      });

      const firstImage = publishedPhotos[0]?.imageUrl;
      if (firstImage) {
        preloadCarouselImage(firstImage, 'high').finally(() => {
          setHasInitiallyLoaded(true);
        });
      } else {
        setHasInitiallyLoaded(true);
      }
    } else {
      const timer = setTimeout(() => {
        setHasInitiallyLoaded(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [publishedPhotos, hasInitiallyLoaded]);

  // Active Carousel Slide Index & 1-Second Smooth Fade State
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
  const [isCarouselFading, setIsCarouselFading] = useState(false);
  const isTransitioningRef = useRef(false);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    activeIndexRef.current = activeCarouselIndex;
  }, [activeCarouselIndex]);

  // Keep active index within valid bounds when feed updates dynamically
  useEffect(() => {
    if (publishedPhotos.length > 0 && activeCarouselIndex >= publishedPhotos.length) {
      setActiveCarouselIndex(0);
    }
  }, [publishedPhotos.length, activeCarouselIndex]);



  // Smooth slide change function: 500ms fade-out, swap slide, 500ms fade-in = 1 second smooth transition
  const goToSlide = (nextIdx: number) => {
    if (isTransitioningRef.current || nextIdx === activeIndexRef.current) return;
    
    // Pre-decode target image with high priority immediately before transition begins
    const targetPhoto = publishedPhotos[nextIdx];
    if (targetPhoto?.imageUrl) {
      preloadCarouselImage(targetPhoto.imageUrl, 'high');
    }

    isTransitioningRef.current = true;
    setIsCarouselFading(true);

    setTimeout(() => {
      setActiveCarouselIndex(nextIdx);
      setIsCarouselFading(false);
      setTimeout(() => {
        isTransitioningRef.current = false;
      }, 500);
    }, 500);
  };

  // Active playing video ID (thumbnail-first playback)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // Current Active Photo
  const currentPhoto = publishedPhotos[activeCarouselIndex] || publishedPhotos[0];

  // Coordinated Carousel Card & Image Preloader Hook
  const { isReady: isCardReady, displayImageUrl } = useCarouselCardLoader(
    currentPhoto,
    publishedPhotos,
    activeCarouselIndex
  );

  // Carousel Next / Prev Navigation
  const nextSlide = () => {
    if (publishedPhotos.length > 0) {
      goToSlide((activeIndexRef.current + 1) % publishedPhotos.length);
    }
  };

  const prevSlide = () => {
    if (publishedPhotos.length > 0) {
      goToSlide((activeIndexRef.current - 1 + publishedPhotos.length) % publishedPhotos.length);
    }
  };

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

  // 6-Second Automatic Carousel Rotation with 1-Second Fade Transition
  useEffect(() => {
    if (publishedPhotos.length <= 1) return;
    const interval = setInterval(() => {
      const nextIdx = (activeIndexRef.current + 1) % publishedPhotos.length;
      goToSlide(nextIdx);
    }, 6000);
    return () => clearInterval(interval);
  }, [publishedPhotos.length]);

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
    <div className="bg-[#FFFFF0] text-slate-900 min-h-screen">
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
        <section className="w-full bg-[#02241b] text-white">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-16 relative overflow-hidden">
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
        <section className="w-full bg-[#02241b] text-white">
          <div
            className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-16 relative overflow-hidden"
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
                  {/* Active Photo: Strictly from active carousel, with high priority and async decoding */}
                  <img
                    src={currentPhoto.imageUrl}
                    alt={currentPhoto.heading || currentPhoto.caption || 'Active carousel story'}
                    loading="eager"
                    decoding="async"
                    sizes="(max-width: 640px) 200px, (max-width: 1024px) 280px, 320px"
                    className="w-full h-full object-cover"
                  />

                  {/* Subtle inner border for crisp edge definition without fading */}
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl sm:rounded-2xl lg:rounded-3xl pointer-events-none" />
                </div>

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
      <section className="w-full bg-[#FFFFF0] text-slate-900 py-6 sm:py-14 border-b border-amber-900/10">
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
                const isLive = normalizeMatchStatus(m.status, m.displayClock) === 'in';
                const isFinished = normalizeMatchStatus(m.status, m.displayClock) === 'post';
                const hasScores =
                  (m.homeScore !== null && m.homeScore !== undefined) ||
                  (m.awayScore !== null && m.awayScore !== undefined);

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
        className={`w-full bg-[#D4AF37] text-slate-900 pt-6 sm:pt-16 ${
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
              No highlights or media embeds published yet. Admin can publish videos and embeds via the Admin Console.
            </div>
          </div>
        ) : (
          <>
            {/* DESKTOP VIEW: Video grid spanning left to right with compact max-w-[340px] iframe sizing as before */}
            <div className="hidden md:block w-full px-3 sm:px-6 lg:px-8 xl:px-10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 w-full">
                {publishedVideos.map((video) => {
                  const videoId = extractYouTubeId(video.embedUrl) || extractYouTubeId(video.youtubeUrl);
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
                        {isPlaying && (videoId || video.embedUrl) ? (
                          /* Native Video Iframe (Autoplay immediately without secondary YouTube button) */
                          <iframe
                            src={
                              videoId
                                ? `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1`
                                : video.embedUrl?.includes('?')
                                ? `${video.embedUrl}&autoplay=1&playsinline=1`
                                : `${video.embedUrl}?autoplay=1&playsinline=1`
                            }
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
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
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 px-4 sm:px-0 -mx-4 sm:mx-0 no-scrollbar">
                {publishedVideos.map((video) => {
                  const videoId = extractYouTubeId(video.embedUrl) || extractYouTubeId(video.youtubeUrl);
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
                        {isPlaying && (videoId || video.embedUrl) ? (
                          <iframe
                            src={
                              videoId
                                ? `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1`
                                : video.embedUrl?.includes('?')
                                ? `${video.embedUrl}&autoplay=1&playsinline=1`
                                : `${video.embedUrl}?autoplay=1&playsinline=1`
                            }
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
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
