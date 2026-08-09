import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Sparkles, ClipboardPaste, Link2, X, LoaderCircle,
  Send, Hash, TrendingUp, Users, Filter, Search, UserPlus, UserCheck, Share2, Copy, Check, Dices
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SeoHead from '../components/SeoHead';
import { useAuth, useCurrentUser } from '../lib/authStore';
import { useBetSlipStore } from '../lib/betSlipStore';
import { useFollowStore } from '../lib/followStore';
import { searchPunters, getAllPunters, type PunterProfile } from '../lib/punterDirectory';
import { fetchBetSlip, extractCleanUrl } from '../lib/betSlipParser';
import BetSlipCard from '../components/BetSlipCard';
import BetBuilder from '../components/BetBuilder';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import PunterProfileModal from '../components/PunterProfileModal';
import InviteModal from '../components/InviteModal';
import ModerationWarningBox from '../components/ModerationWarningBox';
import { showToast } from '../lib/notificationStore';
import { moderateText } from '../lib/contentModeration';

const TAG_PRESETS = ['Value Pick', 'Long Shot', 'Analysis', 'Over/Under', 'Multibet'];
const BOOKMAKER_OPTIONS = ['22Bet', '1xBet', 'PariPesa', 'SportPesa', 'Betika', 'MozzartBet', 'Shabiki', 'Odibets', 'Betway', 'Other'];

