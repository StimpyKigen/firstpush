import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Star,
  Shuffle,
  Lock,
  Unlock,
  Check,
  Trophy,
  Shield,
  Bot,
  User,
  Gamepad2,
  Gem,
  Sun,
  Sparkles,
  Zap,
  Info,
  X,
  Upload,
  ChevronDown,
} from 'lucide-react';
import {
  AVATAR_CATEGORIES,
  AvatarCategory,
  AvatarOption,
  UnlockTier,
  UNLOCK_TIER_CONFIG,
} from '../lib/avatarCatalog';
import { avatarStore, useAvatarStore, isAvatarUnlocked, UserStatsContext } from '../lib/avatarStore';
import { useAuth, isAdminUser, useCurrentUser } from '../lib/authStore';
import Modal from './ui/Modal';

interface AvatarPickerProps {
  selected?: string | null;
  onSelect: (id: string) => void;
  userStats?: UserStatsContext;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  all: <Sparkles size={14} />,
  favorites: <Star size={14} className="fill-amber-400 text-amber-400" />,
  champions: <Trophy size={14} />,
  football: <Zap size={14} />,
  animals: <Zap size={14} />,
  fantasy: <Shield size={14} />,
  futuristic: <Bot size={14} />,
  human: <User size={14} />,
  gaming: <Gamepad2 size={14} />,
  luxury: <Gem size={14} />,
  african: <Sun size={14} />,
  abstract: <Sparkles size={14} />,
};

