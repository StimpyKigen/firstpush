import { useState, useMemo, useRef, useEffect, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Users, Clock, Unlock, Calendar, Search, X, SearchX,
  Dices, Plus, Check, Flame, MessageSquarePlus, Globe, ChevronDown, Filter, RotateCcw,
  Radio, RadioTower, Trophy
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

type ScopeTab = 'highlights' | 'live' | 'upcoming' | 'today' | 'tomorrow' | 'all';

export default function FreeMatches() {
  const [activeTab, setActiveTab] = useState<ScopeTab>('highlights');
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

  const resetFilters = () => {
    setSearchQuery('');
    handleLeagueFilterChange('all');
    setSelectedDate('all');
    setActiveTab('highlights');
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

  // Scope Counts
  const counts = useMemo(() => {
    let live = 0;
    let today = 0;
    let tomorrow = 0;
    let upcoming = 0;
    let highlights = 0;

    matches.forEach((m) => {
      const dStr = m.kickoffIso ? getDeviceLocalDateString(m.kickoffIso) : '';
      const norm = normalizeMatchStatus(m.status, m.displayClock);

      if (norm === 'in') {
        live++;
      }
      if (isHighlightsEligible(m)) {
        highlights++;
      }
      if (isUpcomingEligible(m, deviceNow)) {
        upcoming++;
        if (dStr === todayDateStr) {
          today++;
        } else if (dStr === tomorrowDateStr) {
          tomorrow++;
        }
      }
    });

    return {
      all: matches.length,
      highlights,
      live,
      upcoming,
      today,
      tomorrow,
    };
  }, [matches, deviceNow, todayDateStr, tomorrowDateStr]);

  // Available dates for horizontal date bar
  const availableDates = useMemo(() => {
    const dateMap = new Map<string, number>();
    matches.forEach((m) => {
      if (m.kickoffIso) {
        const dStr = getDeviceLocalDateString(m.kickoffIso);
        if (dStr >= todayDateStr) {
          // If viewing upcoming/today/tomorrow, count only eligible upcoming fixtures for each date
          if (activeTab === 'upcoming' || activeTab === 'today' || activeTab === 'tomorrow') {
            if (isUpcomingEligible(m, deviceNow)) {
              dateMap.set(dStr, (dateMap.get(dStr) || 0) + 1);
            }
          } else {
            dateMap.set(dStr, (dateMap.get(dStr) || 0) + 1);
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

      // Date selector overrides tab if explicitly selected
      if (selectedDate !== 'all') {
        if (dStr !== selectedDate) return false;
        // If filtering a specific date on Upcoming, enforce real-time upcoming cutoff
        if (activeTab === 'upcoming') {
          return isUpcomingEligible(m, deviceNow);
        }
        return true;
      }

      if (activeTab === 'live') {
        return norm === 'in';
      }
      if (activeTab === 'highlights') {
        return isHighlightsEligible(m);
      }
      if (activeTab === 'upcoming') {
        return isUpcomingEligible(m, deviceNow);
      }
      if (activeTab === 'today') {
        return dStr === todayDateStr && isUpcomingEligible(m, deviceNow);
      }
      if (activeTab === 'tomorrow') {
        return dStr === tomorrowDateStr && isUpcomingEligible(m, deviceNow);
      }
      // 'all' includes all valid fixtures
      return true;
    });
  }, [matches, activeTab, selectedDate, deviceNow, todayDateStr, tomorrowDateStr]);

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
      // 1. Upcoming tab, today tab, tomorrow tab, specific date on Upcoming, or sortBy === 'time'
      // is strictly chronological (earliest kickoff first, zero prestige weighting)
      if (
        activeTab === 'upcoming' ||
        activeTab === 'today' ||
        activeTab === 'tomorrow' ||
        sortBy === 'time' ||
        (selectedDate !== 'all' && activeTab !== 'highlights')
      ) {
        return sortUpcomingComparator(a, b);
      }
      // 2. Highlights tab or highlights sort order ranks by competition prestige hierarchy
      if (activeTab === 'highlights' || sortBy === 'highlights') {
        return sortHighlightsComparator(a, b);
      }
      // 3. Most Popular (consensus votes descending)
      const votesA = consensusMap[a.id]?.totalVotes ?? 0;
      const votesB = consensusMap[b.id]?.totalVotes ?? 0;
      if (votesB !== votesA) return votesB - votesA;

      return sortUpcomingComparator(a, b);
    });

  const handleTabClick = (tab: ScopeTab) => {
    setActiveTab(tab);
    setSelectedDate('all');
    if (tab === 'highlights') {
      setSortBy('highlights');
    } else if (tab === 'upcoming' || tab === 'today' || tab === 'tomorrow') {
      setSortBy('time');
    }
  };

  const handleDateClick = (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate('all');
    } else {
      setSelectedDate(dateStr);
    }
  };

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

      {/* SPORTSBOOK SCOPE NAVIGATION TABS */}
      <div className="max-w-3xl mx-auto mb-4">
        <div className="flex items-center justify-center p-1 bg-[#F5F5E4] rounded-2xl border border-[#D4D4C0] shadow-xs gap-1 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => handleTabClick('highlights')}
            className={`flex-1 min-w-[75px] sm:min-w-0 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'highlights' && selectedDate === 'all'
                ? 'bg-[#006C54] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Sparkles size={13} className={activeTab === 'highlights' ? 'text-amber-300' : 'text-amber-600'} />
            <span>Highlights</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'highlights' && selectedDate === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {counts.highlights}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick('live')}
            className={`flex-1 min-w-[65px] sm:min-w-0 py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'live'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${counts.live > 0 ? 'bg-red-400' : 'bg-slate-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${counts.live > 0 ? 'bg-red-500' : 'bg-slate-400'}`}></span>
            </span>
            <span>Live</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'live' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {counts.live}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick('upcoming')}
            className={`flex-1 min-w-[75px] sm:min-w-0 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'upcoming' && selectedDate === 'all'
                ? 'bg-[#006C54] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Clock size={13} />
            <span>Upcoming</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'upcoming' && selectedDate === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {counts.upcoming}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick('today')}
            className={`flex-1 min-w-[65px] sm:min-w-0 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'today' && selectedDate === 'all'
                ? 'bg-[#006C54] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span>Today</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'today' && selectedDate === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {counts.today}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick('tomorrow')}
            className={`flex-1 min-w-[70px] sm:min-w-0 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'tomorrow' && selectedDate === 'all'
                ? 'bg-[#006C54] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span>Tomorrow</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'tomorrow' && selectedDate === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {counts.tomorrow}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick('all')}
            className={`flex-1 min-w-[65px] sm:min-w-0 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'all' && selectedDate === 'all'
                ? 'bg-[#006C54] text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'all' && selectedDate === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {counts.all}
            </span>
          </button>
        </div>
      </div>

      {/* HORIZONTAL DATE SELECTOR PILLS */}
      {availableDates.length > 0 && activeTab !== 'live' && (
        <div className="max-w-4xl mx-auto mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedDate('all')}
              className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                selectedDate === 'all'
                  ? 'bg-[#006C54] text-white border-[#006C54] shadow-xs'
                  : 'bg-[#FFFFF0] border-[#D4D4C0] text-slate-700 hover:border-[#006C54]'
              }`}
            >
              All Dates
            </button>
            {availableDates.map((d) => (
              <button
                key={d.dStr}
                type="button"
                onClick={() => handleDateClick(d.dStr)}
                className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedDate === d.dStr
                    ? 'bg-[#006C54] text-white border-[#006C54] shadow-xs font-extrabold'
                    : 'bg-[#FFFFF0] border-[#D4D4C0] text-slate-700 hover:border-[#006C54]'
                }`}
              >
                <span>{d.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  selectedDate === d.dStr ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {d.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Search Bar & Filters */}
      <div className="mb-6 sm:mb-8 max-w-3xl mx-auto space-y-2.5">
        {/* Search Bar */}
        <div className="relative flex items-center">
          <Search size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams, competition or country (e.g. Arsenal, Tottenham, La Liga, England)..."
            className="w-full bg-[#FFFFF0] border border-[#D4D4C0] focus:border-[#006C54] focus:ring-2 focus:ring-[#006C54]/15 rounded-full pl-9 sm:pl-10 pr-9 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdowns Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-2.5 pt-0.5">
          {/* Dropdown 1: Continent & Ranked League Filter */}
          <div className="sm:col-span-7 relative" ref={leagueDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsLeagueDropdownOpen((prev) => !prev);
                setIsSortDropdownOpen(false);
              }}
              className={`w-full bg-[#FFFFF0] border rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-slate-800 flex items-center justify-between gap-2 sm:gap-2.5 transition-all shadow-xs hover:border-[#006C54] cursor-pointer ${
                isLeagueDropdownOpen ? 'border-[#006C54] ring-2 ring-[#006C54]/15' : 'border-[#D4D4C0]'
              }`}
              aria-expanded={isLeagueDropdownOpen}
            >
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <Globe size={15} className="text-[#006C54] shrink-0" strokeWidth={2} />
                <div className="text-left truncate">
                  <span className="text-[9.5px] sm:text-[10px] text-slate-500 font-semibold tracking-tight block leading-none mb-0.5">
                    League / Continent
                  </span>
                  <span className="truncate block font-bold text-xs sm:text-[13px] text-slate-900">
                    {currentLeagueLabel.title}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {leagueFilter !== 'all' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#006C54]" />
                )}
                <ChevronDown
                  size={14}
                  className={`text-slate-500 transition-transform duration-200 ${
                    isLeagueDropdownOpen ? 'rotate-180 text-[#006C54]' : ''
                  }`}
                />
              </div>
            </button>

            {isLeagueDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-[#FFFFF0] border border-[#D4D4C0] rounded-2xl shadow-2xl py-2 z-50 max-h-[360px] overflow-y-auto overscroll-contain text-xs divide-y divide-[#E6E6D2]">
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
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
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

          {/* Dropdown 2: Sort Filter */}
          <div className="sm:col-span-5 relative" ref={sortDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setIsSortDropdownOpen((prev) => !prev);
                setIsLeagueDropdownOpen(false);
              }}
              className={`w-full bg-[#FFFFF0] border rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-slate-800 flex items-center justify-between gap-2 transition-all shadow-xs hover:border-[#006C54] cursor-pointer ${
                isSortDropdownOpen ? 'border-[#006C54] ring-2 ring-[#006C54]/15' : 'border-[#D4D4C0]'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Filter size={15} className="text-[#006C54] shrink-0" strokeWidth={2} />
                <div className="text-left truncate">
                  <span className="text-[9.5px] sm:text-[10px] text-slate-500 font-semibold tracking-tight block leading-none mb-0.5">
                    Sort Order
                  </span>
                  <span className="truncate block font-bold text-xs sm:text-[13px] text-slate-900">
                    {sortBy === 'highlights'
                      ? 'Prestige (Highlights)'
                      : sortBy === 'popular'
                      ? 'Ranked by Activity'
                      : 'Kickoff Time'}
                  </span>
                </div>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-500 transition-transform duration-200 shrink-0 ${
                  isSortDropdownOpen ? 'rotate-180 text-[#006C54]' : ''
                }`}
              />
            </button>

            {isSortDropdownOpen && (
              <div className="absolute left-0 right-0 mt-1.5 bg-[#FFFFF0] border border-[#D4D4C0] rounded-2xl shadow-2xl py-1.5 z-50 text-xs">
                <button
                  type="button"
                  onClick={() => { setSortBy('highlights'); setIsSortDropdownOpen(false); }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                    sortBy === 'highlights'
                      ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                      : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} className="text-amber-500" /> Competition Prestige (Highlights)
                  </span>
                  {sortBy === 'highlights' && <Check size={14} className="text-[#006C54]" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setSortBy('time'); setIsSortDropdownOpen(false); }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                    sortBy === 'time'
                      ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                      : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Clock size={14} /> Kickoff Time (Earliest First)
                  </span>
                  {sortBy === 'time' && <Check size={14} className="text-[#006C54]" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setSortBy('popular'); setIsSortDropdownOpen(false); }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between transition-colors cursor-pointer ${
                    sortBy === 'popular'
                      ? 'bg-[#006C54]/10 text-[#006C54] font-black'
                      : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Flame size={14} /> Ranked by Activity (Popular)
                  </span>
                  {sortBy === 'popular' && <Check size={14} className="text-[#006C54]" />}
                </button>
              </div>
            )}
          </div>
        </div>
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
              onClick={() => handleTabClick('all')}
              className="inline-flex items-center gap-2 bg-[#006C54] hover:bg-[#005441] text-white font-black text-xs uppercase tracking-wider px-5 h-10 rounded-md shadow-xs transition-colors cursor-pointer active:scale-95"
            >
              Browse All {counts.all} Fixtures
            </button>
            <button
              onClick={() => handleTabClick('today')}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs uppercase tracking-wider px-4 h-10 rounded-md shadow-xs transition-colors cursor-pointer"
            >
              Today&apos;s Slate ({counts.today})
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
                  setActiveTab('all');
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
