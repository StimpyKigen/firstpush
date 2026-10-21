import { useState, useSyncExternalStore, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { SkeletonImage } from '../components/skeleton';
import {
  subscribeToHomepageFeed,
  getHomepageFeedSnapshot,
} from '../lib/homepageFeedStore';

export default function Home() {
  const [heroSlide, setHeroSlide] = useState(0);

  // Subscribe to live homepage feed store
  const feed = useSyncExternalStore(
    subscribeToHomepageFeed,
    getHomepageFeedSnapshot,
    getHomepageFeedSnapshot
  );

  const publishedPhotos = feed.carouselItems.filter((i) => i.published);
  const publishedVideos = feed.videoItems.filter((v) => v.published);

  // Carousel slide index
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Auto-advance carousel smoothly if more than 1 photo
  useEffect(() => {
    if (publishedPhotos.length <= 1) return;
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % publishedPhotos.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [publishedPhotos.length]);

  const nextSlide = () => {
    if (publishedPhotos.length > 0) {
      setCarouselIndex((prev) => (prev + 1) % publishedPhotos.length);
    }
  };

  const prevSlide = () => {
    if (publishedPhotos.length > 0) {
      setCarouselIndex((prev) => (prev - 1 + publishedPhotos.length) % publishedPhotos.length);
    }
  };

  return (
    <div className="bg-[#FFFFF0] text-slate-900">
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
          1. HERO EDITORIAL SHOWCASE
          Left: Striker action cutout with slide dots
          Right: Headline, lead story, buttons & previews
          ========================================================================= */}
      <section className="bg-white border-b border-slate-200 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
            
            {/* Left Column: Striker Photo & Slide Indicators */}
            <div className="lg:col-span-5 relative flex flex-col items-center justify-center">
              <div className="relative w-full max-w-md lg:max-w-none rounded-3xl overflow-hidden aspect-[4/5] sm:aspect-[3/4] bg-[#0a1317] group">
                <SkeletonImage
                  src="/images/hero-striker.jpg"
                  alt="Dynamic Football Striker in Action"
                  className="w-full h-full object-cover object-top filter contrast-105 group-hover:scale-105 transition-transform duration-500"
                  containerClassName="w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
                
                {/* Overlay match badge */}
                <div className="absolute top-4 left-4">
                  <span className="bg-[#EEAA04] text-[#0a1317] text-xs font-bold px-3 py-1 rounded-full">
                    Featured match
                  </span>
                </div>

                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <p className="text-xs uppercase tracking-widest text-slate-300 font-bold">Chelsea FC vs Arsenal</p>
                  <p className="font-display font-black text-xl leading-tight text-white mt-1">Hazard magic has Chelsea sitting pretty</p>
                  <p className="text-xs text-slate-300 mt-1">Stamford Bridge · Premier League Derby</p>
                </div>
              </div>

              {/* Slide Indicators */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => setHeroSlide(0)}
                  className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${heroSlide === 0 ? 'bg-[#006C54] w-6' : 'bg-slate-300 hover:bg-slate-400'}`}
                  aria-label="Slide 1"
                />
                <button
                  onClick={() => setHeroSlide(1)}
                  className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${heroSlide === 1 ? 'bg-[#006C54] w-6' : 'bg-slate-300 hover:bg-slate-400'}`}
                  aria-label="Slide 2"
                />
                <button
                  onClick={() => setHeroSlide(2)}
                  className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${heroSlide === 2 ? 'bg-[#006C54] w-6' : 'bg-slate-300 hover:bg-slate-400'}`}
                  aria-label="Slide 3"
                />
              </div>
            </div>

            {/* Right Column: Editorial Typography, CTA Button & Floating Thumbnail Previews */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <span className="inline-block text-[#006C54] font-bold text-sm mb-2">
                Top story & consensus
              </span>

              <h1 className="font-display font-medium text-4xl sm:text-5xl lg:text-6xl text-[#0a1317] leading-[1.16]">
                Hazard magic has Chelsea sitting pretty
              </h1>

              <p className="text-[#444950] text-base sm:text-lg mt-4 leading-relaxed max-w-2xl font-normal">
                Chelsea have maintained their lead in the race for the English Premier League title with Tottenham seemingly the only team close enough to catch them. On MshindiRoom, community consensus is rallying behind another dominant weekend slate.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-8">
                <Link
                  to="/leaderboard"
                  className="btn-primary"
                >
                  <span>Jackpot rooms</span>
                  <ArrowRight size={15} />
                </Link>
                <Link
                  to="/free"
                  className="btn-secondary"
                >
                  <span>Free Matches</span>
                </Link>
              </div>

              {/* Floating Match Thumbnail Previews underneath */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Live Highlights &amp; Slates</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="relative rounded-xl overflow-hidden aspect-[16/10] border border-slate-200 group cursor-pointer shadow-xs">
                    <SkeletonImage
                      src="/images/celebration.jpg"
                      alt="Match 1"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      containerClassName="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <span className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white truncate z-10">Liverpool vs Man City</span>
                  </div>
                  <div className="relative rounded-xl overflow-hidden aspect-[16/10] border border-slate-200 group cursor-pointer shadow-xs">
                    <SkeletonImage
                      src="/images/midfielder.jpg"
                      alt="Match 2"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      containerClassName="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <span className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white truncate z-10">Barcelona vs Arsenal</span>
                  </div>
                  <div className="relative rounded-xl overflow-hidden aspect-[16/10] border border-slate-200 group cursor-pointer shadow-xs">
                    <SkeletonImage
                      src="/images/match-action.jpg"
                      alt="Match 3"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      containerClassName="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <span className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white truncate z-10">Everton vs Porto</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          2. WEEKLY NEWS CAROUSEL PHOTOS SECTION (Photo + Bottom Foreground Caption)
          ========================================================================= */}
      {publishedPhotos.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 gap-2">
            <div>
              <span className="text-[#006C54] font-bold text-xs uppercase tracking-wider block mb-1">
                Weekly Editorial News
              </span>
              <h2 className="font-semibold text-2xl sm:text-3xl text-slate-900 tracking-tight">
                Top Stories &amp; Matchday Perspectives
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md">
              Visual dispatches and breaking tactical insights curated for Kenya&apos;s punter community.
            </p>
          </div>

          <div className="relative rounded-3xl overflow-hidden aspect-[16/9] sm:aspect-[21/9] bg-slate-900 shadow-md group">
            {/* Carousel Slide Image */}
            <img
              src={publishedPhotos[carouselIndex]?.imageUrl}
              alt={publishedPhotos[carouselIndex]?.caption || 'Homepage editorial'}
              className="w-full h-full object-cover transition-all duration-700 ease-out"
            />

            {/* Apple-style Scrim Overlay for Crystal-Clear Bottom Foreground Caption */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

            {/* Bottom Foreground Caption */}
            {publishedPhotos[carouselIndex]?.caption && (
              <div className="absolute bottom-6 sm:bottom-8 left-6 sm:left-8 right-6 sm:right-8 z-10 max-w-3xl">
                <span className="inline-block text-[#006C54] bg-white text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-2 shadow-xs">
                  Weekly Spotlight
                </span>
                <p className="text-white font-semibold text-lg sm:text-2xl md:text-3xl leading-snug drop-shadow-sm">
                  {publishedPhotos[carouselIndex].caption}
                </p>
              </div>
            )}

            {/* Previous & Next Slide Controls */}
            {publishedPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevSlide}
                  aria-label="Previous slide"
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-slate-900 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md cursor-pointer z-20"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={nextSlide}
                  aria-label="Next slide"
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-slate-900 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-md cursor-pointer z-20"
                >
                  <ChevronRight size={20} />
                </button>

                {/* Dot Indicators */}
                <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-1.5 z-20">
                  {publishedPhotos.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCarouselIndex(idx)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        idx === carouselIndex ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          3. HORIZONTAL LINE SEPARATOR
          ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-t border-slate-200 my-10 sm:my-14" />
      </div>

      {/* =========================================================================
          4. VIDEOS AND HIGHLIGHTS SECTION
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 gap-2">
          <div>
            <span className="text-[#006C54] font-bold text-xs uppercase tracking-wider block mb-1">
              Match Video Hub
            </span>
            <h2 className="font-semibold text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Videos and Highlights
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md">
            Official match recaps, weekly video roundups, and tactical consensus breakdowns.
          </p>
        </div>

        {publishedVideos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs">
            No video highlights published yet. Admin can publish videos via the Admin Console.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {publishedVideos.map((video) => (
              <div
                key={video.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div className="relative aspect-video bg-black overflow-hidden">
                  <iframe
                    src={video.embedUrl}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                    className="w-full h-full border-0"
                  />
                </div>

                <div className="p-4 sm:p-5 flex items-start gap-3">
                  <div className="mt-0.5 text-[#006C54] shrink-0">
                    <Play size={16} fill="currentColor" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900 leading-snug">
                      {video.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 font-medium">
                      Featured Mshindi Match Highlight
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
