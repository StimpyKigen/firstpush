import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, Users, Flame, Dices, ChevronDown, ChevronUp, Send, CheckCircle2,
  AlertCircle, ThumbsUp, Radio, Trophy, Shirt, ListOrdered, Activity, ExternalLink,
  Gem, Sparkles, Check, ArrowRight
} from 'lucide-react';
import type { FreeMatch } from '../lib/freeMatches';
import type { MatchConsensus, Outcome, Conviction, GamblerPick } from '../lib/types';
import { useCurrentUser } from '../lib/authStore';
import { useUserPicks } from '../lib/userPicksStore';
import { showToast } from '../lib/notificationStore';
import Avatar from './Avatar';
import {
  fetchSportScoreMatchDetail,
  fetchSportScoreStandings,
  buildMatchSlug,
  buildCompetitionSlug,
  type SportScoreMatchDetail,
  type SportScoreStandings
} from '../lib/sportscoreService';
import { getMatchScorePresentation } from '../lib/matchStatus';
import { formatDeviceLocalTime } from '../lib/competitionPriority';

interface FixtureSportCardProps {
  match: FreeMatch;
  consensus: MatchConsensus;
  builderLegs: any[];
  onToggleLeg: (market: string, pick: string, odds: number, e: React.MouseEvent) => void;
  onOpenBetBuilder: (match: any) => void;
}

type CardTab = 'reasoning' | 'details' | 'lineups' | 'timeline' | 'standings' | 'tracker';

