import React from 'react';

export interface ChatSticker {
  id: string;
  name: string;
  category: 'reaction' | 'match' | 'betting';
  render: (size?: number) => React.ReactNode;
}

export const CHAT_STICKERS: ChatSticker[] = [
  {
    id: 'goal',
    name: 'GOAL!',
    category: 'match',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#006C54" />
        <circle cx="50" cy="50" r="42" fill="#00A878" opacity="0.4" />
        {/* Ball */}
        <circle cx="50" cy="42" r="22" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
        <polygon points="50,32 58,38 55,47 45,47 42,38" fill="#1E293B" />
        <line x1="50" y1="32" x2="50" y2="20" stroke="#1E293B" strokeWidth="2.5" />
        <line x1="58" y1="38" x2="68" y2="34" stroke="#1E293B" strokeWidth="2.5" />
        <line x1="55" y1="47" x2="62" y2="58" stroke="#1E293B" strokeWidth="2.5" />
        <line x1="45" y1="47" x2="38" y2="58" stroke="#1E293B" strokeWidth="2.5" />
        <line x1="42" y1="38" x2="32" y2="34" stroke="#1E293B" strokeWidth="2.5" />
        {/* Banner */}
        <rect x="12" y="66" width="76" height="24" rx="12" fill="#FBBF24" stroke="#78350F" strokeWidth="2" />
        <text x="50" y="83" textAnchor="middle" fill="#78350F" fontSize="14" fontWeight="900" fontFamily="sans-serif" letterSpacing="1">
          GOAAAL!
        </text>
      </svg>
    ),
  },
  {
    id: 'banker',
    name: 'Banker',
    category: 'betting',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#10B981" />
        {/* Cash Stack */}
        <rect x="22" y="38" width="56" height="30" rx="6" fill="#047857" stroke="#064E3B" strokeWidth="2" />
        <rect x="22" y="32" width="56" height="30" rx="6" fill="#059669" stroke="#064E3B" strokeWidth="2" />
        <rect x="22" y="26" width="56" height="30" rx="6" fill="#34D399" stroke="#064E3B" strokeWidth="2" />
        <circle cx="50" cy="41" r="8" fill="#065F46" />
        <text x="50" y="46" textAnchor="middle" fill="#A7F3D0" fontSize="13" fontWeight="900" fontFamily="sans-serif">
          $
        </text>
        {/* Badge */}
        <rect x="14" y="66" width="72" height="22" rx="11" fill="#FEF08A" stroke="#854D0E" strokeWidth="2" />
        <text x="50" y="81" textAnchor="middle" fill="#854D0E" fontSize="12" fontWeight="900" fontFamily="sans-serif" letterSpacing="1">
          BANKER 🔒
        </text>
      </svg>
    ),
  },
  {
    id: 'locked',
    name: 'Locked In',
    category: 'betting',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#0F172A" />
        {/* Shackle */}
        <path d="M36 44V34C36 26.268 42.268 20 50 20C57.732 20 64 26.268 64 34V44" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
        {/* Lock Body */}
        <rect x="28" y="42" width="44" height="36" rx="8" fill="#FBBF24" stroke="#B45309" strokeWidth="3" />
        <circle cx="50" cy="58" r="5" fill="#78350F" />
        <path d="M50 63V70" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
        {/* Text */}
        <rect x="18" y="74" width="64" height="20" rx="10" fill="#10B981" />
        <text x="50" y="88" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900" fontFamily="sans-serif">
          LOCKED IN
        </text>
      </svg>
    ),
  },
  {
    id: 'fire',
    name: 'On Fire',
    category: 'reaction',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#7F1D1D" />
        {/* Outer Flame */}
        <path
          d="M50 16C50 16 68 34 68 56C68 67 60 76 50 76C40 76 32 67 32 56C32 42 42 30 42 30C42 30 40 40 46 44C46 44 46 32 50 16Z"
          fill="#EF4444"
        />
        {/* Mid Flame */}
        <path
          d="M50 32C50 32 62 44 62 58C62 66 56 72 50 72C44 72 38 66 38 58C38 48 45 40 45 40C45 40 44 47 48 49C48 49 48 40 50 32Z"
          fill="#F59E0B"
        />
        {/* Core Flame */}
        <path d="M50 48C50 48 56 56 56 62C56 66 53 70 50 70C47 70 44 66 44 62C44 56 48 52 50 48Z" fill="#FEF08A" />
        {/* Text */}
        <rect x="18" y="72" width="64" height="22" rx="11" fill="#DC2626" stroke="#FEF08A" strokeWidth="1.5" />
        <text x="50" y="87" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900" fontFamily="sans-serif">
          ON FIRE 🔥
        </text>
      </svg>
    ),
  },
  {
    id: 'redcard',
    name: 'Red Card',
    category: 'match',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#1E293B" />
        {/* Hand holding Red Card */}
        <rect x="36" y="20" width="28" height="42" rx="4" fill="#DC2626" stroke="#FFFFFF" strokeWidth="2" transform="rotate(-8 50 41)" />
        {/* Whistle */}
        <circle cx="34" cy="62" r="8" fill="#94A3B8" />
        <rect x="34" y="58" width="16" height="8" rx="2" fill="#94A3B8" />
        {/* Text Banner */}
        <rect x="14" y="68" width="72" height="22" rx="11" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1.5" />
        <text x="50" y="83" textAnchor="middle" fill="#FFFFFF" fontSize="12" fontWeight="900" fontFamily="sans-serif">
          RED CARD! 🟥
        </text>
      </svg>
    ),
  },
  {
    id: 'var',
    name: 'VAR Check',
    category: 'match',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#1E1B4B" />
        {/* TV Screen */}
        <rect x="20" y="22" width="60" height="42" rx="6" fill="#312E81" stroke="#818CF8" strokeWidth="2.5" />
        <rect x="25" y="27" width="50" height="32" rx="3" fill="#1E1B4B" />
        <text x="50" y="48" textAnchor="middle" fill="#A5B4FC" fontSize="16" fontWeight="900" fontFamily="sans-serif" letterSpacing="2">
          VAR
        </text>
        <circle cx="32" cy="52" r="2" fill="#EF4444" className="animate-ping" />
        {/* Stand */}
        <path d="M44 64L40 72H60L56 64" fill="#6366F1" />
        {/* Banner */}
        <rect x="16" y="72" width="68" height="20" rx="10" fill="#4338CA" stroke="#A5B4FC" strokeWidth="1.5" />
        <text x="50" y="86" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900" fontFamily="sans-serif">
          CHECKING... 📺
        </text>
      </svg>
    ),
  },
  {
    id: 'cleansheet',
    name: 'Clean Sheet',
    category: 'match',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#0C4A6E" />
        {/* Ice Cube / Shield */}
        <path d="M50 20L72 32V54C72 68 50 80 50 80C50 80 28 68 28 54V32L50 20Z" fill="#38BDF8" stroke="#E0F2FE" strokeWidth="2.5" />
        <path d="M50 26L66 36V52C66 63 50 72 50 72C50 72 34 63 34 52V36L50 26Z" fill="#0284C7" />
        {/* Frost Star */}
        <circle cx="50" cy="48" r="8" fill="#BAE6FD" />
        <text x="50" y="52" textAnchor="middle" fill="#0369A1" fontSize="11" fontWeight="900">
          🧊
        </text>
        {/* Text */}
        <rect x="12" y="68" width="76" height="22" rx="11" fill="#0284C7" stroke="#E0F2FE" strokeWidth="1.5" />
        <text x="50" y="83" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900" fontFamily="sans-serif">
          CLEAN SHEET
        </text>
      </svg>
    ),
  },
  {
    id: 'trophy',
    name: 'Champions',
    category: 'reaction',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#713F12" />
        {/* Trophy */}
        <path d="M34 26H66V42C66 50.837 58.837 58 50 58C41.163 58 34 50.837 34 42V26Z" fill="#FACC15" stroke="#CA8A04" strokeWidth="2" />
        <path d="M34 32H26C22.686 32 20 34.686 20 38C20 41.314 22.686 44 26 44H34" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
        <path d="M66 32H74C77.314 32 80 34.686 80 38C80 41.314 77.314 44 74 44H66" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
        <rect x="46" y="58" width="8" height="12" fill="#EAB308" />
        <rect x="38" y="70" width="24" height="6" rx="2" fill="#CA8A04" />
        {/* Banner */}
        <rect x="14" y="74" width="72" height="20" rx="10" fill="#CA8A04" stroke="#FEF08A" strokeWidth="1.5" />
        <text x="50" y="88" textAnchor="middle" fill="#FEF08A" fontSize="11" fontWeight="900" fontFamily="sans-serif">
          CHAMPION 🏆
        </text>
      </svg>
    ),
  },
  {
    id: 'rocket',
    name: 'Multi-Bet',
    category: 'betting',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#1E293B" />
        {/* Rocket Body */}
        <path d="M50 18C44 28 42 42 42 54H58C58 42 56 28 50 18Z" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="2" />
        {/* Wings */}
        <path d="M42 44L32 54V60L42 56V44Z" fill="#EF4444" />
        <path d="M58 44L68 54V60L58 56V44Z" fill="#EF4444" />
        {/* Window */}
        <circle cx="50" cy="36" r="5" fill="#38BDF8" stroke="#0284C7" strokeWidth="1.5" />
        {/* Flame */}
        <path d="M46 54L50 68L54 54Z" fill="#F59E0B" />
        <path d="M48 54L50 62L52 54Z" fill="#FEF08A" />
        {/* Banner */}
        <rect x="12" y="70" width="76" height="22" rx="11" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.5" />
        <text x="50" y="85" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900" fontFamily="sans-serif">
          TO THE MOON 🚀
        </text>
      </svg>
    ),
  },
  {
    id: 'hundred',
    name: '100% Value',
    category: 'betting',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#881337" />
        {/* 100 Text */}
        <text x="50" y="55" textAnchor="middle" fill="#F43F5E" fontSize="32" fontWeight="900" fontFamily="sans-serif" letterSpacing="1">
          100
        </text>
        <path d="M24 64H76" stroke="#F43F5E" strokeWidth="4" strokeLinecap="round" />
        <path d="M28 72H72" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round" />
        {/* Banner */}
        <rect x="18" y="76" width="64" height="18" rx="9" fill="#BE123C" />
        <text x="50" y="89" textAnchor="middle" fill="#FECDD3" fontSize="10" fontWeight="900" fontFamily="sans-serif">
          MAX ODDS 💯
        </text>
      </svg>
    ),
  },
  {
    id: 'heartbreak',
    name: 'Heartbreak',
    category: 'reaction',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#450A0A" />
        {/* Broken Heart */}
        <path
          d="M50 32C46 24 36 22 28 28C20 34 20 44 26 52L50 74L74 52C80 44 80 34 72 28C64 22 54 24 50 32Z"
          fill="#DC2626"
        />
        <path d="M50 32L46 44L54 52L46 62L50 74" stroke="#450A0A" strokeWidth="3" strokeLinecap="round" />
        {/* Banner */}
        <rect x="16" y="72" width="68" height="20" rx="10" fill="#991B1B" stroke="#FCA5A5" strokeWidth="1.5" />
        <text x="50" y="86" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900" fontFamily="sans-serif">
          SHAKY PLAY 💔
        </text>
      </svg>
    ),
  },
  {
    id: 'handshake',
    name: 'Draw Trap',
    category: 'betting',
    render: (size = 72) => (
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="46" fill="#1E293B" />
        {/* Handshake Graphic */}
        <text x="50" y="52" textAnchor="middle" fontSize="34">
          🤝
        </text>
        {/* Warning Banner */}
        <rect x="14" y="68" width="72" height="22" rx="11" fill="#EAB308" stroke="#713F12" strokeWidth="1.5" />
        <text x="50" y="83" textAnchor="middle" fill="#713F12" fontSize="11" fontWeight="900" fontFamily="sans-serif">
          DRAW TRAP ⚠️
        </text>
      </svg>
    ),
  },
];

export function getChatSticker(text: string): ChatSticker | undefined {
  if (!text || !text.startsWith('[sticker:') || !text.endsWith(']')) return undefined;
  const id = text.slice(9, -1).trim();
  return CHAT_STICKERS.find((s) => s.id === id);
}

