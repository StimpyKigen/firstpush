import { useState, useRef, useEffect } from 'react';
import { Calendar, Search, X, Check, ChevronDown, CheckCircle2 } from 'lucide-react';
import type { SportScoreDirectoryRow } from '../lib/leagueDirectory';

export type FilterScopeTab = 'highlights' | 'live' | 'upcoming';

export interface AvailableDateOption {
  dStr: string;
  label: string;
  count: number;
}

export interface SectoredLeagueSummary {
  league: string;
  count: number;
}

interface MatchFiltersToolbarProps {
  accent?: 'emerald' | 'gold';
  activeTab: FilterScopeTab;
  onTabChange: (tab: FilterScopeTab) => void;
  counts: {
    highlights: number;
    live: number;
    upcoming: number;
  };
  selectedDate: string;
  selectedDateLabel: string;
  onSelectDate: (date: string) => void;
  completedTodayCount: number;
  allDatesCount: number;
  availableDates: AvailableDateOption[];
  leagueFilter: string;
  selectedSubLeague: string;
  selectedDirectoryLabel: string;
  directoryData: {
    rows: SportScoreDirectoryRow[];
    totalMatches: number;
  };
  onLeagueFilterChange: (leagueId: string, subLeague?: string) => void;
  onSelectSubLeague: (subLeague: string) => void;
  sectoredLeagues: SectoredLeagueSummary[];
  filteredTotalCount: number;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onResetFilters: () => void;
}

