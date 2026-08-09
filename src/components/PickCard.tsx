import { useState } from 'react';
import { Sparkles, ThumbsUp, Flame, Gem, Dices, Flag } from 'lucide-react';
import type { GamblerPick } from '../lib/types';
import Avatar from './Avatar';
import StarRating from './StarRating';
import ReportModal from './ReportModal';
import { getStarRating } from '../lib/punterRatings';
import { useUserPicks } from '../lib/userPicksStore';

const outcomeStyle: Record<string, { bg: string; label: string }> = {
  '1': { bg: '#1fae6f', label: '1 · Home' },
  X: { bg: '#f2b705', label: 'X · Draw' },
  '2': { bg: '#ef5b5b', label: '2 · Away' },
};

const convictionMeta: Record<string, { icon: typeof Flame; color: string }> = {
  Banker: { icon: Flame, color: 'text-emerald-2' },
  'Value Pick': { icon: Gem, color: 'text-gold' },
  'Long Shot': { icon: Dices, color: 'text-danger' },
};

interface PickCardProps {
  key?: any;
  pick: GamblerPick;
  isCurrentUser?: boolean;
  editCount?: number;
  onEdit?: () => void;
  onLikeToggle?: () => void;
}

export default function PickCard({ pick, isCurrentUser, editCount, onEdit, onLikeToggle }: PickCardProps) {
  const { toggleLikePick, isPickLiked, getExtraLikes } = useUserPicks();
  const [showReportModal, setShowReportModal] = useState(false);
  const liked = isPickLiked(pick.id);
  const extraLikes = getExtraLikes(pick.id);
  const currentLikes = pick.likes + extraLikes;

  const starRating = getStarRating(pick.username);
  const conv = convictionMeta[pick.conviction] || convictionMeta['Banker'];
  const ConvIcon = conv.icon;
  const out = outcomeStyle[pick.pick] || outcomeStyle['1'];

  const handleLike = () => {
    toggleLikePick(pick.id);
    if (onLikeToggle) onLikeToggle();
  };

  return (
    <div className={`bg-ink-2 border rounded-xl p-4 flex flex-col justify-between gap-3 transition-all ${
      isCurrentUser ? 'border-emerald-2/60 bg-emerald-2/5' : 'border-line hover:border-emerald/60'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={pick.username} seed={pick.colorSeed} size={36} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-sm text-cream leading-tight truncate">{pick.username}</p>
              {isCurrentUser && (
                <span className="text-[10px] font-extrabold uppercase bg-emerald-2/20 text-emerald-2 px-1.5 py-0.5 rounded-full shrink-0">
                  You
                </span>
              )}
              {starRating >= 4.0 && !isCurrentUser && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-extrabold uppercase bg-gold/20 text-gold px-1.5 py-0.5 rounded-full shrink-0">
                  <Sparkles size={10} /> Top Punter
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StarRating rating={starRating} size={10} showNumber={false} />
              <p className="text-[11px] text-cream-dim">{pick.timeAgo}</p>
            </div>
          </div>
        </div>
        <span
          className="text-[11px] font-bold px-2.5 py-1 rounded-md text-ink shrink-0 whitespace-nowrap"
          style={{ backgroundColor: out.bg, color: pick.pick === 'X' ? '#06110d' : '#fff' }}
        >
          {out.label}
        </span>
      </div>

      <p className="text-sm text-cream-dim leading-relaxed break-words">{pick.reasoning}</p>

      <div className="flex items-center justify-between pt-2 border-t border-dashed border-line/60">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-[11px] font-semibold ${conv.color}`}>
            <ConvIcon size={12} /> {pick.conviction}
          </span>
          {typeof editCount === 'number' && (
            <span className="text-[10px] font-medium text-cream-dim bg-panel px-2 py-0.5 rounded-full">
              Edited {editCount}/2
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isCurrentUser && onEdit && (
            <button
              onClick={onEdit}
              disabled={editCount !== undefined && editCount >= 2}
              className={`inline-flex items-center justify-center gap-1 text-xs font-semibold px-2.5 h-7 rounded-full border transition-all ${
                editCount !== undefined && editCount >= 2
                  ? 'opacity-40 cursor-not-allowed border-line text-cream-dim'
                  : 'border-gold/40 text-gold hover:bg-gold/10'
              }`}
            >
              {editCount !== undefined && editCount >= 2 ? 'Edit Limit Reached' : `Edit (${2 - (editCount || 0)} left)`}
            </button>
          )}

          <button
            onClick={handleLike}
            className={`inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 h-7 rounded-full border transition-colors shrink-0 ${
              liked ? 'text-gold border-gold/40 bg-gold/10' : 'text-cream-dim border-line hover:border-gold/30 hover:text-gold'
            }`}
          >
            <ThumbsUp size={12} /> {currentLikes}
          </button>

          {!isCurrentUser && (
            <button
              onClick={() => setShowReportModal(true)}
              className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-cream-dim/60 hover:text-rose-400 hover:bg-rose-500/10 px-2.5 h-7 rounded-full border border-transparent hover:border-rose-500/30 transition-all shrink-0"
              title="Report post"
            >
              <Flag size={11} /> Report
            </button>
          )}
        </div>
      </div>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        postId={pick.id}
        reportedUser={pick.username}
        postContent={`Pick: ${pick.pick} | Reasoning: ${pick.reasoning}`}
      />
    </div>
  );
}