export default function AvatarPicker({ selected, onSelect, userStats }: AvatarPickerProps) {
  const currentUser = useCurrentUser();
  const isAdmin = isAdminUser(currentUser);
  const storeState = useAvatarStore();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeTier, setActiveTier] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showUnlockedOnly, setShowUnlockedOnly] = useState<boolean>(true);
  const [displayedCount, setDisplayedCount] = useState<number>(24);
  const [lockedModalItem, setLockedModalItem] = useState<AvatarOption | null>(null);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);

  // Admin Upload Form State
  const [adminLabel, setAdminLabel] = useState<string>('');
  const [adminCategory, setAdminCategory] = useState<AvatarCategory>('champions');
  const [adminTier, setAdminTier] = useState<UnlockTier>('starter');
  const [adminSvg, setAdminSvg] = useState<string>('');

  const gridObserverRef = useRef<HTMLDivElement | null>(null);

  // Resolved user progression stats
  const stats: UserStatsContext = useMemo(
    () =>
      userStats || {
        jackpotsPlayed: 12, // Default friendly progression for active user
        ratingStars: 4.2,
        jackpotWins: 3,
        isVip: false,
      },
    [userStats]
  );

  const allActiveAvatars = useMemo(() => avatarStore.getAllActiveAvatars(), [storeState]);

  // Unlocked & locked count statistics
  const unlockedAvatarsCount = useMemo(() => {
    return allActiveAvatars.filter((a) => isAvatarUnlocked(a, stats) || a.id === selected).length;
  }, [allActiveAvatars, stats, selected]);

  // Dynamic counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allActiveAvatars.forEach((a) => {
      if (!showUnlockedOnly || isAvatarUnlocked(a, stats) || a.id === selected) {
        counts[a.category] = (counts[a.category] || 0) + 1;
      }
    });
    return counts;
  }, [allActiveAvatars, showUnlockedOnly, stats, selected]);

  // Filtered Avatars list
  const filteredAvatars = useMemo(() => {
    let list = allActiveAvatars;

    if (showUnlockedOnly) {
      list = list.filter((a) => isAvatarUnlocked(a, stats) || a.id === selected);
    }

    if (activeCategory === 'favorites') {
      list = list.filter((a) => storeState.favorites.has(a.id));
    } else if (activeCategory !== 'all') {
      list = list.filter((a) => a.category === activeCategory);
    }

    if (activeTier !== 'all') {
      list = list.filter((a) => a.tier === activeTier);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.label.toLowerCase().includes(q) ||
          a.category.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allActiveAvatars, showUnlockedOnly, activeCategory, activeTier, searchQuery, storeState.favorites, stats, selected]);

  // Lazy loading pagination (initial 24 items)
  const visibleAvatars = useMemo(() => {
    return filteredAvatars.slice(0, displayedCount);
  }, [filteredAvatars, displayedCount]);

  const loadMore = useCallback(() => {
    setDisplayedCount((prev) => Math.min(prev + 24, filteredAvatars.length));
  }, [filteredAvatars.length]);

  // Infinite Scroll Trigger
  useEffect(() => {
    const el = gridObserverRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // Random Avatar Selection Handler
  const handlePickRandom = () => {
    const unlockedList = filteredAvatars.filter((a) => isAvatarUnlocked(a, stats));
    const targetPool = unlockedList.length > 0 ? unlockedList : filteredAvatars;
    if (targetPool.length === 0) return;

    const randomChoice = targetPool[Math.floor(Math.random() * targetPool.length)];
    onSelect(randomChoice.id);
  };

  // Toggle Favorite Handler
  const handleToggleFav = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    avatarStore.toggleFavorite(id);
  };

  // Admin Add Custom Avatar Handler
  const handleCreateCustomAvatar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminLabel.trim() || !adminSvg.trim()) return;

    let svgDataUri = adminSvg.trim();
    if (!svgDataUri.startsWith('data:image/svg+xml')) {
      svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(adminSvg.trim())}`;
    }

    avatarStore.addCustomAvatar({
      label: adminLabel.trim(),
      category: adminCategory,
      tier: adminTier,
      unlockRequirement: 'Admin Created Custom Avatar',
      svgContent: svgDataUri,
      tags: ['admin', 'custom', adminCategory],
    });

    setAdminLabel('');
    setAdminSvg('');
    setShowAdminModal(false);
  };

  return (
    <div className="flex flex-col gap-4 w-full bg-ink-2/90 border border-line rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md">
      {/* Top Bar: Search, Favorites count & Random Generator */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-dim" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 160+ avatars (e.g., lion, crown, ninja)..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-panel border border-line text-cream placeholder:text-cream-dim/60 text-xs sm:text-sm focus:outline-none focus:border-gold transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-dim hover:text-cream"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePickRandom}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-gold to-gold-light hover:brightness-110 text-ink font-bold text-xs shadow-md active:scale-95 transition-all"
            title="Pick a random avatar"
          >
            <Shuffle size={14} />
            <span>Random</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAdminModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 font-bold text-xs transition-colors"
              title="Upload Custom Avatar (Admin)"
            >
              <Upload size={14} />
              <span className="hidden md:inline">Admin Upload</span>
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Category Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-1 scrollbar-none select-none">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 shrink-0 transition-all ${
            activeCategory === 'all'
              ? 'bg-gold border-gold text-ink shadow-md shadow-gold/20'
              : 'bg-panel border-line text-cream-dim hover:border-gold/50 hover:text-cream'
          }`}
        >
          {CATEGORY_ICONS['all']}
          <span>All ({showUnlockedOnly ? unlockedAvatarsCount : allActiveAvatars.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('favorites')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 shrink-0 transition-all ${
            activeCategory === 'favorites'
              ? 'bg-gold border-gold text-ink shadow-md shadow-gold/20'
              : 'bg-panel border-line text-cream-dim hover:border-gold/50 hover:text-cream'
          }`}
        >
          {CATEGORY_ICONS['favorites']}
          <span>Favorites ({storeState.favorites.size})</span>
        </button>

        {AVATAR_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          const count = categoryCounts[cat.id] || 0;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 shrink-0 transition-all ${
                isActive
                  ? 'bg-gold border-gold text-ink shadow-md shadow-gold/20'
                  : 'bg-panel border-line text-cream-dim hover:border-gold/50 hover:text-cream'
              }`}
            >
              {CATEGORY_ICONS[cat.id]}
              <span>{cat.label} ({count})</span>
            </button>
          );
        })}
      </div>

      {/* Unlock Progression & View Mode Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-panel/50 border border-line/60 text-xs">
        {/* Toggle Mode: Unlocked Only vs Locked Vault */}
        <div className="flex items-center gap-1 bg-ink border border-line rounded-xl p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowUnlockedOnly(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              showUnlockedOnly
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-sm'
                : 'text-cream-dim hover:text-cream'
            }`}
          >
            <Unlock size={13} />
            <span>Unlocked Only ({unlockedAvatarsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setShowUnlockedOnly(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              !showUnlockedOnly
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-sm'
                : 'text-cream-dim hover:text-cream'
            }`}
          >
            <Lock size={13} />
            <span>Show Locked Vault</span>
          </button>
        </div>

        {/* Tier Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-cream-dim uppercase tracking-wider shrink-0">Tier:</span>
          <select
            value={activeTier}
            onChange={(e) => setActiveTier(e.target.value)}
            className="bg-ink border border-line text-cream text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gold"
          >
            <option value="all">All Tiers</option>
            <option value="starter">Starter (Free)</option>
            <option value="silver">Silver Tier</option>
            <option value="gold">Gold Tier (3★)</option>
            <option value="diamond">Diamond Tier</option>
            <option value="champion">Champion Tier (5★)</option>
            <option value="seasonal">Special Event</option>
            <option value="premium">VIP Exclusive</option>
          </select>
        </div>
      </div>

      {/* Avatar Grid (3 cols mobile, 4 tablet, 6 desktop) */}
      {visibleAvatars.length === 0 ? (
        <div className="min-h-[220px] flex flex-col items-center justify-center p-8 text-center bg-panel/30 border border-dashed border-line rounded-2xl">
          <Sparkles size={32} className="text-cream-dim/40 mb-2" />
          <h4 className="font-display font-bold text-cream text-sm">No avatars match your criteria</h4>
          <p className="text-xs text-cream-dim mt-1 max-w-xs">
            Try resetting your search query or selecting a different category filter above.
          </p>
          <button
            onClick={() => {
              setActiveCategory('all');
              setActiveTier('all');
              setSearchQuery('');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-bold hover:bg-gold/20 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 pt-1">
          {visibleAvatars.map((avatar) => {
            const isSelected = selected === avatar.id;
            const isFav = storeState.favorites.has(avatar.id);
            const unlocked = isAvatarUnlocked(avatar, stats);
            const tierInfo = UNLOCK_TIER_CONFIG[avatar.tier];

            return (
              <div
                key={avatar.id}
                tabIndex={0}
                role="button"
                aria-label={`Select avatar ${avatar.label}, Tier ${tierInfo.label}`}
                onClick={() => {
                  if (unlocked) {
                    onSelect(avatar.id);
                  } else {
                    setLockedModalItem(avatar);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (unlocked) onSelect(avatar.id);
                    else setLockedModalItem(avatar);
                  }
                }}
                className={`group relative flex flex-col items-center gap-2 rounded-2xl p-3 border transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-gold ${
                  isSelected
                    ? 'border-gold bg-gold/15 shadow-[0_0_20px_rgba(245,158,11,0.25)] scale-105 ring-2 ring-emerald-400/80'
                    : unlocked
                    ? 'border-line bg-panel/60 hover:border-gold/60 hover:bg-panel hover:scale-105 hover:shadow-lg'
                    : 'border-line/40 bg-ink-2/40 hover:border-amber-500/40'
                }`}
              >
                {/* Favorite Star Button */}
                <button
                  type="button"
                  onClick={(e) => handleToggleFav(e, avatar.id)}
                  className={`absolute top-2 left-2 z-10 p-1 rounded-full backdrop-blur-md transition-all ${
                    isFav
                      ? 'bg-amber-400 text-ink scale-110 shadow-md'
                      : 'bg-black/40 text-cream-dim/60 hover:text-amber-400 opacity-0 group-hover:opacity-100'
                  }`}
                  title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Star size={11} className={isFav ? 'fill-ink' : ''} />
                </button>

                {/* Lock Status / Selected Checkmark Badge */}
                {isSelected && (
                  <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-emerald-500 text-ink flex items-center justify-center font-bold shadow-md animate-bounce">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}

                {!unlocked && (
                  <div className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-black/80 border border-amber-500/50 text-amber-400 flex items-center justify-center shadow-md">
                    <Lock size={10} />
                  </div>
                )}

                {/* Avatar SVG Canvas */}
                <div
                  className={`w-full aspect-square rounded-full overflow-hidden relative flex items-center justify-center transition-all ${
                    !unlocked ? 'filter blur-[1.5px] opacity-60' : ''
                  }`}
                >
                  <img
                    src={avatar.svgContent}
                    alt={avatar.label}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Avatar Title & Tier Tag */}
                <div className="w-full flex flex-col items-center text-center gap-0.5">
                  <span className="text-[11px] font-bold text-cream truncate w-full group-hover:text-gold transition-colors">
                    {avatar.label}
                  </span>
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider truncate max-w-full ${tierInfo.badgeBg}`}
                  >
                    {tierInfo.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sentinel Element for Infinite Scroll */}
      <div ref={gridObserverRef} className="h-4 w-full flex items-center justify-center">
        {displayedCount < filteredAvatars.length && (
          <button
            onClick={loadMore}
            aria-label="Load more avatars"
            className="px-4 py-1.5 rounded-xl bg-panel border border-line text-xs text-cream-dim hover:text-cream hover:border-gold/50 transition-colors"
          >
            Load More Avatars ({filteredAvatars.length - displayedCount} remaining)
          </button>
        )}
      </div>

      {/* Lock Requirement Modal */}
      {lockedModalItem && (
        <Modal isOpen={true} overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-panel border border-amber-500/40 rounded-2xl p-6 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <Lock size={32} />
            </div>

            <div className="space-y-1">
              <h3 className="font-display font-extrabold text-lg text-cream">{lockedModalItem.label}</h3>
              <p className="text-xs text-cream-dim">This gaming identity is locked in your progression vault.</p>
            </div>

            <div className="p-3.5 rounded-xl bg-ink/60 border border-line text-xs space-y-1.5">
              <span className="font-bold text-gold uppercase tracking-wider block text-[10px]">
                Unlock Requirement
              </span>
              <p className="text-cream font-medium">{lockedModalItem.unlockRequirement}</p>
            </div>

            <button
              onClick={() => setLockedModalItem(null)}
              className="w-full py-2.5 rounded-xl bg-gold text-ink font-bold text-xs hover:bg-gold-light transition-all shadow-md"
            >
              Got It
            </button>
          </div>
        </Modal>
      )}

      {/* Admin Upload Modal */}
      {showAdminModal && (
        <Modal isOpen={true} overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-panel border border-emerald-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-display font-bold text-cream text-base flex items-center gap-2">
                <Upload size={18} className="text-emerald-400" />
                Upload Custom Vector Avatar
              </h3>
              <button onClick={() => setShowAdminModal(false)} className="text-cream-dim hover:text-cream">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomAvatar} className="space-y-3 text-xs">
              <div>
                <label className="block text-cream-dim font-bold mb-1">Avatar Title</label>
                <input
                  type="text"
                  required
                  value={adminLabel}
                  onChange={(e) => setAdminLabel(e.target.value)}
                  placeholder="e.g., Golden Lion Captain"
                  className="w-full px-3 py-2 rounded-xl bg-ink border border-line text-cream focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-cream-dim font-bold mb-1">Category</label>
                  <select
                    value={adminCategory}
                    onChange={(e) => setAdminCategory(e.target.value as AvatarCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-ink border border-line text-cream"
                  >
                    {AVATAR_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-cream-dim font-bold mb-1">Unlock Tier</label>
                  <select
                    value={adminTier}
                    onChange={(e) => setAdminTier(e.target.value as UnlockTier)}
                    className="w-full px-3 py-2 rounded-xl bg-ink border border-line text-cream"
                  >
                    <option value="starter">Starter (Free)</option>
                    <option value="silver">Silver Tier</option>
                    <option value="gold">Gold Tier</option>
                    <option value="diamond">Diamond Tier</option>
                    <option value="champion">Champion Tier</option>
                    <option value="seasonal">Special Event</option>
                    <option value="premium">VIP Exclusive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-cream-dim font-bold mb-1">SVG Code or SVG Data URI</label>
                <textarea
                  required
                  rows={4}
                  value={adminSvg}
                  onChange={(e) => setAdminSvg(e.target.value)}
                  placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">...</svg>'
                  className="w-full px-3 py-2 rounded-xl bg-ink border border-line text-cream font-mono text-[11px] focus:border-emerald-400"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 rounded-xl border border-line text-cream-dim hover:text-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-ink font-bold hover:bg-emerald-400"
                >
                  Publish Avatar
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
