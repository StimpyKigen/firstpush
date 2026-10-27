import React, { useState, useEffect, useSyncExternalStore, useRef, useMemo } from 'react';
import { Play } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import {
  subscribeToHomepageFeed,
  getHomepageFeedSnapshot,
  type HomepageVideoItem,
} from '../lib/homepageFeedStore';
import { useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';
import { EditorialCarouselSkeleton } from '../components/skeleton';
import {
  useCarouselCardLoader,
  preloadCarouselImage,
} from '../lib/carouselImagePreloader';

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

  const publishedPhotos = feed.carouselItems.filter((i) => i.published);
  const publishedVideos = feed.videoItems.filter((v) => v.published);

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
      {publishedPhotos.length > 0 && currentPhoto && (
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

            {/* 2-Column Console Layout on Desktop, Compact 1-Screen Stacked Layout on Mobile */}
            {!isCardReady ? (
              <EditorialCarouselSkeleton />
            ) : (
              <div className="flex flex-col sm:grid sm:grid-cols-12 sm:gap-6 lg:gap-10 items-start relative z-10 animate-editorial-fade-in">
                {/* PHOTO CONTAINER: Compact on mobile for 1-screen fit, full column on desktop */}
                <div className="w-full sm:col-span-5 lg:col-span-4 flex flex-col items-start px-1 sm:px-0">
                  <div
                    className={`relative w-[180px] xs:w-[200px] sm:w-full sm:max-w-[290px] lg:max-w-[340px] aspect-[3/4] min-h-0 sm:min-h-[360px] lg:min-h-[420px] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.65)] bg-[#06372a] transition-opacity duration-500 ease-in-out ${
                      isCarouselFading ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    {/* Active Photo with High-Priority Eager Loading & Verified Image Fallback */}
                    <img
                      src={displayImageUrl}
                      alt={currentPhoto.heading || currentPhoto.caption || 'Active carousel story'}
                      loading="eager"
                      decoding="async"
                      sizes="(max-width: 640px) 200px, (max-width: 1024px) 290px, 340px"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.includes('hero-striker.jpg')) {
                          target.src = '/images/hero-striker.jpg';
                        }
                      }}
                    />

                    {/* Subtle inner border for crisp edge definition without fading */}
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl sm:rounded-2xl lg:rounded-3xl pointer-events-none" />
                  </div>
                </div>

                {/* TEXT CONTAINER: Fits on 1 screen on mobile without scrolling */}
                <div
                  className={`w-full sm:col-span-7 lg:col-span-8 flex flex-col justify-start space-y-1.5 sm:space-y-3.5 text-left px-1 sm:px-0 sm:pl-4 lg:pl-6 pt-2 sm:pt-0 transition-opacity duration-500 ease-in-out ${
                    isCarouselFading ? 'opacity-0' : 'opacity-100'
                  }`}
                >
                  {/* Photo & News Source Credit: Below the photo from the left, above caption heading */}
                  {currentPhoto.source && currentPhoto.source.trim() ? (
                    <p className="text-[10px] sm:text-xs text-slate-400/80 italic tracking-wide">
                      Source: <span className="text-slate-300 font-medium not-italic">{currentPhoto.source}</span>
                    </p>
                  ) : null}

                  {/* Thick prominent heading on mobile and desktop */}
                  {currentPhoto.heading && currentPhoto.heading.trim() ? (
                    <h2 className="text-base xs:text-lg sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black text-[#D4AF37] leading-tight tracking-tight drop-shadow-md">
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
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          2. HORIZONTAL LINE SEPARATOR
          ========================================================================= */}
      <div className="w-full border-t border-slate-200 mb-8 sm:mb-12" />

      {/* =========================================================================
          3. VIDEOS AND HIGHLIGHTS SECTION (COMPACT THUMBNAIL-FIRST DESIGN)
          - Before play: Text-free YouTube thumbnail with central emerald & gold play button
          - When clicked: Replaces thumbnail with native YouTube iframe with autoplay
          - Zero layout shifts (aspect-[16/9])
          - Outside stationary tap pauses playback and returns the Mshindi play button
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="text-left mb-6 sm:mb-8">
          <h2 className="font-bold sm:font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
            Videos and Highlights
          </h2>
        </div>

        {publishedVideos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs max-w-md mx-auto shadow-2xs">
            No highlights or media embeds published yet. Admin can publish videos and embeds via the Admin Console.
          </div>
        ) : (
          <>
            {/* DESKTOP VIEW: Compact Multi-Column Grid */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
              {publishedVideos.map((video) => {
                const videoId = extractYouTubeId(video.embedUrl) || extractYouTubeId(video.youtubeUrl);
                const isPlaying = activeVideoId === video.id;

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

                    {/* Video Metadata / Title Below Player */}
                    <div
                      className={`p-4 flex items-start gap-2.5 flex-1 bg-white ${!isPlaying ? 'cursor-pointer' : ''}`}
                      onClick={() => !isPlaying && handlePlayVideo(video)}
                    >
                      <div className="mt-0.5 text-[#006C54] shrink-0">
                        <Play size={15} fill="currentColor" />
                      </div>
                      <h3 className="font-semibold text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2">
                        {video.title}
                      </h3>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* MOBILE VIEW: Compact Sideward Scroll with Smooth Snap & Indicators */}
            <div className="block md:hidden">
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 px-4 sm:px-0 -mx-4 sm:mx-0 no-scrollbar">
                {publishedVideos.map((video, idx) => {
                  const videoId = extractYouTubeId(video.embedUrl) || extractYouTubeId(video.youtubeUrl);
                  const isPlaying = activeVideoId === video.id;

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

                      {/* Video Title Row */}
                      <div
                        className={`p-3.5 flex items-center gap-3 bg-white ${!isPlaying ? 'cursor-pointer' : ''}`}
                        onClick={() => !isPlaying && handlePlayVideo(video)}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="mt-0.5 text-[#006C54] shrink-0">
                            <Play size={14} fill="currentColor" />
                          </div>
                          <h3 className="font-semibold text-xs text-slate-900 leading-snug truncate">
                            {video.title}
                          </h3>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
