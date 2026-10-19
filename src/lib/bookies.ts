import type { Bookie } from './types';

export interface BookieTheme {
  name: string;
  primary: string;       // strongest accent color
  fadedBg: string;       // faded version for card/room backdrop
  border: string;        // subtle border matching faded color
  text: string;          // text color matching the theme
  badgeBg: string;       // badge background
  badgeText: string;     // badge text
  iconBg: string;        // icon box background
  logo: string;          // path to official logo asset
}

export const BOOKIE_THEMES: Record<string, BookieTheme> = {
  SportPesa: {
    name: 'SportPesa',
    primary: '#0A3B8C',
    fadedBg: '#F0F4FC',
    border: '#C7D7F6',
    text: '#0A3B8C',
    badgeBg: '#E8EEFA',
    badgeText: '#0A3B8C',
    iconBg: '#F0F4FC',
    logo: '/logos/sportpesa.jpg',
  },
  Betika: {
    name: 'Betika',
    primary: '#1F3888',
    fadedBg: '#FEFCE8',
    border: '#FEF08A',
    text: '#854D0E',
    badgeBg: '#FEF9C3',
    badgeText: '#713F12',
    iconBg: '#FEFCE8',
    logo: '/logos/betika.jpg',
  },
  Odibets: {
    name: 'Odibets',
    primary: '#22C55E',
    fadedBg: '#F0FDF4',
    border: '#BBF7D0',
    text: '#15803D',
    badgeBg: '#DCFCE7',
    badgeText: '#166534',
    iconBg: '#F0FDF4',
    logo: '/logos/odibets.png',
  },
  Mozzart: {
    name: 'MozzartBet',
    primary: '#6D28D9',
    fadedBg: '#FAF5FF',
    border: '#E9D5FF',
    text: '#6D28D9',
    badgeBg: '#F3E8FF',
    badgeText: '#581C87',
    iconBg: '#FAF5FF',
    logo: '/logos/mozzartbet.png',
  },
  MozzartBet: {
    name: 'MozzartBet',
    primary: '#6D28D9',
    fadedBg: '#FAF5FF',
    border: '#E9D5FF',
    text: '#6D28D9',
    badgeBg: '#F3E8FF',
    badgeText: '#581C87',
    iconBg: '#FAF5FF',
    logo: '/logos/mozzartbet.png',
  },
  SportyBet: {
    name: 'SportyBet',
    primary: '#DC2626',
    fadedBg: '#FEF2F2',
    border: '#FECACA',
    text: '#B91C1C',
    badgeBg: '#FEE2E2',
    badgeText: '#991B1B',
    iconBg: '#FEF2F2',
    logo: '/logos/sportybet.png',
  },
  BetPawa: {
    name: 'BetPawa',
    primary: '#65A30D',
    fadedBg: '#F7FEE7',
    border: '#D9F99D',
    text: '#4D7C0F',
    badgeBg: '#ECFCCB',
    badgeText: '#3F6212',
    iconBg: '#F7FEE7',
    logo: '/logos/betpawa.png',
  },
  '1xBet': {
    name: '1xBet',
    primary: '#0284C7',
    fadedBg: '#F0F9FF',
    border: '#BAE6FD',
    text: '#0369A1',
    badgeBg: '#E0F2FE',
    badgeText: '#075985',
    iconBg: '#F0F9FF',
    logo: '/logos/1xbet.png',
  },
  '22Bet': {
    name: '22Bet',
    primary: '#0D9488',
    fadedBg: '#F0FDFA',
    border: '#99F6E4',
    text: '#0F766E',
    badgeBg: '#CCFBF1',
    badgeText: '#115E59',
    iconBg: '#F0FDFA',
    logo: '/logos/22bet.jpg',
  },
};

const DEFAULT_THEME: BookieTheme = {
  name: 'Bookie',
  primary: '#006C54',
  fadedBg: '#F4F9F6',
  border: '#D1E7DD',
  text: '#006C54',
  badgeBg: '#E8F5E9',
  badgeText: '#006C54',
  iconBg: '#F4F9F6',
  logo: '/logos/sportpesa.jpg',
};

export function getBookieTheme(bookieName?: string): BookieTheme {
  if (!bookieName) return DEFAULT_THEME;
  const match = BOOKIE_THEMES[bookieName];
  if (match) return match;

  // Case-insensitive search
  const lower = bookieName.toLowerCase();
  for (const [key, value] of Object.entries(BOOKIE_THEMES)) {
    if (key.toLowerCase() === lower || lower.includes(key.toLowerCase())) {
      return value;
    }
  }

  return DEFAULT_THEME;
}

export function getBookieLogo(bookieName?: string): string {
  return getBookieTheme(bookieName).logo;
}
