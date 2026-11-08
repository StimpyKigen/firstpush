import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ArrowUp, Smile, Sticker } from 'lucide-react';

export interface ChatComposerHandle {
  insertEmoji: (emoji: string) => void;
  focus: () => void;
}

interface ChatComposerProps {
  onSend: (text: string) => void;
  onTyping?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isStickerOpen?: boolean;
  onToggleSticker?: () => void;
  isEmojiOpen?: boolean;
  onToggleEmoji?: () => void;
  cooldownRemaining?: number;
}

const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(function ChatComposer(
  {
    onSend,
    onTyping,
    placeholder = 'Comment here...',
    disabled = false,
    isStickerOpen = false,
    onToggleSticker,
    isEmojiOpen = false,
    onToggleEmoji,
    cooldownRemaining = 0,
  },
  ref
) {
  const [text, setText] = useState('');
  const lastTypingCallRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCooldown = Boolean(cooldownRemaining && cooldownRemaining > 0);

  // Insert emoji at the active cursor position, advancing the cursor immediately after
  const insertEmojiAtCursor = (emoji: string) => {
    if (disabled || isCooldown) return;
    const input = inputRef.current;
    if (!input) {
      setText((prev) => prev + emoji);
      return;
    }

    const start = input.selectionStart ?? text.length;
    const end = input.selectionEnd ?? text.length;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);

    // Debounce typing notification to at most once every 700ms when text is present
    const now = Date.now();
    if (onTyping && newText.trim().length > 0 && now - lastTypingCallRef.current > 700) {
      lastTypingCallRef.current = now;
      onTyping();
    }

    // Only advance selection range if user is actively in the input to avoid triggering OS keyboard on mobile
    if (document.activeElement === input) {
      requestAnimationFrame(() => {
        const newPos = start + emoji.length;
        try {
          input.setSelectionRange(newPos, newPos);
        } catch {
          // Fallback for environments where setSelectionRange is unhandled
        }
      });
    }
  };

  useImperativeHandle(
    ref,
    () => ({
      insertEmoji: insertEmojiAtCursor,
      focus: () => inputRef.current?.focus(),
    }),
    [disabled, isCooldown, text, onTyping]
  );

  const handleBeforeInput = (e: React.FormEvent<HTMLInputElement>) => {
    if (isCooldown) {
      e.preventDefault();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCooldown) return;
    const val = e.target.value;
    setText(val);
    const now = Date.now();
    // Debounce typing notification to at most once every 700ms when text is present
    if (onTyping && val.trim().length > 0 && now - lastTypingCallRef.current > 700) {
      lastTypingCallRef.current = now;
      onTyping();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isCooldown) {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (isCooldown) {
      e.preventDefault();
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLInputElement>) => {
    if (isCooldown) {
      e.preventDefault();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled || isCooldown) return;

    // Only keep virtual keyboard if user triggered/focused the input and is not sending from drawers
    const shouldKeepKeyboard =
      document.activeElement === inputRef.current && !isStickerOpen && !isEmojiOpen;

    onSend(trimmed);
    setText('');

    if (shouldKeepKeyboard) {
      inputRef.current?.focus({ preventScroll: true });
    } else {
      inputRef.current?.blur();
    }
  };

  const handleEmojiClick = () => {
    if (disabled || isCooldown) return;
    // Blur input so mobile virtual keyboard dismisses cleanly when emoji drawer opens
    if (inputRef.current) {
      inputRef.current.blur();
    }
    onToggleEmoji?.();
  };

  const handleStickerClick = () => {
    if (disabled || isCooldown) return;
    if (inputRef.current) {
      inputRef.current.blur();
    }
    onToggleSticker?.();
  };

  return (
    <div className="flex flex-col w-full bg-[#FFFFF0] dark:bg-[#202522] border-t border-[#E6E6D2] dark:border-[#414A43]">
      <form
        onSubmit={handleSubmit}
        className="px-3 py-2.5 flex items-center gap-2"
      >
        {/* Left Side: Apple Emoji & Sticker Icons */}
        <div className="flex items-center gap-1 shrink-0 select-none">
          <button
            type="button"
            onClick={handleEmojiClick}
            disabled={disabled || isCooldown}
            aria-label="Insert emoji"
            title={isCooldown ? `Cooldown active (${cooldownRemaining}s)` : 'Apple Emojis'}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              disabled || isCooldown
                ? 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed pointer-events-none'
                : isEmojiOpen
                ? 'text-[#006C54] dark:text-[#00A878] bg-[#006C54]/10 dark:bg-[#00A878]/10 cursor-pointer'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-[#F4F5EF] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer'
            }`}
          >
            <Smile size={19} />
          </button>

          <button
            type="button"
            onClick={handleStickerClick}
            disabled={disabled || isCooldown}
            aria-label="Send sticker"
            title={isCooldown ? `Cooldown active (${cooldownRemaining}s)` : 'Stickers'}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              disabled || isCooldown
                ? 'text-slate-300 dark:text-slate-600 opacity-40 cursor-not-allowed pointer-events-none'
                : isStickerOpen
                ? 'text-[#006C54] dark:text-[#00A878] bg-[#006C54]/10 dark:bg-[#00A878]/10 cursor-pointer'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-[#F4F5EF] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer'
            }`}
          >
            <Sticker size={19} />
          </button>
        </div>

        {/* Unified Input Pill containing Text Input, Countdown Timer and Inside Emerald Send Button */}
        <div className="flex-1 relative flex items-center bg-white dark:bg-[#2A312C] border border-[#DCDCC8] dark:border-[#414A43] rounded-full pl-4 pr-[9px] py-1 focus-within:border-[#006C54] focus-within:ring-1 focus-within:ring-[#006C54] transition-all shadow-2xs min-h-[38px]">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={handleInputChange}
            onBeforeInput={handleBeforeInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onFocus={() => {
              // Close sticker or emoji drawer when typing so keyboard takes over cleanly
              if (isStickerOpen) onToggleSticker?.();
              if (isEmojiOpen) onToggleEmoji?.();
            }}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={disabled}
            maxLength={300}
            className={`flex-1 h-7 bg-transparent border-0 py-0 text-xs text-slate-800 dark:text-[#F4F5EF] placeholder:text-slate-400 focus:outline-none min-w-0 pr-1.5 leading-normal select-text ${
              isCooldown
                ? 'cursor-not-allowed opacity-75 caret-transparent'
                : 'caret-[#006C54] dark:caret-[#00A878]'
            }`}
          />

          {/* 30-Second Cooldown Countdown Badge immediately before the Send Button */}
          {isCooldown && (
            <span
              aria-label={`${cooldownRemaining} seconds cooldown remaining`}
              className="shrink-0 text-slate-400 dark:text-slate-500 font-mono text-[11px] tabular-nums font-medium pr-1.5 select-none animate-in fade-in duration-150"
            >
              {`${cooldownRemaining}s`}
            </span>
          )}

          {/* New Send Button inside input area: Solid Emerald Circle with Bold White Upward Arrow (from user's photo) */}
          <button
            type="submit"
            disabled={disabled || isCooldown || !text.trim()}
            aria-label="Send message"
            onMouseDown={(e) => e.preventDefault()}
            onTouchStart={(e) => e.preventDefault()}
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer select-none ${
              text.trim() && !disabled && !isCooldown
                ? 'bg-[#006C54] hover:bg-[#005441] dark:bg-[#00A878] dark:hover:bg-[#008f66] text-white active:scale-90 shadow-2xs'
                : 'bg-black/10 dark:bg-white/10 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-40'
            }`}
          >
            <ArrowUp size={15} strokeWidth={2.75} />
          </button>
        </div>
      </form>
    </div>
  );
});

export default ChatComposer;
