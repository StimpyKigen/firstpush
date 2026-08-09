import { colorsFor, initials } from '../lib/avatar';
import { getAvatarById } from '../lib/avatarCatalog';
import { avatarStore } from '../lib/avatarStore';

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
  const allActive = avatarStore.getAllActiveAvatars();
  const preset = avatarId ? allActive.find((a) => a.id === avatarId) || getAvatarById(avatarId) : undefined;

  if (preset) {
    const [fg] = colorsFor(seed);
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
        <img
          src={src}
          alt={preset.label}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const [fg, bg] = colorsFor(seed);
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
