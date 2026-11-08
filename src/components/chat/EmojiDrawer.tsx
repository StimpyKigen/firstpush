import React, { Suspense, lazy, useEffect, useState } from 'react';
import { EmojiStyle, SkinTonePickerLocation, Theme } from 'emoji-picker-react';

const LazyEmojiPicker = lazy(() => import('emoji-picker-react'));

interface EmojiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

export default function EmojiDrawer({
  isOpen,
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
      className="mshindi-emoji-drawer w-full h-[270px] sm:h-[290px] bg-[#FFFFF0] dark:bg-[#202522] border-t border-[#E6E6D2] dark:border-[#414A43] flex flex-col overflow-hidden select-none animate-in slide-in-from-bottom-2 duration-150"
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
          '--epr-search-input-height': '32px',
          '--epr-search-input-padding': '0 12px 0 36px',
          '--epr-search-bar-inner-padding': '10px',
          '--epr-search-input-border-radius': '9999px',
          '--epr-header-padding': '6px 10px 4px 10px',
          '--epr-category-navigation-button-size': '24px',
          '--epr-category-label-height': '22px',
          '--epr-emoji-size': '22px',
          '--epr-horizontal-padding': '10px',
          '--epr-picker-border-radius': '0px',
        } as React.CSSProperties
      }
    >
      <style>{`
        /* 1. Flush fill: remove default picker borders, insets and rounded corners */
        .mshindi-emoji-drawer aside.EmojiPickerReact,
        .mshindi-emoji-drawer aside.epr-structural-root,
        .mshindi-emoji-drawer .epr-structural-panel,
        .mshindi-emoji-drawer .epr-main {
          width: 100% !important;
          max-width: 100% !important;
          height: 100% !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          background-color: transparent !important;
        }

        /* 2. Search container and input: perfect horizontal & vertical center alignment */
        .mshindi-emoji-drawer .epr-search-container {
          position: relative !important;
          display: flex !important;
          align-items: center !important;
          height: 32px !important;
        }
        .mshindi-emoji-drawer .epr-search-container input {
          font-size: 12px !important;
          height: 32px !important;
          line-height: 32px !important;
          border-radius: 9999px !important;
          padding-left: 36px !important;
          padding-right: 12px !important;
          display: block !important;
          box-sizing: border-box !important;
        }
        .mshindi-emoji-drawer .epr-icn-search {
          top: 50% !important;
          transform: translateY(-50%) !important;
          width: 18px !important;
          height: 18px !important;
          background-size: 18px !important;
        }

        /* 3. Category navigation: increase icon size by ~25% for effortless readability */
        .mshindi-emoji-drawer .epr-category-nav {
          padding: 2px 6px !important;
          gap: 6px !important;
          align-items: center !important;
        }
        .mshindi-emoji-drawer .epr-category-nav button {
          width: 24px !important;
          height: 24px !important;
          padding: 2px !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          background: transparent !important;
        }
        .mshindi-emoji-drawer .epr-category-nav button svg {
          width: 16.5px !important;
          height: 16.5px !important;
          stroke-width: 1.8 !important;
        }

        /* 4. Remove circular border on active or focused category buttons */
        .mshindi-emoji-drawer .epr-category-nav button:before,
        .mshindi-emoji-drawer .epr-category-nav button:after,
        .mshindi-emoji-drawer .epr-cat-btn:before,
        .mshindi-emoji-drawer .epr-cat-btn:after {
          display: none !important;
          content: none !important;
          border: none !important;
        }
        .mshindi-emoji-drawer .epr-category-nav button:focus,
        .mshindi-emoji-drawer .epr-category-nav button:active {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }

        .mshindi-emoji-drawer .epr-skin-tones {
          transform: scale(0.85);
          transform-origin: center right;
        }
      `}</style>

      {/* Picker Container with Lazy Loading Suspense (Header removed so clicking emoji icon collapses drawer) */}
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