export default function MatchFiltersToolbar({
  accent = 'emerald',
  activeTab,
  onTabChange,
  counts,
  selectedDate,
  selectedDateLabel,
  onSelectDate,
  completedTodayCount,
  allDatesCount,
  availableDates,
  leagueFilter,
  selectedSubLeague,
  selectedDirectoryLabel,
  directoryData,
  onLeagueFilterChange,
  onSelectSubLeague,
  sectoredLeagues,
  filteredTotalCount,
  searchQuery,
  onSearchQueryChange,
  onResetFilters,
}: MatchFiltersToolbarProps) {
  const isGold = accent === 'gold';

  const [expandedCountryIds, setExpandedCountryIds] = useState<string[]>([]);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isLeagueDropdownOpen, setIsLeagueDropdownOpen] = useState(false);
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

  const handleSelectLeague = (val: string, subLeague: string = 'all') => {
    onLeagueFilterChange(val, subLeague);
    setIsLeagueDropdownOpen(false);
  };

  const handleReset = () => {
    setIsSearchOpen(false);
    setIsDateDropdownOpen(false);
    setIsLeagueDropdownOpen(false);
    onResetFilters();
  };

  // Theme-specific accent classes (no background behind number indicators)
  const theme = isGold
    ? {
        tabActiveText: 'font-bold text-[#B88000]',
        tabActiveCount: 'text-[#B88000]',
        pillHoverShadow: 'hover:shadow-[0_2px_6px_rgba(238,170,4,0.14)]',
        pillActive: 'border-[#EEAA04] text-[#B88000] ring-2 ring-[#EEAA04]/25',
        pillIdle: 'border-[#DCDCC8] text-slate-800 hover:border-[#EEAA04]',
        iconColor: 'text-[#C48B03]',
        dotColor: 'bg-[#EEAA04]',
        chevronOpen: 'rotate-180 text-[#C48B03]',
        rowSelected: 'text-[#9A6B00] dark:text-[#FFC72C] font-bold',
        selectedRowCount: 'text-[#9A6B00]',
        checkColor: 'text-[#C48B03]',
        subAccordionBorder: 'border-[#EEAA04]/40',
        subRowSelected: 'text-[#9A6B00] dark:text-[#FFC72C] font-bold',
        subRowSelectedCount: 'text-[#9A6B00] dark:text-[#FFC72C]',
        subRowCheck: 'text-[#C48B03] dark:text-[#FFC72C]',
        searchBtnActive: 'bg-[#EEAA04]/20 text-[#B88000]',
        searchBtnIdle: 'text-[#C48B03] hover:text-[#9A6B00] hover:bg-[#EEAA04]/15',
        searchBarBorder:
          'border-[#EEAA04]/50 focus-within:border-[#EEAA04] focus-within:ring-2 focus-within:ring-[#EEAA04]/20',
        filterTag: 'bg-[#EEAA04]/15 border-[#EEAA04]/35 text-[#9A6B00]',
        sectorSelected: 'bg-[#EEAA04] text-slate-950 shadow-xs',
        sectorSelectedCount: 'text-slate-950',
        sectorIdle: 'bg-[#FFFFF0] border border-[#DCDCC8] text-slate-700 hover:border-[#EEAA04]',
      }
    : {
        tabActiveText: 'font-bold text-[#006C54]',
        tabActiveCount: 'text-[#006C54]',
        pillHoverShadow: 'hover:shadow-[0_2px_6px_rgba(0,108,84,0.08)]',
        pillActive: 'border-[#006C54] text-[#006C54] ring-2 ring-[#006C54]/15',
        pillIdle: 'border-[#DCDCC8] text-slate-800 hover:border-[#006C54]',
        iconColor: 'text-[#006C54]',
        dotColor: 'bg-[#006C54]',
        chevronOpen: 'rotate-180 text-[#006C54]',
        rowSelected: 'text-[#006C54] font-bold',
        selectedRowCount: 'text-[#006C54]',
        checkColor: 'text-[#006C54]',
        subAccordionBorder: 'border-[#006C54]/25',
        subRowSelected: 'text-[#006C54] font-bold',
        subRowSelectedCount: 'text-[#006C54]',
        subRowCheck: 'text-[#006C54]',
        searchBtnActive: 'bg-[#006C54]/15 text-[#006C54]',
        searchBtnIdle: 'text-[#006C54] hover:text-[#005441] hover:bg-[#006C54]/10',
        searchBarBorder:
          'border-[#006C54]/40 focus-within:border-[#006C54] focus-within:ring-2 focus-within:ring-[#006C54]/15',
        filterTag: 'bg-[#006C54]/10 border-[#006C54]/20 text-[#006C54]',
        sectorSelected: 'bg-[#006C54] text-white shadow-xs',
        sectorSelectedCount: 'text-white',
        sectorIdle: 'bg-[#FFFFF0] border border-[#DCDCC8] text-slate-700 hover:border-[#006C54]',
      };

  return (
    <>
      <div className="max-w-4xl mx-auto mb-6 sm:mb-8">
        {/* ROW 1 — Match Status Inline Tab Switcher */}
        <div className="flex justify-center mb-3 sm:mb-4">
          <div className="inline-flex items-center gap-2.5 sm:gap-4 py-1 px-2.5 sm:px-3">
            {/* Highlights Tab */}
            <button
              type="button"
              onClick={() => onTabChange('highlights')}
              className={`text-xs sm:text-[13px] transition-colors flex items-center gap-1 sm:gap-1.5 cursor-pointer select-none group ${
                activeTab === 'highlights'
                  ? theme.tabActiveText
                  : 'font-medium text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Highlights</span>
              <span
                className={`text-[11px] tabular-nums font-bold transition-colors ${
                  activeTab === 'highlights'
                    ? theme.tabActiveCount
                    : 'text-slate-500 group-hover:text-slate-800'
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
              onClick={() => onTabChange('live')}
              className={`text-xs sm:text-[13px] transition-colors flex items-center gap-1 sm:gap-1.5 cursor-pointer select-none group ${
                activeTab === 'live'
                  ? theme.tabActiveText
                  : 'font-medium text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 shrink-0 mr-0.5">
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
                className={`text-[11px] tabular-nums font-bold transition-colors ${
                  activeTab === 'live'
                    ? theme.tabActiveCount
                    : 'text-slate-500 group-hover:text-slate-800'
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
              onClick={() => onTabChange('upcoming')}
              className={`text-xs sm:text-[13px] transition-colors flex items-center gap-1 sm:gap-1.5 cursor-pointer select-none group ${
                activeTab === 'upcoming'
                  ? theme.tabActiveText
                  : 'font-medium text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>Upcoming</span>
              <span
                className={`text-[11px] tabular-nums font-bold transition-colors ${
                  activeTab === 'upcoming'
                    ? theme.tabActiveCount
                    : 'text-slate-500 group-hover:text-slate-800'
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
              className={`h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-full bg-[#FFFFF0] border text-xs sm:text-[13px] font-semibold flex items-center gap-1.5 sm:gap-2 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${theme.pillHoverShadow} cursor-pointer select-none ${
                isDateDropdownOpen || selectedDate !== 'all' ? theme.pillActive : theme.pillIdle
              }`}
              aria-expanded={isDateDropdownOpen}
              aria-label="Filter by match date"
            >
              <Calendar size={13.5} className={`${theme.iconColor} shrink-0`} />
              <span>{selectedDate === 'all' ? 'Dates' : selectedDateLabel}</span>
              {selectedDate !== 'all' && (
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dotColor} shrink-0`} />
              )}
              <ChevronDown
                size={13}
                className={`text-slate-500 transition-transform duration-200 shrink-0 ${
                  isDateDropdownOpen ? theme.chevronOpen : ''
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
                      onSelectDate('completed');
                      setIsDateDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      selectedDate === 'completed'
                        ? theme.rowSelected
                        : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 size={13} className={theme.iconColor} /> Completed
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] tabular-nums font-bold ${
                          selectedDate === 'completed' ? theme.selectedRowCount : 'text-slate-500'
                        }`}
                      >
                        {completedTodayCount}
                      </span>
                      {selectedDate === 'completed' && <Check size={14} className={theme.checkColor} />}
                    </div>
                  </button>
                </div>

                {/* 2. ALL DATES */}
                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDate('all');
                      setIsDateDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      selectedDate === 'all'
                        ? theme.rowSelected
                        : 'hover:bg-[#F5F5E4] text-slate-700 font-semibold'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Calendar size={13} className={theme.iconColor} /> All Dates
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[11px] tabular-nums font-bold ${
                          selectedDate === 'all' ? theme.selectedRowCount : 'text-slate-500'
                        }`}
                      >
                        {allDatesCount}
                      </span>
                      {selectedDate === 'all' && <Check size={14} className={theme.checkColor} />}
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
                          onSelectDate(d.dStr);
                          setIsDateDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? theme.rowSelected
                            : 'hover:bg-[#F5F5E4] text-slate-700 font-medium'
                        }`}
                      >
                        <span className="truncate pr-2 font-medium">{d.label}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[11px] tabular-nums font-bold ${
                              isSelected ? theme.selectedRowCount : 'text-slate-500'
                            }`}
                          >
                            {d.count}
                          </span>
                          {isSelected && <Check size={13} className={theme.checkColor} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Control 2: SportScore Country Directory Dropdown ('All Competitions' — NO internal search bar) */}
          <div className="relative" ref={leagueDropdownRef}>
            <button
              type="button"
              onClick={toggleLeagueDropdown}
              className={`h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-full bg-[#FFFFF0] border text-xs sm:text-[13px] font-semibold flex items-center gap-1.5 sm:gap-2 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.03)] ${theme.pillHoverShadow} cursor-pointer select-none max-w-[200px] sm:max-w-[250px] ${
                isLeagueDropdownOpen || leagueFilter !== 'all' ? theme.pillActive : theme.pillIdle
              }`}
              aria-expanded={isLeagueDropdownOpen}
              aria-label="Filter by country or competition"
            >
              <span className="truncate">{selectedDirectoryLabel}</span>
              {leagueFilter !== 'all' && (
                <span className={`w-1.5 h-1.5 rounded-full ${theme.dotColor} shrink-0`} />
              )}
              <ChevronDown
                size={13}
                className={`text-slate-500 transition-transform duration-200 shrink-0 ${
                  isLeagueDropdownOpen ? theme.chevronOpen : ''
                }`}
              />
            </button>

            {/* SportScore Country Directory Menu */}
            {isLeagueDropdownOpen && (
              <div className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 w-72 sm:w-80 bg-[#FFFFF0] border border-[#DCDCC8] rounded-2xl shadow-2xl z-50 max-h-[380px] overflow-hidden flex flex-col text-xs">
                {/* Scrollable Directory Rows (internal search bar omitted) */}
                <div className="overflow-y-auto divide-y divide-[#E6E6D2]/60 p-1.5 flex-1">
                  {/* All Competitions Row */}
                  <button
                    type="button"
                    onClick={() => handleSelectLeague('all')}
                    className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between transition-colors cursor-pointer ${
                      leagueFilter === 'all'
                        ? theme.rowSelected
                        : 'hover:bg-[#F5F5E4] text-slate-800 font-medium'
                    }`}
                  >
                    <span className="truncate pr-2">All Competitions</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] tabular-nums ${
                          leagueFilter === 'all'
                            ? `${theme.selectedRowCount} font-bold`
                            : 'text-slate-500'
                        }`}
                      >
                        {directoryData.totalMatches}
                      </span>
                      {leagueFilter === 'all' && <Check size={13} className={theme.checkColor} />}
                    </div>
                  </button>

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
                              ? theme.rowSelected
                              : 'hover:bg-[#F5F5E4] text-slate-800 font-medium'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (hasMultipleLeagues) {
                                setExpandedCountryIds((prev) =>
                                  prev.includes(row.id)
                                    ? prev.filter((id) => id !== row.id)
                                    : [...prev, row.id]
                                );
                              } else {
                                handleSelectLeague(row.id, 'all');
                              }
                            }}
                            className="flex-1 text-left flex items-center gap-2 truncate cursor-pointer mr-2"
                          >
                            <span className="truncate">{row.label}</span>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[11px] tabular-nums ${
                                isAnySubSelected
                                  ? `${theme.selectedRowCount} font-bold`
                                  : 'text-slate-500'
                              }`}
                            >
                              {row.count}
                            </span>
                            {isSelected && <Check size={13} className={theme.checkColor} />}
                            {hasMultipleLeagues && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedCountryIds((prev) =>
                                    prev.includes(row.id)
                                      ? prev.filter((id) => id !== row.id)
                                      : [...prev, row.id]
                                  );
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 transition-transform cursor-pointer"
                                title={isExpanded ? 'Collapse leagues' : 'Expand leagues'}
                              >
                                <ChevronDown
                                  size={13}
                                  className={`transition-transform duration-200 ${
                                    isExpanded ? theme.chevronOpen : ''
                                  }`}
                                />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expanded Accordion Subsection for Countries with Multiple Leagues */}
                        {hasMultipleLeagues && isExpanded && (
                          <div
                            className={`ml-4 pl-3 border-l-2 ${theme.subAccordionBorder} my-1 space-y-0.5 animate-fade-in`}
                          >
                            {row.leagues.map((lg) => {
                              const isSubSelected =
                                leagueFilter === row.id && selectedSubLeague === lg.league;
                              return (
                                <button
                                  key={lg.league}
                                  type="button"
                                  onClick={() => handleSelectLeague(row.id, lg.league)}
                                  className={`w-full px-2.5 py-1.5 rounded-md text-left flex items-center justify-between text-[11px] transition-colors cursor-pointer ${
                                    isSubSelected
                                      ? theme.subRowSelected
                                      : 'hover:bg-[#F5F5E4] text-slate-700 font-medium'
                                  }`}
                                >
                                  <span className="truncate pr-2">{lg.league}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span
                                      className={`tabular-nums text-[11px] ${
                                        isSubSelected
                                          ? `${theme.subRowSelectedCount} font-bold`
                                          : 'text-slate-500'
                                      }`}
                                    >
                                      {lg.count}
                                    </span>
                                    {isSubSelected && (
                                      <Check size={12} className={theme.subRowCheck} />
                                    )}
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
                      No competitions available
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Control 3: Search Icon Button (Borderless, clean icon beside dropdown) */}
          <div className="relative" ref={searchContainerRef}>
            <button
              type="button"
              onClick={toggleSearch}
              className={`p-1.5 sm:p-2 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer select-none ${
                isSearchOpen || searchQuery ? theme.searchBtnActive : theme.searchBtnIdle
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
            <div
              className={`relative flex items-center bg-[#FFFFF0] border rounded-full shadow-md transition-all ${theme.searchBarBorder}`}
            >
              <Search
                size={15}
                className={`absolute left-3.5 ${theme.iconColor} pointer-events-none`}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Search teams, competition or country..."
                className="w-full bg-transparent pl-9 sm:pl-10 pr-16 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchQueryChange('')}
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
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-semibold text-[11px] ${theme.filterTag}`}
              >
                <span>Date: {selectedDateLabel}</span>
                <button
                  type="button"
                  onClick={() => onSelectDate('all')}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                  aria-label="Clear date filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {leagueFilter !== 'all' && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-semibold text-[11px] ${theme.filterTag}`}
              >
                <span>Competition: {selectedDirectoryLabel}</span>
                <button
                  type="button"
                  onClick={() => handleSelectLeague('all')}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                  aria-label="Clear competition filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {searchQuery && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border font-semibold text-[11px] ${theme.filterTag}`}
              >
                <span>Search: &quot;{searchQuery}&quot;</span>
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  className="hover:text-red-600 transition-colors cursor-pointer"
                  aria-label="Clear search filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-bold text-slate-500 hover:text-red-600 underline ml-1 cursor-pointer"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* SUB-LEAGUE SECTOR PILLS (For countries with multiple leagues like England) */}
      {leagueFilter !== 'all' && sectoredLeagues.length > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap mb-6 max-w-4xl mx-auto animate-fade-in">
          <button
            type="button"
            onClick={() => onSelectSubLeague('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
              selectedSubLeague === 'all' ? theme.sectorSelected : theme.sectorIdle
            }`}
          >
            <span>All {selectedDirectoryLabel} Leagues</span>
            <span
              className={`text-[11px] tabular-nums font-bold ${
                selectedSubLeague === 'all' ? theme.sectorSelectedCount : 'text-slate-500'
              }`}
            >
              {filteredTotalCount}
            </span>
          </button>

          {sectoredLeagues.map((g) => {
            const isSelected = selectedSubLeague === g.league;
            return (
              <button
                key={g.league}
                type="button"
                onClick={() => onSelectSubLeague(g.league)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                  isSelected ? theme.sectorSelected : theme.sectorIdle
                }`}
              >
                <span>{g.league}</span>
                <span
                  className={`text-[11px] tabular-nums font-bold ${
                    isSelected ? theme.sectorSelectedCount : 'text-slate-500'
                  }`}
                >
                  {g.count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
