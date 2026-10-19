import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  X, Search, UserPlus, UserCheck, Dices
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SeoHead from '../components/SeoHead';
import { useCurrentUser } from '../lib/authStore';
import { useBetSlipStore } from '../lib/betSlipStore';
import { useFollowStore } from '../lib/followStore';
import { searchPunters } from '../lib/punterDirectory';
import BetBuilder from '../components/BetBuilder';
import SlipReelFeed from '../components/SlipReelFeed';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import PunterProfileModal from '../components/PunterProfileModal';
import InviteModal from '../components/InviteModal';
import BackNavButton from '../components/BackNavButton';
import { showToast } from '../lib/notificationStore';

function ClapperPlayIcon({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20.2 6 3 11l-.9-2.4c-.4-1.1.2-2.4 1.3-2.8l13.7-4.9c1.1-.4 2.4.2 2.8 1.3Z" />
      <path d="m6.2 5.3 3.1 3.9" />
      <path d="m12.4 3.4 3.1 4" />
      <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <polygon points="10.5 13.5 15 16 10.5 18.5" fill="currentColor" stroke="none" />
    </svg>
  );
}



export default function BetSlipRoom() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useCurrentUser();
  const posts = useBetSlipStore((s) => s.posts);

  const isFollowing = useFollowStore((s) => s.isFollowing);
  const followUser = useFollowStore((s) => s.followUser);
  const unfollowUser = useFollowStore((s) => s.unfollowUser);
  const getFollowersCount = useFollowStore((s) => s.getFollowersCount);

  // User search & navigation states
  const [punterSearchQuery, setPunterSearchQuery] = useState('');
  const [selectedProfileUser, setSelectedProfileUser] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'slips' | 'punters'>('builder');

  const matchingPunters = searchPunters(punterSearchQuery);

  function handleFollowToggle(targetUser: string) {
    if (!currentUser) {
      showToast({ type: 'warning', title: 'Sign in required', message: 'Log in to follow other punters.' });
      return;
    }
    const following = isFollowing(currentUser.username, targetUser);
    if (following) {
      unfollowUser(currentUser.username, targetUser);
      showToast({ type: 'info', title: 'Unfollowed', message: `You stopped following ${targetUser}` });
    } else {
      followUser(currentUser.username, targetUser);
      showToast({ type: 'success', title: 'Following!', message: `You are now following ${targetUser}` });
    }
  }

  return (
    <div className="max-w-4xl lg:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <SeoHead
        title="Community Bet Slips & Code Parser"
        description="Share, parse, and analyze community bet slips for SportPesa, Betika, Mozzart, 22Bet & Odibets. Build multi-leg slips with Kenya's top punters."
        canonicalUrl="https://mshindi.co.ke/slips"
      />
      {/* Header Navigation */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <BackNavButton fallbackUrl="/" label="Back" />
      </div>

      <div className="mb-8 text-center sm:text-left">
        <h1 className="font-display font-black text-3xl sm:text-5xl text-slate-900 tracking-tight uppercase">
          Bet Builder &amp; Slips
        </h1>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-2xl font-normal">
          Build multi-leg bet slips with choosable markets (1X2, Over/Under, Double Chance, BTTS, Handicap), attach official bookie codes/links, and follow top community punters.
        </p>
      </div>

      {/* Main Mode Tabs (Floating Segmented Control Indicator) */}
      <div
        role="tablist"
        aria-label="Slip room view modes"
        className="relative flex items-center p-1 sm:p-1.5 bg-[#FAF9F5] border border-[#E5E3DC] rounded-full w-full max-w-md sm:max-w-xl mx-auto sm:mx-0 mb-8 shadow-[0_2px_8px_rgba(0,0,0,0.03)] select-none"
      >
        {/* Tab 1: Bet Builder */}
        <div className="relative flex-1 flex items-center min-w-0">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'builder'}
            onClick={() => setActiveTab('builder')}
            className={`relative z-10 w-full flex items-center justify-center py-2 sm:py-2.5 px-1 min-[380px]:px-2.5 sm:px-4 rounded-full text-[11px] min-[360px]:text-[12px] min-[400px]:text-[13px] sm:text-sm font-bold tracking-tight transition-colors duration-150 cursor-pointer active:scale-[0.98] ${
              activeTab === 'builder'
                ? 'text-white'
                : 'text-slate-800 hover:text-slate-950'
            }`}
          >
            {activeTab === 'builder' && (
              <motion.div
                layoutId="activeSlipTabIndicator"
                className="absolute inset-0 bg-[#00875A] rounded-full shadow-[0_1px_3px_rgba(0,108,84,0.3)]"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1 min-[380px]:gap-2 whitespace-nowrap truncate">
              <Dices className="w-3.5 h-3.5 min-[380px]:w-4 min-[380px]:h-4 shrink-0 stroke-[2.2]" />
              <span className="truncate">Bet Builder</span>
            </span>
          </button>
          <div className="w-px h-4 min-[380px]:h-5 bg-[#E2DFD8] shrink-0 mx-0.5" aria-hidden="true" />
        </div>

        {/* Tab 2: SlipFeed */}
        <div className="relative flex-1 flex items-center min-w-0">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'slips'}
            onClick={() => setActiveTab('slips')}
            className={`relative z-10 w-full flex items-center justify-center py-2 sm:py-2.5 px-1 min-[380px]:px-2.5 sm:px-4 rounded-full text-[11px] min-[360px]:text-[12px] min-[400px]:text-[13px] sm:text-sm font-bold tracking-tight transition-colors duration-150 cursor-pointer active:scale-[0.98] ${
              activeTab === 'slips'
                ? 'text-white'
                : 'text-slate-800 hover:text-slate-950'
            }`}
          >
            {activeTab === 'slips' && (
              <motion.div
                layoutId="activeSlipTabIndicator"
                className="absolute inset-0 bg-[#00875A] rounded-full shadow-[0_1px_3px_rgba(0,108,84,0.3)]"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1 min-[380px]:gap-2 whitespace-nowrap truncate">
              <ClapperPlayIcon className="w-3.5 h-3.5 min-[380px]:w-4 min-[380px]:h-4 shrink-0" size={16} />
              <span className="truncate">SlipFeed</span>
            </span>
          </button>
          <div className="w-px h-4 min-[380px]:h-5 bg-[#E2DFD8] shrink-0 mx-0.5" aria-hidden="true" />
        </div>

        {/* Tab 3: Find Punters */}
        <div className="relative flex-1 flex items-center min-w-0">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'punters'}
            onClick={() => setActiveTab('punters')}
            className={`relative z-10 w-full flex items-center justify-center py-2 sm:py-2.5 px-1 min-[380px]:px-2.5 sm:px-4 rounded-full text-[11px] min-[360px]:text-[12px] min-[400px]:text-[13px] sm:text-sm font-bold tracking-tight transition-colors duration-150 cursor-pointer active:scale-[0.98] ${
              activeTab === 'punters'
                ? 'text-white'
                : 'text-slate-800 hover:text-slate-950'
            }`}
          >
            {activeTab === 'punters' && (
              <motion.div
                layoutId="activeSlipTabIndicator"
                className="absolute inset-0 bg-[#00875A] rounded-full shadow-[0_1px_3px_rgba(0,108,84,0.3)]"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1 min-[380px]:gap-2 whitespace-nowrap truncate">
              <Search className="w-3.5 h-3.5 min-[380px]:w-4 min-[380px]:h-4 shrink-0 stroke-[2.2]" />
              <span className="truncate">Find Punters</span>
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: BET BUILDER */}
      {activeTab === 'builder' && (
        <div className="animate-fade-in">
          <BetBuilder onPublished={() => setActiveTab('slips')} />
        </div>
      )}

      {/* TAB 2: SLIPFEED */}
      {activeTab === 'slips' && (
        <SlipReelFeed
          posts={posts}
          onClose={() => setActiveTab('builder')}
        />
      )}

      {/* TAB 3: SEARCH PUNTERS / USERS */}
      {activeTab === 'punters' && (
        <div className="space-y-5 animate-fade-in">
          {/* Search Input Box */}
          <div className="relative max-w-2xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={punterSearchQuery}
              onChange={(e) => setPunterSearchQuery(e.target.value)}
              placeholder="Search punters by username (e.g. Mwangi, Kip_Punter)..."
              className="w-full bg-white border border-slate-300 focus:border-[#006C54] focus:ring-2 focus:ring-[#006C54]/15 rounded-full pl-11 pr-10 py-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none shadow-xs transition-all"
            />
            {punterSearchQuery && (
              <button
                onClick={() => setPunterSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 max-w-2xl px-1">
            <span>
              Showing <strong className="text-slate-900">{matchingPunters.length}</strong> punters
            </span>
            <span>Follow top punters to inspect their consensus slips</span>
          </div>

          {/* Punters Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {matchingPunters.length === 0 ? (
              <div className="sm:col-span-2 bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center text-slate-500 text-xs">
                No punters found matching &quot;{punterSearchQuery}&quot;. Try another search or invite a friend!
              </div>
            ) : (
              matchingPunters.map((punter) => {
                const following = currentUser ? isFollowing(currentUser.username, punter.username) : false;
                const followersCount = getFollowersCount(punter.username);
                const isSelf = currentUser?.username.toLowerCase() === punter.username.toLowerCase();

                return (
                  <div
                    key={punter.username}
                    className="bg-white border border-slate-200 hover:border-[#006C54] rounded-xl p-4 flex flex-col justify-between gap-3 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => setSelectedProfileUser(punter.username)}
                        className="flex items-center gap-3 min-w-0 text-left group"
                      >
                        <Avatar name={punter.username} seed={punter.username.length} size={42} />
                        <div className="min-w-0">
                          <h3 className="font-display font-black text-sm text-slate-900 group-hover:text-[#006C54] transition-colors truncate uppercase">
                            {punter.username}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <StarRating rating={punter.stars} size={12} />
                            <span className="text-[11px] font-bold text-slate-500">{punter.accuracyPct}% acc</span>
                          </div>
                        </div>
                      </button>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-black text-xs text-slate-900">{followersCount}</span>
                        <p className="text-[10px] text-slate-400 font-black uppercase">Followers</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      {!isSelf ? (
                        <button
                          onClick={() => handleFollowToggle(punter.username)}
                          className={`flex-1 py-1.5 px-3 rounded-full font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-2xs ${
                            following
                              ? 'bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200'
                              : 'bg-[#006C54] hover:bg-[#005441] text-white'
                          }`}
                        >
                          {following ? <UserCheck size={13} /> : <UserPlus size={13} />}
                          {following ? 'Following' : 'Follow'}
                        </button>
                      ) : (
                        <span className="flex-1 py-1.5 text-center text-xs font-bold text-[#006C54] bg-[#006C54]/10 rounded-full uppercase tracking-wider">
                          You
                        </span>
                      )}

                      <button
                        onClick={() => setSelectedProfileUser(punter.username)}
                        className="py-1.5 px-3 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-colors"
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Punter Profile Modal */}
      {selectedProfileUser && (
        <PunterProfileModal
          username={selectedProfileUser}
          onClose={() => {
            setSelectedProfileUser(null);
            if (searchParams.get('punter')) {
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('punter');
                  return next;
                },
                { replace: true }
              );
            }
          }}
        />
      )}

      {/* Invite Friends Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      {/* Bottom spacer */}
      <div className="h-8 sm:h-0" />
    </div>
  );
}
