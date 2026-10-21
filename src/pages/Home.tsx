import React, { useState, useSyncExternalStore, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import {
  subscribeToHomepageFeed,
  getHomepageFeedSnapshot,
} from '../lib/homepageFeedStore';

export default function Home() {
  // Subscribe to live homepage feed store
  const feed = useSyncExternalStore(
    subscribeToHomepageFeed,
    getHomepageFeedSnapshot,
    getHomepageFeedSnapshot
  );

  const publishedPhotos = feed.carouselItems.filter((i) => i.published);
  const publishedVideos = feed.videoItems.filter((v) => v.published);

  // Carousel photo slide index
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Videos carousel slide index
  const [videoIndex, setVideoIndex] = useState(0);

  // Touch swipe tracking for Photo Carousel
  const photoTouchStartX = useRef<number | null>(null);
  const photoTouchEndX = useRef<number | null>(null);

  // Touch swipe tracking for Video Section
  const videoTouchStartX = useRef<number | null>(null);
  const videoTouchEndX = useRef<number | null>(null);

  const minSwipeDistance = 45; // Minimum px distance to trigger swipe

  // Auto-advance photo carousel if multiple photos exist
  useEffect(() => {
    if (publishedPhotos.length <= 1) return;
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % publishedPhotos.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [publishedPhotos.length]);

  const nextPhoto = () => {
    if (publishedPhotos.length > 0) {
      setCarouselIndex((prev) => (prev + 1) % publishedPhotos.length);
    }
  };

  const prevPhoto = () => {
    if (publishedPhotos.length > 0) {
      setCarouselIndex((prev) => (prev - 1 + publishedPhotos.length) % publishedPhotos.length);
    }
  };

  const nextVideo = () => {
    if (publishedVideos.length > 0) {
      setVideoIndex((prev) => (prev + 1) % publishedVideos.length);
    }
  };

  const prevVideo = () => {
    if (publishedVideos.length > 0) {
      setVideoIndex((prev) => (prev - 1 + publishedVideos.length) % publishedVideos.length);
    }
  };

  // Photo Touch Listeners
  const handlePhotoTouchStart = (e: React.TouchEvent) => {
    photoTouchEndX.current = null;
    photoTouchStartX.current = e.targetTouches[0].clientX;
  };

  const handlePhotoTouchMove = (e: React.TouchEvent) => {
    photoTouchEndX.current = e.targetTouches[0].clientX;
  };

  const handlePhotoTouchEnd = () => {
    if (photoTouchStartX.current === null || photoTouchEndX.current === null) return;
    const distance = photoTouchStartX.current - photoTouchEndX.current;
    if (distance > minSwipeDistance) {
      nextPhoto();
    } else if (distance < -minSwipeDistance) {
      prevPhoto();
    }
  };

  // Video Touch Listeners
  const handleVideoTouchStart = (e: React.TouchEvent) => {
    videoTouchEndX.current = null;
    videoTouchStartX.current = e.targetTouches[0].clientX;
  };

  const handleVideoTouchMove = (e: React.TouchEvent) => {
    videoTouchEndX.current = e.targetTouches[0].clientX;
  };

  const handleVideoTouchEnd = () => {
    if (videoTouchStartX.current === null || videoTouchEndX.current === null) return;
    const distance = videoTouchStartX.current - videoTouchEndX.current;
    if (distance > minSwipeDistance) {
      nextVideo();
    } else if (distance < -minSwipeDistance) {
      prevVideo();
    }
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
          "description": "Kenya's Premier Jackpot Consensus & P2P Betting Community Platform",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://mshindi.co.ke/free?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />

      {/* =========================================================================
          1. WEEKLY EDITORIAL NEWS (NEW FIRST SECTION)
          9:16 Aspect Ratio Photo Carousel with Touch Side-Swiping
          ========================================================================= */}
      {publishedPhotos.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
          <div className="text-center sm:text-left mb-5">
            <span className="text-[#006C54] font-bold text-xs uppercase tracking-wider block mb-1">
              Weekly Editorial News
            </span>
            <h1 className="font-semibold text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Top Stories &amp; Matchday Perspectives
            </h1>
          </div>

          {/* 9:16 Carousel Container - max 3/4 viewport height on mobile (max-h-[72vh]), not chunky */}
          <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[380px] aspect-[9/16] max-h-[72vh] rounded-3xl overflow-hidden bg-slate-950 shadow-xl group select-none">
            {/* Touch Swipe Surface */}
            <div
              className="w-full h-full relative"
              onTouchStart={handlePhotoTouchStart}
              onTouchMove={handlePhotoTouchMove}
              onTouchEnd={handlePhotoTouchEnd}
            >
              {/* Carousel Slide Image */}
              <img
                src={publishedPhotos[carouselIndex]?.imageUrl}
                alt={publishedPhotos[carouselIndex]?.caption || 'Homepage editorial'}
                className="w-full h-full object-cover transition-all duration-500 ease-out"
                draggable={false}
              />

              {/* Bottom Scrim for Caption Legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none" />

              {/* Bottom Foreground Caption */}
              {publishedPhotos[carouselIndex]?.caption && (
                <div className="absolute bottom-5 left-5 right-5 z-10">
                  <span className="inline-block text-[#006C54] bg-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider mb-2 shadow-xs">
                    Weekly Spotlight
                  </span>
                  <p className="text-white font-semibold text-sm sm:text-base leading-snug drop-shadow-sm line-clamp-4">
                    {publishedPhotos[carouselIndex].caption}
                  </p>
                </div>
              )}

              {/* Slide Navigation Chevrons */}
              {publishedPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevPhoto}
                    aria-label="Previous slide"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-900 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md cursor-pointer z-20"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={nextPhoto}
                    aria-label="Next slide"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-900 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md cursor-pointer z-20"
                  >
                    <ChevronRight size={18} />
                  </button>

                  {/* Dot Indicators */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 z-20">
                    {publishedPhotos.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCarouselIndex(idx)}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          idx === carouselIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                        }`}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
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
          3. VIDEOS AND HIGHLIGHTS SECTION
          Acceptable Sizing: Mobile 360 x 202.5 px with Touch Side-Swiping
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="text-center sm:text-left mb-6 sm:mb-8">
          <span className="text-[#006C54] font-bold text-xs uppercase tracking-wider block mb-1">
            Match Video Hub
          </span>
          <h2 className="font-semibold text-2xl sm:text-3xl text-slate-900 tracking-tight">
            Videos and Highlights
          </h2>
        </div>

        {publishedVideos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs max-w-md mx-auto shadow-2xs">
            No video highlights published yet. Admin can publish videos via the Admin Console.
          </div>
        ) : publishedVideos.length === 1 ? (
          /* Single Video Display - Mobile 360 x 202.5 px */
          <div className="w-full max-w-[360px] sm:max-w-[480px] mx-auto bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="relative w-full aspect-[16/9] bg-black overflow-hidden">
              <iframe
                src={publishedVideos[0].embedUrl}
                title={publishedVideos[0].title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="w-full h-full border-0"
              />
            </div>
            <div className="p-4 flex items-start gap-2.5">
              <div className="mt-0.5 text-[#006C54] shrink-0">
                <Play size={15} fill="currentColor" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-xs sm:text-sm text-slate-900 leading-snug">
                  {publishedVideos[0].title}
                </h3>
              </div>
            </div>
          </div>
        ) : (
          /* Multiple Videos - Side-Swiping Carousel with 360 x 202.5 px Mobile Sizing */
          <div className="relative w-full max-w-[360px] sm:max-w-[500px] mx-auto group select-none">
            <div
              className="w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
              onTouchStart={handleVideoTouchStart}
              onTouchMove={handleVideoTouchMove}
              onTouchEnd={handleVideoTouchEnd}
            >
              {/* Active Video Iframe (Exact 16:9 / 360 x 202.5 px on mobile) */}
              <div className="relative w-full aspect-[16/9] bg-black overflow-hidden">
                <iframe
                  key={publishedVideos[videoIndex]?.id}
                  src={publishedVideos[videoIndex]?.embedUrl}
                  title={publishedVideos[videoIndex]?.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  className="w-full h-full border-0 transition-opacity duration-300"
                />
              </div>

              {/* Title & Controls Bar */}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5 text-[#006C54] shrink-0">
                    <Play size={15} fill="currentColor" />
                  </div>
                  <h3 className="font-semibold text-xs sm:text-sm text-slate-900 leading-snug truncate">
                    {publishedVideos[videoIndex]?.title}
                  </h3>
                </div>

                <div className="text-[11px] font-mono font-semibold text-slate-400 shrink-0">
                  {videoIndex + 1} / {publishedVideos.length}
                </div>
              </div>
            </div>

            {/* Navigation Buttons for Video Carousel */}
            <button
              type="button"
              onClick={prevVideo}
              aria-label="Previous video"
              className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-800 flex items-center justify-center shadow-md border border-slate-200 cursor-pointer z-10 transition-transform active:scale-90"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={nextVideo}
              aria-label="Next video"
              className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 hover:bg-white text-slate-800 flex items-center justify-center shadow-md border border-slate-200 cursor-pointer z-10 transition-transform active:scale-90"
            >
              <ChevronRight size={16} />
            </button>

            {/* Dot Indicators */}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {publishedVideos.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setVideoIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === videoIndex ? 'w-5 bg-[#006C54]' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                  }`}
                  aria-label={`Go to video ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
