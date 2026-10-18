import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  X, Search, UserPlus, UserCheck, Dices, Clapperboard
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

      {/* Main Mode Tabs (ESPN Pill Navigation) */}
      <div className="flex items-center justify-center p-1.5 bg-white border border-slate-300 rounded-full max-w-xl mx-auto sm:mx-0 mb-8 shadow-xs">
        <button
          onClick={() => setActiveTab('builder')}
          className={`flex-1 py-2 px-4 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 ${
            activeTab === 'builder'
              ? 'bg-[#006C54] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Dices size={15} />
          Bet Builder
        </button>
        <button
          onClick={() => setActiveTab('slips')}
          className={`flex-1 py-2 px-4 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 ${
            activeTab === 'slips'
              ? 'bg-[#006C54] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clapperboard size={15} />
          SlipFeed
        </button>
        <button
          onClick={() => setActiveTab('punters')}
          className={`flex-1 py-2 px-4 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 ${
            activeTab === 'punters'
              ? 'bg-[#006C54] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search size={15} />
          Find Punters
        </button>
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
