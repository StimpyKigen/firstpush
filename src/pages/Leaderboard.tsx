import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy, Crown, Medal, Flame, Clock, CheckCircle2, Users, Search,
  Filter, Target, ChevronRight, ExternalLink,
  Layers, ChevronUp, ChevronDown
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { subscribeToJackpots, getJackpotsSnapshot } from '../lib/mockData';
import { useUserPicks } from '../lib/userPicksStore';
import { useAuth, useCurrentUser } from '../lib/authStore';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import PlayerProfileModal from '../components/PlayerProfileModal';
import { getPunterStats } from '../lib/punterRatings';
import { getRoomStatusInfo, type DisplayRoomStatus } from '../lib/roomStatus';
import { computeRoomPerformanceAndLeaderboard } from '../lib/leaderboardEngine';

const BOOKIE_BADGE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  SportPesa: { bg: 'bg-blue-900/40', text: 'text-blue-300', border: 'border-blue-500/40' },
  Betika: { bg: 'bg-emerald-900/40', text: 'text-emerald-300', border: 'border-emerald-500/40' },
  MozzartBet: { bg: 'bg-amber-900/40', text: 'text-amber-300', border: 'border-amber-500/40' },
  Shabiki: { bg: 'bg-rose-900/40', text: 'text-rose-300', border: 'border-rose-500/40' },
  Odibets: { bg: 'bg-yellow-900/40', text: 'text-yellow-300', border: 'border-yellow-500/40' },
};

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <SeoHead
        title="Top Punters Leaderboard & Gameweek Standings"
        description="View live jackpot room rankings, accuracy ratings, and top punters for SportPesa, Betika & Mozzart jackpots on MshindiRoom."
        canonicalUrl="https://mshindi.co.ke/leaderboard"
      />
      <PlayerProfileModal
        username={selectedUserForModal}
        onClose={() => setSelectedUserForModal(null)}
      />

      {/* ESPN Styled Editorial Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-[#006C54] flex items-center justify-center text-white shadow-xs">
              <Trophy size={18} />
            </div>
            <h1 className="font-display font-black text-2xl sm:text-4xl text-slate-900 tracking-tight uppercase">Room Standings &amp; Rankings</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-xl leading-relaxed">
            Independent standings per jackpot room. Select any room to expand its rankings, participant slips &amp; live leg hits.
          </p>
        </div>

        {/* Compact User Stats Pill */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-full text-xs shrink-0 self-stretch sm:self-auto justify-between shadow-2xs">
          <div className="flex items-center gap-1.5">
            <Target size={14} className="text-[#006C54]" />
            <span className="text-slate-500 font-bold uppercase text-[10px]">Rooms:</span>
            <strong className="text-slate-900 font-black">{totalRoomsJoined}</strong>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold uppercase text-[10px]">Hits Acc:</span>
            <strong className="text-[#006C54] font-black">{overallAccuracy}%</strong>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-1 text-amber-500 font-black">
            {userStats.stars}★
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Main Status Category Tabs (ESPN Style) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-full overflow-x-auto scrollbar-none text-xs font-black uppercase tracking-wider w-full sm:w-auto">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                filterTab === 'all'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={13} /> All ({allJackpots.length})
            </button>

            <button
              onClick={() => setFilterTab('my')}
              className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                filterTab === 'my'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Target size={13} /> My Rooms ({totalRoomsJoined})
            </button>

            <button
              onClick={() => setFilterTab('not_started')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                filterTab === 'not_started'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={12} /> Upcoming
            </button>

            <button
              onClick={() => setFilterTab('live')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                filterTab === 'live'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame size={12} /> Live
            </button>

            <button
              onClick={() => setFilterTab('settled')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                filterTab === 'settled'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 size={12} /> Settled
            </button>
          </div>

          {/* Search Input */}
          <div className="relative shrink-0 sm:w-56">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-[#006C54] rounded-full pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none placeholder:text-slate-400 transition-all"
            />
          </div>
        </div>

        {/* Bookie Pill Selection */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 scrollbar-none">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 shrink-0 mr-1">
            <Filter size={11} /> Bookie:
          </span>
          {['all', 'SportPesa', 'Betika', 'MozzartBet', 'Shabiki', 'Odibets'].map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBookie(b)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all shrink-0 ${
                selectedBookie.toLowerCase() === b.toLowerCase()
                  ? 'bg-[#006C54] border-[#006C54] text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-[#006C54] hover:text-[#006C54]'
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
                className={`bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md ${
                  userPerf.participated ? 'border-[#006C54] ring-1 ring-[#006C54]/20' : 'border-slate-200 hover:border-[#006C54]'
                }`}
              >
                {/* Minimalist Card Header */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 font-black text-slate-800">
                      <Trophy size={16} className="text-[#FFD700]" />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* Clean Text Bookie Label (No Generic Pill) */}
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                          {jackpot.bookie}
                        </span>

                        <span className="text-slate-300">·</span>

                        {/* Minimalist 3-State Status Label (Clean Text with Status Dot) */}
                        <span className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-600">
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                          {statusInfo.label}
                        </span>

                        {/* Participated Tag */}
                        {userPerf.participated && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-[11px] font-black uppercase tracking-wider text-[#006C54] flex items-center gap-1">
                              <Target size={11} /> My Picked Room
                            </span>
                          </>
                        )}
                      </div>

                      <h2 className="font-display font-black text-base sm:text-lg text-slate-900 truncate flex items-center gap-1.5 uppercase">
                        {jackpot.name}
                        <span className="text-xs font-semibold text-slate-400 not-italic">({jackpot.gameweek})</span>
                      </h2>

                      <p className="text-xs text-slate-500 truncate">
                        {jackpot.deadline} · <span className="text-slate-800 font-bold">{jackpot.participants.toLocaleString()} punters</span>
                      </p>
                    </div>
                  </div>

                  {/* Right Side Prize Pool & Custom Athletic Buttons */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Bookie Jackpot</span>
                      <p className="font-display font-black text-[#FFD700] text-base sm:text-lg leading-none">
                        {jackpot.prizePool}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/?room=${jackpot.id}`}
                        className="h-9 px-3.5 rounded-md bg-[#006C54] hover:bg-[#005441] text-white font-black uppercase tracking-wider text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                      >
                        <span>Room</span>
                        <ExternalLink size={12} />
                      </Link>

                      <button
                        onClick={() => toggleRoomExpand(jackpot.id)}
                        className="h-9 px-3.5 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
                      >
                        <span>{isExpanded ? 'Hide' : 'Standings'}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Minimalist User Performance Line (if participated) */}
                {userPerf.participated && (
                  <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">
                        Your Rank:
                      </span>
                      <span className="font-black text-slate-900">
                        #{userPerf.userRank} of {leaderboard.length}
                      </span>
                      <span className="text-slate-500 text-[11px] font-semibold">
                        ({userPerf.userCorrect}/{completedCount || totalMatches} hits • {userPerf.accuracy}%)
                      </span>
                    </div>

                    <span className="text-[10px] font-black uppercase text-[#006C54] tracking-wider">
                      Active Pick
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
