import { useState, useMemo, useSyncExternalStore, useRef, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Trophy, Crown, Medal, Flame, Clock, CheckCircle2, Users, Search,
  Filter, Target, ExternalLink,
  Layers, ChevronUp, ChevronDown, SlidersHorizontal, Archive
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { subscribeToJackpots, getJackpotsSnapshot } from '../lib/mockData';
import { useUserPicks } from '../lib/userPicksStore';
import { isAdminUser, useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import PlayerProfileModal from '../components/PlayerProfileModal';
import JackpotCard from '../components/JackpotCard';
import JackpotAdminModal from '../components/JackpotAdminModal';
import { getPunterStats } from '../lib/punterRatings';
import { getRoomStatusInfo, type DisplayRoomStatus } from '../lib/roomStatus';
import { computeRoomPerformanceAndLeaderboard } from '../lib/leaderboardEngine';
import { LeaderboardSkeleton, JackpotGridSkeleton } from '../components/skeleton';
import { scrollIntoViewIfNeeded } from '../lib/viewportScroll';
import type { Bookie, RoomStatus } from '../lib/types';
import { getBookieTheme } from '../lib/bookies';

const jackpotBookies: (Bookie | 'All')[] = [
  'All',
  'SportPesa',
  'Betika',
  'MozzartBet',
  'Odibets',
  'SportyBet',
  'BetPawa',
  '1xBet',
  '22Bet',
];

const BOOKIE_BADGE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  SportPesa: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  Betika: { bg: 'bg-emerald-50', text: 'text-[#006C54]', border: 'border-emerald-200' },
  MozzartBet: { bg: 'bg-amber-50', text: 'text-[#8A6500]', border: 'border-amber-200' },
  Shabiki: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  Odibets: { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200' },
};

export default function Leaderboard() {
  const allJackpots = useSyncExternalStore(subscribeToJackpots, getJackpotsSnapshot, getJackpotsSnapshot);
  const user = useCurrentUser();
  const currentUsername = user?.username || 'MshindiPunter';
  const userPicks = useUserPicks((s) => s.userPicks);
  const isAuthorizedAdmin = isAdminUser(user);

  // Search parameters for deep linking (?tab=leaderboard vs default rooms)
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [mainTab, setMainTab] = useState<'rooms' | 'leaderboard'>(
    requestedTab === 'leaderboard' || requestedTab === 'ranks' ? 'leaderboard' : 'rooms'
  );

  const openAuthWall = useAuthWallStore((s) => s.openAuthWall);

  const handleTabChange = (tab: 'rooms' | 'leaderboard') => {
    if (tab === 'leaderboard' && !user) {
      openAuthWall({
        actionType: 'leaderboard',
        title: 'Sign In to View Leaderboards',
        message: 'Sign up or log in to view top punter rankings, gameweek performance, and star ratings.',
      });
      return;
    }

    setMainTab(tab);
    if (tab === 'rooms') {
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ tab: 'leaderboard' }, { replace: true });
    }
  };

  // State for Jackpot Consensus Rooms (Dominant Tab)
  const [roomBookie, setRoomBookie] = useState<Bookie | 'All'>('All');
  const [roomStatus, setRoomStatus] = useState<RoomStatus | 'All'>('All');
  const [roomQuery, setRoomQuery] = useState('');
  const [roomViewTab, setRoomViewTab] = useState<'active' | 'archive'>('active');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // State for Leaderboard & Standings Tab
  const [filterTab, setFilterTab] = useState<'all' | 'my' | DisplayRoomStatus>('all');
  const [selectedBookie, setSelectedBookie] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUserForModal, setSelectedUserForModal] = useState<string | null>(null);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>({});

  // Active vs Archived rooms
  const activeRooms = useMemo(() => allJackpots.filter((j) => j.status !== 'settled'), [allJackpots]);
  const archivedRooms = useMemo(() => allJackpots.filter((j) => j.status === 'settled'), [allJackpots]);

  const roomStatusOptions: (RoomStatus | 'All')[] = useMemo(() => {
    if (roomViewTab === 'active') {
      return ['All', 'open', 'locked'];
    }
    return ['All', 'settled'];
  }, [roomViewTab]);

  // Filtered rooms for Jackpot Consensus tab
  const filteredJackpotRooms = useMemo(() => {
    return allJackpots.filter((j) => {
      if (roomViewTab === 'active' && j.status === 'settled') return false;
      if (roomViewTab === 'archive' && j.status !== 'settled') return false;
      if (roomBookie !== 'All' && j.bookie !== roomBookie) return false;
      if (roomStatus !== 'All' && j.status !== roomStatus) return false;
      if (roomQuery && !`${j.name} ${j.bookie} ${j.gameweek}`.toLowerCase().includes(roomQuery.toLowerCase())) return false;
      return true;
    });
  }, [allJackpots, roomViewTab, roomBookie, roomStatus, roomQuery]);

  // Filtered rooms for Leaderboards tab
  const filteredLeaderboardJackpots = useMemo(() => {
    return allJackpots.filter((j) => {
      if (selectedBookie !== 'all' && j.bookie.toLowerCase() !== selectedBookie.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = j.name.toLowerCase().includes(q);
        const matchBookie = j.bookie.toLowerCase().includes(q);
        const matchGameweek = j.gameweek.toLowerCase().includes(q);
        if (!matchName && !matchBookie && !matchGameweek) return false;
      }
      const statusInfo = getRoomStatusInfo(j);
      const userKeysInRoom = Object.keys(userPicks).filter((k) => k.startsWith(`${j.id}:`));
      const userParticipated = userKeysInRoom.length > 0;

      if (filterTab === 'my') return userParticipated;
      if (filterTab === 'not_started') return statusInfo.status === 'not_started';
      if (filterTab === 'live') return statusInfo.status === 'live';
      if (filterTab === 'settled') return statusInfo.status === 'settled';

      return true;
    });
  }, [allJackpots, selectedBookie, searchQuery, filterTab, userPicks]);

  // Overall user stats across all participated rooms
  let totalRoomsJoined = 0;
  let totalUserCorrectLegs = 0;
  let totalUserEvaluatedLegs = 0;

  allJackpots.forEach((j) => {
    const userKeys = Object.keys(userPicks).filter((k) => k.startsWith(`${j.id}:`));
    if (userKeys.length > 0) {
      totalRoomsJoined++;
      if (j.matches) {
        j.matches.forEach((m) => {
          if (m.result) {
            totalUserEvaluatedLegs++;
            const rec = userPicks[`${j.id}:${m.id}`];
            if (rec && rec.pick === m.result) {
              totalUserCorrectLegs++;
            }
          }
        });
      }
    }
  });

  const overallAccuracy = totalUserEvaluatedLegs > 0 ? Math.round((totalUserCorrectLegs / totalUserEvaluatedLegs) * 100) : 0;
  const userStats = getPunterStats(currentUsername);

  function toggleRoomExpand(roomId: string) {
    setExpandedRooms((prev) => {
      const isNowExpanded = prev[roomId] !== true;
      if (isNowExpanded) {
        scrollIntoViewIfNeeded(document.getElementById(`room-leaderboard-${roomId}`));
      }
      return {
        ...prev,
        [roomId]: isNowExpanded,
      };
    });
  }

  if (allJackpots.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        <JackpotGridSkeleton count={6} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <SeoHead
        title={mainTab === 'rooms' ? "Jackpot Room — Kenya's Premier Consensus Arena" : "Top Punters Leaderboard & Gameweek Standings"}
        description="Pool consensus with Kenya's top punters for SportPesa Mega Jackpot, Betika Midweek & Mozzart Daily. View crowd picks, room standings & punter leaderboards."
        canonicalUrl="https://mshindi.co.ke/leaderboard"
      />

      <PlayerProfileModal
        username={selectedUserForModal}
        onClose={() => setSelectedUserForModal(null)}
      />

      <JackpotAdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />

      {/* =========================================================================
          TOP SEGMENTED SWITCHER: JACKPOT ROOMS (DOMINANT) vs LEADERBOARD
          ========================================================================= */}
      {/* Mobile View: Minimalist Clean Bar (Inspired by Picture 1) */}
      <div className="block sm:hidden bg-white border border-slate-200 rounded-xl p-2 shadow-xs space-y-2">
        <div className="grid grid-cols-2 divide-x divide-slate-100 text-center">
          <button
            type="button"
            onClick={() => handleTabChange('rooms')}
            className={`py-1.5 px-2 text-xs flex items-center justify-center gap-1.5 transition-colors ${
              mainTab === 'rooms'
                ? 'text-[#006C54] font-bold'
                : 'text-slate-500 font-semibold hover:text-slate-700'
            }`}
          >
            <span>Jackpot Rooms</span>
            <span className={`text-[11px] tabular-nums px-1.5 py-0.5 rounded-full font-bold ${
              mainTab === 'rooms' ? 'bg-emerald-50 text-[#006C54]' : 'bg-slate-100 text-slate-500'
            }`}>
              {activeRooms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('leaderboard')}
            className={`py-1.5 px-2 text-xs flex items-center justify-center gap-1.5 transition-colors ${
              mainTab === 'leaderboard'
                ? 'text-[#006C54] font-bold'
                : 'text-slate-500 font-semibold hover:text-slate-700'
            }`}
          >
            <span>Leaderboards &amp; Ranks</span>
          </button>
        </div>

        {/* Compact Mobile Stats Strip */}
        <div className="border-t border-slate-100 pt-1.5 px-1 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-medium">Joined:</span>
            <strong className="text-slate-800 font-bold">{totalRoomsJoined}</strong>
          </div>
          <div className="w-px h-3 bg-slate-200" />
          <div className="flex items-center gap-1">
            <span className="text-slate-400 font-medium">Accuracy:</span>
            <strong className="text-[#006C54] font-bold">{overallAccuracy}%</strong>
          </div>
          <div className="w-px h-3 bg-slate-200" />
          <div className="flex items-center gap-0.5 text-[#8A6500] font-bold">
            <span>{userStats.stars}★</span>
          </div>
        </div>
      </div>

      {/* Desktop View: Clean Text Tab Switcher & Stats (sm: and up) */}
      <div className="hidden sm:flex sm:flex-row sm:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-3 self-start">
          <button
            type="button"
            onClick={() => handleTabChange('rooms')}
            className={`py-2 px-1 font-display text-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer ${
              mainTab === 'rooms'
                ? 'text-[#006C54] font-bold'
                : 'text-slate-500 font-bold hover:text-slate-800'
            }`}
          >
            <Flame size={16} className={mainTab === 'rooms' ? 'text-[#006C54]' : 'text-slate-400'} />
            <span>Jackpot Rooms</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full tabular-nums font-bold ${
                mainTab === 'rooms' ? 'bg-emerald-50 text-[#006C54]' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {activeRooms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('leaderboard')}
            className={`py-2 px-1 font-display text-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer ${
              mainTab === 'leaderboard'
                ? 'text-[#006C54] font-bold'
                : 'text-slate-500 font-bold hover:text-slate-800'
            }`}
          >
            <Trophy size={16} className={mainTab === 'leaderboard' ? 'text-[#006C54]' : 'text-slate-400'} />
            <span>Leaderboards &amp; Ranks</span>
          </button>
        </div>

        {/* User Stats Pill in Header */}
        <div className="flex items-center gap-3 bg-white border border-[#D4D4C0] px-4 py-2 rounded-full text-xs shrink-0 self-stretch sm:self-auto justify-between shadow-2xs">
          <div className="flex items-center gap-1.5">
            <Target size={14} className="text-[#006C54]" />
            <span className="text-slate-500 font-bold uppercase text-[11px]">Joined:</span>
            <strong className="text-slate-900 font-bold">{totalRoomsJoined}</strong>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold uppercase text-[11px]">Accuracy:</span>
            <strong className="text-[#006C54] font-bold">{overallAccuracy}%</strong>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <div className="flex items-center gap-1 text-[#8A6500] font-bold">
            {userStats.stars}★
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: JACKPOT CONSENSUS ROOMS (DOMINANT VIEW)
          ========================================================================= */}
      {mainTab === 'rooms' && (
        <div className="space-y-6 animate-rise">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl text-slate-900">
                Jackpot Consensus Rooms
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {roomViewTab === 'active'
                  ? 'Showing live and upcoming jackpot rooms. Select any room to vote and pool crowd consensus.'
                  : 'Jackpot Archives: Review completed rooms, final winning slips, and historical crowd accuracy.'}
              </p>
            </div>

            {isAuthorizedAdmin && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  onClick={() => setIsAdminModalOpen(true)}
                  className="h-10 px-4 rounded-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold uppercase tracking-wide inline-flex items-center gap-2 active:scale-95 transition-all shadow-2xs cursor-pointer"
                >
                  <SlidersHorizontal size={14} className="text-[#006C54]" />
                  <span>Jackpot Admin Console</span>
                </button>
              </div>
            )}
          </div>

          {/* View Mode Navigation Tabs: Active vs Archive (Text Highlight Without Green Pill) */}
          <div className="flex items-center justify-between gap-3 bg-white rounded-2xl p-2 shadow-xs">
            <div className="flex items-center gap-1 min-w-0 flex-wrap">
              <button
                onClick={() => {
                  setRoomViewTab('active');
                  setRoomStatus('All');
                }}
                className={`px-4 py-2 font-display text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer ${
                  roomViewTab === 'active'
                    ? 'text-[#006C54] font-bold'
                    : 'text-slate-500 font-bold hover:text-slate-800'
                }`}
              >
                <Flame size={15} className={roomViewTab === 'active' ? 'text-[#006C54]' : 'text-slate-400'} />
                <span>Active Rooms</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full tabular-nums font-bold ${
                  roomViewTab === 'active' ? 'bg-emerald-50 text-[#006C54]' : 'bg-slate-100 text-slate-500'
                }`}>
                  {activeRooms.length}
                </span>
              </button>

              <button
                onClick={() => {
                  setRoomViewTab('archive');
                  setRoomStatus('All');
                }}
                className={`px-4 py-2 font-display text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer ${
                  roomViewTab === 'archive'
                    ? 'text-[#006C54] font-bold'
                    : 'text-slate-500 font-bold hover:text-slate-800'
                }`}
              >
                <Archive size={15} className={roomViewTab === 'archive' ? 'text-[#006C54]' : 'text-slate-400'} />
                <span>Archives</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full tabular-nums font-bold ${
                  roomViewTab === 'archive' ? 'bg-emerald-50 text-[#006C54]' : 'bg-slate-100 text-slate-500'
                }`}>
                  {archivedRooms.length}
                </span>
              </button>
            </div>
          </div>

          {/* Bookie Filter Pills With Logos */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 flex-nowrap sm:flex-wrap">
            {jackpotBookies.map((b) => {
              const t = b !== 'All' ? getBookieTheme(b) : null;
              return (
                <button
                  key={b}
                  onClick={() => setRoomBookie(b)}
                  className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold border transition-all shrink-0 whitespace-nowrap active:scale-95 flex items-center gap-1.5 ${
                    roomBookie === b
                      ? 'bg-[#006C54] border-[#006C54] text-white shadow-xs font-bold'
                      : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {t && (
                    <div className="w-3.5 h-3.5 rounded-full overflow-hidden shrink-0 border border-slate-200 bg-white p-0.2">
                      <img src={t.logo} alt={b} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <span>{b}</span>
                </button>
              );
            })}
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-2">
            <div ref={statusDropdownRef} className="relative inline-block text-left">
              <button
                type="button"
                onClick={() => setIsStatusDropdownOpen((v) => !v)}
                className="h-9 px-4 rounded-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-2 active:scale-95 transition-all shadow-2xs cursor-pointer"
              >
                <span>
                  {roomStatus === 'All'
                    ? (roomViewTab === 'active' ? 'All Active' : 'All Settled')
                    : roomStatus.charAt(0).toUpperCase() + roomStatus.slice(1)}
                </span>
                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180 text-slate-600' : ''}`}
                />
              </button>

              {isStatusDropdownOpen && (
                <div className="absolute left-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-40 animate-rise text-xs">
                  {roomStatusOptions.map((s) => {
                    const isSelected = roomStatus === s;
                    const label = s === 'All'
                      ? (roomViewTab === 'active' ? 'All Active' : 'All Settled')
                      : s.charAt(0).toUpperCase() + s.slice(1);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setRoomStatus(s);
                          setIsStatusDropdownOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'text-slate-900 font-bold' : 'text-slate-700 font-medium'
                        }`}
                      >
                        <span>{label}</span>
                        {isSelected && <CheckCircle2 size={13} className="text-[#006C54]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Archive Banner when in Archive mode */}
          {roomViewTab === 'archive' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-rise">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <Archive size={20} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">Jackpot Archives &amp; Settlement History</h3>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    Settled jackpot rooms are retained for up to 90 days. You can review verified crowd accuracy, winning leg slips, and historical gameweek leaderboards.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setRoomViewTab('active');
                  setRoomStatus('All');
                }}
                className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold transition-all shrink-0"
              >
                ← Back to Active Rooms
              </button>
            </div>
          )}

          {/* Jackpot Grid */}
          {filteredJackpotRooms.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white border border-slate-200 rounded-2xl max-w-xl mx-auto space-y-4 shadow-xs">
              <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#006C54] flex items-center justify-center mx-auto">
                <SlidersHorizontal size={24} />
              </span>
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900">
                  {roomViewTab === 'active' ? 'No Active Jackpot Rooms Found' : 'No Archived Rooms Found'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {roomViewTab === 'active'
                    ? 'All active jackpot rooms have concluded or are pending publication. You can check past results in the Archives!'
                    : 'No settled jackpot rooms match your search or filter selection.'}
                </p>
              </div>
              {roomViewTab === 'active' && archivedRooms.length > 0 && (
                <button
                  onClick={() => {
                    setRoomViewTab('archive');
                    setRoomStatus('All');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#006C54] hover:bg-[#005441] text-white font-bold text-xs shadow-xs transition-all"
                >
                  <Archive size={15} />
                  <span>Browse {archivedRooms.length} Archived Rooms</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJackpotRooms.map((j, i) => (
                <JackpotCard key={j.id} jackpot={j} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: LEADERBOARDS & STANDINGS (ACCESSIBLE IN THE JACKPOT ROOM)
          ========================================================================= */}
      {mainTab === 'leaderboard' && (
        <div className="space-y-6 animate-rise">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-xs">
            <div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
                Room Standings &amp; Rankings
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
                Independent standings per jackpot room. Select any room to expand its rankings, participant slips &amp; live leg hits.
              </p>
            </div>
          </div>

          {/* Filter Tabs & Search Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Main Status Category Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-full overflow-x-auto scrollbar-none text-xs font-bold uppercase tracking-wide w-full sm:w-auto">
                <button
                  onClick={() => setFilterTab('all')}
                  className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                    filterTab === 'all'
                      ? 'bg-[#006C54] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers size={13} /> All ({allJackpots.length})
                </button>

                <button
                  onClick={() => setFilterTab('my')}
                  className={`px-4 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 ${
                    filterTab === 'my'
                      ? 'bg-[#006C54] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Target size={13} /> My Rooms ({totalRoomsJoined})
                </button>

                <button
                  onClick={() => setFilterTab('not_started')}
                  className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    filterTab === 'not_started'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock size={12} /> Upcoming
                </button>

                <button
                  onClick={() => setFilterTab('live')}
                  className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    filterTab === 'live'
                      ? 'bg-[#006C54] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Flame size={12} /> Live
                </button>

                <button
                  onClick={() => setFilterTab('settled')}
                  className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    filterTab === 'settled'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 size={12} /> Settled
                </button>
              </div>

              {/* Search Input */}
              <div className="relative shrink-0 sm:w-56">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search room..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#006C54] rounded-full pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none placeholder:text-slate-400 transition-all"
                />
              </div>
            </div>

            {/* Bookie Pill Selection With Logos */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 scrollbar-none">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1 shrink-0 mr-1">
                <Filter size={11} /> Bookie:
              </span>
              {['all', 'SportPesa', 'Betika', 'MozzartBet', 'Odibets', 'SportyBet', 'BetPawa', '1xBet', '22Bet'].map((b) => {
                const t = b !== 'all' ? getBookieTheme(b) : null;
                return (
                  <button
                    key={b}
                    onClick={() => setSelectedBookie(b)}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border transition-all shrink-0 flex items-center gap-1.5 ${
                      selectedBookie.toLowerCase() === b.toLowerCase()
                        ? 'bg-[#006C54] border-[#006C54] text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-[#006C54] hover:text-[#006C54]'
                    }`}
                  >
                    {t && (
                      <div className="w-3 h-3 rounded-full overflow-hidden shrink-0 border border-slate-200 bg-white">
                        <img src={t.logo} alt={b} className="w-full h-full object-contain" />
                      </div>
                    )}
                    <span>{b === 'all' ? 'All' : b}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Empty State */}
          {filteredLeaderboardJackpots.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3 max-w-sm mx-auto my-6 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-[#8A6500] flex items-center justify-center mx-auto">
                <Trophy size={20} />
              </div>
              <h3 className="font-display font-bold text-sm text-slate-900">No Rooms Found</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {filterTab === 'my'
                  ? "You haven't made predictions in any room yet."
                  : 'No jackpot rooms match your selected filter criteria.'}
              </p>
              <button
                onClick={() => {
                  setFilterTab('all');
                  setSelectedBookie('all');
                  setSearchQuery('');
                }}
                className="py-1.5 px-3.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            /* Render Space-Friendly Standings Cards */
            <div className="space-y-3">
              {filteredLeaderboardJackpots.map((jackpot) => {
                const { leaderboard, userPerf } = computeRoomPerformanceAndLeaderboard(
                  jackpot,
                  currentUsername,
                  userPicks
                );

                const isExpanded = expandedRooms[jackpot.id] === true;
                const statusInfo = getRoomStatusInfo(jackpot);
                const cardTheme = getBookieTheme(jackpot.bookie);

                const completedCount = statusInfo.completedCount;
                const totalMatches = statusInfo.totalCount;

                return (
                  <div
                    key={jackpot.id}
                    id={`room-leaderboard-${jackpot.id}`}
                    className={`border rounded-xl overflow-hidden transition-all hover:shadow-md ${
                      userPerf.participated ? 'border-[#006C54] ring-1 ring-[#006C54]/20' : 'hover:border-[#006C54]'
                    }`}
                    style={{
                      background: `linear-gradient(180deg, ${cardTheme.fadedBg} 0%, #ffffff 40%)`,
                      borderColor: userPerf.participated ? '#006C54' : cardTheme.border,
                    }}
                  >
                    {/* Minimalist Card Header */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center p-0.5 overflow-hidden border shrink-0 shadow-2xs"
                              style={{ background: cardTheme.iconBg, borderColor: cardTheme.border }}
                            >
                              <img src={cardTheme.logo} alt={jackpot.bookie} className="w-full h-full object-contain" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-800">
                              {jackpot.bookie}
                            </span>

                            {userPerf.participated && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="text-[11px] font-bold uppercase tracking-wide text-[#006C54] flex items-center gap-1">
                                  <Target size={11} /> My Picked Room
                                </span>
                              </>
                            )}
                          </div>

                          {/* Mobile Right-Side Status Indicator */}
                          <div className="sm:hidden">
                            <span className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 text-slate-600">
                              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                              {statusInfo.label}
                            </span>
                          </div>
                        </div>

                        <h3 className="font-display font-bold text-base sm:text-lg text-slate-900 truncate flex items-center gap-1.5 uppercase">
                          {jackpot.name}
                          <span className="text-xs font-semibold text-slate-400 not-italic">({jackpot.gameweek})</span>
                        </h3>

                        <p className="text-xs text-slate-500 truncate">
                          {jackpot.deadline} · <span className="text-slate-800 font-bold">{jackpot.participants.toLocaleString()} punters</span>
                        </p>
                      </div>

                      {/* Right Side Prize Pool, Desktop Status & Custom Side-by-Side Text Buttons */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        {/* Desktop Status Indicator (Right Side) */}
                        <div className="hidden sm:block">
                          <span className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 text-slate-600">
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                            {statusInfo.label}
                          </span>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wide">Bookie Jackpot</span>
                          <p className="font-display font-bold text-[#8A6500] text-base sm:text-lg leading-none">
                            {jackpot.prizePool}
                          </p>
                        </div>

                        {/* Side-by-Side Text Buttons with No Pill Background */}
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/room/${jackpot.id}`}
                            className="text-xs font-bold text-slate-600 hover:text-[#006C54] flex items-center gap-1 transition-colors py-1"
                          >
                            <span>Enter Room</span>
                            <ExternalLink size={12} />
                          </Link>

                          <button
                            type="button"
                            onClick={() => toggleRoomExpand(jackpot.id)}
                            className={`text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer py-1 ${
                              isExpanded
                                ? 'text-[#006C54] font-bold'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <span>{isExpanded ? 'Hide' : 'Standings'}</span>
                            {isExpanded ? <ChevronUp size={14} className="text-[#006C54]" /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Minimalist User Performance Line (if participated) */}
                    {userPerf.participated && (
                      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold uppercase text-slate-700 tracking-wide">
                            Your Rank:
                          </span>
                          <span className="font-bold text-slate-900">
                            #{userPerf.userRank} of {leaderboard.length}
                          </span>
                          <span className="text-slate-500 text-[11px] font-semibold">
                            ({userPerf.userCorrect}/{completedCount || totalMatches} hits • {userPerf.accuracy}%)
                          </span>
                        </div>

                        <span className="text-[11px] font-bold uppercase text-[#006C54] tracking-wide">
                          Active Pick
                        </span>
                      </div>
                    )}

                    {/* Expandable Room Standings Table */}
                    {isExpanded && (
                      <div className="p-3.5 sm:p-4 border-t border-slate-200 space-y-4 bg-slate-50/50">
                        {/* Compact Top 3 Banner */}
                        {leaderboard.length >= 3 && (
                          <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto py-1">
                            {[1, 0, 2].map((orderIdx) => {
                              const e = leaderboard[orderIdx];
                              if (!e) return null;

                              const isFirst = orderIdx === 0;
                              const isCurrUser = e.username.toLowerCase() === currentUsername.toLowerCase();
                              const RankIcon = isFirst ? Crown : Medal;

                              return (
                                <div
                                  key={e.username}
                                  onClick={() => setSelectedUserForModal(e.username)}
                                  className={`p-2 rounded-xl border text-center cursor-pointer transition-all ${
                                    isFirst
                                      ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400/30'
                                      : 'bg-white border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <RankIcon size={14} className={isFirst ? 'text-[#8A6500]' : 'text-slate-400'} />
                                    <span className={`font-display font-bold text-xs ${isFirst ? 'text-[#8A6500]' : 'text-slate-700'}`}>
                                      #{e.rank}
                                    </span>
                                  </div>

                                  <p className={`text-xs font-bold truncate mt-0.5 ${isCurrUser ? 'text-[#006C54]' : 'text-slate-900'}`}>
                                    {e.username} {isCurrUser && '(You)'}
                                  </p>

                                  <p className="text-[11px] tabular-nums font-bold text-[#8A6500] mt-0.5">
                                    {e.correct}/{completedCount || totalMatches} Hits
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* High-Density Standings Table */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                            <span className="font-bold text-slate-900 flex items-center gap-1">
                              <Users size={12} className="text-[#006C54]" /> Room Standings ({leaderboard.length} Punters)
                            </span>
                            <span>{statusInfo.description}</span>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                            <table className="w-full table-fixed text-left text-xs text-slate-600">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase font-bold text-slate-500">
                                  <th className="py-2 px-2 sm:px-3 w-[18%] sm:w-[15%]">Rank</th>
                                  <th className="py-2 px-2 sm:px-3 w-[46%] sm:w-[50%]">Punter</th>
                                  <th className="py-2 px-2 sm:px-3 text-center w-[20%] sm:w-[18%]">
                                    <span className="hidden sm:inline">Correct Hits</span>
                                    <span className="sm:hidden">Hits</span>
                                  </th>
                                  <th className="py-2 px-2 sm:px-3 text-center w-[16%] sm:w-[17%]">
                                    <span className="hidden sm:inline">Accuracy</span>
                                    <span className="sm:hidden">Acc.</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {leaderboard.map((entry) => {
                                  const isCurrUser = entry.username.toLowerCase() === currentUsername.toLowerCase();
                                  const stats = getPunterStats(entry.username);
                                  const accuracyPct = completedCount > 0
                                    ? Math.round((entry.correct / completedCount) * 100)
                                    : 0;

                                  return (
                                    <tr
                                      key={entry.rank}
                                      onClick={() => setSelectedUserForModal(entry.username)}
                                      className={`cursor-pointer transition-colors ${
                                        isCurrUser
                                          ? 'bg-emerald-50/70 font-bold text-slate-900 hover:bg-emerald-50'
                                          : entry.isClosest
                                          ? 'bg-amber-50/50 font-medium hover:bg-amber-50'
                                          : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      {/* Rank */}
                                      <td className="py-2 px-2 sm:px-3 font-bold text-[11px] sm:text-xs whitespace-nowrap">
                                        {entry.rank === 1 ? (
                                          <span className="text-[#8A6500] font-bold">#1 👑</span>
                                        ) : (
                                          <span className="tabular-nums text-slate-500">#{entry.rank}</span>
                                        )}
                                      </td>

                                      {/* Punter Name & Avatar */}
                                      <td className="py-2 px-2 sm:px-3 font-bold text-slate-900">
                                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                          <div className="shrink-0">
                                            <Avatar name={entry.username} seed={entry.colorSeed} size={18} />
                                          </div>
                                          <span className="hover:text-[#006C54] transition-colors truncate text-[11px] sm:text-xs min-w-0">
                                            {entry.username}
                                          </span>
                                          {isCurrUser && (
                                            <span className="text-[11px] font-bold uppercase text-white bg-[#006C54] px-1 py-0.5 rounded shrink-0">
                                              YOU
                                            </span>
                                          )}
                                          <div className="hidden xs:block shrink-0">
                                            <StarRating rating={stats.stars} size={8} showNumber={false} />
                                          </div>
                                        </div>
                                      </td>

                                      {/* Correct Hits */}
                                      <td className="py-2 px-2 sm:px-3 text-center tabular-nums font-bold text-slate-900 text-[11px] sm:text-xs whitespace-nowrap">
                                        <span className="text-[#006C54]">{entry.correct}</span>/<span className="text-slate-400">{completedCount || totalMatches}</span>
                                      </td>

                                      {/* Accuracy % */}
                                      <td className="py-2 px-2 sm:px-3 text-center whitespace-nowrap">
                                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                          accuracyPct >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                          {completedCount > 0 ? `${accuracyPct}%` : ' - '}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
