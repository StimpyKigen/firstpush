import React, { useRef, useEffect } from 'react';
import Avatar from '../Avatar';
import type { ChatMessage } from '../../lib/chatRoomStore';

interface ChatMessageListProps {
  messages: ChatMessage[];
  currentUserId?: string;
  className?: string;
}

export function groupMessages(messages: ChatMessage[]): ChatMessage[][] {
  const groups: ChatMessage[][] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last[0].userId === msg.userId) {
      last.push(msg);
    } else {
      groups.push([msg]);
    }
  }
  return groups;
}

function formatMessageTime(timestamp: number): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '';
  }
}

export default function ChatMessageList({
  messages,
  currentUserId,
  className = '',
}: ChatMessageListProps) {
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollEndRef.current) {
      scrollEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length]);

  const groups = groupMessages(messages);

  if (messages.length === 0) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-6 text-center select-none ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-[#F5F5E4] dark:bg-[#2A312C] border border-[#DCDCC8] dark:border-[#414A43] flex items-center justify-center text-slate-400 mb-3 shadow-2xs">
          💬
        </div>
        <h4 className="font-display font-bold text-slate-800 dark:text-[#F4F5EF] text-sm tracking-tight">
          Live Chat Room
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[240px]">
          Share live match reactions, banker callouts, and in-play thoughts with fellow punters.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex-1 overflow-y-auto px-4 py-3 no-scrollbar overscroll-contain flex flex-col justify-end min-h-0 ${className}`}
    >
      {/* Messages starting from bottom going up like YouTube Live Chat */}
      <div className="mt-auto space-y-3 w-full">
        {groups.map((group) => {
          const head = group[0];
          const isSelf = currentUserId && head.userId === currentUserId;

          return (
            <div
              key={head.id}
              className="flex items-start gap-2.5 flex-row w-full animate-in fade-in duration-150"
            >
              {/* Sender Avatar (always on left with unique assigned colored border) */}
              <div className="shrink-0 mt-0.5">
                <Avatar
                  name={head.userName}
                  seed={head.colorSeed}
                  size={26}
                  avatarId={head.avatarId}
                  showBorder={true}
                />
              </div>

              {/* Content Column (always on left, text starts on same vertical line as username) */}
              <div className="flex flex-col min-w-0 flex-1 items-start text-left">
                {/* Header: Name + Time */}
                <div className="flex items-baseline gap-1.5 mb-0.5 select-none text-left">
                  <span className="font-bold text-xs text-slate-900 dark:text-[#F4F5EF] truncate">
                    {isSelf ? `${head.userName} (You)` : head.userName}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {formatMessageTime(head.sentAt)}
                  </span>
                </div>

                {/* Consecutive Comments (no bubble borders or backgrounds, flush with username) */}
                <div className="space-y-1 w-full text-left">
                  {group.map((msg) => (
                    <p
                      key={msg.id}
                      className="text-xs text-slate-800 dark:text-[#E2E8F0] leading-snug break-words"
                    >
                      {msg.text}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={scrollEndRef} />
      </div>
    </div>
  );
}
