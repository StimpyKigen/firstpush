import React, { useEffect } from 'react';
import { X, Users } from 'lucide-react';
import { useChatRoom } from '../../lib/useChatRoom';
import ChatMessageList from './ChatMessageList';
import TypingIndicator from './TypingIndicator';
import ChatComposer from './ChatComposer';
import { useBackToClose } from '../../lib/useBackToClose';
import type { FreeMatch } from '../../lib/freeMatches';

interface LiveChatRoomOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  match: FreeMatch;
}

export default function LiveChatRoomOverlay({
  isOpen,
  onClose,
  match,
}: LiveChatRoomOverlayProps) {
  useBackToClose(isOpen, onClose);

  const roomId = `room-${match.id}`;
  const {
    messages,
    typingUsers,
    activeUsersCount,
    sendMessage,
    notifyTyping,
    currentUserId,
  } = useChatRoom(roomId, isOpen);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#FFFFF0] dark:bg-[#202522] sm:bg-black/75 sm:backdrop-blur-sm sm:flex sm:items-center sm:justify-center animate-in fade-in duration-150">
      {/* Desktop: click backdrop to exit */}
      <div className="hidden sm:block absolute inset-0" onClick={onClose} />

      {/* Panel (Mobile: Fullscreen, Desktop: 390px × 90dvh framed card matching SlipFeed) */}
      <div
        className={[
          'relative w-full h-full overflow-hidden flex flex-col bg-[#FFFFF0] dark:bg-[#202522]',
          'sm:w-[390px] sm:h-[90dvh] sm:max-h-[820px]',
          'sm:rounded-[32px]',
          'sm:border sm:border-[#DCDCC8] dark:sm:border-[#414A43]',
          'sm:shadow-[0_24px_80px_-8px_rgba(0,0,0,0.5),0_0_0_1px_rgba(0,0,0,0.05)]',
        ].join(' ')}
      >
        {/* Header Bar */}
        <div
          className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 bg-[#FFFFF0] dark:bg-[#202522] border-b border-[#E6E6D2] dark:border-[#414A43] select-none"
          style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
        >
          {/* Left: "Live Chat" with pulsing green dot, and online counter following it */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#006C54] dark:text-[#00A878]">
              <span className="w-2 h-2 rounded-full bg-[#006C54] dark:bg-[#00A878] animate-pulse" />
              Live Chat
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="tabular-nums font-semibold flex items-center gap-1 text-slate-600 dark:text-slate-300">
              <Users size={12} className="text-slate-400" />
              {activeUsersCount} online
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat room"
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Message List (bottom-up YouTube live chat style) */}
        <ChatMessageList
          messages={messages}
          currentUserId={currentUserId}
          className="flex-1"
        />

        {/* Typing Indicator */}
        <div className="shrink-0 min-h-[24px] px-2 bg-[#FFFFF0] dark:bg-[#202522]">
          <TypingIndicator users={typingUsers} />
        </div>

        {/* Composer */}
        <div className="shrink-0" style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom, 0px))' }}>
          <ChatComposer
            onSend={sendMessage}
            onTyping={notifyTyping}
            placeholder="Comment here..."
          />
        </div>
      </div>
    </div>
  );
}
