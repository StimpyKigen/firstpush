import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock, Users, Flame, Dices, ArrowRight
} from 'lucide-react';
import type { FreeMatch } from '../lib/freeMatches';
import type { MatchConsensus } from '../lib/types';
import { getMatchScorePresentation } from '../lib/matchStatus';
import { formatKickoffDateTime24h } from '../lib/competitionPriority';
import { getCompetitionBanner } from '../lib/competitionBanners';
import { useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';

export interface CardNotificationEvent {
  id: string;
  side: 'home' | 'away';
  type: 'goal' | 'yellow_card' | 'red_card';
  player: string;
  minute?: number | string;
}

interface FixtureSportCardProps {
  match: FreeMatch;
  consensus: MatchConsensus;
  builderLegs: any[];
  onToggleLeg: (market: string, pick: string, odds: number, e: React.MouseEvent) => void;
  onOpenBetBuilder: (match: any) => void;
}

export default function FixtureSportCard({
  match,
  consensus,
  builderLegs,
  onToggleLeg,
  onOpenBetBuilder,
}: FixtureSportCardProps) {
  const currentUser = useCurrentUser();
  const openAuthWall = useAuthWallStore((s) => s.openAuthWall);

  // Competition background banner (e.g. UEFA Champions League)
  const banner = getCompetitionBanner(match.competition, match.competitionId, match.country);

  // Quick Bet Builder selection states
  const isHomeSelected = builderLegs.some(
    (l) => l.matchId === match.id && l.market === 'Match Result (1X2)' && l.pick.includes('1')
  );
  const isDrawSelected = builderLegs.some(
    (l) => l.matchId === match.id && l.market === 'Match Result (1X2)' && l.pick.includes('Draw')
  );
  const isAwaySelected = builderLegs.some(
    (l) => l.matchId === match.id && l.market === 'Match Result (1X2)' && l.pick.includes('2')
  );

  const hOdds = match.homeOdds || 2.10;
  const dOdds = match.drawOdds || 3.30;
  const aOdds = match.awayOdds || 3.60;

  // Score glow states (glowing black for 10 seconds when score changes)
  const [isHomeScoreGlowing, setIsHomeScoreGlowing] = useState(false);
  const [isAwayScoreGlowing, setIsAwayScoreGlowing] = useState(false);
  const prevHomeScoreRef = useRef<number | null | undefined>(match.homeScore);
  const prevAwayScoreRef = useRef<number | null | undefined>(match.awayScore);
  const homeScoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awayScoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sequential event queue for goalscorer and card notifications (10 seconds each, FIFO, non-overlapping)
  const [eventQueue, setEventQueue] = useState<CardNotificationEvent[]>([]);
  const [activeNotification, setActiveNotification] = useState<CardNotificationEvent | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenIncidentKeysRef = useRef<Set<string>>(new Set());
  const isFirstMountRef = useRef(true);

  // Sequential FIFO Queue Runner
  // When activeNotification is null and eventQueue has items:
  // pop the first item, display it for 10 seconds, then clear.
  // The earlier event completes its full 10 seconds before the next one starts.
  useEffect(() => {
    if (!activeNotification && eventQueue.length > 0) {
      const nextNotification = eventQueue[0];
      setEventQueue((prev) => prev.slice(1));
      setActiveNotification(nextNotification);

      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }

      notificationTimerRef.current = setTimeout(() => {
        setActiveNotification(null);
      }, 10000);
    }
  }, [activeNotification, eventQueue]);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      if (homeScoreTimerRef.current) clearTimeout(homeScoreTimerRef.current);
      if (awayScoreTimerRef.current) clearTimeout(awayScoreTimerRef.current);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, []);

  // Score Change & Goalscorer Detection
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevHomeScoreRef.current = match.homeScore;
      prevAwayScoreRef.current = match.awayScore;
      // Pre-seed seen incidents so historic events don't spam 10s notifications on mount
      if (match.incidents && Array.isArray(match.incidents)) {
        for (const inc of match.incidents) {
          const key = inc.id || `${inc.type}_${inc.time || inc.minute}_${inc.side || inc.teamSide}_${inc.player || ''}`;
          seenIncidentKeysRef.current.add(key);
        }
      }
      return;
    }

    const prevHome = prevHomeScoreRef.current;
    const currentHome = match.homeScore;
    if (typeof currentHome === 'number' && typeof prevHome === 'number' && currentHome > prevHome) {
      setIsHomeScoreGlowing(true);
      if (homeScoreTimerRef.current) clearTimeout(homeScoreTimerRef.current);
      homeScoreTimerRef.current = setTimeout(() => {
        setIsHomeScoreGlowing(false);
      }, 10000);

      const scorer = match.latestGoalscorer || (match as any).homeScorer;
      if (scorer) {
        const goalEvent: CardNotificationEvent = {
          id: `goal_home_${currentHome}_${Date.now()}`,
          side: 'home',
          type: 'goal',
          player: scorer,
        };
        setEventQueue((prev) => [...prev, goalEvent]);
      }
    }
    prevHomeScoreRef.current = currentHome;

    const prevAway = prevAwayScoreRef.current;
    const currentAway = match.awayScore;
    if (typeof currentAway === 'number' && typeof prevAway === 'number' && currentAway > prevAway) {
      setIsAwayScoreGlowing(true);
      if (awayScoreTimerRef.current) clearTimeout(awayScoreTimerRef.current);
      awayScoreTimerRef.current = setTimeout(() => {
        setIsAwayScoreGlowing(false);
      }, 10000);

      const scorer = match.latestGoalscorer || (match as any).awayScorer;
      if (scorer) {
        const goalEvent: CardNotificationEvent = {
          id: `goal_away_${currentAway}_${Date.now()}`,
          side: 'away',
          type: 'goal',
          player: scorer,
        };
        setEventQueue((prev) => [...prev, goalEvent]);
      }
    }
    prevAwayScoreRef.current = currentAway;
  }, [match.homeScore, match.awayScore, match.latestGoalscorer]);

  // Timeline Incidents Ingestion (Goals, Yellow & Red Cards)
  useEffect(() => {
    if (!match.incidents || !Array.isArray(match.incidents) || isFirstMountRef.current) {
      return;
    }

    const newEvents: CardNotificationEvent[] = [];
    for (const inc of match.incidents) {
      const incKey = inc.id || `${inc.type}_${inc.time || inc.minute}_${inc.side || inc.teamSide}_${inc.player || ''}`;
      if (seenIncidentKeysRef.current.has(incKey)) {
        continue;
      }
      seenIncidentKeysRef.current.add(incKey);

      const rawType = (inc.type || '').toLowerCase();
      const isGoal = inc.is_goal || rawType.includes('goal');
      const isRed = rawType.includes('red') || inc.cardType === 'red';
      const isYellow = rawType.includes('yellow') || inc.cardType === 'yellow' || inc.is_card;
      const side = (inc.side || inc.teamSide || 'home') === 'away' ? 'away' : 'home';
      const player = inc.player || (inc as any).name;

      if (!player) continue;

      if (isGoal) {
        newEvents.push({
          id: incKey,
          side,
          type: 'goal',
          player,
          minute: inc.time || inc.minute,
        });
      } else if (isRed) {
        newEvents.push({
          id: incKey,
          side,
          type: 'red_card',
          player,
          minute: inc.time || inc.minute,
        });
      } else if (isYellow) {
        newEvents.push({
          id: incKey,
          side,
          type: 'yellow_card',
          player,
          minute: inc.time || inc.minute,
        });
      }
    }

    if (newEvents.length > 0) {
      setEventQueue((prev) => [...prev, ...newEvents]);
    }
  }, [match.incidents]);

  // External / Polling Custom Event Bus for Match Incidents
  useEffect(() => {
    const handleMatchIncident = (e: Event) => {
      const customEvent = e as CustomEvent<CardNotificationEvent>;
      if (customEvent.detail) {
        setEventQueue((prev) => [...prev, customEvent.detail]);
      }
    };

    window.addEventListener(`match_incident_${match.id}`, handleMatchIncident);
    return () => {
      window.removeEventListener(`match_incident_${match.id}`, handleMatchIncident);
    };
  }, [match.id]);

  // Authoritative status presentation with DD/MM HH:mm in 24h format (without EAT suffix)
  const scorePres = getMatchScorePresentation(
    match.status,
    match.displayClock,
    formatKickoffDateTime24h(match.kickoffIso, match.kickoff, false),
    match.homeScore,
    match.awayScore,
    match.kickoffIso
  );

  const timeDisplay = (scorePres.badgeText || '').replace(/\s*EAT$/i, '').trim();

  const majority = Math.max(consensus.homePct, consensus.drawPct, consensus.awayPct);
  const majLabel =
    majority === consensus.homePct
      ? '1 · Home'
      : majority === consensus.drawPct
      ? 'X · Draw'
      : '2 · Away';

  // Format: [Country] · [League Name] for domestic leagues; un-prefixed for continental tournaments
  const isContinental =
    (match.competitionId && (
      match.competitionId.startsWith('uefa_') ||
      match.competitionId.startsWith('caf_') ||
      match.competitionId.startsWith('afc_') ||
      match.competitionId.startsWith('conmebol_') ||
      match.competitionId.startsWith('concacaf_') ||
      match.competitionId.startsWith('fifa_')
    )) ||
    /^(uefa|caf|afc|conmebol|concacaf|fifa|club world cup|champions league|europa league|conference league|libertadores|sudamericana)/i.test(match.competition || '') ||
    ['europe', 'international clubs', 'international', 'world', 'general'].includes((match.country || '').toLowerCase());

  const hasCountryPrefix = Boolean(match.country && (
    match.competition.toLowerCase().includes(match.country.toLowerCase()) ||
    (match.country.toLowerCase() === 'england' && match.competition.toLowerCase().includes('english')) ||
    (match.country.toLowerCase() === 'spain' && match.competition.toLowerCase().includes('spanish')) ||
    (match.country.toLowerCase() === 'france' && match.competition.toLowerCase().includes('french')) ||
    (match.country.toLowerCase() === 'italy' && match.competition.toLowerCase().includes('italian')) ||
    (match.country.toLowerCase() === 'germany' && match.competition.toLowerCase().includes('german')) ||
    (match.country.toLowerCase() === 'portugal' && match.competition.toLowerCase().includes('portuguese')) ||
    (match.country.toLowerCase() === 'india' && match.competition.toLowerCase().includes('indian'))
  ));

  const leagueDisplayTitle = (!isContinental && match.country && match.country.trim() && match.country.toLowerCase() !== 'general' && !hasCountryPrefix)
    ? `${match.country} · ${match.competition}`
    : match.competition;

  return (
    <div
      className={`group relative overflow-hidden border rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 ${
        banner
          ? `fixture-card-banner ${banner.cardBg || 'bg-gradient-to-b from-[#E3EFFE] via-[#F0F6FE] to-[#FFFFF0]'} ${banner.borderColor || 'border-[#7BA7F8]'} ${banner.borderHoverColor || 'hover:border-[#0A3B8C]'} ${banner.shadow || 'shadow-[0_2px_12px_rgba(10,59,140,0.09)] hover:shadow-[0_4px_18px_rgba(10,59,140,0.16)]'}`
          : 'bg-[#FFFFF0] dark:bg-[#2A312D] border-[#DCDCC8] dark:border-[#414A43] hover:border-[#006C54]/50 dark:hover:border-[#66CF11]/50 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_14px_rgba(0,108,84,0.08)]'
      }`}
    >
      {/* Dynamic Faded Competition Background Banner */}
      {banner && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-0"
          aria-hidden="true"
        >
          {/* Subtle rich competition base tint */}
          <div className={`absolute inset-0 ${banner.baseTint || 'bg-gradient-to-b from-[#0A3B8C]/12 via-[#0A3B8C]/4 to-transparent'}`} />
          {/* Banner Artwork gracefully scaled for desktop & mobile */}
          <img
            src={banner.bannerUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover ${banner.objectPosition || 'object-[right_top]'} scale-100 transition-transform duration-700 ease-out group-hover:scale-105`}
            style={{
              opacity: banner.overlayOpacity ?? 0.32,
            }}
          />
          {/* Soft gradient wash to seamlessly blend artwork into the warm ivory base */}
          <div
            className={`absolute inset-0 bg-gradient-to-b ${banner.gradientOverlay || 'from-transparent via-[#EDF4FE]/20 to-[#FFFFF0]/35'}`}
          />
        </div>
      )}

      <div className="relative z-10">
        {/* Card Header: League Info & Kickoff/Score Badge */}
        <div className="flex items-center justify-between gap-2 mb-3 text-xs">
          <div className="min-w-0">
            <span className="t-label truncate block font-semibold text-slate-800">
              {leagueDisplayTitle}
            </span>
          </div>

          {scorePres.badgeVariant === 'halftime' ? (
            <span className="text-[13px] font-bold text-red-600 [text-shadow:0_0_8px_rgba(220,38,38,0.85)] animate-pulse shrink-0 tracking-wide select-none">
              HT
            </span>
          ) : scorePres.isLive ? (
            <span className="text-[13px] font-bold text-red-600 [text-shadow:0_0_8px_rgba(220,38,38,0.85)] animate-pulse tabular-nums shrink-0 tracking-wide select-none">
              {scorePres.badgeText}
            </span>
          ) : scorePres.badgeVariant === 'finished' ? (
            <span className="text-[13px] font-bold text-black shrink-0 tracking-wide select-none">
              FT
            </span>
          ) : scorePres.isPostponedOrCancelled ? (
            <span className="text-[12px] font-medium text-rose-600 shrink-0 select-none">
              {scorePres.badgeText}
            </span>
          ) : (
            <span className="t-meta flex items-center gap-1 shrink-0 text-slate-700 font-semibold select-none">
              <Clock size={11} className="text-slate-400" />
              {timeDisplay}
            </span>
          )}
        </div>

        {/* Team Names, Logos & Live/FT Score */}
        <Link
          to={`/free/${match.id}`}
          onClick={(e) => {
            if (!currentUser) {
              e.preventDefault();
              openAuthWall({
                actionType: 'details',
                title: 'Sign In for Details & Discussions',
                message: 'Sign up or log in to view match intelligence, tactical lineups, pitch tracker, and join live fan discussions.',
              });
            }
          }}
          className="block group"
        >
          <div className="space-y-2">
            {/* Home Team */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 truncate">
                {match.homeLogo && (
                  <img
                    src={match.homeLogo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 object-contain shrink-0"
                  />
                )}
                <span className="t-team group-hover:text-[#006C54] transition-colors truncate">
                  {match.home}
                </span>
              </div>
              <div className="flex flex-col items-end shrink-0 min-w-[2ch]">
                {scorePres.shouldShowScore && (
                  <span
                    className={`t-score text-right transition-all duration-300 ${
                      isHomeScoreGlowing
                        ? 'text-black [text-shadow:0_0_8px_rgba(0,0,0,0.95),0_0_14px_rgba(0,0,0,0.7)] animate-pulse font-extrabold scale-110'
                        : ''
                    }`}
                  >
                    {scorePres.homeScoreDisplay}
                  </span>
                )}
                {activeNotification?.side === 'home' && (
                  <div className="flex items-center justify-end gap-1 mt-0.5 text-[11px] font-bold text-black [text-shadow:0_0_6px_rgba(0,0,0,0.8),0_0_12px_rgba(0,0,0,0.5)] animate-pulse whitespace-nowrap">
                    {activeNotification.type === 'yellow_card' && (
                      <span className="w-2 h-2.5 bg-amber-400 rounded-[1px] shadow-sm inline-block shrink-0" title="Yellow Card" />
                    )}
                    {activeNotification.type === 'red_card' && (
                      <span className="w-2 h-2.5 bg-red-600 rounded-[1px] shadow-sm inline-block shrink-0" title="Red Card" />
                    )}
                    <span>{activeNotification.player}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Away Team */}
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 min-w-0 truncate">
                {match.awayLogo && (
                  <img
                    src={match.awayLogo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 object-contain shrink-0"
                  />
                )}
                <span className="t-team group-hover:text-[#006C54] transition-colors truncate">
                  {match.away}
                </span>
              </div>
              <div className="flex flex-col items-end shrink-0 min-w-[2ch]">
                {scorePres.shouldShowScore && (
                  <span
                    className={`t-score text-right transition-all duration-300 ${
                      isAwayScoreGlowing
                        ? 'text-black [text-shadow:0_0_8px_rgba(0,0,0,0.95),0_0_14px_rgba(0,0,0,0.7)] animate-pulse font-extrabold scale-110'
                        : ''
                    }`}
                  >
                    {scorePres.awayScoreDisplay}
                  </span>
                )}
                {activeNotification?.side === 'away' && (
                  <div className="flex items-center justify-end gap-1 mt-0.5 text-[11px] font-bold text-black [text-shadow:0_0_6px_rgba(0,0,0,0.8),0_0_12px_rgba(0,0,0,0.5)] animate-pulse whitespace-nowrap">
                    {activeNotification.type === 'yellow_card' && (
                      <span className="w-2 h-2.5 bg-amber-400 rounded-[1px] shadow-sm inline-block shrink-0" title="Yellow Card" />
                    )}
                    {activeNotification.type === 'red_card' && (
                      <span className="w-2 h-2.5 bg-red-600 rounded-[1px] shadow-sm inline-block shrink-0" title="Red Card" />
                    )}
                    <span>{activeNotification.player}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>

        {/* Punter Engagement Counter & Odds Source */}
        <div className="flex items-center justify-between t-meta text-slate-700 mt-2.5">
          <span className="flex items-center gap-1.5 min-w-0">
            <Users size={12} className="text-[#006C54] shrink-0" />
            <span className="truncate">{consensus.totalVotes.toLocaleString()} punters analyzing</span>
          </span>
          {match.bookmaker === 'Bet365' && (
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#006C54]/10 text-[#006C54] border border-[#006C54]/20 tracking-tight" title="Authentic Bet365 Odds">
              <span className="w-1.5 h-1.5 rounded-full bg-[#006C54]" />
              Bet365 Odds
            </span>
          )}
        </div>

        {/* 1X2 Market Odds Grid (Treated like rest of card so banner shows through) */}
        <div className="mt-2.5">
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <button
              type="button"
              onClick={(e) => {
                if (!currentUser) {
                  e.preventDefault();
                  e.stopPropagation();
                  openAuthWall({
                    actionType: 'builder_pick',
                    title: 'Sign In to Make Selections',
                    message: 'Sign up or log in to select market odds and add selections to your Bet Builder slip.',
                  });
                  return;
                }
                onToggleLeg('Match Result (1X2)', `${match.home} Win (1)`, hOdds, e);
              }}
              className={`rounded-xl py-1.5 px-1 border transition-all duration-150 active:scale-[0.98] min-h-[40px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                isHomeSelected
                  ? 'bg-[#006C54] text-white font-bold border-[#005441] shadow-xs'
                  : banner
                  ? `bg-white/15 hover:bg-white/35 text-slate-800 ${banner.oddsBorderColor || 'border-[#7BA7F8]/50 hover:border-[#0A3B8C]'} backdrop-blur-[1px]`
                  : 'bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-slate-800 dark:text-[#F4F5EF] border-[#DCDCC8] dark:border-[#414A43] hover:border-[#006C54] dark:hover:border-[#66CF11]'
              }`}
            >
              <span
                className={`t-market ${
                  isHomeSelected ? 'text-white/80' : 'text-slate-500'
                }`}
              >
                1
              </span>
              <span className={`t-odds ${isHomeSelected ? 'text-white' : 'text-slate-900'}`}>
                {hOdds.toFixed(2)}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                if (!currentUser) {
                  e.preventDefault();
                  e.stopPropagation();
                  openAuthWall({
                    actionType: 'builder_pick',
                    title: 'Sign In to Make Selections',
                    message: 'Sign up or log in to select market odds and add selections to your Bet Builder slip.',
                  });
                  return;
                }
                onToggleLeg('Match Result (1X2)', 'Draw (X)', dOdds, e);
              }}
              className={`rounded-xl py-1.5 px-1 border transition-all duration-150 active:scale-[0.98] min-h-[40px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                isDrawSelected
                  ? 'bg-[#006C54] text-white font-bold border-[#005441] shadow-xs'
                  : banner
                  ? `bg-white/15 hover:bg-white/35 text-slate-800 ${banner.oddsBorderColor || 'border-[#7BA7F8]/50 hover:border-[#0A3B8C]'} backdrop-blur-[1px]`
                  : 'bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-slate-800 dark:text-[#F4F5EF] border-[#DCDCC8] dark:border-[#414A43] hover:border-[#006C54] dark:hover:border-[#66CF11]'
              }`}
            >
              <span
                className={`t-market ${
                  isDrawSelected ? 'text-white/80' : 'text-slate-500'
                }`}
              >
                X
              </span>
              <span className={`t-odds ${isDrawSelected ? 'text-white' : 'text-slate-900'}`}>
                {dOdds.toFixed(2)}
              </span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                if (!currentUser) {
                  e.preventDefault();
                  e.stopPropagation();
                  openAuthWall({
                    actionType: 'builder_pick',
                    title: 'Sign In to Make Selections',
                    message: 'Sign up or log in to select market odds and add selections to your Bet Builder slip.',
                  });
                  return;
                }
                onToggleLeg('Match Result (1X2)', `${match.away} Win (2)`, aOdds, e);
              }}
              className={`rounded-xl py-1.5 px-1 border transition-all duration-150 active:scale-[0.98] min-h-[40px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                isAwaySelected
                  ? 'bg-[#006C54] text-white font-bold border-[#005441] shadow-xs'
                  : banner
                  ? `bg-white/15 hover:bg-white/35 text-slate-800 ${banner.oddsBorderColor || 'border-[#7BA7F8]/50 hover:border-[#0A3B8C]'} backdrop-blur-[1px]`
                  : 'bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-slate-800 dark:text-[#F4F5EF] border-[#DCDCC8] dark:border-[#414A43] hover:border-[#006C54] dark:hover:border-[#66CF11]'
              }`}
            >
              <span
                className={`t-market ${
                  isAwaySelected ? 'text-white/80' : 'text-slate-500'
                }`}
              >
                2
              </span>
              <span className={`t-odds ${isAwaySelected ? 'text-white' : 'text-slate-900'}`}>
                {aOdds.toFixed(2)}
              </span>
            </button>
          </div>
        </div>

        {/* Consensus Split Progress Bar */}
        <div className="mt-2.5">
          <div className="flex items-center justify-between t-meta text-slate-600 mb-1">
            <span className="flex items-center gap-1">
              <Flame size={11} className="text-[#006C54]" /> Consensus: <strong className="text-slate-900">{majLabel}</strong>
            </span>
            <span className="t-num font-semibold text-slate-800">{majority}%</span>
          </div>
          <div className={`w-full rounded-full h-1.5 flex overflow-hidden ${banner ? banner.consensusTrackBg || 'bg-[#DDE8F8]' : 'bg-[#E6E6D2] dark:bg-[#414A43]'}`}>
            <div
              style={{ width: `${consensus.homePct}%` }}
              className="bg-[#006C54] transition-all duration-500"
              title={`Home: ${consensus.homePct}%`}
            />
            <div
              style={{ width: `${consensus.drawPct}%` }}
              className="bg-[#EEAA04] transition-all duration-500"
              title={`Draw: ${consensus.drawPct}%`}
            />
            <div
              style={{ width: `${consensus.awayPct}%` }}
              className="bg-rose-500 transition-all duration-500"
              title={`Away: ${consensus.awayPct}%`}
            />
          </div>
        </div>
      </div>

      {/* Card Footer: Details & Discussion Link & Borderless Bet Builder Button */}
      <div className={`relative z-10 pt-3 mt-3 border-t flex items-center justify-between gap-2 ${banner ? banner.dividerColor || 'border-[#D9E7F9]' : 'border-[#F0F0E4] dark:border-[#414A43]'}`}>

        <Link
          to={`/free/${match.id}`}
          onClick={(e) => {
            if (!currentUser) {
              e.preventDefault();
              openAuthWall({
                actionType: 'details',
                title: 'Sign In for Details & Discussions',
                message: 'Sign up or log in to view match intelligence, tactical lineups, pitch tracker, and join live fan discussions.',
              });
            }
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#006C54] hover:text-[#005441] transition-colors"
        >
          <span>Details &amp; Discussion</span>
          <ArrowRight size={12} />
        </Link>

        <button
          type="button"
          onClick={() => {
            if (!currentUser) {
              openAuthWall({
                actionType: 'builder',
                title: 'Sign In to Use Bet Builder',
                message: 'Sign up or log in to select market odds, build custom accumulators, and share verified bet slips.',
              });
              return;
            }
            onOpenBetBuilder({
              id: match.id,
              home: match.home,
              away: match.away,
              competition: match.competition,
              kickoff: match.kickoff,
              homeOdds: hOdds,
              drawOdds: dOdds,
              awayOdds: aOdds,
              bookmaker: match.bookmaker,
            });
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-[#006C54] transition-colors cursor-pointer py-1 px-1.5"
        >
          <Dices size={13} className="text-[#EEAA04]" />
          <span>Bet Builder</span>
        </button>
      </div>
    </div>
  );
}
