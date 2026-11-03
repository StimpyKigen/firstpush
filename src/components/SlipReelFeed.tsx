import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, ChevronDown, Layers, X, Bookmark } from 'lucide-react';
import SlipReelCard from './SlipReelCard';
import type { BetSlipPost } from '../lib/betSlipStore';

interface SlipReelFeedProps {
  posts: BetSlipPost[];
  onClose: () => void;
  initialFilter?: 'all' | 'saved';
  isLoading?: boolean;
}

export default function SlipReelFeed({ posts, onClose, initialFilter = 'all', isLoading = false }: SlipReelFeedProps) {
  const [filter, setFilter] = useState<'all' | 'saved'>(initialFilter);
  const reelPosts = posts.filter((p) => p.builtSlip && (filter === 'all' || p.savedByMe));
  const savedCount = posts.filter((p) => p.builtSlip && p.savedByMe).length;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);

  useEffect(() => {
    setPrevIndex(activeIndex);
  }, [activeIndex]);

  // ── Body scroll lock ────────────────────────────────────────────────────────
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
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

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isLoading && reelPosts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-[#FFFFF0] dark:bg-[#202522] flex flex-col items-center justify-center gap-4 p-8 text-slate-900 dark:text-[#F4F5EF]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white dark:bg-[#2A312D] border border-slate-200 dark:border-[#414A43] text-slate-600 dark:text-[#B5BDB6] hover:text-slate-900 dark:hover:text-[#F4F5EF] transition-colors shadow-xs cursor-pointer"
          aria-label="Close Reels"
        >
          <X size={20} />
        </button>
        <div className="w-10 h-10 border-3 border-emerald-600/30 border-t-[#006C54] rounded-full animate-spin" />
        <p className="font-display font-bold text-sm text-slate-700 dark:text-slate-300">
          {filter === 'saved' ? 'Loading Saved Reels...' : 'Loading SlipFeed...'}
        </p>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (reelPosts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-[#FFFFF0] dark:bg-[#202522] flex flex-col items-center justify-center gap-4 p-8 text-slate-900 dark:text-[#F4F5EF]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white dark:bg-[#2A312D] border border-slate-200 dark:border-[#414A43] text-slate-600 dark:text-[#B5BDB6] hover:text-slate-900 dark:hover:text-[#F4F5EF] transition-colors shadow-xs cursor-pointer"
          aria-label="Close Reels"
        >
          <X size={20} />
        </button>
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-[#266E0C]/25 text-[#006C54] flex items-center justify-center shadow-xs">
          {filter === 'saved' ? <Bookmark size={30} className="text-amber-500 fill-amber-500" /> : <Layers size={32} />}
        </div>
        <div className="text-center max-w-xs">
          <p className="font-display font-bold text-xl text-slate-900 dark:text-[#F4F5EF] mb-1">
            {filter === 'saved' ? 'No Saved Slips Yet' : 'No SlipFeed Reels Yet'}
          </p>
          <p className="text-xs text-slate-600 dark:text-[#B5BDB6] leading-relaxed">
            {filter === 'saved'
              ? 'Tap the bookmark icon on any community bet slip in the feed to save it here for fast reference.'
              : 'No Bet Builder slips have been published yet. Build and publish a multi-leg slip to see it featured here!'}
          </p>
        </div>
        {filter === 'saved' ? (
          <button
            onClick={() => setFilter('all')}
            className="mt-2 px-6 py-2.5 bg-[#006C54] text-white font-bold rounded-full text-xs uppercase tracking-wide shadow-xs hover:bg-[#005441] transition-all cursor-pointer"
          >
            Browse Community Slips
          </button>
        ) : (
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2.5 bg-[#006C54] text-white font-bold rounded-full text-xs uppercase tracking-wide shadow-xs hover:bg-[#005441] transition-all cursor-pointer"
          >
            Back to Builder
          </button>
        )}
      </div>
    );
  }


  return (
    /*
     * BACKDROP
     * Mobile  – bg-[#FFFFF0] / dark:bg-[#202522] fills the full visual viewport.
     * Desktop – dark translucent overlay with a centred phone-shaped panel.
     */
    <div className="fixed inset-0 z-50 bg-[#FFFFF0] dark:bg-[#202522] sm:bg-black/75 sm:backdrop-blur-sm sm:flex sm:items-center sm:justify-center">

      {/* Desktop: click backdrop to exit */}
      <div className="hidden sm:block absolute inset-0" onClick={onClose} />

      {/*
       * PANEL
       * Mobile  – fills the entire viewport via w-full h-full.
       * Desktop – 390 × min(90dvh, 820px), rounded, framed.
       */}
      <div
        className={[
          'relative w-full h-full overflow-hidden overflow-x-hidden bg-[#FFFFF0] dark:bg-[#202522] slip-feed-panel',
          'sm:w-[390px] sm:h-[90dvh] sm:max-h-[820px]',
          'sm:rounded-[32px]',
          'sm:border sm:border-slate-200 dark:sm:border-[#414A43]',
          'sm:shadow-[0_24px_80px_-8px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,0,0,0.05)]',
        ].join(' ')}
      >
        <div className="absolute inset-0 bg-[#FFFFF0] dark:bg-[#202522] slip-feed-bg" />

        {/*
         * SCROLL CONTAINER — gesture handling
         */}
        <div
          ref={scrollRef}
          className="slip-feed-scroll w-full h-full overflow-y-scroll overflow-x-hidden"
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
              className="w-full overflow-x-hidden"
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
          className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between gap-2 px-4 bg-[#FFFFF0] dark:bg-[#202522] slip-feed-header pb-2 border-b border-[#E6E6D2]/60 dark:border-[#414A43]/60"
          style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center">
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-[#F4F5EF] tracking-tight leading-none">
              SlipFeed
            </h2>
          </div>

          {reelPosts.length > 1 && (
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto">
              <motion.div
                key={activeIndex}
                initial={{ x: activeIndex > prevIndex ? 5 : activeIndex < prevIndex ? -5 : 0 }}
                animate={{ x: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="flex items-center gap-1.5"
              >
                {(() => {
                  const total = reelPosts.length;
                  if (total === 2) {
                    return [0, 1].map((idx) => (
                      <button
                        key={idx}
                        onClick={() => scrollTo(idx)}
                        aria-label={`Go to slip ${idx + 1}`}
                        className={`rounded-full transition-all shrink-0 ${
                          idx === activeIndex
                            ? 'w-5 h-[5px] bg-[#006C54] dark:bg-[#006C54]'
                            : 'w-[5px] h-[5px] bg-slate-300 dark:bg-[#414A43] hover:bg-slate-400'
                        }`}
                      />
                    ));
                  }

                  // Exactly 3 pills max when total >= 3
                  // When at index 0: left is active
                  // When at index total - 1: right is active
                  // In all middle positions: middle pill is the main active indicator
                  let slots: { targetIdx: number; isActive: boolean }[];
                  if (activeIndex === 0) {
                    slots = [
                      { targetIdx: 0, isActive: true },
                      { targetIdx: 1, isActive: false },
                      { targetIdx: 2, isActive: false },
                    ];
                  } else if (activeIndex === total - 1) {
                    slots = [
                      { targetIdx: total - 3, isActive: false },
                      { targetIdx: total - 2, isActive: false },
                      { targetIdx: total - 1, isActive: true },
                    ];
                  } else {
                    slots = [
                      { targetIdx: activeIndex - 1, isActive: false },
                      { targetIdx: activeIndex, isActive: true },
                      { targetIdx: activeIndex + 1, isActive: false },
                    ];
                  }

                  return slots.map((slot, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => scrollTo(slot.targetIdx)}
                      aria-label={`Go to slip ${slot.targetIdx + 1}`}
                      className={`rounded-full transition-all duration-200 shrink-0 ${
                        slot.isActive
                          ? 'w-5 h-[5px] bg-[#006C54] dark:bg-[#006C54]'
                          : 'w-[5px] h-[5px] bg-slate-300 dark:bg-[#414A43] hover:bg-slate-400'
                      }`}
                    />
                  ));
                })()}
              </motion.div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-[#2A312D] p-0.5 rounded-full border border-slate-300/60 dark:border-[#414A43] text-[11px] font-bold">
              <button
                onClick={() => { setFilter('all'); setActiveIndex(0); }}
                className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer ${
                  filter === 'all'
                    ? 'bg-white dark:bg-[#006C54] text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-[#B5BDB6]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => { setFilter('saved'); setActiveIndex(0); }}
                className={`px-2.5 py-0.5 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                  filter === 'saved'
                    ? 'bg-white dark:bg-[#006C54] text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-[#B5BDB6]'
                }`}
              >
                Saved{savedCount > 0 ? ` (${savedCount})` : ''}
              </button>
            </div>
            <button
              onClick={onClose}
              aria-label="Close SlipFeed"
              className="w-8 h-8 rounded-full bg-white/90 dark:bg-[#2A312D] hover:bg-white dark:hover:bg-[#343C36] text-slate-800 dark:text-[#F4F5EF] border border-slate-200 dark:border-[#414A43] shadow-2xs flex items-center justify-center transition-all active:scale-95 cursor-pointer"
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
            className="w-9 h-9 rounded-full bg-white/95 dark:bg-[#2A312D] hover:bg-white dark:hover:bg-[#343C36] text-slate-800 dark:text-[#F4F5EF] disabled:opacity-20 border border-slate-200 dark:border-[#414A43] shadow-md flex items-center justify-center transition-all cursor-pointer active:scale-95"
          >
            <ChevronUp size={18} />
          </button>
          <button
            onClick={goNext}
            disabled={activeIndex === reelPosts.length - 1}
            aria-label="Next slip"
            className="w-9 h-9 rounded-full bg-white/95 dark:bg-[#2A312D] hover:bg-white dark:hover:bg-[#343C36] text-slate-800 dark:text-[#F4F5EF] disabled:opacity-20 border border-slate-200 dark:border-[#414A43] shadow-md flex items-center justify-center transition-all cursor-pointer active:scale-95"
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
                <ChevronUp size={20} className="text-cream/40 dark:text-white/40" />
              </motion.div>
              <span className="text-[11px] text-cream/40 dark:text-white/40 font-bold tracking-wide uppercase">
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
