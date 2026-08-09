import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Crown, Medal, Flame, Clock, CheckCircle2, Users, Search,
  Filter, Target, ChevronRight, ExternalLink,
  Layers, ChevronUp, ChevronDown
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { subscribeToJackpots, getJackpotsSnapshot, MOCK_GAMBLERS } from '../lib/mockData';
import { useUserPicks, type UserPickRecord } from '../lib/userPicksStore';
import { useAuth, useCurrentUser } from '../lib/authStore';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import PlayerProfileModal from '../components/PlayerProfileModal';
import { getPunterStats } from '../lib/punterRatings';
import { getRoomStatusInfo, type DisplayRoomStatus } from '../lib/roomStatus';
import type { Jackpot, LeaderboardEntry } from '../lib/types';

const BOOKIE_BADGE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  SportPesa: { bg: 'bg-blue-900/40', text: 'text-blue-300', border: 'border-blue-500/40' },
  Betika: { bg: 'bg-emerald-900/40', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  MozzartBet: { bg: 'bg-amber-900/40', text: 'text-amber-300', border: 'border-amber-500/40' },
  Shabiki: { bg: 'bg-rose-900/40', text: 'text-rose-300', border: 'border-rose-500/40' },
  Odibets: { bg: 'bg-yellow-900/40', text: 'text-yellow-300', border: 'border-yellow-500/40' },
};

