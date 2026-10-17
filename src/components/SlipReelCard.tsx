import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart, Bookmark, Send, MessageCircle,
  Copy, Check, ExternalLink, Clock, Trophy, Zap, X
} from 'lucide-react';
import Avatar from './Avatar';
import { useBetSlipStore } from '../lib/betSlipStore';
import { useCountdown } from '../lib/useCountdown';
import { getEarliestKickoff } from '../lib/kickoffParser';
import type { BetSlipPost } from '../lib/betSlipStore';
import { showToast } from '../lib/notificationStore';
import { useFollowStore } from '../lib/followStore';
import { useCurrentUser } from '../lib/authStore';

interface SlipReelCardProps {
  post: BetSlipPost;
  index: number;
  isActive: boolean;
}

export default function SlipReelCard({ post, index, isActive }: SlipReelCardProps) {
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

      {/* ── CENTER BET SLIP TICKET CONTENT ── */}
      <div className="relative z-10 flex flex-col h-full pt-13 pb-32 pl-4 pr-12 sm:pl-5 sm:pr-14">
        {/* Ticket Container */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Ticket Header Bar */}
          <div className="pb-2 pt-1 px-0.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-black text-sm sm:text-base font-black font-mono leading-none">
                {slip.totalOdds.toFixed(2)}x
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {legs.length} Leg{legs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Countdown Badge */}
            <div
              className={`flex items-center gap-1.5 text-xs font-mono font-bold ${
                countdown.isLive
                  ? 'text-emerald-700'
                  : 'text-[#8A6500]'
              }`}
            >
              {countdown.isLive ? (
                <Zap size={12} className="animate-pulse text-emerald-600" />
              ) : (
                <Clock size={12} className="text-[#8A6500]" />
              )}
              <span>{countdown.isUnknown ? 'Pending KO' : countdown.label}</span>
            </div>
          </div>

          {/* Centered Scrollable Matches Container */}
          <div
            className={`flex-1 min-h-0 py-1 px-0.5 flex flex-col overflow-y-auto slip-legs-scroll ${
              legs.length >= 7 ? 'justify-start' : 'justify-center'
            }`}
            style={{
              scrollbarWidth: 'none',
              touchAction: 'pan-y',
              overscrollBehaviorY: 'contain',
            }}
          >
            {legs.length <= 3 ? (
              /* ── 1 to 3 GAMES: Standard 1-Column Layout ── */
              <div className="grid grid-cols-1 gap-2.5 w-full my-auto">
                {legs.map((leg, i) => (
                  <motion.div
                    key={leg.id}
                    initial={isActive ? { opacity: 0, y: 6 } : false}
                    animate={isActive ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.04 + i * 0.04, duration: 0.28, ease: 'easeOut' }}
                    className="p-3 bg-[#FFFFF0] border border-[#E6E6D2] rounded-xl flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#006C54] truncate mb-0.5">
                        {leg.competition}
                      </p>
                      <p className="font-display font-black text-xs sm:text-sm text-slate-900 truncate leading-snug">
                        {leg.homeTeam} <span className="text-slate-400 font-normal text-xs">v</span> {leg.awayTeam}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                        <span className="font-bold text-slate-700">{leg.market}:</span>
                        <span className="text-[#006C54] font-black">{leg.pick}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                        <Clock size={10} />
                        <span>{leg.kickoff}</span>
                      </div>
                    </div>

                    {/* Individual Leg Odds Pill */}
                    <div className="shrink-0">
                      <div className="bg-amber-50/80 text-[#8A6500] rounded-xl px-2.5 py-1.5 text-center min-w-[48px]">
                        <span className="font-mono font-black text-xs sm:text-sm block leading-none">
                          {leg.odds.toFixed(2)}
                        </span>
                        <span className="text-[8px] uppercase text-amber-900/60 font-bold block mt-0.5">odds</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              /* ── 4+ GAMES: Adaptive 2-Column Grid (2 to max 3 rows visible) ── */
              <div className={`grid grid-cols-2 w-full my-auto ${legs.length === 4 ? 'gap-2' : 'gap-1.5'}`}>
                {legs.map((leg, i) => {
                  const isSuperCompact = legs.length >= 5;
                  return (
                    <motion.div
                      key={leg.id}
                      initial={isActive ? { opacity: 0, y: 6 } : false}
                      animate={isActive ? { opacity: 1, y: 0 } : {}}
                      transition={{ delay: 0.03 + i * 0.03, duration: 0.25, ease: 'easeOut' }}
                      className={`${
                        isSuperCompact ? 'p-2' : 'p-2.5'
                      } bg-[#FFFFF0] border border-[#E6E6D2] rounded-xl flex flex-col justify-between shadow-2xs`}
                    >
                      <div className="min-w-0">
                        <p className="text-[8.5px] font-black uppercase tracking-wider text-[#006C54] truncate">
                          {leg.competition}
                        </p>
                        <p className={`font-display font-black text-slate-900 truncate leading-tight mt-0.5 ${
                          isSuperCompact ? 'text-[11px]' : 'text-xs'
                        }`}>
                          {leg.homeTeam} <span className="text-slate-400 font-normal text-[10px]">v</span> {leg.awayTeam}
                        </p>
                        <p className="text-[10px] text-slate-600 truncate mt-0.5">
                          <span className="font-bold text-slate-700">{leg.market}: </span>
                          <span className="text-[#006C54] font-black">{leg.pick}</span>
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#E6E6D2]/60">
                        <div className="flex items-center gap-0.5 text-[9px] text-slate-400 font-mono truncate">
                          <Clock size={9} className="shrink-0" />
                          <span className="truncate">{leg.kickoff}</span>
                        </div>
                        <div className="bg-amber-50/80 text-[#8A6500] rounded-md px-1.5 py-0.5 text-center shrink-0">
                          <span className="font-mono font-black text-[11px] block leading-none">
                            {leg.odds.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── RIGHT VERTICAL ACTION BAR (INSTAGRAM REELS STYLE) ── */}
      <div className="absolute right-2.5 sm:right-3 top-[50%] z-20 flex flex-col items-center gap-3.5 pointer-events-auto">
        {/* Like Button (Heart) */}
        <button
          onClick={handleLike}
          aria-label={post.likedByMe ? 'Unlike slip' : 'Like slip'}
          className="flex flex-col items-center gap-0.5 group active:scale-125 transition-transform"
        >
          <div className="relative p-1">
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
                  <Heart size={28} className="text-rose-500 fill-rose-500" />
                </motion.div>
              )}
            </AnimatePresence>
            <Heart
              size={28}
              className={`transition-colors ${
                post.likedByMe ? 'text-rose-500 fill-rose-500' : 'text-slate-800 hover:text-slate-900 stroke-[1.8]'
              }`}
            />
          </div>
          <span className="text-[11px] font-bold text-slate-800 font-mono leading-none">
            {post.likes}
          </span>
        </button>

        {/* Comment / Discussion Button */}
        <button
          onClick={() => setShowCommentsModal(true)}
          aria-label="View comments"
          className="flex flex-col items-center gap-0.5 group active:scale-125 transition-transform"
        >
          <div className="p-1">
            <MessageCircle size={28} className="text-slate-800 hover:text-slate-900 stroke-[1.8]" />
          </div>
          <span className="text-[11px] font-bold text-slate-800 font-mono leading-none">
            {legs.length * 3 + 4}
          </span>
        </button>

        {/* Share / Send Button (Paper Airplane) */}
        <button
          onClick={handleShare}
          aria-label="Share slip"
          className="flex flex-col items-center gap-0.5 group active:scale-125 transition-transform"
        >
          <div className="p-1">
            <Send size={26} className="text-slate-800 hover:text-slate-900 stroke-[1.8] -rotate-12" />
          </div>
          <span className="text-[10px] font-bold text-slate-800 leading-none">
            Share
          </span>
        </button>

        {/* Save / Bookmark Button */}
        <button
          onClick={handleSave}
          aria-label="Save slip"
          className="flex flex-col items-center gap-0.5 group active:scale-125 transition-transform"
        >
          <div className="p-1">
            <Bookmark
              size={26}
              className={
                post.savedByMe ? 'text-amber-500 fill-amber-500' : 'text-slate-800 hover:text-slate-900 stroke-[1.8]'
              }
            />
          </div>
          <span className="text-[10px] font-bold text-slate-800 leading-none">
            {post.savedByMe ? 'Saved' : 'Save'}
          </span>
        </button>
      </div>

      {/* ── BOTTOM CREATOR & CAPTION OVERLAY ── */}
      <div
        className="absolute left-3.5 right-18 z-20 flex flex-col gap-1.5 pointer-events-auto"
        style={{
          bottom: 'max(14px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Creator Row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Story Ring Avatar */}
          <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-[#006C54] shadow-2xs shrink-0">
            <div className="rounded-full bg-white p-[1px]">
              <Avatar name={post.postedBy} seed={post.postedByAvatarSeed} size={30} />
            </div>
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-display font-black text-sm text-slate-900 truncate">
              {post.postedBy}
            </span>
          </div>

          {!isSelf && (
            <button
              onClick={handleFollowToggle}
              className={`px-3 py-0.5 text-xs font-bold rounded-lg border transition-all active:scale-95 ${
                following
                  ? 'border-slate-300 bg-white/90 text-slate-700 hover:bg-white'
                  : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* Bookmaker Tag */}
        {post.bookmaker && (
          <div className="text-xs text-slate-500 font-semibold truncate">
            <span>{post.bookmaker}</span>
          </div>
        )}

        {/* Caption / Note */}
        {post.note && (
          <div className="text-xs text-slate-800 leading-snug">
            <span className={isCaptionExpanded ? '' : 'line-clamp-2'}>
              {post.note}
            </span>
            {post.note.length > 70 && (
              <button
                onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                className="text-slate-500 hover:text-slate-900 font-bold ml-1 text-[11px]"
              >
                {isCaptionExpanded ? 'less' : 'more'}
              </button>
            )}
          </div>
        )}

        {/* Bookie Code Pill */}
        {(slip.bookieCode || slip.bookieLink) && (
          <div className="flex items-center gap-2 pt-0.5">
            {slip.bookieCode && (
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-mono font-bold shadow-xs active:scale-95 transition-all"
              >
                {copiedCode ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{slip.bookieCode}</span>
              </button>
            )}
            {slip.bookieLink && (
              <a
                href={slip.bookieLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-50 active:scale-95 transition-all"
              >
                <ExternalLink size={12} className="text-[#006C54]" />
                <span>Open Bookie</span>
              </a>
            )}
          </div>
        )}
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
                  <h3 className="font-display font-black text-sm uppercase tracking-wide text-slate-900">
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

                <div className="text-xs text-slate-500 pt-2 pb-1 font-bold uppercase tracking-wider">
                  Matches in this Slip ({legs.length}):
                </div>
                {legs.map((leg) => (
                  <div key={leg.id} className="text-xs p-2.5 rounded-lg border border-slate-100 bg-white flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{leg.homeTeam} v {leg.awayTeam}</p>
                      <p className="text-[11px] text-[#006C54]">{leg.market}: {leg.pick}</p>
                    </div>
                    <span className="font-mono font-bold text-slate-800">@{leg.odds.toFixed(2)}</span>
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

      <style>{`.slip-legs-scroll::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
