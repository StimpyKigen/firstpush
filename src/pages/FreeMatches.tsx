import { useState, useMemo, useRef, useEffect, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Users, Clock, Unlock, Calendar, Search, X, SearchX,
  Dices, Plus, Check, Flame, MessageSquarePlus, Globe, ChevronDown, Filter, RotateCcw
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { freeMatches, freeMatchConsensus, getFreeMatchesSnapshot, getFreeMatchConsensusSnapshot, subscribeToFreeMatches, getIsFreeMatchesSyncing, type FreeMatch } from '../lib/freeMatches';
import { getEffectiveMatchDayFormattedEAT } from '../lib/footballApi';
import { useBetSlipStore } from '../lib/betSlipStore';
import { showToast } from '../lib/notificationStore';
import QuickBetBuilderModal, { type MatchForBuilder } from '../components/QuickBetBuilderModal';
import { MatchListSkeleton } from '../components/skeleton';
import { CONTINENTS, getLeagueMetadata, type ContinentId } from '../lib/leagueDirectory';

export default function FreeMatches() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatchForBuilder, setSelectedMatchForBuilder] = useState<MatchForBuilder | null>(null);

  // Saveable filters: Continent & League, and Sort filter
  const [leagueFilter, setLeagueFilter] = useState<string>(() => {
    try {
      return localStorage.getItem('mshindi_freematch_league_filter') || 'all';
    } catch {
      return 'all';
    }
  });

  const [sortBy, setSortBy] = useState<'popular' | 'time'>(() => {
    try {
      const saved = localStorage.getItem('mshindi_freematch_sort_filter');
      return saved === 'time' ? 'time' : 'popular';
    } catch {
      return 'popular';
    }
  });

  const [isLeagueDropdownOpen, setIsLeagueDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const leagueDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (leagueDropdownRef.current && !leagueDropdownRef.current.contains(event.target as Node)) {
        setIsLeagueDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLeagueFilterChange = (val: string) => {
    setLeagueFilter(val);
    setIsLeagueDropdownOpen(false);
    try {
      localStorage.setItem('mshindi_freematch_league_filter', val);
    } catch {}
  };

  const handleSortChange = (val: 'popular' | 'time') => {
    setSortBy(val);
    setIsSortDropdownOpen(false);
    try {
      localStorage.setItem('mshindi_freematch_sort_filter', val);
    } catch {}
  };

  const resetFilters = () => {
    setSearchQuery('');
    handleLeagueFilterChange('all');
    handleSortChange('popular');
  };

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

  // Build Continent -> Ranked Leagues map from upcomingMatches
  const groupedContinents = useMemo(() => {
    const continentMap = new Map<ContinentId, Map<string, { count: number; rank: number }>>();

    for (const c of CONTINENTS) {
      if (c.id !== 'all') {
        continentMap.set(c.id, new Map());
      }
    }

    upcomingMatches.forEach((m) => {
      const meta = getLeagueMetadata(m.competition);
      const cMap = continentMap.get(meta.continent) || continentMap.get('europe')!;
      const existing = cMap.get(meta.standardName) || { count: 0, rank: meta.rank };
      existing.count += 1;
      existing.rank = meta.rank;
      cMap.set(meta.standardName, existing);
    });

    return CONTINENTS.filter((c) => c.id !== 'all').map((c) => {
      const leaguesMap = continentMap.get(c.id) || new Map();
      const leagues = Array.from(leaguesMap.entries())
        .map(([name, data]) => ({ name, count: data.count, rank: data.rank }))
        .sort((a, b) => a.rank - b.rank || b.count - a.count);

      const totalCount = leagues.reduce((sum, l) => sum + l.count, 0);
      return {
        id: c.id,
        name: c.name,
        flag: c.flag,
        totalCount,
        leagues,
      };
    });
  }, [upcomingMatches]);

  const currentLeagueLabel = useMemo(() => {
    if (leagueFilter === 'all') return { title: 'All Continents & Leagues', flag: '🌍' };
    if (leagueFilter.startsWith('continent:')) {
      const cId = leagueFilter.replace('continent:', '');
      const c = CONTINENTS.find((item) => item.id === cId);
      return { title: `All ${c?.name || 'Continent'}`, flag: c?.flag || '🌍' };
    }
    if (leagueFilter.startsWith('league:')) {
      const lName = leagueFilter.replace('league:', '');
      const meta = getLeagueMetadata(lName);
      const c = CONTINENTS.find((item) => item.id === meta.continent);
      return { title: lName, flag: c?.flag || '⚽' };
    }
    return { title: 'All Continents & Leagues', flag: '🌍' };
  }, [leagueFilter]);

  const query = searchQuery.trim().toLowerCase();
  const filteredMatches = upcomingMatches
    .filter((m) => {
      // 1. Text Search Filter
      if (query) {
        const matchesQuery =
          m.home.toLowerCase().includes(query) ||
          m.away.toLowerCase().includes(query) ||
          m.competition.toLowerCase().includes(query) ||
          (m.blurb && m.blurb.toLowerCase().includes(query));
        if (!matchesQuery) return false;
      }

      // 2. Continent & League Filter
      if (leagueFilter === 'all') return true;

      const meta = getLeagueMetadata(m.competition);
      if (leagueFilter.startsWith('continent:')) {
        const targetContinent = leagueFilter.replace('continent:', '');
        return meta.continent === targetContinent;
      }
      if (leagueFilter.startsWith('league:')) {
        const targetLeague = leagueFilter.replace('league:', '');
        return meta.standardName.toLowerCase() === targetLeague.toLowerCase() ||
               m.competition.toLowerCase() === targetLeague.toLowerCase();
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'time') {
        const timeA = a.kickoffIso ? new Date(a.kickoffIso).getTime() : Infinity;
        const timeB = b.kickoffIso ? new Date(b.kickoffIso).getTime() : Infinity;
        if (timeA !== timeB) return timeA - timeB;
      }
      // Default: Most Popular (consensus votes descending)
      const votesA = consensusMap[a.id]?.totalVotes ?? 0;
      const votesB = consensusMap[b.id]?.totalVotes ?? 0;
      return votesB - votesA;
    });

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

      {/* Interactive Search Bar & iOS-Style Filters */}
      {upcomingMatches.length > 0 && (
        <div className="mb-8 max-w-3xl mx-auto space-y-3">
          {/* Search Bar */}
          <div className="relative flex items-center">
            <Search size={17} className="absolute left-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team or fixture (e.g. Arsenal, Real Madrid, Chelsea)..."
              className="w-full bg-[#FFFFF0] border border-[#D4D4C0] focus:border-[#006C54] focus:ring-2 focus:ring-[#006C54]/15 rounded-full pl-11 pr-10 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Aesthetic Pill-Style Dropdowns (Optimized for Mobile & Desktop) */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            {/* Dropdown 1: Continent & Ranked League Filter */}
            <div className="sm:col-span-7 relative" ref={leagueDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsLeagueDropdownOpen((prev) => !prev);
                  setIsSortDropdownOpen(false);
                }}
                className={`w-full bg-[#FFFFF0] border rounded-full px-5 py-2.5 sm:py-3 text-xs font-bold text-slate-800 flex items-center justify-between gap-3 transition-all shadow-xs hover:border-[#006C54] cursor-pointer ${
                  isLeagueDropdownOpen ? 'border-[#006C54] ring-2 ring-[#006C54]/15' : 'border-[#D4D4C0]'
                }`}
                aria-expanded={isLeagueDropdownOpen}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Globe size={18} className="text-[#006C54] shrink-0" strokeWidth={2} />
                  <div className="text-left truncate">
                    <span className="text-[10.5px] sm:text-[11px] text-slate-500 font-semibold tracking-tight block leading-tight mb-0.5">
                      League / Continent
                    </span>
                    <span className="truncate block font-bold text-xs sm:text-sm text-slate-900">
                      {currentLeagueLabel.title}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {leagueFilter !== 'all' && (
                    <span className="w-2 h-2 rounded-full bg-[#006C54]" />
                  )}
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${
                      isLeagueDropdownOpen ? 'rotate-180 text-[#006C54]' : ''
                    }`}
                  />
                </div>
              </button>

              {/* iOS Styled Dropdown Menu */}
              {isLeagueDropdownOpen && (
                <div className="absolute left-0 right-0 mt-2 bg-[#FFFFF0] border border-[#D4D4C0] rounded-2xl shadow-2xl py-2 z-50 max-h-[360px] overflow-y-auto overscroll-contain text-xs divide-y divide-[#E6E6D2]">
                  {/* Option: All Continents */}
                  <div className="p-1">
                    <button
                      type="button"
                      onClick={() => handleLeagueFilterChange('all')}
                      className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                        leagueFilter === 'all'
                          ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                          : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>🌍</span> All Continents &amp; Leagues
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F5F5E4] border border-[#E6E6D2] text-slate-600 font-bold">
                          {upcomingMatches.length}
                        </span>
                        {leagueFilter === 'all' && <Check size={14} className="text-[#006C54]" />}
                      </div>
                    </button>
                  </div>

                  {/* Grouped by Continent & Ranked Leagues */}
                  {groupedContinents.map((continent) => (
                    <div key={continent.id} className="p-1">
                      {/* Continent Header */}
                      <div className="px-3 py-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <span>{continent.flag} {continent.name}</span>
                        <span>{continent.totalCount} {continent.totalCount === 1 ? 'fixture' : 'fixtures'}</span>
                      </div>

                      {/* Select entire continent */}
                      <button
                        type="button"
                        onClick={() => handleLeagueFilterChange(`continent:${continent.id}`)}
                        className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center justify-between transition-colors mb-0.5 cursor-pointer ${
                          leagueFilter === `continent:${continent.id}`
                            ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                            : 'hover:bg-[#F5F5E4] text-slate-700 font-medium'
                        }`}
                      >
                        <span className="text-[11px] font-bold">All {continent.name} Fixtures</span>
                        {leagueFilter === `continent:${continent.id}` && <Check size={13} className="text-[#006C54]" />}
                      </button>

                      {/* Ranked Leagues within Continent */}
                      {continent.leagues.length === 0 ? (
                        <div className="px-3 py-1 text-[11px] text-slate-400 italic">No fixtures on today&apos;s slate</div>
                      ) : (
                        continent.leagues.map((league) => {
                          const isSelected = leagueFilter === `league:${league.name}`;
                          return (
                            <button
                              key={league.name}
                              type="button"
                              onClick={() => handleLeagueFilterChange(`league:${league.name}`)}
                              className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center justify-between transition-colors pl-6 cursor-pointer ${
                                isSelected
                                  ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                                  : 'hover:bg-[#F5F5E4] text-slate-600 font-medium'
                              }`}
                            >
                              <span className="truncate pr-2 text-xs">{league.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F5F5E4] border border-[#E6E6D2] text-slate-600 font-bold">
                                  {league.count}
                                </span>
                                {isSelected && <Check size={13} className="text-[#006C54]" />}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dropdown 2: Filter by / Sort Filter */}
            <div className="sm:col-span-5 relative" ref={sortDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsSortDropdownOpen((prev) => !prev);
                  setIsLeagueDropdownOpen(false);
                }}
                className={`w-full bg-[#FFFFF0] border rounded-full px-5 py-2.5 sm:py-3 text-xs font-bold text-slate-800 flex items-center justify-between gap-3 transition-all shadow-xs hover:border-[#006C54] cursor-pointer ${
                  isSortDropdownOpen ? 'border-[#006C54] ring-2 ring-[#006C54]/15' : 'border-[#D4D4C0]'
                }`}
                aria-expanded={isSortDropdownOpen}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {sortBy === 'popular' ? (
                    <Flame size={18} className="text-[#006C54] shrink-0" />
                  ) : (
                    <Clock size={18} className="text-[#8A6500] shrink-0" />
                  )}
                  <div className="text-left truncate">
                    <span className="text-[10.5px] sm:text-[11px] text-slate-500 font-semibold tracking-tight block leading-tight mb-0.5">
                      Filter &amp; Sort By
                    </span>
                    <span className="truncate block font-bold text-xs sm:text-sm text-slate-900">
                      {sortBy === 'popular' ? 'Most Popular' : 'Start Time'}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-slate-500 transition-transform duration-200 shrink-0 ${
                    isSortDropdownOpen ? 'rotate-180 text-[#006C54]' : ''
                  }`}
                />
              </button>

              {/* iOS Styled Sort Dropdown Menu */}
              {isSortDropdownOpen && (
                <div className="absolute right-0 left-0 mt-2 bg-[#FFFFF0] border border-[#D4D4C0] rounded-2xl shadow-2xl py-2 z-50 text-xs divide-y divide-[#E6E6D2]">
                  <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Sort Order
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSortChange('popular')}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                      sortBy === 'popular'
                        ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                        : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Flame size={14} className="text-[#006C54]" />
                      <div>
                        <div className="font-bold text-slate-900">Most Popular</div>
                        <div className="text-[10px] text-slate-400 font-normal">Ranked by punter consensus &amp; debate activity</div>
                      </div>
                    </div>
                    {sortBy === 'popular' && <Check size={14} className="text-[#006C54] shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSortChange('time')}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                      sortBy === 'time'
                        ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                        : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-[#8A6500]" />
                      <div>
                        <div className="font-bold text-slate-900">Start Time</div>
                        <div className="text-[10px] text-slate-400 font-normal">Kickoff earliest to latest</div>
                      </div>
                    </div>
                    {sortBy === 'time' && <Check size={14} className="text-[#006C54] shrink-0" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Active Filter Summary Bar with Auto-Save Badge */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500 px-2 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span>
                Showing <strong className="text-slate-900 font-bold">{filteredMatches.length}</strong> of{' '}
                <span className="font-semibold">{upcomingMatches.length}</span> fixtures
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                <Check size={10} /> Saved filters
              </span>
            </div>
            {(leagueFilter !== 'all' || searchQuery.trim() || sortBy !== 'popular') && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[#006C54] hover:underline font-bold text-xs inline-flex items-center gap-1"
              >
                <RotateCcw size={11} /> Reset filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fixtures List / Skeleton Loader / Empty States */}
      {matches.length === 0 && getIsFreeMatchesSyncing() ? (
        <MatchListSkeleton count={6} />
      ) : upcomingMatches.length === 0 ? (
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
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-6">
          {filteredMatches.map((m) => {
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
                className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-2.5 sm:p-5 lg:p-6 flex flex-col justify-between gap-2.5 sm:gap-4 transition-all hover:shadow-md group"
              >
                <div>
                  {/* Clean Minimal Header: League & Kickoff Time */}
                  <div className="flex items-center justify-between gap-1 text-[10px] sm:text-xs font-semibold text-slate-500 pb-1.5 border-b border-slate-100 mb-2 truncate">
                    <span className="truncate text-slate-700 font-bold max-w-[90px] sm:max-w-none">{m.competition}</span>
                    <span className="flex items-center gap-1 shrink-0 text-slate-500 font-mono text-[10px] sm:text-xs">
                      <Clock size={10} className="text-slate-400 sm:w-3 sm:h-3" />
                      {m.kickoff}
                    </span>
                  </div>

                  {/* Team Names and Crests */}
                  <Link to={`/free/${m.id}`} className="block group-hover:text-[#006C54] transition-colors">
                    <div className="space-y-1 sm:space-y-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {m.homeLogo && <img src={m.homeLogo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-3.5 h-3.5 sm:w-5 sm:h-5 object-contain shrink-0" />}
                        <span className="font-display font-extrabold text-[11px] sm:text-sm text-slate-900 truncate leading-snug">{m.home}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        {m.awayLogo && <img src={m.awayLogo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-3.5 h-3.5 sm:w-5 sm:h-5 object-contain shrink-0" />}
                        <span className="font-display font-extrabold text-[11px] sm:text-sm text-slate-900 truncate leading-snug">{m.away}</span>
                      </div>
                    </div>
                  </Link>

                  {/* Discussing punters count */}
                  <div className="flex items-center gap-1 text-[10px] sm:text-xs text-slate-400 font-medium mt-1.5">
                    <Users size={10} className="text-[#006C54] shrink-0 sm:w-3 sm:h-3" />
                    <span className="truncate">{consensus.totalVotes.toLocaleString()} discussing</span>
                  </div>

                  {/* Custom Athletic Odds Grid */}
                  <div className="mt-2 sm:mt-3">
                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                      1X2:
                    </span>
                    <div className="grid grid-cols-3 gap-1 sm:gap-2 text-center font-mono">
                      <button
                        onClick={(e) => handleQuickToggleOdd('Match Result (1X2)', `${m.home} Win (1)`, hOdds, e)}
                        className={`rounded-md py-1.5 px-0.5 sm:py-2 sm:px-1.5 border transition-all duration-150 active:scale-[0.98] touch-manipulation min-h-[36px] sm:min-h-[46px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          isHomeSelected
                            ? 'bg-[#006C54] text-white font-black border-[#005441] shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider block leading-none ${isHomeSelected ? 'text-white/80' : 'text-slate-500'}`}>1</span>
                        <span className={`font-black text-[11px] sm:text-sm ${isHomeSelected ? 'text-white' : 'text-slate-900'}`}>{hOdds.toFixed(2)}</span>
                      </button>

                      <button
                        onClick={(e) => handleQuickToggleOdd('Match Result (1X2)', 'Draw (X)', dOdds, e)}
                        className={`rounded-md py-1.5 px-0.5 sm:py-2 sm:px-1.5 border transition-all duration-150 active:scale-[0.98] touch-manipulation min-h-[36px] sm:min-h-[46px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          isDrawSelected
                            ? 'bg-[#006C54] text-white font-black border-[#005441] shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider block leading-none ${isDrawSelected ? 'text-white/80' : 'text-slate-500'}`}>X</span>
                        <span className={`font-black text-[11px] sm:text-sm ${isDrawSelected ? 'text-white' : 'text-slate-900'}`}>{dOdds.toFixed(2)}</span>
                      </button>

                      <button
                        onClick={(e) => handleQuickToggleOdd('Match Result (1X2)', `${m.away} Win (2)`, aOdds, e)}
                        className={`rounded-md py-1.5 px-0.5 sm:py-2 sm:px-1.5 border transition-all duration-150 active:scale-[0.98] touch-manipulation min-h-[36px] sm:min-h-[46px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                          isAwaySelected
                            ? 'bg-[#006C54] text-white font-black border-[#005441] shadow-xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider block leading-none ${isAwaySelected ? 'text-white/80' : 'text-slate-500'}`}>2</span>
                        <span className={`font-black text-[11px] sm:text-sm ${isAwaySelected ? 'text-white' : 'text-slate-900'}`}>{aOdds.toFixed(2)}</span>
                      </button>
                    </div>
                  </div>

                  {/* Consensus strip */}
                  <div className="flex items-center justify-between rounded-md bg-slate-50 border border-slate-200 px-2 py-1 sm:px-3 sm:py-2 mt-2 sm:mt-3 text-[10px] sm:text-xs">
                    <span className="font-semibold text-slate-500 truncate mr-1">Consensus</span>
                    <span className="font-display font-black text-[#006C54] text-[10px] sm:text-sm font-mono shrink-0">{majLabel} · {majority}%</span>
                  </div>
                </div>

                {/* Custom Dual Action Buttons (Unified Height & Cohesive Sports Styling) */}
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-2 border-t border-slate-100">
                  <Link
                    to={`/free/${m.id}`}
                    className="h-8 sm:h-10 px-2 sm:px-3.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-800 text-slate-800 font-bold uppercase tracking-wider text-[10px] sm:text-xs transition-all flex items-center justify-center gap-1 sm:gap-2 active:scale-[0.98] shadow-2xs group/btn cursor-pointer"
                  >
                    <MessageSquarePlus size={12} className="text-[#006C54] group-hover/btn:scale-110 transition-transform shrink-0 sm:w-3.5 sm:h-3.5" />
                    <span>Discuss</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setSelectedMatchForBuilder(m)}
                    className={`h-8 sm:h-10 px-2 sm:px-3.5 rounded-md font-extrabold uppercase tracking-wider text-[10px] sm:text-xs transition-all active:scale-[0.98] shadow-2xs flex items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
                      matchLegs.length > 0
                        ? 'bg-[#006C54] hover:bg-[#005441] text-white border border-[#005441]'
                        : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-900'
                    }`}
                  >
                    {matchLegs.length > 0 ? (
                      <>
                        <Check size={12} className="shrink-0 stroke-[3] sm:w-3.5 sm:h-3.5" />
                        <span className="truncate">Builder ({matchLegs.length})</span>
                      </>
                    ) : (
                      <>
                        <Dices size={12} className="shrink-0 sm:w-3.5 sm:h-3.5" />
                        <span className="truncate">+ Build</span>
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
