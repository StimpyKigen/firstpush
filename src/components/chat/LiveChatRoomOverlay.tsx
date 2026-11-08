import React, { useEffect, useState, useRef } from 'react';
import { X, Users } from 'lucide-react';
import { useChatRoom } from '../../lib/useChatRoom';
import ChatMessageList from './ChatMessageList';
import TypingIndicator from './TypingIndicator';
import ChatComposer, { type ChatComposerHandle } from './ChatComposer';
import StickerGallery from './StickerGallery';
import EmojiDrawer from './EmojiDrawer';
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
  const [isStickerOpen, setIsStickerOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const composerRef = useRef<ChatComposerHandle>(null);

  const roomId = `room-${match.id}`;
  const {
    messages,
    typingUsers,
    activeUsersCount,
    sendMessage,
    notifyTyping,
    currentUserId,
    cooldownRemaining,
  } = useChatRoom(roomId, isOpen, match.status || 'pre');

  // Dynamically track visual viewport keyboard height on mobile to lift composer without displacing layout
  useEffect(() => {
    if (!isOpen) return;

    const updateKeyboard = () => {
      if (typeof window === 'undefined') return;

      // On desktop (>= 640px), let standard Tailwind modal layout handle positioning
      if (window.innerWidth >= 640) {
        setKeyboardHeight(0);
        return;
      }

      const vv = window.visualViewport;
      if (vv) {
        const kh = Math.max(0, window.innerHeight - vv.height);
        // Only treat as active keyboard if contraction exceeds 80px
        setKeyboardHeight(kh > 80 ? kh : 0);
      } else {
        setKeyboardHeight(0);
      }
    };

    updateKeyboard();

    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener('resize', updateKeyboard);
      vv.addEventListener('scroll', updateKeyboard);
    }
    window.addEventListener('resize', updateKeyboard);

    return () => {
      if (vv) {
        vv.removeEventListener('resize', updateKeyboard);
        vv.removeEventListener('scroll', updateKeyboard);
      }
      window.removeEventListener('resize', updateKeyboard);
    };
  }, [isOpen]);

  // Automatically close sticker or emoji drawer if cooldown starts
  useEffect(() => {
    if (cooldownRemaining > 0) {
      if (isStickerOpen) setIsStickerOpen(false);
      if (isEmojiOpen) setIsEmojiOpen(false);
    }
  }, [cooldownRemaining, isStickerOpen, isEmojiOpen]);

  const handleToggleSticker = () => {
    setIsEmojiOpen(false);
    setIsStickerOpen((prev) => !prev);
  };

  const handleToggleEmoji = () => {
    setIsStickerOpen(false);
    setIsEmojiOpen((prev) => !prev);
  };

  // Lock background scroll when live chat is open, restoring exact scroll position on exit
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalLeft = document.body.style.left;
    const originalRight = document.body.style.right;
    const originalWidth = document.body.style.width;
    const originalOverflow = document.body.style.overflow;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.left = originalLeft;
      document.body.style.right = originalRight;
      document.body.style.width = originalWidth;
      document.body.style.overflow = originalOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#FFFFF0] dark:bg-[#202522] sm:bg-black/75 sm:backdrop-blur-sm sm:flex sm:items-center sm:justify-center animate-in fade-in duration-150"
    >
      {/* Mobile Canvas Bleed Underlay: ensures space between livechat and keyboard or during transitions is ALWAYS ivory (#FFFFF0) or charcoal (#202522) */}
      <div className="sm:hidden absolute -inset-y-40 inset-x-0 bg-[#FFFFF0] dark:bg-[#202522] pointer-events-none" />

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
        <div className="shrink-0 h-[28px] px-2 bg-[#FFFFF0] dark:bg-[#202522] flex items-center">
          <TypingIndicator users={typingUsers} />
        </div>

        {/* Composer & Drawers (Sticker & Apple Emoji) with Constant Space Separator */}
        <div
          className="shrink-0 flex flex-col bg-[#FFFFF0] dark:bg-[#202522]"
          style={{
            paddingBottom: (isStickerOpen || isEmojiOpen)
              ? '0px'
              : keyboardHeight > 0
                ? `${keyboardHeight + 8}px`
                : 'max(8px, env(safe-area-inset-bottom, 8px))',
          }}
        >
          <ChatComposer
            ref={composerRef}
            onSend={sendMessage}
            onTyping={notifyTyping}
            placeholder="Comment here..."
            isStickerOpen={isStickerOpen}
            onToggleSticker={handleToggleSticker}
            isEmojiOpen={isEmojiOpen}
            onToggleEmoji={handleToggleEmoji}
            cooldownRemaining={cooldownRemaining}
          />

          {/* Sticker Gallery Drawer (Keyboard-size pop-up, does NOT focus input or show OS keyboard) */}
          <StickerGallery
            isOpen={isStickerOpen}
            onClose={() => setIsStickerOpen(false)}
            onSelectSticker={(stickerId) => {
              sendMessage(`[sticker:${stickerId}]`);
              setIsStickerOpen(false);
            }}
          />

          {/* Apple Emoji Picker Drawer (Keyboard-size pop-up, compact, search & skin-tones) */}
          <EmojiDrawer
            isOpen={isEmojiOpen}
            onClose={() => setIsEmojiOpen(false)}
            onSelectEmoji={(emoji) => {
              composerRef.current?.insertEmoji(emoji);
            }}
          />
        </div>
      </div>
    </div>
  );
}
