import React from 'react';
import { ShieldAlert } from 'lucide-react';
import type { ModerationResult } from '../types/moderation';

interface ModerationWarningBoxProps {
  result: ModerationResult;
  text?: string;
  className?: string;
}

export function renderHighlightedText(text: string, flaggedPhrases: string[]) {
  if (!text) return null;
  if (!flaggedPhrases || flaggedPhrases.length === 0) return <span>{text}</span>;

  const validPhrases = flaggedPhrases
    .filter((p) => Boolean(p && p.trim()))
    .sort((a, b) => b.length - a.length);

  if (validPhrases.length === 0) return <span>{text}</span>;

  // Escape special regex characters
  const escaped = validPhrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');

  const parts = text.split(pattern);

  return (
    <span>
      {parts.map((part, i) => {
        const isFlagged = validPhrases.some((p) => p.toLowerCase() === part.toLowerCase());
        if (isFlagged) {
          return (
            <mark
              key={i}
              className="bg-rose-500/35 text-rose-100 border border-rose-500/80 font-bold px-1.5 py-0.5 rounded underline decoration-rose-400 inline-block my-0.5 shadow-sm"
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export default function ModerationWarningBox({ result, text, className = '' }: ModerationWarningBoxProps) {
  if (result.isAllowed) return null;

  const phrases = result.flaggedPhrases || (result.flaggedPhrase ? [result.flaggedPhrase] : []);

  return (
    <div className={`bg-rose-950/75 border-2 border-rose-500/80 rounded-xl p-3.5 space-y-2.5 my-2 animate-pulse shadow-lg ${className}`}>
      {/* Title Header */}
      <div className="flex items-start gap-2 text-rose-300">
        <ShieldAlert size={18} className="text-rose-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-xs uppercase tracking-wider text-rose-300">
            🚫 Post Blocked: Prohibited Terms Detected
          </p>
          <p className="text-xs text-rose-200/90 leading-relaxed mt-0.5">
            {result.reason || 'Your message contains terms prohibited by MshindiRoom safety guidelines.'}
          </p>
        </div>
      </div>

      {/* Prohibited Badges */}
      {phrases.length > 0 && (
        <div className="space-y-1 pt-1.5 border-t border-rose-500/30">
          <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wide">
            Prohibited Word(s) Found:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {phrases.map((phrase, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 bg-rose-500/30 border border-rose-400 text-rose-100 font-mono font-extrabold text-xs px-2.5 py-1 rounded-md shadow-sm"
              >
                "{phrase}"
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Text Preview with Red Highlights */}
      {text && text.trim().length > 0 && phrases.length > 0 && (
        <div className="pt-2 border-t border-rose-500/30">
          <p className="text-[11px] font-bold text-rose-300 uppercase tracking-wide mb-1">
            Remove highlighted red word(s) to allow posting:
          </p>
          <div className="bg-ink/90 border border-rose-500/40 rounded-lg p-2.5 text-xs text-cream/90 font-mono leading-relaxed max-h-28 overflow-y-auto whitespace-pre-wrap break-words">
            {renderHighlightedText(text, phrases)}
          </div>
        </div>
      )}
    </div>
  );
}
