import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart, Bookmark, Share2, Copy, Check, ExternalLink,
  Zap, Clock, Trophy, TrendingUp,
} from 'lucide-react';
import Avatar from './Avatar';
import { useBetSlipStore } from '../lib/betSlipStore';
import { useCountdown } from '../lib/useCountdown';
import { getEarliestKickoff } from '../lib/kickoffParser';
import type { BetSlipPost } from '../lib/betSlipStore';
import { showToast } from '../lib/notificationStore';

// Per-card ambient gradient palette (cycles by index)
const CARD_ACCENTS = [
  'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(0,168,120,0.22), transparent 60%), radial-gradient(ellipse 60% 50% at 90% 100%, rgba(245,184,0,0.14), transparent 70%)',
  'radial-gradient(ellipse 70% 55% at 85% 0%, rgba(245,184,0,0.20), transparent 60%), radial-gradient(ellipse 60% 50% at 10% 100%, rgba(0,168,120,0.12), transparent 70%)',
  'radial-gradient(ellipse 75% 60% at 50% -10%, rgba(0,168,120,0.18), transparent 60%), radial-gradient(ellipse 50% 45% at 50% 110%, rgba(245,184,0,0.12), transparent 70%)',
  'radial-gradient(ellipse 80% 50% at 0% 50%, rgba(245,184,0,0.16), transparent 65%), radial-gradient(ellipse 60% 50% at 100% 50%, rgba(0,168,120,0.14), transparent 70%)',
  'radial-gradient(ellipse 70% 60% at 30% 10%, rgba(29,211,154,0.18), transparent 60%), radial-gradient(ellipse 60% 55% at 80% 90%, rgba(245,184,0,0.12), transparent 70%)',
];

interface SlipReelCardProps {
  post: BetSlipPost;
  index: number;
  isActive: boolean;
}

