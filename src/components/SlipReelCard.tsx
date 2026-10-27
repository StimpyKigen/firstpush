import { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart, Bookmark, Send, MessageCircle,
  Copy, Check, ExternalLink, Clock, Trophy, Zap, X,
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
  index,
  isActive,
  onPrev,
  onNext,
  canPrev,
  canNext
}: SlipReelCardProps) {
  const toggleLike = useBetSlipStore((s) => s.toggleLike);
  const toggleSave = useBetSlipStore((s) => s.toggleSave);

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
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);
  const [likePop, setLikePop] = useState(false);
  const [activeChunkIndex, setActiveChunkIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  // Group fixtures into chunks of max 5 per slide for the horizontal swipe carousel
  const fixtureChunks = useMemo(() => {
    const chunks: BuiltSlipLeg[][] = [];
    for (let i = 0; i < legs.length; i += 5) {
      chunks.push(legs.slice(i, i + 5));
    }
    return chunks;
  }, [legs]);

  const handleScrollCarousel = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const slideWidth = el.clientWidth;
    if (slideWidth > 0) {
      const newIdx = Math.round(el.scrollLeft / slideWidth);
      if (newIdx !== activeChunkIndex && newIdx >= 0 && newIdx < fixtureChunks.length) {
        setActiveChunkIndex(newIdx);
      }
    }
  };

  const scrollToChunk = (idx: number) => {
    if (carouselRef.current && idx >= 0 && idx < fixtureChunks.length) {
      carouselRef.current.scrollTo({
        left: idx * carouselRef.current.clientWidth,
        behavior: 'smooth',
      });
      setActiveChunkIndex(idx);
    }
  };

  function handleLike() {
    toggleLike(post.id);
    setLikePop(true);
    setTimeout(() => setLikePop(false), 450);
  }

  function handleSave() {
    toggleSave(post.id);
    showToast({
      type: post.savedByMe ? 'info' : 'success',
      title: post.savedByMe ? 'Removed from Saved' : 'Slip Saved!',
      message: post.savedByMe
        ? 'Removed from your saved collection.'
        : 'Slip saved to your profile collection.',
    });
  }

  async function handleShare() {
    const shareText = `Check out this ${legs.length}-leg bet slip @ ${slip.totalOdds.toFixed(2)}x by ${post.postedBy} on MshindiRoom!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'MshindiRoom Bet Slip', text: shareText, url: window.location.href });
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
      className="relative w-full h-full overflow-hidden bg-[#FFFFF0] select-none text-slate-900"
      aria-label={`Bet slip by ${post.postedBy}`}
    >
      {/* ── AMBIENT SUBTLE PATTERN ── */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#FFFFF0] via-[#FAF9EC] to-[#F5F5E4] pointer-events-none" />

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
              <span className="text-black text-base sm:text-lg font-bold tabular-nums leading-none">
                {slip.totalOdds.toFixed(2)}x
              </span>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500 leading-none">
                {legs.length} Leg{legs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Countdown / Live Indicator */}
            {countdown.isLive ? (
              <div className="flex items-center gap-1.5 text-emerald-600">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                </span>
                <span className="text-xs tabular-nums font-bold lowercase tracking-wide text-emerald-600 drop-shadow-[0_0_6px_rgba(16,185,129,0.6)]">
                  live
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs tabular-nums font-bold text-[#8A6500]">
                <Clock size={12} className="text-[#8A6500]" />
                <span>{countdown.isUnknown ? 'Pending KO' : countdown.label}</span>
              </div>
            )}
          </div>

          {/* Row 3: Bookmaker Tag (Left) + Booking Code Pill (Right, below Countdown) */}
          <div className="flex items-center justify-between gap-2 min-h-[26px]">
            <div className="flex items-center gap-1.5 truncate">
              {post.bookmaker && (
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  {post.bookmaker}
                </span>
              )}
            </div>

            {/* Booking Code Pill */}
            {(slip.bookieCode || slip.bookieLink) && (
              <div className="flex items-center gap-1.5 shrink-0">
                {slip.bookieCode && (
                  <button
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900 text-white text-[11px] tabular-nums font-bold shadow-xs active:scale-95 transition-all hover:bg-slate-800 cursor-pointer"
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
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-slate-300 text-slate-800 text-[11px] font-bold hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    <ExternalLink size={10} className="text-[#006C54]" />
                    <span>Open</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── MIDDLE FIXTURES AREA (Max 5 per slide, swipe carousel if > 5) ── */}
        {/* Note: NO visible line between booking code and fixture list as requested */}
        <div className="flex-1 min-h-0 relative flex flex-col justify-center my-auto py-1">
          {/* Carousel Navigation Buttons for Desktop (Left / Right Chevrons) */}
          {fixtureChunks.length > 1 && (
            <>
              <button
                onClick={() => scrollToChunk(activeChunkIndex - 1)}
                disabled={activeChunkIndex === 0}
                aria-label="Previous fixtures slide"
                className="hidden sm:flex absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 border border-slate-200 shadow-md text-slate-700 disabled:opacity-20 items-center justify-center transition-all cursor-pointer hover:bg-white active:scale-90"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scrollToChunk(activeChunkIndex + 1)}
                disabled={activeChunkIndex === fixtureChunks.length - 1}
                aria-label="Next fixtures slide"
                className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white/95 border border-slate-200 shadow-md text-slate-700 disabled:opacity-20 items-center justify-center transition-all cursor-pointer hover:bg-white active:scale-90"
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
            {fixtureChunks.map((chunk, chunkIdx) => (
              <div
                key={chunkIdx}
                className="w-full min-w-full h-full flex flex-col justify-center gap-1.5 sm:gap-2 px-0.5 snap-center shrink-0"
              >
                {chunk.map((leg, legIdx) => (
                  <motion.div
                    key={leg.id}
                    initial={isActive ? { opacity: 0, y: 6 } : false}
                    animate={isActive ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.03 + legIdx * 0.03, duration: 0.24, ease: 'easeOut' }}
                    className="p-2 sm:p-2.5 bg-white/80 border border-[#E6E6D2] rounded-xl flex items-center justify-between gap-2.5 shadow-2xs hover:bg-white transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#006C54] truncate">
                          {leg.competition}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 tabular-nums shrink-0">
                          <Clock size={9} />
                          <span>{leg.kickoff}</span>
                        </div>
                      </div>
                      <p className="font-display font-bold text-xs sm:text-sm text-slate-900 truncate leading-snug mt-0.5">
                        {leg.homeTeam} <span className="text-slate-400 font-normal text-xs">v</span> {leg.awayTeam}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] truncate">
                        <span className="font-semibold text-slate-500">{leg.market}:</span>
                        <span className="text-[#006C54] font-bold truncate">{leg.pick}</span>
                      </div>
                    </div>

                    {/* Individual Leg Odds Pill */}
                    <div className="shrink-0 bg-amber-50/80 border border-amber-200/50 text-[#8A6500] rounded-xl px-2 py-1.5 text-center min-w-[46px]">
                      <span className="tabular-nums font-bold text-xs sm:text-sm block leading-none">
                        {leg.odds.toFixed(2)}
                      </span>
                      <span className="text-[9px] uppercase text-amber-900/60 font-bold block mt-0.5 leading-none">odds</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ))}
          </div>

          {/* Carousel Slide Indicators (Dots + Label when > 1 slide) */}
          {fixtureChunks.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-1.5 shrink-0">
              {fixtureChunks.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  onClick={() => scrollToChunk(dotIdx)}
                  aria-label={`Go to slide ${dotIdx + 1}`}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    dotIdx === activeChunkIndex
                      ? 'w-4 bg-[#006C54]'
                      : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
              <span className="text-[10px] font-bold text-slate-400 tabular-nums ml-1">
                {activeChunkIndex + 1}/{fixtureChunks.length}
              </span>
            </div>
          )}
        </div>

        {/* ── BOTTOM SECTION: USER AVATAR & INTERACTION BUTTONS ── */}
        <div className="shrink-0 pt-2">
          {/* Horizontal Line separating fixtures from user avatar */}
          <div className="border-t border-[#E6E6D2] mb-2" />

          {/* User Avatar + Follow + Caption Note */}
          <div className="flex flex-col gap-1 px-0.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar name={post.postedBy} seed={post.postedByAvatarSeed} size={32} showBorder={true} />
                <span className="font-display font-bold text-xs sm:text-sm text-slate-900 truncate">
                  {post.postedBy}
                </span>
              </div>

              {!isSelf && (
                <button
                  onClick={handleFollowToggle}
                  className={`px-3 py-1 text-[11px] font-bold rounded-lg border transition-all active:scale-95 cursor-pointer shrink-0 ${
                    following
                      ? 'border-slate-300 bg-white/90 text-slate-700 hover:bg-white'
                      : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Caption / Note (if present) */}
            {post.note && (
              <div className="text-[11px] sm:text-xs text-slate-700 leading-snug pt-0.5">
                <span className={isCaptionExpanded ? '' : 'line-clamp-1 sm:line-clamp-2'}>
                  {post.note}
                </span>
                {post.note.length > 60 && (
                  <button
                    onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                    className="text-slate-500 hover:text-slate-900 font-bold ml-1 text-[10px] cursor-pointer"
                  >
                    {isCaptionExpanded ? 'less' : 'more'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Interaction Buttons Row: Heart on left, Comments & Share in middle, Save on right */}
          <div className="flex items-center justify-between pt-2 px-0.5">
            {/* Left: Like (Heart) */}
            <button
              onClick={handleLike}
              aria-label={post.likedByMe ? 'Unlike slip' : 'Like slip'}
              className="flex items-center gap-1.5 py-1 px-2 -ml-1 rounded-full hover:bg-slate-200/50 active:scale-95 transition-all cursor-pointer group"
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
                      : 'text-slate-700 group-hover:text-slate-900 stroke-[2]'
                  }`}
                />
              </div>
              <span className="text-xs font-bold text-slate-800 tabular-nums">
                {post.likes}
              </span>
            </button>

            {/* Middle: Comments & Share */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCommentsModal(true)}
                aria-label="View comments"
                className="flex items-center gap-1.5 py-1 px-2 rounded-full hover:bg-slate-200/50 active:scale-95 transition-all cursor-pointer text-slate-700 hover:text-slate-900"
              >
                <MessageCircle size={19} className="stroke-[2]" />
                <span className="text-xs font-bold tabular-nums">{legs.length * 3 + 4}</span>
              </button>

              <button
                onClick={handleShare}
                aria-label="Share slip"
                className="flex items-center gap-1.5 py-1 px-2 rounded-full hover:bg-slate-200/50 active:scale-95 transition-all cursor-pointer text-slate-700 hover:text-slate-900"
              >
                <Send size={18} className="stroke-[2] -rotate-12" />
                <span className="text-xs font-bold hidden xs:inline">Share</span>
              </button>
            </div>

            {/* Right: Save (Bookmark) */}
            <button
              onClick={handleSave}
              aria-label="Save slip"
              className="flex items-center gap-1.5 py-1 px-2 -mr-1 rounded-full hover:bg-slate-200/50 active:scale-95 transition-all cursor-pointer group"
            >
              <Bookmark
                size={20}
                className={`transition-colors ${
                  post.savedByMe
                    ? 'text-amber-500 fill-amber-500'
                    : 'text-slate-700 group-hover:text-slate-900 stroke-[2]'
                }`}
              />
              <span className="text-xs font-bold text-slate-800">
                {post.savedByMe ? 'Saved' : 'Save'}
              </span>
            </button>
          </div>
        </div>
      </div>


      {/* ── COMMENTS & INSIGHTS MODAL ── */}
      <AnimatePresence>
        {showCommentsModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs">
            <div className="fixed inset-0" onClick={() => setShowCommentsModal(false)} />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 max-h-[75vh] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageCircle size={18} className="text-[#006C54]" />
                  <h3 className="font-display font-bold text-sm uppercase tracking-wide text-slate-900">
                    Slip Discussion &amp; Analysis
                  </h3>
                </div>
                <button
                  onClick={() => setShowCommentsModal(false)}
                  className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="p-3 bg-[#F5F5E4] rounded-xl border border-[#E6E6D2]">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar name={post.postedBy} seed={post.postedByAvatarSeed} size={24} />
                    <span className="font-bold text-xs text-slate-900">{post.postedBy} (Author)</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {post.note || 'Multi-leg bet slip curated by top community punter.'}
                  </p>
                </div>

                <div className="text-xs text-slate-500 pt-2 pb-1 font-bold uppercase tracking-wide">
                  Matches in this Slip ({legs.length}):
                </div>
                {legs.map((leg) => (
                  <div key={leg.id} className="text-xs p-2.5 rounded-lg border border-slate-100 bg-white flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{leg.homeTeam} v {leg.awayTeam}</p>
                      <p className="text-[11px] text-[#006C54]">{leg.market}: {leg.pick}</p>
                    </div>
                    <span className="tabular-nums font-bold text-slate-800">@{leg.odds.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Add a comment to this slip..."
                  className="flex-1 bg-white border border-slate-300 rounded-full px-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      showToast({ type: 'success', title: 'Comment Shared', message: 'Your comment was added to this slip!' });
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <button
                  onClick={() => {
                    showToast({ type: 'success', title: 'Comment Shared', message: 'Your comment was added to this slip!' });
                  }}
                  className="p-2 rounded-full bg-[#006C54] text-white hover:bg-[#005441]"
                >
                  <Send size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .slip-legs-scroll::-webkit-scrollbar,
        .slip-legs-carousel::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
