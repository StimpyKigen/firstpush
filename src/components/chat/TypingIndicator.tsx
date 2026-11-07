import React from 'react';
import GlyphAvatarGroup from './GlyphAvatarGroup';
import type { TypingUser } from '../../lib/chatRoomStore';

interface TypingIndicatorProps {
  users: TypingUser[];
  className?: string;
}

export function formatTypingNames(users: TypingUser[]): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0].name} is typing`;
  if (users.length === 2) return `${users[0].name} and ${users[1].name} are typing`;
  return `${users[0].name}, ${users[1].name} and ${users.length - 2} more are typing`;
}

export default function TypingIndicator({ users, className = '' }: TypingIndicatorProps) {
  const isVisible = Boolean(users && users.length > 0);

  return (
    <div
      className={`flex items-center gap-2 py-0.5 px-3 text-xs text-slate-600 dark:text-slate-400 transition-all duration-200 select-none ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none'
      } ${className}`}
      role="status"
      aria-live="polite"
    >
      {isVisible && (
        <>
          <GlyphAvatarGroup users={users} max={3} size={22} />
          <span className="font-medium text-[11px] truncate max-w-[200px] sm:max-w-[240px]">
            {formatTypingNames(users)}
          </span>
          {/* 3 Bouncing Dots */}
          <span className="flex items-center gap-0.5 ml-0.5 shrink-0" aria-hidden="true">
            <span
              className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
              style={{ animationDuration: '900ms', animationDelay: '0ms' }}
            />
            <span
              className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
              style={{ animationDuration: '900ms', animationDelay: '150ms' }}
            />
            <span
              className="w-1 h-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
              style={{ animationDuration: '900ms', animationDelay: '300ms' }}
            />
          </span>
        </>
      )}
    </div>
  );
}
