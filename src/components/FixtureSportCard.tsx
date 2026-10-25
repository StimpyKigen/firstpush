import React from 'react';
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

  // Authoritative status presentation with DD/MM HH:mm in 24h format
  const scorePres = getMatchScorePresentation(
    match.status,
    match.displayClock,
    formatKickoffDateTime24h(match.kickoffIso, match.kickoff),
    match.homeScore,
    match.awayScore,
    match.kickoffIso
  );

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
          ? `${banner.cardBg || 'bg-gradient-to-b from-[#E3EFFE] via-[#F0F6FE] to-[#FFFFF0]'} ${banner.borderColor || 'border-[#7BA7F8]'} ${banner.borderHoverColor || 'hover:border-[#0A3B8C]'} ${banner.shadow || 'shadow-[0_2px_12px_rgba(10,59,140,0.09)] hover:shadow-[0_4px_18px_rgba(10,59,140,0.16)]'}`
          : 'bg-[#FFFFF0] border-[#DCDCC8] hover:border-[#006C54]/50 shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_14px_rgba(0,108,84,0.08)]'
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
            <span className="t-label truncate block">
              {leagueDisplayTitle}
            </span>
          </div>

          {scorePres.badgeVariant === 'halftime' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] leading-4 font-semibold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              HT · Half Time
            </span>
          ) : scorePres.isLive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] leading-4 font-semibold t-num bg-red-100 text-red-700 border border-red-300 animate-pulse shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
              {scorePres.badgeText}
            </span>
          ) : scorePres.badgeVariant === 'finished' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] leading-4 font-semibold t-num bg-slate-100 text-slate-700 border border-slate-300 shrink-0">
              {scorePres.badgeText || 'FT'}
            </span>
          ) : scorePres.isPostponedOrCancelled ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] leading-4 font-semibold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
              {scorePres.badgeText}
            </span>
          ) : (
            <span className="t-meta flex items-center gap-1 shrink-0 text-slate-600">
              <Clock size={11} className="text-slate-400" />
              {scorePres.badgeText}
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
              {scorePres.shouldShowScore && (
                <span className="t-score shrink-0 min-w-[1ch] text-right">
                  {scorePres.homeScoreDisplay}
                </span>
              )}
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
              {scorePres.shouldShowScore && (
                <span className="t-score shrink-0 min-w-[1ch] text-right">
                  {scorePres.awayScoreDisplay}
                </span>
              )}
            </div>
          </div>
        </Link>

        {/* Punter Engagement Counter */}
        <div className="flex items-center justify-between t-meta text-slate-700 mt-2.5">
          <span className="flex items-center gap-1.5">
            <Users size={12} className="text-[#006C54] shrink-0" />
            <span className="truncate">{consensus.totalVotes.toLocaleString()} punters analyzing</span>
          </span>
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
                  : 'bg-transparent hover:bg-black/[0.04] text-slate-800 border-[#DCDCC8] hover:border-[#006C54]'
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
                  : 'bg-transparent hover:bg-black/[0.04] text-slate-800 border-[#DCDCC8] hover:border-[#006C54]'
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
                  : 'bg-transparent hover:bg-black/[0.04] text-slate-800 border-[#DCDCC8] hover:border-[#006C54]'
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
          <div className={`w-full rounded-full h-1.5 flex overflow-hidden ${banner ? banner.consensusTrackBg || 'bg-[#DDE8F8]' : 'bg-[#E6E6D2]'}`}>
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
      <div className={`relative z-10 pt-3 mt-3 border-t flex items-center justify-between gap-2 ${banner ? banner.dividerColor || 'border-[#D9E7F9]' : 'border-[#F0F0E4]'}`}>

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
