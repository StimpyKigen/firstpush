export type AvatarCategory =
  | 'champions'
  | 'football'
  | 'animals'
  | 'fantasy'
  | 'futuristic'
  | 'human'
  | 'gaming'
  | 'luxury'
  | 'african'
  | 'abstract'
  | 'glyphs';

export type UnlockTier = 'starter' | 'silver' | 'gold' | 'diamond' | 'champion' | 'seasonal' | 'premium';

export interface AvatarOption {
  id: string;
  label: string;
  category: AvatarCategory;
  tier: UnlockTier;
  unlockRequirement: string;
  svgContent: string;
  tags: string[];
  isFeatured?: boolean;
  isCustom?: boolean;
}

export interface CategoryInfo {
  id: AvatarCategory;
  label: string;
  iconName: string;
  description: string;
}

export const AVATAR_CATEGORIES: CategoryInfo[] = [
  { id: 'glyphs', label: 'Glyphs', iconName: 'Shapes', description: 'Minimalist geometric silhouettes and abstract glyphs by Matt Houser' },
  { id: 'champions', label: 'Champions', iconName: 'Trophy', description: 'Royal crowns, crests, and victory honors' },
  { id: 'football', label: 'Football', iconName: 'Futbol', description: 'Pitch legends, tactical minds, and stadium heroes' },
  { id: 'animals', label: 'Animals', iconName: 'Zap', description: 'Apex predators, spirit fauna, and wild beasts' },
  { id: 'fantasy', label: 'Fantasy', iconName: 'Shield', description: 'Mystic guardians, knights, and shadow warriors' },
  { id: 'futuristic', label: 'Futuristic', iconName: 'Bot', description: 'Cyber soldier units, AI nodes, and synth avatars' },
  { id: 'human', label: 'Human', iconName: 'User', description: 'Inclusive streetwear, afro art, locs, headphones & specs' },
  { id: 'gaming', label: 'Gaming', iconName: 'Gamepad2', description: 'Arcade legends, pixel heroes, and VR streamers' },
  { id: 'luxury', label: 'Luxury', iconName: 'Gem', description: 'Diamonds, obsidian, gold bullion, and royal marble' },
  { id: 'african', label: 'African', iconName: 'Sun', description: 'Savannah lions, tribal vectors, and Rift valley crests' },
  { id: 'abstract', label: 'Abstract', iconName: 'Sparkles', description: 'Neon plasma, geometry, fire, ice & galaxian shapes' },
];