export default function FixtureSportCard({
  match,
  consensus,
  builderLegs,
  onToggleLeg,
  onOpenBetBuilder,
}: FixtureSportCardProps) {
  const currentUser = useCurrentUser();
  const username = currentUser?.username || 'Guest Punter';
  const { savePick, getPick, toggleLikePick, isPickLiked, getExtraLikes } = useUserPicks();

  const roomId = `free-${match.id}`;
  const myPickRecord = getPick(roomId, match.id);

  // Tab state
  const [activeTab, setActiveTab] = useState<CardTab | null>(null);
  const [sportDetail, setSportDetail] = useState<SportScoreMatchDetail | null>(null);
  const [standings, setStandings] = useState<SportScoreStandings | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingStandings, setIsLoadingStandings] = useState(false);

  // Reasoning form state
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>(myPickRecord?.pick || '1');
  const [selectedConviction, setSelectedConviction] = useState<Conviction>(myPickRecord?.conviction || 'Banker');
  const [reasoningInput, setReasoningInput] = useState(myPickRecord?.reasoning || '');
  const [isEditingPick, setIsEditingPick] = useState(false);
  const [submittingPick, setSubmittingPick] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Quick Bet Builder selection states
  const isHomeSelected = builderLegs.some((l) => l.matchId === match.id && l.market === 'Match Result (1X2)' && l.pick.includes('1'));
  const isDrawSelected = builderLegs.some((l) => l.matchId === match.id && l.market === 'Match Result (1X2)' && l.pick.includes('Draw'));
  const isAwaySelected = builderLegs.some((l) => l.matchId === match.id && l.market === 'Match Result (1X2)' && l.pick.includes('2'));

  const hOdds = match.homeOdds || 2.10;
  const dOdds = match.drawOdds || 3.30;
  const aOdds = match.awayOdds || 3.60;

  const scorePres = getMatchScorePresentation(
    sportDetail?.status || match.status,
    sportDetail?.status_text || match.displayClock,
    formatDeviceLocalTime(match.kickoffIso, match.kickoff),
    sportDetail?.home_score ?? match.homeScore,
    sportDetail?.away_score ?? match.awayScore
  );

  const isLive = scorePres.isLive;

  const majority = Math.max(consensus.homePct, consensus.drawPct, consensus.awayPct);
  const majLabel = majority === consensus.homePct ? '1 · Home' : majority === consensus.drawPct ? 'X · Draw' : '2 · Away';

  // Toggle active tab drawer
  const handleTabToggle = (tab: CardTab) => {
    if (activeTab === tab) {
      setActiveTab(null);
    } else {
      setActiveTab(tab);
      loadTabContent(tab);
    }
  };

  const loadTabContent = async (tab: CardTab) => {
    const slug = buildMatchSlug(match.home, match.away);

    if (tab === 'details' || tab === 'lineups' || tab === 'timeline' || tab === 'tracker') {
      if (!sportDetail && !isLoadingDetail) {
        setIsLoadingDetail(true);
        try {
          const detail = await fetchSportScoreMatchDetail(slug);
          if (detail) {
            setSportDetail(detail);
          }
        } finally {
          setIsLoadingDetail(false);
        }
      }
    } else if (tab === 'standings') {
      if (!standings && !isLoadingStandings) {
        setIsLoadingStandings(true);
        try {
          const compSlug = buildCompetitionSlug(match.competition);
          const tableData = await fetchSportScoreStandings(compSlug);
          if (tableData) {
            setStandings(tableData);
          }
        } finally {
          setIsLoadingStandings(false);
        }
      }
    }
  };

  // Handle punter reasoning submission
  const handlePostReasoning = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const clean = reasoningInput.trim();
    if (!clean) {
      setFormError('Please enter your tactical reasoning for this pick (min 10 characters).');
      return;
    }
    if (clean.length < 10) {
      setFormError('Reasoning must be at least 10 characters long.');
      return;
    }

    setSubmittingPick(true);
    try {
      const res = savePick(roomId, match.id, selectedOutcome, clean, selectedConviction);
      if (!res.ok) {
        setFormError(res.error || 'Failed to save pick. Please try again.');
        return;
      }

      setIsEditingPick(false);
      showToast({
        type: 'success',
        title: 'Pick & Reasoning Posted!',
        message: `Your ${selectedOutcome} pick with tactical reasoning was shared with the community.`,
      });
    } finally {
      setSubmittingPick(false);
    }
  };

  // Compile combined community picks (including user's local pick if submitted)
  const allPicks: GamblerPick[] = useMemo(() => {
    const list = [...(consensus.picks || [])];
    if (myPickRecord && !list.some((p) => p.username === username)) {
      list.unshift({
        id: `user-pick-${roomId}-${match.id}`,
        username,
        pick: myPickRecord.pick,
        reasoning: myPickRecord.reasoning,
        conviction: myPickRecord.conviction || 'Banker',
        likes: 0,
        timeAgo: myPickRecord.updatedAt,
        colorSeed: username.length * 11,
      });
    }
    return list;
  }, [consensus.picks, myPickRecord, username, roomId, match.id]);

  return (
    <div
      className={`bg-white border rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3.5 transition-all shadow-xs hover:shadow-md ${
        isLive ? 'border-red-300 ring-1 ring-red-400/20' : 'border-[#E6E6D2] hover:border-[#006C54]/40'
      }`}
    >
      <div>
        {/* Card Header: League & Status */}
        <div className="flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-500 pb-2 border-b border-[#F0F0E4] mb-3">
          <div className="flex items-center gap-1.5 truncate">
            {sportDetail?.competition_logo && (
              <img
                src={sportDetail.competition_logo}
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
              />
            )}
            <span className="truncate text-slate-800 font-bold max-w-[170px] sm:max-w-none">
              {match.competition} {match.country ? `· ${match.country}` : ''}
            </span>
          </div>

          {scorePres.isLive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-300 animate-pulse shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
              {scorePres.badgeText}
            </span>
          ) : scorePres.badgeVariant === 'halftime' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
              HT · Half Time
            </span>
          ) : scorePres.badgeVariant === 'finished' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-300 shrink-0 font-mono">
              FT
            </span>
          ) : scorePres.isPostponedOrCancelled ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 shrink-0 uppercase tracking-wider">
              {scorePres.badgeText}
            </span>
          ) : (
            <span className="flex items-center gap-1 shrink-0 text-slate-500 font-mono text-[11px]">
              <Clock size={11} className="text-slate-400" />
              {scorePres.badgeText}
            </span>
          )}
        </div>

        {/* Team Names, Logos & Live/FT Score */}
        <Link to={`/free/${match.id}`} className="block group">
          <div className="space-y-2">
            {/* Home Team */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 truncate">
                {match.homeLogo || sportDetail?.home_logo ? (
                  <img
                    src={match.homeLogo || sportDetail?.home_logo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 object-contain shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] flex items-center justify-center font-bold shrink-0">
                    {match.home.charAt(0)}
                  </div>
                )}
                <span className="font-display font-extrabold text-sm text-slate-900 group-hover:text-[#006C54] transition-colors truncate">
                  {match.home}
                </span>
              </div>
              {scorePres.shouldShowScore && (
                <span className="font-mono font-black text-sm text-slate-900 shrink-0">
                  {scorePres.homeScoreDisplay}
                </span>
              )}
            </div>

            {/* Away Team */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 truncate">
                {match.awayLogo || sportDetail?.away_logo ? (
                  <img
                    src={match.awayLogo || sportDetail?.away_logo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 object-contain shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] flex items-center justify-center font-bold shrink-0">
                    {match.away.charAt(0)}
                  </div>
                )}
                <span className="font-display font-extrabold text-sm text-slate-900 group-hover:text-[#006C54] transition-colors truncate">
                  {match.away}
                </span>
              </div>
              {scorePres.shouldShowScore && (
                <span className="font-mono font-black text-sm text-slate-900 shrink-0">
                  {scorePres.awayScoreDisplay}
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Punter Engagement Counter */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mt-2.5">
          <span className="flex items-center gap-1.5">
            <Users size={12} className="text-[#006C54] shrink-0" />
            <span className="truncate">{consensus.totalVotes.toLocaleString()} punters analyzing</span>
          </span>
          {sportDetail?.home_ht_score !== undefined && sportDetail?.home_ht_score !== null && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              HT {sportDetail.home_ht_score} - {sportDetail.away_ht_score}
            </span>
          )}
        </div>

        {/* 1X2 Market Odds Grid (Decoupled Odds Engine — Ready for Odds Providers) */}
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-1">
            <span>1X2 Market Odds</span>
            <span className="text-[9px] font-mono lowercase text-slate-400">click to add slip</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
            <button
              type="button"
              onClick={(e) => onToggleLeg('Match Result (1X2)', `${match.home} Win (1)`, hOdds, e)}
              className={`rounded-xl py-1.5 px-1 border transition-all duration-150 active:scale-[0.98] min-h-[40px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                isHomeSelected
                  ? 'bg-[#006C54] text-white font-black border-[#005441] shadow-xs'
                  : 'bg-[#FFFFF0] hover:bg-[#F5F5E4] text-slate-800 border-[#E6E6D2] hover:border-[#006C54]'
              }`}
            >
              <span className={`text-[8.5px] font-black uppercase tracking-wider leading-none ${isHomeSelected ? 'text-white/80' : 'text-slate-500'}`}>1</span>
              <span className={`font-black text-xs sm:text-sm ${isHomeSelected ? 'text-white' : 'text-slate-900'}`}>{hOdds.toFixed(2)}</span>
            </button>

            <button
              type="button"
              onClick={(e) => onToggleLeg('Match Result (1X2)', 'Draw (X)', dOdds, e)}
              className={`rounded-xl py-1.5 px-1 border transition-all duration-150 active:scale-[0.98] min-h-[40px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                isDrawSelected
                  ? 'bg-[#006C54] text-white font-black border-[#005441] shadow-xs'
                  : 'bg-[#FFFFF0] hover:bg-[#F5F5E4] text-slate-800 border-[#E6E6D2] hover:border-[#006C54]'
              }`}
            >
              <span className={`text-[8.5px] font-black uppercase tracking-wider leading-none ${isDrawSelected ? 'text-white/80' : 'text-slate-500'}`}>X</span>
              <span className={`font-black text-xs sm:text-sm ${isDrawSelected ? 'text-white' : 'text-slate-900'}`}>{dOdds.toFixed(2)}</span>
            </button>

            <button
              type="button"
              onClick={(e) => onToggleLeg('Match Result (1X2)', `${match.away} Win (2)`, aOdds, e)}
              className={`rounded-xl py-1.5 px-1 border transition-all duration-150 active:scale-[0.98] min-h-[40px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                isAwaySelected
                  ? 'bg-[#006C54] text-white font-black border-[#005441] shadow-xs'
                  : 'bg-[#FFFFF0] hover:bg-[#F5F5E4] text-slate-800 border-[#E6E6D2] hover:border-[#006C54]'
              }`}
            >
              <span className={`text-[8.5px] font-black uppercase tracking-wider leading-none ${isAwaySelected ? 'text-white/80' : 'text-slate-500'}`}>2</span>
              <span className={`font-black text-xs sm:text-sm ${isAwaySelected ? 'text-white' : 'text-slate-900'}`}>{aOdds.toFixed(2)}</span>
            </button>
          </div>
        </div>

        {/* Consensus Split Progress Bar */}
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1 font-bold">
            <span className="flex items-center gap-1">
              <Flame size={11} className="text-[#006C54]" /> Consensus: <strong className="text-slate-900">{majLabel}</strong>
            </span>
            <span className="font-mono text-slate-800">{majority}%</span>
          </div>
          <div className="w-full bg-[#E6E6D2] rounded-full h-1.5 flex overflow-hidden">
            <div style={{ width: `${consensus.homePct}%` }} className="bg-[#006C54] transition-all duration-500" title={`Home: ${consensus.homePct}%`} />
            <div style={{ width: `${consensus.drawPct}%` }} className="bg-[#EEAA04] transition-all duration-500" title={`Draw: ${consensus.drawPct}%`} />
            <div style={{ width: `${consensus.awayPct}%` }} className="bg-rose-500 transition-all duration-500" title={`Away: ${consensus.awayPct}%`} />
          </div>
        </div>

        {/* =========================================================================
            FEATURE FUNCTIONALITY TAB BUTTONS (SportScore Feature Suite & Comment UI)
            ========================================================================= */}
        <div className="mt-3.5 pt-3 border-t border-[#F0F0E4]">
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 scrollbar-none text-[11px] font-bold">
            {/* Tab: Reasoning & Tips */}
            <button
              type="button"
              onClick={() => handleTabToggle('reasoning')}
              className={`px-2.5 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                activeTab === 'reasoning'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'bg-[#FFFFF0] text-slate-700 border border-[#E6E6D2] hover:border-[#006C54]'
              }`}
            >
              <span>💬 Reasoning</span>
              {myPickRecord ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              ) : (
                <span className="text-[10px] font-mono opacity-80">({allPicks.length})</span>
              )}
            </button>

            {/* Tab: Match Details */}
            <button
              type="button"
              onClick={() => handleTabToggle('details')}
              className={`px-2.5 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                activeTab === 'details'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'bg-[#FFFFF0] text-slate-700 border border-[#E6E6D2] hover:border-[#006C54]'
              }`}
            >
              <Activity size={11} />
              <span>Details</span>
            </button>

            {/* Tab: Lineups */}
            <button
              type="button"
              onClick={() => handleTabToggle('lineups')}
              className={`px-2.5 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                activeTab === 'lineups'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'bg-[#FFFFF0] text-slate-700 border border-[#E6E6D2] hover:border-[#006C54]'
              }`}
            >
              <Shirt size={11} />
              <span>Lineups</span>
              {sportDetail?.lineups?.confirmed && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Confirmed XI" />
              )}
            </button>

            {/* Tab: Timeline / Incidents */}
            <button
              type="button"
              onClick={() => handleTabToggle('timeline')}
              className={`px-2.5 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                activeTab === 'timeline'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'bg-[#FFFFF0] text-slate-700 border border-[#E6E6D2] hover:border-[#006C54]'
              }`}
            >
              <Clock size={11} />
              <span>Timeline</span>
              {sportDetail?.incidents && sportDetail.incidents.length > 0 && (
                <span className="text-[10px] font-mono opacity-80">({sportDetail.incidents.length})</span>
              )}
            </button>

            {/* Tab: Standings */}
            <button
              type="button"
              onClick={() => handleTabToggle('standings')}
              className={`px-2.5 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                activeTab === 'standings'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'bg-[#FFFFF0] text-slate-700 border border-[#E6E6D2] hover:border-[#006C54]'
              }`}
            >
              <ListOrdered size={11} />
              <span>Table</span>
            </button>

            {/* Tab: Live Tracker (prominent for live games or when tracker ID exists) */}
            {(isLive || sportDetail?.tracker) && (
              <button
                type="button"
                onClick={() => handleTabToggle('tracker')}
                className={`px-2.5 py-1 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                  activeTab === 'tracker'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-red-50 text-red-700 border border-red-200 hover:border-red-400'
                }`}
              >
                <Radio size={11} className="animate-pulse" />
                <span>Pitch Tracker</span>
              </button>
            )}
          </div>
        </div>

        {/* =========================================================================
            DRAWER CONTENT PANELS
            ========================================================================= */}
        {activeTab && (
          <div className="mt-3 p-3 bg-[#FFFFF0] border border-[#E6E6D2] rounded-xl text-xs space-y-3 animate-fadeIn">
            
            {/* 1. REASONING & COMMUNITY TIPS DRAWER */}
            {activeTab === 'reasoning' && (
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="font-extrabold uppercase tracking-wider text-[10px] text-slate-500">
                    Punter Reasoning &amp; Tips
                  </span>
                  {myPickRecord && !isEditingPick && (
                    <button
                      type="button"
                      onClick={() => setIsEditingPick(true)}
                      className="text-[10px] font-bold text-[#006C54] hover:underline cursor-pointer"
                    >
                      Edit My Pick ({2 - myPickRecord.editCount} left)
                    </button>
                  )}
                </div>

                {/* Pick Submission Form (Restored Comment UI Reasoning Text Box) */}
                {(!myPickRecord || isEditingPick) && (
                  <form onSubmit={handlePostReasoning} className="space-y-2.5 bg-white p-3 rounded-lg border border-[#E6E6D2]">
                    <div className="text-[10px] font-black uppercase text-slate-500">
                      1. Select Your Outcome Pick:
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center font-bold">
                      {(['1', 'X', '2'] as Outcome[]).map((o) => (
                        <button
                          key={o}
                          type="button"
                          onClick={() => setSelectedOutcome(o)}
                          className={`py-1 rounded-lg border text-xs cursor-pointer transition-colors ${
                            selectedOutcome === o
                              ? 'bg-[#006C54] text-white border-[#005441] font-black'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {o === '1' ? `${match.home} (1)` : o === 'X' ? 'Draw (X)' : `${match.away} (2)`}
                        </button>
                      ))}
                    </div>

                    <div className="text-[10px] font-black uppercase text-slate-500">
                      2. Conviction Level:
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
                      {[
                        { id: 'Banker', label: '🔥 Banker' },
                        { id: 'Value Pick', label: '💎 Value' },
                        { id: 'Long Shot', label: '🎲 Long Shot' }
                      ].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedConviction(c.id as Conviction)}
                          className={`py-1 rounded-lg border cursor-pointer transition-colors ${
                            selectedConviction === c.id
                              ? 'bg-[#EEAA04] text-slate-900 border-[#C98E00] font-black'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    <div className="text-[10px] font-black uppercase text-slate-500">
                      3. Tactical Reasoning:
                    </div>
                    <textarea
                      value={reasoningInput}
                      onChange={(e) => setReasoningInput(e.target.value)}
                      placeholder="Share your reasoning (e.g. key injuries, head-to-head form, home dominance, tactical lineup matchups)..."
                      rows={3}
                      className="w-full bg-[#FFFFF0] border border-[#D4D4C0] focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] rounded-lg p-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    />

                    {formError && (
                      <div className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                        <AlertCircle size={12} /> {formError}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400 font-mono">
                        {reasoningInput.length} chars (min 10)
                      </span>
                      <div className="flex items-center gap-2">
                        {isEditingPick && (
                          <button
                            type="button"
                            onClick={() => setIsEditingPick(false)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={submittingPick || reasoningInput.trim().length < 10}
                          className="px-3 py-1 bg-[#006C54] hover:bg-[#005441] disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-wider rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Send size={11} />
                          <span>{submittingPick ? 'Posting...' : 'Post Reasoning'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {/* Display Current User Pick if posted */}
                {myPickRecord && !isEditingPick && (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-[#006C54] inline-flex items-center gap-1 uppercase text-[10px]">
                        <CheckCircle2 size={12} /> Your Saved Pick: {myPickRecord.pick} ({myPickRecord.conviction})
                      </span>
                      <span className="text-[10px] text-slate-400">{myPickRecord.updatedAt}</span>
                    </div>
                    <p className="text-slate-700 italic leading-relaxed">{myPickRecord.reasoning}</p>
                  </div>
                )}

                {/* Community Picks List */}
                <div className="space-y-2 pt-2 border-t border-[#E6E6D2]">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">
                    Community Punter Comments ({allPicks.length})
                  </span>
                  {allPicks.length === 0 ? (
                    <div className="text-center py-3 text-slate-500 text-xs">
                      Be the first punter to post reasoning on this fixture!
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {allPicks.map((p) => {
                        const liked = isPickLiked(p.id);
                        const extra = getExtraLikes(p.id);
                        const totalLikes = p.likes + extra;

                        return (
                          <div
                            key={p.id}
                            className="bg-white border border-[#E6E6D2] rounded-lg p-2 text-xs flex flex-col gap-1 shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Avatar name={p.username} seed={p.colorSeed} size={22} showBorder={false} />
                                <span className="font-bold text-slate-800 text-[11px]">{p.username}</span>
                                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-[#006C54]/10 text-[#006C54]">
                                  {p.pick}
                                </span>
                                <span className="text-[9.5px] font-semibold text-slate-400">
                                  {p.conviction}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400">{p.timeAgo}</span>
                            </div>

                            <p className="text-slate-700 text-[11px] leading-relaxed pl-7">
                              {p.reasoning}
                            </p>

                            <div className="flex items-center justify-end pl-7 pt-0.5">
                              <button
                                type="button"
                                onClick={() => toggleLikePick(p.id)}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                                  liked
                                    ? 'bg-rose-50 text-rose-600'
                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <ThumbsUp size={11} className={liked ? 'fill-rose-600' : ''} />
                                <span>{totalLikes}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. MATCH DETAILS DRAWER */}
            {activeTab === 'details' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between font-black uppercase text-[10px] text-slate-500">
                  <span>Match Details</span>
                  <a
                    href="https://sportscore.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9.5px] text-[#006C54] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Powered by SportScore</span>
                    <ExternalLink size={9} />
                  </a>
                </div>

                {isLoadingDetail ? (
                  <div className="py-4 text-center text-slate-400 animate-pulse font-mono text-[11px]">
                    Loading match intelligence...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-white p-2 rounded-lg border border-[#E6E6D2]">
                      <span className="text-slate-400 font-semibold block text-[10px]">Status</span>
                      <span className="font-bold text-slate-900">
                        {sportDetail?.status_text || match.status?.toUpperCase() || 'Upcoming'}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-[#E6E6D2]">
                      <span className="text-slate-400 font-semibold block text-[10px]">Kickoff (EAT)</span>
                      <span className="font-bold text-slate-900">{match.kickoff}</span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-[#E6E6D2]">
                      <span className="text-slate-400 font-semibold block text-[10px]">Venue</span>
                      <span className="font-bold text-slate-900">
                        {sportDetail?.venue || 'Main Stadium'}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-[#E6E6D2]">
                      <span className="text-slate-400 font-semibold block text-[10px]">Halftime Breakdown</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {sportDetail?.home_ht_score !== undefined && sportDetail?.home_ht_score !== null
                          ? `${sportDetail.home_ht_score} - ${sportDetail.away_ht_score}`
                          : 'Pending kickoff'}
                      </span>
                    </div>

                    {sportDetail?.referee && (
                      <div className="col-span-2 bg-white p-2 rounded-lg border border-[#E6E6D2]">
                        <span className="text-slate-400 font-semibold block text-[10px]">Match Referee</span>
                        <span className="font-bold text-slate-900">{sportDetail.referee}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3. LINEUPS DRAWER */}
            {activeTab === 'lineups' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between font-black uppercase text-[10px] text-slate-500">
                  <span>Tactical Formations &amp; Starting XI</span>
                  <a
                    href="https://sportscore.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9.5px] text-[#006C54] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Powered by SportScore</span>
                    <ExternalLink size={9} />
                  </a>
                </div>

                {isLoadingDetail ? (
                  <div className="py-4 text-center text-slate-400 animate-pulse font-mono text-[11px]">
                    Querying team rosters &amp; lineups...
                  </div>
                ) : sportDetail?.lineups?.home_xi && sportDetail.lineups.home_xi.length > 0 ? (
                  <div className="space-y-3">
                    {/* Formations badge */}
                    <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-[#E6E6D2] font-mono text-xs font-bold text-slate-800">
                      <span>{match.home}: {sportDetail.lineups.home_formation || '4-3-3'}</span>
                      <span className="text-slate-400 text-[10px]">vs</span>
                      <span>{match.away}: {sportDetail.lineups.away_formation || '4-4-2'}</span>
                    </div>

                    {/* Starting XI 2-Column Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {/* Home XI */}
                      <div className="bg-white p-2 rounded-lg border border-[#E6E6D2]">
                        <div className="font-black text-[#006C54] uppercase text-[10px] mb-1.5 pb-1 border-b border-slate-100">
                          {match.home} Starting XI
                        </div>
                        <div className="space-y-1">
                          {sportDetail.lineups.home_xi.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between text-slate-700">
                              <span className="flex items-center gap-1 truncate">
                                <span className="font-mono text-slate-400 text-[10px] w-4">{p.number || idx + 1}</span>
                                <span className="truncate font-medium">{p.name}</span>
                              </span>
                              <span className="text-[9px] font-mono font-bold text-slate-400 px-1 bg-slate-50 rounded">
                                {p.position || 'M'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Away XI */}
                      <div className="bg-white p-2 rounded-lg border border-[#E6E6D2]">
                        <div className="font-black text-slate-800 uppercase text-[10px] mb-1.5 pb-1 border-b border-slate-100">
                          {match.away} Starting XI
                        </div>
                        <div className="space-y-1">
                          {sportDetail.lineups.away_xi?.map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between text-slate-700">
                              <span className="flex items-center gap-1 truncate">
                                <span className="font-mono text-slate-400 text-[10px] w-4">{p.number || idx + 1}</span>
                                <span className="truncate font-medium">{p.name}</span>
                              </span>
                              <span className="text-[9px] font-mono font-bold text-slate-400 px-1 bg-slate-50 rounded">
                                {p.position || 'M'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-lg border border-[#E6E6D2] text-center space-y-1.5">
                    <Shirt size={22} className="mx-auto text-slate-400" />
                    <p className="font-bold text-slate-800 text-xs">Official Lineups Not Yet Announced</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                      Confirmed starting XI and substitutes are released by team managers approximately 60 minutes before kickoff.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 4. TIMELINE / INCIDENTS DRAWER */}
            {activeTab === 'timeline' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between font-black uppercase text-[10px] text-slate-500">
                  <span>Match Incidents &amp; Key Events</span>
                  <a
                    href="https://sportscore.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9.5px] text-[#006C54] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Powered by SportScore</span>
                    <ExternalLink size={9} />
                  </a>
                </div>

                {isLoadingDetail ? (
                  <div className="py-4 text-center text-slate-400 animate-pulse font-mono text-[11px]">
                    Loading match timeline...
                  </div>
                ) : sportDetail?.incidents && sportDetail.incidents.length > 0 ? (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {sportDetail.incidents.map((inc, i) => {
                      const isGoal = inc.is_goal || inc.type.toLowerCase().includes('goal');
                      const isCard = inc.is_card || inc.type.toLowerCase().includes('card');
                      const isHome = inc.side === 'home';

                      return (
                        <div
                          key={i}
                          className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                            isGoal
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 font-bold'
                              : isCard
                              ? 'bg-amber-50/60 border-amber-200 text-slate-800'
                              : 'bg-white border-[#E6E6D2] text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-[10px] px-1.5 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700">
                              {inc.time}&apos;
                            </span>
                            <span>
                              {isGoal ? '⚽ Goal' : isCard ? '🟨 Card' : inc.type}
                              {inc.player ? `: ${inc.player}` : ''}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {isHome ? match.home : match.away}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-lg border border-[#E6E6D2] text-center text-slate-500 text-xs">
                    No timeline incidents recorded yet. Live events (goals, cards, VAR) stream in real-time as the match progresses.
                  </div>
                )}
              </div>
            )}

            {/* 5. STANDINGS DRAWER */}
            {activeTab === 'standings' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between font-black uppercase text-[10px] text-slate-500">
                  <span>League Table Standings</span>
                  <a
                    href="https://sportscore.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9.5px] text-[#006C54] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Powered by SportScore</span>
                    <ExternalLink size={9} />
                  </a>
                </div>

                {isLoadingStandings ? (
                  <div className="py-4 text-center text-slate-400 animate-pulse font-mono text-[11px]">
                    Fetching league table standings...
                  </div>
                ) : standings?.tables?.[0]?.rows ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead>
                        <tr className="border-b border-[#E6E6D2] text-slate-400 text-[10px]">
                          <th className="py-1 pr-1 font-bold">#</th>
                          <th className="py-1 font-bold">Team</th>
                          <th className="py-1 text-center font-bold">P</th>
                          <th className="py-1 text-center font-bold">W</th>
                          <th className="py-1 text-center font-bold">D</th>
                          <th className="py-1 text-center font-bold">L</th>
                          <th className="py-1 text-center font-bold">GD</th>
                          <th className="py-1 text-right font-bold text-slate-900">PTS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F0E4]">
                        {standings.tables[0].rows.slice(0, 10).map((row) => {
                          const isMatchTeam =
                            row.team.toLowerCase().includes(match.home.toLowerCase()) ||
                            row.team.toLowerCase().includes(match.away.toLowerCase());

                          return (
                            <tr
                              key={row.pos}
                              className={`transition-colors ${
                                isMatchTeam ? 'bg-[#006C54]/10 font-black text-slate-900' : 'text-slate-700 hover:bg-[#F5F5E4]'
                              }`}
                            >
                              <td className="py-1 pr-1 font-bold text-slate-500">{row.pos}</td>
                              <td className="py-1 truncate max-w-[120px] font-sans font-semibold">
                                {row.team}
                              </td>
                              <td className="py-1 text-center text-slate-500">{row.p}</td>
                              <td className="py-1 text-center text-slate-600">{row.w}</td>
                              <td className="py-1 text-center text-slate-600">{row.d}</td>
                              <td className="py-1 text-center text-slate-600">{row.l}</td>
                              <td className="py-1 text-center text-slate-500">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                              <td className="py-1 text-right font-black text-slate-900">{row.pts}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bg-white p-3 rounded-lg border border-[#E6E6D2] text-center text-slate-500 text-xs">
                    League standings table will update as matchday rounds complete.
                  </div>
                )}
              </div>
            )}

            {/* 6. LIVE PITCH TRACKER DRAWER */}
            {activeTab === 'tracker' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between font-black uppercase text-[10px] text-slate-500">
                  <span className="flex items-center gap-1.5 text-red-600">
                    <Radio size={12} className="animate-pulse" /> Live 2D Match Tracker
                  </span>
                  <a
                    href="https://sportscore.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9.5px] text-[#006C54] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Powered by SportScore</span>
                    <ExternalLink size={9} />
                  </a>
                </div>

                {sportDetail?.tracker?.id ? (
                  <div className="rounded-xl overflow-hidden border border-[#E6E6D2] bg-slate-950 aspect-video w-full">
                    <iframe
                      src={`https://sportscore.com/api/widget/tracker/?sport=football&id=${sportDetail.tracker.id}`}
                      title="Live Match Tracker"
                      className="w-full h-full border-0"
                      allow="autoplay"
                    />
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-lg border border-[#E6E6D2] text-center space-y-1.5">
                    <Activity size={24} className="mx-auto text-red-500 animate-pulse" />
                    <p className="font-bold text-slate-800 text-xs">Live Pitch Visualizer Standing By</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed max-w-sm mx-auto">
                      Real-time 2D pitch coordinates, momentum, and ball attacks activate automatically once the match is in-play.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Footer: Room Discussion Link & Bet Builder Button */}
      <div className="pt-2 border-t border-[#F0F0E4] flex items-center justify-between gap-2">
        <Link
          to={`/free/${match.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#006C54] hover:text-[#005441] transition-colors"
        >
          <span>Full Room Discussion</span>
          <ArrowRight size={12} />
        </Link>

        <button
          type="button"
          onClick={() => onOpenBetBuilder({
            id: match.id,
            home: match.home,
            away: match.away,
            competition: match.competition,
            kickoff: match.kickoff,
            homeOdds: hOdds,
            drawOdds: dOdds,
            awayOdds: aOdds,
            bookmaker: match.bookmaker,
          })}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-[#FFFFF0] hover:bg-[#F5F5E4] border border-[#E6E6D2] px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
        >
          <Dices size={12} className="text-[#EEAA04]" />
          <span>Bet Builder</span>
        </button>
      </div>
    </div>
  );
}
