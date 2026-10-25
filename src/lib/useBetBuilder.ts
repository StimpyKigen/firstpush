import { useState, useMemo, useSyncExternalStore } from 'react';
import { getCombinedBuilderFixtures, type BuilderFixture } from './builderFixtures';
import { subscribeToFreeMatches, getFreeMatchesSnapshot } from './freeMatches';
import { useBetSlipStore } from './betSlipStore';
import { useCurrentUser } from './authStore';
import { useAuthWallStore } from './authWallStore';
import { showToast } from './notificationStore';
import { moderateText } from './contentModeration';

/** Fixture filtering, parlay-cart math, and publish flow for the custom Bet Builder. */
export function useBetBuilder(onPublished?: () => void) {
  const currentUser = useCurrentUser();
  const addPost = useBetSlipStore((s) => s.addPost);
  const cartLegs = useBetSlipStore((s) => s.builderLegs);
  const toggleBuilderLeg = useBetSlipStore((s) => s.toggleBuilderLeg);
  const removeBuilderLeg = useBetSlipStore((s) => s.removeBuilderLeg);
  const clearBuilderLegs = useBetSlipStore((s) => s.clearBuilderLegs);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState('All Leagues');
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

  // Derive available leagues dynamically from actual live fixtures
  const availableLeagues = useMemo(() => {
    const set = new Set<string>();
    fixtures.forEach((f) => {
      if (f.competition) set.add(f.competition);
    });
    return ['All Leagues', ...Array.from(set).sort()];
  }, [fixtures]);

  // Filter fixtures
  const filteredFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      const matchesLeague =
        selectedLeague === 'All Leagues' ||
        f.competition.toLowerCase() === selectedLeague.toLowerCase() ||
        f.competition.toLowerCase().includes(selectedLeague.toLowerCase()) ||
        selectedLeague.toLowerCase().includes(f.competition.toLowerCase());
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || f.homeTeam.toLowerCase().includes(q) || f.awayTeam.toLowerCase().includes(q) || f.competition.toLowerCase().includes(q);
      return matchesLeague && matchesSearch;
    });
  }, [fixtures, selectedLeague, searchQuery]);

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
    searchQuery,
    setSearchQuery,
    selectedLeague,
    setSelectedLeague,
    availableLeagues,
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