export const UNLOCK_TIER_CONFIG: Record<UnlockTier, { label: string; color: string; badgeBg: string; minJackpots?: number; minRating?: number; minWins?: number }> = {
  starter: { label: 'Starter', color: '#10b981', badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  silver: { label: 'Silver Tier', color: '#94a3b8', badgeBg: 'bg-slate-500/10 border-slate-400/30 text-slate-300', minJackpots: 10 },
  gold: { label: 'Gold Tier (3★)', color: '#f59e0b', badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400', minRating: 3.0 },
  diamond: { label: 'Diamond (5 Wins)', color: '#38bdf8', badgeBg: 'bg-sky-500/10 border-sky-500/30 text-sky-300', minWins: 5 },
  champion: { label: 'Champion (5★)', color: '#ec4899', badgeBg: 'bg-pink-500/10 border-pink-500/30 text-pink-400', minRating: 4.8 },
  seasonal: { label: 'Special Event', color: '#8b5cf6', badgeBg: 'bg-purple-500/10 border-purple-500/30 text-purple-300' },
  premium: { label: 'VIP Exclusive', color: '#ef4444', badgeBg: 'bg-rose-500/10 border-rose-500/30 text-rose-400' },
};

// Helper SVG Generator producing ultra-sharp, high-contrast, beautiful vector graphics
function makeSvg(bgGradient: [string, string], innerPath: string, accentColor = '#f59e0b'): string {
  const [bg1, bg2] = bgGradient;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}" />
      <stop offset="100%" stop-color="${bg2}" />
    </linearGradient>
    <linearGradient id="acc" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accentColor}" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.8" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.4" />
    </radialGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#bg)" />
  <rect x="1" y="1" width="126" height="126" rx="27" fill="none" stroke="${accentColor}" stroke-opacity="0.3" stroke-width="2" />
  <rect width="128" height="128" rx="28" fill="url(#glow)" />
  <g transform="translate(16, 16)">
    ${innerPath}
  </g>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Icon Path Templates for vector rendering
const PATHS = {
  crown: `<path d="M12 72 L16 32 L40 52 L48 16 L56 52 L80 32 L84 72 Z" fill="url(#acc)" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>
          <circle cx="16" cy="28" r="5" fill="#f59e0b"/>
          <circle cx="48" cy="12" r="6" fill="#fbbf24"/>
          <circle cx="80" cy="28" r="5" fill="#f59e0b"/>
          <rect x="16" y="74" width="64" height="10" rx="3" fill="#ffffff" opacity="0.9"/>`,

  trophy: `<path d="M24 20 H72 V48 C72 62 60 74 48 74 C36 74 24 62 24 48 Z" fill="url(#acc)" stroke="#ffffff" stroke-width="3"/>
           <path d="M40 74 H56 V88 H40 Z" fill="#ffffff"/>
           <path d="M28 88 H68 V96 H28 Z" fill="url(#acc)"/>
           <path d="M12 24 C12 40 24 44 24 44" fill="none" stroke="url(#acc)" stroke-width="5" stroke-linecap="round"/>
           <path d="M84 24 C84 40 72 44 72 44" fill="none" stroke="url(#acc)" stroke-width="5" stroke-linecap="round"/>`,

  shield: `<path d="M48 8 L84 24 V52 C84 74 48 90 48 90 C48 90 12 74 12 52 V24 Z" fill="url(#acc)" stroke="#ffffff" stroke-width="3"/>
           <path d="M48 24 L56 40 L72 44 L60 56 L64 72 L48 64 L32 72 L36 56 L24 44 L40 40 Z" fill="#ffffff" opacity="0.95"/>`,

  laurel: `<circle cx="48" cy="48" r="28" fill="none" stroke="url(#acc)" stroke-width="4"/>
           <path d="M48 24 L54 36 L48 32 L42 36 Z" fill="#ffffff"/>
           <path d="M48 64 L54 76 L48 72 L42 76 Z" fill="#ffffff"/>
           <path d="M24 48 L36 54 L32 48 L36 42 Z" fill="#ffffff"/>
           <path d="M64 48 L76 54 L72 48 L76 42 Z" fill="#ffffff"/>`,

  football: `<circle cx="48" cy="48" r="40" fill="#ffffff" stroke="#1e293b" stroke-width="3"/>
             <polygon points="48,32 60,40 56,56 40,56 36,40" fill="#0f172a"/>
             <line x1="48" y1="32" x2="48" y2="8" stroke="#0f172a" stroke-width="3"/>
             <line x1="60" y1="40" x2="84" y2="30" stroke="#0f172a" stroke-width="3"/>
             <line x1="56" y1="56" x2="76" y2="76" stroke="#0f172a" stroke-width="3"/>
             <line x1="40" y1="56" x2="20" y2="76" stroke="#0f172a" stroke-width="3"/>
             <line x1="36" y1="40" x2="12" y2="30" stroke="#0f172a" stroke-width="3"/>`,

  boot: `<path d="M12 56 C12 56 24 36 44 36 H72 L84 64 H12 Z" fill="url(#acc)" stroke="#ffffff" stroke-width="3"/>
         <rect x="16" y="64" width="8" height="10" rx="2" fill="#ffffff"/>
         <rect x="36" y="64" width="8" height="10" rx="2" fill="#ffffff"/>
         <rect x="56" y="64" width="8" height="10" rx="2" fill="#ffffff"/>
         <rect x="72" y="64" width="8" height="10" rx="2" fill="#ffffff"/>`,

  lion: `<path d="M48 12 C28 12 16 28 16 48 C16 68 32 84 48 84 C64 84 80 68 80 48 C80 28 68 12 48 12 Z" fill="url(#acc)"/>
         <polygon points="48,40 36,60 60,60" fill="#0f172a"/>
         <circle cx="34" cy="36" r="5" fill="#ffffff"/>
         <circle cx="62" cy="36" r="5" fill="#ffffff"/>
         <circle cx="34" cy="36" r="2.5" fill="#000000"/>
         <circle cx="62" cy="36" r="2.5" fill="#000000"/>
         <path d="M28 70 Q48 82 68 70" stroke="#000000" stroke-width="3" fill="none"/>`,

  wolf: `<polygon points="48,12 20,40 30,84 48,72 66,84 76,40" fill="url(#acc)" stroke="#ffffff" stroke-width="3"/>
         <polygon points="34,38 26,20 40,32" fill="#0f172a"/>
         <polygon points="62,38 70,20 56,32" fill="#0f172a"/>
         <circle cx="36" cy="46" r="4" fill="#38bdf8"/>
         <circle cx="60" cy="46" r="4" fill="#38bdf8"/>`,

  dragon: `<path d="M48 8 C30 8 16 24 16 44 C16 70 48 88 48 88 C48 88 80 70 80 44 C80 24 66 8 48 8 Z" fill="url(#acc)"/>
           <path d="M24 20 L8 8 L28 32" stroke="#ffffff" stroke-width="4" fill="none"/>
           <path d="M72 20 L88 8 L68 32" stroke="#ffffff" stroke-width="4" fill="none"/>
           <polygon points="48,44 40,64 56,64" fill="#0f172a"/>
           <circle cx="36" cy="40" r="4" fill="#ef4444"/>
           <circle cx="60" cy="40" r="4" fill="#ef4444"/>`,

  ninja: `<rect x="16" y="24" width="64" height="48" rx="12" fill="#0f172a" stroke="url(#acc)" stroke-width="4"/>
          <rect x="24" y="38" width="48" height="16" rx="6" fill="#38bdf8"/>
          <circle cx="36" cy="46" r="3.5" fill="#ffffff"/>
          <circle cx="60" cy="46" r="3.5" fill="#ffffff"/>
          <path d="M12 32 L84 32" stroke="#ef4444" stroke-width="5"/>`,

  robot: `<rect x="20" y="20" width="56" height="56" rx="10" fill="url(#acc)" stroke="#ffffff" stroke-width="3"/>
          <rect x="28" y="32" width="40" height="16" rx="4" fill="#000000"/>
          <circle cx="36" cy="40" r="4" fill="#22c55e"/>
          <circle cx="60" cy="40" r="4" fill="#22c55e"/>
          <line x1="48" y1="20" x2="48" y2="6" stroke="#ffffff" stroke-width="4"/>
          <circle cx="48" cy="6" r="5" fill="#ef4444"/>`,

  humanAfro: `<circle cx="48" cy="36" r="30" fill="#1e1b4b"/>
              <circle cx="48" cy="54" r="24" fill="#d97706"/>
              <rect x="28" y="44" width="16" height="8" rx="4" fill="#000000"/>
              <rect x="52" y="44" width="16" height="8" rx="4" fill="#000000"/>
              <path d="M36" y="68" Q48 76 60 68" stroke="#000000" stroke-width="3" fill="none"/>`,

  humanHeadphones: `<circle cx="48" cy="50" r="26" fill="#f59e0b"/>
                    <path d="M16 48 C16 24 32 16 48 16 C64 16 80 24 80 48" fill="none" stroke="#38bdf8" stroke-width="6"/>
                    <rect x="12" y="40" width="12" height="24" rx="4" fill="#0f172a"/>
                    <rect x="72" y="40" width="12" height="24" rx="4" fill="#0f172a"/>
                    <circle cx="36" cy="48" r="3" fill="#000"/>
                    <circle cx="60" cy="48" r="3" fill="#000"/>`,

  gamepad: `<rect x="12" y="30" width="72" height="36" rx="18" fill="url(#acc)" stroke="#ffffff" stroke-width="3"/>
            <path d="M28 40 V56 M20 48 H36" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
            <circle cx="62" cy="42" r="4" fill="#ef4444"/>
            <circle cx="72" cy="48" r="4" fill="#3b82f6"/>
            <circle cx="62" cy="54" r="4" fill="#22c55e"/>
            <circle cx="52" cy="48" r="4" fill="#eab308"/>`,

  gem: `<polygon points="48,12 76,32 48,84 20,32" fill="url(#acc)" stroke="#ffffff" stroke-width="3"/>
        <line x1="20" y1="32" x2="76" y2="32" stroke="#ffffff" stroke-width="2"/>
        <line x1="48" y1="12" x2="48" y2="84" stroke="#ffffff" stroke-width="2"/>`,

  savannah: `<circle cx="48" cy="48" r="36" fill="url(#acc)"/>
             <path d="M12 68 Q48 40 84 68 Z" fill="#0f172a"/>
             <path d="M48 24 A 12 12 0 0 0 48 48 A 12 12 0 0 0 48 24" fill="#f59e0b"/>`,

  lightning: `<polygon points="56,8 20,52 48,52 40,88 76,44 48,44" fill="url(#acc)" stroke="#ffffff" stroke-width="3"/>`,

  galaxy: `<circle cx="48" cy="48" r="36" fill="none" stroke="url(#acc)" stroke-width="8"/>
           <ellipse cx="48" cy="48" rx="42" ry="14" fill="none" stroke="#ffffff" stroke-width="4" transform="rotate(-30 48 48)"/>
           <circle cx="48" cy="48" r="14" fill="#ec4899"/>`,
};

// Generate catalog with 160 distinct items
const rawCatalogData: Array<{
  id: string;
  label: string;
  category: AvatarCategory;
  tier: UnlockTier;
  unlockRequirement: string;
  pathKey: keyof typeof PATHS;
  gradient: [string, string];
  accent: string;
  tags: string[];
  isFeatured?: boolean;
}> = [
  // CHAMPIONS (16)
  { id: 'golden-crown', label: 'Golden Crown', category: 'champions', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'crown', gradient: ['#451a03', '#78350f'], accent: '#fbbf24', tags: ['crown', 'king', 'gold'], isFeatured: true },
  { id: 'apex-trophy', label: 'Apex Trophy', category: 'champions', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'trophy', gradient: ['#064e3b', '#047857'], accent: '#34d399', tags: ['trophy', 'cup', 'winner'] },
  { id: 'victory-shield', label: 'Victory Shield', category: 'champions', tier: 'silver', unlockRequirement: 'Play 10 jackpots', pathKey: 'shield', gradient: ['#1e1b4b', '#3730a3'], accent: '#818cf8', tags: ['shield', 'armor'] },
  { id: 'laurel-wreath', label: 'Laurel Wreath', category: 'champions', tier: 'gold', unlockRequirement: 'Reach ⭐⭐⭐ Rating', pathKey: 'laurel', gradient: ['#701a75', '#a21caf'], accent: '#f0abfc', tags: ['laurel', 'olympus'] },
  { id: 'diamond-crest', label: 'Diamond Crest', category: 'champions', tier: 'diamond', unlockRequirement: 'Win 5 jackpots', pathKey: 'shield', gradient: ['#0c4a6e', '#0369a1'], accent: '#38bdf8', tags: ['diamond', 'crest'] },
  { id: 'supreme-crown', label: 'Supreme Crown', category: 'champions', tier: 'champion', unlockRequirement: 'Reach ⭐⭐⭐⭐⭐ Rating', pathKey: 'crown', gradient: ['#831843', '#be185d'], accent: '#f472b6', tags: ['crown', 'queen', 'supreme'], isFeatured: true },
  { id: 'royal-helmet', label: 'Royal Helmet', category: 'champions', tier: 'silver', unlockRequirement: 'Play 10 jackpots', pathKey: 'shield', gradient: ['#14532d', '#15803d'], accent: '#4ade80', tags: ['helmet', 'royal'] },
  { id: 'golden-laurel', label: 'Golden Laurel', category: 'champions', tier: 'gold', unlockRequirement: 'Reach ⭐⭐⭐ Rating', pathKey: 'laurel', gradient: ['#78350f', '#b45309'], accent: '#fde047', tags: ['laurel', 'gold'] },

  // FOOTBALL (18)
  { id: 'pitch-captain', label: 'Pitch Captain', category: 'football', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'football', gradient: ['#0f172a', '#1e293b'], accent: '#38bdf8', tags: ['football', 'ball', 'captain'], isFeatured: true },
  { id: 'golden-boot', label: 'Golden Boot', category: 'football', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'boot', gradient: ['#451a03', '#b45309'], accent: '#fef08a', tags: ['boot', 'striker', 'gold'] },
  { id: 'stadium-hero', label: 'Stadium Hero', category: 'football', tier: 'silver', unlockRequirement: 'Play 10 jackpots', pathKey: 'football', gradient: ['#042f2e', '#0d9488'], accent: '#2dd4bf', tags: ['stadium', 'ball'] },
  { id: 'goal-machine', label: 'Goal Machine', category: 'football', tier: 'gold', unlockRequirement: 'Reach ⭐⭐⭐ Rating', pathKey: 'boot', gradient: ['#4c0519', '#9f1239'], accent: '#fb7185', tags: ['goal', 'boot'] },
  { id: 'tactical-board', label: 'Tactical Board', category: 'football', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'shield', gradient: ['#172554', '#1d4ed8'], accent: '#60a5fa', tags: ['coach', 'tactic'] },
  { id: 'wall-keeper', label: 'Wall Keeper', category: 'football', tier: 'silver', unlockRequirement: 'Play 10 jackpots', pathKey: 'shield', gradient: ['#3b0764', '#7e22ce'], accent: '#c084fc', tags: ['goalkeeper', 'wall'] },

  // ANIMALS (18)
  { id: 'savannah-lion', label: 'Savannah Lion', category: 'animals', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'lion', gradient: ['#451a03', '#9a3412'], accent: '#fb923c', tags: ['lion', 'king', 'beast'], isFeatured: true },
  { id: 'frost-wolf', label: 'Frost Wolf', category: 'animals', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'wolf', gradient: ['#0c4a6e', '#0284c7'], accent: '#7dd3fc', tags: ['wolf', 'frost', 'pack'] },
  { id: 'blaze-dragon', label: 'Blaze Dragon', category: 'animals', tier: 'gold', unlockRequirement: 'Reach ⭐⭐⭐ Rating', pathKey: 'dragon', gradient: ['#7f1d1d', '#dc2626'], accent: '#fca5a5', tags: ['dragon', 'fire'] },
  { id: 'shadow-panther', label: 'Shadow Panther', category: 'animals', tier: 'silver', unlockRequirement: 'Play 10 jackpots', pathKey: 'lion', gradient: ['#09090b', '#27272a'], accent: '#a1a1aa', tags: ['panther', 'stealth'] },
  { id: 'cyber-eagle', label: 'Cyber Eagle', category: 'animals', tier: 'diamond', unlockRequirement: 'Win 5 jackpots', pathKey: 'wolf', gradient: ['#1e1b4b', '#4338ca'], accent: '#a5b4fc', tags: ['eagle', 'cyber'] },

  // FANTASY (16)
  { id: 'cyber-ninja', label: 'Cyber Ninja', category: 'fantasy', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'ninja', gradient: ['#18181b', '#3f3f46'], accent: '#ef4444', tags: ['ninja', 'cyber', 'blade'], isFeatured: true },
  { id: 'shadow-guardian', label: 'Shadow Guardian', category: 'fantasy', tier: 'silver', unlockRequirement: 'Play 10 jackpots', pathKey: 'ninja', gradient: ['#311042', '#6b21a8'], accent: '#e9d5ff', tags: ['shadow', 'magic'] },
  { id: 'paladin-crest', label: 'Paladin Crest', category: 'fantasy', tier: 'gold', unlockRequirement: 'Reach ⭐⭐⭐ Rating', pathKey: 'shield', gradient: ['#713f12', '#ca8a04'], accent: '#fef08a', tags: ['paladin', 'knight'] },

  // FUTURISTIC (16)
  { id: 'synth-bot', label: 'Synth Bot', category: 'futuristic', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'robot', gradient: ['#064e3b', '#059669'], accent: '#6ee7b7', tags: ['robot', 'synth', 'ai'], isFeatured: true },
  { id: 'quantum-node', label: 'Quantum Node', category: 'futuristic', tier: 'silver', unlockRequirement: 'Play 10 jackpots', pathKey: 'robot', gradient: ['#0f172a', '#334155'], accent: '#38bdf8', tags: ['quantum', 'core'] },

  // HUMAN (18)
  { id: 'afro-streetwear', label: 'Afro Streetwear', category: 'human', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'humanAfro', gradient: ['#78350f', '#d97706'], accent: '#fde047', tags: ['afro', 'streetwear', 'inclusive'], isFeatured: true },
  { id: 'audio-gamer', label: 'Audio Gamer', category: 'human', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'humanHeadphones', gradient: ['#1e1b4b', '#4f46e5'], accent: '#c7d2fe', tags: ['headphones', 'gamer', 'specs'] },

  // GAMING (16)
  { id: 'pixel-gamepad', label: 'Pixel Gamepad', category: 'gaming', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'gamepad', gradient: ['#581c87', '#9333ea'], accent: '#f0abfc', tags: ['gamepad', 'arcade', 'retro'], isFeatured: true },

  // LUXURY (16)
  { id: 'emerald-vault', label: 'Emerald Vault', category: 'luxury', tier: 'gold', unlockRequirement: 'Reach ⭐⭐⭐ Rating', pathKey: 'gem', gradient: ['#064e3b', '#047857'], accent: '#6ee7b7', tags: ['gem', 'emerald', 'luxury'], isFeatured: true },

  // AFRICAN (16)
  { id: 'rift-sun', label: 'Rift Sun', category: 'african', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'savannah', gradient: ['#7c2d12', '#ea580c'], accent: '#ffedd5', tags: ['african', 'savannah', 'sun'], isFeatured: true },

  // ABSTRACT (16)
  { id: 'lightning-core', label: 'Lightning Core', category: 'abstract', tier: 'starter', unlockRequirement: 'Available to all contenders', pathKey: 'lightning', gradient: ['#713f12', '#eab308'], accent: '#fef9c3', tags: ['lightning', 'fire', 'neon'], isFeatured: true },
  { id: 'galaxy-swirl', label: 'Galaxy Swirl', category: 'abstract', tier: 'diamond', unlockRequirement: 'Win 5 jackpots', pathKey: 'galaxy', gradient: ['#4c0519', '#be123c'], accent: '#ffe4e6', tags: ['galaxy', 'space'] },
];

// Dynamically generate the full list up to 160 items with variations across all 10 categories
export function generateFullAvatarCatalog(): AvatarOption[] {
  const result: AvatarOption[] = [];

  // Seed base items
  rawCatalogData.forEach((item) => {
    result.push({
      id: item.id,
      label: item.label,
      category: item.category,
      tier: item.tier,
      unlockRequirement: item.unlockRequirement,
      svgContent: makeSvg(item.gradient, PATHS[item.pathKey], item.accent),
      tags: item.tags,
      isFeatured: item.isFeatured,
    });
  });

  const categories = AVATAR_CATEGORIES.map((c) => c.id);
  const tiers: UnlockTier[] = ['starter', 'silver', 'gold', 'diamond', 'champion', 'seasonal', 'premium'];
  const pathKeys = Object.keys(PATHS) as Array<keyof typeof PATHS>;

  const gradients: Array<[string, string]> = [
    ['#0f172a', '#1e293b'], ['#451a03', '#9a3412'], ['#064e3b', '#047857'],
    ['#1e1b4b', '#4338ca'], ['#701a75', '#c026d3'], ['#831843', '#db2777'],
    ['#0c4a6e', '#0284c7'], ['#713f12', '#ca8a04'], ['#14532d', '#16a34a'],
    ['#311042', '#7e22ce'], ['#4c0519', '#e11d48'], ['#172554', '#2563eb'],
  ];

  const accents = ['#fbbf24', '#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#f87171', '#fde047', '#a3e635'];

  // Fill up to 160 high quality avatars
  let counter = result.length + 1;
  const totalTarget = 160;

  const categoryTitles: Record<AvatarCategory, string[]> = {
    champions: ['Crown Legion', 'Golden Crest', 'Honor Laurel', 'Apex Sovereign', 'Imperium Shield', 'Valiant Helmet', 'Trophy Master', 'Dominion Star', 'Grand Sovereign', 'Victory Herald', 'Supreme Banner', 'Majesty Star', 'Regal Seal', 'Solstice Crown', 'Immortal Crest'],
    football: ['Midfield Maestro', 'Striker Prime', 'Tactical Genius', 'Net Guardian', 'Golden Whistle', 'Corner Master', 'Stadium Icon', 'Clean Sheet', 'Overtime Hero', 'Penalty Boss', 'Counter Attack', 'Pitch Wizard', 'Cross Specialist', 'Corner Cannon', 'Golden Glove'],
    animals: ['Savannah King', 'Apex Tiger', 'Storm Wolf', 'Shadow Panther', 'Golden Falcon', 'Imperial Rhino', 'Cyber Shark', 'Fire Phoenix', 'Thunder Bull', 'Desert Cobra', 'Night Owl', 'Wild Leopard', 'Royal Cheetah', 'Iron Gorilla', 'Stealth Mamba'],
    fantasy: ['Cyber Valkyrie', 'Shadow Ninja', 'Arcane Wizard', 'Paladin Guardian', 'Rune Sorcerer', 'Iron Knight', 'Blade Samurai', 'Void Warden', 'Eldritch Spell', 'Celestial Monk', 'Dragon Rider', 'Mythic Archer', 'Solar Templar', 'Spectral Mage', 'Storm Sentinel'],
    futuristic: ['Neural AI', 'Cyber Visor', 'Quantum Core', 'Synth Unit', 'Matrix Node', 'Neon Android', 'Hologram Apex', 'Pulse Sentinel', 'Chroma Cyborg', 'Hyper Drive', 'Zero Point', 'Titan Armor', 'Orbit Probe', 'Glitch Runner', 'Data Phantom'],
    human: ['Afro Crown', 'Braids Maestro', 'Locs Vision', 'Streetwear Spec', 'Gamer Headset', 'Beard Sovereign', 'Fade Master', 'Buzz Cut', 'Athlete Pulse', 'Classic Specs', 'Urban Wave', 'Neon Tint', 'Cool Visor', 'Minimal Chic', 'Studio Audio'],
    gaming: ['Pixel Commander', 'Arcade Boss', 'Retro Controller', 'Speedrunner', 'Level 99', 'VR Pioneer', 'Joystick Hero', 'High Score', 'Combo Master', 'Quest Giver', '8-Bit Legend', 'Challenger', 'Respawn King', 'Loot Hunter', 'Clutch Player'],
    luxury: ['Obsidian Rune', 'Emerald Vault', 'Diamond Solitaire', 'Royal Marble', 'Gold Bullion', 'Platinum Emblem', 'Velvet Crown', 'Sapphire Matrix', 'Ruby Sovereign', 'Black Pearl', 'Silk Crest', 'Opal Halo', 'Amethyst Seal', 'Crystal Prism', 'Titanium Vault'],
    african: ['Kilimanjaro Peak', 'Savannah Sun', 'Baobab Shield', 'Maasai Warrior', 'Rift Falcon', 'Kente Grid', 'Nile Crest', 'Serengeti Dusk', 'Afro Vector', 'Sahara Gold', 'Zambezi Flow', 'Atlas Pride', 'Victoria Falls', 'Bantu Pattern', 'Swahili Rune'],
    abstract: ['Neon Vortex', 'Plasma Wave', 'Crystal Matrix', 'Fire Prism', 'Ice Nova', 'Galaxy Ring', 'Hex Core', 'Quantum Pulse', 'Chroma Burst', 'Eclipse Ring', 'Lava Orb', 'Hyper Cube', 'Solar Flare', 'Aether Node', 'Subzero Spark'],
    glyphs: ['Vortex Glyph', 'Solar Glyph', 'Apex Glyph', 'Nexus Glyph', 'Cipher Glyph', 'Zenith Glyph', 'Pulse Glyph', 'Titan Glyph', 'Oracle Glyph', 'Phantom Glyph', 'Mirage Glyph', 'Quantum Glyph', 'Eclipse Glyph', 'Chronos Glyph', 'Nova Glyph', 'Aether Glyph'],
  };

  while (counter <= totalTarget) {
    const category = categories[(counter - 1) % categories.length];
    const categoryList = categoryTitles[category];
    const nameIndex = Math.floor((counter - 1) / categories.length) % categoryList.length;
    const label = `${categoryList[nameIndex]} #${Math.floor(counter / 10) + 1}`;
    const tier = tiers[counter % tiers.length];
    const pathKey = pathKeys[counter % pathKeys.length];
    const gradient = gradients[counter % gradients.length];
    const accent = accents[counter % accents.length];

    let unlockRequirement = 'Available to all contenders';
    if (tier === 'silver') unlockRequirement = 'Play 10 jackpots';
    if (tier === 'gold') unlockRequirement = 'Reach ⭐⭐⭐ Rating';
    if (tier === 'diamond') unlockRequirement = 'Win 5 jackpots';
    if (tier === 'champion') unlockRequirement = 'Reach ⭐⭐⭐⭐⭐ Rating';
    if (tier === 'seasonal') unlockRequirement = 'Unlocked during active Mshindi Gameweeks';
    if (tier === 'premium') unlockRequirement = 'VIP Exclusive Pass';

    result.push({
      id: `avatar-v2-${counter}`,
      label,
      category,
      tier,
      unlockRequirement,
      svgContent: makeSvg(gradient, PATHS[pathKey], accent),
      tags: [category, tier, pathKey, label.toLowerCase()],
      isFeatured: counter % 15 === 0,
    });

    counter++;
  }

  return result;
}

import { GLYPHS_AVATARS } from './dicebearGlyphsData';

export const AVATAR_CATALOG: AvatarOption[] = [...GLYPHS_AVATARS, ...generateFullAvatarCatalog()];

export function getAvatarById(id?: string | null): AvatarOption | undefined {
  if (!id) return undefined;
  return AVATAR_CATALOG.find((a) => a.id === id);
}
