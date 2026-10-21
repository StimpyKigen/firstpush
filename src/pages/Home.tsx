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
          Desktop: Side-by-Side Cards Grid | Mobile: 9:16 Touch Swipe Carousel
          Photos display gracefully in full without cropping.
          ========================================================================= */}
      {publishedPhotos.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
          <div className="text-center sm:text-left mb-6">
            <span className="text-[#006C54] font-bold text-xs uppercase tracking-wider block mb-1">
              Weekly Editorial News
            </span>
            <h1 className="font-extrabold sm:font-black text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
              Top Stories &amp; Matchday Perspectives
            </h1>
          </div>

          {/* DESKTOP VIEW: Side-by-Side Multi-Column Cards */}
          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publishedPhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative w-full aspect-[4/5] lg:aspect-[3/4] rounded-3xl overflow-hidden bg-slate-950 shadow-lg border border-slate-800/50 flex items-center justify-center group transition-all duration-300 hover:shadow-2xl select-none"
              >
                {/* Ambient blurred backdrop so any aspect ratio blends seamlessly */}
                <img
                  src={photo.imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover filter blur-2xl opacity-25 scale-110 pointer-events-none"
                />

                {/* Crisp Full Uncropped Image */}
                <img
                  src={photo.imageUrl}
                  alt={photo.caption || 'Editorial news story'}
                  className="relative z-10 w-full h-full object-contain p-2.5 transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                  draggable={false}
                />

                {/* Bottom Scrim for Caption Legibility */}
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />

                {/* Bottom Foreground Caption (Pill omitted per instructions) */}
                {photo.caption && (
                  <div className="absolute bottom-5 left-5 right-5 z-20">
                    <p className="text-white font-semibold text-sm lg:text-base leading-snug drop-shadow-sm line-clamp-3">
                      {photo.caption}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* MOBILE VIEW: Touch Swipe Carousel */}
          <div className="block md:hidden">
            <div className="relative mx-auto w-full max-w-[340px] sm:max-w-[380px] aspect-[4/5] sm:aspect-[9/16] max-h-[72vh] rounded-3xl overflow-hidden bg-slate-950 shadow-xl group select-none">
              {/* Touch Swipe Surface */}
              <div
                className="w-full h-full relative flex items-center justify-center"
                onTouchStart={handlePhotoTouchStart}
                onTouchMove={handlePhotoTouchMove}
                onTouchEnd={handlePhotoTouchEnd}
              >
                {/* Ambient blurred backdrop */}
                <img
                  src={publishedPhotos[carouselIndex]?.imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover filter blur-2xl opacity-25 scale-110 pointer-events-none"
                />

                {/* Crisp Uncropped Carousel Slide Image */}
                <img
                  src={publishedPhotos[carouselIndex]?.imageUrl}
                  alt={publishedPhotos[carouselIndex]?.caption || 'Homepage editorial'}
                  className="relative z-10 w-full h-full object-contain p-2.5 transition-all duration-500 ease-out"
                  draggable={false}
                />

                {/* Bottom Scrim for Caption Legibility */}
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none" />

                {/* Bottom Foreground Caption (Pill omitted per instructions) */}
                {publishedPhotos[carouselIndex]?.caption && (
                  <div className="absolute bottom-5 left-5 right-5 z-20">
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
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-900 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md cursor-pointer z-30"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={nextPhoto}
                      aria-label="Next slide"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/85 hover:bg-white text-slate-900 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md cursor-pointer z-30"
                    >
                      <ChevronRight size={18} />
                    </button>

                    {/* Dot Indicators */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 z-30">
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
          Desktop: Side-by-Side Grid | Mobile: Sideward Swipe Scroll
          'Match video hub' omitted, Thicker Heading applied
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="text-center sm:text-left mb-6 sm:mb-8">
          <h2 className="font-extrabold sm:font-black text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
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
              {publishedVideos.map((video) => (
                <div
                  key={video.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="relative w-full aspect-[16/9] bg-black overflow-hidden">
                    <iframe
                      src={video.embedUrl}
                      title={video.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      className="w-full h-full border-0"
                    />
                  </div>
                  <div className="p-4 flex items-start gap-2.5 flex-1 bg-white">
                    <div className="mt-0.5 text-[#006C54] shrink-0">
                      <Play size={15} fill="currentColor" />
                    </div>
                    <h3 className="font-semibold text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2">
                      {video.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>

            {/* MOBILE VIEW: Sideward Scroll with Smooth Snap & Indicators */}
            <div className="block md:hidden">
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 px-4 sm:px-0 -mx-4 sm:mx-0 no-scrollbar">
                {publishedVideos.map((video, idx) => (
                  <div
                    key={video.id}
                    className="w-[84vw] max-w-[340px] shrink-0 snap-center bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col"
                  >
                    <div className="relative w-full aspect-[16/9] bg-black overflow-hidden">
                      <iframe
                        src={video.embedUrl}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                        className="w-full h-full border-0"
                      />
                    </div>
                    <div className="p-3.5 flex items-center justify-between gap-3 bg-white">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="mt-0.5 text-[#006C54] shrink-0">
                          <Play size={14} fill="currentColor" />
                        </div>
                        <h3 className="font-semibold text-xs text-slate-900 leading-snug truncate">
                          {video.title}
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-slate-400 shrink-0">
                        {idx + 1}/{publishedVideos.length}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
