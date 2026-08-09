import { create } from 'zustand';
import type { ParsedSlip } from './betSlipParser';

export interface BuiltSlipLeg {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string;
  market: string; // e.g. "1X2", "Double Chance", "Over/Under 2.5", "BTTS", "Handicap"
  pick: string; // e.g. "Arsenal Win (1)", "Over 2.5 Goals", "GG (Yes)"
  odds: number;
  status?: 'pending' | 'won' | 'lost';
  homeScore?: number | null;
  awayScore?: number | null;
}

export interface BuiltSlipData {
  legs: BuiltSlipLeg[];
  totalOdds: number;
  stake?: number;
  estimatedReturn?: number;
  bookieCode?: string;
  bookieLink?: string;
  bookmaker?: string;
  status?: 'pending' | 'won' | 'lost';
}

export interface BetSlipPost {
  id: string;
  postedBy: string;
  postedByAvatarSeed: number;
  url: string;
  bookmaker?: string;
  isCode?: boolean;
  note: string;
  tags: string[];
  likes: number;
  likedByMe?: boolean;
  createdAt: string;
  parsed?: ParsedSlip | null;
  parseError?: string;
  builtSlip?: BuiltSlipData | null;
  comments?: { id: string; user: string; text: string; createdAt: string }[];
}

interface BetSlipStoreState {
  posts: BetSlipPost[];
  builderLegs: BuiltSlipLeg[];
  toggleBuilderLeg: (leg: BuiltSlipLeg) => void;
  removeBuilderLeg: (legId: string) => void;
  clearBuilderLegs: () => void;
  setBuilderLegs: (legs: BuiltSlipLeg[]) => void;
  addPost: (data: {
    postedBy: string;
    postedByAvatarSeed: number;
    url: string;
    bookmaker?: string;
    isCode?: boolean;
    note: string;
    tags: string[];
    builtSlip?: BuiltSlipData | null;
  }) => string;
  updateBookieDetails: (
    postId: string,
    details: { bookieCode?: string; bookieLink?: string; bookmaker?: string }
  ) => void;
  setParsed: (postId: string, parsed: ParsedSlip | null, parseError?: string) => void;
  toggleLike: (postId: string) => void;
  addComment: (postId: string, user: string, text: string) => void;
}