function getGamblerPickForMatch(username: string, matchId: string, homePct = 45, drawPct = 30) {
  let hash = 0;
  const str = `${username}:${matchId}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const val = Math.abs(hash) % 100;
  if (val < homePct) return '1';
  if (val < homePct + drawPct) return 'X';
  return '2';
}

interface RoomPerformance {
  participated: boolean;
  userPicksCount: number;
  userCorrect: number;
  completedMatches: number;
  totalMatches: number;
  userRank: number;
  accuracy: number;
}

function computeRoomPerformanceAndLeaderboard(
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

export default function Leaderboard() {
  const allJackpots = useSyncExternalStore(subscribeToJackpots, getJackpotsSnapshot, getJackpotsSnapshot);
  const user = useCurrentUser();
  const currentUsername = user?.username || 'MshindiPunter';
  const userPicks = useUserPicks((s) => s.userPicks);

  const [filterTab, setFilterTab] = useState<'all' | 'my' | DisplayRoomStatus>('all');
  const [selectedBookie, setSelectedBookie] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUserForModal, setSelectedUserForModal] = useState<string | null>(null);

  // Track expanded/collapsed state for each room card (default collapsed for space-friendly overview)
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});

  // Filter jackpots based on tab and bookie selection
  const filteredJackpots = allJackpots.filter((j) => {
    // Bookie filter
    if (selectedBookie !== 'all' && j.bookie.toLowerCase() !== selectedBookie.toLowerCase()) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = j.name.toLowerCase().includes(q);
      const matchBookie = j.bookie.toLowerCase().includes(q);
      const matchGameweek = j.gameweek.toLowerCase().includes(q);
      if (!matchName && !matchBookie && !matchGameweek) return false;
    }

    const statusInfo = getRoomStatusInfo(j);

    const userKeysInRoom = Object.keys(userPicks).filter((k) => k.startsWith(`${j.id}:`));
    const userParticipated = userKeysInRoom.length > 0;

    if (filterTab === 'my') return userParticipated;
    if (filterTab === 'not_started') return statusInfo.status === 'not_started';
    if (filterTab === 'live') return statusInfo.status === 'live';
    if (filterTab === 'settled') return statusInfo.status === 'settled';

    return true;
  });

  // Calculate overall user stats across all participated rooms
  let totalRoomsJoined = 0;
  let totalUserCorrectLegs = 0;
  let totalUserEvaluatedLegs = 0;

  allJackpots.forEach((j) => {
    const userKeys = Object.keys(userPicks).filter((k) => k.startsWith(`${j.id}:`));
    if (userKeys.length > 0) {
      totalRoomsJoined++;
      if (j.matches) {
        j.matches.forEach((m) => {
          if (m.result) {
            totalUserEvaluatedLegs++;
            const rec = userPicks[`${j.id}:${m.id}`];
            if (rec && rec.pick === m.result) {
              totalUserCorrectLegs++;
            }
          }
        });
      }
    }
  });

  const overallAccuracy = totalUserEvaluatedLegs > 0 ? Math.round((totalUserCorrectLegs / totalUserEvaluatedLegs) * 100) : 0;
  const userStats = getPunterStats(currentUsername);

  function toggleRoomExpand(roomId: string) {
    setExpandedRooms((prev) => ({
      ...prev,
      [roomId]: prev[roomId] === true ? false : true, // toggle expand
    }));
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-5 py-5 space-y-4">
      <SeoHead
        title="Top Punters Leaderboard & Gameweek Standings"
        description="View live jackpot room rankings, accuracy ratings, and top punters for SportPesa, Betika & Mozzart jackpots on MshindiRoom."
        canonicalUrl="https://mshindi.co.ke/leaderboard"
      />
      <PlayerProfileModal
        username={selectedUserForModal}
        onClose={() => setSelectedUserForModal(null)}
      />

      {/* Compact Space-Friendly Header */}
      <div className="bg-panel border border-line rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-gold" />
            <h1 className="font-display font-extrabold text-xl text-cream">Room Leaderboards</h1>
          </div>
          <p className="text-xs text-cream-dim mt-0.5">
            Independent standings per room. Select any room to expand its rankings & live leg hits.
          </p>
        </div>

        {/* Compact User Stats Pill */}
        <div className="flex items-center gap-2 bg-panel-2 border border-line/80 px-3 py-1.5 rounded-xl text-xs shrink-0 self-stretch sm:self-auto justify-between">
          <div className="flex items-center gap-1.5">
            <Target size={13} className="text-gold" />
            <span className="text-cream-dim">Rooms:</span>
            <strong className="text-cream font-bold">{totalRoomsJoined}</strong>
          </div>
          <div className="w-px h-3.5 bg-line" />
          <div className="flex items-center gap-1.5">
            <span className="text-cream-dim">Hits Acc:</span>
            <strong className="text-emerald-300 font-bold">{overallAccuracy}%</strong>
          </div>
          <div className="w-px h-3.5 bg-line" />
          <div className="flex items-center gap-1 text-gold font-bold">
            {userStats.stars}★
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-panel border border-line rounded-2xl p-2.5 sm:p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Main Status Category Tabs with the 3 exact room statuses */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs font-bold">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                filterTab === 'all'
                  ? 'bg-gold text-ink-2 shadow-sm'
                  : 'bg-panel-2 text-cream-dim hover:text-cream'
              }`}
            >
              <Layers size={13} /> All ({allJackpots.length})
            </button>

            <button
              onClick={() => setFilterTab('my')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                filterTab === 'my'
                  ? 'bg-gold text-ink-2 shadow-sm'
                  : 'bg-panel-2 text-cream-dim hover:text-cream'
              }`}
            >
              <Target size={13} /> My Rooms ({totalRoomsJoined})
            </button>

            <button
              onClick={() => setFilterTab('not_started')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap border ${
                filterTab === 'not_started'
                  ? 'bg-amber-500 text-ink-2 border-amber-400 font-extrabold'
                  : 'bg-panel-2 border-amber-500/20 text-amber-300 hover:border-amber-500/40'
              }`}
            >
              <Clock size={12} /> Not Started
            </button>

            <button
              onClick={() => setFilterTab('live')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap border ${
                filterTab === 'live'
                  ? 'bg-rose-500 text-white border-rose-400 font-extrabold'
                  : 'bg-panel-2 border-rose-500/20 text-rose-300 hover:border-rose-500/40'
              }`}
            >
              <Flame size={12} /> Live
            </button>

            <button
              onClick={() => setFilterTab('settled')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap border ${
                filterTab === 'settled'
                  ? 'bg-emerald-600 text-white border-emerald-400 font-extrabold'
                  : 'bg-panel-2 border-emerald-500/20 text-emerald-300 hover:border-emerald-500/40'
              }`}
            >
              <CheckCircle2 size={12} /> Settled
            </button>
          </div>

          {/* Search Input */}
          <div className="relative shrink-0 sm:w-48">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cream-dim" />
            <input
              type="text"
              placeholder="Search room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-ink border border-line rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-cream focus:outline-none focus:border-gold/60 placeholder:text-cream-dim/60"
            />
          </div>
        </div>

        {/* Bookie Pill Selection */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-line/40 scrollbar-none">
          <span className="text-[11px] font-bold text-cream-dim flex items-center gap-1 shrink-0 mr-1">
            <Filter size={11} /> Bookie:
          </span>
          {['all', 'SportPesa', 'Betika', 'MozzartBet', 'Shabiki', 'Odibets'].map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBookie(b)}
              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-all shrink-0 ${
                selectedBookie.toLowerCase() === b.toLowerCase()
                  ? 'bg-gold/20 border-gold text-gold'
                  : 'bg-panel-2 border-line/60 text-cream-dim hover:text-cream'
              }`}
            >
              {b === 'all' ? 'All' : b}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredJackpots.length === 0 ? (
        <div className="bg-panel border border-line rounded-2xl p-8 text-center space-y-3 max-w-sm mx-auto my-6">
          <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center mx-auto">
            <Trophy size={20} />
          </div>
          <h3 className="font-display font-bold text-sm text-cream">No Rooms Found</h3>
          <p className="text-xs text-cream-dim leading-relaxed">
            {filterTab === 'my'
              ? "You haven't made predictions in any room yet."
              : 'No jackpot rooms match your selected filter criteria.'}
          </p>
          <button
            onClick={() => {
              setFilterTab('all');
              setSelectedBookie('all');
              setSearchQuery('');
            }}
            className="py-1.5 px-3.5 rounded-xl bg-panel-2 border border-line text-cream text-xs font-bold hover:border-gold/40 transition-all"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Render Minimalist Space-Friendly Jackpot Cards */
        <div className="space-y-3">
          {filteredJackpots.map((jackpot) => {
            const { leaderboard, userPerf } = computeRoomPerformanceAndLeaderboard(
              jackpot,
              currentUsername,
              userPicks
            );

            const isExpanded = expandedRooms[jackpot.id] === true; // compact overview by default
            const statusInfo = getRoomStatusInfo(jackpot);

            const bookieStyle = BOOKIE_BADGE_STYLE[jackpot.bookie] || {
              bg: 'bg-gold/15',
              text: 'text-gold',
              border: 'border-gold/30',
            };

            const completedCount = statusInfo.completedCount;
            const totalMatches = statusInfo.totalCount;

            return (
              <div
                key={jackpot.id}
                id={`room-leaderboard-${jackpot.id}`}
                className={`bg-panel border rounded-2xl overflow-hidden transition-all hover:border-gold/30 ${
                  userPerf.participated ? 'border-gold/40 ring-1 ring-gold/15' : 'border-line'
                }`}
              >
                {/* Minimalist Card Header */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 font-bold text-xs ${bookieStyle.bg} ${bookieStyle.text} ${bookieStyle.border}`}>
                      <Trophy size={16} />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Bookie Pill */}
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${bookieStyle.bg} ${bookieStyle.text} ${bookieStyle.border}`}>
                          {jackpot.bookie}
                        </span>

                        {/* Minimalist 3-State Status Badge */}
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${statusInfo.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                          {statusInfo.label}
                        </span>

                        {/* Participated Tag */}
                        {userPerf.participated && (
                          <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Target size={10} /> My Picked Room
                          </span>
                        )}
                      </div>

                      <h2 className="font-display font-bold text-sm text-cream truncate flex items-center gap-1.5">
                        {jackpot.name}
                        <span className="text-xs font-normal text-cream-dim">({jackpot.gameweek})</span>
                      </h2>

                      <p className="text-[11px] text-cream-dim truncate">
                        {jackpot.deadline} · <span className="text-cream font-medium">{jackpot.participants.toLocaleString()} punters</span>
                      </p>
                    </div>
                  </div>

                  {/* Right Side Prize Pool & Toggle */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/40">
                    <div className="text-left sm:text-right">
                      <span className="text-[9px] uppercase font-extrabold text-cream-dim tracking-wider">Bookie Jackpot</span>
                      <p className="font-display font-extrabold text-gold text-sm sm:text-base leading-none">
                        {jackpot.prizePool}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/?room=${jackpot.id}`}
                        className="py-1.5 px-2.5 rounded-xl bg-gold/15 hover:bg-gold text-gold hover:text-ink-2 border border-gold/30 font-bold text-xs flex items-center gap-1 transition-all"
                      >
                        <span>Room</span>
                        <ExternalLink size={12} />
                      </Link>

                      <button
                        onClick={() => toggleRoomExpand(jackpot.id)}
                        className="py-1.5 px-2.5 rounded-xl bg-panel-2 hover:bg-ink border border-line text-cream-dim hover:text-cream text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <span>{isExpanded ? 'Hide' : 'Standings'}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Minimalist User Performance Line (if participated) */}
                {userPerf.participated && (
                  <div className="bg-gold/10 border-t border-gold/20 px-3.5 py-1.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-ink-2 bg-gold px-1.5 py-0.2 rounded">
                        Your Rank
                      </span>
                      <span className="font-bold text-cream">
                        #{userPerf.userRank} of {leaderboard.length}
                      </span>
                      <span className="text-cream-dim text-[11px]">
                        ({userPerf.userCorrect}/{completedCount || totalMatches} hits • {userPerf.accuracy}%)
                      </span>
                    </div>

                    <span className="text-[10px] font-extrabold text-emerald-300">
                      Active
                    </span>
                  </div>
                )}

                {/* Expandable Room Standings Table */}
                {isExpanded && (
                  <div className="p-3.5 sm:p-4 border-t border-line space-y-4 bg-ink/30">
                    {/* Compact Top 3 Banner */}
                    {leaderboard.length >= 3 && (
                      <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto py-1">
                        {[1, 0, 2].map((orderIdx) => {
                          const e = leaderboard[orderIdx];
                          if (!e) return null;

                          const isFirst = orderIdx === 0;
                          const isCurrUser = e.username.toLowerCase() === currentUsername.toLowerCase();
                          const RankIcon = isFirst ? Crown : Medal;

                          return (
                            <div
                              key={e.username}
                              onClick={() => setSelectedUserForModal(e.username)}
                              className={`p-2 rounded-xl border text-center cursor-pointer hover:border-gold/50 transition-all ${
                                isFirst
                                  ? 'bg-gold/15 border-gold/50 ring-1 ring-gold/20'
                                  : 'bg-panel-2 border-line'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1">
                                <RankIcon size={14} className={isFirst ? 'text-gold' : 'text-cream-dim'} />
                                <span className={`font-display font-extrabold text-xs ${isFirst ? 'text-gold' : 'text-cream'}`}>
                                  #{e.rank}
                                </span>
                              </div>

                              <p className={`text-xs font-bold truncate mt-0.5 ${isCurrUser ? 'text-gold' : 'text-cream'}`}>
                                {e.username} {isCurrUser && '(You)'}
                              </p>

                              <p className="text-[11px] font-mono font-extrabold text-gold mt-0.5">
                                {e.correct}/{completedCount || totalMatches} Hits
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* High-Density Standings Table */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-cream-dim px-1">
                        <span className="font-bold text-cream flex items-center gap-1">
                          <Users size={12} className="text-gold" /> Room Standings ({leaderboard.length} Punters)
                        </span>
                        <span>{statusInfo.description}</span>
                      </div>

                      <div className="rounded-xl border border-line bg-panel overflow-hidden">
                        <table className="w-full table-fixed text-left text-xs text-cream-dim">
                          <thead>
                            <tr className="bg-panel-2 border-b border-line text-[10px] uppercase font-extrabold text-cream-dim/80">
                              <th className="py-2 px-2 sm:px-3 w-[18%] sm:w-[15%]">Rank</th>
                              <th className="py-2 px-2 sm:px-3 w-[46%] sm:w-[50%]">Punter</th>
                              <th className="py-2 px-2 sm:px-3 text-center w-[20%] sm:w-[18%]">
                                <span className="hidden sm:inline">Correct Hits</span>
                                <span className="sm:hidden">Hits</span>
                              </th>
                              <th className="py-2 px-2 sm:px-3 text-center w-[16%] sm:w-[17%]">
                                <span className="hidden sm:inline">Accuracy</span>
                                <span className="sm:hidden">Acc.</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line/40">
                            {leaderboard.map((entry) => {
                              const isCurrUser = entry.username.toLowerCase() === currentUsername.toLowerCase();
                              const stats = getPunterStats(entry.username);
                              const accuracyPct = completedCount > 0
                                ? Math.round((entry.correct / completedCount) * 100)
                                : 0;

                              return (
                                <tr
                                  key={entry.rank}
                                  onClick={() => setSelectedUserForModal(entry.username)}
                                  className={`cursor-pointer transition-colors ${
                                    isCurrUser
                                      ? 'bg-gold/20 font-bold text-cream hover:bg-gold/25'
                                      : entry.isClosest
                                      ? 'bg-gold/10 font-medium hover:bg-gold/15'
                                      : 'hover:bg-panel-2/50'
                                  }`}
                                >
                                  {/* Rank */}
                                  <td className="py-2 px-2 sm:px-3 font-bold text-[11px] sm:text-xs whitespace-nowrap">
                                    {entry.rank === 1 ? (
                                      <span className="text-gold font-black">#1 👑</span>
                                    ) : (
                                      <span className="font-mono text-cream-dim">#{entry.rank}</span>
                                    )}
                                  </td>

                                  {/* Punter Name & Avatar */}
                                  <td className="py-2 px-2 sm:px-3 font-bold text-cream">
                                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                      <div className="shrink-0">
                                        <Avatar name={entry.username} seed={entry.colorSeed} size={18} />
                                      </div>
                                      <span className="hover:text-gold transition-colors truncate text-[11px] sm:text-xs min-w-0">
                                        {entry.username}
                                      </span>
                                      {isCurrUser && (
                                        <span className="text-[8px] font-black uppercase text-ink-2 bg-gold px-1 py-0.1 rounded shrink-0">
                                          YOU
                                        </span>
                                      )}
                                      <div className="hidden xs:block shrink-0">
                                        <StarRating rating={stats.stars} size={8} showNumber={false} />
                                      </div>
                                    </div>
                                  </td>

                                  {/* Correct Hits */}
                                  <td className="py-2 px-2 sm:px-3 text-center font-mono font-bold text-cream text-[11px] sm:text-xs whitespace-nowrap">
                                    <span className="text-gold">{entry.correct}</span>/<span className="text-cream-dim/80">{completedCount || totalMatches}</span>
                                  </td>

                                  {/* Accuracy % */}
                                  <td className="py-2 px-2 sm:px-3 text-center whitespace-nowrap">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      accuracyPct >= 70 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-ink text-cream-dim'
                                    }`}>
                                      {completedCount > 0 ? `${accuracyPct}%` : ' - '}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
