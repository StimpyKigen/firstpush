import React from 'react';

// Converts an emoji string into Apple emoji unified hex format (excluding variation selectors fe0f)
export function emojiToAppleUnified(str: string): string {
  return Array.from(str)
    .map((c) => c.codePointAt(0)!.toString(16))
    .filter((h) => h !== 'fe0f')
    .join('-');
}

export function getAppleEmojiUrl(unified: string): string {
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${unified}.png`;
}

interface AppleEmojiProps {
  emoji: string;
  size?: number | string;
  className?: string;
}

export function AppleEmoji({ emoji, size = 15, className = '' }: AppleEmojiProps) {
  const unified = emojiToAppleUnified(emoji);
  const url = getAppleEmojiUrl(unified);

  return (
    <span className={`inline-flex items-center justify-center align-[-1.5px] mx-[1px] select-none ${className}`}>
      <img
        src={url}
        alt={emoji}
        loading="lazy"
        draggable={false}
        style={{ width: size, height: size }}
        className="inline-block object-contain"
        onError={(e) => {
          // If image fails, hide image so text emoji fallback is shown
          const target = e.currentTarget;
          target.style.display = 'none';
          const next = target.nextElementSibling as HTMLElement | null;
          if (next) next.style.display = 'inline';
        }}
      />
      <span style={{ display: 'none' }}>{emoji}</span>
    </span>
  );
}

// Renders text with Apple-style emojis, sized to natural compact text size (never overshadows text)
export function FormattedMessageText({ text }: { text: string }) {
  const segmenter =
    typeof Intl !== 'undefined' && Intl.Segmenter
      ? new Intl.Segmenter('en', { granularity: 'grapheme' })
      : null;

  // Split on emoji clusters while preserving non-emoji text
  const emojiRegex = /(\p{Extended_Pictographic}+)/gu;
  const parts = text.split(emojiRegex);

  return (
    <span>
      {parts.map((part, i) => {
        if (!part) return null;
        if (/\p{Extended_Pictographic}/u.test(part)) {
          const subGraphemes = segmenter
            ? Array.from(segmenter.segment(part)).map((s) => s.segment)
            : Array.from(part);
          return (
            <React.Fragment key={i}>
              {subGraphemes.map((g, gi) => (
                <AppleEmoji key={`${i}-${gi}`} emoji={g} size={15} />
              ))}
            </React.Fragment>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
}