const INITIAL_POSTS: BetSlipPost[] = [
  {
    id: 'post-builder-1',
    postedBy: 'Kip_Punter',
    postedByAvatarSeed: 88,
    url: 'SP-99214',
    bookmaker: 'SportPesa',
    isCode: true,
    note: 'Built 3-leg high confidence accumulator with EPL & Champions League value picks! Odds total @ 4.85x.',
    tags: ['Value Pick', 'Bet Builder', 'EPL'],
    likes: 38,
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    builtSlip: {
      totalOdds: 4.85,
      stake: 500,
      estimatedReturn: 2425,
      bookieCode: 'SP-99214',
      bookmaker: 'SportPesa',
      status: 'pending',
      legs: [
        {
          id: 'leg-1',
          matchId: 'free-m1',
          homeTeam: 'Arsenal',
          awayTeam: 'Coventry City',
          competition: 'English Premier League',
          kickoff: 'Today 22:00 EAT',
          market: 'Match Result (1X2)',
          pick: 'Arsenal Win (1)',
          odds: 1.32,
          status: 'pending',
          homeScore: null,
          awayScore: null,
        },
        {
          id: 'leg-2',
          matchId: 'free-m3',
          homeTeam: 'Sunderland',
          awayTeam: 'Leeds United',
          competition: 'English Championship',
          kickoff: 'Today 17:00 EAT',
          market: 'Over / Under',
          pick: 'Over 2.5 Goals',
          odds: 1.88,
          status: 'pending',
          homeScore: null,
          awayScore: null,
        },
        {
          id: 'leg-3',
          matchId: 'free-m4',
          homeTeam: 'Deportivo Alavés',
          awayTeam: 'Getafe',
          competition: 'Spanish LALIGA',
          kickoff: 'Today 19:00 EAT',
          market: 'Double Chance',
          pick: 'Alavés or Draw (1X)',
          odds: 1.95,
          status: 'pending',
          homeScore: null,
          awayScore: null,
        },
      ],
    },
  },
  {
    id: 'post-1',
    postedBy: 'MwangiPicks',
    postedByAvatarSeed: 12,
    url: 'https://www.betika.com/en-ke/share/slip-771892',
    bookmaker: 'Betika',
    isCode: false,
    note: 'Combined 4 high-probability double chances for tonight.',
    tags: ['Value Pick', 'Multibet'],
    likes: 24,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    parsed: {
      id: 'parsed-1',
      bookmaker: 'Betika',
      title: 'Betika Multibet Shared Slip',
      sourceUrl: 'https://www.betika.com/en-ke/share/slip-771892',
      summary: 'Betika slip ready to open.',
      selections: [],
      fetchedAt: 'Today 18:30 EAT',
    },
  },
  {
    id: 'post-2',
    postedBy: 'Kamau_Betting',
    postedByAvatarSeed: 45,
    url: 'A8B9C22',
    bookmaker: '22Bet',
    isCode: true,
    note: 'Booking code for 22Bet weekend multibet. Copy and load on 22Bet app!',
    tags: ['Long Shot', '22Bet'],
    likes: 41,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
];

export const useBetSlipStore = create<BetSlipStoreState>((set) => ({
  posts: INITIAL_POSTS,
  builderLegs: [],

  toggleBuilderLeg: (leg) => {
    set((state) => {
      const existingIdx = state.builderLegs.findIndex(
        (l) => l.matchId === leg.matchId && l.market === leg.market
      );

      if (existingIdx >= 0) {
        if (state.builderLegs[existingIdx].pick === leg.pick) {
          // Same pick -> toggle off
          return {
            builderLegs: state.builderLegs.filter((_, idx) => idx !== existingIdx),
          };
        }
        // Update pick in market
        const updated = [...state.builderLegs];
        updated[existingIdx] = leg;
        return { builderLegs: updated };
      }

      return { builderLegs: [...state.builderLegs, leg] };
    });
  },

  removeBuilderLeg: (legId) => {
    set((state) => ({
      builderLegs: state.builderLegs.filter((l) => l.id !== legId),
    }));
  },

  clearBuilderLegs: () => {
    set({ builderLegs: [] });
  },

  setBuilderLegs: (legs) => {
    set({ builderLegs: legs });
  },

  addPost: ({ postedBy, postedByAvatarSeed, url, bookmaker, isCode, note, tags, builtSlip }) => {
    const id = `post-${Date.now().toString(36)}`;
    const newPost: BetSlipPost = {
      id,
      postedBy,
      postedByAvatarSeed,
      url,
      bookmaker,
      isCode,
      note,
      tags,
      builtSlip,
      likes: 0,
      createdAt: new Date().toISOString(),
      parsed: undefined,
    };
    set((state) => ({ posts: [newPost, ...state.posts] }));
    return id;
  },

  updateBookieDetails: (postId, { bookieCode, bookieLink, bookmaker }) => {
    set((state) => ({
      posts: state.posts.map((p) => {
        if (p.id !== postId) return p;
        const updatedBuilt = p.builtSlip
          ? {
              ...p.builtSlip,
              bookieCode: bookieCode || p.builtSlip.bookieCode,
              bookieLink: bookieLink || p.builtSlip.bookieLink,
              bookmaker: bookmaker || p.builtSlip.bookmaker,
            }
          : null;
        
        const newUrl = bookieLink || bookieCode || p.url;
        const isCode = !bookieLink && Boolean(bookieCode);

        return {
          ...p,
          url: newUrl,
          isCode,
          bookmaker: bookmaker || p.bookmaker,
          builtSlip: updatedBuilt,
        };
      }),
    }));
  },

  setParsed: (postId, parsed, parseError) => {
    set((state) => ({
      posts: state.posts.map((p) =>
        p.id === postId ? { ...p, parsed, parseError } : p
      ),
    }));
  },

  toggleLike: (postId) => {
    set((state) => ({
      posts: state.posts.map((p) => {
        if (p.id !== postId) return p;
        const likedByMe = !p.likedByMe;
        return {
          ...p,
          likedByMe,
          likes: likedByMe ? p.likes + 1 : p.likes - 1,
        };
      }),
    }));
  },

  addComment: (postId, user, text) => {
    set((state) => ({
      posts: state.posts.map((p) => {
        if (p.id !== postId) return p;
        const newComment = {
          id: `c-${Date.now().toString(36)}`,
          user,
          text,
          createdAt: 'Just now',
        };
        return {
          ...p,
          comments: [...(p.comments || []), newComment],
        };
      }),
    }));
  },
}));

