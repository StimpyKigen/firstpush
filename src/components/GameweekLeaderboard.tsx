import { useState, useMemo } from 'react';
import { Crown, Medal, Users, ChevronDown, ChevronUp, TrendingUp, TrendingDown, RadioTower } from 'lucide-react';
import type { Jackpot, LeaderboardEntry } from '../lib/types';
import Avatar from './Avatar';
import StarRating from './StarRating';
import PlayerProfileModal from './PlayerProfileModal';
import { getStarRating } from '../lib/punterRatings';
import { getTotalSharedPicksCount } from '../lib/mockData';
import { getRoomStatusInfo } from '../lib/roomStatus';
import { computeRoomPerformanceAndLeaderboard } from '../lib/leaderboardEngine';
import { useCurrentUser } from '../lib/authStore';
import { useUserPicks } from '../lib/userPicksStore';

interface GameweekLeaderboardProps {
  jackpot: Jackpot;
  totalUserPicksCount?: number;
}

export default function GameweekLeaderboard({ jackpot, totalUserPicksCount }: GameweekLeaderboardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState<string | null>(null);

  const currentUser = useCurrentUser();
  const currentUsername = currentUser?.username || 'Guest Punter';
  const userPicks = useUserPicks((s) => s.userPicks);

  const totalSharedPicks = getTotalSharedPicksCount(jackpot) + (totalUserPicksCount || 0);
  const totalMatches = jackpot.matches.length || 17;

  const statusInfo = getRoomStatusInfo(jackpot);
  const completedCount = statusInfo.completedCount;
  const isLeaderboardActive = completedCount > 0;

  const computed = useMemo(
    () => computeRoomPerformanceAndLeaderboard(jackpot, currentUsername, userPicks),
    [jackpot, currentUsername, userPicks]
  );

  const entries: LeaderboardEntry[] =
    jackpot.leaderboard && jackpot.leaderboard.length > 0
      ? jackpot.leaderboard
      : computed.leaderboard;

  const topLeader = entries[0];

  const statusTextColor =
    statusInfo.status === 'live'
      ? 'text-rose-600 animate-pulse'
      : statusInfo.status === 'settled'
      ? 'text-emerald-600'
      : 'text-amber-300';

  return (
    <div className="bg-panel border border-line rounded-2xl overflow-hidden transition-all shadow-sm">
      <PlayerProfileModal
        username={selectedUserForModal}
        onClose={() => setSelectedUserForModal(null)}
      />

      {/* Compact Collapsible Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-panel-2/50 transition-colors select-none"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-display font-bold text-base text-cream flex items-center gap-2">
              Gameweek Leaderboard
            </h3>

            {/* Minimalist 3-state status text (no background or border) */}
            <span className={`text-[11px] font-bold uppercase flex items-center gap-1.5 ${statusTextColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
              {statusInfo.label}
            </span>
          </div>

          <p className="text-xs text-cream-dim truncate mt-0.5">
            {isLeaderboardActive && topLeader ? (
              <span>
                <strong className="text-cream">Current #1 Leader:</strong> {topLeader.username} ({topLeader.correct}/{completedCount} legs)
              </span>
            ) : (
              'Room leaderboard activates once matches kick off and results update.'
            )}
          </p>
        </div>

        {/* Action Controls & Highlights */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/40">
          <div className="flex items-center gap-2 text-xs tabular-nums">
            <span className="inline-flex items-center gap-1.5 text-cream-dim">
              <Users size={13} className="text-gold" />
              <strong className="text-gold">{totalSharedPicks.toLocaleString()}</strong> Shared Picks
            </span>
          </div>

          <button
            type="button"
            className="flex items-center gap-1 text-xs font-bold text-cream hover:text-gold py-1 transition-colors cursor-pointer"
          >
            <span>{isExpanded ? 'Hide' : 'View Section'}</span>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Standalone Leaderboard Section */}
      {isExpanded && (
        <div className="p-4 sm:p-6 border-t border-line/60 bg-ink/30 space-y-4 animate-fade-in">
          {/* Gameweek Leaderboard Status & Punter Count */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
            <p className="text-xs text-cream-dim">
              {isLeaderboardActive
                ? `Standings recalculate live as legs finish. (${completedCount} of ${totalMatches} games concluded)`
                : 'Leaderboard is pending match results. Standings activate once games kick off and results are updated by Admin.'}
            </p>
            <span className="text-[11px] font-bold text-cream-dim tabular-nums shrink-0">
              {entries.length} Registered Punters
            </span>
          </div>

          <div className="space-y-3">
            {isLeaderboardActive && (
              <div className="bg-[#006C54]/5 p-3 rounded-xl border border-[#006C54]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#006C54] flex items-center gap-1.5">
                  <RadioTower size={14} className="animate-pulse text-[#006C54]" />
                  Live Gameweek Progression: {completedCount} / {totalMatches} Matches Settled
                </span>
                <span className="text-[11px] font-semibold text-gold w-fit">
                  Ties broken by earliest slip submission time
                </span>
              </div>
            )}

            <div className="rounded-xl border border-line bg-panel overflow-hidden">
              <table className="w-full table-fixed text-left text-xs text-cream-dim">
                <thead>
                  <tr className="border-b border-line text-[11px] uppercase tracking-wide text-cream-dim/80 bg-panel-2">
                    <th className="py-2.5 px-2 sm:px-3 w-[24%] sm:w-[22%]">
                      <span className="hidden sm:inline">{isLeaderboardActive ? 'Rank & Move' : 'Rank'}</span>
                      <span className="sm:hidden">Rank</span>
                    </th>
                    <th className="py-2.5 px-2 sm:px-3 w-[42%] sm:w-[45%]">Gambler</th>
                    <th className="py-2.5 px-2 sm:px-3 text-center w-[18%] sm:w-[17%]">
                      <span className="hidden sm:inline">{isLeaderboardActive ? 'Correct / Settled' : 'Correct / Legs'}</span>
                      <span className="sm:hidden">Hits</span>
                    </th>
                    <th className="py-2.5 px-2 sm:px-3 text-center w-[16%] sm:w-[16%]">
                      <span className="hidden sm:inline">{isLeaderboardActive ? 'Live Accuracy' : 'Accuracy'}</span>
                      <span className="sm:hidden">Acc.</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {entries.map((entry) => {
                    const currentStars = getStarRating(entry.username);
                    const accuracyPct = completedCount > 0 ? Math.round((entry.correct / completedCount) * 100) : 0;
                    const isCurrUser = currentUser && entry.username.toLowerCase() === currentUsername.toLowerCase();

                    return (
                      <tr
                        key={`${entry.rank}-${entry.username}`}
                        onClick={() => setSelectedUserForModal(entry.username)}
                        className={`cursor-pointer transition-colors ${
                          isCurrUser
                            ? 'bg-[#006C54]/10 font-semibold hover:bg-[#006C54]/15'
                            : isLeaderboardActive && entry.isClosest
                            ? 'bg-gold/10 font-medium hover:bg-gold/15'
                            : 'hover:bg-panel-2/60'
                        }`}
                      >
                        {/* Rank & Movement */}
                        <td className="py-2.5 px-2 sm:px-3 font-bold text-cream whitespace-nowrap">
                          <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs">
                            {isLeaderboardActive && entry.rank === 1 ? (
                              <span className="inline-flex items-center gap-0.5 text-gold bg-gold/15 px-1.5 py-0.5 rounded-full border border-gold/30 text-[11px] sm:text-xs">
                                <Crown size={11} /> 1
                              </span>
                            ) : isLeaderboardActive && entry.rank === 2 ? (
                              <span className="inline-flex items-center gap-0.5 text-cream bg-panel-2 px-1.5 py-0.5 rounded-full text-[11px] sm:text-xs">
                                <Medal size={11} /> 2
                              </span>
                            ) : isLeaderboardActive && entry.rank === 3 ? (
                              <span className="inline-flex items-center gap-0.5 text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full text-[11px] sm:text-xs">
                                <Medal size={11} /> 3
                              </span>
                            ) : (
                              <span className="px-1 tabular-nums text-cream-dim">{entry.rank}</span>
                            )}

                            {/* Rank change movement badge */}
                            {isLeaderboardActive && (
                              entry.rankChange && entry.rankChange > 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-1 py-0.1 rounded" title={`Climbed ${entry.rankChange} spots!`}>
                                  <TrendingUp size={10} /> +{entry.rankChange}
                                </span>
                              ) : entry.rankChange && entry.rankChange < 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-rose-600 bg-rose-500/10 px-1 py-0.1 rounded" title={`Dropped ${Math.abs(entry.rankChange)} spots`}>
                                  <TrendingDown size={10} /> {entry.rankChange}
                                </span>
                              ) : (
                                <span className="text-[11px] text-cream-dim/50 tabular-nums hidden xs:inline">•</span>
                              )
                            )}
                          </div>
                        </td>

                        {/* Username & Avatar */}
                        <td className="py-2.5 px-2 sm:px-3 font-bold text-cream">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <div className="shrink-0">
                              <Avatar name={entry.username} seed={entry.colorSeed} size={20} />
                            </div>
                            <span className="truncate min-w-0 text-[11px] sm:text-xs hover:text-gold transition-colors">
                              {entry.username}
                            </span>
                            {isCurrUser && (
                              <span className="text-[11px] font-bold text-[#006C54] shrink-0">
                                (You)
                              </span>
                            )}
                            <div className="hidden xs:block shrink-0">
                              <StarRating rating={currentStars} size={8} showNumber={false} />
                            </div>
                            {isLeaderboardActive && entry.isClosest && (
                              <span className="text-[11px] font-bold text-gold bg-gold/20 px-1 py-0.1 rounded shrink-0 hidden sm:inline" title="Closest to winning slip!">
                                👑 1
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Correct / Total Settled */}
                        <td className="py-2.5 px-2 sm:px-3 text-center tabular-nums font-bold text-cream text-[11px] sm:text-xs whitespace-nowrap">
                          {isLeaderboardActive ? (
                            <>
                              <span className="text-gold">{entry.correct}</span>/<span className="text-cream-dim/80">{completedCount}</span>
                            </>
                          ) : (
                            <>
                              <span className="text-cream-dim">0</span>/<span className="text-cream-dim/80">{totalMatches}</span>
                            </>
                          )}
                        </td>

                        {/* Accuracy */}
                        <td className="py-2.5 px-2 sm:px-3 text-center whitespace-nowrap">
                          {isLeaderboardActive ? (
                            <span className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded text-[11px] font-bold ${
                              accuracyPct >= 80 ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-ink text-cream-dim'
                            }`}>
                              {accuracyPct}%
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-cream-dim">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Collapse Footer Button */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={() => setIsExpanded(false)}
              className="text-xs font-semibold text-cream-dim hover:text-gold flex items-center gap-1 py-1.5 px-4 rounded-full border border-line/60 bg-ink/50 hover:bg-ink transition-colors"
            >
              <ChevronUp size={14} /> Collapse Leaderboard Section
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