export default function BetSlipRoom() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useCurrentUser();
  const posts = useBetSlipStore((s) => s.posts);
  const addPost = useBetSlipStore((s) => s.addPost);
  const setParsed = useBetSlipStore((s) => s.setParsed);

  const isFollowing = useFollowStore((s) => s.isFollowing);
  const followUser = useFollowStore((s) => s.followUser);
  const unfollowUser = useFollowStore((s) => s.unfollowUser);
  const getFollowersCount = useFollowStore((s) => s.getFollowersCount);

  const [inputUrl, setInputUrl] = useState('');
  const [selectedBookmaker, setSelectedBookmaker] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // User search & navigation states
  const [punterSearchQuery, setPunterSearchQuery] = useState('');
  const [selectedProfileUser, setSelectedProfileUser] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'slips' | 'punters'>('builder');


  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-detect URL vs Code and extract clean URL
  const trimmedInput = inputUrl.trim();
  const extracted = extractCleanUrl(trimmedInput);
  const isUrl = extracted.isUrlMatch;
  const isCode = Boolean(trimmedInput && !isUrl);

  // Moderate note + inputUrl
  const modResult = useMemo(() => moderateText(`${note} ${inputUrl}`), [note, inputUrl]);

  // Auto detect bookmaker from URL string
  useEffect(() => {
    const targetStr = (extracted.cleanUrl || trimmedInput).toLowerCase();
    if (!targetStr) return;
    if (targetStr.includes('22bet')) setSelectedBookmaker('22Bet');
    else if (targetStr.includes('1xbet')) setSelectedBookmaker('1xBet');
    else if (targetStr.includes('paripesa')) setSelectedBookmaker('PariPesa');
    else if (targetStr.includes('betika')) setSelectedBookmaker('Betika');
    else if (targetStr.includes('sportpesa')) setSelectedBookmaker('SportPesa');
    else if (targetStr.includes('mozzart')) setSelectedBookmaker('MozzartBet');
    else if (targetStr.includes('shabiki')) setSelectedBookmaker('Shabiki');
    else if (targetStr.includes('odibets')) setSelectedBookmaker('Odibets');
    else if (targetStr.includes('betway')) setSelectedBookmaker('Betway');
  }, [inputUrl, extracted.cleanUrl, trimmedInput]);

  // Check URL params for ?punter=Username
  useEffect(() => {
    const urlPunter = searchParams.get('punter');
    if (urlPunter) {
      setSelectedProfileUser(urlPunter);
    }
  }, [searchParams]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [note]);

  const filteredPosts = filterTag
    ? posts.filter((p) => p.tags.includes(filterTag))
    : posts;

  const allTags = Array.from(new Set(posts.flatMap((p) => p.tags)));
  const matchingPunters = searchPunters(punterSearchQuery);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setInputUrl(text);
      inputRef.current?.focus();
    } catch {
      showToast({ type: 'warning', title: 'Clipboard access denied', message: 'Please paste the link manually.' });
    }
  }

  async function handlePost() {
    if (!trimmedInput) {
      showToast({ type: 'warning', title: 'Missing link/code', message: 'Paste a bet slip URL or booking code first.' });
      return;
    }
    if (!currentUser) {
      showToast({ type: 'warning', title: 'Sign in required', message: 'Log in to post your bet slip.' });
      return;
    }

    // Automatically extract clean URL and remove words that come before https:
    const { cleanUrl, extractedPrefix, isUrlMatch } = extractCleanUrl(trimmedInput);

    // Prompt for site if non-URL code and no site selected
    if (!isUrlMatch && !selectedBookmaker) {
      showToast({
        type: 'warning',
        title: 'Select Sportsbook Site',
        message: 'Please select which site (e.g. 22Bet, 1xBet, PariPesa) this booking code belongs to.',
      });
      return;
    }

    // If note is empty, preserve any prefix words extracted before https:
    const finalNote = note.trim() || extractedPrefix;

    // Moderation check on note and URL
    const modResult = moderateText(`${finalNote} ${cleanUrl}`);
    if (!modResult.isAllowed) {
      showToast({ type: 'error', title: 'Content Flagged', message: modResult.reason ?? 'Post contains flagged terms prohibited by community guidelines.' });
      return;
    }

    setPosting(true);
    const bookmakerToUse = selectedBookmaker || 'Sportsbook';

    const postId = addPost({
      postedBy: currentUser.username,
      postedByAvatarSeed: currentUser.phone.length,
      url: cleanUrl,
      bookmaker: bookmakerToUse,
      isCode: !isUrlMatch,
      note: finalNote,
      tags: selectedTags,
    });

    // If it's a URL, attempt background parse with clean URL
    if (isUrlMatch) {
      try {
        const parsed = await fetchBetSlip(cleanUrl);
        setParsed(postId, parsed);
      } catch (err) {
        setParsed(postId, null, err instanceof Error ? err.message : 'Could not parse link');
      }
    }

    setInputUrl('');
    setSelectedBookmaker(null);
    setNote('');
    setSelectedTags([]);
    setPosting(false);
    showToast({ type: 'success', title: 'Slip posted!', message: 'Your bet slip is now live in the room.' });
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

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

  const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);

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
          <Link2 size={15} />
          Shared Slips ({posts.length})
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

      {/* TAB 2: BET SLIPS FEED */}
      {activeTab === 'slips' && (

        <div className="space-y-6 animate-fade-in">
          {/* Stats strip */}
          <div className="flex items-center justify-between text-xs text-cream-dim">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Users size={13} className="text-emerald-2" />
                <span className="font-mono font-semibold text-cream">{posts.length}</span> slips shared
              </span>
              <span className="flex items-center gap-1.5">
                <TrendingUp size={13} className="text-gold" />
                <span className="font-mono font-semibold text-cream">{totalLikes}</span> total likes
              </span>
            </div>
          </div>

          {/* Post composer */}
          <div className="bg-panel border border-line rounded-2xl p-4 sm:p-5">
            {!currentUser ? (
              <div className="text-center py-6">
                <p className="text-sm text-cream-dim mb-3">Sign in to share your bet slips with the room.</p>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 bg-gold hover:bg-gold-2 text-ink font-bold text-sm px-5 py-2.5 rounded-full transition-colors"
                >
                  Sign In to Post
                </Link>
              </div>
            ) : (
              <>
                {/* URL or Code input */}
                <div className="relative mb-2">
                  <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim" />
                  <input
                    ref={inputRef}
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handlePost()}
                    placeholder="Paste bet slip URL or booking code (e.g. A8B9C22, 22Bet, 1xBet, Betika)..."
                    className="w-full bg-ink border border-line rounded-xl pl-10 pr-10 py-3 text-sm text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {inputUrl && (
                      <button
                        onClick={() => {
                          setInputUrl('');
                          setSelectedBookmaker(null);
                        }}
                        aria-label="Clear input"
                        className="p-1.5 rounded-lg text-cream-dim hover:text-cream hover:bg-panel transition-colors"
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      onClick={handlePaste}
                      className="p-1.5 rounded-lg text-cream-dim hover:text-gold hover:bg-panel transition-colors"
                      title="Paste from clipboard"
                    >
                      <ClipboardPaste size={14} />
                    </button>
                  </div>
                </div>

                {/* Auto-cleaned URL notice if prefix words were stripped */}
                {extracted.isUrlMatch && extracted.extractedPrefix && (
                  <div className="mb-3 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] text-emerald-300 flex items-center gap-1.5">
                    <Check size={13} className="text-emerald-400 shrink-0" />
                    <span className="truncate">
                      Clean URL isolated: <strong className="font-mono text-gold">{extracted.cleanUrl}</strong>{' '}
                      <span className="text-cream-dim">(Prefix "{extracted.extractedPrefix}" saved as note)</span>
                    </span>
                  </div>
                )}

                {/* Sportsbook site prompt selector for non-URL code or general link */}
                <div className="bg-ink-2 border border-line/60 rounded-xl p-3 mb-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-cream flex items-center gap-1.5">
                      {isCode ? (
                        <span className="text-gold font-extrabold flex items-center gap-1">
                          ⚠️ Booking code detected. Select Site:
                        </span>
                      ) : (
                        <span className="text-cream-dim">Sportsbook Site:</span>
                      )}
                    </span>
                    {selectedBookmaker && (
                      <span className="text-[10px] font-black uppercase text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        Selected: {selectedBookmaker}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {BOOKMAKER_OPTIONS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedBookmaker(b)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          selectedBookmaker === b
                            ? 'bg-gold text-ink border-gold shadow-sm font-extrabold'
                            : 'bg-panel border-line text-cream-dim hover:text-cream hover:border-gold/40'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note textarea */}
                <textarea
                  ref={textareaRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note or analysis about this slip (optional)..."
                  rows={1}
                  className="w-full bg-ink border border-line rounded-xl px-3 py-2.5 text-sm text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold resize-none mb-3"
                />

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {TAG_PRESETS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-gold border-gold text-ink'
                          : 'border-line text-cream-dim hover:border-gold/50 hover:text-cream'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>

                {/* Moderation Warning Box with Red Highlights */}
                <ModerationWarningBox result={modResult} text={`${note} ${inputUrl}`} />

                {/* Post button */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-cream-dim">
                    {isCode
                      ? selectedBookmaker
                        ? `Posting ${selectedBookmaker} Booking Code`
                        : 'Select site above to post code'
                      : inputUrl
                      ? 'Ready to post bet slip link'
                      : 'Paste link or booking code'}
                  </p>
                  <button
                    onClick={handlePost}
                    disabled={!inputUrl.trim() || posting || (isCode && !selectedBookmaker) || !modResult.isAllowed}
                    className="inline-flex items-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-40 disabled:cursor-not-allowed text-ink font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
                  >
                    {posting ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
                    {posting ? 'Posting...' : 'Post Slip'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-cream-dim hover:text-cream mb-2"
              >
                <Filter size={12} /> Filter by tag
              </button>
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setFilterTag(null)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                          !filterTag ? 'bg-emerald-2 border-emerald-2 text-ink' : 'border-line text-cream-dim hover:border-emerald-2/50'
                        }`}
                      >
                        All
                      </button>
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors ${
                            filterTag === tag ? 'bg-gold border-gold text-ink' : 'border-line text-cream-dim hover:border-gold/50'
                          }`}
                        >
                          <Hash size={9} className="inline mr-0.5" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Feed */}
          <div className="flex flex-col gap-4">
            {filteredPosts.length === 0 ? (
              <div className="bg-panel border border-dashed border-line rounded-2xl p-8 sm:p-12 text-center">
                <Link2 size={32} className="mx-auto text-cream-dim/30 mb-3" />
                <p className="text-sm font-semibold text-cream mb-1">
                  {filterTag ? `No slips tagged "${filterTag}"` : 'No slips shared yet'}
                </p>
                <p className="text-xs text-cream-dim max-w-xs mx-auto leading-relaxed">
                  {filterTag
                    ? 'Try a different tag or clear the filter.'
                    : 'Be the first to post a bet slip link! Paste any public betting URL above.'}
                </p>
              </div>
            ) : (
              filteredPosts.map((post, i) => (
                <BetSlipCard
                  key={post.id}
                  post={post}
                  index={i}
                  onOpenProfile={(uname) => setSelectedProfileUser(uname)}
                />
              ))
            )}
          </div>
        </div>
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
