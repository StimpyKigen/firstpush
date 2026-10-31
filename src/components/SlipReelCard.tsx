import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart, Bookmark, Send,
  Copy, Check, ExternalLink, Clock,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import Avatar from './Avatar';
import { useBetSlipStore, type BetSlipPost, type BuiltSlipLeg } from '../lib/betSlipStore';
import { useCountdown } from '../lib/useCountdown';
import { getEarliestKickoff } from '../lib/kickoffParser';
import { showToast } from '../lib/notificationStore';
import { useFollowStore } from '../lib/followStore';
import { useCurrentUser } from '../lib/authStore';

interface SlipReelCardProps {
  post: BetSlipPost;
  index: number;
  isActive: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
}

export default function SlipReelCard({
  post,
  isActive,
}: SlipReelCardProps) {
  const toggleLike = useBetSlipStore((s) => s.toggleLike);
  const toggleSave = useBetSlipStore((s) => s.toggleSave);
  const incrementShare = useBetSlipStore((s) => s.incrementShare);

  const currentUser = useCurrentUser();
  const currentUsername = currentUser?.username || '';
  const isFollowing = useFollowStore((s) => s.isFollowing);
  const followUser = useFollowStore((s) => s.followUser);
  const unfollowUser = useFollowStore((s) => s.unfollowUser);

  const isSelf = currentUsername.toLowerCase() === post.postedBy.toLowerCase();
  const following = currentUsername ? isFollowing(currentUsername, post.postedBy) : false;

  const slip = post.builtSlip!;
  const legs = slip.legs ?? [];

  const earliestKickoff = getEarliestKickoff(legs);
  const countdown = useCountdown(earliestKickoff);

  const [copiedCode, setCopiedCode] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [likePop, setLikePop] = useState(false);
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Group fixtures into chunks of max 8 per slide for the horizontal swipe carousel
  const fixtureChunks = useMemo(() => {
    const chunks: BuiltSlipLeg[][] = [];
    for (let i = 0; i < legs.length; i += 8) {
      chunks.push(legs.slice(i, i + 8));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [legs]);

  const scrollToChunk = (chunkIndex: number) => {
    if (!carouselRef.current) return;
    const target = carouselRef.current.children[chunkIndex] as HTMLElement;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      setActiveChunkIndex(chunkIndex);
    }
  };

  const handleScrollCarousel = () => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const scrollPos = container.scrollLeft;
    const width = container.offsetWidth;
    if (width > 0) {
      const idx = Math.round(scrollPos / width);
      if (idx !== activeChunkIndex && idx >= 0 && idx < fixtureChunks.length) {
        setActiveChunkIndex(idx);
      }
    }
  };

  function handleLike() {
    toggleLike(post.id);
    if (!post.likedByMe) {
      setLikePop(true);
      setTimeout(() => setLikePop(false), 500);
    }
  }

  function handleSave() {
    toggleSave(post.id);
    showToast({
      type: post.savedByMe ? 'info' : 'success',
      title: post.savedByMe ? 'Slip Removed' : 'Slip Saved!',
      message: post.savedByMe ? 'Removed from saved slips.' : 'Saved to your profile bookmarks.',
    });
  }

  async function handleShare() {
    const shareText = `Check out this ${legs.length}-leg bet slip @ ${slip.totalOdds.toFixed(2)}x by ${post.postedBy} on MshindiRoom!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'MshindiRoom Bet Slip', text: shareText, url: window.location.href });
        incrementShare(post.id);
        return;
      } catch {
        /* user cancelled */
      }
    }
    handleCopyLink();
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      incrementShare(post.id);
      showToast({ type: 'success', title: 'Link Copied', message: 'Slip link copied to clipboard!' });
    } catch {
      showToast({ type: 'warning', title: 'Copy failed', message: 'Could not copy link to clipboard.' });
    }
  }

  function handleCopyCode() {
    if (!slip.bookieCode) return;
    navigator.clipboard?.writeText(slip.bookieCode).then(() => {
      setCopiedCode(true);
      showToast({ type: 'success', title: 'Code Copied!', message: slip.bookieCode! });
      setTimeout(() => setCopiedCode(false), 2000);
    });
  }

  function handleFollowToggle() {
    if (!currentUser) {
      showToast({ type: 'warning', title: 'Login Required', message: 'Sign in to follow punters.' });
      return;
    }
    if (following) {
      unfollowUser(currentUsername, post.postedBy);
      showToast({ type: 'info', title: 'Unfollowed', message: `You unfollowed ${post.postedBy}` });
    } else {
      followUser(currentUsername, post.postedBy);
      showToast({ type: 'success', title: 'Following!', message: `You are now following ${post.postedBy}` });
    }
  }

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-[#FFFFF0] dark:bg-[#202522] select-none text-slate-900 dark:text-[#F4F5EF] slip-reel-card"
      aria-label={`Bet slip by ${post.postedBy}`}
    >
      {/* ── AMBIENT SUBTLE PATTERN ── */}
      <div className="ambient-light-gradient absolute inset-0 bg-gradient-to-b from-[#FFFFF0] via-[#FAF9EC] to-[#F5F5E4] dark:hidden pointer-events-none" />
      <div className="ambient-dark-gradient hidden dark:block absolute inset-0 bg-gradient-to-b from-[#202522] via-[#242A26] to-[#2A312D] pointer-events-none" />

      {/* ── MAIN CONTENT CONTAINER (FULL HEIGHT FLEX) ── */}
      <div
        className="relative z-10 flex flex-col h-full justify-between px-3.5 sm:px-5"
        style={{
          paddingTop: 'calc(max(14px, env(safe-area-inset-top, 0px)) + 46px)',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* ── TOP HEADER BLOCK (Below SlipFeed top bar) ── */}
        <div className="shrink-0 flex flex-col gap-1.5 pb-1">
          {/* Row 2: Odds & Legs Count (Left) + Countdown / Live Badge (Right) */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-black dark:text-[#F4F5EF] text-base sm:text-lg font-bold tabular-nums leading-none">
                {slip.totalOdds.toFixed(2)}x
              </span>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-[#B5BDB6] leading-none">
                {legs.length} Leg{legs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Countdown / Live Indicator */}
            {countdown.isLive ? (
              <div className="flex items-center gap-1.5 text-[#006C54]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                </span>
                <span className="text-xs tabular-nums font-bold lowercase tracking-wide text-[#006C54] drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]">
                  live
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs tabular-nums font-bold text-[#8A6500] dark:text-[#FFC72C]">
                <Clock size={12} className="text-[#8A6500] dark:text-[#FFC72C]" />
                <span>{countdown.isUnknown ? 'Pending KO' : countdown.label}</span>
              </div>
            )}
          </div>

          {/* Row 3: Booking Code Pill (Right, below Countdown) */}
          {(slip.bookieCode || slip.bookieLink) && (
            <div className="flex items-center justify-end gap-1.5">
              {slip.bookieCode && (
                <button
                  onClick={handleCopyCode}
                  className="booking-code-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 dark:bg-[#2A312D] text-white dark:text-[#F4F5EF] border border-transparent dark:border-[#414A43] text-[11px] tabular-nums font-bold shadow-xs active:scale-95 transition-all hover:bg-slate-800 dark:hover:bg-[#343C36] cursor-pointer"
                >
                  {copiedCode ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{slip.bookieCode}</span>
                </button>
              )}
              {slip.bookieLink && (
                <a
                  href={slip.bookieLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-[#2A312D] border border-slate-300 dark:border-[#414A43] text-slate-800 dark:text-[#F4F5EF] text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-[#343C36] active:scale-95 transition-all"
                >
                  <ExternalLink size={10} className="text-[#006C54]" />
                  <span>Open</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── MIDDLE FIXTURES AREA (Max 8 per slide, swipe carousel if > 8) ── */}
        <div className="flex-1 min-h-0 relative flex flex-col justify-center my-auto py-1">
          {/* Carousel Navigation Buttons for Desktop (Left / Right Chevrons) */}
          {fixtureChunks.length > 1 && (
            <>
              <button
                onClick={() => scrollToChunk(activeChunkIndex - 1)}
                disabled={activeChunkIndex === 0}
                aria-label="Previous fixtures slide"
                className="hidden sm:flex absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 dark:bg-[#2A312D] border border-slate-200 dark:border-[#414A43] shadow-md text-slate-700 dark:text-[#F4F5EF] disabled:opacity-20 items-center justify-center transition-all cursor-pointer hover:bg-white dark:hover:bg-[#343C36] active:scale-90"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scrollToChunk(activeChunkIndex + 1)}
                disabled={activeChunkIndex === fixtureChunks.length - 1}
                aria-label="Next fixtures slide"
                className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 dark:bg-[#2A312D] border border-slate-200 dark:border-[#414A43] shadow-md text-slate-700 dark:text-[#F4F5EF] disabled:opacity-20 items-center justify-center transition-all cursor-pointer hover:bg-white dark:hover:bg-[#343C36] active:scale-90"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {/* Swipeable Carousel Container */}
          <div
            ref={carouselRef}
            onScroll={handleScrollCarousel}
            className="flex-1 min-h-0 w-full overflow-x-auto flex snap-x snap-mandatory slip-legs-carousel"
            style={{
              scrollbarWidth: 'none',
              touchAction: 'pan-x pan-y',
              overscrollBehaviorX: 'contain',
            }}
          >
            {fixtureChunks.map((chunk, chunkIdx) => {
              const isDense = chunk.length > 5;
              return (
                <div
                  key={chunkIdx}
                  className={`w-full min-w-full h-full flex flex-col justify-center ${
                    isDense ? 'gap-1' : 'gap-1.5 sm:gap-2'
                  } px-0.5 snap-center shrink-0`}
                >
                  {chunk.map((leg, legIdx) => (
                    <motion.div
                      key={leg.id}
                      initial={isActive ? { opacity: 0, y: 6 } : false}
                      animate={isActive ? { opacity: 1, y: 0 } : {}}
                      transition={{ delay: 0.03 + legIdx * 0.03, duration: 0.24, ease: 'easeOut' }}
                      className={`${
                        isDense ? 'px-2.5 py-1 sm:py-1.5' : 'p-2 sm:p-2.5'
                      } slip-leg-card bg-white/80 dark:bg-[#2A312D] border border-[#E6E6D2] dark:border-[#414A43] rounded-xl flex items-center justify-between gap-2.5 shadow-2xs hover:bg-white dark:hover:bg-[#343C36] transition-colors`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#006C54] truncate leading-tight">
                            {leg.competition}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-[#929D95] tabular-nums shrink-0 leading-tight">
                            <Clock size={9} />
                            <span>{leg.kickoff}</span>
                          </div>
                        </div>
                        <p
                          className={`font-display font-bold text-xs sm:text-sm text-slate-900 dark:text-[#F4F5EF] truncate ${
                            isDense ? 'leading-tight' : 'leading-snug mt-0.5'
                          }`}
                        >
                          {leg.homeTeam} <span className="text-slate-400 dark:text-[#929D95] font-normal text-xs">v</span> {leg.awayTeam}
                        </p>
                        <div
                          className={`flex items-center gap-1.5 text-[11px] truncate ${
                            isDense ? 'leading-tight' : 'mt-0.5'
                          }`}
                        >
                          <span className="font-semibold text-slate-500 dark:text-[#B5BDB6]">{leg.market}:</span>
                          <span className="text-[#006C54] font-bold truncate">{leg.pick}</span>
                        </div>
                      </div>

                      {/* Individual Leg Odds Number */}
                      <span className="shrink-0 tabular-nums font-bold text-xs sm:text-sm text-[#8A6500] dark:text-[#FFC72C] leading-none pl-1">
                        {leg.odds.toFixed(2)}
                      </span>
                    </motion.div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Carousel Slide Indicators */}
          {fixtureChunks.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-1.5 shrink-0">
              {fixtureChunks.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  onClick={() => scrollToChunk(dotIdx)}
                  aria-label={`Go to slide ${dotIdx + 1}`}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    dotIdx === activeChunkIndex
                      ? 'w-4 bg-[#006C54] dark:bg-[#006C54]'
                      : 'w-1.5 bg-slate-300 dark:bg-[#414A43] hover:bg-slate-400'
                  }`}
                />
              ))}
              <span className="text-[10px] font-bold text-slate-400 dark:text-[#929D95] tabular-nums ml-1">
                {activeChunkIndex + 1}/{fixtureChunks.length}
              </span>
            </div>
          )}
        </div>

        {/* ── BOTTOM SECTION: USER AVATAR & INTERACTION BUTTONS ── */}
        <div className="shrink-0 pt-2">
          {/* Horizontal Line separating fixtures from user avatar */}
          <div className="border-t border-[#E6E6D2] dark:border-[#414A43] mb-2" />

          {/* User Avatar + Follow + Caption Note */}
          <div className="flex flex-col gap-1 px-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={post.postedBy} seed={post.postedByAvatarSeed} size={32} showBorder={true} />
                <span className="font-display font-bold text-xs sm:text-sm text-slate-900 dark:text-[#F4F5EF] truncate">
                  {post.postedBy}
                </span>
              </div>

              {!isSelf && (
                <button
                  onClick={handleFollowToggle}
                  className={`slip-follow-btn px-3 py-1 text-[11px] font-bold rounded-lg border transition-all active:scale-95 cursor-pointer shrink-0 ${

                    following
                      ? 'border-slate-300 dark:border-[#F4F5EF] bg-white/90 dark:bg-[#F4F5EF] text-slate-700 dark:text-[#202522] hover:bg-white dark:hover:bg-[#F4F5EF]/90'
                      : 'border-slate-900 dark:border-[#F4F5EF] bg-slate-900 dark:bg-[#F4F5EF] text-white dark:text-[#202522] hover:bg-slate-800 dark:hover:bg-[#F4F5EF]/90'
                  }`}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Caption / Note (if present) */}
            {post.note && (
              <div className="text-[11px] sm:text-xs text-slate-700 dark:text-[#B5BDB6] leading-snug pt-0.5">
                <span className={isCaptionExpanded ? '' : 'line-clamp-1 sm:line-clamp-2'}>
                  {post.note}
                </span>
                {post.note.length > 60 && (
                  <button
                    onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                    className="text-slate-500 dark:text-[#929D95] hover:text-slate-900 dark:hover:text-[#F4F5EF] font-bold ml-1 text-[10px] cursor-pointer"
                  >
                    {isCaptionExpanded ? 'less' : 'more'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Centrally Positioned Interaction Buttons Row: Like, Share, Save */}
          <div className="flex items-center justify-center gap-8 sm:gap-10 pt-2">
            {/* Like (Heart) */}
            <button
              onClick={handleLike}
              aria-label={post.likedByMe ? 'Unlike slip' : 'Like slip'}
              className="flex items-center gap-1.5 py-1 px-2.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer group"
            >
              <div className="relative flex items-center justify-center">
                <AnimatePresence>
                  {likePop && (
                    <motion.div
                      key="pop"
                      initial={{ scale: 1, opacity: 1 }}
                      animate={{ scale: 2.2, opacity: 0 }}
                      exit={{}}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <Heart size={20} className="text-rose-500 fill-rose-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
                <Heart
                  size={20}
                  className={`transition-colors ${
                    post.likedByMe
                      ? 'text-rose-500 fill-rose-500'
                      : 'text-slate-700 dark:text-[#B5BDB6] group-hover:text-slate-900 dark:group-hover:text-[#F4F5EF] stroke-[2]'
                  }`}
                />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-[#F4F5EF] tabular-nums">
                {post.likes}
              </span>
            </button>

            {/* Share (Send) */}
            <button
              onClick={handleShare}
              aria-label="Share slip"
              className="flex items-center gap-1.5 py-1 px-2.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer group text-slate-700 dark:text-[#B5BDB6] hover:text-slate-900 dark:hover:text-[#F4F5EF]"
            >
              <Send size={19} className="stroke-[2] -rotate-12 transition-colors group-hover:text-slate-900 dark:group-hover:text-[#F4F5EF]" />
              <span className="text-xs font-bold text-slate-800 dark:text-[#F4F5EF] tabular-nums">
                {post.shares ?? 0}
              </span>
            </button>

            {/* Save (Bookmark) */}
            <button
              onClick={handleSave}
              aria-label={post.savedByMe ? 'Remove from saved' : 'Save slip'}
              className="flex items-center gap-1.5 py-1 px-2.5 rounded-full hover:bg-slate-200/50 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer group"
            >
              <Bookmark
                size={20}
                className={`transition-colors ${
                  post.savedByMe
                    ? 'text-amber-500 fill-amber-500'
                    : 'text-slate-700 dark:text-[#B5BDB6] group-hover:text-slate-900 dark:group-hover:text-[#F4F5EF] stroke-[2]'
                }`}
              />
              <span className="text-xs font-bold text-slate-800 dark:text-[#F4F5EF] tabular-nums">
                {post.saves ?? 0}
              </span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .slip-legs-scroll::-webkit-scrollbar,
        .slip-legs-carousel::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
