import React, { useState, useEffect, useSyncExternalStore, useRef } from 'react';
import { Play } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import {
  subscribeToHomepageFeed,
  getHomepageFeedSnapshot,
  type HomepageVideoItem,
} from '../lib/homepageFeedStore';
import { useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';

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

  // Active Carousel Slide Index
  const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);

  // Active playing video ID (thumbnail-first playback)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // Current Active Photo
  const currentPhoto = publishedPhotos[activeCarouselIndex] || publishedPhotos[0];

  // Carousel Next / Prev Navigation
  const nextSlide = () => {
    if (publishedPhotos.length > 0) {
      setActiveCarouselIndex((prev) => (prev + 1) % publishedPhotos.length);
    }
  };

  const prevSlide = () => {
    if (publishedPhotos.length > 0) {
      setActiveCarouselIndex((prev) => (prev - 1 + publishedPhotos.length) % publishedPhotos.length);
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

  // 3-Second Automatic Carousel Rotation without user interaction
  useEffect(() => {
    if (publishedPhotos.length <= 1) return;
    const interval = setInterval(() => {
      setActiveCarouselIndex((prev) => (prev + 1) % publishedPhotos.length);
    }, 3000);
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
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 relative overflow-hidden"
            onTouchStart={handleCarouselTouchStart}
            onTouchMove={handleCarouselTouchMove}
            onTouchEnd={handleCarouselTouchEnd}
          >
            {/* Section Heading in Crisp White with NO background and NO border */}
            <div className="text-left mb-6 sm:mb-10 relative z-10">
              <span className="text-white font-bold text-xs uppercase tracking-wider block mb-1.5">
                Weekly Editorial
              </span>
              <h1 className="font-extrabold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
                Top Stories &amp; Matchday Perspectives
              </h1>
            </div>

            {/* 2-Column Console Layout: Photo on Left (Enlarged on Mobile), Text on Right (Pushed to Right Edge) */}
            <div className="grid grid-cols-12 gap-3 sm:gap-6 lg:gap-10 items-start relative z-10">
              {/* LEFT SIDE: 3:4 Photo with faded edges and bottom dots (Enlarged & Prominent on Mobile) */}
              <div className="col-span-7 sm:col-span-5 lg:col-span-4 flex flex-col items-start sm:items-center justify-start">
                <div className="relative w-full max-w-[270px] sm:max-w-[290px] lg:max-w-[340px] aspect-[3/4] rounded-2xl sm:rounded-2xl lg:rounded-3xl overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.65)] bg-black/90">
                  {/* Active Photo */}
                  <img
                    src={currentPhoto.imageUrl}
                    alt={currentPhoto.heading || currentPhoto.caption || 'Active carousel story'}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="w-full h-full object-cover transition-all duration-700 ease-out"
                  />

                  {/* Gracefully Faded Edges into Uniform Green Background */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#02241b] via-transparent to-[#02241b]/30 pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#02241b]/50 via-transparent to-[#02241b]/50 pointer-events-none" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl sm:rounded-2xl lg:rounded-3xl pointer-events-none" />
                </div>

                {/* Minimalist Bottom Indicator (Dots directly under the photo) */}
                {publishedPhotos.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-5 select-none w-full max-w-[270px] sm:max-w-[290px] lg:max-w-[340px]" aria-label="Carousel pagination">
                    {publishedPhotos.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveCarouselIndex(idx)}
                        className={`transition-all duration-300 rounded-full cursor-pointer focus:outline-none ${
                          idx === activeCarouselIndex
                            ? 'w-5 sm:w-7 h-1.5 sm:h-2 bg-[#4ADE80] shadow-[0_0_8px_#4ADE80]'
                            : 'w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/30 hover:bg-white/60'
                        }`}
                        aria-label={`Go to slide ${idx + 1} of ${publishedPhotos.length}`}
                        aria-current={idx === activeCarouselIndex ? 'true' : 'false'}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT SIDE: Big News Heading in Gold Accent on TOP of Smaller Caption Text (Pushed to Right Edge) */}
              <div className="col-span-5 sm:col-span-7 lg:col-span-8 flex flex-col justify-start space-y-1.5 sm:space-y-4 text-left pl-2.5 sm:pl-4 lg:pl-6">
                {currentPhoto.heading && currentPhoto.heading.trim() ? (
                  <h2 className="text-base sm:text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-[#D4AF37] leading-tight tracking-tight drop-shadow-sm">
                    {currentPhoto.heading}
                  </h2>
                ) : null}

                {/* On mobile and desktop: When no caption is written, leave it empty (no placeholder/default text) */}
                {currentPhoto.caption && currentPhoto.caption.trim() ? (
                  <p className="text-[11px] sm:text-xs md:text-sm lg:text-base text-slate-200/90 leading-relaxed font-normal max-w-xl">
                    {currentPhoto.caption}
                  </p>
                ) : null}

                {currentPhoto.link && (
                  <a
                    href={currentPhoto.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-[#4ADE80] hover:text-[#22c55e] transition-colors uppercase tracking-wider pt-1 sm:pt-2 group w-fit"
                  >
                    <span>Continue Reading</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </a>
                )}
              </div>
            </div>
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
                      {isPlaying && videoId ? (
                        /* Native YouTube Iframe (Autoplay with full native controls) */
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
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
                        {isPlaying && videoId ? (
                          <iframe
                            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
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
                        className={`p-3.5 flex items-center justify-between gap-3 bg-white ${!isPlaying ? 'cursor-pointer' : ''}`}
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
                        <span className="text-[11px] tabular-nums font-semibold text-slate-400 shrink-0">
                          {idx + 1}/{publishedVideos.length}
                        </span>
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
