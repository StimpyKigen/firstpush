import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Users, Clock, Unlock, RadioTower, Calendar, Search, X, SearchX, Dices, Plus, Check, Flame, MessageSquarePlus } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { freeMatches, freeMatchConsensus, TIER_LABEL, getFreeMatchesSnapshot, getFreeMatchConsensusSnapshot, subscribeToFreeMatches, type FreeMatch } from '../lib/freeMatches';
import { getEffectiveMatchDayFormattedEAT } from '../lib/footballApi';
import { useBetSlipStore } from '../lib/betSlipStore';
import { showToast } from '../lib/notificationStore';
import QuickBetBuilderModal, { type MatchForBuilder } from '../components/QuickBetBuilderModal';

const tierColor: Record<string, string> = {
  blockbuster: '#d97706',
  continental: '#2563eb',
  derby: '#dc2626',
};

export default function FreeMatches() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatchForBuilder, setSelectedMatchForBuilder] = useState<MatchForBuilder | null>(null);

  const matches = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchesSnapshot, getFreeMatchesSnapshot);
  const consensusMap = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchConsensusSnapshot, getFreeMatchConsensusSnapshot);
  const activeDayLabel = getEffectiveMatchDayFormattedEAT(new Date());

  const builderLegs = useBetSlipStore((s) => s.builderLegs);
  const toggleBuilderLeg = useBetSlipStore((s) => s.toggleBuilderLeg);

  const upcomingMatches = matches.filter((m) => {
    // Exclude matches that have already started or concluded
    if (m.status === 'in' || m.status === 'post') return false;
    if (m.kickoffIso) {
      const kTime = new Date(m.kickoffIso).getTime();
      if (!Number.isNaN(kTime) && kTime <= Date.now()) {
        return false;
      }
    }
    return true;
  });

  const query = searchQuery.trim().toLowerCase();
  const filteredMatches = upcomingMatches
    .filter((m) => {
      if (!query) return true;
      return (
        m.home.toLowerCase().includes(query) ||
        m.away.toLowerCase().includes(query) ||
        m.competition.toLowerCase().includes(query) ||
        (m.blurb && m.blurb.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      const votesA = consensusMap[a.id]?.totalVotes ?? 0;
      const votesB = consensusMap[b.id]?.totalVotes ?? 0;
      return votesB - votesA;
    });

  // Extract unique popular team/league names for quick suggestion pills
  const popularTags = Array.from(
    new Set(
      upcomingMatches
        .flatMap((m) => [m.home, m.away, m.competition])
        .filter(Boolean)
    )
  ).slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <SeoHead
        title="Free Football Matches & Live Discussion Rooms"
        description="Free discussion rooms for UEFA Champions League, Premier League, Europa League & top derbies. See community consensus, crowd splits & expert punter picks."
        canonicalUrl="https://mshindi.co.ke/free"
      />
      
      {/* Editorial Page Header */}
      <div className="text-center mb-8 sm:mb-10">
        <div className="flex items-center justify-center gap-2.5 flex-wrap mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <Unlock size={13} className="text-[#006C54]" /> Always free · No paywall
          </span>
          <span className="text-slate-300 font-normal">·</span>
          <span className="inline-flex items-center gap-1.5 text-[#006C54] font-black">
            <Flame size={13} /> Ranked by Activity
          </span>
          <span className="text-slate-300 font-normal">·</span>
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <Calendar size={13} className="text-slate-400" /> Today&apos;s Slate ({activeDayLabel} EAT)
          </span>
        </div>

        <h1 className="font-display font-black text-3xl sm:text-5xl text-slate-900 tracking-tight uppercase">
          Match Slate &amp; Consensus
        </h1>
        <p className="text-slate-600 mt-2 sm:mt-3 max-w-3xl mx-auto text-xs sm:text-sm leading-relaxed">
          Comprehensive match center for the <strong className="text-slate-900 font-bold">UEFA Champions League</strong>, <strong className="text-slate-900 font-bold">Premier League</strong>, and European derbies. Compare punter consensus splits and crowd picks before kickoff. Next slate updates at <span className="text-[#006C54] font-bold font-mono">03:00 AM EAT</span>.
        </p>
      </div>

      {/* Interactive Search Bar & Fixture Filter */}
      {upcomingMatches.length > 0 && (
        <div className="mb-8 max-w-2xl mx-auto space-y-3">
          <div className="relative flex items-center">
            <Search size={17} className="absolute left-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team or fixture (e.g. Arsenal, Real Madrid, Chelsea)..."
              className="w-full bg-white border border-slate-300 focus:border-[#006C54] focus:ring-2 focus:ring-[#006C54]/15 rounded-full pl-11 pr-10 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Quick Tag Pills (ESPN Tab Container Style) */}
          {popularTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pt-1 scrollbar-none text-xs justify-center">
              <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider mr-1 shrink-0">Popular:</span>
              {popularTags.map((tag) => {
                const isActive = searchQuery.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    onClick={() => setSearchQuery(isActive ? '' : tag)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 ${
                      isActive
                        ? 'bg-[#006C54] text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:border-[#006C54] hover:text-[#006C54]'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          {/* Results Summary Counter */}
          {searchQuery.trim() && (
            <div className="flex items-center justify-between text-xs text-slate-500 px-2 pt-1">
              <span>
                Found <strong className="text-slate-900">{filteredMatches.length}</strong> {filteredMatches.length === 1 ? 'fixture' : 'fixtures'} matching &quot;<span className="text-slate-900 font-semibold">{searchQuery}</span>&quot;
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#006C54] hover:underline font-bold"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fixtures List / Empty States */}
      {upcomingMatches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto flex flex-col items-center gap-3 shadow-xs">
          <Clock size={36} className="text-[#006C54] animate-pulse" />
          <h3 className="font-display font-extrabold text-lg text-slate-900 uppercase tracking-tight">All Today&apos;s Matches Have Kicked Off</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Free match rooms focus strictly on pre-match pick analysis. All highlight matches for today&apos;s slate are currently in progress or finished. The next set of upcoming fixtures will automatically unlock at <span className="text-[#006C54] font-bold font-mono">03:00 AM EAT</span>!
          </p>
          <Link to="/" className="mt-3 inline-flex items-center gap-2 bg-[#006C54] hover:bg-[#005441] text-white font-black text-xs uppercase tracking-wider px-5 h-10 rounded-md shadow-xs transition-colors active:scale-95">
            Browse Paid Jackpot Rooms
          </Link>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto flex flex-col items-center gap-3 shadow-xs">
          <SearchX size={36} className="text-[#006C54]" />
          <h3 className="font-display font-extrabold text-lg text-slate-900 uppercase tracking-tight">No Fixtures Found</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            No upcoming free matches match your search for &quot;<strong className="text-slate-900">{searchQuery}</strong>&quot;. Try searching for another team, league, or clear your search to view all today&apos;s fixtures.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-3 inline-flex items-center gap-2 bg-[#006C54] hover:bg-[#005441] text-white font-black text-xs uppercase tracking-wider px-5 h-10 rounded-md shadow-xs transition-colors active:scale-95 cursor-pointer"
          >
            Show All Today&apos;s Matches
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMatches.map((m, i) => {
            const consensus = consensusMap[m.id] || { homePct: 33, drawPct: 34, awayPct: 33, totalVotes: 0 };
            const majority = Math.max(consensus.homePct, consensus.drawPct, consensus.awayPct);
            const majLabel = majority === consensus.homePct ? '1 · Home' : majority === consensus.drawPct ? 'X · Draw' : '2 · Away';

            const hOdds = m.homeOdds || +(1.07 / Math.max(0.01, consensus.homePct / 100)).toFixed(2);
            const dOdds = m.drawOdds || +(1.07 / Math.max(0.01, consensus.drawPct / 100)).toFixed(2);
            const aOdds = m.awayOdds || +(1.07 / Math.max(0.01, consensus.awayPct / 100)).toFixed(2);

            const matchLegs = builderLegs.filter((l) => l.matchId === m.id);

            const isHomeSelected = builderLegs.some((l) => l.matchId === m.id && l.market === 'Match Result (1X2)' && l.pick.includes('1'));
            const isDrawSelected = builderLegs.some((l) => l.matchId === m.id && l.market === 'Match Result (1X2)' && l.pick.includes('Draw'));
            const isAwaySelected = builderLegs.some((l) => l.matchId === m.id && l.market === 'Match Result (1X2)' && l.pick.includes('2'));

            function handleQuickToggleOdd(market: string, pick: string, odds: number, e: React.MouseEvent) {
              e.preventDefault();
              e.stopPropagation();

              const legId = `${m.id}-${market}-${pick}`;
              const exists = builderLegs.some((l) => l.id === legId);

              toggleBuilderLeg({
                id: legId,
                matchId: m.id,
                homeTeam: m.home,
                awayTeam: m.away,
                competition: m.competition,
                kickoff: m.kickoff,
                market,
                pick,
                odds,
                status: 'pending',
              });

              if (exists) {
                showToast({ type: 'info', title: 'Pick Removed', message: `Removed ${pick} from Bet Builder` });
              } else {
                showToast({ type: 'success', title: 'Added to Bet Builder!', message: `Added ${pick} (@ ${odds.toFixed(2)}x)` });
              }
            }

            return (
              <div
                key={m.id}
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 sm:p-6 flex flex-col justify-between gap-4 transition-all hover:shadow-md group"
              >
                <div>
                  {/* Clean Text Category & Activity Labels (No Pill Capsules) */}
                  <div className="flex items-center justify-between gap-2 mb-2.5 text-[11px] font-black uppercase tracking-wider">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ color: tierColor[m.tier] }}>
                        {TIER_LABEL[m.tier]}
                      </span>
                      {i === 0 && (
                        <>
                          <span className="text-slate-300 font-normal">·</span>
                          <span className="inline-flex items-center gap-1 text-[#006C54] font-black">
                            <Flame size={12} className="shrink-0" /> #1 Discussed
                          </span>
                        </>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                      <RadioTower size={11} className="animate-pulse text-[#006C54]" /> Pre-Match
                    </span>
                  </div>

                  {/* Team Names and Match Header */}
                  <Link to={`/free/${m.id}`} className="block group-hover:text-[#006C54] transition-colors">
                    <h3 className="font-display font-black text-base sm:text-lg text-slate-900 leading-snug flex items-center gap-2 flex-wrap">
                      {m.homeLogo && <img src={m.homeLogo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-5 h-5 object-contain inline shrink-0" />}
                      <span>{m.home}</span>
                      <span className="text-slate-400 text-xs font-normal">v</span>
                      {m.awayLogo && <img src={m.awayLogo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-5 h-5 object-contain inline shrink-0" />}
                      <span>{m.away}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 font-semibold">{m.competition}</p>
                  </Link>

                  <p className="text-xs text-slate-600 mt-2 leading-relaxed line-clamp-2">{m.blurb}</p>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-3 mt-3 border-t border-slate-100">
                    <span className="flex items-center gap-1.5 font-medium"><Clock size={12} className="text-slate-400" /> {m.kickoff}</span>
                    <span className="flex items-center gap-1 font-bold text-slate-800"><Users size={12} className="text-[#006C54] shrink-0" /> {consensus.totalVotes.toLocaleString()} discussing</span>
                  </div>

                  {/* Custom Athletic Odds Grid */}
                  <div className="mt-3.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                      Match Result (1X2):
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center font-mono">
                      <button
                        onClick={(e) => handleQuickToggleOdd('Match Result (1X2)', `${m.home} Win (1)`, hOdds, e)}
                        className={`rounded-md py-2 px-1.5 border transition-all duration-150 active:scale-[0.98] touch-manipulation min-h-[46px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          isHomeSelected
                            ? 'bg-[#006C54] text-white font-black border-[#005441] shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span className={`text-[9px] font-black uppercase tracking-wider block leading-none ${isHomeSelected ? 'text-white/80' : 'text-slate-500'}`}>1 (HOME)</span>
                        <span className={`font-black text-xs sm:text-sm ${isHomeSelected ? 'text-white' : 'text-slate-900'}`}>{hOdds.toFixed(2)}</span>
                      </button>

                      <button
                        onClick={(e) => handleQuickToggleOdd('Match Result (1X2)', 'Draw (X)', dOdds, e)}
                        className={`rounded-md py-2 px-1.5 border transition-all duration-150 active:scale-[0.98] touch-manipulation min-h-[46px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          isDrawSelected
                            ? 'bg-[#006C54] text-white font-black border-[#005441] shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span className={`text-[9px] font-black uppercase tracking-wider block leading-none ${isDrawSelected ? 'text-white/80' : 'text-slate-500'}`}>X (DRAW)</span>
                        <span className={`font-black text-xs sm:text-sm ${isDrawSelected ? 'text-white' : 'text-slate-900'}`}>{dOdds.toFixed(2)}</span>
                      </button>

                      <button
                        onClick={(e) => handleQuickToggleOdd('Match Result (1X2)', `${m.away} Win (2)`, aOdds, e)}
                        className={`rounded-md py-2 px-1.5 border transition-all duration-150 active:scale-[0.98] touch-manipulation min-h-[46px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          isAwaySelected
                            ? 'bg-[#006C54] text-white font-black border-[#005441] shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span className={`text-[9px] font-black uppercase tracking-wider block leading-none ${isAwaySelected ? 'text-white/80' : 'text-slate-500'}`}>2 (AWAY)</span>
                        <span className={`font-black text-xs sm:text-sm ${isAwaySelected ? 'text-white' : 'text-slate-900'}`}>{aOdds.toFixed(2)}</span>
                      </button>
                    </div>
                  </div>

                  {/* Consensus strip */}
                  <div className="flex items-center justify-between rounded-md bg-slate-50 border border-slate-200 px-3 py-2 mt-3 text-xs">
                    <span className="font-semibold text-slate-600">Crowd Consensus</span>
                    <span className="font-display font-black text-[#006C54] text-xs sm:text-sm font-mono">{majLabel} · {majority}%</span>
                  </div>
                </div>

                {/* Custom Dual Action Buttons (Unified Height & Cohesive Sports Styling) */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <Link
                    to={`/free/${m.id}`}
                    className="h-10 px-3.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-800 text-slate-800 font-bold uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-2xs group/btn cursor-pointer"
                  >
                    <MessageSquarePlus size={14} className="text-[#006C54] group-hover/btn:scale-110 transition-transform shrink-0" />
                    <span>Discuss</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setSelectedMatchForBuilder(m)}
                    className={`h-10 px-3.5 rounded-md font-extrabold uppercase tracking-wider text-xs transition-all active:scale-[0.98] shadow-2xs flex items-center justify-center gap-2 cursor-pointer ${
                      matchLegs.length > 0
                        ? 'bg-[#006C54] hover:bg-[#005441] text-white border border-[#005441]'
                        : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-900'
                    }`}
                  >
                    {matchLegs.length > 0 ? (
                      <>
                        <Check size={14} className="shrink-0 stroke-[3]" />
                        <span>Builder ({matchLegs.length})</span>
                      </>
                    ) : (
                      <>
                        <Dices size={14} className="shrink-0" />
                        <span>+ Builder</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Bet Builder Selector Modal */}
      <QuickBetBuilderModal
        match={selectedMatchForBuilder}
        isOpen={!!selectedMatchForBuilder}
        onClose={() => setSelectedMatchForBuilder(null)}
      />
    </div>
  );
}
