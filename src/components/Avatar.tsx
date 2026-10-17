import { useState } from 'react';
import { colorsFor, initials } from '../lib/avatar';
import { getAvatarById } from '../lib/avatarCatalog';
import { avatarStore } from '../lib/avatarStore';
import { SkeletonImage } from './skeleton';

export default function Avatar({
  name,
  seed,
  size = 40,
  avatarId,
  showBorder = true,
}: {
  name: string;
  seed: number;
  size?: number;
  avatarId?: string | null;
  showBorder?: boolean;
}) {
  const [glyphError, setGlyphError] = useState(false);
  const allActive = avatarStore.getAllActiveAvatars();
  const preset = avatarId ? allActive.find((a) => a.id === avatarId) || getAvatarById(avatarId) : undefined;
  const [fg, bg] = colorsFor(seed);

  if (preset) {
    const src = preset.svgContent || (preset as any).src || '';
    return (
      <div
        className="rounded-full shrink-0 overflow-hidden bg-ink-2 shadow-sm transition-transform hover:scale-105"
        style={{
          width: size,
          height: size,
          border: showBorder ? `1.5px solid ${fg}` : 'none',
        }}
        title={preset.label}
      >
        <SkeletonImage
          src={src}
          alt={preset.label}
          className="w-full h-full object-cover"
          containerClassName="w-full h-full"
          skeletonClassName="rounded-full"
        />
      </div>
    );
  }

  // Dynamic DiceBear Glyph default avatar
  if (!glyphError) {
    const glyphSeed = name ? name.trim() : `user-${seed}`;
    const glyphUrl = `https://api.dicebear.com/10.x/glyphs/svg?seed=${encodeURIComponent(glyphSeed)}&radius=50`;
    return (
      <div
        className="rounded-full shrink-0 overflow-hidden bg-ink-2 shadow-sm transition-transform hover:scale-105"
        style={{
          width: size,
          height: size,
          border: showBorder ? `1.5px solid ${fg}` : 'none',
        }}
        title={name || 'User Avatar'}
      >
        <SkeletonImage
          src={glyphUrl}
          alt={name || 'User Avatar'}
          className="w-full h-full object-cover"
          containerClassName="w-full h-full"
          skeletonClassName="rounded-full"
          onError={() => setGlyphError(true)}
        />
      </div>
    );
  }

  // Graceful offline/error initials fallback
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold shrink-0 font-display select-none transition-transform hover:scale-105"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${bg}, ${fg}33)`,
        border: showBorder ? `1.5px solid ${fg}` : 'none',
        color: fg,
        fontSize: size * 0.36,
      }}
    >
      {initials(name)}
    </div>
  );
}

