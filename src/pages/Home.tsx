import React, { useState, useMemo, useSyncExternalStore, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import {
  subscribeToHomepageFeed,
  getHomepageFeedSnapshot,
} from '../lib/homepageFeedStore';
import AccordionGallery, { type AccordionGalleryItem } from '../components/AccordionGallery';

export default function Home() {
  // Subscribe to live homepage feed store
  const feed = useSyncExternalStore(
    subscribeToHomepageFeed,
    getHomepageFeedSnapshot,
    getHomepageFeedSnapshot
  );

  const publishedPhotos = feed.carouselItems.filter((i) => i.published);
  const publishedVideos = feed.videoItems.filter((v) => v.published);

  // Map published photos to AccordionGallery items
  const galleryItems: AccordionGalleryItem[] = useMemo(
    () =>
      publishedPhotos.map((photo) => ({
        image: photo.imageUrl,
        label: photo.caption || '',
        link: photo.link || undefined,
        alt: photo.caption || 'Top story editorial',
      })),
    [publishedPhotos]
  );

  // Videos carousel slide index
  const [videoIndex, setVideoIndex] = useState(0);

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

  // Video Touch Listeners
  const videoTouchStartX = useRef<number | null>(null);
  const videoTouchEndX = useRef<number | null>(null);
  const minSwipeDistance = 45;
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
          "description": "Kenya's Premier Jackpot Consensus & Football Community Platform",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://mshindi.co.ke/free?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />

      {/* =========================================================================
          1. WEEKLY EDITORIAL NEWS (ACCORDION GALLERY CAROUSEL)
          Integrated React Bits AccordionGallery with interactive expand & touch control
          ========================================================================= */}
      {galleryItems.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
          <div className="text-left mb-6">
            <span className="text-[#006C54] font-bold text-xs uppercase tracking-wide block mb-1">
              Weekly Editorial News
            </span>
            <h1 className="font-bold sm:font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
              Top Stories &amp; Matchday Perspectives
            </h1>
          </div>

          <AccordionGallery
            items={galleryItems}
            defaultIndex={0}
            accentColor="#006C54"
            overlayColor="#060010"
            textColor="#ffffff"
            height={480}
            gap={12}
            radius={24}
            expandRatio={0.75}
            duration={0.55}
            ease="power3.out"
            parallax={0.5}
            tilt={8}
            stagger={0.05}
            showLabels={true}
            grayscale={true}
            className="w-full bg-transparent"
          />
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
                      <span className="text-[11px] tabular-nums font-semibold text-slate-400 shrink-0">
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
