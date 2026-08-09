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

export function getAllPunters(): PunterProfile[] {
  const authAccounts = useAuth.getState().accounts;
  const puntersMap = new Map<string, PunterProfile>();

  // 1. Add auth accounts
  authAccounts.forEach((acc) => {
    const key = acc.username.toLowerCase();
    const stats = getPunterStats(acc.username);
    puntersMap.set(key, {
      username: acc.username,
      phone: acc.phone,
      avatarId: acc.avatarId,
      stars: stats.stars,
      accuracyPct: stats.accuracyPct,
      closestWins: stats.closestWins,
      gamesTracked: stats.gamesTracked,
      isRegisteredAccount: true,
    });
  });

  // 2. Add public seed punters
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
      });
    }
  });

  // 3. Add leaderboard punters from jackpots
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
        });
      }
    });
  });

  return Array.from(puntersMap.values());
}

export function searchPunters(query: string): PunterProfile[] {
  const q = query.trim().toLowerCase();
  const all = getAllPunters();
  if (!q) return all;

  return all.filter((p) => p.username.toLowerCase().includes(q));
}
