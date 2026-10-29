import { useState } from 'react';
import { ThumbsUp, Pencil, Check, Crown, Flag } from 'lucide-react';
import type { GamblerPick, Outcome } from '../lib/types';
import Avatar from './Avatar';
import StarRating from './StarRating';
import PlayerProfileModal from './PlayerProfileModal';
import ReportModal from './ReportModal';
import { getStarRating } from '../lib/punterRatings';
import { useCurrentUser } from '../lib/authStore';
import { usePickEdits } from '../lib/pickEditStore';
import { moderateText } from '../lib/contentModeration';
import ModerationWarningBox from './ModerationWarningBox';

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
      <div className="p-3.5 sm:p-4 rounded-xl border border-[#006C54]/40 bg-[#006C54]/[0.02] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-800">Edit Your Match Pick</span>
          <span className="text-[11px] tabular-nums font-bold text-slate-500 uppercase">({canEdit ? '1 edit remaining' : 'no edits left'})</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['1', 'X', '2'] as Outcome[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setEditPick(o)}
              className={`h-9 px-2 rounded-md text-xs font-bold uppercase tracking-wide border transition-all active:scale-95 cursor-pointer ${
                editPick === o
                  ? o === '1'
                    ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                    : o === 'X'
                    ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-xs'
                    : 'bg-rose-600 border-rose-700 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
              }`}
            >
              {o === '1' ? '1 (Home)' : o === 'X' ? 'X (Draw)' : '2 (Away)'}
            </button>
          ))}
        </div>
        <textarea
          value={editReason}
          onChange={(e) => setEditReason(e.target.value)}
          rows={2}
          className={`w-full bg-white border rounded-md px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none transition-all ${
            !editMod.isAllowed ? 'border-rose-500 bg-rose-50/50' : 'border-slate-300 focus:border-[#006C54]'
          }`}
        />
        <ModerationWarningBox result={editMod} text={editReason} />
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => { setEditing(false); setEditPick(pick.pick); setEditReason(pick.reasoning); }}
            className="h-8 px-3 rounded-md text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={!editMod.isAllowed}
            className="h-8 px-3.5 rounded-md text-xs font-bold uppercase tracking-wide bg-[#006C54] hover:bg-[#005441] disabled:opacity-40 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Check size={12} /> Save Changes
          </button>
        </div>
      </div>
    );
  }

  const outcomeColors = {
    '1': 'bg-emerald-600 text-white',
    X: 'bg-amber-500 text-slate-950',
    '2': 'bg-rose-600 text-white',
  }[pick.pick] || 'bg-slate-800 text-white';

  const outcomeLabel = {
    '1': '1 (Home)',
    X: 'X (Draw)',
    '2': '2 (Away)',
  }[pick.pick] || pick.pick;

  return (
    <div
      className={`group relative flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-xl border transition-all duration-150 ${
        isMine
          ? 'bg-slate-50 border-[#006C54]/30 hover:border-[#006C54]/60 shadow-2xs'
          : isTopPick
          ? 'bg-[#EEAA04]/[0.06] border-[#EEAA04]/40 hover:border-[#EEAA04]/70 shadow-2xs'
          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      {showProfileModal && (
        <PlayerProfileModal
          username={pick.username}
          onClose={() => setShowProfileModal(false)}
        />
      )}

      {/* Message Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setShowProfileModal(true)}
            className="shrink-0 hover:opacity-85 transition-opacity cursor-pointer"
            title={`View ${pick.username}'s profile`}
          >
            <Avatar name={pick.username} seed={pick.colorSeed} size={32} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setShowProfileModal(true)}
                className="text-xs sm:text-sm font-bold uppercase tracking-tight text-slate-900 hover:text-[#006C54] transition-colors truncate cursor-pointer"
              >
                {pick.username}
              </button>
              {isMine && (
                <span className="text-[11px] font-bold uppercase text-[#006C54] tracking-wide">
                  (You)
                </span>
              )}
              {isTopPick && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8A6500]">
                  <Crown size={11} className="text-[#8A6500] fill-[#8A6500]" /> #1 Top Pick
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <StarRating rating={getStarRating(pick.username)} size={10} showNumber={false} />
              <span>·</span>
              <span className="text-[11px] tabular-nums text-slate-500">{pick.timeAgo}</span>
            </div>
          </div>
        </div>

        {/* Outcome Pick Badge */}
        <div className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide shrink-0 shadow-2xs flex items-center gap-1 leading-none ${outcomeColors}`}>
          <span>Pick:</span>
          <span>{outcomeLabel}</span>
        </div>
      </div>

      {/* Message Bubble Reasoning */}
      <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-slate-800 text-xs sm:text-[13px] leading-relaxed break-words">
        {displayText}
        {isLong && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[#006C54] font-bold text-xs ml-1.5 hover:underline cursor-pointer"
          >
            read more
          </button>
        )}
      </div>

      {/* Message Card Footer: Reactions & Actions */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {isMine && !canEdit && (
            <span className="text-[11px] tabular-nums text-slate-400 font-bold">Edited 2/2</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isMine && canEdit && onEdit && (
            <button
              onClick={() => setEditing(true)}
              className="h-7 px-2 rounded-md text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 transition-colors cursor-pointer"
              title="Edit your reasoning"
            >
              <Pencil size={11} />
              <span>Edit</span>
            </button>
          )}

          {!isMine && (
            <button
              onClick={() => setShowReportModal(true)}
              className="h-7 px-2 rounded-md text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center gap-1 transition-colors cursor-pointer"
              title="Report this comment"
            >
              <Flag size={11} />
              <span className="hidden xs:inline">Report</span>
            </button>
          )}

          <button
            onClick={handleLike}
            className={`h-7 px-1.5 text-xs font-bold tabular-nums flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
              liked
                ? 'text-slate-950'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Agree with this pick"
          >
            <ThumbsUp size={12} className={liked ? 'fill-[#EEAA04] text-[#EEAA04]' : 'text-slate-400'} />
            <span>{likes}</span>
          </button>
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
