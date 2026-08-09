import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Default mock initial followers map for platform seed users
const INITIAL_FOLLOWING_MAP: Record<string, string[]> = {
  juma_master: ['kip_punter', 'otieno_tips', 'nairobi_king', 'mwangipicks'],
  kip_punter: ['juma_master', 'mshindipro', 'kamau_betting'],
  otieno_tips: ['juma_master', 'nairobi_king', 'achieng_bets'],
  nairobi_king: ['juma_master', 'mshindipro', 'wanjiku_picks'],
  mshindipro: ['juma_master', 'kip_punter', 'otieno_tips', 'nairobi_king'],
  mwangipicks: ['kamau_betting', 'juma_master'],
  kamau_betting: ['mwangipicks', 'kip_punter'],
};

// Default follower counts offsets for public punters to feel populated
const BASE_FOLLOWER_COUNTS: Record<string, number> = {
  juma_master: 184,
  kip_punter: 142,
  otieno_tips: 118,
  nairobi_king: 95,
  mshindipro: 210,
  mwangipicks: 76,
  kamau_betting: 64,
  achieng_bets: 52,
  wanjiku_picks: 48,
};

interface FollowState {
  // followingMap: { [followerLower]: array of targetLower }
  followingMap: Record<string, string[]>;
  followUser: (follower: string, target: string) => void;
  unfollowUser: (follower: string, target: string) => void;
  isFollowing: (follower: string, target: string) => boolean;
  getFollowingList: (username: string) => string[];
  getFollowersList: (username: string) => string[];
  getFollowersCount: (username: string) => number;
  getFollowingCount: (username: string) => number;
}

export const useFollowStore = create<FollowState>()(
  persist(
    (set, get) => ({
      followingMap: INITIAL_FOLLOWING_MAP,

      followUser: (follower, target) => {
        const fKey = follower.trim().toLowerCase();
        const tKey = target.trim().toLowerCase();
        if (!fKey || !tKey || fKey === tKey) return;

        set((state) => {
          const existing = state.followingMap[fKey] || [];
          if (existing.includes(tKey)) return state;
          return {
            followingMap: {
              ...state.followingMap,
              [fKey]: [...existing, tKey],
            },
          };
        });
      },

      unfollowUser: (follower, target) => {
        const fKey = follower.trim().toLowerCase();
        const tKey = target.trim().toLowerCase();
        if (!fKey || !tKey) return;

        set((state) => {
          const existing = state.followingMap[fKey] || [];
          return {
            followingMap: {
              ...state.followingMap,
              [fKey]: existing.filter((u) => u !== tKey),
            },
          };
        });
      },

      isFollowing: (follower, target) => {
        const fKey = follower.trim().toLowerCase();
        const tKey = target.trim().toLowerCase();
        if (!fKey || !tKey) return false;
        const list = get().followingMap[fKey] || [];
        return list.includes(tKey);
      },

      getFollowingList: (username) => {
        const uKey = username.trim().toLowerCase();
        return get().followingMap[uKey] || [];
      },

      getFollowersList: (username) => {
        const uKey = username.trim().toLowerCase();
        const map = get().followingMap;
        const followers: string[] = [];
        Object.entries(map).forEach(([follower, followingList]) => {
          if (followingList.includes(uKey)) {
            followers.push(follower);
          }
        });
        return followers;
      },

      getFollowersCount: (username) => {
        const uKey = username.trim().toLowerCase();
        const dynamicFollowers = get().getFollowersList(uKey).length;
        const base = BASE_FOLLOWER_COUNTS[uKey] || 0;
        return base + dynamicFollowers;
      },

      getFollowingCount: (username) => {
        const uKey = username.trim().toLowerCase();
        const list = get().getFollowingList(uKey);
        return list.length;
      },
    }),
    { name: 'mshindi-follows-v1' }
  )
);
