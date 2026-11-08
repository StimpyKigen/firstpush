import React, { useState } from 'react';
import { CHAT_STICKERS, type ChatSticker } from './chatStickers';
import { X, Sparkles } from 'lucide-react';

interface StickerGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSticker: (stickerId: string) => void;
}

export default function StickerGallery({
  isOpen,
  onClose,
  onSelectSticker,
}: StickerGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | 'match' | 'betting' | 'reaction'>('all');

  if (!isOpen) return null;

  const filteredStickers =
    activeCategory === 'all'
      ? CHAT_STICKERS
      : CHAT_STICKERS.filter((s) => s.category === activeCategory);

  return (
    <div
      tabIndex={-1}
      className="w-full h-[250px] sm:h-[260px] bg-[#FFFFF0] dark:bg-[#202522] border-t border-[#E6E6D2] dark:border-[#414A43] flex flex-col overflow-hidden select-none animate-in slide-in-from-bottom-2 duration-150"
    >
      {/* Category Tabs Header */}
      <div className="shrink-0 px-3 py-2 border-b border-[#E6E6D2] dark:border-[#414A43] flex items-center justify-between gap-2 bg-[#F5F5E4]/60 dark:bg-[#2A312C]/60">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'all', label: 'All Stickers' },
              { id: 'match', label: '⚽ Match' },
              { id: 'betting', label: '💰 Banker' },
              { id: 'reaction', label: '🔥 Hype' },
            ] as const
          ).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-[#006C54] text-white shadow-2xs dark:bg-[#00A878]'
                  : 'bg-black/5 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close sticker gallery"
          className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* Grid of Stickers */}
      <div className="flex-1 overflow-y-auto p-3 no-scrollbar grid grid-cols-4 sm:grid-cols-6 gap-2.5 place-items-center">
        {filteredStickers.map((sticker) => (
          <button
            key={sticker.id}
            type="button"
            onClick={() => onSelectSticker(sticker.id)}
            title={sticker.name}
            className="group p-1.5 rounded-2xl flex flex-col items-center justify-center transition-all hover:bg-black/5 dark:hover:bg-white/5 active:scale-90 cursor-pointer"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center transition-transform group-hover:scale-105 drop-shadow-xs">
              {sticker.render(56)}
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1 truncate max-w-[64px] text-center">
              {sticker.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

