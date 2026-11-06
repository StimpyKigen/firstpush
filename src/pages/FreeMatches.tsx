import { useState, useMemo, useRef, useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, SearchX,
  RotateCcw, Radio, CheckCircle2, RefreshCw
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import {
  getFreeMatchesSnapshot,
  getFreeMatchConsensusSnapshot,
  subscribeToFreeMatches,
  getIsFreeMatchesSyncing,
  getHasFreeMatchesSynced,
  refreshFreeMatches,
  updateFreeMatchOdds,
  type FreeMatch
} from '../lib/freeMatches';
import { enrichFixturesWithBet365Odds } from '../lib/sportscoreOddsService';
import { useBetSlipStore } from '../lib/betSlipStore';
import { useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';
import { showToast } from '../lib/notificationStore';
import { MatchListSkeleton } from '../components/skeleton';
import {
  SPORTSCORE_COUNTRY_DIRECTORY_CONFIG,
  buildSportScoreCountryDirectory,
  resolveSportScoreDirectoryId,
} from '../lib/leagueDirectory';
import FixtureSportCard from '../components/FixtureSportCard';
import MatchFiltersToolbar, { type FilterScopeTab } from '../components/MatchFiltersToolbar';
import { isLiveMatch, isCompletedMatch } from '../lib/matchStatus';
import {
  sortHighlightsComparator,
  sortUpcomingComparator,
  isUpcomingEligible,
  isHighlightsEligible,
  getDeviceLocalDateString,
} from '../lib/competitionPriority';
import { useHistoryPageState } from '../lib/navigationHistory';

export default function FreeMatches() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useHistoryPageState<FilterScopeTab>('free_activeTab', 'highlights');
  const [selectedDate, setSelectedDate] = useHistoryPageState<string>('free_selectedDate', 'all');
  const [searchQuery, setSearchQuery] = useHistoryPageState<string>('free_searchQuery', '');

  // League directory filter preserved per navigation history entry + localStorage fallback
  const [leagueFilter, setLeagueFilter] = useHistoryPageState<string>('free_leagueFilter', () => {
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

  const [selectedSubLeague, setSelectedSubLeague] = useHistoryPageState<string>('free_selectedSubLeague', 'all');

  const handleLeagueFilterChange = (val: string, subLeague: string = 'all') => {
    setLeagueFilter(val);
    setSelectedSubLeague(subLeague);
    try {
      localStorage.setItem('mshindi_freematch_league_filter', val);
    } catch {}
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedSubLeague('all');
    handleLeagueFilterChange('all');
    setSelectedDate('all');
    setActiveTab('highlights');
  };

  const matches = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchesSnapshot, getFreeMatchesSnapshot);
  const consensusMap = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchConsensusSnapshot, getFreeMatchConsensusSnapshot);

  const builderLegs = useBetSlipStore((s) => s.builderLegs);
  const toggleBuilderLeg = useBetSlipStore((s) => s.toggleBuilderLeg);

  const currentUser = useCurrentUser();
  const openAuthWall = useAuthWallStore((s) => s.openAuthWall);

  const handleToggleLeg = (m: FreeMatch, market: string, pick: string, odds: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentUser) {
      openAuthWall({
        actionType: 'builder_pick',
        title: 'Sign In to Make Selections',
        message: 'Sign up or log in to select market odds and add selections to your Bet Builder slip.',
      });
      return;
    }

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

  // Eagerly trigger refresh from SportScore if match slate is empty on load
  useEffect(() => {
    if (matches.length === 0) {
      void refreshFreeMatches(true);
    }
  }, [matches.length]);

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
      // Completed fixtures must NEVER count towards active sections
      if (isCompletedMatch(m)) return;

      if (isLiveMatch(m, deviceNow)) {
        live++;
      } else {
        if (isUpcomingEligible(m, deviceNow)) {
          upcoming++;
        }
        if (isHighlightsEligible(m, deviceNow)) {
          highlights++;
        }
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
      // Completed matches belong strictly to 'Completed', not upcoming date buckets
      if (isCompletedMatch(m)) return;

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

  // Build SportScore Country Directory with dynamic fixture counts across all available matches (independent of active tab)
  const directoryData = useMemo(() => {
    return buildSportScoreCountryDirectory(matches);
  }, [matches]);

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

  // Determine if a dropdown selection is actively filtering matches
  const isDropdownActive = leagueFilter !== 'all' || selectedDate !== 'all';

  // Filter matches: Dropdown selections (Competitions or Dates) take precedence and are NOT
  // governed/constrained by the top tab (Highlights vs Upcoming).
  const filteredMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return matches
      .filter((m) => {
        // Strictly exclude any Simulated Reality / SRL fixtures
        const text = `${m.competition || ''} ${m.leagueCode || ''} ${m.country || ''} ${m.home || ''} ${m.away || ''} ${m.id || ''}`.toLowerCase();
        if (text.includes('simulated reality') || /\b(srl)\b/i.test(text)) {
          return false;
        }

        const dStr = m.kickoffIso ? getDeviceLocalDateString(m.kickoffIso) : '';

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

        // 2. Dates dropdown: explicit 'completed' finished matches of today
        if (selectedDate === 'completed') {
          if (!isCompletedMatch(m)) return false;
          if (dStr !== todayDateStr) return false;

          // Respect competition selection when looking at completed matches
          if (leagueFilter !== 'all') {
            const dirId = resolveSportScoreDirectoryId(m);
            if (dirId !== leagueFilter) return false;
            if (selectedSubLeague && selectedSubLeague !== 'all' && m.competition !== selectedSubLeague) {
              return false;
            }
          }
          return true;
        }

        // Standard: completed fixtures never appear in upcoming/live lists
        if (isCompletedMatch(m)) {
          return false;
        }

        // 3. Dates dropdown: filter by calendar date
        if (selectedDate !== 'all') {
          if (dStr !== selectedDate) return false;
        }

        // 4. Competitions dropdown: filter by country/league directory
        if (leagueFilter !== 'all') {
          const dirId = resolveSportScoreDirectoryId(m);
          if (dirId !== leagueFilter) return false;
          if (selectedSubLeague && selectedSubLeague !== 'all' && m.competition !== selectedSubLeague) {
            return false;
          }
        }

        // 5. Top Tab Filter: ONLY governs when NEITHER dropdown is active.
        // If a dropdown is selected, show all matching fixtures regardless of Highlights/Upcoming tab!
        if (isDropdownActive) {
          return true;
        }

        // Default top selection behavior when no dropdown is active:
        if (activeTab === 'live') {
          return isLiveMatch(m, deviceNow);
        }

        if (isLiveMatch(m, deviceNow)) {
          return false;
        }

        if (activeTab === 'highlights') {
          return isHighlightsEligible(m, deviceNow);
        }

        // 'upcoming' tab
        return isUpcomingEligible(m, deviceNow);
      })
      .sort((a, b) => {
        // Completed: latest kickoff first
        if (selectedDate === 'completed') {
          const timeA = a.kickoffIso ? new Date(a.kickoffIso).getTime() : 0;
          const timeB = b.kickoffIso ? new Date(b.kickoffIso).getTime() : 0;
          return timeB - timeA;
        }
        // Highlights & Live when no dropdown is active: rank by prestige hierarchy
        if (!isDropdownActive && (activeTab === 'highlights' || activeTab === 'live')) {
          return sortHighlightsComparator(a, b);
        }
        // Upcoming or Dropdown active: chronological earliest kickoff first
        return sortUpcomingComparator(a, b);
      });
  }, [matches, activeTab, selectedDate, leagueFilter, selectedSubLeague, searchQuery, isDropdownActive, deviceNow, todayDateStr]);

  // On-demand Bet365 odds enrichment: Only fetch odds for matches that are actually displayed
  const enrichingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const toEnrich = filteredMatches
      .slice(0, 12)
      .filter((m) => m.status === 'pre' && m.matchUrl && m.bookmaker !== 'Bet365' && !enrichingRef.current.has(m.id));

    if (toEnrich.length === 0) return;

    toEnrich.forEach((m) => enrichingRef.current.add(m.id));

    let isMounted = true;
    enrichFixturesWithBet365Odds(toEnrich, 8, 4)
      .then(() => {
        if (!isMounted) return;
        const enrichedItems = toEnrich.filter((m) => m.bookmaker === 'Bet365');
        if (enrichedItems.length > 0) {
          updateFreeMatchOdds(enrichedItems);
        }
      })
      .catch(() => {})
      .finally(() => {
        toEnrich.forEach((m) => enrichingRef.current.delete(m.id));
      });

    return () => {
      isMounted = false;
    };
  }, [filteredMatches]);

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

    map.forEach((groupMatches, league) => {
      groups.push({ league, matches: groupMatches });
    });

    return groups;
  }, [filteredMatches]);

  const sectoredLeagueSummaries = useMemo(
    () => sectoredLeagueGroups.map((g) => ({ league: g.league, count: g.matches.length })),
    [sectoredLeagueGroups]
  );

  const visibleSectors = useMemo(() => {
    if (selectedSubLeague === 'all') return sectoredLeagueGroups;
    return sectoredLeagueGroups.filter((g) => g.league === selectedSubLeague);
  }, [sectoredLeagueGroups, selectedSubLeague]);

  const handleTabClick = (tab: FilterScopeTab) => {
    setActiveTab(tab);
    if (tab === 'live' || selectedDate === 'completed') {
      setSelectedDate('all');
    }
    if (leagueFilter !== 'all') {
      handleLeagueFilterChange('all');
    }
    if (selectedDate !== 'all' && selectedDate !== 'completed') {
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
          <span className="inline-flex items-center gap-1.5 text-[#006C54] font-bold">
            <Radio size={13} className="animate-pulse" /> Live Market Feed
          </span>
          <span className="text-slate-300 font-normal">·</span>
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <Calendar size={13} className="text-slate-400" /> All Times in EAT
          </span>
        </div>

        <h1 className="font-display font-bold text-3xl sm:text-5xl text-slate-900 tracking-tight uppercase">
          Match Slate &amp; Consensus
        </h1>
        <p className="text-slate-600 mt-2 max-w-3xl mx-auto text-xs sm:text-sm leading-relaxed">
          Comprehensive sportsbook-grade fixture catalogue across all supported competitions. Browse live in-play games, today&apos;s slate, and rolling upcoming fixtures with calibrated crowd consensus splits.
        </p>
      </div>

      {/* APPLE-INSPIRED MATCH FILTERS TOOLBAR */}
      <MatchFiltersToolbar
        accent="emerald"
        activeTab={activeTab}
        onTabChange={handleTabClick}
        counts={counts}
        selectedDate={selectedDate}
        selectedDateLabel={selectedDateLabel}
        onSelectDate={setSelectedDate}
        completedTodayCount={completedTodayCount}
        allDatesCount={allDatesCount}
        availableDates={availableDates}
        leagueFilter={leagueFilter}
        selectedSubLeague={selectedSubLeague}
        selectedDirectoryLabel={selectedDirectoryLabel}
        directoryData={directoryData}
        onLeagueFilterChange={handleLeagueFilterChange}
        onSelectSubLeague={setSelectedSubLeague}
        sectoredLeagues={sectoredLeagueSummaries}
        filteredTotalCount={filteredMatches.length}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onResetFilters={resetFilters}
      />

      {/* FIXTURES LIST / SKELETON LOADER / RESILIENT EMPTY STATES */}
      {matches.length === 0 && (getIsFreeMatchesSyncing() || !getHasFreeMatchesSynced()) ? (
        <MatchListSkeleton count={6} />
      ) : matches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto flex flex-col items-center gap-3 shadow-xs">
          <Calendar size={36} className="text-[#006C54]" />
          <h3 className="font-display font-bold text-lg text-slate-900 uppercase tracking-tight">No Fixtures Currently Scheduled</h3>
          <p className="text-xs text-slate-600 leading-relaxed max-w-md">
            Connecting to SportScore live feed... Tap below to refresh the football match slate and consensus odds.
          </p>
          <button
            type="button"
            onClick={() => refreshFreeMatches(true)}
            className="mt-2 inline-flex items-center gap-2 bg-[#006C54] hover:bg-[#005441] text-white font-bold text-xs uppercase tracking-wide px-5 h-10 rounded-md shadow-xs transition-colors cursor-pointer active:scale-95"
          >
            <RefreshCw size={14} className={getIsFreeMatchesSyncing() ? 'animate-spin' : ''} />
            <span>{getIsFreeMatchesSyncing() ? 'Refreshing...' : 'Refresh SportScore Feed'}</span>
          </button>
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
                    onOpenBetBuilder={(m) => navigate(`/slips?tab=builder&match=${encodeURIComponent(m.id || m)}`)}
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
              onOpenBetBuilder={(m) => navigate(`/slips?tab=builder&match=${encodeURIComponent(m.id || m)}`)}
            />
          ))}
        </div>
      )}


    </div>
  );
}
