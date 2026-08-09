import { useState } from 'react';
import { X, UserPlus, UserCheck, Share2, Copy, Check, Trophy, Target, Sparkles, Send, ShieldCheck, MessageSquareOff, ExternalLink } from 'lucide-react';
import Avatar from './Avatar';
import StarRating from './StarRating';
import BetSlipCard from './BetSlipCard';
import { useAuth, useCurrentUser } from '../lib/authStore';
import { useFollowStore } from '../lib/followStore';
import { useBetSlipStore } from '../lib/betSlipStore';
import { getPunterStats } from '../lib/punterRatings';
import { showToast } from '../lib/notificationStore';
import Modal from './ui/Modal';

interface PunterProfileModalProps {
  username: string | null;
  onClose: () => void;
}

export default function PunterProfileModal({ username, onClose }: PunterProfileModalProps) {
  const currentUser = useCurrentUser();
  const isFollowing = useFollowStore((s) => username ? s.isFollowing(currentUser?.username || '', username) : false);
  const followUser = useFollowStore((s) => s.followUser);
  const unfollowUser = useFollowStore((s) => s.unfollowUser);
  const getFollowersCount = useFollowStore((s) => s.getFollowersCount);
  const getFollowingCount = useFollowStore((s) => s.getFollowingCount);

  const posts = useBetSlipStore((s) => s.posts);
  const userPosts = username ? posts.filter((p) => p.postedBy.toLowerCase() === username.toLowerCase()) : [];

  const [copiedLink, setCopiedLink] = useState(false);

  if (!username) return null;

  const stats = getPunterStats(username);
  const followersCount = getFollowersCount(username);
  const followingCount = getFollowingCount(username);
  const isSelf = currentUser?.username.toLowerCase() === username.toLowerCase();

  const profileUrl = `${window.location.origin}/slips?punter=${encodeURIComponent(username)}`;

  function handleToggleFollow() {
    if (!currentUser) {
      showToast({ type: 'warning', title: 'Sign in required', message: 'Log in to follow other punters.' });
      return;
    }
    if (isSelf) return;

    if (isFollowing) {
      unfollowUser(currentUser.username, username);
      showToast({ type: 'info', title: 'Unfollowed', message: `You are no longer following ${username}` });
    } else {
      followUser(currentUser.username, username);
      showToast({ type: 'success', title: 'Following!', message: `You are now following ${username}` });
    }
  }

  function handleCopyProfileLink() {
    navigator.clipboard?.writeText(profileUrl);
    setCopiedLink(true);
    showToast({ type: 'success', title: 'Link copied!', message: `Profile link for ${username} copied to clipboard.` });
    setTimeout(() => setCopiedLink(false), 2000);
  }

  function handleShareWhatsapp() {
    const text = encodeURIComponent(
      `Check out ${username}'s punter stats & bet slips on MshindiRoom: Kenya's #1 Jackpot Consensus platform! ${profileUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  return (
    <Modal isOpen={true} overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-ink border border-line rounded-2xl max-w-lg w-full p-5 sm:p-6 my-8 space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 rounded-full text-cream-dim hover:text-cream bg-panel hover:bg-panel-2 transition-colors"
        >
          <X size={18} />
        </button>

        {/* Profile Card Header */}
        <div className="flex items-start gap-4 pt-2">
          <div className="relative shrink-0">
            <Avatar name={username} seed={username.length} size={56} />
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gold border-2 border-ink flex items-center justify-center">
              <Sparkles size={10} className="text-ink" />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-xl text-cream truncate">{username}</h2>
              <StarRating rating={stats.stars} size={14} />
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-cream-dim">
              <div>
                <span className="font-mono font-bold text-cream text-sm">{followersCount}</span> Followers
              </div>
              <div>
                <span className="font-mono font-bold text-cream text-sm">{followingCount}</span> Following
              </div>
            </div>
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-2 pt-1">
          {!isSelf ? (
            <button
              onClick={handleToggleFollow}
              className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                isFollowing
                  ? 'bg-panel border border-gold/40 text-gold hover:bg-gold/10'
                  : 'bg-gold hover:bg-gold-2 text-ink shadow-md'
              }`}
            >
              {isFollowing ? <UserCheck size={15} /> : <UserPlus size={15} />}
              {isFollowing ? 'Following' : 'Follow Punter'}
            </button>
          ) : (
            <div className="flex-1 py-2 px-3 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-semibold text-center">
              Your Profile
            </div>
          )}

          <button
            onClick={handleCopyProfileLink}
            className="py-2.5 px-3 rounded-xl bg-panel hover:bg-panel-2 border border-line text-cream-dim hover:text-cream font-semibold text-xs flex items-center gap-1.5 transition-colors"
            title="Copy Profile Link"
          >
            {copiedLink ? <Check size={14} className="text-emerald-2" /> : <Copy size={14} />}
            {copiedLink ? 'Copied' : 'Share Link'}
          </button>

          <button
            onClick={handleShareWhatsapp}
            className="p-2.5 rounded-xl bg-emerald-2/15 border border-emerald-2/30 text-emerald-2 hover:bg-emerald-2/25 transition-colors"
            title="Share via WhatsApp"
          >
            <Share2 size={15} />
          </button>
        </div>

        {/* Non-messaging banner */}
        <div className="bg-ink-2 border border-dashed border-line/80 rounded-xl p-3 flex items-center gap-2.5 text-[11px] text-cream-dim">
          <MessageSquareOff size={16} className="text-gold shrink-0" />
          <span>
            Punter connections allow you to follow slips and rankings. Direct messaging is disabled to prevent spam and scams.
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-panel border border-line rounded-xl p-3.5 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-emerald-2/10 border border-emerald-2/30 flex items-center justify-center shrink-0">
              <Target size={16} className="text-emerald-2" />
            </span>
            <div>
              <p className="font-display font-extrabold text-cream text-base">{stats.accuracyPct}%</p>
              <p className="text-[11px] text-cream-dim">Pick Accuracy</p>
            </div>
          </div>
          <div className="bg-panel border border-line rounded-xl p-3.5 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
              <Trophy size={16} className="text-gold" />
            </span>
            <div>
              <p className="font-display font-extrabold text-cream text-base">{stats.closestWins}</p>
              <p className="text-[11px] text-cream-dim">Closest-Slip Wins</p>
            </div>
          </div>
        </div>

        {/* Shared Slips Section */}
        <div className="space-y-3 pt-2">
          <h3 className="font-display font-bold text-sm text-cream flex items-center gap-2">
            <Send size={14} className="text-gold" /> Shared Bet Slips ({userPosts.length})
          </h3>

          {userPosts.length === 0 ? (
            <div className="bg-panel/60 border border-dashed border-line rounded-xl p-6 text-center text-xs text-cream-dim">
              This punter has not shared any public bet slips yet.
            </div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {userPosts.map((post, i) => (
                <BetSlipCard key={post.id} post={post} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
