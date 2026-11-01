import { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquarePlus, ChevronDown, Users, Check } from 'lucide-react';
import type { GamblerPick, Outcome } from '../lib/types';
import CompactPickRow from './CompactPickRow';
import ModerationWarningBox from './ModerationWarningBox';
import { sortPicksByVisibility, getTopPick } from '../lib/pickSorting';
import { moderateText } from '../lib/contentModeration';
import { PickRowSkeleton } from './skeleton';
import { useCurrentUser } from '../lib/authStore';

interface DiscussionPanelProps {
  picks: GamblerPick[];
  matchId: string;
  myPick: Outcome | null;
  onPickChange: (o: Outcome) => void;
  myReason: string;
  onReasonChange: (v: string) => void;
  onSubmit: () => void;
  submitted: boolean;
  disabled?: boolean;
  label?: string;
  onEditPick?: (id: string, pick: Outcome, reasoning: string) => void;
  onDeletePick?: () => void;
  kickoffTime?: string;
  isMatchLiveOrFinished?: boolean;
  loading?: boolean;
}

const SHOW_INITIAL = 8;

export default function DiscussionPanel({
  picks,
  matchId,
  myPick,
  onPickChange,
  myReason,
  onReasonChange,
  onSubmit,
  submitted,
  disabled,
  label = 'Discussion',
  onEditPick,
  onDeletePick,
  kickoffTime,
  isMatchLiveOrFinished,
  loading = false,
}: DiscussionPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const [justPosted, setJustPosted] = useState(false);
  const [sessionNewPickUsername, setSessionNewPickUsername] = useState<string | null>(null);
  const postedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentUser = useCurrentUser();

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (postedTimerRef.current) clearTimeout(postedTimerRef.current);
    };
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const commentsViewportRef = useRef<HTMLDivElement>(null);

  // Always start from the topmost comment whenever a comment section loads or switches match
  useEffect(() => {
    if (commentsViewportRef.current) {
      commentsViewportRef.current.scrollTop = 0;
    }
  }, [matchId]);

  // Moderate reasoning text dynamically
  const modResult = useMemo(() => moderateText(myReason), [myReason]);

  // Sort picks naturally by visibility (likes + star rating weight)
  const naturallySortedPicks = useMemo(() => sortPicksByVisibility(picks), [picks]);
  const topPick = useMemo(() => getTopPick(naturallySortedPicks), [naturallySortedPicks]);

  // If the user posted in this session before refreshing, display their comment at the very top (above the most-liked one)
  const sortedPicks = useMemo(() => {
    if (!sessionNewPickUsername) return naturallySortedPicks;

    const myIndex = naturallySortedPicks.findIndex((p) => p.username === sessionNewPickUsername);
    if (myIndex === -1) return naturallySortedPicks;

    const myPickItem = naturallySortedPicks[myIndex];
    const otherPicks = naturallySortedPicks.filter((_, idx) => idx !== myIndex);
    return [myPickItem, ...otherPicks];
  }, [naturallySortedPicks, sessionNewPickUsername]);

  const visiblePicks = showAll ? sortedPicks : sortedPicks.slice(0, SHOW_INITIAL);
  const hasMore = sortedPicks.length > SHOW_INITIAL;

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [myReason]);

  const canSubmit = myPick && myReason.trim().length > 0 && modResult.isAllowed;

  function handleFormSubmit() {
    if (!canSubmit || disabled) return;

    // Clear input box
    onReasonChange('');

    // Trigger parent submission
    onSubmit();

    // Mark current user as having posted in this session (places comment at very top before refresh)
    if (currentUser?.username) {
      setSessionNewPickUsername(currentUser.username);
    }

    // Scroll comments viewport to top immediately so user sees their comment
    if (commentsViewportRef.current) {
      commentsViewportRef.current.scrollTop = 0;
    }

    // Show lowercase 'posted' text for 2 seconds
    setJustPosted(true);
    if (postedTimerRef.current) clearTimeout(postedTimerRef.current);
    postedTimerRef.current = setTimeout(() => {
      setJustPosted(false);
    }, 2000);
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Section header */}
      <div className="flex items-center justify-between px-1 mb-2.5">
        <p className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
          <MessageSquarePlus size={14} className="text-[#006C54]" />
          <span>{label}</span>
          <span className="text-slate-400 font-bold normal-case">
            ({picks.length})
          </span>
        </p>
        {picks.length > 0 && (
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <Users size={12} className="text-slate-400" /> {picks.length} {picks.length === 1 ? 'Punter Analysis' : 'Punter Analyses'}
          </span>
        )}
      </div>

      {/* Composer Card: Modern Sports Editorial Style */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 mb-3.5 shadow-2xs">
        {/* Outcome Pick Selectors */}
        <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block mb-1.5">
          Step 1: Choose Your Prediction
        </label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(['1', 'X', '2'] as Outcome[]).map((o) => {
            const isSelected = myPick === o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => !submitted && onPickChange(o)}
                disabled={disabled || submitted}
                className={`h-10 sm:h-11 px-2 rounded-md text-xs sm:text-sm font-bold uppercase tracking-wide border transition-all active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center leading-none ${
                  isSelected
                    ? o === '1'
                      ? 'bg-emerald-600 border-emerald-700 text-white shadow-xs'
                      : o === 'X'
                      ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-xs'
                      : 'bg-rose-600 border-rose-700 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                <span>{o === '1' ? '1 (Home Win)' : o === 'X' ? 'X (Draw)' : '2 (Away Win)'}</span>
              </button>
            );
          })}
        </div>

        {/* Reasoning input & Action bar */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500 block">
            Step 2: Share Your Match Reasoning
          </label>
          <textarea
            ref={textareaRef}
            value={myReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Why this pick? Share key stats, injury news, form analysis..."
            rows={2}
            disabled={disabled}
            className={`w-full bg-slate-50 border rounded-md px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 placeholder:text-xs placeholder:leading-relaxed focus:outline-none focus:bg-white transition-all resize-none leading-relaxed ${
              !modResult.isAllowed ? 'border-rose-500 bg-rose-50/50' : 'border-slate-300 focus:border-[#006C54]'
            }`}
          />

          {/* Moderation Warning Box with Prohibited Red Highlights */}
          <ModerationWarningBox result={modResult} text={myReason} />

          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
            <div className="text-xs font-bold flex items-center gap-1.5">
              {!myPick ? (
                <span className="text-amber-700 text-[11px]">
                  Select 1, X, or 2 above
                </span>
              ) : (
                <span className="text-emerald-700 text-[11px]">
                  Selected: {myPick === '1' ? 'Home Win' : myPick === 'X' ? 'Draw' : 'Away Win'}
                </span>
              )}
            </div>

            {justPosted ? (
              <span className="text-xs sm:text-sm font-bold text-[#006C54] dark:text-[#00A878] lowercase select-none py-1 animate-in fade-in duration-150">
                posted
              </span>
            ) : submitted ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#006C54] dark:text-[#00A878] select-none py-1">
                <Check size={14} className="stroke-[2.5]" />
                <span>Prediction locked in</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleFormSubmit}
                disabled={!canSubmit || disabled}
                className="p-1.5 bg-transparent border-0 focus:outline-none hover:scale-110 active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                title="Post Pick Analysis"
                aria-label="Post Pick Analysis"
              >
                <img
                  src="/images/send-icon-green.png"
                  alt="Post Pick"
                  className="w-5 h-5 object-contain"
                  width="20"
                  height="20"
                  loading="eager"
                  decoding="async"
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top-Anchored Comments Viewport */}
      <div className="bg-slate-100/50 dark:bg-[#202522] border border-slate-200 dark:border-[#414A43] rounded-xl overflow-hidden shadow-2xs">
        <div
          ref={commentsViewportRef}
          className="h-[460px] max-h-[60vh] w-full overflow-y-auto overscroll-contain p-3 sm:p-4 dark:bg-[#202522]"
        >
          <div className="flex flex-col gap-3 py-1">
            {loading ? (
              <div className="space-y-3">
                <PickRowSkeleton />
                <PickRowSkeleton />
                <PickRowSkeleton />
              </div>
            ) : visiblePicks.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-1">
                <p className="font-display font-bold text-sm uppercase tracking-wide text-slate-700">No Punter Comments Yet</p>
                <p className="text-xs">Be the first in the arena to post your prediction and analysis above!</p>
              </div>
            ) : (
              visiblePicks.map((p) => (
                <div key={p.id} className="min-w-0 shrink-0">
                  <CompactPickRow
                    pick={p}
                    isTopPick={topPick?.id === p.id}
                    onEdit={onEditPick}
                    onDelete={onDeletePick}
                    kickoffTime={kickoffTime}
                    isMatchLiveOrFinished={isMatchLiveOrFinished}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Show more toggle */}
        {hasMore && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-[#F4F5EF] bg-white dark:bg-[#2A312D] hover:bg-slate-50 dark:hover:bg-[#2F3732] transition-colors border-t border-slate-200 dark:border-[#414A43] cursor-pointer"
          >
            <ChevronDown size={14} className="text-[#006C54]" />
            <span>Show {sortedPicks.length - SHOW_INITIAL} More Community Analyses</span>
          </button>
        )}
        {showAll && hasMore && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-[#B5BDB6] bg-white dark:bg-[#2A312D] hover:bg-slate-50 dark:hover:bg-[#2F3732] transition-colors border-t border-slate-200 dark:border-[#414A43] cursor-pointer"
          >
            <span>Show Less</span>
          </button>
        )}
      </div>
    </div>
  );
}
