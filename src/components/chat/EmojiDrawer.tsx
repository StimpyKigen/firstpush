import React, { Suspense, lazy, useEffect, useState } from 'react';
import { EmojiStyle, SkinTonePickerLocation, Theme } from 'emoji-picker-react';
import { X, Smile } from 'lucide-react';

const LazyEmojiPicker = lazy(() => import('emoji-picker-react'));

interface EmojiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

export default function EmojiDrawer({
  isOpen,
  onClose,
  onSelectEmoji,
}: EmojiDrawerProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  if (!isOpen) return null;

  return (
    <div
      tabIndex={-1}
      className="w-full h-[270px] sm:h-[300px] bg-[#FFFFF0] dark:bg-[#202522] border-t border-[#E6E6D2] dark:border-[#414A43] flex flex-col overflow-hidden select-none animate-in slide-in-from-bottom-2 duration-150"
      style={
        {
          '--epr-bg-color': '#FFFFF0',
          '--epr-dark-bg-color': '#202522',
          '--epr-category-label-bg-color': '#FFFFF0',
          '--epr-dark-category-label-bg-color': '#202522',
          '--epr-highlight-color': '#006C54',
          '--epr-dark-highlight-color': '#00A878',
          '--epr-category-icon-active-color': '#006C54',
          '--epr-dark-category-icon-active-color': '#00A878',
          '--epr-picker-border-color': 'transparent',
          '--epr-dark-picker-border-color': 'transparent',
          '--epr-search-input-bg-color': '#FFFFFF',
          '--epr-dark-search-input-bg-color': '#2A312C',
          '--epr-search-border-color': '#DCDCC8',
          '--epr-dark-search-border-color': '#414A43',
          '--epr-search-border-color-active': '#006C54',
          '--epr-dark-search-border-color-active': '#00A878',
          '--epr-picker-border-radius': '0px',
        } as React.CSSProperties
      }
    >
      {/* Header with Title and Close Button */}
      <div className="shrink-0 px-3 py-1.5 border-b border-[#E6E6D2] dark:border-[#414A43] flex items-center justify-between bg-[#F5F5E4]/60 dark:bg-[#2A312C]/60">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-[#F4F5EF]">
          <Smile size={15} className="text-[#006C54] dark:text-[#00A878]" />
          <span>Apple Emojis</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close emoji picker"
          className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* Picker Container with Lazy Loading Suspense */}
      <div className="flex-1 min-h-0 w-full overflow-hidden">
        <Suspense
          fallback={
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
              <div className="w-6 h-6 border-2 border-[#006C54] dark:border-[#00A878] border-t-transparent rounded-full animate-spin" />
              <span className="text-[11px] font-medium">Loading Apple Emojis...</span>
            </div>
          }
        >
          <LazyEmojiPicker
            emojiStyle={EmojiStyle.APPLE}
            theme={isDark ? Theme.DARK : Theme.LIGHT}
            autoFocusSearch={false}
            previewConfig={{ showPreview: false }}
            skinTonePickerLocation={SkinTonePickerLocation.SEARCH}
            lazyLoadEmojis={true}
            searchDisabled={false}
            height="100%"
            width="100%"
            onEmojiClick={(emojiData) => {
              if (emojiData?.emoji) {
                onSelectEmoji(emojiData.emoji);
              }
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}

