export const AVATAR_PALETTE = [
  ['#1fae6f', '#0b3d2e'],
  ['#f2b705', '#5c4300'],
  ['#ef5b5b', '#5c1a1a'],
  ['#3b82f6', '#0f2a54'],
  ['#d84fb0', '#4a1a3d'],
  ['#29d38f', '#0d4a30'],
  ['#ffd23f', '#5c4a00'],
  ['#7dd3fc', '#0f3a52'],
];

export function initials(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9]/g, ' ').trim();
  const parts = clean.split(/(?=[A-Z])|_|\s+/).filter(Boolean);
  if (parts.length === 0) return name.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function colorsFor(seed: number): [string, string] {
  const idx = ((seed % AVATAR_PALETTE.length) + AVATAR_PALETTE.length) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx] as [string, string];
}
