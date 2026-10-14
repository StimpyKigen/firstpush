import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Users, Clock, Unlock, RadioTower, Calendar, Search, X, SearchX, Dices, Plus, Check, Flame } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { freeMatches, freeMatchConsensus, TIER_LABEL, getFreeMatchesSnapshot, getFreeMatchConsensusSnapshot, subscribeToFreeMatches, type FreeMatch } from '../lib/freeMatches';
import { getEffectiveMatchDayFormattedEAT } from '../lib/footballApi';
import { useBetSlipStore } from '../lib/betSlipStore';
import { showToast } from '../lib/notificationStore';
import QuickBetBuilderModal, { type MatchForBuilder } from '../components/QuickBetBuilderModal';

const tierColor: Record<string, string> = {
  blockbuster: '#f2b705',
  continental: '#3b82f6',
  derby: '#ef5b5b',
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
      <div className="text-center mb-8 sm:mb-10">
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap mb-3 sm:mb-4">
          <span className="inline-flex items-center gap-1.5 bg-panel border border-emerald-2/30 text-emerald-2 text-[11px] sm:text-xs font-bold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full">
            <Unlock size={12} className="sm:w-3.2 sm:h-3.2" /> Always free: no paywall
          </span>
          <span className="inline-flex items-center gap-1.5 bg-panel border border-amber-500/40 text-amber-400 text-[11px] sm:text-xs font-bold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full">
            <Flame size={12} className="animate-bounce sm:w-3.2 sm:h-3.2" /> Ranked by Most Discussed
          </span>
          <span className="inline-flex items-center gap-1.5 bg-panel border border-gold/40 text-gold text-[11px] sm:text-xs font-bold px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full">
            <Calendar size={12} className="sm:w-3.2 sm:h-3.2" /> Today's Slate: {activeDayLabel} EAT
          </span>
        </div>

        <h1 className="font-display font-extrabold text-2xl sm:text-4xl text-cream">Upcoming Free Matches</h1>
        <p className="text-cream-dim mt-2 sm:mt-3 max-w-3xl mx-auto text-xs sm:text-base leading-relaxed">
          Covering the <strong className="text-gold">UEFA Champions League</strong>, <strong className="text-gold">Europa League</strong>, <strong className="text-gold">Conference League</strong>, and highlights from football's top-flight leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1 & derby clashes). Discuss picks and vote on consensus before kickoff. Matches that have already started are automatically hidden so punter debates focus purely on upcoming predictions. Next slate updates at <span className="text-gold font-semibold font-mono">03:00 AM EAT</span>.
        </p>
      </div>

      {/* Interactive Search Bar & Fixture Filter */}
      {upcomingMatches.length > 0 && (
        <div className="mb-6 sm:mb-8 max-w-2xl mx-auto space-y-2.5 sm:space-y-3">
          <div className="relative flex items-center">
            <Search size={16} className="absolute left-3.5 text-cream-dim pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team or fixture for today (e.g. Arsenal, Real Madrid)..."
              className="w-full bg-panel border border-line focus:border-gold/60 rounded-2xl pl-10 pr-9 py-2.5 sm:py-3.5 text-xs sm:text-sm text-cream placeholder-cream-dim/50 shadow-lg focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 rounded-full hover:bg-ink text-cream-dim hover:text-cream transition-colors"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Quick Tag Pills */}
          {popularTags.length > 0 && (
            <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto whitespace-nowrap pt-0.5 scrollbar-none text-[11px] sm:text-xs">
              <span className="text-cream-dim/60 text-[10px] sm:text-[11px] font-medium mr-0.5 shrink-0">Quick search:</span>
              {popularTags.map((tag) => {
                const isActive = searchQuery.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    onClick={() => setSearchQuery(isActive ? '' : tag)}
                    className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold border transition-all shrink-0 ${
                      isActive
                        ? 'bg-gold text-ink-2 border-gold font-bold shadow'
                        : 'bg-panel-2 text-cream-dim border-line hover:border-gold/40 hover:text-gold'
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
            <div className="flex items-center justify-between text-[11px] sm:text-xs text-cream-dim px-1">
              <span>
                Found <strong className="text-gold">{filteredMatches.length}</strong> {filteredMatches.length === 1 ? 'fixture' : 'fixtures'} matching &quot;<span className="text-cream font-medium">{searchQuery}</span>&quot;
              </span>
              <button
                onClick={() => setSearchQuery('')}
                className="text-gold hover:underline font-medium"
              >
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fixtures List / Empty States */}
      {upcomingMatches.length === 0 ? (
        <div className="bg-panel border border-line rounded-2xl p-6 sm:p-8 text-center max-w-xl mx-auto flex flex-col items-center gap-3">
          <Clock size={32} className="text-gold animate-pulse" />
          <h3 className="font-display font-bold text-base sm:text-lg text-cream">All Today's Matches Have Kicked Off</h3>
          <p className="text-xs text-cream-dim leading-relaxed">
            Free match rooms focus strictly on pre-match pick analysis. All highlight matches for today's slate are currently in progress or finished. The next set of upcoming fixtures will automatically unlock at <span className="text-gold font-semibold font-mono">03:00 AM EAT</span>!
          </p>
          <Link to="/" className="mt-2 inline-flex items-center gap-2 bg-emerald-2 text-ink font-bold text-xs px-4 py-2.5 rounded-lg hover:bg-emerald-2/90 transition-colors">
            Browse Paid Jackpot Rooms
          </Link>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="bg-panel border border-line rounded-2xl p-6 sm:p-8 text-center max-w-xl mx-auto flex flex-col items-center gap-3">
          <SearchX size={32} className="text-gold/80" />
          <h3 className="font-display font-bold text-base sm:text-lg text-cream">No Fixtures Found</h3>
          <p className="text-xs text-cream-dim leading-relaxed">
            No upcoming free matches match your search for &quot;<strong className="text-cream">{searchQuery}</strong>&quot;. Try searching for another team, league, or clear your search to view all today's fixtures.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 inline-flex items-center gap-2 bg-gold text-ink-2 font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-amber-400 transition-colors"
          >
            Show All Today's Free Matches
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                className="animate-rise group ios-card p-5 sm:p-6 flex flex-col gap-3 sm:gap-4 hover:border-gold/50 transition-all hover:-translate-y-1"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {i === 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm">
                        <Flame size={11} /> #1 Discussed
                      </span>
                    )}
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border shadow-sm"
                      style={{ color: tierColor[m.tier], borderColor: `${tierColor[m.tier]}55`, backgroundColor: `${tierColor[m.tier]}18` }}
                    >
                      {TIER_LABEL[m.tier]}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-2 shrink-0">
                    <RadioTower size={11} className="animate-pulse" /> Pre-Match
                  </span>
                </div>

                <Link to={`/free/${m.id}`} className="block group-hover:text-gold transition-colors">
                  <h3 className="font-display font-extrabold text-base sm:text-lg text-cream leading-snug flex items-center gap-2 flex-wrap">
                    {m.homeLogo && <img src={m.homeLogo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-5 h-5 object-contain inline shrink-0" />}
                    <span>{m.home}</span>
                    <span className="text-cream-dim/60 text-xs font-normal">vs</span>
                    {m.awayLogo && <img src={m.awayLogo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-5 h-5 object-contain inline shrink-0" />}
                    <span>{m.away}</span>
                  </h3>
                  <p className="text-[11px] text-cream-dim mt-0.5 font-medium">{m.competition}</p>
                </Link>

                <p className="text-xs text-cream-dim leading-relaxed line-clamp-2">{m.blurb}</p>

                <div className="flex items-center justify-between text-xs text-cream-dim pt-2 border-t border-line/60">
                  <span className="flex items-center gap-1.5 font-medium"><Clock size={12} /> {m.kickoff}</span>
                  <span className="flex items-center gap-1 font-semibold text-amber-400"><Flame size={12} className="text-amber-400 shrink-0" /> {consensus.totalVotes.toLocaleString()} discussing</span>
                </div>

                {/* Quick Interactive Odds Grid */}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cream-dim/70 block mb-1.5">
                    Match Result (1X2):
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <button
                      onClick={(e) => handleQuickToggleOdd('Match Result (1X2)', `${m.home} Win (1)`, hOdds, e)}
                      className={`rounded-2xl py-2 px-1.5 border transition-all duration-200 active:scale-95 touch-manipulation min-h-[44px] flex flex-col items-center justify-center gap-0.5 shadow-sm ${
                        isHomeSelected
                          ? 'bg-gold text-ink font-black border-gold shadow-md'
                          : 'bg-white/6 hover:bg-white/10 text-cream border-line/70 hover:border-gold/50'
                      }`}
                    >
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider block leading-none ${isHomeSelected ? 'text-ink' : 'text-cream-dim'}`}>1 (HOME)</span>
                      <span className={`font-extrabold text-xs sm:text-sm ${isHomeSelected ? 'text-ink' : 'text-emerald-400'}`}>{hOdds.toFixed(2)}</span>
                    </button>

                    <button
                      onClick={(e) => handleQuickToggleOdd('Match Result (1X2)', 'Draw (X)', dOdds, e)}
                      className={`rounded-2xl py-2 px-1.5 border transition-all duration-200 active:scale-95 touch-manipulation min-h-[44px] flex flex-col items-center justify-center gap-0.5 shadow-sm ${
                        isDrawSelected
                          ? 'bg-gold text-ink font-black border-gold shadow-md'
                          : 'bg-white/6 hover:bg-white/10 text-cream border-line/70 hover:border-gold/50'
                      }`}
                    >
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider block leading-none ${isDrawSelected ? 'text-ink' : 'text-cream-dim'}`}>X (DRAW)</span>
                      <span className={`font-extrabold text-xs sm:text-sm ${isDrawSelected ? 'text-ink' : 'text-gold'}`}>{dOdds.toFixed(2)}</span>
                    </button>

                    <button
                      onClick={(e) => handleQuickToggleOdd('Match Result (1X2)', `${m.away} Win (2)`, aOdds, e)}
                      className={`rounded-2xl py-2 px-1.5 border transition-all duration-200 active:scale-95 touch-manipulation min-h-[44px] flex flex-col items-center justify-center gap-0.5 shadow-sm ${
                        isAwaySelected
                          ? 'bg-gold text-ink font-black border-gold shadow-md'
                          : 'bg-white/6 hover:bg-white/10 text-cream border-line/70 hover:border-gold/50'
                      }`}
                    >
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider block leading-none ${isAwaySelected ? 'text-ink' : 'text-cream-dim'}`}>2 (AWAY)</span>
                      <span className={`font-extrabold text-xs sm:text-sm ${isAwaySelected ? 'text-ink' : 'text-red-400'}`}>{aOdds.toFixed(2)}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl bg-ink-2/80 border border-line/70 px-3.5 py-2">
                  <span className="text-xs font-semibold text-cream-dim">Punters Mass Pick</span>
                  <span className="font-display font-extrabold text-gold text-xs sm:text-sm font-mono">{majLabel} · {majority}%</span>
                </div>

                {/* Dual Action Buttons: Discuss Picks + Add to Bet Builder */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Link
                    to={`/free/${m.id}`}
                    className="ios-pill-btn py-2.5 px-3 min-h-[42px] text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-ink hover:border-emerald-500 active:scale-95 transition-all shadow-sm text-center"
                  >
                    <Sparkles size={14} className="shrink-0" />
                    <span>Discuss</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setSelectedMatchForBuilder(m)}
                    className={`ios-pill-btn py-2.5 px-3 min-h-[42px] text-xs font-bold transition-all active:scale-95 shadow-sm text-center ${
                      matchLegs.length > 0
                        ? 'bg-gold text-ink shadow-md font-black'
                        : 'bg-gold/15 text-gold border border-gold/30 hover:bg-gold hover:text-ink'
                    }`}
                  >
                    {matchLegs.length > 0 ? (
                      <>
                        <Check size={14} className="shrink-0 stroke-[2.5]" />
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
