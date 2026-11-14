import { useAuth } from './authStore';
import { getPunterStats } from './punterRatings';
import { jackpots } from './mockData';

export interface PunterProfile {
  username: string;
  phone?: string;
  avatarId?: string;
  stars: number;
  accuracyPct: number;
  closestWins: number;
  gamesTracked: number;
  isRegisteredAccount?: boolean;
  isShowcase?: boolean;
}

const PUBLIC_SEED_PUNTERS = [
  'MshindiPro',
  'Juma_Master',
  'Kip_Punter',
  'Otieno_Tips',
  'Nairobi_King',
  'MwangiPicks',
  'Kamau_Betting',
  'Achieng_Bets',
  'Wanjiku_Picks',
];

let authoritativeDirectoryCache: Array<{ username: string; avatarId?: string; verifiedWithSms?: boolean }> = [];
let directoryFetchPromise: Promise<PunterProfile[]> | null = null;
let directoryFetchedAt = 0;

export function clearDirectoryCacheForTests(): void {
  authoritativeDirectoryCache = [];
  directoryFetchPromise = null;
  directoryFetchedAt = 0;
}

export function getAllPunters(): PunterProfile[] {
  const currentUser = useAuth.getState().getCurrentUser();
  const puntersMap = new Map<string, PunterProfile>();

  // 1. Add currently authenticated user's profile (no bulk phone/account cache on client)
  if (currentUser?.username) {
    const key = currentUser.username.toLowerCase();
    const stats = getPunterStats(currentUser.username);
    puntersMap.set(key, {
      username: currentUser.username,
      avatarId: currentUser.avatarId,
      stars: stats.stars,
      accuracyPct: stats.accuracyPct,
      closestWins: stats.closestWins,
      gamesTracked: stats.gamesTracked,
      isRegisteredAccount: true,
      isShowcase: false,
    });
  }

  // 2. Add registered accounts hydrated from authoritative /api/auth/directory
  authoritativeDirectoryCache.forEach((acc) => {
    const cleanName = String(acc.username || '').trim();
    if (!cleanName) return;
    const key = cleanName.toLowerCase();
    if (!puntersMap.has(key)) {
      const stats = getPunterStats(cleanName);
      puntersMap.set(key, {
        username: cleanName,
        avatarId: acc.avatarId,
        stars: stats.stars,
        accuracyPct: stats.accuracyPct,
        closestWins: stats.closestWins,
        gamesTracked: stats.gamesTracked,
        isRegisteredAccount: true,
        isShowcase: false,
      });
    }
  });

  // 3. Add explicitly marked showcase community punters
  PUBLIC_SEED_PUNTERS.forEach((uname) => {
    const key = uname.toLowerCase();
    if (!puntersMap.has(key)) {
      const stats = getPunterStats(uname);
      puntersMap.set(key, {
        username: uname,
        stars: stats.stars,
        accuracyPct: stats.accuracyPct,
        closestWins: stats.closestWins,
        gamesTracked: stats.gamesTracked,
        isShowcase: true,
      });
    }
  });

  // 4. Add leaderboard showcase punters from jackpots
  jackpots.forEach((jp) => {
    jp.leaderboard?.forEach((entry) => {
      const key = entry.username.toLowerCase();
      if (!puntersMap.has(key)) {
        const stats = getPunterStats(entry.username);
        puntersMap.set(key, {
          username: entry.username,
          stars: stats.stars,
          accuracyPct: stats.accuracyPct,
          closestWins: stats.closestWins,
          gamesTracked: stats.gamesTracked,
          isShowcase: true,
        });
      }
    });
  });

  return Array.from(puntersMap.values());
}

export async function fetchAuthoritativePunters(query: string = ''): Promise<PunterProfile[]> {
  const now = Date.now();
  if (now - directoryFetchedAt > 60_000 && !directoryFetchPromise) {
    directoryFetchPromise = (async () => {
      try {
        const res = await fetch('/api/auth/directory', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data?.success && Array.isArray(data.punters)) {
            authoritativeDirectoryCache = data.punters;
            directoryFetchedAt = Date.now();
          }
        }
      } catch {
        // Non-blocking fallback to current cache
      } finally {
        directoryFetchPromise = null;
      }
      return searchPunters(query);
    })();
  }
  if (directoryFetchPromise) {
    await directoryFetchPromise;
  }
  return searchPunters(query);
}

export function searchPunters(query: string): PunterProfile[] {
  const q = query.trim().toLowerCase();
  const all = getAllPunters();
  if (!q) return all;

  return all.filter((p) => p.username.toLowerCase().includes(q));
}
