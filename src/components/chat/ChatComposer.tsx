import React, { useState, useRef } from 'react';
import { Send } from 'lucide-react';

interface ChatComposerProps {
  onSend: (text: string) => void;
  onTyping?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ChatComposer({
  onSend,
  onTyping,
  placeholder = 'Comment here...',
  disabled = false,
}: ChatComposerProps) {
  const [text, setText] = useState('');
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
    inputRef.current?.focus();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 bg-[#FFFFF0] dark:bg-[#202522] border-t border-[#E6E6D2] dark:border-[#414A43] flex items-center gap-2"
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={300}
        className="flex-1 bg-white dark:bg-[#2A312C] border border-[#DCDCC8] dark:border-[#414A43] rounded-full px-4 py-2 text-xs text-slate-800 dark:text-[#F4F5EF] placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all shadow-2xs"
      />

      {/* Lucide Send button with emerald accent outline and no border */}
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        aria-label="Send message"
        className="p-2 rounded-full text-[#006C54] hover:text-[#005441] dark:text-[#00A878] dark:hover:text-[#00C48C] disabled:opacity-30 disabled:hover:text-[#006C54] bg-transparent border-0 shadow-none flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95"
      >
        <Send size={18} />
      </button>
    </form>
  );
}
