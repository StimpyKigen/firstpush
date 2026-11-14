import { useState, useRef, useEffect } from 'react';
import { ThumbsUp, Pencil, Check, Crown, Flag, MoreVertical } from 'lucide-react';
import type { GamblerPick, Outcome } from '../lib/types';
import Avatar from './Avatar';
import StarRating from './StarRating';
import PlayerProfileModal from './PlayerProfileModal';
import ReportModal from './ReportModal';
import { getStarRating } from '../lib/punterRatings';
import { useCurrentUser } from '../lib/authStore';
import { useSharedNow } from '../lib/useSharedClock';
import { useCommentEngagementStore } from '../lib/commentEngagementStore';
import { showToast } from '../lib/notificationStore';
import { usePickEdits } from '../lib/pickEditStore';
import { moderateText } from '../lib/contentModeration';
import ModerationWarningBox from './ModerationWarningBox';

interface CompactPickRowProps {
  key?: any;
  pick: GamblerPick;
  isTopPick?: boolean;
  onEdit?: (id: string, pick: Outcome, reasoning: string) => void;
  onDelete?: (id: string) => void;
  kickoffTime?: string;
  isMatchLiveOrFinished?: boolean;
}

function formatLiveTimeAgo(timestamp: number, currentNow: number): string {
  const diffSec = Math.max(0, Math.floor((currentNow - timestamp) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

export default function CompactPickRow({ pick, isTopPick, onEdit, onDelete, kickoffTime, isMatchLiveOrFinished }: CompactPickRowProps) {
  const currentUser = useCurrentUser();
  const canEdit = usePickEdits((s) => s.canEdit(pick.id));
  const isLiked = useCommentEngagementStore((s) => s.isCommentLiked(pick.id));
  const currentLikes = useCommentEngagementStore((s) => s.getCommentLikes(pick.id, pick.likes));
  const toggleCommentLike = useCommentEngagementStore((s) => s.toggleCommentLike);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editPick, setEditPick] = useState<Outcome>(pick.pick);
  const [editReason, setEditReason] = useState(pick.reasoning);
  const now = useSharedNow(5000);
  const [showMenu, setShowMenu] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const isMine = currentUser?.username === pick.username;

  // Edit window: 5 minutes from post creation
  const postAgeMs = pick.createdAt ? now - pick.createdAt : Infinity;
  const isWithinEditWindow = postAgeMs < 5 * 60 * 1000;

  // Check if within 5 minutes of kickoff or match has begun
  let isWithinFiveMinOfKickoff = !!isMatchLiveOrFinished;
  if (!isWithinFiveMinOfKickoff && kickoffTime) {
    const parsed = Date.parse(kickoffTime);
    if (!isNaN(parsed)) {
      const diffToKickoff = parsed - now;
      if (diffToKickoff <= 5 * 60 * 1000) {
        isWithinFiveMinOfKickoff = true;
      }
    }
  }

  const canDelete = isMine && !isWithinFiveMinOfKickoff;

  function handleShare() {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedShare(true);
        setTimeout(() => {
          setCopiedShare(false);
          setShowMenu(false);
        }, 1500);
      }).catch(() => {});
    }
  }

  const activeTimestamp = pick.updatedAtTimestamp || pick.createdAt;
  const displayTimeAgo = activeTimestamp
    ? formatLiveTimeAgo(activeTimestamp, now)
    : pick.timeAgo;

  const reasoning = pick.reasoning;
  const isLong = reasoning.length > 120;
  const displayText = expanded || !isLong ? reasoning : reasoning.slice(0, 120) + '...';

  async function handleLike() {
    if (!currentUser) {
      showToast({
        type: 'warning',
        title: 'Sign in required',
        message: 'Log in to like comments.',
      });
      return;
    }
    const res = await toggleCommentLike(pick.id, {
      phone: currentUser.phone,
      username: currentUser.username,
    });
    if (!res.success && res.error) {
      showToast({
        type: 'error',
        title: 'Like failed',
        message: res.error,
      });
    }
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
          className={`w-full bg-white border rounded-md px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none transition-all no-scrollbar ${
            !editMod.isAllowed ? 'border-rose-500 bg-rose-50/50' : 'border-slate-300 focus:border-[#006C54]'
          }`}
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
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
          ? 'bg-slate-50 dark:bg-[#2A312D] border-[#006C54]/30 dark:border-[#006C54]/50 hover:border-[#006C54]/60 shadow-2xs'
          : isTopPick
          ? 'bg-[#EEAA04]/[0.06] dark:bg-[#2A312D] border-[#EEAA04]/40 dark:border-[#414A43] hover:border-[#EEAA04]/70 dark:hover:border-[#525E55] shadow-2xs'
          : 'bg-white dark:bg-[#2A312D] border-slate-200 dark:border-[#414A43] hover:border-slate-300 dark:hover:border-[#525E55] hover:shadow-xs'
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
                className="text-xs sm:text-sm font-bold uppercase tracking-tight text-slate-900 dark:text-[#F4F5EF] hover:text-[#006C54] dark:hover:text-[#00A878] transition-colors truncate cursor-pointer"
              >
                {pick.username}
              </button>
              {isMine && (
                <span className="text-[11px] font-bold uppercase text-[#006C54] tracking-wide">
                  (You)
                </span>
              )}
              {isTopPick && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8A6500] dark:text-[#FFC72C]">
                  <Crown size={11} className="text-[#8A6500] dark:text-[#FFC72C] fill-[#8A6500] dark:fill-[#FFC72C]" /> #1 Top Pick
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
              <StarRating rating={getStarRating(pick.username)} size={10} showNumber={false} />
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
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#202522] border border-slate-100 dark:border-[#414A43] text-slate-800 dark:text-[#F4F5EF] text-xs sm:text-[13px] leading-relaxed break-words">
        {displayText}
        {isLong && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[#006C54] dark:text-[#00A878] font-bold text-xs ml-1.5 hover:underline cursor-pointer"
          >
            read more
          </button>
        )}
      </div>

      {/* Message Card Footer: Reactions & Actions */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-[#414A43] text-xs">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-[11px] tabular-nums text-slate-400 dark:text-[#929D95] font-medium">{displayTimeAgo}</span>
          {isMine && !canEdit && (
            <span className="text-[11px] tabular-nums text-slate-400 dark:text-[#929D95] font-bold">· Edited 2/2</span>
          )}
          {!isMine && (
            <>
              <span className="text-slate-300 dark:text-[#525E55] text-[11px] select-none">·</span>
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="text-[11px] font-semibold text-slate-400 dark:text-[#929D95] hover:text-rose-600 dark:hover:text-rose-400 bg-transparent flex items-center gap-1 transition-colors cursor-pointer p-0 border-none"
                title="Report this comment"
              >
                <Flag size={10} className="shrink-0" />
                <span className="inline">Report</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Edit button: available within 5 mins from posting */}
          {isMine && isWithinEditWindow && canEdit && onEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="h-7 px-2 rounded-md text-xs font-bold text-slate-600 dark:text-[#B5BDB6] hover:text-slate-900 dark:hover:text-[#F4F5EF] hover:bg-slate-100 dark:hover:bg-[#202522] flex items-center gap-1 transition-colors cursor-pointer"
              title="Edit your reasoning"
            >
              <Pencil size={11} />
              <span>Edit</span>
            </button>
          )}

          {/* 3-Dot Options Menu: replaces Edit after 5 mins */}
          {isMine && !isWithinEditWindow && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="h-7 w-7 rounded-md text-slate-500 dark:text-[#B5BDB6] hover:text-slate-800 dark:hover:text-[#F4F5EF] hover:bg-slate-100 dark:hover:bg-[#202522] bg-transparent border-0 transition-colors cursor-pointer flex items-center justify-center"
                title="Options"
                aria-label="Options"
              >
                <MoreVertical size={16} />
              </button>

              {showMenu && (
                <div className="absolute right-0 bottom-full mb-1 z-30 flex flex-col items-start py-1.5 px-3 bg-white dark:bg-[#202522] border border-slate-200 dark:border-[#414A43] rounded-xl shadow-lg min-w-[76px] animate-in fade-in duration-150">
                  {/* Share option: charcoal in lightmode, ivory in darkmode, border-free */}
                  <button
                    type="button"
                    onClick={handleShare}
                    className="w-full text-left py-1 text-xs font-medium lowercase text-slate-800 dark:text-[#FFFFF0] hover:opacity-75 bg-transparent border-0 cursor-pointer"
                  >
                    {copiedShare ? 'copied' : 'share'}
                  </button>

                  {/* Delete option: red, border-free, disappears 5 min before kickoff */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onDelete?.(pick.id);
                      }}
                      className="w-full text-left py-1 text-xs font-medium lowercase text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-transparent border-0 cursor-pointer"
                    >
                      delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleLike}
            className={`h-7 px-1.5 text-xs font-bold tabular-nums flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
              isLiked
                ? 'text-[#3B82F6]'
                : 'text-slate-600 dark:text-[#B5BDB6] hover:text-slate-900 dark:hover:text-[#F4F5EF]'
            }`}
            title="Agree with this pick"
          >
            <ThumbsUp
              size={12}
              className={isLiked ? 'text-[#3B82F6] fill-none' : 'text-slate-400 dark:text-[#929D95]'}
            />
            <span className={isLiked ? 'text-[#3B82F6]' : ''}>{currentLikes}</span>
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
