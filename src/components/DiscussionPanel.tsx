import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquarePlus, Send, ChevronDown, Users, Crown, ShieldAlert, Sparkles } from 'lucide-react';
import type { GamblerPick, Outcome } from '../lib/types';
import CompactPickRow from './CompactPickRow';
import ModerationWarningBox from './ModerationWarningBox';
import { sortPicksByVisibility, getTopPick } from '../lib/pickSorting';
import { moderateText } from '../lib/contentModeration';
import { useCurrentUser } from '../lib/authStore';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from './ui/message-scroller';

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

const SHOW_INITIAL = 8;

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
  const currentUser = useCurrentUser();
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
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
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
      <div className="flex items-center justify-between px-1 mb-2.5">
        <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
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
        <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block mb-1.5">
          Step 1: Choose Your Prediction
        </label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(['1', 'X', '2'] as Outcome[]).map((o) => {
            const isSelected = myPick === o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => onPickChange(o)}
                disabled={disabled}
                className={`h-10 sm:h-11 px-2 rounded-md text-xs sm:text-sm font-black uppercase tracking-wider border transition-all active:scale-[0.98] cursor-pointer flex flex-col items-center justify-center leading-none ${
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
          <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
            Step 2: Share Your Match Reasoning
          </label>
          <textarea
            ref={textareaRef}
            value={myReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Why this pick? Share key stats, injury news, form analysis..."
            rows={2}
            disabled={disabled}
            className={`w-full bg-slate-50 border rounded-md px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white transition-all resize-none ${
              !modResult.isAllowed ? 'border-rose-500 bg-rose-50/50' : 'border-slate-300 focus:border-[#006C54]'
            }`}
          />

          {/* Moderation Warning Box with Prohibited Red Highlights */}
          <ModerationWarningBox result={modResult} text={myReason} />

          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
            <div className="text-xs font-bold flex items-center gap-1.5">
              {!myPick ? (
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                  Select 1, X, or 2 above
                </span>
              ) : (
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                  Selected: {myPick === '1' ? 'Home Win (1)' : myPick === 'X' ? 'Draw (X)' : 'Away Win (2)'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleFormSubmit}
              disabled={!canSubmit || disabled}
              className="h-10 px-5 rounded-md bg-[#006C54] hover:bg-[#005441] disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 inline-flex items-center justify-center gap-2 cursor-pointer shrink-0"
              aria-label="Post pick"
            >
              <Send size={13} className="shrink-0" />
              <span>{submitted ? 'Update Pick Analysis' : 'Post Pick Analysis'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Message Scroller Container with Message Cards */}
      <div className="bg-slate-100/50 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <MessageScrollerProvider autoScroll>
          <MessageScroller className="h-[460px] max-h-[60vh] w-full">
            <MessageScrollerViewport className="p-3 sm:p-4">
              <MessageScrollerContent className="space-y-3">
                {visiblePicks.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-1">
                    <p className="font-display font-black text-sm uppercase tracking-wide text-slate-700">No Punter Comments Yet</p>
                    <p className="text-xs">Be the first in the arena to post your prediction and analysis above!</p>
                  </div>
                ) : (
                  visiblePicks.map((p) => (
                    <MessageScrollerItem
                      key={p.id}
                      messageId={p.id}
                      scrollAnchor={p.username.toLowerCase() === currentUser?.username.toLowerCase()}
                    >
                      <CompactPickRow
                        pick={p}
                        isTopPick={topPick?.id === p.id}
                        onEdit={onEditPick}
                      />
                    </MessageScrollerItem>
                  ))
                )}
              </MessageScrollerContent>
            </MessageScrollerViewport>

            {/* Jump to latest message button */}
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>

        {/* Show more toggle */}
        {hasMore && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-black uppercase tracking-wider text-slate-800 bg-white hover:bg-slate-50 transition-colors border-t border-slate-200 cursor-pointer"
          >
            <ChevronDown size={14} className="text-[#006C54]" />
            <span>Show {sortedPicks.length - SHOW_INITIAL} More Community Analyses</span>
          </button>
        )}
        {showAll && hasMore && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-black uppercase tracking-wider text-slate-500 bg-white hover:bg-slate-50 transition-colors border-t border-slate-200 cursor-pointer"
          >
            <span>Show Less</span>
          </button>
        )}
      </div>
    </div>
  );
}
