import React, { useState, useEffect } from 'react';
import {
  Clock, Activity, Shirt, ListOrdered, Radio, ExternalLink, AlertCircle
} from 'lucide-react';
import type { FreeMatch } from '../lib/freeMatches';
import {
  fetchSportScoreMatchDetail,
  fetchSportScoreStandings,
  buildMatchSlug,
  buildCompetitionSlug,
  type SportScoreMatchDetail,
  type SportScoreStandings
} from '../lib/sportscoreService';

interface SportScoreMatchCenterProps {
  match: FreeMatch;
}

type TabType = 'lineups' | 'timeline' | 'details' | 'standings' | 'tracker';

export default function SportScoreMatchCenter({ match }: SportScoreMatchCenterProps) {
  const [activeTab, setActiveTab] = useState<TabType>('lineups');
  const [detail, setDetail] = useState<SportScoreMatchDetail | null>(null);
  const [standings, setStandings] = useState<SportScoreStandings | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [isLoadingStandings, setIsLoadingStandings] = useState(false);

  useEffect(() => {
    let mounted = true;
    const slug = buildMatchSlug(match.home, match.away);

    setIsLoadingDetail(true);
    fetchSportScoreMatchDetail(slug).then((d) => {
      if (mounted) {
        setDetail(d);
        setIsLoadingDetail(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [match.home, match.away]);

  const handleTabClick = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'standings' && !standings && !isLoadingStandings) {
      setIsLoadingStandings(true);
      const compSlug = buildCompetitionSlug(match.competition);
      fetchSportScoreStandings(compSlug).then((s) => {
        setStandings(s);
        setIsLoadingStandings(false);
      });
    }
  };

  const isLive = match.status === 'in' || (detail?.status === 'in');

  return (
    <div className="bg-white border border-[#E6E6D2] rounded-2xl p-5 sm:p-6 shadow-xs mb-6">
      {/* Header & Attribution */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-[#F0F0E4]">
        <div>
          <h2 className="font-display font-bold text-slate-900 text-base sm:text-lg uppercase tracking-tight flex items-center gap-2">
            <Activity size={18} className="text-[#006C54]" />
            <span>SportScore Match Intelligence</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time lineups, tactical formations, live match timeline, and league standings.
          </p>
        </div>

        <a
          href="https://sportscore.com"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[#006C54] hover:underline inline-flex items-center gap-1 font-bold shrink-0 self-start sm:self-auto"
        >
          <span>Powered by SportScore</span>
          <ExternalLink size={12} />
        </a>
      </div>

      {/* Modern Apple-style Tab Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-2 scrollbar-none text-xs font-bold mb-4">
        <button
          type="button"
          onClick={() => handleTabClick('lineups')}
          className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'lineups'
              ? 'bg-[#006C54] text-white shadow-xs'
              : 'bg-[#FFFFF0] text-slate-700 border border-[#E6E6D2] hover:border-[#006C54]'
          }`}
        >
          <Shirt size={13} />
          <span>Lineups</span>
          {detail?.lineups?.confirmed && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Confirmed XI" />
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('timeline')}
          className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'timeline'
              ? 'bg-[#006C54] text-white shadow-xs'
              : 'bg-[#FFFFF0] text-slate-700 border border-[#E6E6D2] hover:border-[#006C54]'
          }`}
        >
          <Clock size={13} />
          <span>Timeline</span>
          {detail?.incidents && detail.incidents.length > 0 && (
            <span className="text-[11px] tabular-nums opacity-80">({detail.incidents.length})</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('details')}
          className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'details'
              ? 'bg-[#006C54] text-white shadow-xs'
              : 'bg-[#FFFFF0] text-slate-700 border border-[#E6E6D2] hover:border-[#006C54]'
          }`}
        >
          <Activity size={13} />
          <span>Match Details</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabClick('standings')}
          className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'standings'
              ? 'bg-[#006C54] text-white shadow-xs'
              : 'bg-[#FFFFF0] text-slate-700 border border-[#E6E6D2] hover:border-[#006C54]'
          }`}
        >
          <ListOrdered size={13} />
          <span>Table Standings</span>
        </button>

        {(isLive || detail?.tracker) && (
          <button
            type="button"
            onClick={() => handleTabClick('tracker')}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'tracker'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 text-red-700 border border-red-200 hover:border-red-400'
            }`}
          >
            <Radio size={13} className="animate-pulse" />
            <span>2D Pitch Tracker</span>
          </button>
        )}
      </div>

      {/* Tab Panels */}
      <div className="bg-[#FFFFF0] border border-[#E6E6D2] rounded-xl p-4 text-xs">
        {/* LINEUPS TAB */}
        {activeTab === 'lineups' && (
          <div>
            {isLoadingDetail ? (
              <div className="py-8 text-center text-slate-400 animate-pulse tabular-nums">
                Querying team rosters &amp; tactical formations...
              </div>
            ) : detail?.lineups?.home_xi && detail.lineups.home_xi.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white px-4 py-2 rounded-xl border border-[#E6E6D2] tabular-nums text-xs font-bold text-slate-800">
                  <span>{match.home}: {detail.lineups.home_formation || '4-3-3'}</span>
                  <span className="text-slate-400 text-xs font-normal">vs</span>
                  <span>{match.away}: {detail.lineups.away_formation || '4-4-2'}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Home Starters */}
                  <div className="bg-white p-3.5 rounded-xl border border-[#E6E6D2]">
                    <div className="font-bold text-[#006C54] uppercase text-xs mb-2 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                      <span>{match.home} Starting XI</span>
                      {detail.lineups.home_coach && (
                        <span className="text-[11px] font-normal text-slate-500">Coach: {detail.lineups.home_coach}</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {detail.lineups.home_xi.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5 text-slate-700">
                          <span className="flex items-center gap-2 truncate">
                            <span className="tabular-nums text-slate-400 text-xs w-5">{p.number || i + 1}</span>
                            <span className="font-medium truncate">{p.name}</span>
                          </span>
                          <span className="text-[11px] tabular-nums font-bold text-slate-500 px-1.5 py-0.2 bg-slate-50 rounded border border-slate-200">
                            {p.position || 'M'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Away Starters */}
                  <div className="bg-white p-3.5 rounded-xl border border-[#E6E6D2]">
                    <div className="font-bold text-slate-800 uppercase text-xs mb-2 pb-1.5 border-b border-slate-100 flex items-center justify-between">
                      <span>{match.away} Starting XI</span>
                      {detail.lineups.away_coach && (
                        <span className="text-[11px] font-normal text-slate-500">Coach: {detail.lineups.away_coach}</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {detail.lineups.away_xi?.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-0.5 text-slate-700">
                          <span className="flex items-center gap-2 truncate">
                            <span className="tabular-nums text-slate-400 text-xs w-5">{p.number || i + 1}</span>
                            <span className="font-medium truncate">{p.name}</span>
                          </span>
                          <span className="text-[11px] tabular-nums font-bold text-slate-500 px-1.5 py-0.2 bg-slate-50 rounded border border-slate-200">
                            {p.position || 'M'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-xl border border-[#E6E6D2] text-center space-y-2">
                <Shirt size={28} className="mx-auto text-slate-400" />
                <h4 className="font-bold text-slate-800 text-sm">Official Lineups Pending</h4>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  Confirmed starting lineups, tactical formations, and bench lists are officially published by managers approximately 60 minutes before kickoff.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {activeTab === 'timeline' && (
          <div>
            {isLoadingDetail ? (
              <div className="py-8 text-center text-slate-400 animate-pulse tabular-nums">
                Loading chronological match events...
              </div>
            ) : detail?.incidents && detail.incidents.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {detail.incidents.map((inc, i) => {
                  const isGoal = inc.is_goal || inc.type.toLowerCase().includes('goal');
                  const isCard = inc.is_card || inc.type.toLowerCase().includes('card');
                  const isHome = inc.side === 'home';

                  return (
                    <div
                      key={i}
                      className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        isGoal
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold'
                          : isCard
                          ? 'bg-amber-50/70 border-amber-200 text-slate-800'
                          : 'bg-white border-[#E6E6D2] text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="tabular-nums font-bold text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                          {inc.time}&apos;
                        </span>
                        <span>
                          {isGoal ? '⚽ Goal' : isCard ? '🟨 Card' : inc.type}
                          {inc.player ? `: ${inc.player}` : ''}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        {isHome ? match.home : match.away}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white p-6 rounded-xl border border-[#E6E6D2] text-center text-slate-500 text-xs">
                No incidents recorded yet. Live events (goals, cards, VAR, substitutions) appear automatically as the match unfolds.
              </div>
            )}
          </div>
        )}

        {/* MATCH DETAILS TAB */}
        {activeTab === 'details' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white p-3 rounded-xl border border-[#E6E6D2]">
              <span className="text-slate-400 font-semibold text-[11px] block">Competition</span>
              <span className="font-bold text-slate-900 text-sm">{match.competition}</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-[#E6E6D2]">
              <span className="text-slate-400 font-semibold text-[11px] block">Status</span>
              <span className="font-bold text-slate-900 text-sm">
                {detail?.status_text || match.status?.toUpperCase() || 'Upcoming'}
              </span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-[#E6E6D2]">
              <span className="text-slate-400 font-semibold text-[11px] block">Kickoff Time</span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">{match.kickoff}</span>
            </div>

            <div className="bg-white p-3 rounded-xl border border-[#E6E6D2]">
              <span className="text-slate-400 font-semibold text-[11px] block">Halftime Score</span>
              <span className="font-bold text-slate-900 text-sm tabular-nums">
                {detail?.home_ht_score !== undefined && detail?.home_ht_score !== null
                  ? `${detail.home_ht_score} - ${detail.away_ht_score}`
                  : 'Pending kickoff'}
              </span>
            </div>

            {detail?.venue && (
              <div className="bg-white p-3 rounded-xl border border-[#E6E6D2]">
                <span className="text-slate-400 font-semibold text-[11px] block">Venue</span>
                <span className="font-bold text-slate-900 text-sm">{detail.venue}</span>
              </div>
            )}

            {detail?.referee && (
              <div className="bg-white p-3 rounded-xl border border-[#E6E6D2]">
                <span className="text-slate-400 font-semibold text-[11px] block">Referee</span>
                <span className="font-bold text-slate-900 text-sm">{detail.referee}</span>
              </div>
            )}
          </div>
        )}

        {/* STANDINGS TAB */}
        {activeTab === 'standings' && (
          <div>
            {isLoadingStandings ? (
              <div className="py-8 text-center text-slate-400 animate-pulse tabular-nums">
                Fetching competition standings...
              </div>
            ) : standings?.tables?.[0]?.rows ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead>
                    <tr className="border-b border-[#E6E6D2] text-slate-400 text-[11px]">
                      <th className="py-1.5 pr-2 font-bold">#</th>
                      <th className="py-1.5 font-bold font-sans">Team</th>
                      <th className="py-1.5 text-center font-bold">P</th>
                      <th className="py-1.5 text-center font-bold">W</th>
                      <th className="py-1.5 text-center font-bold">D</th>
                      <th className="py-1.5 text-center font-bold">L</th>
                      <th className="py-1.5 text-center font-bold">GD</th>
                      <th className="py-1.5 text-right font-bold text-slate-900">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F0E4]">
                    {standings.tables[0].rows.map((row) => {
                      const isMatchTeam =
                        row.team.toLowerCase().includes(match.home.toLowerCase()) ||
                        row.team.toLowerCase().includes(match.away.toLowerCase());

                      return (
                        <tr
                          key={row.pos}
                          className={`transition-colors ${
                            isMatchTeam ? 'bg-[#006C54]/10 font-bold text-slate-900' : 'text-slate-700 hover:bg-[#F5F5E4]'
                          }`}
                        >
                          <td className="py-1.5 pr-2 font-bold text-slate-500">{row.pos}</td>
                          <td className="py-1.5 font-sans font-semibold truncate max-w-[160px]">
                            {row.team}
                          </td>
                          <td className="py-1.5 text-center text-slate-500">{row.p}</td>
                          <td className="py-1.5 text-center text-slate-600">{row.w}</td>
                          <td className="py-1.5 text-center text-slate-600">{row.d}</td>
                          <td className="py-1.5 text-center text-slate-600">{row.l}</td>
                          <td className="py-1.5 text-center text-slate-500">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                          <td className="py-1.5 text-right font-bold text-slate-900">{row.pts}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-xl border border-[#E6E6D2] text-center text-slate-500 text-xs">
                League standings table will update as matchday rounds complete.
              </div>
            )}
          </div>
        )}

        {/* 2D PITCH TRACKER TAB */}
        {activeTab === 'tracker' && (
          <div>
            {detail?.tracker?.id ? (
              <div className="rounded-xl overflow-hidden border border-[#E6E6D2] bg-slate-950 aspect-video w-full">
                <iframe
                  src={`https://sportscore.com/api/widget/tracker/?sport=football&id=${detail.tracker.id}`}
                  title="Live Match Tracker"
                  className="w-full h-full border-0"
                  allow="autoplay"
                />
              </div>
            ) : (
              <div className="bg-white p-6 rounded-xl border border-[#E6E6D2] text-center space-y-2">
                <Radio size={28} className="mx-auto text-red-500 animate-pulse" />
                <h4 className="font-bold text-slate-800 text-sm">Live 2D Pitch Visualizer</h4>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  Interactive 2D pitch coordinates, momentum, and ball attacks activate automatically once the match is in-play.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
