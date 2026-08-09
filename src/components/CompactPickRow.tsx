import React, { useState } from 'react';
import { ThumbsUp, Flame, Gem, Dices, Pencil, Check, X, Crown, ShieldAlert, Flag } from 'lucide-react';
import type { GamblerPick, Outcome } from '../lib/types';
import Avatar from './Avatar';
import StarRating from './StarRating';
import PlayerProfileModal from './PlayerProfileModal';
import ReportModal from './ReportModal';
import { getStarRating } from '../lib/punterRatings';
import { useAuth, useCurrentUser } from '../lib/authStore';
import { usePickEdits } from '../lib/pickEditStore';
import { computeVisibilityScore } from '../lib/pickSorting';
import { moderateText } from '../lib/contentModeration';
import ModerationWarningBox from './ModerationWarningBox';

const outcomeDot: Record<string, string> = {
  '1': '#1fae6f',
  X: '#f2b705',
  '2': '#ef5b5b',
};

const pickBtnStyle: Record<Outcome, string> = {
  '1': 'bg-emerald-2 border-emerald-2 text-ink',
  X: 'bg-gold border-gold text-ink',
  '2': 'bg-danger border-danger text-white',
};

const convictionMeta: Record<string, { icon: typeof Flame; color: string; label: string }> = {
  Banker: { icon: Flame, color: 'text-emerald-2', label: 'Banker' },
  'Value Pick': { icon: Gem, color: 'text-gold', label: 'Value' },
  'Long Shot': { icon: Dices, color: 'text-danger', label: 'Long' },
};

interface CompactPickRowProps {
  key?: any;
  pick: GamblerPick;
  isTopPick?: boolean;
  onEdit?: (id: string, pick: Outcome, reasoning: string) => void;
}

export default function CompactPickRow({ pick, isTopPick, onEdit }: CompactPickRowProps) {
  const currentUser = useCurrentUser();
  const toggleLike = usePickEdits((s) => s.toggleLike);
  const canEdit = usePickEdits((s) => s.canEdit(pick.id));
  const [likes, setLikes] = useState(pick.likes);
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editPick, setEditPick] = useState<Outcome>(pick.pick);
  const [editReason, setEditReason] = useState(pick.reasoning);

  const isMine = currentUser?.username === pick.username;
  const conv = convictionMeta[pick.conviction] || convictionMeta['Banker'];
  const ConvIcon = conv.icon;
  const dotColor = outcomeDot[pick.pick];
  const reasoning = pick.reasoning;
  const isLong = reasoning.length > 120;
  const displayText = expanded || !isLong ? reasoning : reasoning.slice(0, 120) + '...';

  function handleLike() {
    if (!currentUser) return;
    setLiked(!liked);
    setLikes((l) => (liked ? l - 1 : l + 1));
    toggleLike(pick.id, currentUser.username);
  }

  function handleSaveEdit() {
    const mod = moderateText(editReason);
    if (!editReason.trim() || !mod.isAllowed) return;
    onEdit?.(pick.id, editPick, editReason.trim());
    setEditing(false);
  }

  const editMod = moderateText(editReason);

  if (editing && isMine) {
    return (
      <div className="py-3 border-b border-line/40">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-cream">Edit your pick</span>
          <span className="text-[10px] text-cream-dim">({canEdit ? '1 edit left' : 'no edits left'})</span>
        </div>
        <div className="flex gap-1.5 mb-2">
          {(['1', 'X', '2'] as Outcome[]).map((o) => (
            <button
              key={o}
              onClick={() => setEditPick(o)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                editPick === o ? pickBtnStyle[o] : 'border-line text-cream-dim hover:border-emerald-2/50'
              }`}
            >
              {o === '1' ? '1 · Home' : o === 'X' ? 'X · Draw' : '2 · Away'}
            </button>
          ))}
        </div>
        <textarea
          value={editReason}
          onChange={(e) => setEditReason(e.target.value)}
          rows={2}
          className={`w-full bg-ink border rounded-lg px-3 py-2 text-[13px] text-cream placeholder:text-cream-dim/50 focus:outline-none resize-none mb-2 ${
            !editMod.isAllowed ? 'border-rose-500 bg-rose-500/5' : 'border-line focus:border-gold'
          }`}
        />
        <ModerationWarningBox result={editMod} text={editReason} />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveEdit}
            disabled={!editMod.isAllowed}
            className="flex items-center gap-1.5 bg-gold hover:bg-gold-2 disabled:opacity-40 text-ink text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
          >
            <Check size={12} /> Save
          </button>
          <button
            onClick={() => { setEditing(false); setEditPick(pick.pick); setEditReason(pick.reasoning); }}
            className="flex items-center gap-1.5 text-cream-dim hover:text-cream text-xs font-bold px-3 py-1.5 rounded-lg border border-line transition-colors"
          >
            <X size={12} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 sm:gap-3 py-2.5 border-b border-line/40 last:border-b-0 ${isTopPick ? 'bg-gold/5 -mx-3 sm:-mx-4 px-3 sm:px-4' : ''}`}>
      {showProfileModal && (
        <PlayerProfileModal
          username={pick.username}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* Avatar */}
      <button onClick={() => setShowProfileModal(true)} className="shrink-0 pt-0.5 hover:opacity-80 transition-opacity">
        <Avatar name={pick.username} seed={pick.colorSeed} size={28} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header line */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setShowProfileModal(true)}
            className="text-sm font-bold text-cream hover:text-gold transition-colors text-left"
          >
            {pick.username}
          </button>
          <StarRating rating={getStarRating(pick.username)} size={9} showNumber={false} />
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: dotColor }}
            title={`Pick: ${pick.pick}`}
          />
          <span className="text-[11px] text-cream-dim/70">{pick.timeAgo}</span>
          {isTopPick && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gold bg-gold/10 border border-gold/30 px-1.5 py-0.5 rounded-full">
              <Crown size={9} /> Top Pick
            </span>
          )}
        </div>

        {/* Reasoning */}
        <p className="text-[13px] text-cream-dim leading-snug mt-0.5">
          {displayText}
          {isLong && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-gold text-[11px] font-semibold ml-1 hover:underline"
            >
              more
            </button>
          )}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-1.5">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1 text-[11px] font-semibold transition-colors min-h-[28px] px-1 ${
              liked ? 'text-gold' : 'text-cream-dim/60 hover:text-gold'
            }`}
          >
            <ThumbsUp size={11} className={liked ? 'fill-current' : ''} />
            {likes > 0 && <span>{likes}</span>}
          </button>
          {!isMine && (
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-1 text-[11px] font-semibold text-cream-dim/50 hover:text-rose-400 transition-colors min-h-[28px] px-1"
              title="Report this pick"
            >
              <Flag size={10} /> Report
            </button>
          )}
          <span className={`flex items-center gap-1 text-[11px] font-semibold ${conv.color}`}>
            <ConvIcon size={10} /> {conv.label}
          </span>
          {isMine && canEdit && onEdit && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-[11px] font-semibold text-cream-dim/60 hover:text-gold transition-colors min-h-[28px] px-1"
            >
              <Pencil size={10} /> Edit
            </button>
          )}
          {isMine && !canEdit && (
            <span className="text-[10px] text-cream-dim/40">Edited 2x</span>
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
