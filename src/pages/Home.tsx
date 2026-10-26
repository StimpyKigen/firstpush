import React, { useState, useSyncExternalStore, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
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
          - Faded green accent background for the entire section
          - Heading in white
          - Left: Big news heading (words cutting in slightly over the photo on desktop)
          - Center: Single active card (3:4 aspect ratio with gracefully faded edges)
          - Bottom: Minimalist dots indicator
          - Right: Caption in smaller font (never cuts into the photo)
          ========================================================================= */}
      {publishedPhotos.length > 0 && currentPhoto && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
          <div
            className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#02241b] via-[#032e23] to-[#011c15] border border-[#054d3c]/50 p-6 sm:p-8 lg:p-12 shadow-[0_20px_50px_rgba(1,26,20,0.85)] text-white"
            onTouchStart={handleCarouselTouchStart}
            onTouchMove={handleCarouselTouchMove}
            onTouchEnd={handleCarouselTouchEnd}
          >
            {/* Ambient subtle green glow backdrops */}
            <div className="absolute -top-32 -left-32 w-80 h-80 bg-[#006C54]/25 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-[#00A87E]/20 rounded-full filter blur-3xl pointer-events-none" />

            {/* Section Heading in Crisp White */}
            <div className="text-left mb-6 sm:mb-10 relative z-10">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#006C54]/30 border border-[#4ADE80]/30 text-[#4ADE80] font-bold text-xs uppercase tracking-wider mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
                Weekly Editorial News
              </span>
              <h1 className="font-extrabold text-2xl sm:text-3xl lg:text-4xl text-white tracking-tight">
                Top Stories &amp; Matchday Perspectives
              </h1>
            </div>

            {/* 3-Column Console Layout (Desktop) / Stacked (Mobile) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-4 items-center relative z-10">
              {/* LEFT SIDE: Big News Heading (Words cutting in slightly over photo if necessary) */}
              <div className="lg:col-span-4 flex flex-col justify-center space-y-4 text-left z-20 xl:-mr-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[#4ADE80] text-[11px] font-bold uppercase tracking-wider w-fit">
                  <span>NEW</span>
                  <span className="text-white/40">·</span>
                  <span className="text-white/80">Matchday Analysis</span>
                </div>

                <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-[1.06] tracking-tight drop-shadow-md">
                  {currentPhoto.heading || currentPhoto.caption?.slice(0, 42) || 'Match of the year is coming'}
                </h2>

                {currentPhoto.link && (
                  <a
                    href={currentPhoto.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-bold text-[#4ADE80] hover:text-[#22c55e] transition-colors uppercase tracking-wider pt-2 group w-fit"
                  >
                    <span>Continue Reading</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </a>
                )}
              </div>

              {/* CENTER CONSOLE: The Active Photo Alone (3:4 Aspect Ratio, Edges Fading Gracefully) */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center relative z-10 my-2 lg:my-0">
                <div className="relative w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[340px] aspect-[3/4] rounded-3xl overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.65)] bg-black/90">
                  {/* Active Photo */}
                  <img
                    src={currentPhoto.imageUrl}
                    alt={currentPhoto.heading || currentPhoto.caption || 'Active carousel story'}
                    className="w-full h-full object-cover transition-all duration-700 ease-out"
                  />

                  {/* Gracefully Faded Edges into Faded Green Background */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#011c15] via-transparent to-[#02241b]/40 pointer-events-none" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#02241b]/60 via-transparent to-[#02241b]/60 pointer-events-none" />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/15 rounded-3xl pointer-events-none" />
                </div>

                {/* Minimalist Bottom Indicator (Dots directly under the photo) */}
                {publishedPhotos.length > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-5 select-none" aria-label="Carousel pagination">
                    {publishedPhotos.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveCarouselIndex(idx)}
                        className={`transition-all duration-300 rounded-full cursor-pointer focus:outline-none ${
                          idx === activeCarouselIndex
                            ? 'w-7 h-2 bg-[#4ADE80] shadow-[0_0_10px_#4ADE80]'
                            : 'w-2 h-2 bg-white/30 hover:bg-white/60'
                        }`}
                        aria-label={`Go to slide ${idx + 1} of ${publishedPhotos.length}`}
                        aria-current={idx === activeCarouselIndex ? 'true' : 'false'}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* RIGHT SIDE: Carousel Caption (Smaller font size, never cuts into the photo) */}
              <div className="lg:col-span-4 flex flex-col justify-center space-y-3 text-left lg:pl-6 z-10">
                <span className="text-[11px] font-bold text-[#4ADE80] uppercase tracking-widest block">
                  Story Details
                </span>
                <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed font-normal max-w-sm">
                  {currentPhoto.caption || 'Hazard magic has Chelsea sitting pretty at the top of the Premier League table with tactical dominance and decisive finishing.'}
                </p>

                {/* Desktop Chevron Next/Prev Controls */}
                {publishedPhotos.length > 1 && (
                  <div className="hidden lg:flex items-center gap-2 pt-4">
                    <button
                      type="button"
                      onClick={prevSlide}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      aria-label="Previous slide"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs tabular-nums text-slate-400 font-semibold px-1">
                      {activeCarouselIndex + 1} / {publishedPhotos.length}
                    </span>
                    <button
                      type="button"
                      onClick={nextSlide}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                      aria-label="Next slide"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================================
          2. HORIZONTAL LINE SEPARATOR
          ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-t border-slate-200 my-8 sm:my-12" />
      </div>

      {/* =========================================================================
          3. VIDEOS AND HIGHLIGHTS SECTION (THUMBNAIL-FIRST DESIGN)
          - Before play: Text-free YouTube thumbnail with central emerald & gold play button
          - When clicked: Replaces thumbnail with native YouTube iframe with autoplay
          - Zero layout shifts (aspect-[16/9])
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
            {/* DESKTOP VIEW: Side-by-Side Multi-Column Grid */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publishedVideos.map((video) => {
                const videoId = extractYouTubeId(video.embedUrl) || extractYouTubeId(video.youtubeUrl);
                const isPlaying = activeVideoId === video.id;

                return (
                  <div
                    key={video.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
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

                          {/* Prominent MshindiRoom-Branded Play Button (Emerald & Gold) */}
                          <button
                            type="button"
                            onClick={() => handlePlayVideo(video)}
                            className="absolute inset-0 flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                            aria-label={`Play ${video.title}`}
                          >
                            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-[#006C54] border-2 border-[#D4AF37] shadow-[0_0_25px_rgba(0,108,84,0.65),0_0_10px_rgba(212,175,55,0.4)] flex items-center justify-center group-hover:scale-110 active:scale-95 transition-all duration-300">
                              <Play size={24} fill="#D4AF37" className="ml-1 text-[#D4AF37]" />
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

            {/* MOBILE VIEW: Sideward Scroll with Smooth Snap & Indicators */}
            <div className="block md:hidden">
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 px-4 sm:px-0 -mx-4 sm:mx-0 no-scrollbar">
                {publishedVideos.map((video, idx) => {
                  const videoId = extractYouTubeId(video.embedUrl) || extractYouTubeId(video.youtubeUrl);
                  const isPlaying = activeVideoId === video.id;

                  return (
                    <div
                      key={video.id}
                      className="w-[84vw] max-w-[340px] shrink-0 snap-center bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col"
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

                            {/* Prominent MshindiRoom-Branded Play Button (Emerald & Gold) */}
                            <button
                              type="button"
                              onClick={() => handlePlayVideo(video)}
                              className="absolute inset-0 flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                              aria-label={`Play ${video.title}`}
                            >
                              <div className="w-14 h-14 rounded-full bg-[#006C54] border-2 border-[#D4AF37] shadow-[0_0_20px_rgba(0,108,84,0.65),0_0_8px_rgba(212,175,55,0.4)] flex items-center justify-center active:scale-95 transition-all">
                                <Play size={20} fill="#D4AF37" className="ml-1 text-[#D4AF37]" />
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
