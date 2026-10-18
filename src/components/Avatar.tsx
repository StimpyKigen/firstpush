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

  // Prominent rounded-square / squircle radius proportional to avatar dimensions (iconic ~22% squircle ratio)
  const borderRadius = Math.max(5, Math.round(size * 0.22));

  if (preset) {
    const src = preset.svgContent || (preset as any).src || '';
    return (
      <div
        className="shrink-0 overflow-hidden shadow-xs transition-transform hover:scale-105"
        style={{
          width: size,
          height: size,
          borderRadius,
          border: showBorder ? `2px solid ${fg}` : 'none',
          backgroundColor: bg,
        }}
        title={preset.label}
      >
        <SkeletonImage
          src={src}
          alt={preset.label}
          className="w-full h-full object-cover scale-[1.12] origin-center"
          containerClassName="w-full h-full overflow-hidden"
        />
      </div>
    );
  }

  // Dynamic DiceBear Glyph default avatar
  if (!glyphError) {
    const glyphSeed = name ? name.trim() : `user-${seed}`;
    const glyphUrl = `https://api.dicebear.com/10.x/glyphs/svg?seed=${encodeURIComponent(glyphSeed)}`;
    return (
      <div
        className="shrink-0 overflow-hidden shadow-xs transition-transform hover:scale-105"
        style={{
          width: size,
          height: size,
          borderRadius,
          border: showBorder ? `2px solid ${fg}` : 'none',
          backgroundColor: bg,
        }}
        title={name || 'User Avatar'}
      >
        <SkeletonImage
          src={glyphUrl}
          alt={name || 'User Avatar'}
          className="w-full h-full object-cover scale-[1.12] origin-center"
          containerClassName="w-full h-full overflow-hidden"
          onError={() => setGlyphError(true)}
        />
      </div>
    );
  }

  // Graceful offline/error initials fallback
  return (
    <div
      className="flex items-center justify-center font-bold shrink-0 font-display select-none transition-transform hover:scale-105"
      style={{
        width: size,
        height: size,
        borderRadius,
        background: `linear-gradient(145deg, ${bg}, ${fg}33)`,
        border: showBorder ? `2px solid ${fg}` : 'none',
        color: fg,
        fontSize: size * 0.36,
      }}
    >
      {initials(name)}
    </div>
  );
}