export default function SlipReelCard({ post, index, isActive }: SlipReelCardProps) {
  const toggleLike = useBetSlipStore((s) => s.toggleLike);
  const toggleSave = useBetSlipStore((s) => s.toggleSave);
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];

  const slip = post.builtSlip!;
  const legs = slip.legs ?? [];

  const earliestKickoff = getEarliestKickoff(legs);
  const countdown = useCountdown(earliestKickoff);

  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [likePop, setLikePop] = useState(false);

  function handleLike() {
    toggleLike(post.id);
    setLikePop(true);
    setTimeout(() => setLikePop(false), 400);
  }

  function handleSave() {
    toggleSave(post.id);
    showToast({
      type: post.savedByMe ? 'info' : 'success',
      title: post.savedByMe ? 'Removed from Saved' : 'Slip Saved!',
      message: post.savedByMe
        ? 'Removed from your saved slips.'
        : 'Slip added to your saved collection.',
    });
  }

  async function handleShare() {
    const shareText = `Check out this ${legs.length}-leg bet slip @ ${slip.totalOdds.toFixed(2)}x by ${post.postedBy} on MshindiRoom!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'MshindiRoom Bet Slip', text: shareText, url: window.location.href });
        return;
      } catch { /* user cancelled */ }
    }
    setShowShareMenu((v) => !v);
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setShowShareMenu(false);
    } catch {
      showToast({ type: 'warning', title: 'Copy failed', message: 'Please copy the URL manually.' });
    }
  }

  return (
    /*
     * height: 100% — fills whatever scroll-snap container gives it
     * (100% of panel on desktop · 100% of viewport on mobile)
     */
    <div
      className="relative w-full overflow-hidden"
      style={{ height: '100%' }}
      aria-label={`Bet slip by ${post.postedBy}`}
    >
      {/* ── BACKGROUND ────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-ink" style={{ backgroundImage: accent }} />
      {/* Grain texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
          backgroundSize: '256px 256px',
        }}
      />

      {/* ── CONTENT STACK (flex column, fills full height) ────────────────── */}
      <div className="relative z-10 flex flex-col h-full">

        {/*
         * ── TOP INSET SPACER ────────────────────────────────────────────────
         * Pushes the card header below the SlipReelFeed top-bar overlay.
         * The top-bar uses paddingTop: max(10px, safe-area-inset-top) ~26px bar.
         * We clear that with max(44px, safe-area + 36px) which works for:
         *   Desktop (safe=0)  : max(44, 36) = 44px   bar≈36px  ✓
         *   iPhone SE (safe≈20): max(44, 56) = 56px   bar≈56px  ✓
         *   iPhone 14 (safe≈44): max(44, 80) = 80px   bar≈70px  ✓ (+ breathing room)
         */}
        <div style={{ height: 'max(44px, calc(env(safe-area-inset-top) + 36px))', flexShrink: 0 }} />

        {/* ── USER HEADER ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={post.postedBy} seed={post.postedByAvatarSeed} size={36} />
            <div className="min-w-0">
              <p className="font-display font-extrabold text-sm text-cream truncate leading-tight">
                {post.postedBy}
              </p>
              <p className="text-[10px] text-cream-dim font-mono">
                {new Date(post.createdAt).toLocaleDateString('en-KE', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {post.bookmaker && (
              <span className="text-[10px] font-extrabold uppercase tracking-wide bg-panel/80 border border-line/60 text-gold px-2 py-0.5 rounded-full backdrop-blur-sm">
                {post.bookmaker}
              </span>
            )}
            {post.tags.slice(0, 1).map((tag) => (
              <span
                key={tag}
                className="text-[9px] font-extrabold uppercase tracking-wide bg-gold/15 text-gold px-2 py-0.5 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* ── NOTE / ANALYSIS ─────────────────────────────────────────────── */}
        {post.note && (
          <div className="px-4 pb-2 shrink-0">
            <p className="text-xs text-cream-dim leading-relaxed line-clamp-2">{post.note}</p>
          </div>
        )}

        {/* ── LEGS SECTION ────────────────────────────────────────────────── */}
        {/*
         * flex-1 + min-h-0 = takes remaining vertical space and allows
         * the inner overflow-y-auto to actually scroll rather than expanding
         * past the card boundary.
         */}
        <div className="flex-1 min-h-0 flex flex-col px-4 pb-2">
          {/* Divider label */}
          <div className="flex items-center gap-2 py-1.5 shrink-0">
            <div className="h-px flex-1 bg-line/50" />
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-cream-dim/60 flex items-center gap-1">
              <Trophy size={9} />
              {legs.length} Leg{legs.length !== 1 ? 's' : ''}
            </span>
            <div className="h-px flex-1 bg-line/50" />
          </div>

          {/* Scrollable leg list — hides its own scrollbar */}
          <div
            className="flex-1 min-h-0 overflow-y-auto space-y-2 slip-legs-scroll"
            style={{
              scrollbarWidth: 'none',
              // Allow this nested scroller to own vertical pan gestures.
              // Without this, iOS/Android may hand the gesture back to the
              // parent (the page body) when the list reaches its top or bottom.
              touchAction: 'pan-y',
              // Stop overscroll from bubbling out of the legs list into the
              // feed container when the list hits its own boundary.
              overscrollBehaviorY: 'contain',
            }}
          >
            {legs.map((leg, i) => (
              <motion.div
                key={leg.id}
                initial={isActive ? { opacity: 0, y: 8 } : false}
                animate={isActive ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.07 + i * 0.05, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className="bg-panel/60 backdrop-blur-sm border border-line/40 rounded-2xl px-3.5 py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gold/80 truncate mb-0.5">
                    {leg.competition}
                  </p>
                  <p className="font-display font-extrabold text-sm text-cream truncate leading-snug">
                    {leg.homeTeam}{' '}
                    <span className="text-cream-dim font-normal text-xs">vs</span>{' '}
                    {leg.awayTeam}
                  </p>
                  <p className="text-xs text-emerald-2 font-semibold mt-0.5 truncate">
                    {leg.market}:{' '}
                    <span className="text-cream-dim">{leg.pick}</span>
                  </p>
                  <p className="text-[10px] text-cream-dim/55 font-mono mt-0.5 flex items-center gap-1">
                    <Clock size={9} />
                    {leg.kickoff}
                  </p>
                </div>

                {/* Odds pill */}
                <div className="shrink-0">
                  <div className="bg-gold/15 border border-gold/30 rounded-xl px-2.5 py-1.5 text-center min-w-[48px]">
                    <span className="font-mono font-black text-gold text-sm block">
                      {leg.odds.toFixed(2)}
                    </span>
                    <span className="text-[8px] uppercase text-cream-dim/55 font-bold block">odds</span>
                  </div>
                </div>
              </motion.div>
            ))}
            {/* Bottom breathing room inside the scroll area */}
            <div className="h-1" />
          </div>
        </div>

        {/* ── ODDS SUMMARY BAR ────────────────────────────────────────────── */}
        <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-t border-line/30 bg-panel/40 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} className="text-emerald-2" />
            <span className="text-xs text-cream-dim font-semibold">Total Odds</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono font-black text-gold text-xl leading-none">
              @{slip.totalOdds.toFixed(2)}x
            </span>
            {slip.estimatedReturn && slip.stake && (
              <div className="text-right">
                <p className="text-[10px] text-cream-dim leading-tight">Est. Return</p>
                <p className="text-xs font-bold text-emerald-2 font-mono">
                  Ksh {slip.estimatedReturn.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── COUNTDOWN BAR ───────────────────────────────────────────────── */}
        <motion.div
          animate={countdown.isLive ? { scale: [1, 1.015, 1] } : {}}
          transition={countdown.isLive ? { repeat: Infinity, duration: 2 } : {}}
          className={`px-4 py-2.5 flex items-center justify-center gap-2 shrink-0 ${
            countdown.isLive
              ? 'bg-emerald-2/20 border-t border-emerald-2/40'
              : 'bg-gold/10 border-t border-gold/20'
          }`}
        >
          {countdown.isLive ? (
            <Zap size={14} className="text-emerald-2 shrink-0 animate-pulse" />
          ) : (
            <Clock size={13} className="text-gold shrink-0" />
          )}
          <span
            className={`text-sm font-extrabold font-mono tracking-wide ${
              countdown.isLive ? 'text-emerald-2' : 'text-gold'
            }`}
          >
            {countdown.isUnknown ? 'Kickoff time unavailable' : countdown.label}
          </span>
        </motion.div>

        {/* ── ACTION BUTTONS ──────────────────────────────────────────────── */}
        <div
          className="px-4 flex items-center justify-between gap-2 border-t border-line/20 bg-ink/60 backdrop-blur-md shrink-0"
          style={{
            paddingTop: '12px',
            // Clears the iOS home indicator (≈34 px) and Android gesture bar.
            // env(safe-area-inset-bottom) is 0 on browsers that don't support
            // viewport-fit=cover (unlikely here, but 20px is a safe minimum
            // that keeps all action buttons clear of the OS gesture zone).
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          }}
        >
          {/* Like ❤️ */}
          <button
            onClick={handleLike}
            aria-label={post.likedByMe ? 'Unlike slip' : 'Like slip'}
            className="flex items-center gap-2"
          >
            <div className="relative">
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
                    <Heart size={22} className="text-rose-400 fill-rose-400" />
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div
                animate={post.likedByMe ? { scale: [1, 1.35, 1] } : {}}
                transition={{ duration: 0.25 }}
              >
                <Heart
                  size={22}
                  className={`transition-colors ${
                    post.likedByMe ? 'text-rose-400 fill-rose-400' : 'text-cream-dim'
                  }`}
                />
              </motion.div>
            </div>
            <span className={`text-sm font-bold font-mono ${post.likedByMe ? 'text-rose-400' : 'text-cream-dim'}`}>
              {post.likes}
            </span>
          </button>

          {/* Save 🔖 */}
          <button
            onClick={handleSave}
            aria-label={post.savedByMe ? 'Unsave slip' : 'Save slip'}
            className="flex items-center gap-1.5"
          >
            <motion.div
              animate={post.savedByMe ? { scale: [1, 1.4, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Bookmark
                size={22}
                className={`transition-colors ${
                  post.savedByMe ? 'text-gold fill-gold' : 'text-cream-dim'
                }`}
              />
            </motion.div>
            <span className={`text-xs font-bold ${post.savedByMe ? 'text-gold' : 'text-cream-dim'}`}>
              {post.savedByMe ? 'Saved' : 'Save'}
            </span>
          </button>

          {/* Bookie code / link pill */}
          {(slip.bookieCode || slip.bookieLink) && (
            <a
              href={slip.bookieLink || '#'}
              target={slip.bookieLink ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={
                slip.bookieLink
                  ? undefined
                  : (e) => {
                      e.preventDefault();
                      navigator.clipboard
                        .writeText(slip.bookieCode!)
                        .then(() =>
                          showToast({ type: 'success', title: 'Code Copied!', message: slip.bookieCode! })
                        );
                    }
              }
              className="flex items-center gap-1.5 bg-panel/70 border border-gold/30 text-gold text-xs font-bold px-2.5 py-1.5 rounded-full backdrop-blur-sm hover:bg-gold/20 transition-colors"
            >
              {slip.bookieLink ? <ExternalLink size={12} /> : <Copy size={12} />}
              <span className="font-mono max-w-[72px] truncate">
                {slip.bookieCode || 'Open Link'}
              </span>
            </a>
          )}

          {/* Share */}
          <div className="relative">
            <button
              onClick={handleShare}
              aria-label="Share slip"
              className="flex items-center gap-1.5"
            >
              <Share2 size={22} className="text-cream-dim" />
              <span className="text-xs font-bold text-cream-dim">Share</span>
            </button>

            <AnimatePresence>
              {showShareMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.18 }}
                  className="absolute bottom-full right-0 mb-2 bg-panel border border-line rounded-2xl shadow-2xl p-3 min-w-[160px] z-50"
                >
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-cream hover:bg-ink-2 transition-colors"
                  >
                    {copied ? (
                      <Check size={15} className="text-emerald-2" />
                    ) : (
                      <Copy size={15} />
                    )}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Dismiss share menu on backdrop click */}
      {showShareMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
      )}

      {/* Hide leg-list scrollbar in WebKit */}
      <style>{`.slip-legs-scroll::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
