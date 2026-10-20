import { useState, useMemo, useRef, useEffect, useSyncExternalStore } from 'react';
import {
  Sparkles, Clock, Unlock, Calendar, Search, X, SearchX,
  Check, Flame, ChevronDown, RotateCcw,
  Radio, Trophy, Play
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import {
  freeMatches,
  freeMatchConsensus,
  getFreeMatchesSnapshot,
  getFreeMatchConsensusSnapshot,
  subscribeToFreeMatches,
  getIsFreeMatchesSyncing,
  getHasFreeMatchesSynced,
  type FreeMatch
} from '../lib/freeMatches';
import { useBetSlipStore } from '../lib/betSlipStore';
import { showToast } from '../lib/notificationStore';
import QuickBetBuilderModal, { type MatchForBuilder } from '../components/QuickBetBuilderModal';
import { MatchListSkeleton } from '../components/skeleton';
import { CONTINENTS, getLeagueMetadata, type ContinentId } from '../lib/leagueDirectory';
import FixtureSportCard from '../components/FixtureSportCard';
import { normalizeMatchStatus } from '../lib/matchStatus';
import {
  sortHighlightsComparator,
  sortUpcomingComparator,
  isUpcomingEligible,
  isHighlightsEligible,
  getDeviceLocalDateString,
} from '../lib/competitionPriority';

type ScopeTab = 'upcoming' | 'live';

export default function FreeMatches() {
  const [activeTab, setActiveTab] = useState<ScopeTab>('upcoming');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatchForBuilder, setSelectedMatchForBuilder] = useState<MatchForBuilder | null>(null);

  // League filter & Sort by
  const [leagueFilter, setLeagueFilter] = useState<string>(() => {
    try {
      return localStorage.getItem('mshindi_freematch_league_filter') || 'all';
    } catch {
      return 'all';
    }
  });

  const [sortBy, setSortBy] = useState<'highlights' | 'time' | 'popular'>('highlights');

  // Apple-inspired toolbar dropdown & popover states
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isLeagueDropdownOpen, setIsLeagueDropdownOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const leagueDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(target)) {
        setIsDateDropdownOpen(false);
      }
      if (leagueDropdownRef.current && !leagueDropdownRef.current.contains(target)) {
        setIsLeagueDropdownOpen(false);
      }
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setIsSortDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        if (!searchQuery) {
          setIsSearchOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchQuery]);

  const toggleDateDropdown = () => {
    setIsDateDropdownOpen((prev) => !prev);
    setIsLeagueDropdownOpen(false);
    setIsSortDropdownOpen(false);
  };

  const toggleLeagueDropdown = () => {
    setIsLeagueDropdownOpen((prev) => !prev);
    setIsDateDropdownOpen(false);
    setIsSortDropdownOpen(false);
  };

  const toggleSortDropdown = () => {
    setIsSortDropdownOpen((prev) => !prev);
    setIsDateDropdownOpen(false);
    setIsLeagueDropdownOpen(false);
  };

  const toggleSearch = () => {
    setIsSearchOpen((prev) => {
      const next = !prev;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 60);
      }
      return next;
    });
    setIsDateDropdownOpen(false);
    setIsLeagueDropdownOpen(false);
    setIsSortDropdownOpen(false);
  };

  const handleLeagueFilterChange = (val: string) => {
    setLeagueFilter(val);
    setIsLeagueDropdownOpen(false);
    try {
      localStorage.setItem('mshindi_freematch_league_filter', val);
    } catch {}
  };

  const resetFilters = () => {
    setSearchQuery('');
    setIsSearchOpen(false);
    handleLeagueFilterChange('all');
    setSelectedDate('all');
    setActiveTab('upcoming');
    setSortBy('highlights');
  };

  const matches = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchesSnapshot, getFreeMatchesSnapshot);
  const consensusMap = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchConsensusSnapshot, getFreeMatchConsensusSnapshot);

  const builderLegs = useBetSlipStore((s) => s.builderLegs);
  const toggleBuilderLeg = useBetSlipStore((s) => s.toggleBuilderLeg);

  const handleToggleLeg = (m: FreeMatch, market: string, pick: string, odds: number, e: React.MouseEvent) => {
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
  };

  // Real-time device clock state, refreshed periodically (every 15 seconds)
  // Ensures fixtures whose kickoff time arrives drop out of Upcoming automatically without a full page reload.
  const [deviceNow, setDeviceNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setDeviceNow(Date.now());
    }, 15000); // 15-second tick

    return () => {
      clearInterval(timer);
    };
  }, []);

  // Timezone boundary dates computed from the user's real-time device clock and local timezone.
  // Updates automatically when midnight passes while the page is left open.
  const todayDateStr = useMemo(() => getDeviceLocalDateString(deviceNow), [deviceNow]);
  const tomorrowDateStr = useMemo(() => {
    const d = new Date(deviceNow);
    d.setDate(d.getDate() + 1);
    return getDeviceLocalDateString(d);
  }, [deviceNow]);

  // Scope Counts for Row 1 Segmented Control
  const counts = useMemo(() => {
    let live = 0;
    let upcoming = 0;

    matches.forEach((m) => {
      const norm = normalizeMatchStatus(m.status, m.displayClock);
      if (norm === 'in') {
        live++;
      }
      if (isUpcomingEligible(m, deviceNow)) {
        upcoming++;
      }
    });

    return {
      all: matches.length,
      live,
      upcoming,
    };
  }, [matches, deviceNow]);

  // Total matching fixtures across all dates under active tab (used inside Dates dropdown)
  const allDatesCount = useMemo(() => {
    return matches.filter((m) => {
      const norm = normalizeMatchStatus(m.status, m.displayClock);
      if (activeTab === 'live') {
        return norm === 'in';
      }
      return isUpcomingEligible(m, deviceNow);
    }).length;
  }, [matches, activeTab, deviceNow]);

  // Available dates for the Dates dropdown
  const availableDates = useMemo(() => {
    const dateMap = new Map<string, number>();
    matches.forEach((m) => {
      if (m.kickoffIso) {
        const dStr = getDeviceLocalDateString(m.kickoffIso);
        if (dStr >= todayDateStr) {
          if (activeTab === 'live') {
            const norm = normalizeMatchStatus(m.status, m.displayClock);
            if (norm === 'in') {
              dateMap.set(dStr, (dateMap.get(dStr) || 0) + 1);
            }
          } else {
            if (isUpcomingEligible(m, deviceNow)) {
              dateMap.set(dStr, (dateMap.get(dStr) || 0) + 1);
            }
          }
        }
      }
    });

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dStr, count]) => {
        let label = 'Date';
        if (dStr === todayDateStr) {
          label = 'Today';
        } else if (dStr === tomorrowDateStr) {
          label = 'Tomorrow';
        } else {
          const [y, m, d] = dStr.split('-').map(Number);
          const localDate = new Date(y, m - 1, d, 12, 0, 0);
          label = new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }).format(localDate);
        }

        return {
          dStr,
          label,
          count,
        };
      });
  }, [matches, activeTab, deviceNow, todayDateStr, tomorrowDateStr]);

  // Filter matches by selected Tab & Date
  const scopedMatches = useMemo(() => {
    return matches.filter((m) => {
      const dStr = m.kickoffIso ? getDeviceLocalDateString(m.kickoffIso) : '';
      const norm = normalizeMatchStatus(m.status, m.displayClock);

      // 1. Date filter (from Dates dropdown)
      if (selectedDate !== 'all') {
        if (dStr !== selectedDate) return false;
      }

      // 2. Active Tab: Live vs Upcoming
      if (activeTab === 'live') {
        return norm === 'in';
      }

      // Default: Upcoming tab - strictly enforce real-time upcoming cutoff
      return isUpcomingEligible(m, deviceNow);
    });
  }, [matches, activeTab, selectedDate, deviceNow]);

  // Build Continent -> Ranked Leagues map from ALL matches available in the catalog!
  const groupedContinents = useMemo(() => {
    const continentMap = new Map<ContinentId, Map<string, { count: number; rank: number }>>();

    for (const c of CONTINENTS) {
      if (c.id !== 'all') {
        continentMap.set(c.id, new Map());
      }
    }

    // Populate from all matches in catalogue to ensure UEFA Champions League is always accessible
    matches.forEach((m) => {
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
  }, [matches]);

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

  // Search and league filtering
  const query = searchQuery.trim().toLowerCase();
  const filteredMatches = scopedMatches
    .filter((m) => {
      // 1. Text Search Filter
      if (query) {
        const matchesQuery =
          m.home.toLowerCase().includes(query) ||
          m.away.toLowerCase().includes(query) ||
          m.competition.toLowerCase().includes(query) ||
          (m.country && m.country.toLowerCase().includes(query)) ||
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
               m.competition.toLowerCase() === targetLeague.toLowerCase() ||
               m.competition.toLowerCase().includes(targetLeague.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => {
      // 1. Kickoff Time: strictly chronological (earliest kickoff first)
      if (sortBy === 'time') {
        return sortUpcomingComparator(a, b);
      }
      // 2. Highlights: rank by competition prestige hierarchy (Champions League, Premier League, etc.)
      if (sortBy === 'highlights') {
        return sortHighlightsComparator(a, b);
      }
      // 3. Most Popular: consensus votes descending
      if (sortBy === 'popular') {
        const votesA = consensusMap[a.id]?.totalVotes ?? 0;
        const votesB = consensusMap[b.id]?.totalVotes ?? 0;
        if (votesB !== votesA) return votesB - votesA;
        return sortUpcomingComparator(a, b);
      }

      return sortUpcomingComparator(a, b);
    });

  const handleTabClick = (tab: ScopeTab) => {
    setActiveTab(tab);
    if (tab === 'live') {
      setSelectedDate('all');
    }
  };

  const selectedDateLabel = useMemo(() => {
    if (selectedDate === 'all') return 'All Dates';
    if (selectedDate === todayDateStr) return 'Today';
    if (selectedDate === tomorrowDateStr) return 'Tomorrow';
    const found = availableDates.find((d) => d.dStr === selectedDate);
    return found ? found.label : selectedDate;
  }, [selectedDate, todayDateStr, tomorrowDateStr, availableDates]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <SeoHead
        title="Live Football Fixtures, Odds & Consensus Slate"
        description="Browse all upcoming and live football matches across top leagues. Compare crowd consensus, odds, and build custom multi-match bet builder slips."
        canonicalUrl="https://mshindi.co.ke/free"
      />

      {/* Editorial Header */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="flex items-center justify-center gap-2.5 flex-wrap mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <Unlock size={13} className="text-[#006C54]" /> Always Free · No Paywall
          </span>
          <span className="text-slate-300 font-normal">·</span>
          <span className="inline-flex items-center gap-1.5 text-[#006C54] font-black">
            <Radio size={13} className="animate-pulse" /> Live Market Feed
          </span>
          <span className="text-slate-300 font-normal">·</span>
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <Calendar size={13} className="text-slate-400" /> All Times in EAT (UTC+3)
          </span>
        </div>

        <h1 className="font-display font-black text-3xl sm:text-5xl text-slate-900 tracking-tight uppercase">
          Match Slate &amp; Consensus
        </h1>
        <p className="text-slate-600 mt-2 max-w-3xl mx-auto text-xs sm:text-sm leading-relaxed">
          Comprehensive sportsbook-grade fixture catalogue across all supported competitions. Browse live in-play games, today&apos;s slate, and rolling upcoming fixtures with calibrated crowd consensus splits.
        </p>
      </div>

      {/* APPLE-INSPIRED MATCH FILTERS TOOLBAR (PHOTO B) */}
      <div className="max-w-4xl mx-auto mb-6 sm:mb-8">
        {/* ROW 1 — Match Status Segmented Control */}
        <div className="flex justify-center mb-3 sm:mb-4">
          <div className="inline-flex items-center bg-[#F2F2DE] border border-[#DDDDCB] rounded-full p-1 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
            {/* Upcoming Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('upcoming')}
              className={`rounded-full px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 select-none ${
                activeTab === 'upcoming'
                  ? 'bg-gradient-to-r from-[#175A38] to-[#257840] text-white shadow-[0_2px_8px_rgba(23,90,56,0.35)]'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Calendar
                size={15}
                className={`shrink-0 transition-colors ${
                  activeTab === 'upcoming' ? 'text-white' : 'text-slate-500'
                }`}
              />
              <span>Upcoming</span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold transition-colors ${
                  activeTab === 'upcoming'
                    ? 'bg-[#3E8B58] text-white'
                    : 'bg-[#E2E2CE] text-slate-700'
                }`}
              >
                {counts.upcoming}
              </span>
            </button>

            {/* Live Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('live')}
              className={`rounded-full px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 select-none ${
                activeTab === 'live'
                  ? 'bg-gradient-to-r from-[#175A38] to-[#257840] text-white shadow-[0_2px_8px_rgba(23,90,56,0.35)]'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    counts.live > 0 ? 'bg-red-400' : 'bg-slate-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ring-2 ring-white/60 ${
                    counts.live > 0 ? 'bg-red-500' : 'bg-slate-400'
                  }`}
                />
              </span>
              <span>Live</span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold transition-colors ${
                  activeTab === 'live'
                    ? 'bg-[#3E8B58] text-white'
                    : 'bg-[#E2E2CE] text-slate-700'
                }`}
              >
                {counts.live}
              </span>
            </button>
          </div>
        </div>

        {/* ROW 2 — Filters and Search Toolbar */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap px-1">
          {/* Control 1: Dates Dropdown */}
          <div className="relative" ref={dateDropdownRef}>
            <button
              type="button"
              onClick={toggleDateDropdown}
              className={`h-10 sm:h-11 px-3.5 sm:px-4 rounded-full bg-[#FFFFF0] border text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_8px_rgba(0,108,84,0.08)] cursor-pointer select-none ${
                isDateDropdownOpen || selectedDate !== 'all'
                  ? 'border-[#006C54] text-[#006C54] ring-2 ring-[#006C54]/15'
                  : 'border-[#DCDCC8] text-slate-800 hover:border-[#006C54]'
              }`}
              aria-expanded={isDateDropdownOpen}
              aria-label="Filter by match date"
            >
              <Calendar size={15} className="text-[#006C54] shrink-0" />
              <span>{selectedDate === 'all' ? 'Dates' : selectedDateLabel}</span>
              {selectedDate !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#006C54] shrink-0" />
              )}
              <ChevronDown
                size={14}
                className={`text-slate-500 transition-transform duration-200 shrink-0 ${
                  isDateDropdownOpen ? 'rotate-180 text-[#006C54]' : ''
                }`}
              />
            </button>

            {/* Dates Dropdown Menu */}
            {isDateDropdownOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 w-72 sm:w-80 bg-[#FFFFF0] border border-[#DCDCC8] rounded-2xl shadow-2xl py-2 z-50 max-h-[380px] overflow-y-auto text-xs divide-y divide-[#E6E6D2]">
                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate('all');
                      setIsDateDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      selectedDate === 'all'
                        ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                        : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Calendar size={13} className="text-[#006C54]" /> All Dates
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F5F5E4] border border-[#E6E6D2] text-slate-600 font-bold">
                        {allDatesCount}
                      </span>
                      {selectedDate === 'all' && <Check size={14} className="text-[#006C54]" />}
                    </div>
                  </button>
                </div>

                <div className="p-1 space-y-0.5">
                  {availableDates.map((d) => {
                    const isSelected = selectedDate === d.dStr;
                    return (
                      <button
                        key={d.dStr}
                        type="button"
                        onClick={() => {
                          setSelectedDate(d.dStr);
                          setIsDateDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                            : 'hover:bg-[#F5F5E4] text-slate-700 font-medium'
                        }`}
                      >
                        <span className="truncate pr-2 font-medium">{d.label}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                            {d.count}
                          </span>
                          {isSelected && <Check size={13} className="text-[#006C54]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Control 2: Leagues Dropdown */}
          <div className="relative" ref={leagueDropdownRef}>
            <button
              type="button"
              onClick={toggleLeagueDropdown}
              className={`h-10 sm:h-11 px-3.5 sm:px-4 rounded-full bg-[#FFFFF0] border text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_8px_rgba(0,108,84,0.08)] cursor-pointer select-none max-w-[200px] sm:max-w-[260px] ${
                isLeagueDropdownOpen || leagueFilter !== 'all'
                  ? 'border-[#006C54] text-[#006C54] ring-2 ring-[#006C54]/15'
                  : 'border-[#DCDCC8] text-slate-800 hover:border-[#006C54]'
              }`}
              aria-expanded={isLeagueDropdownOpen}
              aria-label="Filter by competition or league"
            >
              <Trophy size={15} className="text-[#006C54] shrink-0" />
              <span className="truncate">
                {leagueFilter === 'all' ? 'Leagues' : currentLeagueLabel.title}
              </span>
              {leagueFilter !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#006C54] shrink-0" />
              )}
              <ChevronDown
                size={14}
                className={`text-slate-500 transition-transform duration-200 shrink-0 ${
                  isLeagueDropdownOpen ? 'rotate-180 text-[#006C54]' : ''
                }`}
              />
            </button>

            {/* Leagues Dropdown Menu */}
            {isLeagueDropdownOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 w-72 sm:w-96 bg-[#FFFFF0] border border-[#DCDCC8] rounded-2xl shadow-2xl py-2 z-50 max-h-[380px] overflow-y-auto text-xs divide-y divide-[#E6E6D2]">
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
                        {scopedMatches.length}
                      </span>
                      {leagueFilter === 'all' && <Check size={14} className="text-[#006C54]" />}
                    </div>
                  </button>
                </div>

                {groupedContinents.map((continent) => (
                  <div key={continent.id} className="p-1">
                    <div className="px-3 py-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span>{continent.flag} {continent.name}</span>
                      <span>{continent.totalCount} {continent.totalCount === 1 ? 'fixture' : 'fixtures'}</span>
                    </div>

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

                    {continent.leagues.map((league) => {
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
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
                              {league.count}
                            </span>
                            {isSelected && <Check size={13} className="text-[#006C54]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Control 3: Highlights (Sort) Dropdown */}
          <div className="relative" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={toggleSortDropdown}
              className={`h-10 sm:h-11 px-3.5 sm:px-4 rounded-full bg-[#FFFFF0] border text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_8px_rgba(0,108,84,0.08)] cursor-pointer select-none ${
                isSortDropdownOpen || sortBy !== 'highlights'
                  ? 'border-[#006C54] text-[#006C54] ring-2 ring-[#006C54]/15'
                  : 'border-[#DCDCC8] text-slate-800 hover:border-[#006C54]'
              }`}
              aria-expanded={isSortDropdownOpen}
              aria-label="Sort and highlight options"
            >
              <Play size={13} className="text-[#006C54] fill-[#006C54] shrink-0" />
              <span>Highlights</span>
              {sortBy !== 'highlights' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#006C54] shrink-0" />
              )}
              <ChevronDown
                size={14}
                className={`text-slate-500 transition-transform duration-200 shrink-0 ${
                  isSortDropdownOpen ? 'rotate-180 text-[#006C54]' : ''
                }`}
              />
            </button>

            {/* Highlights Sort Dropdown Menu */}
            {isSortDropdownOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 sm:right-0 sm:left-auto sm:translate-x-0 mt-2 w-64 sm:w-72 bg-[#FFFFF0] border border-[#DCDCC8] rounded-2xl shadow-2xl py-2 z-50 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSortBy('highlights');
                    setIsSortDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                    sortBy === 'highlights'
                      ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                      : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-500 shrink-0" />
                    <span>Competition Prestige (Highlights)</span>
                  </span>
                  {sortBy === 'highlights' && <Check size={14} className="text-[#006C54]" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSortBy('time');
                    setIsSortDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                    sortBy === 'time'
                      ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                      : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-600 shrink-0" />
                    <span>Kickoff Time (Earliest First)</span>
                  </span>
                  {sortBy === 'time' && <Check size={14} className="text-[#006C54]" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSortBy('popular');
                    setIsSortDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                    sortBy === 'popular'
                      ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                      : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Flame size={14} className="text-orange-500 shrink-0" />
                    <span>Ranked by Activity (Popular)</span>
                  </span>
                  {sortBy === 'popular' && <Check size={14} className="text-[#006C54]" />}
                </button>
              </div>
            )}
          </div>

          {/* Control 4: Search Icon Button */}
          <div className="relative" ref={searchContainerRef}>
            <button
              type="button"
              onClick={toggleSearch}
              className={`h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-[#FFFFF0] border flex items-center justify-center shrink-0 transition-all shadow-[0_1px_4px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_8px_rgba(0,108,84,0.08)] cursor-pointer select-none ${
                isSearchOpen || searchQuery
                  ? 'border-[#006C54] bg-[#006C54]/10 text-[#006C54] ring-2 ring-[#006C54]/15'
                  : 'border-[#DCDCC8] text-[#006C54] hover:border-[#006C54]'
              }`}
              aria-label="Search matches"
              title="Search matches"
            >
              <Search size={16} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* EXPANDABLE SEARCH BAR (Apple-Style) */}
        {(isSearchOpen || searchQuery) && (
          <div className="w-full max-w-md mx-auto mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="relative flex items-center bg-[#FFFFF0] border border-[#006C54]/40 rounded-full shadow-md focus-within:border-[#006C54] focus-within:ring-2 focus-within:ring-[#006C54]/15 transition-all">
              <Search size={15} className="absolute left-3.5 text-[#006C54] pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teams, competition or country..."
                className="w-full bg-transparent pl-9 sm:pl-10 pr-16 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="p-1 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded-full hover:bg-slate-200/50 cursor-pointer"
                  title="Close search bar"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE FILTER TAGS ROW */}
        {(selectedDate !== 'all' || leagueFilter !== 'all' || searchQuery || sortBy !== 'highlights') && (
          <div className="flex items-center justify-center flex-wrap gap-1.5 mt-3 text-xs">
            {selectedDate !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#006C54]/10 border border-[#006C54]/20 text-[#006C54] font-semibold text-[11px]">
                <span>Date: {selectedDateLabel}</span>
                <button
                  type="button"
                  onClick={() => setSelectedDate('all')}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                  aria-label="Clear date filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {leagueFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#006C54]/10 border border-[#006C54]/20 text-[#006C54] font-semibold text-[11px]">
                <span>League: {currentLeagueLabel.title}</span>
                <button
                  type="button"
                  onClick={() => handleLeagueFilterChange('all')}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                  aria-label="Clear league filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#006C54]/10 border border-[#006C54]/20 text-[#006C54] font-semibold text-[11px]">
                <span>Search: &quot;{searchQuery}&quot;</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                  aria-label="Clear search filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {sortBy !== 'highlights' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200/80 border border-slate-300 text-slate-700 font-semibold text-[11px]">
                <span>Sorted: {sortBy === 'time' ? 'Kickoff Time' : 'Popular'}</span>
                <button
                  type="button"
                  onClick={() => setSortBy('highlights')}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                  aria-label="Reset sort to prestige"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] font-bold text-slate-500 hover:text-red-600 underline ml-1 cursor-pointer"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* FIXTURES LIST / SKELETON LOADER / RESILIENT EMPTY STATES */}
      {matches.length === 0 && (getIsFreeMatchesSyncing() || !getHasFreeMatchesSynced()) ? (
        <MatchListSkeleton count={6} />
      ) : activeTab === 'live' && filteredMatches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto flex flex-col items-center gap-3 shadow-xs">
          <Radio size={36} className="text-slate-400 animate-pulse" />
          <h3 className="font-display font-extrabold text-lg text-slate-900 uppercase tracking-tight">No Matches Currently In-Play</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            There are no live games in progress right now. Live matches update automatically with realtime clocks and scoreboards as soon as they kick off!
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => {
                setActiveTab('upcoming');
                setSelectedDate('all');
              }}
              className="inline-flex items-center gap-2 bg-[#006C54] hover:bg-[#005441] text-white font-black text-xs uppercase tracking-wider px-5 h-10 rounded-md shadow-xs transition-colors cursor-pointer active:scale-95"
            >
              Browse Upcoming ({counts.upcoming})
            </button>
            <button
              onClick={() => {
                setActiveTab('upcoming');
                setSelectedDate(todayDateStr);
              }}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider px-4 h-10 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              Today&apos;s Slate
            </button>
          </div>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto flex flex-col items-center gap-3 shadow-xs">
          <SearchX size={36} className="text-[#006C54]" />
          <h3 className="font-display font-extrabold text-lg text-slate-900 uppercase tracking-tight">No Fixtures Match Current Filters</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            No matches found for &quot;<strong className="text-slate-900">{searchQuery || currentLeagueLabel.title}</strong>&quot; under {activeTab} view. Try clearing filters to view all upcoming fixtures across 90+ supported competitions.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2 mt-3">
            {leagueFilter !== 'all' && (
              <button
                onClick={() => {
                  setActiveTab('upcoming');
                  setSelectedDate('all');
                }}
                className="inline-flex items-center gap-2 bg-[#F5F5E4] hover:bg-[#E6E6D2] text-[#006C54] font-black text-xs uppercase tracking-wider px-4 h-10 rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                View All {currentLeagueLabel.title} Across All Dates
              </button>
            )}
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-2 bg-[#006C54] hover:bg-[#005441] text-white font-black text-xs uppercase tracking-wider px-5 h-10 rounded-md shadow-xs transition-colors active:scale-95 cursor-pointer"
            >
              <RotateCcw size={14} /> Reset All Filters ({counts.all} matches)
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {filteredMatches.map((m) => (
            <FixtureSportCard
              key={m.id}
              match={m}
              consensus={
                consensusMap[m.id] || {
                  homePct: m.homePct || 33,
                  drawPct: m.drawPct || 34,
                  awayPct: m.awayPct || 33,
                  totalVotes: 142,
                  picks: [],
                  matchId: m.id,
                }
              }
              builderLegs={builderLegs}
              onToggleLeg={(market, pick, odds, e) => handleToggleLeg(m, market, pick, odds, e)}
              onOpenBetBuilder={(matchData) => setSelectedMatchForBuilder(matchData)}
            />
          ))}
        </div>
      )}

      {/* Quick Bet Builder Modal */}
      {selectedMatchForBuilder && (
        <QuickBetBuilderModal
          match={selectedMatchForBuilder}
          isOpen={Boolean(selectedMatchForBuilder)}
          onClose={() => setSelectedMatchForBuilder(null)}
        />
      )}
    </div>
  );
}
