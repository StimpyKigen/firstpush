import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, ChevronDown, Layers, X } from 'lucide-react';
import SlipReelCard from './SlipReelCard';
import type { BetSlipPost } from '../lib/betSlipStore';

interface SlipReelFeedProps {
  posts: BetSlipPost[];
  onClose: () => void;
}

export default function SlipReelFeed({ posts, onClose }: SlipReelFeedProps) {
  const reelPosts = posts.filter((p) => p.builtSlip);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);

  // ── Body scroll lock ────────────────────────────────────────────────────────
  // Prevents the page under the overlay from rubber-banding on iOS or
  // intercepting vertical momentum that belongs to the feed.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    // 'none' stops iOS rubber-band bounce on the page root while the feed is open
    body.style.overscrollBehavior = 'none';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  // Hide swipe hint after 2.5 s
  useEffect(() => {
    const t = setTimeout(() => setShowSwipeHint(false), 2500);
    return () => clearTimeout(t);
  }, []);

  // Track which card is in view via IntersectionObserver
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || reelPosts.length === 0) return;

    const children = Array.from(container.children) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idx = children.indexOf(entry.target as HTMLElement);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );

    children.forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [reelPosts.length]);

  // Programmatic scroll to a specific index
  const scrollTo = useCallback((idx: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const child = container.children[idx] as HTMLElement | undefined;
    if (child) child.scrollIntoView({ behavior: 'smooth' });
  }, []);

  function goNext() {
    if (activeIndex < reelPosts.length - 1) scrollTo(activeIndex + 1);
  }
  function goPrev() {
    if (activeIndex > 0) scrollTo(activeIndex - 1);
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (reelPosts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-[#FFFFF0] flex flex-col items-center justify-center gap-4 p-8 text-slate-900">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs cursor-pointer"
          aria-label="Close Reels"
        >
          <X size={20} />
        </button>
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#006C54] flex items-center justify-center shadow-xs">
          <Layers size={32} />
        </div>
        <div className="text-center">
          <p className="font-display font-bold text-xl text-slate-900 mb-1">No SlipFeed Reels Yet</p>
          <p className="text-xs text-slate-600 leading-relaxed max-w-xs">
            No Bet Builder slips have been published yet. Build and publish a multi-leg slip to see it featured here!
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-2 px-6 py-2.5 bg-[#006C54] text-white font-bold rounded-full text-xs uppercase tracking-wide shadow-xs hover:bg-[#005441] transition-all cursor-pointer"
        >
          Back to Builder
        </button>
      </div>
    );
  }

  const showDots = reelPosts.length <= 10;

  return (
    /*
     * BACKDROP
     * Mobile  – bg-[#FFFFF0] fills the full visual viewport (fixed inset-0).
     * Desktop – dark translucent overlay with a centred phone-shaped panel.
     */
    <div className="fixed inset-0 z-50 bg-[#FFFFF0] sm:bg-black/75 sm:backdrop-blur-sm sm:flex sm:items-center sm:justify-center">

      {/* Desktop: click backdrop to exit */}
      <div className="hidden sm:block absolute inset-0" onClick={onClose} />

      {/*
       * PANEL
       * Mobile  – fills the entire viewport via w-full h-full.
       * Desktop – 390 × min(90dvh, 820px), rounded, framed.
       */}
      <div
        className={[
          'relative w-full h-full overflow-hidden bg-[#FFFFF0]',
          'sm:w-[390px] sm:h-[90dvh] sm:max-h-[820px]',
          'sm:rounded-[32px]',
          'sm:border sm:border-slate-200',
          'sm:shadow-[0_24px_80px_-8px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,0,0,0.05)]',
        ].join(' ')}
      >
        <div className="absolute inset-0 bg-[#FFFFF0]" />

        {/*
         * SCROLL CONTAINER — the single source of truth for gesture handling.
         */}
        <div
          ref={scrollRef}
          className="slip-feed-scroll w-full h-full overflow-y-scroll"
          style={{
            touchAction: 'pan-y pinch-zoom',
            overscrollBehaviorY: 'contain',
            scrollSnapType: 'y mandatory',
            willChange: 'scroll-position',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {reelPosts.map((post, i) => (
            <div
              key={post.id}
              style={{
                height: '100%',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                flexShrink: 0,
              }}
            >
              <SlipReelCard
                post={post}
                index={i}
                isActive={i === activeIndex}
                onPrev={goPrev}
                onNext={goNext}
                canPrev={activeIndex > 0}
                canNext={activeIndex < reelPosts.length - 1}
              />
            </div>
          ))}
        </div>

        {/* ── TOP BAR (SlipFeed Header) ──────────────────────────────── */}
        <div
          className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-4 bg-[#FFFFF0] pb-2"
          style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center">
            <h2 className="font-display font-bold text-xl text-slate-900 tracking-tight leading-none">
              SlipFeed
            </h2>
          </div>

          {showDots && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 justify-center pointer-events-auto">
              {reelPosts.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  aria-label={`Go to slip ${i + 1}`}
                  className={`rounded-full transition-all shrink-0 ${
                    i === activeIndex
                      ? 'w-5 h-[5px] bg-[#006C54]'
                      : 'w-[5px] h-[5px] bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="Close SlipFeed"
              className="w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-800 border border-slate-200 shadow-2xs flex items-center justify-center transition-all active:scale-95 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Desktop floating scroll arrows */}
        <div className="hidden sm:flex absolute -right-14 top-1/2 -translate-y-1/2 flex-col gap-2 z-40">
          <button
            onClick={goPrev}
            disabled={activeIndex === 0}
            aria-label="Previous slip"
            className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-slate-800 disabled:opacity-20 border border-slate-200 shadow-md flex items-center justify-center transition-all cursor-pointer active:scale-95"
          >
            <ChevronUp size={18} />
          </button>
          <button
            onClick={goNext}
            disabled={activeIndex === reelPosts.length - 1}
            aria-label="Next slip"
            className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-slate-800 disabled:opacity-20 border border-slate-200 shadow-md flex items-center justify-center transition-all cursor-pointer active:scale-95"
          >
            <ChevronDown size={18} />
          </button>
        </div>


        {/* ── SWIPE HINT (mobile only) ─────────────────────────────────────── */}
        <AnimatePresence>
          {showSwipeHint && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.4 }}
              className="sm:hidden absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-0.5 pointer-events-none"
            >
              <motion.div
                animate={{ y: [0, -7, 0] }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
              >
                <ChevronUp size={20} className="text-cream/40" />
              </motion.div>
              <span className="text-[11px] text-cream/40 font-bold tracking-wide uppercase">
                Swipe to explore
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <style>{`.slip-feed-scroll::-webkit-scrollbar { display: none; }`}</style>
      </div>
    </div>
  );
}
