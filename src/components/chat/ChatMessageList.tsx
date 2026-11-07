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
      className={`flex-1 overflow-y-auto px-4 py-3 space-y-4 no-scrollbar overscroll-contain ${className}`}
    >
      {groups.map((group) => {
        const head = group[0];
        const isSelf = currentUserId && head.userId === currentUserId;

        return (
          <div
            key={head.id}
            className={`flex items-start gap-2.5 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Sender Avatar (rendered once per consecutive group) */}
            <div className="shrink-0 mt-0.5">
              <Avatar
                name={head.userName}
                seed={head.colorSeed}
                size={28}
                avatarId={head.avatarId}
                showBorder={false}
              />
            </div>

            {/* Content Column */}
            <div
              className={`flex flex-col min-w-0 max-w-[82%] sm:max-w-[78%] ${
                isSelf ? 'items-end' : 'items-start'
              }`}
            >
              {/* Header: Name + Time */}
              <div
                className={`flex items-center gap-1.5 mb-1 px-1 text-xs select-none ${
                  isSelf ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <span className="font-semibold text-slate-800 dark:text-[#F4F5EF] truncate">
                  {isSelf ? 'You' : head.userName}
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {formatMessageTime(head.sentAt)}
                </span>
              </div>

              {/* Consecutive Bubbles */}
              <div className="space-y-1 w-full">
                {group.map((msg, i) => {
                  const isFirst = i === 0;
                  const isLast = i === group.length - 1;

                  let roundedClass = 'rounded-2xl';
                  if (isSelf) {
                    roundedClass = `${isFirst ? 'rounded-tr-2xl' : 'rounded-tr-md'} ${
                      isLast ? 'rounded-br-2xl' : 'rounded-br-md'
                    } rounded-l-2xl`;
                  } else {
                    roundedClass = `${isFirst ? 'rounded-tl-2xl' : 'rounded-tl-md'} ${
                      isLast ? 'rounded-bl-2xl' : 'rounded-bl-md'
                    } rounded-r-2xl`;
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`px-3.5 py-2 text-xs leading-relaxed break-words shadow-2xs transition-all ${roundedClass} ${
                        isSelf
                          ? 'bg-[#006C54] text-white'
                          : 'bg-white dark:bg-[#202522] border border-[#E6E6D2] dark:border-[#414A43] text-slate-800 dark:text-[#F4F5EF]'
                      }`}
                    >
                      {msg.text}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={scrollEndRef} />
    </div>
  );
}
