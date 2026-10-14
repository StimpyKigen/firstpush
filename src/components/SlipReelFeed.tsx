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
      <div className="fixed inset-0 z-50 bg-ink flex flex-col items-center justify-center gap-4 p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-panel border border-line text-cream-dim hover:text-cream transition-colors"
          aria-label="Close SlipFeed"
        >
          <X size={20} />
        </button>
        <Layers size={52} className="text-cream-dim/20" />
        <div className="text-center">
          <p className="font-display font-extrabold text-lg text-cream mb-1">No SlipFeed Posts Yet</p>
          <p className="text-sm text-cream-dim leading-relaxed max-w-xs">
            No Bet Builder slips have been published yet. Build and publish a multi-leg slip to see it here!
          </p>
        </div>
        <button
          onClick={onClose}
          className="mt-2 px-5 py-2.5 bg-gold text-ink font-bold rounded-full text-sm"
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
     * Mobile  – bg-ink fills the full visual viewport (fixed inset-0).
     *           `fixed` + `inset-0` already tracks the dynamic viewport so
     *           we get the correct size even when the iOS address bar animates.
     * Desktop – dark translucent overlay with a centred phone-shaped panel.
     */
    <div className="fixed inset-0 z-50 bg-ink sm:bg-black/80 sm:backdrop-blur-sm sm:flex sm:items-center sm:justify-center">

      {/* Desktop: click backdrop to exit */}
      <div className="hidden sm:block absolute inset-0" onClick={onClose} />

      {/*
       * PANEL
       * Mobile  – fills the entire viewport via w-full h-full.
       * Desktop – 390 × min(90dvh, 820px), rounded, framed.
       */}
      <div
        className={[
          'relative w-full h-full overflow-hidden',
          'sm:w-[390px] sm:h-[90dvh] sm:max-h-[820px]',
          'sm:rounded-[32px]',
          'sm:border sm:border-white/[0.07]',
          'sm:shadow-[0_24px_80px_-8px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.04)]',
        ].join(' ')}
      >
        <div className="absolute inset-0 bg-ink" />

        {/*
         * SCROLL CONTAINER — the single source of truth for gesture handling.
         *
         * Key gesture properties (order matters):
         *
         * touch-action: pan-y pinch-zoom
         *   Tells the browser immediately that vertical panning is ours.
         *   Without this, iOS/Android spend the first gesture frame deciding
         *   whether it's horizontal or vertical — causing the "dead first swipe".
         *   pan-y means: the browser handles vertical scroll natively (fast-path),
         *   we never intercept touch events ourselves.
         *   pinch-zoom preserves the default pinch-to-zoom behaviour.
         *   NOTE: this does NOT interfere with iOS edge-swipe back (that is
         *   captured by the OS before the browser sees any touch event) or
         *   Android bottom gesture navigation (same OS-level pre-capture).
         *
         * overscroll-behavior-y: contain
         *   At the top card (index 0) swiping DOWN would normally trigger
         *   pull-to-refresh or bounce the page — contain stops that propagation.
         *   At the last card swiping UP gets the same containment.
         *   Combined with the body scroll lock above, there is zero rubber-band
         *   leakage to the page underneath.
         *
         * scroll-snap-type: y mandatory
         *   Every gesture lands exactly on a card boundary.
         *   scroll-snap-stop: always (on each child) means a fast fling still
         *   only advances one card — same UX as TikTok/Reels.
         *
         * will-change: scroll-position
         *   Hints to the compositor to promote the layer, so scroll-snap
         *   animations are GPU-accelerated on both iOS and Android.
         *
         * scrollbarWidth: none + WebKit rule
         *   Cosmetic — hides the scrollbar track on all browsers.
         *
         * We intentionally do NOT add onTouchStart/onTouchMove/onTouchEnd
         * handlers. Native scroll + touch-action is always faster and more
         * reliable than JS gesture interception.
         */}
        <div
          ref={scrollRef}
          className="slip-feed-scroll w-full h-full overflow-y-scroll"
          style={{
            // Gesture handling
            touchAction: 'pan-y pinch-zoom',
            overscrollBehaviorY: 'contain',
            // Snap behaviour
            scrollSnapType: 'y mandatory',
            // GPU hint
            willChange: 'scroll-position',
            // Scrollbar hide (Firefox + Safari legacy)
            scrollbarWidth: 'none',
            // iOS momentum scrolling (still beneficial on older WebKit)
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {reelPosts.map((post, i) => (
            <div
              key={post.id}
              style={{
                // 100% of the panel (desktop) or viewport (mobile) — never 100dvh
                // so the card always fits inside whatever container it lives in.
                height: '100%',
                // Snap properties on each child:
                scrollSnapAlign: 'start',
                // 'always' = one card per swipe even on a fast fling
                scrollSnapStop: 'always',
                flexShrink: 0,
              }}
            >
              <SlipReelCard post={post} index={i} isActive={i === activeIndex} />
            </div>
          ))}
        </div>

        {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
        <div
          className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between gap-2 px-3 sm:px-4"
          style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-2.5 py-1.5 shrink-0">
            <Layers size={11} className="text-gold" />
            <span className="text-[11px] font-extrabold text-cream font-mono tracking-wide">
              {activeIndex + 1}/{reelPosts.length}
            </span>
          </div>

          {showDots && (
            <div className="flex items-center gap-1 justify-center flex-1 overflow-hidden">
              {reelPosts.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollTo(i)}
                  aria-label={`Go to slip ${i + 1}`}
                  className={`rounded-full transition-all shrink-0 ${
                    i === activeIndex
                      ? 'w-4 h-[5px] bg-gold'
                      : 'w-[5px] h-[5px] bg-cream/30 hover:bg-cream/60'
                  }`}
                />
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            aria-label="Close SlipFeed"
            className="flex items-center gap-1 bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-2.5 py-1.5 text-cream-dim hover:text-cream transition-colors shrink-0"
          >
            <X size={13} />
            <span className="text-[11px] font-bold">Exit</span>
          </button>
        </div>

        {/* ── DESKTOP NAV ARROWS ───────────────────────────────────────────── */}
        <div className="hidden sm:flex flex-col items-center gap-2 absolute right-3 top-1/2 -translate-y-1/2 z-20">
          <button
            onClick={goPrev}
            disabled={activeIndex === 0}
            aria-label="Previous slip"
            className="p-2.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-cream-dim hover:text-cream disabled:opacity-25 transition-all hover:scale-105 active:scale-95"
          >
            <ChevronUp size={17} />
          </button>
          <button
            onClick={goNext}
            disabled={activeIndex === reelPosts.length - 1}
            aria-label="Next slip"
            className="p-2.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-cream-dim hover:text-cream disabled:opacity-25 transition-all hover:scale-105 active:scale-95"
          >
            <ChevronDown size={17} />
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
              <span className="text-[10px] text-cream/40 font-bold tracking-widest uppercase">
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
