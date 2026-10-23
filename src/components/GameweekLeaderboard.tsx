import React, { useState } from 'react';
import { Trophy, Crown, Star, Sparkles, Medal, Users, ChevronDown, ChevronUp, ShieldCheck, Clock, TrendingUp, TrendingDown, RadioTower, Flame, CheckCircle2 } from 'lucide-react';
import type { Jackpot, LeaderboardEntry } from '../lib/types';
import Avatar from './Avatar';
import StarRating from './StarRating';
import PlayerProfileModal from './PlayerProfileModal';
import { getStarRating } from '../lib/punterRatings';
import { getTotalSharedPicksCount, MOCK_GAMBLERS } from '../lib/mockData';
import { getRoomStatusInfo } from '../lib/roomStatus';

interface GameweekLeaderboardProps {
  jackpot: Jackpot;
  totalUserPicksCount?: number;
}

export default function GameweekLeaderboard({ jackpot, totalUserPicksCount }: GameweekLeaderboardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedUserForModal, setSelectedUserForModal] = useState<string | null>(null);

  const totalSharedPicks = getTotalSharedPicksCount(jackpot) + (totalUserPicksCount || 0);
  const totalMatches = jackpot.matches.length || 17;

  const statusInfo = getRoomStatusInfo(jackpot);
  const completedCount = statusInfo.completedCount;
  const isLeaderboardActive = completedCount > 0;

  const entries: LeaderboardEntry[] = jackpot.leaderboard && jackpot.leaderboard.length > 0
    ? jackpot.leaderboard
    : [];

  const topLeader = entries[0];

  return (
    <div className="bg-panel border border-line rounded-2xl overflow-hidden mb-6 transition-all shadow-sm">
      <PlayerProfileModal
        username={selectedUserForModal}
        onClose={() => setSelectedUserForModal(null)}
      />

      {/* Compact Collapsible Header Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-panel-2/50 transition-colors select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
            statusInfo.status === 'live'
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : statusInfo.status === 'settled'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            <Trophy size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-base text-cream flex items-center gap-2">
                Gameweek Leaderboard
              </h3>

              {/* Minimalist 3-state badge */}
              <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-md border flex items-center gap-1.5 ${statusInfo.badgeClass}`}>
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
        </div>

        {/* Action Controls & Highlights */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/40">
          <div className="flex items-center gap-2 text-xs tabular-nums">
            <span className="inline-flex items-center gap-1.5 bg-ink px-3 py-1.5 rounded-xl border border-line text-cream-dim">
              <Users size={13} className="text-gold" />
              <strong className="text-gold">{totalSharedPicks.toLocaleString()}</strong> Shared Picks
            </span>
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-bold text-cream bg-ink-2 hover:bg-gold/20 hover:text-gold border border-line hover:border-gold/40 px-3.5 py-1.5 rounded-xl transition-all"
          >
            <span>{isExpanded ? 'Hide' : 'View Section'}</span>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Section Details */}
      {isExpanded && (
        <div className="p-4 sm:p-6 border-t border-line/60 bg-ink/30 space-y-5 animate-fade-in">
          
          {/* Shared Picks Prior to Closure Highlight Banner */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-panel-2 to-gold/10 border border-gold/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
                <Users size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-display font-bold text-cream text-sm">
                    Picks Shared Prior to Closure
                  </h4>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-xs text-cream-dim mt-0.5">
                  Live tally of predictions posted by gamblers before this room closes.
                </p>
              </div>
            </div>

            <div className="bg-ink border border-gold/40 px-3.5 py-1.5 rounded-xl text-center shrink-0 self-stretch sm:self-auto flex sm:flex-col justify-between sm:justify-center items-center gap-1">
              <span className="text-[11px] uppercase font-bold tracking-wide text-cream-dim">Total Shared Picks</span>
              <span className="font-display font-bold text-gold text-base sm:text-lg">
                {totalSharedPicks.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Gameweek Leaderboard Title & Ranking Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
            <p className="text-xs text-cream-dim flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
              {isLeaderboardActive
                ? `Standings recalculate live as legs finish. (${completedCount} of ${totalMatches} games concluded)`
                : 'Leaderboard is pending match results. Standings activate once games kick off and results are updated by Admin.'}
            </p>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full w-fit">
              <Sparkles size={12} /> Tiered Star Boosts (#1: +1.0★ · #2: +0.5★ · #3: +0.25★)
            </span>
          </div>

          {!isLeaderboardActive ? (
            /* Inactive Leaderboard Banner State */
            <div className="bg-ink-2/80 border border-dashed border-gold/30 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center mx-auto">
                <Clock size={24} className="animate-pulse" />
              </div>
              <h4 className="font-display font-bold text-base text-cream">
                Leaderboard Pending Match Results
              </h4>
              <p className="text-xs text-cream-dim max-w-lg mx-auto leading-relaxed">
                The leaderboard activates automatically as match results are updated by Admin leg by leg. Once games conclude, punters will experience live rank movements - climbing or dropping as results roll in!
              </p>

              {/* Registered Punters Ready Banner */}
              <div className="pt-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gold mb-2">
                  Registered Punters Ready for Live Standings ({MOCK_GAMBLERS.length})
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
                  {MOCK_GAMBLERS.slice(0, 7).map((g) => (
                    <span key={g.username} className="inline-flex items-center gap-1.5 bg-panel border border-line px-2.5 py-1 rounded-lg text-xs font-semibold text-cream">
                      <Avatar name={g.username} seed={g.colorSeed} size={18} />
                      <span>{g.username}</span>
                      <span className="text-[11px] text-cream-dim">0/{totalMatches}</span>
                    </span>
                  ))}
                  <span className="text-xs text-cream-dim tabular-nums">+ {MOCK_GAMBLERS.length - 7} more</span>
                </div>
              </div>
            </div>
          ) : (
            /* Active Live Leaderboard Table */
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-emerald-950/30 via-panel to-ink p-3 rounded-xl border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <RadioTower size={14} className="animate-pulse text-emerald-400" />
                  Live Gameweek Progression: {completedCount} / {totalMatches} Matches Settled
                </span>
                <span className="text-[11px] font-semibold text-gold bg-gold/10 px-2.5 py-0.5 rounded-full border border-gold/20 w-fit">
                  ⚡ Ties broken by earliest slip submission time
                </span>
              </div>

              <div className="rounded-xl border border-line bg-panel overflow-hidden">
                <table className="w-full table-fixed text-left text-xs text-cream-dim">
                  <thead>
                    <tr className="border-b border-line text-[11px] sm:text-[11px] uppercase tracking-wide text-cream-dim/70 bg-panel-2">
                      <th className="py-2.5 px-2 sm:px-3 w-[24%] sm:w-[22%]">
                        <span className="hidden sm:inline">Rank & Move</span>
                        <span className="sm:hidden">Rank</span>
                      </th>
                      <th className="py-2.5 px-2 sm:px-3 w-[42%] sm:w-[45%]">Gambler</th>
                      <th className="py-2.5 px-2 sm:px-3 text-center w-[18%] sm:w-[17%]">
                        <span className="hidden sm:inline">Correct / Settled</span>
                        <span className="sm:hidden">Hits</span>
                      </th>
                      <th className="py-2.5 px-2 sm:px-3 text-center w-[16%] sm:w-[16%]">
                        <span className="hidden sm:inline">Live Accuracy</span>
                        <span className="sm:hidden">Acc.</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/40">
                    {entries.map((entry) => {
                      const currentStars = getStarRating(entry.username);
                      const accuracyPct = Math.round((entry.correct / completedCount) * 100);

                      return (
                        <tr
                          key={entry.rank}
                          onClick={() => setSelectedUserForModal(entry.username)}
                          className={`cursor-pointer transition-colors ${
                            entry.isClosest ? 'bg-gold/10 font-medium hover:bg-gold/15' : 'hover:bg-panel-2/60'
                          }`}
                        >
                          {/* Rank & Movement */}
                          <td className="py-2.5 px-2 sm:px-3 font-bold text-cream whitespace-nowrap">
                            <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs">
                              {entry.rank === 1 ? (
                                <span className="inline-flex items-center gap-0.5 text-gold bg-gold/15 px-1.5 py-0.5 rounded-full border border-gold/30 text-[11px] sm:text-xs">
                                  <Crown size={11} /> #1
                                </span>
                              ) : entry.rank === 2 ? (
                                <span className="inline-flex items-center gap-0.5 text-slate-200 bg-slate-400/10 px-1.5 py-0.5 rounded-full text-[11px] sm:text-xs">
                                  <Medal size={11} /> #2
                                </span>
                              ) : entry.rank === 3 ? (
                                <span className="inline-flex items-center gap-0.5 text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full text-[11px] sm:text-xs">
                                  <Medal size={11} /> #3
                                </span>
                              ) : (
                                <span className="px-1 tabular-nums text-cream-dim">#{entry.rank}</span>
                              )}

                              {/* Rank change movement badge */}
                              {entry.rankChange && entry.rankChange > 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-[11px] sm:text-[11px] font-bold text-emerald-400 bg-emerald-500/15 px-1 py-0.1 rounded" title={`Climbed ${entry.rankChange} spots!`}>
                                  <TrendingUp size={10} /> +{entry.rankChange}
                                </span>
                              ) : entry.rankChange && entry.rankChange < 0 ? (
                                <span className="inline-flex items-center gap-0.5 text-[11px] sm:text-[11px] font-bold text-rose-400 bg-rose-500/15 px-1 py-0.1 rounded" title={`Dropped ${Math.abs(entry.rankChange)} spots`}>
                                  <TrendingDown size={10} /> {entry.rankChange}
                                </span>
                              ) : (
                                <span className="text-[11px] text-cream-dim/50 tabular-nums hidden xs:inline">•</span>
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
                              <div className="hidden xs:block shrink-0">
                                <StarRating rating={currentStars} size={8} showNumber={false} />
                              </div>
                              {entry.isClosest && (
                                <span className="text-[11px] font-bold text-gold bg-gold/20 px-1 py-0.1 rounded shrink-0 hidden sm:inline" title="Closest to winning slip!">
                                  👑 #1
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Correct / Total Settled */}
                          <td className="py-2.5 px-2 sm:px-3 text-center tabular-nums font-bold text-cream text-[11px] sm:text-xs whitespace-nowrap">
                            <span className="text-gold">{entry.correct}</span>/<span className="text-cream-dim/80">{completedCount}</span>
                          </td>

                          {/* Accuracy */}
                          <td className="py-2.5 px-2 sm:px-3 text-center whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 sm:px-2 sm:py-0.5 rounded text-[11px] sm:text-[11px] font-bold ${
                              accuracyPct >= 80 ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-ink text-cream-dim'
                            }`}>
                              {accuracyPct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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

