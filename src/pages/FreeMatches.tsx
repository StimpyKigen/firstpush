import { useState, useMemo, useRef, useEffect, useSyncExternalStore } from 'react';
import {
  Unlock, Calendar, Search, X, SearchX,
  Check, ChevronDown, RotateCcw,
  Radio, CheckCircle2
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
import {
  SPORTSCORE_COUNTRY_DIRECTORY_CONFIG,
  buildSportScoreCountryDirectory,
  resolveSportScoreDirectoryId,
} from '../lib/leagueDirectory';
import FixtureSportCard from '../components/FixtureSportCard';
import { normalizeMatchStatus, isLiveMatch, isCompletedMatch } from '../lib/matchStatus';
import {
  sortHighlightsComparator,
  sortUpcomingComparator,
  isUpcomingEligible,
  isHighlightsEligible,
  getDeviceLocalDateString,
} from '../lib/competitionPriority';

type ScopeTab = 'highlights' | 'live' | 'upcoming';

export default function FreeMatches() {
  const [activeTab, setActiveTab] = useState<ScopeTab>('highlights');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMatchForBuilder, setSelectedMatchForBuilder] = useState<MatchForBuilder | null>(null);

  // League directory filter
  const [leagueFilter, setLeagueFilter] = useState<string>(() => {
    try {
      const val = localStorage.getItem('mshindi_freematch_league_filter') || 'all';
      if (val !== 'all' && !SPORTSCORE_COUNTRY_DIRECTORY_CONFIG.some((entry) => entry.id === val)) {
        return 'all';
      }
      return val;
    } catch {
      return 'all';
    }
  });

  // Apple-inspired toolbar dropdown & popover states
  const [selectedSubLeague, setSelectedSubLeague] = useState<string>('all');
  const [expandedCountryIds, setExpandedCountryIds] = useState<string[]>([]);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isLeagueDropdownOpen, setIsLeagueDropdownOpen] = useState(false);
  const [leagueSearchQuery, setLeagueSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const dateDropdownRef = useRef<HTMLDivElement>(null);
  const leagueDropdownRef = useRef<HTMLDivElement>(null);
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
        setLeagueSearchQuery('');
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
  };

  const toggleLeagueDropdown = () => {
    setIsLeagueDropdownOpen((prev) => !prev);
    setIsDateDropdownOpen(false);
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
  };

  const handleLeagueFilterChange = (val: string, subLeague: string = 'all') => {
    setLeagueFilter(val);
    setSelectedSubLeague(subLeague);
    setIsLeagueDropdownOpen(false);
    setLeagueSearchQuery('');
    try {
      localStorage.setItem('mshindi_freematch_league_filter', val);
    } catch {}
  };

  const resetFilters = () => {
    setSearchQuery('');
    setLeagueSearchQuery('');
    setIsSearchOpen(false);
    setSelectedSubLeague('all');
    handleLeagueFilterChange('all');
    setSelectedDate('all');
    setActiveTab('highlights');
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
    let highlights = 0;

    matches.forEach((m) => {
      if (isLiveMatch(m, deviceNow)) {
        live++;
      }
      if (isUpcomingEligible(m, deviceNow)) {
        upcoming++;
      }
      if (isHighlightsEligible(m)) {
        highlights++;
      }
    });

    return {
      all: matches.length,
      live,
      upcoming,
      highlights,
    };
  }, [matches, deviceNow]);

  // Completed Matches of Today Count
  const completedTodayCount = useMemo(() => {
    return matches.filter((m) => {
      if (!isCompletedMatch(m)) return false;
      const dStr = m.kickoffIso ? getDeviceLocalDateString(m.kickoffIso) : '';
      return dStr === todayDateStr;
    }).length;
  }, [matches, todayDateStr]);

  // Total matching fixtures across all dates (used inside Dates dropdown)
  // Whatever toggle is active should not affect the filter dropdowns, the dropdowns should always cater for all fixtures available
  const allDatesCount = useMemo(() => {
    return matches.length;
  }, [matches]);

  // Available dates for the Dates dropdown (independent of active tab toggle)
  const availableDates = useMemo(() => {
    const dateMap = new Map<string, number>();
    matches.forEach((m) => {
      if (m.kickoffIso) {
        const dStr = getDeviceLocalDateString(m.kickoffIso);
        if (dStr >= todayDateStr) {
          dateMap.set(dStr, (dateMap.get(dStr) || 0) + 1);
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
  }, [matches, todayDateStr, tomorrowDateStr]);

  // Filter matches by selected Tab & Date
  const scopedMatches = useMemo(() => {
    return matches.filter((m) => {
      // Strictly exclude any Simulated Reality / SRL fixtures
      const text = `${m.competition || ''} ${m.leagueCode || ''} ${m.country || ''} ${m.home || ''} ${m.away || ''} ${m.id || ''}`.toLowerCase();
      if (text.includes('simulated reality') || /\b(srl)\b/i.test(text)) {
        return false;
      }

      const dStr = m.kickoffIso ? getDeviceLocalDateString(m.kickoffIso) : '';

      // 1. Explicit 'Completed' filter from Dates dropdown (finished matches of today)
      if (selectedDate === 'completed') {
        if (!isCompletedMatch(m)) return false;
        return dStr === todayDateStr;
      }

      // 2. Standard Date filter (from Dates dropdown)
      if (selectedDate !== 'all') {
        if (dStr !== selectedDate) return false;
      }

      // 3. Active Tab: Live vs Highlights vs Upcoming
      if (activeTab === 'live') {
        return isLiveMatch(m, deviceNow);
      }

      if (activeTab === 'highlights') {
        return isHighlightsEligible(m);
      }

      // Default: Upcoming tab - strictly enforce real-time upcoming cutoff
      return isUpcomingEligible(m, deviceNow);
    });
  }, [matches, activeTab, selectedDate, deviceNow, todayDateStr]);

  // Build SportScore Country Directory with dynamic fixture counts across all available matches (independent of active tab)
  const directoryData = useMemo(() => {
    return buildSportScoreCountryDirectory(matches, leagueSearchQuery);
  }, [matches, leagueSearchQuery]);

  // Current selected directory label for the dropdown trigger
  const selectedDirectoryLabel = useMemo(() => {
    if (leagueFilter === 'all') return 'All Competitions';
    const found =
      directoryData.rows.find((entry) => entry.id === leagueFilter) ||
      SPORTSCORE_COUNTRY_DIRECTORY_CONFIG.find((entry) => entry.id === leagueFilter);
    const countryLabel = found ? found.label : (leagueFilter.charAt(0).toUpperCase() + leagueFilter.slice(1));
    if (selectedSubLeague && selectedSubLeague !== 'all') {
      return `${countryLabel}: ${selectedSubLeague}`;
    }
    return countryLabel;
  }, [leagueFilter, directoryData.rows, selectedSubLeague]);

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

      // 2. SportScore Country Directory Filter
      if (leagueFilter !== 'all') {
        const dirId = resolveSportScoreDirectoryId(m);
        if (dirId !== leagueFilter) return false;

        // Sub-league filter
        if (selectedSubLeague && selectedSubLeague !== 'all') {
          if (m.competition !== selectedSubLeague) return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      // Completed: latest kickoff first (most recent finished matches at top)
      if (selectedDate === 'completed') {
        const timeA = a.kickoffIso ? new Date(a.kickoffIso).getTime() : 0;
        const timeB = b.kickoffIso ? new Date(b.kickoffIso).getTime() : 0;
        return timeB - timeA;
      }
      // Upcoming: strictly chronological by kickoff time (earliest kickoff first)
      if (activeTab === 'upcoming') {
        return sortUpcomingComparator(a, b);
      }
      // Highlights & Live: rank by competition prestige hierarchy
      return sortHighlightsComparator(a, b);
    });

  // Group matches by sectored leagues when a country (like England) is selected
  const sectoredLeagueGroups = useMemo(() => {
    const groups: { league: string; matches: FreeMatch[] }[] = [];
    const map = new Map<string, FreeMatch[]>();

    filteredMatches.forEach((m) => {
      const comp = m.competition || 'Other Competition';
      if (!map.has(comp)) {
        map.set(comp, []);
      }
      map.get(comp)!.push(m);
    });

    map.forEach((matches, league) => {
      groups.push({ league, matches });
    });

    return groups;
  }, [filteredMatches]);

  const visibleSectors = useMemo(() => {
    if (selectedSubLeague === 'all') return sectoredLeagueGroups;
    return sectoredLeagueGroups.filter((g) => g.league === selectedSubLeague);
  }, [sectoredLeagueGroups, selectedSubLeague]);

  const handleTabClick = (tab: ScopeTab) => {
    setActiveTab(tab);
    if (tab === 'live' || selectedDate === 'completed') {
      setSelectedDate('all');
    }
  };

  const selectedDateLabel = useMemo(() => {
    if (selectedDate === 'completed') return 'Completed';
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
        <div className="flex items-center justify-center gap-2.5 flex-wrap mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <Unlock size={13} className="text-[#006C54]" /> Always Free · No Paywall
          </span>
          <span className="text-slate-300 font-normal">·</span>
          <span className="inline-flex items-center gap-1.5 text-[#006C54] font-bold">
            <Radio size={13} className="animate-pulse" /> Live Market Feed
          </span>
          <span className="text-slate-300 font-normal">·</span>
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <Calendar size={13} className="text-slate-400" /> All Times in EAT (UTC+3)
          </span>
        </div>

        <h1 className="font-display font-bold text-3xl sm:text-5xl text-slate-900 tracking-tight uppercase">
          Match Slate &amp; Consensus
        </h1>
        <p className="text-slate-600 mt-2 max-w-3xl mx-auto text-xs sm:text-sm leading-relaxed">
          Comprehensive sportsbook-grade fixture catalogue across all supported competitions. Browse live in-play games, today&apos;s slate, and rolling upcoming fixtures with calibrated crowd consensus splits.
        </p>
      </div>

      {/* APPLE-INSPIRED MATCH FILTERS TOOLBAR (PHOTO B) */}
      <div className="max-w-4xl mx-auto mb-6 sm:mb-8">
        {/* ROW 1 — Match Status Inline Tab Switcher */}
        <div className="flex justify-center mb-3 sm:mb-4">
          <div className="inline-flex items-center gap-2.5 sm:gap-4 py-1 px-2.5 sm:px-3">
            {/* Highlights Tab (Default on page load) */}
            <button
              type="button"
              onClick={() => handleTabClick('highlights')}
              className={`text-xs sm:text-[13px] transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none ${
                activeTab === 'highlights'
                  ? 'font-bold text-[#006C54]'
                  : 'font-medium text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Highlights</span>
              <span
                className={`text-[11px] sm:text-[11px] tabular-nums px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                  activeTab === 'highlights'
                    ? 'bg-[#E8F5EE] text-[#006C54]'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {counts.highlights}
              </span>
            </button>

            {/* Vertical Divider 1 */}
            <div className="h-3 sm:h-3.5 w-[1px] bg-slate-300 shrink-0" aria-hidden="true" />

            {/* Live Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('live')}
              className={`text-xs sm:text-[13px] transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none ${
                activeTab === 'live'
                  ? 'font-bold text-[#006C54]'
                  : 'font-medium text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    counts.live > 0 ? 'bg-red-400' : 'bg-slate-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 ${
                    counts.live > 0 ? 'bg-red-500' : 'bg-slate-400'
                  }`}
                />
              </span>
              <span>Live</span>
              <span
                className={`text-[11px] sm:text-[11px] tabular-nums px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                  activeTab === 'live'
                    ? 'bg-[#E8F5EE] text-[#006C54]'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {counts.live}
              </span>
            </button>

            {/* Vertical Divider 2 */}
            <div className="h-3 sm:h-3.5 w-[1px] bg-slate-300 shrink-0" aria-hidden="true" />

            {/* Upcoming Tab */}
            <button
              type="button"
              onClick={() => handleTabClick('upcoming')}
              className={`text-xs sm:text-[13px] transition-colors flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none ${
                activeTab === 'upcoming'
                  ? 'font-bold text-[#006C54]'
                  : 'font-medium text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Upcoming</span>
              <span
                className={`text-[11px] sm:text-[11px] tabular-nums px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                  activeTab === 'upcoming'
                    ? 'bg-[#E8F5EE] text-[#006C54]'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {counts.upcoming}
              </span>
            </button>
          </div>
        </div>

        {/* ROW 2 — Filters and Search Toolbar (Two dropdowns + borderless search icon) */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 flex-wrap sm:flex-nowrap px-1">
          {/* Control 1: Dates Dropdown */}
          <div className="relative" ref={dateDropdownRef}>
            <button
              type="button"
              onClick={toggleDateDropdown}
              className={`h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-full bg-[#FFFFF0] border text-xs sm:text-[13px] font-semibold flex items-center gap-1.5 sm:gap-2 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_6px_rgba(0,108,84,0.08)] cursor-pointer select-none ${
                isDateDropdownOpen || selectedDate !== 'all'
                  ? 'border-[#006C54] text-[#006C54] ring-2 ring-[#006C54]/15'
                  : 'border-[#DCDCC8] text-slate-800 hover:border-[#006C54]'
              }`}
              aria-expanded={isDateDropdownOpen}
              aria-label="Filter by match date"
            >
              <Calendar size={13.5} className="text-[#006C54] shrink-0" />
              <span>{selectedDate === 'all' ? 'Dates' : selectedDateLabel}</span>
              {selectedDate !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#006C54] shrink-0" />
              )}
              <ChevronDown
                size={13}
                className={`text-slate-500 transition-transform duration-200 shrink-0 ${
                  isDateDropdownOpen ? 'rotate-180 text-[#006C54]' : ''
                }`}
              />
            </button>

            {/* Dates Dropdown Menu */}
            {isDateDropdownOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 w-72 sm:w-80 bg-[#FFFFF0] border border-[#DCDCC8] rounded-2xl shadow-2xl py-2 z-50 max-h-[380px] overflow-y-auto text-xs divide-y divide-[#E6E6D2]">
                {/* 1. FIRST OPTION: COMPLETED (Finished matches of today) */}
                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate('completed');
                      setIsDateDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      selectedDate === 'completed'
                        ? 'bg-[#006C54]/10 text-[#006C54] font-bold'
                        : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-[#006C54]" /> Completed
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded bg-[#F5F5E4] border border-[#E6E6D2] text-[#006C54] font-bold">
                        {completedTodayCount}
                      </span>
                      {selectedDate === 'completed' && <Check size={14} className="text-[#006C54]" />}
                    </div>
                  </button>
                </div>

                {/* 2. ALL DATES */}
                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate('all');
                      setIsDateDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      selectedDate === 'all'
                        ? 'bg-[#006C54]/10 text-[#006C54] font-bold'
                        : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Calendar size={13} className="text-[#006C54]" /> All Dates
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded bg-[#F5F5E4] border border-[#E6E6D2] text-slate-600 font-bold">
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
                            ? 'bg-[#006C54]/10 text-[#006C54] font-bold'
                            : 'hover:bg-[#F5F5E4] text-slate-700 font-medium'
                        }`}
                      >
                        <span className="truncate pr-2 font-medium">{d.label}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] tabular-nums px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-bold">
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

          {/* Control 2: SportScore Country Directory Dropdown */}
          <div className="relative" ref={leagueDropdownRef}>
            <button
              type="button"
              onClick={toggleLeagueDropdown}
              className={`h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-full bg-[#FFFFF0] border text-xs sm:text-[13px] font-semibold flex items-center gap-1.5 sm:gap-2 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_2px_6px_rgba(0,108,84,0.08)] cursor-pointer select-none max-w-[200px] sm:max-w-[250px] ${
                isLeagueDropdownOpen || leagueFilter !== 'all'
                  ? 'border-[#006C54] text-[#006C54] ring-2 ring-[#006C54]/15'
                  : 'border-[#DCDCC8] text-slate-800 hover:border-[#006C54]'
              }`}
              aria-expanded={isLeagueDropdownOpen}
              aria-label="Filter by country or competition"
            >
              <span className="truncate">
                {selectedDirectoryLabel}
              </span>
              {leagueFilter !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#006C54] shrink-0" />
              )}
              <ChevronDown
                size={13}
                className={`text-slate-500 transition-transform duration-200 shrink-0 ${
                  isLeagueDropdownOpen ? 'rotate-180 text-[#006C54]' : ''
                }`}
              />
            </button>

            {/* SportScore Country Directory Menu */}
            {isLeagueDropdownOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 w-72 sm:w-80 bg-[#FFFFF0] border border-[#DCDCC8] rounded-2xl shadow-2xl z-50 max-h-[380px] overflow-hidden flex flex-col text-xs">
                {/* Search Input Header inside dropdown */}
                <div className="p-2 border-b border-[#E6E6D2] bg-[#FBFBF0] shrink-0">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={leagueSearchQuery}
                      onChange={(e) => setLeagueSearchQuery(e.target.value)}
                      placeholder="Search country or competition..."
                      className="w-full bg-[#FFFFF0] border border-[#DCDCC8] rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54]"
                      autoFocus
                    />
                    {leagueSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setLeagueSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title="Clear search"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Scrollable Directory Rows */}
                <div className="overflow-y-auto divide-y divide-[#E6E6D2]/60 p-1 flex-1">
                  {/* All Competitions Row */}
                  {(!leagueSearchQuery || 'all competitions'.includes(leagueSearchQuery.toLowerCase())) && (
                    <button
                      type="button"
                      onClick={() => handleLeagueFilterChange('all')}
                      className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between transition-colors cursor-pointer ${
                        leagueFilter === 'all'
                          ? 'bg-[#006C54]/10 text-[#006C54] font-bold'
                          : 'hover:bg-[#F5F5E4] text-slate-800 font-medium'
                      }`}
                    >
                      <span className="truncate pr-2">All Competitions</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] tabular-nums text-slate-500">
                          {directoryData.totalMatches}
                        </span>
                        {leagueFilter === 'all' && <Check size={13} className="text-[#006C54]" />}
                      </div>
                    </button>
                  )}

                  {/* SportScore Country / Category Rows */}
                  {directoryData.rows.map((row) => {
                    const isSelected = leagueFilter === row.id && selectedSubLeague === 'all';
                    const isAnySubSelected = leagueFilter === row.id;
                    const hasMultipleLeagues = row.leagues && row.leagues.length > 1;
                    const isExpanded = expandedCountryIds.includes(row.id);

                    return (
                      <div key={row.id} className="transition-colors">
                        {/* Country Row */}
                        <div
                          className={`w-full px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                            isAnySubSelected
                              ? 'bg-[#006C54]/10 text-[#006C54] font-bold'
                              : 'hover:bg-[#F5F5E4] text-slate-800 font-medium'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (hasMultipleLeagues) {
                                setExpandedCountryIds((prev) =>
                                  prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]
                                );
                              } else {
                                handleLeagueFilterChange(row.id, 'all');
                              }
                            }}
                            className="flex-1 text-left flex items-center gap-2 truncate cursor-pointer mr-2"
                          >
                            <span className="truncate">{row.label}</span>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] tabular-nums text-slate-500">{row.count}</span>
                            {isSelected && <Check size={13} className="text-[#006C54]" />}
                            {hasMultipleLeagues && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedCountryIds((prev) =>
                                    prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]
                                  );
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 transition-transform cursor-pointer"
                                title={isExpanded ? 'Collapse leagues' : 'Expand leagues'}
                              >
                                <ChevronDown
                                  size={13}
                                  className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#006C54]' : ''}`}
                                />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded Accordion Subsection for Countries with Multiple Leagues */}
                        {hasMultipleLeagues && isExpanded && (
                          <div className="ml-4 pl-3 border-l-2 border-[#006C54]/25 my-1 space-y-0.5 animate-fade-in">
                            {/* Display only the specific leagues (no 'All [Country] Leagues' item) */}
                            {row.leagues.map((lg) => {
                              const isSubSelected = leagueFilter === row.id && selectedSubLeague === lg.league;
                              return (
                                <button
                                  key={lg.league}
                                  type="button"
                                  onClick={() => handleLeagueFilterChange(row.id, lg.league)}
                                  className={`w-full px-2.5 py-1.5 rounded-md text-left flex items-center justify-between text-[11px] transition-colors cursor-pointer ${
                                    isSubSelected
                                      ? 'bg-[#006C54] text-white font-bold'
                                      : 'hover:bg-[#F5F5E4] text-slate-700 font-medium'
                                  }`}
                                >
                                  <span className="truncate pr-2">{lg.league}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`tabular-nums text-[11px] ${isSubSelected ? 'text-white/80' : 'text-slate-500'}`}>
                                      {lg.count}
                                    </span>
                                    {isSubSelected && <Check size={12} className="text-white" />}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {directoryData.rows.length === 0 && (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      No country or competition matching &quot;{leagueSearchQuery}&quot;
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Control 3: Search Icon Button (Borderless, clean icon) */}
          <div className="relative" ref={searchContainerRef}>
            <button
              type="button"
              onClick={toggleSearch}
              className={`p-1.5 sm:p-2 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer select-none ${
                isSearchOpen || searchQuery
                  ? 'bg-[#006C54]/15 text-[#006C54]'
                  : 'text-[#006C54] hover:text-[#005441] hover:bg-[#006C54]/10'
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
        {(selectedDate !== 'all' || leagueFilter !== 'all' || searchQuery) && (
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
                <span>Competition: {selectedDirectoryLabel}</span>
                <button
                  type="button"
                  onClick={() => handleLeagueFilterChange('all')}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                  aria-label="Clear competition filter"
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

      {/* SUB-LEAGUE SECTOR PILLS (For countries with multiple leagues like England) */}
      {leagueFilter !== 'all' && sectoredLeagueGroups.length > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap mb-6 max-w-4xl mx-auto animate-fade-in">
          <button
            type="button"
            onClick={() => setSelectedSubLeague('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
              selectedSubLeague === 'all'
                ? 'bg-[#006C54] text-white shadow-xs'
                : 'bg-[#FFFFF0] border border-[#DCDCC8] text-slate-700 hover:border-[#006C54]'
            }`}
          >
            <span>All {selectedDirectoryLabel} Leagues</span>
            <span
              className={`text-[11px] tabular-nums px-1.5 py-0.2 rounded-full font-bold ${
                selectedSubLeague === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {filteredMatches.length}
            </span>
          </button>

          {sectoredLeagueGroups.map((g) => {
            const isSelected = selectedSubLeague === g.league;
            return (
              <button
                key={g.league}
                type="button"
                onClick={() => setSelectedSubLeague(g.league)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-[#006C54] text-white shadow-xs'
                    : 'bg-[#FFFFF0] border border-[#DCDCC8] text-slate-700 hover:border-[#006C54]'
                }`}
              >
                <span>{g.league}</span>
                <span
                  className={`text-[11px] tabular-nums px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {g.matches.length}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* FIXTURES LIST / SKELETON LOADER / RESILIENT EMPTY STATES */}
      {matches.length === 0 && (getIsFreeMatchesSyncing() || !getHasFreeMatchesSynced()) ? (
        <MatchListSkeleton count={6} />
      ) : matches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto flex flex-col items-center gap-3 shadow-xs">
          <Calendar size={36} className="text-[#006C54]" />
          <h3 className="font-display font-bold text-lg text-slate-900 uppercase tracking-tight">No Fixtures Currently Scheduled</h3>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md">
            The match slate is clean. Platform administrators can upload a fixtures PDF in the Admin Console to instantly publish fixtures and consensus odds.
          </p>
        </div>
      ) : activeTab === 'live' && filteredMatches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto flex flex-col items-center gap-3 shadow-xs">
          <Radio size={36} className="text-slate-400 animate-pulse" />
          <h3 className="font-display font-bold text-lg text-slate-900 uppercase tracking-tight">No Matches Currently In-Play</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            There are no live games in progress right now. Live matches update automatically with realtime clocks and scoreboards as soon as they kick off!
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => {
                setActiveTab('upcoming');
                setSelectedDate('all');
              }}
              className="inline-flex items-center gap-2 bg-[#006C54] hover:bg-[#005441] text-white font-bold text-xs uppercase tracking-wide px-5 h-10 rounded-md shadow-xs transition-colors cursor-pointer active:scale-95"
            >
              Browse Upcoming ({counts.upcoming})
            </button>
            <button
              onClick={() => {
                setActiveTab('upcoming');
                setSelectedDate(todayDateStr);
              }}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs uppercase tracking-wide px-4 h-10 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              Today&apos;s Slate
            </button>
          </div>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-xl mx-auto flex flex-col items-center gap-3 shadow-xs">
          {selectedDate === 'completed' ? (
            <>
              <CheckCircle2 size={36} className="text-[#006C54]" />
              <h3 className="font-display font-bold text-lg text-slate-900 uppercase tracking-tight">No Completed Matches Yet Today</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Finished fixtures will automatically appear here with their final scores and FT badges as matches conclude throughout the day.
              </p>
            </>
          ) : (
            <>
              <SearchX size={36} className="text-[#006C54]" />
              <h3 className="font-display font-bold text-lg text-slate-900 uppercase tracking-tight">No Fixtures Match Current Filters</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                No matches found for &quot;<strong className="text-slate-900">{searchQuery || selectedDirectoryLabel}</strong>&quot; under {activeTab} view. Try clearing filters to view all upcoming fixtures across supported competitions.
              </p>
            </>
          )}
          <div className="flex flex-col sm:flex-row items-center gap-2 mt-3">
            {leagueFilter !== 'all' && (
              <button
                onClick={() => {
                  setActiveTab('upcoming');
                  setSelectedDate('all');
                }}
                className="inline-flex items-center gap-2 bg-[#F5F5E4] hover:bg-[#E6E6D2] text-[#006C54] font-bold text-xs uppercase tracking-wide px-4 h-10 rounded-md shadow-2xs transition-colors cursor-pointer"
              >
                View All {selectedDirectoryLabel} Across All Dates
              </button>
            )}
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-2 bg-[#006C54] hover:bg-[#005441] text-white font-bold text-xs uppercase tracking-wide px-5 h-10 rounded-md shadow-xs transition-colors active:scale-95 cursor-pointer"
            >
              <RotateCcw size={14} /> Reset All Filters ({counts.all} matches)
            </button>
          </div>
        </div>
      ) : sectoredLeagueGroups.length > 1 && leagueFilter !== 'all' ? (
        /* SECTORED LEAGUES VIEW (e.g. England Premier League, Championship, etc.) */
        <div className="space-y-10">
          {visibleSectors.map((sector) => (
            <div key={sector.league} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#006C54]/25">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#006C54]" />
                  <h2 className="font-display font-bold text-base sm:text-lg text-slate-900 tracking-tight uppercase">
                    {sector.league}
                  </h2>
                </div>
                <span className="text-[11px] tabular-nums font-bold px-2.5 py-0.5 rounded-full bg-[#E8F5EE] text-[#006C54]">
                  {sector.matches.length} {sector.matches.length === 1 ? 'Fixture' : 'Fixtures'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {sector.matches.map((m) => (
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
            </div>
          ))}
        </div>
      ) : (
        /* STANDARD MATCH GRID */
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
