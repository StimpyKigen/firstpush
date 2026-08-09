import { useState } from 'react';
import {
  ExternalLink, Heart, Copy, Check, ShieldCheck, Globe, Flag,
  Plus, Edit3, X, Dices, Layers, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Avatar from './Avatar';
import MiniBrowserModal from './MiniBrowserModal';
import ReportModal from './ReportModal';
import { useBetSlipStore, type BetSlipPost } from '../lib/betSlipStore';
import { useCurrentUser } from '../lib/authStore';
import { showToast } from '../lib/notificationStore';
import Modal from './ui/Modal';

interface BetSlipCardProps {
  key?: any;
  post: BetSlipPost;
  index: number;
  onOpenProfile?: (username: string) => void;
}

const BOOKMAKER_OPTIONS = ['SportPesa', 'Betika', '22Bet', '1xBet', 'MozzartBet', 'PariPesa', 'Shabiki', 'Odibets', 'Betway', 'Other'];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function BetSlipCard({ post, index, onOpenProfile }: BetSlipCardProps) {
  const currentUser = useCurrentUser();
  const toggleLike = useBetSlipStore((s) => s.toggleLike);
  const updateBookieDetails = useBetSlipStore((s) => s.updateBookieDetails);

  const [copied, setCopied] = useState(false);
  const [copiedLegs, setCopiedLegs] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAttachModal, setShowAttachModal] = useState(false);

  // Attach modal form
  const [attachBookmaker, setAttachBookmaker] = useState(post.bookmaker || 'SportPesa');
  const [attachCode, setAttachCode] = useState(post.builtSlip?.bookieCode || (post.isCode ? post.url : ''));
  const [attachLink, setAttachLink] = useState(post.builtSlip?.bookieLink || (!post.isCode ? post.url : ''));

  const isAuthor = currentUser?.username.toLowerCase() === post.postedBy.toLowerCase();
  const hasBuiltSlip = Boolean(post.builtSlip && post.builtSlip.legs && post.builtSlip.legs.length > 0);

  const isUrl = !post.isCode && (post.url.startsWith('http://') || post.url.startsWith('https://') || post.url.includes('.'));
  const targetUrl = post.parsed?.sourceUrl || (isUrl ? (post.url.startsWith('http') ? post.url : `https://${post.url}`) : '#');
  const bookmakerName = post.bookmaker || post.parsed?.bookmaker || 'Sportsbook';

  function handleCopyUrlOrCode() {
    if (!post.url) return;
    navigator.clipboard.writeText(post.url);
    setCopied(true);
    showToast({
      type: 'success',
      title: post.isCode ? 'Code copied!' : 'Link copied!',
      message: `${post.isCode ? 'Booking code' : 'Bet slip URL'} copied to clipboard.`,
    });
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopyLegsText() {
    if (!post.builtSlip) return;
    const lines = post.builtSlip.legs.map((leg, i) => `${i + 1}. ${leg.homeTeam} vs ${leg.awayTeam} -> ${leg.pick} @ ${leg.odds.toFixed(2)} (${leg.market})`);
    const summary = `🔥 ${post.postedBy}'s Bet Builder Slip (${post.builtSlip.legs.length} Legs @ ${post.builtSlip.totalOdds.toFixed(2)}x total odds)\n\n${lines.join('\n')}\n\nVia Mshindi Bet Builder`;
    navigator.clipboard.writeText(summary);
    setCopiedLegs(true);
    showToast({
      type: 'success',
      title: 'Legs summary copied!',
      message: 'All leg selections copied to clipboard.',
    });
    setTimeout(() => setCopiedLegs(false), 2000);
  }

  function handleSaveBookieDetails() {
    if (!attachCode.trim() && !attachLink.trim()) {
      showToast({ type: 'warning', title: 'Empty inputs', message: 'Enter a booking code or official slip URL.' });
      return;
    }
    updateBookieDetails(post.id, {
      bookieCode: attachCode.trim(),
      bookieLink: attachLink.trim(),
      bookmaker: attachBookmaker,
    });
    setShowAttachModal(false);
    showToast({
      type: 'success',
      title: 'Booking details updated!',
      message: `Attached ${attachBookmaker} details to your slip.`,
    });
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className="bg-panel border border-line rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 hover:border-line/90 transition-all shadow-sm"
      >
        {/* Post header */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onOpenProfile?.(post.postedBy)}
            className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90 group transition-opacity"
          >
            <Avatar name={post.postedBy} seed={post.postedByAvatarSeed} size={34} />
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-cream group-hover:text-gold transition-colors truncate flex items-center gap-1">
                {post.postedBy}
              </h4>
              <span className="text-[11px] text-cream-dim">{timeAgo(post.createdAt)}</span>
            </div>
          </button>

          {/* Bookmaker Badge & Tags */}
          <div className="flex flex-wrap gap-1 items-center justify-end">
            {hasBuiltSlip && (
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30 flex items-center gap-1">
                <Dices size={11} /> Bet Builder
              </span>
            )}
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              {bookmakerName}
            </span>
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-ink/70 text-cream-dim border border-line"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Note */}
        {post.note && (
          <p className="text-sm text-cream leading-relaxed break-words font-medium">
            {post.note}
          </p>
        )}

        {/* BUILT SLIP LEGS BREAKDOWN (if generated via Bet Builder) */}
        {hasBuiltSlip && post.builtSlip && (
          <div className="rounded-xl border border-gold/30 bg-ink/80 p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-line/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-gold flex items-center gap-1.5">
                  <Layers size={14} className="text-gold" />
                  {post.builtSlip.legs.length}-Leg Accumulator
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-cream bg-gold/20 border border-gold/40 px-2.5 py-0.5 rounded-full font-mono">
                  @{post.builtSlip.totalOdds.toFixed(2)} Total Odds
                </span>
              </div>
            </div>

            {/* Leg items list */}
            <div className="space-y-2">
              {post.builtSlip.legs.map((leg, lIdx) => {
                const legStatus = leg.status || 'pending';
                return (
                  <div
                    key={leg.id || lIdx}
                    className="bg-panel/90 border border-line/80 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] text-cream-dim uppercase font-bold tracking-tight">
                        <span className="text-gold/90">{leg.competition}</span>
                        <span>•</span>
                        <span>{leg.kickoff}</span>
                      </div>
                      <div className="font-bold text-cream text-xs truncate mt-0.5">
                        {leg.homeTeam} <span className="text-cream-dim font-normal">vs</span> {leg.awayTeam}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-line/40">
                      <div className="text-right">
                        <span className="text-[10px] text-cream-dim uppercase block font-semibold">{leg.market}</span>
                        <span className="font-extrabold text-gold">{leg.pick}</span>
                      </div>
                      <div className="font-mono font-bold text-cream bg-ink px-2 py-1 rounded-lg border border-line text-xs">
                        {leg.odds.toFixed(2)}
                      </div>

                      {/* Leg Status */}
                      <div className="shrink-0" title={`Status: ${legStatus}`}>
                        {legStatus === 'won' && <CheckCircle2 size={16} className="text-emerald-400" />}
                        {legStatus === 'lost' && <XCircle size={16} className="text-rose-400" />}
                        {legStatus === 'pending' && <Clock size={16} className="text-amber-400 animate-pulse" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Copy Legs Action + Attach official bookie code */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={handleCopyLegsText}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-gold hover:text-ink bg-gold/10 hover:bg-gold border border-gold/30 px-3 py-1.5 rounded-lg transition-all"
              >
                {copiedLegs ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedLegs ? 'Legs Copied' : 'Copy All Picks'}</span>
              </button>

              {isAuthor && (
                <button
                  onClick={() => setShowAttachModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 hover:text-emerald-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg transition-all"
                >
                  <Edit3 size={13} />
                  <span>{post.url ? 'Edit Booking Details' : 'Attach Booking Code / Link'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* OFFICIAL BOOKIE LINK / CODE BOX (If attached or URL post) */}
        {post.url && (
          <div className="rounded-xl border border-line bg-ink-2 p-3.5 flex flex-col gap-3">
            {isUrl ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-panel border border-line/80 rounded-xl p-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase text-cream-dim tracking-wider block">
                      {bookmakerName} Official Slip Link
                    </span>
                    <p className="text-xs font-mono text-gold truncate mt-0.5" title={post.url}>
                      {post.url}
                    </p>
                  </div>

                  <button
                    onClick={handleCopyUrlOrCode}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-gold hover:text-ink bg-gold/10 hover:bg-gold border border-gold/30 px-3 py-1.5 rounded-lg transition-all shrink-0"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>

                {/* Preview Button */}
                <div
                  onClick={() => setShowPreviewModal(true)}
                  className="group relative cursor-pointer overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 hover:border-emerald-500/60 transition-all text-center space-y-1.5"
                >
                  <div className="flex items-center justify-center gap-2 text-emerald-300 font-extrabold text-xs">
                    <Globe size={15} className="animate-pulse" />
                    <span>Interactive Preview ({bookmakerName})</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-0.5">
                    <span className="text-xs font-bold text-ink bg-emerald-400 group-hover:bg-emerald-300 px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5">
                      <ShieldCheck size={13} /> Open Live Preview
                    </span>
                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-bold text-cream-dim hover:text-gold bg-panel border border-line px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <span>External</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-panel border border-gold/30 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-gold tracking-wider">
                      {bookmakerName} Booking Code
                    </span>
                    <div className="font-mono font-black text-lg text-cream tracking-wide mt-0.5">
                      {post.url}
                    </div>
                  </div>

                  <button
                    onClick={handleCopyUrlOrCode}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-ink bg-gold hover:bg-gold-2 px-3.5 py-2 rounded-xl transition-all shadow-sm"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied Code' : 'Copy Code'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-cream-dim leading-relaxed">
                  Open {bookmakerName} app or website and load code <strong className="text-gold font-mono">{post.url}</strong>.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer bar: Like button + Report + Attach Code trigger for author */}
        <div className="flex items-center justify-between text-xs text-cream-dim pt-1 border-t border-line/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleLike(post.id)}
              className={`flex items-center gap-2 font-bold transition-all px-3 py-1.5 rounded-xl border ${
                post.likedByMe
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                  : 'bg-panel-2 border-line/60 hover:border-rose-500/30 text-cream-dim hover:text-cream'
              }`}
            >
              <Heart size={15} className={post.likedByMe ? 'fill-rose-500 text-rose-500' : ''} />
              <span>{post.likes} {post.likes === 1 ? 'Like' : 'Likes'}</span>
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1.5 font-semibold text-xs text-cream-dim/60 hover:text-rose-400 hover:bg-rose-500/10 transition-all px-2.5 py-1.5 rounded-xl border border-transparent hover:border-rose-500/30"
              title="Report this post"
            >
              <Flag size={13} />
              <span>Report</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isAuthor && !post.url && (
              <button
                onClick={() => setShowAttachModal(true)}
                className="text-xs font-bold text-gold hover:underline flex items-center gap-1"
              >
                <Plus size={13} /> Attach Code / Link
              </button>
            )}
            <span className="text-[11px] text-cream-dim font-medium">
              {hasBuiltSlip ? 'Compiled Bet' : isUrl ? 'URL Bet Slip' : `${bookmakerName} Code`}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Attach Booking Details Modal */}
      {showAttachModal && (
        <Modal isOpen={true} overlayClassName="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-panel border border-line rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-display font-extrabold text-base text-cream flex items-center gap-2">
                <Edit3 size={18} className="text-gold" />
                Attach Booking Code or Link
              </h3>
              <button
                onClick={() => setShowAttachModal(false)}
                aria-label="Close"
                className="text-cream-dim hover:text-cream p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-cream-dim leading-relaxed">
              Punters who built this slip can attach their official Sportsbook booking code or link so others can load it directly.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-cream block mb-1.5">Select Bookmaker Site</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {BOOKMAKER_OPTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setAttachBookmaker(b)}
                      className={`text-xs font-bold py-1.5 px-2 rounded-xl border text-center transition-all ${
                        attachBookmaker === b
                          ? 'bg-gold text-ink border-gold font-extrabold'
                          : 'bg-ink border-line text-cream-dim hover:text-cream'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-cream block mb-1">Booking Code (Optional)</label>
                <input
                  type="text"
                  value={attachCode}
                  onChange={(e) => setAttachCode(e.target.value)}
                  placeholder="e.g. SP-88120 or A8B9C22"
                  className="w-full bg-ink border border-line rounded-xl px-3 py-2 text-sm text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-cream block mb-1">Official Slip URL Link (Optional)</label>
                <input
                  type="text"
                  value={attachLink}
                  onChange={(e) => setAttachLink(e.target.value)}
                  placeholder="https://www.sportpesa.com/share/..."
                  className="w-full bg-ink border border-line rounded-xl px-3 py-2 text-sm text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setShowAttachModal(false)}
                className="px-4 py-2 text-xs font-bold text-cream-dim hover:text-cream rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBookieDetails}
                className="px-5 py-2 text-xs font-bold bg-gold hover:bg-gold-2 text-ink rounded-xl shadow"
              >
                Save Details
              </button>
            </div>
          </motion.div>
        </Modal>
      )}

      <AnimatePresence>
        {showPreviewModal && isUrl && (
          <MiniBrowserModal
            url={targetUrl}
            title={`${bookmakerName} Bet Slip`}
            bookmaker={bookmakerName}
            onClose={() => setShowPreviewModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        postId={post.id}
        reportedUser={post.postedBy}
        postContent={post.note || `${bookmakerName}: ${post.url}`}
      />
    </>
  );
}
