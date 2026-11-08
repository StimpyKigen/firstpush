import React, { useState, useRef } from 'react';
import { ArrowUp, Smile, Sticker } from 'lucide-react';

const QUICK_EMOJIS = ['⚽', '🔥', '💰', '🔒', '👏', '🚀', '💯', '🤣', '👀', '🟥', '🧊', '🏆'];

interface ChatComposerProps {
  onSend: (text: string) => void;
  onTyping?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isStickerOpen?: boolean;
  onToggleSticker?: () => void;
}

export default function ChatComposer({
  onSend,
  onTyping,
  placeholder = 'Comment here...',
  disabled = false,
  isStickerOpen = false,
  onToggleSticker,
}: ChatComposerProps) {
  const [text, setText] = useState('');
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const lastTypingCallRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);
    const now = Date.now();
    // Debounce typing notification to at most once every 700ms when text is present
    if (onTyping && val.trim().length > 0 && now - lastTypingCallRef.current > 700) {
      lastTypingCallRef.current = now;
      onTyping();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setText('');
    // Keep input focused so mobile virtual keyboard does not collapse
    inputRef.current?.focus({ preventScroll: true });
  };

  const handleEmojiClick = () => {
    // Focus the input to trigger mobile device emoji keyboard, and toggle quick bar
    inputRef.current?.focus({ preventScroll: true });
    setShowEmojiBar((prev) => !prev);
  };

  const handleInsertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    inputRef.current?.focus({ preventScroll: true });
  };

  const handleStickerClick = () => {
    setShowEmojiBar(false);
    if (inputRef.current) {
      inputRef.current.blur();
    }
    onToggleSticker?.();
  };

  return (
    <div className="flex flex-col w-full bg-[#FFFFF0] dark:bg-[#202522] border-t border-[#E6E6D2] dark:border-[#414A43]">
      {/* Quick Emoji Bar when Emoji icon is tapped */}
      {showEmojiBar && (
        <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-[#E6E6D2]/60 dark:border-[#414A43]/60 bg-[#F5F5E4]/50 dark:bg-[#2A312C]/50 animate-in fade-in duration-100">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsertEmoji(emoji)}
              className="text-base p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 active:scale-125 transition-transform cursor-pointer shrink-0"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="px-3 py-2.5 flex items-center gap-2"
      >
        {/* Left Side: Emoji & Sticker Icons */}
        <div className="flex items-center gap-1 shrink-0 select-none">
          <button
            type="button"
            onClick={handleEmojiClick}
            aria-label="Insert emoji"
            title="Emoji"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              showEmojiBar
                ? 'text-[#006C54] dark:text-[#00A878] bg-[#006C54]/10 dark:bg-[#00A878]/10'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-[#F4F5EF] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Smile size={19} />
          </button>

          <button
            type="button"
            onClick={handleStickerClick}
            aria-label="Send sticker"
            title="Stickers"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isStickerOpen
                ? 'text-[#006C54] dark:text-[#00A878] bg-[#006C54]/10 dark:bg-[#00A878]/10'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-[#F4F5EF] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <Sticker size={19} />
          </button>
        </div>

        {/* Unified Input Pill containing Text Input and Inside Emerald Send Button */}
        <div className="flex-1 relative flex items-center bg-white dark:bg-[#2A312C] border border-[#DCDCC8] dark:border-[#414A43] rounded-full pl-4 pr-1.5 py-1 focus-within:border-[#006C54] focus-within:ring-1 focus-within:ring-[#006C54] transition-all shadow-2xs min-h-[38px]">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={handleInputChange}
            onFocus={() => {
              // Close sticker drawer when typing so keyboard takes over cleanly
              if (isStickerOpen) onToggleSticker?.();
            }}
            placeholder={placeholder}
            disabled={disabled}
            maxLength={300}
            className="flex-1 h-7 bg-transparent border-0 py-0 text-xs text-slate-800 dark:text-[#F4F5EF] placeholder:text-slate-400 focus:outline-none min-w-0 pr-1.5 leading-normal select-text caret-[#006C54] dark:caret-[#00A878]"
          />

          {/* New Send Button inside input area: Solid Emerald Circle with Bold White Upward Arrow (from user's photo) */}
          <button
            type="submit"
            disabled={disabled || !text.trim()}
            aria-label="Send message"
            onMouseDown={(e) => e.preventDefault()}
            onTouchStart={(e) => e.preventDefault()}
            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer select-none ${
              text.trim()
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
}
