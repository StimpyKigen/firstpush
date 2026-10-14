import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, X, Search, UserPlus, UserCheck, Share2, Dices, Clapperboard
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <SeoHead
        title="Community Bet Slips & Code Parser"
        description="Share, parse, and analyze community bet slips for SportPesa, Betika, Mozzart, 22Bet & Odibets. Build multi-leg slips with Kenya's top punters."
        canonicalUrl="https://mshindi.co.ke/slips"
      />
      {/* Header Navigation */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-cream-dim hover:text-cream transition-colors">
          <ArrowLeft size={15} /> Back home
        </Link>

        <div className="flex items-center gap-2">
          {currentUser && (
            <button
              onClick={() => setSelectedProfileUser(currentUser.username)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-cream-dim hover:text-gold bg-panel border border-line hover:border-gold/30 px-3 py-1.5 rounded-full transition-colors"
            >
              <Share2 size={13} /> My Profile Link
            </button>
          )}
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-ink bg-gold hover:bg-gold-2 px-3 py-1.5 rounded-full shadow transition-all"
          >
            <UserPlus size={13} /> Invite Friends
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 bg-gold/10 border border-gold/30 text-gold text-xs font-bold px-3 py-1.5 rounded-full">
            <Sparkles size={13} /> Bet Builder & Slip Hub
          </span>
        </div>
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-cream">
          Bet Builder & Slip Room
        </h1>
        <p className="text-sm text-cream-dim mt-1 leading-relaxed">
          Build multi-leg bet slips with choosable markets (1X2, Over/Under, Double Chance, BTTS, Handicap), attach official bookie codes/links, and follow top community punters.
        </p>
      </div>

      {/* Main Mode Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-panel border border-line rounded-2xl mb-6">
        <button
          onClick={() => setActiveTab('builder')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'builder'
              ? 'bg-gold text-ink shadow font-extrabold'
              : 'text-cream-dim hover:text-cream'
          }`}
        >
          <Dices size={15} />
          Bet Builder
        </button>
        <button
          onClick={() => setActiveTab('slips')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'slips'
              ? 'bg-gold text-ink shadow font-extrabold'
              : 'text-cream-dim hover:text-cream'
          }`}
        >
          <Clapperboard size={15} />
          SlipFeed
        </button>
        <button
          onClick={() => setActiveTab('punters')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'punters'
              ? 'bg-gold text-ink shadow font-extrabold'
              : 'text-cream-dim hover:text-cream'
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

      {/* TAB 2: SEARCH PUNTERS / USERS */}
      {activeTab === 'punters' && (
        <div className="space-y-5 animate-fade-in">
          {/* Search Input Box */}
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold" />
            <input
              type="text"
              value={punterSearchQuery}
              onChange={(e) => setPunterSearchQuery(e.target.value)}
              placeholder="Search punters by username (e.g. Mwangi, Kip_Punter)..."
              className="w-full bg-panel border border-gold/40 focus:border-gold rounded-2xl pl-11 pr-10 py-3.5 text-sm text-cream placeholder:text-cream-dim/60 focus:outline-none shadow-lg"
            />
            {punterSearchQuery && (
              <button
                onClick={() => setPunterSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-cream-dim hover:text-cream"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-cream-dim">
            <span>
              Showing <strong className="text-cream">{matchingPunters.length}</strong> punters
            </span>
            <span>Follow punters to stay updated on their consensus picks</span>
          </div>

          {/* Punters Grid */}
          <div className="grid sm:grid-cols-2 gap-3.5">
            {matchingPunters.length === 0 ? (
              <div className="sm:col-span-2 bg-panel border border-dashed border-line rounded-2xl p-8 text-center text-cream-dim text-xs">
                No punters found matching "{punterSearchQuery}". Try another search or invite a friend!
              </div>
            ) : (
              matchingPunters.map((punter) => {
                const following = currentUser ? isFollowing(currentUser.username, punter.username) : false;
                const followersCount = getFollowersCount(punter.username);
                const isSelf = currentUser?.username.toLowerCase() === punter.username.toLowerCase();

                return (
                  <div
                    key={punter.username}
                    className="bg-panel border border-line hover:border-gold/30 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => setSelectedProfileUser(punter.username)}
                        className="flex items-center gap-3 min-w-0 text-left group"
                      >
                        <Avatar name={punter.username} seed={punter.username.length} size={42} />
                        <div className="min-w-0">
                          <h3 className="font-display font-bold text-sm text-cream group-hover:text-gold transition-colors truncate">
                            {punter.username}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <StarRating rating={punter.stars} size={12} />
                            <span className="text-[11px] text-cream-dim">{punter.accuracyPct}% acc</span>
                          </div>
                        </div>
                      </button>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-xs text-cream">{followersCount}</span>
                        <p className="text-[10px] text-cream-dim uppercase">Followers</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-line/60">
                      {!isSelf ? (
                        <button
                          onClick={() => handleFollowToggle(punter.username)}
                          className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                            following
                              ? 'bg-ink border border-gold/40 text-gold hover:bg-gold/10'
                              : 'bg-gold hover:bg-gold-2 text-ink shadow-sm'
                          }`}
                        >
                          {following ? <UserCheck size={13} /> : <UserPlus size={13} />}
                          {following ? 'Following' : 'Follow'}
                        </button>
                      ) : (
                        <span className="flex-1 py-1.5 text-center text-xs font-semibold text-gold bg-gold/10 rounded-xl">
                          You
                        </span>
                      )}

                      <button
                        onClick={() => setSelectedProfileUser(punter.username)}
                        className="py-1.5 px-3 rounded-xl bg-ink-2 hover:bg-panel-2 border border-line text-cream-dim hover:text-cream text-xs font-semibold transition-colors"
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
