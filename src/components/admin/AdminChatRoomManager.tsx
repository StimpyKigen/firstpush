import React, { useState, useMemo, useSyncExternalStore, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Radio,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import {
  getFreeMatchesSnapshot,
  subscribeToFreeMatches,
  type FreeMatch,
} from '../../lib/freeMatches';
import {
  buildSportScoreCountryDirectory,
  SPORTSCORE_COUNTRY_DIRECTORY_CONFIG,
  type SportScoreDirectoryRow,
} from '../../lib/leagueDirectory';
import { useChatRoomStore } from '../../lib/chatRoomStore';
import { formatKickoffDateTime24h } from '../../lib/competitionPriority';

export default function AdminChatRoomManager() {
  const matches = useSyncExternalStore(
    subscribeToFreeMatches,
    getFreeMatchesSnapshot,
    getFreeMatchesSnapshot
  );

  const enabledMatchIds = useChatRoomStore((s) => s.enabledMatchIds);
  const toggleChatRoom = useChatRoomStore((s) => s.toggleChatRoom);
  const enableChatRoom = useChatRoomStore((s) => s.enableChatRoom);
  const disableChatRoom = useChatRoomStore((s) => s.disableChatRoom);

  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [selectedSubLeague, setSelectedSubLeague] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Directory data
  const directoryData = useMemo(() => {
    return buildSportScoreCountryDirectory(matches);
  }, [matches]);

  // Selected Directory label
  const selectedDirectoryLabel = useMemo(() => {
    if (selectedLeague === 'all') return 'All Competitions';
    const found =
      directoryData.rows.find((entry) => entry.id === selectedLeague) ||
      SPORTSCORE_COUNTRY_DIRECTORY_CONFIG.find((entry) => entry.id === selectedLeague);
    const countryLabel = found ? found.label : selectedLeague.charAt(0).toUpperCase() + selectedLeague.slice(1);
    if (selectedSubLeague && selectedSubLeague !== 'all') {
      return `${countryLabel}: ${selectedSubLeague}`;
    }
    return countryLabel;
  }, [selectedLeague, selectedSubLeague, directoryData.rows]);

  // Filtered fixtures
  const filteredMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return matches.filter((m) => {
      // 1. Text search
      if (q) {
        const homeMatch = m.home.toLowerCase().includes(q);
        const awayMatch = m.away.toLowerCase().includes(q);
        const compMatch = m.competition.toLowerCase().includes(q);
        if (!homeMatch && !awayMatch && !compMatch) return false;
      }

      // 2. League filter
      if (selectedLeague !== 'all') {
        const row = directoryData.rows.find((r) => r.id === selectedLeague);
        if (row) {
          const compLower = m.competition.toLowerCase();
          const matchBelongs =
            row.leagues.some((l) => l.league.toLowerCase() === compLower) ||
            (m.country && m.country.toLowerCase() === row.country.toLowerCase());
          if (!matchBelongs) return false;
        }
      }

      // 3. Sub-league
      if (selectedSubLeague !== 'all') {
        if (m.competition.toLowerCase() !== selectedSubLeague.toLowerCase()) return false;
      }

      return true;
    });
  }, [matches, searchQuery, selectedLeague, selectedSubLeague, directoryData.rows]);

  const enabledCountInView = useMemo(() => {
    return filteredMatches.filter((m) => enabledMatchIds.includes(m.id)).length;
  }, [filteredMatches, enabledMatchIds]);

  const handleEnableAllInView = () => {
    filteredMatches.forEach((m) => enableChatRoom(m.id));
  };

  const handleDisableAllInView = () => {
    filteredMatches.forEach((m) => disableChatRoom(m.id));
  };

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="bg-[#FFFFF0] border border-[#DCDCC8] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-[#006C54]" />
            <h3 className="font-display font-bold text-slate-900 text-base uppercase tracking-tight">
              Live Chat Room Manager
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Assign live chat rooms to specific football matches. Fixtures not assigned here will have live chat hidden.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3.5 py-1.5 rounded-xl bg-[#F5F5E4] border border-[#E6E6D2] text-xs">
            <span className="text-slate-500 font-medium">Assigned Rooms: </span>
            <span className="font-bold text-[#006C54] tabular-nums">
              {enabledMatchIds.length}
            </span>
          </div>
        </div>
      </div>

      {/* Directory & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Dropdown Directory */}
        <div className="relative" ref={dropdownRef}>
          <div className="inline-flex items-center rounded-xl overflow-hidden border border-[#DCDCC8] bg-white shadow-2xs divide-x divide-slate-200">
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="h-9 px-3.5 flex items-center gap-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer select-none max-w-[220px] sm:max-w-[280px]"
            >
              <Layers size={13} className="text-[#006C54] shrink-0" />
              <span className="truncate">{selectedDirectoryLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              aria-label="Toggle competition dropdown"
              className="h-9 px-2.5 flex items-center justify-center text-slate-500 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {/* Directory Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-80 overflow-y-auto no-scrollbar p-1.5 text-xs">
              {/* All Competitions Option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedLeague('all');
                  setSelectedSubLeague('all');
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                  selectedLeague === 'all'
                    ? 'bg-[#006C54] text-white font-bold'
                    : 'text-slate-800 hover:bg-[#F5F5E4] font-medium'
                }`}
              >
                <span>All Competitions</span>
                <span className="tabular-nums font-semibold">{matches.length}</span>
              </button>

              <div className="my-1 border-t border-slate-100" />

              {/* Grouped Rows */}
              {directoryData.rows.map((row) => {
                const isSelected = selectedLeague === row.id && selectedSubLeague === 'all';
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      setSelectedLeague(row.id);
                      setSelectedSubLeague('all');
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#006C54] text-white font-bold'
                        : 'text-slate-800 hover:bg-[#F5F5E4] font-medium'
                    }`}
                  >
                    <span className="truncate pr-2">{row.label}</span>
                    <span className="tabular-nums font-semibold shrink-0">{row.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teams or competition..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#DCDCC8] rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] shadow-2xs"
          />
        </div>
      </div>

      {/* Batch Action Bar */}
      <div className="flex items-center justify-between text-xs py-1 px-1">
        <span className="text-slate-500 font-medium">
          Showing <strong className="text-slate-800">{filteredMatches.length}</strong> fixtures (
          <strong className="text-[#006C54]">{enabledCountInView}</strong> enabled in view)
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleEnableAllInView}
            disabled={filteredMatches.length === 0}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Enable All in View
          </button>
          <button
            type="button"
            onClick={handleDisableAllInView}
            disabled={filteredMatches.length === 0}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-40 cursor-pointer"
          >
            Disable All in View
          </button>
        </div>
      </div>

      {/* Fixtures List */}
      <div className="border border-[#DCDCC8] rounded-2xl bg-white overflow-hidden shadow-2xs divide-y divide-[#E6E6D2]">
        {filteredMatches.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No fixtures found matching the selected criteria.
          </div>
        ) : (
          filteredMatches.map((match) => {
            const isEnabled = enabledMatchIds.includes(match.id);
            const isLive = match.status === 'in';
            const isFinished = match.status === 'post';

            return (
              <div
                key={match.id}
                className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FFFFF0]/60 transition-colors"
              >
                {/* Match Information */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold mb-1">
                    <span className="truncate">{match.competition}</span>
                    <span>·</span>
                    <span className="tabular-nums">
                      {formatKickoffDateTime24h(match.kickoffIso, match.kickoff)}
                    </span>
                    {isLive && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px] animate-pulse">
                        <Radio size={10} /> LIVE
                      </span>
                    )}
                    {isFinished && (
                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px]">
                        FT
                      </span>
                    )}
                  </div>

                  <h4 className="font-display font-bold text-slate-900 text-sm sm:text-base leading-tight">
                    {match.home} <span className="text-slate-400 font-normal">v</span> {match.away}
                  </h4>
                </div>

                {/* Assignment Toggle Button */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => toggleChatRoom(match.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs ${
                      isEnabled
                        ? 'bg-[#006C54] text-white hover:bg-[#005441]'
                        : 'bg-[#F5F5E4] text-slate-600 border border-[#DCDCC8] hover:bg-[#EAEAD6]'
                    }`}
                  >
                    {isEnabled ? (
                      <>
                        <CheckCircle2 size={14} className="text-emerald-300" />
                        <span>Chat Room Enabled</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={14} className="text-slate-400" />
                        <span>Chat Room Disabled</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
