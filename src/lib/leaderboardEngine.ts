import { MOCK_GAMBLERS, getGamblerPickForMatch } from './mockData';
import type { UserPickRecord } from './userPicksStore';
import type { Jackpot, LeaderboardEntry } from './types';

export interface RoomPerformance {
  participated: boolean;
  userPicksCount: number;
  userCorrect: number;
  completedMatches: number;
  totalMatches: number;
  userRank: number;
  accuracy: number;
}

export function computeRoomPerformanceAndLeaderboard(
  jackpot: Jackpot,
  currentUsername: string,
  userPicks: Record<string, UserPickRecord>
): { leaderboard: LeaderboardEntry[]; userPerf: RoomPerformance } {
  const completedMatches = jackpot.matches ? jackpot.matches.filter((m) => m.result !== undefined) : [];
  const completedCount = completedMatches.length;
  const totalMatches = (jackpot.matches && jackpot.matches.length > 0) ? jackpot.matches.length : 17;

  // Check how many picks user made for this room
  const userKeysInRoom = Object.keys(userPicks).filter((k) => k.startsWith(`${jackpot.id}:`));
  const userPicksCount = userKeysInRoom.length;
  const participated = userPicksCount > 0;

  // Gather list of gamblers
  const list = MOCK_GAMBLERS.map((g) => ({
    username: g.username,
    colorSeed: g.colorSeed,
    isUser: false,
  }));

  // Append current user if they participated and aren't already in mock list
  if (participated && !list.some((g) => g.username.toLowerCase() === currentUsername.toLowerCase())) {
    list.push({
      username: currentUsername,
      colorSeed: 12,
      isUser: true,
    });
  }

  // Calculate scores and submission timestamps for each gambler
  const baseTime = jackpot.createdAt || (Date.now() - 86400000);

  const scored = list.map((g) => {
    let correct = 0;
    if (jackpot.matches) {
      jackpot.matches.forEach((m) => {
        if (m.result) {
          if (g.isUser || g.username.toLowerCase() === currentUsername.toLowerCase()) {
            const userRec = userPicks[`${jackpot.id}:${m.id}`];
            if (userRec && userRec.pick === m.result) {
              correct++;
            }
          } else {
            const consensus = jackpot.consensus ? jackpot.consensus[m.id] : undefined;
            const hPct = consensus ? consensus.homePct : 45;
            const dPct = consensus ? consensus.drawPct : 30;
            const pick = getGamblerPickForMatch(g.username, m.id, hPct, dPct);
            if (pick === m.result) {
              correct++;
            }
          }
        }
      });
    }

    // Determine submission timestamp offset for tiebreaker
    let hash = 0;
    const str = `${g.username}:${jackpot.id}:submission`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const isCurrentUser = g.isUser || g.username.toLowerCase() === currentUsername.toLowerCase();
    // User gets earlier submission priority if they entered
    const offsetMinutes = isCurrentUser ? 5 : ((Math.abs(hash) % 2880) + 10);
    const submissionTimestamp = baseTime + (offsetMinutes * 60 * 1000);
    const hoursAgo = Math.floor(offsetMinutes / 60);
    const minsAgo = offsetMinutes % 60;
    const submittedAt = isCurrentUser ? 'Just now' : (hoursAgo > 0 ? `${hoursAgo}h ${minsAgo}m prior` : `${minsAgo}m prior`);

    return {
      username: g.username,
      colorSeed: g.colorSeed,
      correct,
      submissionTimestamp,
      submittedAt,
      isUser: isCurrentUser,
    };
  });

  // Sort descending by correct (primary), then EARLIEST submission timestamp (tiebreaker)
  scored.sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    if (a.submissionTimestamp !== b.submissionTimestamp) {
      return a.submissionTimestamp - b.submissionTimestamp;
    }
    return a.username.localeCompare(b.username);
  });

  let userRank = 0;
  let userCorrect = 0;

  const leaderboard: LeaderboardEntry[] = scored.map((g, idx) => {
    const rank = idx + 1;
    if (g.isUser) {
      userRank = rank;
      userCorrect = g.correct;
    }

    let statusTitle = g.submittedAt;
    if (rank === 1) statusTitle = '👑 #1 Crown';
    else if (rank === 2) statusTitle = '🥈 #2 Runner-up';
    else if (rank === 3) statusTitle = '🥉 #3 Podium';

    return {
      rank,
      username: g.username,
      correct: g.correct,
      completedMatches: completedCount,
      totalMatches,
      prizeWon: statusTitle,
      submittedAt: g.submittedAt,
      submissionTimestamp: g.submissionTimestamp,
      isClosest: rank === 1,
      colorSeed: g.colorSeed,
    };
  });

  const accuracy = completedCount > 0 ? Math.round((userCorrect / completedCount) * 100) : 0;

  return {
    leaderboard,
    userPerf: {
      participated,
      userPicksCount,
      userCorrect,
      completedMatches: completedCount,
      totalMatches,
      userRank: userRank || (participated ? leaderboard.length : 0),
      accuracy,
    },
  };
}
