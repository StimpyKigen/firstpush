import { useState, useMemo, useEffect, useSyncExternalStore } from 'react';
import { getCombinedBuilderFixtures, type BuilderFixture } from './builderFixtures';
import { subscribeToFreeMatches, getFreeMatchesSnapshot, refreshFreeMatches } from './freeMatches';
import { useBetSlipStore } from './betSlipStore';
import { useCurrentUser } from './authStore';
import { useAuthWallStore } from './authWallStore';
import { showToast } from './notificationStore';
import { moderateText } from './contentModeration';
import {
  SPORTSCORE_COUNTRY_DIRECTORY_CONFIG,
  buildSportScoreCountryDirectory,
  resolveSportScoreDirectoryId,
} from './leagueDirectory';
import { isLiveMatch, isCompletedMatch } from './matchStatus';
import {
  sortHighlightsComparator,
  sortUpcomingComparator,
  isUpcomingEligible,
  isHighlightsEligible,
  getDeviceLocalDateString,
} from './competitionPriority';
import type { FilterScopeTab } from '../components/MatchFiltersToolbar';

/** Fixture filtering, parlay-cart math, and publish flow for the custom Bet Builder. */
export function useBetBuilder(onPublished?: () => void) {
  const currentUser = useCurrentUser();
  const addPost = useBetSlipStore((s) => s.addPost);
  const cartLegs = useBetSlipStore((s) => s.builderLegs);
  const toggleBuilderLeg = useBetSlipStore((s) => s.toggleBuilderLeg);
  const removeBuilderLeg = useBetSlipStore((s) => s.removeBuilderLeg);
  const clearBuilderLegs = useBetSlipStore((s) => s.clearBuilderLegs);

  const [activeTab, setActiveTab] = useState<FilterScopeTab>('highlights');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [leagueFilter, setLeagueFilter] = useState<string>(() => {
    try {
      const val = localStorage.getItem('mshindi_builder_league_filter') || 'all';
      if (val !== 'all' && !SPORTSCORE_COUNTRY_DIRECTORY_CONFIG.some((entry) => entry.id === val)) {
        return 'all';
      }
      return val;
    } catch {
      return 'all';
    }
  });
  const [selectedSubLeague, setSelectedSubLeague] = useState<string>('all');
  const [expandedFixtureId, setExpandedFixtureId] = useState<string | null>(null);

  const [simulatedStake, setSimulatedStake] = useState<number>(500);
  const [isSlipExpanded, setIsSlipExpanded] = useState<boolean>(false);

  // Publish Modal State
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishNote, setPublishNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Bet Builder']);
  const [selectedBookmaker, setSelectedBookmaker] = useState('SportPesa');
  const [bookieCode, setBookieCode] = useState('');
  const [bookieLink, setBookieLink] = useState('');

  const freeSnap = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchesSnapshot, getFreeMatchesSnapshot);
  const fixtures = useMemo(() => getCombinedBuilderFixtures(), [freeSnap]);

  // Real-time device clock state, refreshed every 15 seconds
  const [deviceNow, setDeviceNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setDeviceNow(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Eagerly trigger refresh from SportScore if fixture slate is empty on load
  useEffect(() => {
    if (fixtures.length === 0) {
      void refreshFreeMatches(true);
    }
  }, [fixtures.length]);

  const todayDateStr = useMemo(() => getDeviceLocalDateString(deviceNow), [deviceNow]);
  const tomorrowDateStr = useMemo(() => {
    const d = new Date(deviceNow);
    d.setDate(d.getDate() + 1);
    return getDeviceLocalDateString(d);
  }, [deviceNow]);

  const handleLeagueFilterChange = (val: string, subLeague: string = 'all') => {
    setLeagueFilter(val);
    setSelectedSubLeague(subLeague);
    try {
      localStorage.setItem('mshindi_builder_league_filter', val);
    } catch {}
  };

  const handleTabClick = (tab: FilterScopeTab) => {
    setActiveTab(tab);
    if (tab === 'live' || selectedDate === 'completed') {
      setSelectedDate('all');
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedSubLeague('all');
    handleLeagueFilterChange('all');
    setSelectedDate('all');
    setActiveTab('highlights');
  };

  // Scope Counts for Row 1 Segmented Control
  const counts = useMemo(() => {
    let live = 0;
    let upcoming = 0;
    let highlights = 0;

    fixtures.forEach((f) => {
      if (isCompletedMatch(f)) return;

      if (isLiveMatch(f, deviceNow)) {
        live++;
      } else {
        if (isUpcomingEligible(f, deviceNow)) {
          upcoming++;
        }
        if (isHighlightsEligible(f, deviceNow)) {
          highlights++;
        }
      }
    });

    return {
      all: fixtures.length,
      live,
      upcoming,
      highlights,
    };
  }, [fixtures, deviceNow]);

  const completedTodayCount = useMemo(() => {
    return fixtures.filter((f) => {
      if (!isCompletedMatch(f)) return false;
      const dStr = f.kickoffIso ? getDeviceLocalDateString(f.kickoffIso) : '';
      return dStr === todayDateStr;
    }).length;
  }, [fixtures, todayDateStr]);

  const allDatesCount = useMemo(() => fixtures.length, [fixtures]);

  const availableDates = useMemo(() => {
    const dateMap = new Map<string, number>();
    fixtures.forEach((f) => {
      if (isCompletedMatch(f)) return;
      if (f.kickoffIso) {
        const dStr = getDeviceLocalDateString(f.kickoffIso);
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
  }, [fixtures, todayDateStr, tomorrowDateStr]);

  // Filter fixtures by selected Tab & Date
  const scopedFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      const text = `${f.competition || ''} ${f.leagueCode || ''} ${f.country || ''} ${f.homeTeam || ''} ${f.awayTeam || ''} ${f.id || ''}`.toLowerCase();
      if (text.includes('simulated reality') || /\b(srl)\b/i.test(text)) {
        return false;
      }

      const dStr = f.kickoffIso ? getDeviceLocalDateString(f.kickoffIso) : '';

      if (selectedDate === 'completed') {
        if (!isCompletedMatch(f)) return false;
        return dStr === todayDateStr;
      }

      if (isCompletedMatch(f)) {
        return false;
      }

      if (selectedDate !== 'all') {
        if (dStr !== selectedDate) return false;
      }

      if (activeTab === 'live') {
        return isLiveMatch(f, deviceNow);
      }

      if (isLiveMatch(f, deviceNow)) {
        return false;
      }

      if (activeTab === 'highlights') {
        return isHighlightsEligible(f, deviceNow);
      }

      return isUpcomingEligible(f, deviceNow);
    });
  }, [fixtures, activeTab, selectedDate, deviceNow, todayDateStr]);

  const directoryData = useMemo(() => {
    return buildSportScoreCountryDirectory(fixtures);
  }, [fixtures]);

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

  const selectedDateLabel = useMemo(() => {
    if (selectedDate === 'completed') return 'Completed';
    if (selectedDate === 'all') return 'All Dates';
    if (selectedDate === todayDateStr) return 'Today';
    if (selectedDate === tomorrowDateStr) return 'Tomorrow';
    const found = availableDates.find((d) => d.dStr === selectedDate);
    return found ? found.label : selectedDate;
  }, [selectedDate, todayDateStr, tomorrowDateStr, availableDates]);

  const filteredFixtures = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return scopedFixtures
      .filter((f) => {
        if (query) {
          const matchesQuery =
            f.homeTeam.toLowerCase().includes(query) ||
            f.awayTeam.toLowerCase().includes(query) ||
            f.competition.toLowerCase().includes(query) ||
            (f.country && f.country.toLowerCase().includes(query)) ||
            (f.blurb && f.blurb.toLowerCase().includes(query));
          if (!matchesQuery) return false;
        }

        if (leagueFilter !== 'all') {
          const dirId = resolveSportScoreDirectoryId(f);
          if (dirId !== leagueFilter) return false;

          if (selectedSubLeague && selectedSubLeague !== 'all') {
            if (f.competition !== selectedSubLeague) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (selectedDate === 'completed') {
          const timeA = a.kickoffIso ? new Date(a.kickoffIso).getTime() : 0;
          const timeB = b.kickoffIso ? new Date(b.kickoffIso).getTime() : 0;
          return timeB - timeA;
        }
        if (activeTab === 'upcoming') {
          return sortUpcomingComparator(a, b);
        }
        return sortHighlightsComparator(a, b);
      });
  }, [scopedFixtures, searchQuery, leagueFilter, selectedSubLeague, selectedDate, activeTab]);

  const sectoredLeagueGroups = useMemo(() => {
    const groups: { league: string; fixtures: BuilderFixture[] }[] = [];
    const map = new Map<string, BuilderFixture[]>();

    filteredFixtures.forEach((f) => {
      const comp = f.competition || 'Other Competition';
      if (!map.has(comp)) {
        map.set(comp, []);
      }
      map.get(comp)!.push(f);
    });

    map.forEach((groupFixtures, league) => {
      groups.push({ league, fixtures: groupFixtures });
    });

    return groups;
  }, [filteredFixtures]);

  const sectoredLeagueSummaries = useMemo(
    () => sectoredLeagueGroups.map((g) => ({ league: g.league, count: g.fixtures.length })),
    [sectoredLeagueGroups]
  );

  const visibleSectors = useMemo(() => {
    if (selectedSubLeague === 'all') return sectoredLeagueGroups;
    return sectoredLeagueGroups.filter((g) => g.league === selectedSubLeague);
  }, [sectoredLeagueGroups, selectedSubLeague]);

  // Calculate total odds
  const totalOdds = useMemo(() => {
    if (cartLegs.length === 0) return 0;
    return cartLegs.reduce((acc, leg) => acc * leg.odds, 1);
  }, [cartLegs]);

  const estimatedReturn = useMemo(() => {
    return Math.round(simulatedStake * totalOdds);
  }, [simulatedStake, totalOdds]);

  // Moderation for publish note
  const modResult = useMemo(() => moderateText(`${publishNote} ${bookieCode} ${bookieLink}`), [publishNote, bookieCode, bookieLink]);

  function toggleLeg(fixture: BuilderFixture, market: string, pick: string, odds: number) {
    if (isCompletedMatch(fixture)) {
      showToast({ type: 'info', title: 'Match Completed', message: 'Finished matches cannot be added to an active slip.' });
      return;
    }

    if (!currentUser) {
      useAuthWallStore.getState().openAuthWall({
        actionType: 'builder_pick',
        title: 'Sign In to Make Selections',
        message: 'Sign up or log in to select market odds and add selections to your Bet Builder slip.',
      });
      return;
    }

    const legId = `${fixture.id}-${market}-${pick}`;

    toggleBuilderLeg({
      id: legId,
      matchId: fixture.id,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      competition: fixture.competition,
      kickoff: fixture.kickoff,
      market,
      pick,
      odds,
      status: 'pending',
    });

    // Auto-collapse when user picks another market outside of the triggered markets
    if (expandedFixtureId !== null && expandedFixtureId !== fixture.id) {
      setExpandedFixtureId(null);
    }
  }

  function removeLeg(legId: string) {
    removeBuilderLeg(legId);
  }

  function isLegSelected(matchId: string, market: string, pick: string) {
    return cartLegs.some((l) => l.matchId === matchId && l.market === market && l.pick === pick);
  }

  function handlePublish() {
    if (cartLegs.length === 0) return;
    if (!currentUser) {
      showToast({ type: 'warning', title: 'Sign in required', message: 'Log in to publish your built bet slip.' });
      return;
    }

    if (!modResult.isAllowed) {
      showToast({ type: 'error', title: 'Content Flagged', message: modResult.reason ?? 'Note contains prohibited words.' });
      return;
    }

    const finalCode = bookieCode.trim();
    const finalLink = bookieLink.trim();
    const primaryUrl = finalLink || finalCode || `built-slip-${Date.now()}`;

    addPost({
      postedBy: currentUser.username,
      postedByAvatarSeed: currentUser.phone.length,
      url: primaryUrl,
      bookmaker: selectedBookmaker,
      isCode: !finalLink && Boolean(finalCode),
      note: publishNote.trim() || `Compiled ${cartLegs.length}-leg accumulator @ ${totalOdds.toFixed(2)}x total odds.`,
      tags: selectedTags,
      builtSlip: {
        legs: cartLegs,
        totalOdds,
        stake: simulatedStake,
        estimatedReturn,
        bookieCode: finalCode || undefined,
        bookieLink: finalLink || undefined,
        bookmaker: selectedBookmaker,
        status: 'pending',
      },
    });

    clearBuilderLegs();
    setShowPublishModal(false);
    setPublishNote('');
    setBookieCode('');
    setBookieLink('');
    showToast({ type: 'success', title: 'Bet Slip Published!', message: 'Your custom built slip is live in the community feed.' });
    onPublished?.();
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return {
    activeTab,
    handleTabClick,
    selectedDate,
    setSelectedDate,
    selectedDateLabel,
    todayDateStr,
    counts,
    completedTodayCount,
    allDatesCount,
    availableDates,
    leagueFilter,
    selectedSubLeague,
    setSelectedSubLeague,
    selectedDirectoryLabel,
    directoryData,
    handleLeagueFilterChange,
    sectoredLeagueGroups,
    sectoredLeagueSummaries,
    visibleSectors,
    searchQuery,
    setSearchQuery,
    resetFilters,
    expandedFixtureId,
    setExpandedFixtureId,
    simulatedStake,
    setSimulatedStake,
    isSlipExpanded,
    setIsSlipExpanded,
    showPublishModal,
    setShowPublishModal,
    publishNote,
    setPublishNote,
    selectedTags,
    selectedBookmaker,
    setSelectedBookmaker,
    bookieCode,
    setBookieCode,
    bookieLink,
    setBookieLink,
    fixtures,
    filteredFixtures,
    cartLegs,
    totalOdds,
    estimatedReturn,
    modResult,
    toggleLeg,
    removeLeg,
    isLegSelected,
    handlePublish,
    toggleTag,
    clearBuilderLegs,
  };
}
