import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquarePlus, Send, ChevronDown, Users, Crown, ShieldAlert } from 'lucide-react';
import type { GamblerPick, Outcome } from '../lib/types';
import CompactPickRow from './CompactPickRow';
import ModerationWarningBox from './ModerationWarningBox';
import { sortPicksByVisibility, getTopPick } from '../lib/pickSorting';
import { moderateText } from '../lib/contentModeration';

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
}

const SHOW_INITIAL = 5;

export default function DiscussionPanel({
  picks,
  myPick,
  onPickChange,
  myReason,
  onReasonChange,
  onSubmit,
  submitted,
  disabled,
  label = 'Discussion',
  onEditPick,
}: DiscussionPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Moderate reasoning text dynamically
  const modResult = useMemo(() => moderateText(myReason), [myReason]);

  // Sort picks by visibility (likes + star rating weight)
  const sortedPicks = useMemo(() => sortPicksByVisibility(picks), [picks]);
  const topPick = useMemo(() => getTopPick(sortedPicks), [sortedPicks]);

  const visiblePicks = showAll ? sortedPicks : sortedPicks.slice(0, SHOW_INITIAL);
  const hasMore = sortedPicks.length > SHOW_INITIAL;

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
    }
  }, [myReason]);

  const canSubmit = myPick && myReason.trim().length > 0 && modResult.isAllowed;

  function handleFormSubmit() {
    if (!modResult.isAllowed) return;
    onSubmit();
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Section header */}
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-xs font-bold text-cream-dim uppercase tracking-wide flex items-center gap-1.5">
          <MessageSquarePlus size={12} /> {label}
          <span className="text-cream-dim/50 normal-case font-semibold">
            ({picks.length})
          </span>
        </p>
        {picks.length > 0 && (
          <span className="text-[11px] text-cream-dim/50 flex items-center gap-1">
            <Users size={10} /> {picks.length} replies
          </span>
        )}
      </div>

      {/* Composer: at top, compact */}
      <div className="bg-ink-2 border border-line rounded-xl p-3 mb-3">
        {/* Pick buttons: full width on mobile, auto on desktop */}
        <div className="flex gap-1.5 mb-2">
          {(['1', 'X', '2'] as Outcome[]).map((o) => (
            <button
              key={o}
              onClick={() => onPickChange(o)}
              disabled={disabled}
              className={`flex-1 min-w-0 px-2 sm:px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                myPick === o
                  ? 'bg-emerald-2 border-emerald-2 text-ink'
                  : 'border-line text-cream-dim hover:border-emerald-2/50 hover:text-cream'
              }`}
            >
              <span className="sm:hidden">{o}</span>
              <span className="hidden sm:inline">{o === '1' ? '1 \u00b7 Home' : o === 'X' ? 'X \u00b7 Draw' : '2 \u00b7 Away'}</span>
            </button>
          ))}
        </div>

        {/* Reasoning input & Post action bar */}
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={myReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Why this outcome? Share your reasoning..."
            rows={2}
            disabled={disabled}
            className={`w-full bg-ink border rounded-lg px-3.5 py-2.5 text-[13px] text-cream placeholder:text-cream-dim/50 focus:outline-none transition-all resize-none ${
              !modResult.isAllowed ? 'border-rose-500/80 focus:border-rose-500 bg-rose-500/5' : 'border-line focus:border-gold/80'
            }`}
          />

          {/* Moderation Warning Box with Prohibited Red Highlights */}
          <ModerationWarningBox result={modResult} text={myReason} />

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="text-[11px] font-medium flex items-center gap-1.5">
              {!myPick ? (
                <span className="text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  Select 1, X, or 2 above
                </span>
              ) : (
                <span className="text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Pick: {myPick === '1' ? '1 (Home)' : myPick === 'X' ? 'X (Draw)' : '2 (Away)'}
                </span>
              )}
            </div>

            <button
              onClick={handleFormSubmit}
              disabled={!canSubmit || disabled}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gold hover:bg-gold-2 disabled:opacity-30 disabled:cursor-not-allowed text-ink text-xs font-bold transition-all shadow-sm active:scale-95 shrink-0"
              aria-label="Post pick"
            >
              <Send size={13} className="shrink-0" />
              <span>{submitted ? 'Update Pick' : 'Post Pick'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Comment list: scrollable */}
      <div className="bg-panel border border-line rounded-xl overflow-hidden">
        <div className="max-h-[min(420px,55vh)] overflow-y-auto px-3 sm:px-4">
          {visiblePicks.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs text-cream-dim">No picks yet. Be the first to share your reasoning!</p>
            </div>
          ) : (
            visiblePicks.map((p) => (
              <CompactPickRow
                key={p.id}
                pick={p}
                isTopPick={topPick?.id === p.id}
                onEdit={onEditPick}
              />
            ))
          )}
        </div>

        {/* Show more */}
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full flex items-center justify-center gap-1 py-2.5 text-xs font-bold text-gold hover:bg-ink-2 transition-colors border-t border-line/40"
          >
            <ChevronDown size={13} />
            Show {sortedPicks.length - SHOW_INITIAL} more replies
          </button>
        )}
        {showAll && hasMore && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full flex items-center justify-center gap-1 py-2.5 text-xs font-bold text-cream-dim hover:text-cream hover:bg-ink-2 transition-colors border-t border-line/40"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}
