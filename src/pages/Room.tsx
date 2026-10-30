import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import { Users, Clock, Trophy, ChevronDown, CheckCircle2, XCircle, RadioTower, Sparkles, Crown, Medal, AlertTriangle } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { scrollIntoViewIfNeeded } from '../lib/viewportScroll';
import { getJackpot, subscribeToJackpots, getJackpotsSnapshot } from '../lib/mockData';
import { Conviction, GamblerPick, Outcome } from '../lib/types';
import { getBookieTheme } from '../lib/bookies';
import { useWallet } from '../lib/store';
import { useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';
import { useUserPicks } from '../lib/userPicksStore';
import PayGate from '../components/PayGate';
import OutcomeBar from '../components/OutcomeBar';
import DiscussionPanel from '../components/DiscussionPanel';
import GameweekLeaderboard from '../components/GameweekLeaderboard';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import { getPunterStats, getStarRating } from '../lib/punterRatings';
import BackNavButton from '../components/BackNavButton';
import { RoomDetailSkeleton } from '../components/skeleton';

const CONVICTIONS: Conviction[] = ['Banker', 'Value Pick', 'Long Shot'];

export default function Room() {
  const { id } = useParams();
  const activeJackpots = useSyncExternalStore(subscribeToJackpots, getJackpotsSnapshot, getJackpotsSnapshot);
  const jackpot = id ? activeJackpots.find((j) => j.id === id) || getJackpot(id) : undefined;
  const unlocked = useWallet((s) => (jackpot ? s.isRoomUnlocked(jackpot.id) : false));
  const currentUser = useCurrentUser();
  const openAuthWall = useAuthWallStore((s) => s.openAuthWall);
  const username = currentUser?.username || 'Guest Punter';

  const { savePick, getPick, getExtraLikes } = useUserPicks();

  const [unlockedLocal, setUnlockedLocal] = useState(false);
  const [openMatch, setOpenMatch] = useState<string | null>(null);

  // Form states per match or active match
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>('1');
  const [reasoning, setReasoning] = useState('');
  const [conviction, setConviction] = useState<Conviction>('Banker');
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!jackpot) {
    if (activeJackpots.length === 0) {
      return <RoomDetailSkeleton />;
    }
    return <Navigate to="/" replace />;
  }

  const bookieTheme = getBookieTheme(jackpot.bookie);
  const isUnlocked = unlocked || unlockedLocal;

  const location = useLocation();
  const paygateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUnlocked) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile || location.hash === '#unlock') {
        const timer = setTimeout(() => {
          paygateRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [isUnlocked, location.hash]);

  // Slip progress calculations
  const totalMatches = jackpot.matches.length;
  const pickedMatches = jackpot.matches.filter((m) => !!getPick(jackpot.id, m.id));
  const pickedCount = pickedMatches.length;
  const progressPct = Math.round((pickedCount / totalMatches) * 100);

  const startEdit = (matchId: string) => {
    if (!currentUser) {
      openAuthWall({
        actionType: 'jackpot',
        title: 'Sign In to Post Picks',
        message: 'Sign up or log in to submit your 17-leg predictions and compete on the leaderboard.',
      });
      return;
    }

    const existing = getPick(jackpot.id, matchId);
    if (existing) {
      if (existing.editCount >= 2) {
        setFormError('You have reached the maximum limit of 2 edits for this pick.');
        return;
      }
      setSelectedOutcome(existing.pick);
      setReasoning(existing.reasoning);
      setConviction(existing.conviction || 'Banker');
    } else {
      setSelectedOutcome('1');
      setReasoning('');
      setConviction('Banker');
    }
    setFormError(null);
    setEditingMatchId(matchId);
    setOpenMatch(matchId);
  };

  const handlePostPick = (matchId: string) => {
    if (!currentUser) {
      openAuthWall({
        actionType: 'jackpot',
        title: 'Sign In to Post Picks',
        message: 'Sign up or log in to submit your predictions and compete for the leaderboard crown.',
      });
      return;
    }

    if (!reasoning.trim()) {
      setFormError('Please provide your reasoning for this pick.');
      return;
    }

    const res = savePick(jackpot.id, matchId, selectedOutcome, reasoning.trim(), conviction);
    if (!res.ok) {
      setFormError(res.error || 'Could not save pick');
      return;
    }

    setEditingMatchId(null);
    setReasoning('');
    setFormError(null);
    setToastMessage(`Pick posted for match! (${2 - ((getPick(jackpot.id, matchId)?.editCount || 0))} edits remaining)`);
    setTimeout(() => setToastMessage(null), 3000);

    // Auto-collapse current match & move to next unpicked match if available
    const nextUnpicked = jackpot.matches.find((m) => !getPick(jackpot.id, m.id) && m.id !== matchId);
    if (nextUnpicked) {
      setOpenMatch(nextUnpicked.id);
      const nextExisting = getPick(jackpot.id, nextUnpicked.id);
      setSelectedOutcome(nextExisting?.pick || '1');
      setReasoning(nextExisting?.reasoning || '');
      setConviction(nextExisting?.conviction || 'Banker');
    } else {
      setOpenMatch(null); // All collapse to give clear view of completed slip!
    }
  };

  void CONVICTIONS;
  void editingMatchId;
  void formError;
  void startEdit;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10">
      <SeoHead
        title={`${jackpot.name} (${jackpot.bookie}) Consensus Room`}
        description={`Join ${jackpot.participants} punters analyzing ${jackpot.name} (${jackpot.gameweek}). View leg-by-leg consensus, crowd predictions & expert analysis on MshindiRoom.`}
        canonicalUrl={`https://mshindi.co.ke/room/${jackpot.id}`}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "DiscussionForumPosting",
          "headline": `${jackpot.name} Consensus Room`,
          "text": `Consensus and discussion room for ${jackpot.name} (${jackpot.bookie} ${jackpot.gameweek}) featuring ${jackpot.matches.length} legs.`,
          "author": {
            "@type": "Organization",
            "name": "MshindiRoom Community"
          },
          "publisher": {
            "@type": "Organization",
            "name": "MshindiRoom"
          }
        }}
      />
      <div className="mb-4 sm:mb-6">
        <BackNavButton fallbackUrl="/" label="All Jackpot Rooms" />
      </div>

      {/* Header */}
      <div
        className="jackpot-room-card border rounded-2xl p-4 sm:p-8 mb-4 sm:mb-8 shadow-xs relative"
        style={{
          background: `linear-gradient(180deg, ${bookieTheme.fadedBg} 0%, #ffffff 65%)`,
          borderColor: bookieTheme.border,
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={bookieTheme.logo}
              alt={jackpot.bookie}
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-lg shrink-0 select-none"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wide">{jackpot.gameweek}</p>
              <h1 className="font-display font-bold text-xl sm:text-4xl text-slate-900 uppercase tracking-tight truncate">{jackpot.name}</h1>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end shrink-0">
            <p className="text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wide font-bold">Bookie Jackpot</p>
            <p className="font-display font-bold text-[#8A6500] text-2xl sm:text-3xl">{jackpot.prizePool}</p>
          </div>
        </div>

        {jackpot.syncedAt && (
          <span className="inline-flex w-fit items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide mt-3 sm:mt-4">
            <RadioTower size={13} className="text-[#006C54] shrink-0" /> Live synced from {jackpot.bookie}
          </span>
        )}

        <div className="flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-1.5 sm:gap-y-2 mt-4 sm:mt-5 pt-4 sm:pt-5 border-t border-slate-100 text-[11px] sm:text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5"><Users size={14} className="text-[#006C54] shrink-0" /> {jackpot.participants.toLocaleString()} punters in room</span>
          <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400 shrink-0" /> {jackpot.status === 'settled' ? `Settled · ${jackpot.deadline}` : `Deadline ${jackpot.deadline}`}</span>
          <span className="flex items-center gap-1.5"><Trophy size={14} className="text-[#8A6500] shrink-0" /> Closest slip takes #1 Leaderboard Crown (earliest submission breaks ties)</span>
        </div>
      </div>

      {toastMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-sm flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600" /> {toastMessage}
        </div>
      )}

      {/* Slip Progress Header Bar */}
      {isUnlocked && (
        <div className="mb-5 sm:mb-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-3">
            <div>
              <h2 className="font-display font-bold text-base sm:text-lg text-slate-900 uppercase tracking-tight flex items-center gap-2">
                Room Betting Slip Progress
                {pickedCount === totalMatches && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#006C54] uppercase tracking-wide">
                    <Sparkles size={13} /> 100% Complete!
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">
                {pickedCount} of {totalMatches} matches completed ({progressPct}%)
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="tabular-nums text-xs font-bold text-slate-800 tracking-wide">
                {pickedCount} / {totalMatches} Legs
              </span>
            </div>
          </div>

          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-[#006C54] transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {jackpot.status === 'settled' && jackpot.leaderboard && (
        <div className="mb-5 sm:mb-8 bg-panel border border-emerald/40 rounded-2xl p-3.5 sm:p-6 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-gold/10 rounded-full blur-2xl pointer-events-none" />
          <h2 className="font-display font-bold text-lg sm:text-xl text-cream flex items-center gap-2 mb-1">
            <Trophy className="text-gold shrink-0" size={18} /> Closest Gambler: Gameweek Winner
          </h2>
          <p className="text-cream-dim text-xs sm:text-sm mb-4">This gameweek has settled. Here's who came closest to the exact winning slip (equal scores tied by earliest slip submission time):</p>
          <div className="flex flex-col gap-2">
            {jackpot.leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border ${
                  entry.isClosest ? 'bg-gold/10 border-gold/40' : 'bg-ink-2 border-line'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <span className={`font-display font-bold text-xs sm:text-sm tabular-nums w-3.5 sm:w-4 text-center shrink-0 ${entry.isClosest ? 'text-gold' : 'text-cream-dim'}`}>
                    {entry.rank}
                  </span>
                  <div className="shrink-0">
                    <Avatar name={entry.username} seed={entry.colorSeed} size={30} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold text-cream flex items-center gap-1 truncate">
                      <span className="truncate">{entry.username}</span>
                      {entry.isClosest && <Trophy size={12} className="text-gold shrink-0" />}
                    </p>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="text-[11px] sm:text-xs text-cream-dim whitespace-nowrap font-medium">
                        {entry.correct}/{entry.totalMatches} correct legs
                      </span>
                      <StarRating rating={getPunterStats(entry.username).stars} size={10} showNumber={false} className="shrink-0" />
                    </div>
                  </div>
                </div>
                {entry.rank === 1 ? (
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-bold text-gold shrink-0 whitespace-nowrap">
                    <Crown size={14} className="text-gold shrink-0" />
                    <span>1 Crown</span>
                  </span>
                ) : entry.rank === 2 ? (
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-bold text-slate-400 shrink-0 whitespace-nowrap">
                    <Medal size={14} className="text-slate-400 shrink-0" />
                    <span>2 Runner-up</span>
                  </span>
                ) : entry.rank === 3 ? (
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-bold text-amber-700 shrink-0 whitespace-nowrap">
                    <Medal size={14} className="text-amber-700 shrink-0" />
                    <span>3 Podium</span>
                  </span>
                ) : (
                  <span className={`text-xs sm:text-sm font-bold shrink-0 whitespace-nowrap ${entry.prizeWon !== ' - ' ? 'text-emerald-2' : 'text-cream-dim'}`}>
                    {entry.prizeWon}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!isUnlocked ? (
        <div ref={paygateRef} id="unlock" className="scroll-mt-4">
          <PayGate
            jackpot={jackpot}
            onUnlocked={() => {
              setUnlockedLocal(true);
              setOpenMatch(null);
            }}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Standalone Gameweek Leaderboard Section */}
          <section aria-label="Gameweek Leaderboard">
            <GameweekLeaderboard jackpot={jackpot} totalUserPicksCount={pickedCount} />
          </section>

          {/* Jackpot Match Legs Section */}
          <section aria-label="Jackpot Matches" className="flex flex-col gap-4">
            {jackpot.matches.map((match, idx) => {
            const consensus = jackpot.consensus[match.id];
            const open = openMatch === match.id;
            const myPickRecord = getPick(jackpot.id, match.id);

            // Outcome badge styling
            const outcomeColor = myPickRecord?.pick === '1' ? '#006C54' : myPickRecord?.pick === 'X' ? '#8A6500' : '#e41e3f';

            // Gather and rank all discussion picks by (likes + extraLikes) * 10 + starRating * 5
            const allPicks: GamblerPick[] = [...(consensus?.picks || [])];
            if (myPickRecord && !allPicks.some((p) => p.username === username)) {
              allPicks.push({
                id: `user-pick-${jackpot.id}-${match.id}`,
                username,
                pick: myPickRecord.pick,
                reasoning: myPickRecord.reasoning,
                conviction: myPickRecord.conviction,
                likes: 0,
                timeAgo: myPickRecord.updatedAt,
                colorSeed: username.length * 7,
              });
            }

            const sortedPicks = [...allPicks].sort((a, b) => {
              const likesA = a.likes + getExtraLikes(a.id);
              const likesB = b.likes + getExtraLikes(b.id);
              const starsA = getStarRating(a.username);
              const starsB = getStarRating(b.username);
              const scoreA = likesA * 10 + starsA * 5;
              const scoreB = likesB * 10 + starsB * 5;
              return scoreB - scoreA;
            });
            void sortedPicks;

            return (
              <RoomMatchCard
                key={match.id}
                match={match}
                idx={idx}
                jackpot={jackpot}
                open={open}
                onToggleOpen={() => setOpenMatch(open ? null : match.id)}
                myPickRecord={myPickRecord}
                consensus={consensus}
                outcomeColor={outcomeColor}
                username={username}
                getExtraLikes={getExtraLikes}
                selectedOutcome={selectedOutcome}
                setSelectedOutcome={setSelectedOutcome}
                reasoning={reasoning}
                setReasoning={setReasoning}
                conviction={conviction}
                setConviction={setConviction}
                setEditingMatchId={setEditingMatchId}
                handlePostPick={handlePostPick}
                savePick={savePick}
              />
            );
          })}
          </section>
        </div>
      )}
    </div>
  );
}

function RoomMatchCard({
  match,
  idx,
  jackpot,
  open,
  onToggleOpen,
  myPickRecord,
  consensus,
  outcomeColor,
  username,
  getExtraLikes,
  selectedOutcome,
  setSelectedOutcome,
  reasoning,
  setReasoning,
  conviction,
  setConviction,
  setEditingMatchId,
  handlePostPick,
  savePick,
}: {
  match: any;
  idx: number;
  jackpot: any;
  open: boolean;
  onToggleOpen: () => void;
  myPickRecord: any;
  consensus: any;
  outcomeColor: string;
  username: string;
  getExtraLikes: (id: string) => number;
  selectedOutcome: Outcome;
  setSelectedOutcome: (o: Outcome) => void;
  reasoning: string;
  setReasoning: (r: string) => void;
  conviction: Conviction;
  setConviction: (c: Conviction) => void;
  setEditingMatchId: (id: string | null) => void;
  handlePostPick: (matchId: string) => void;
  savePick: any;
}) {
  void getExtraLikes;
  void setConviction;

  const containerRef = useRef<HTMLDivElement>(null);

  // Viewport-aware scroll: bring active match leg into view smoothly
  useEffect(() => {
    if (open && containerRef.current) {
      scrollIntoViewIfNeeded(containerRef.current);
    }
  }, [open]);

  const allPicks: GamblerPick[] = [...(consensus?.picks || [])];
  if (myPickRecord && !allPicks.some((p) => p.username === username)) {
    allPicks.push({
      id: `user-pick-${jackpot.id}-${match.id}`,
      username,
      pick: myPickRecord.pick,
      reasoning: myPickRecord.reasoning,
      conviction: myPickRecord.conviction,
      likes: 0,
      timeAgo: myPickRecord.updatedAt,
      colorSeed: username.length * 7,
    });
  }

  return (
    <div
      ref={containerRef}
      className={`bg-panel border rounded-2xl overflow-hidden transition-all ${
        myPickRecord ? 'border-gold/40 shadow-sm' : 'border-line'
      }`}
    >
      <button
        onClick={() => {
          if (!open) {
            setEditingMatchId(null);
            if (myPickRecord) {
              setSelectedOutcome(myPickRecord.pick);
              setReasoning(myPickRecord.reasoning);
              setConviction(myPickRecord.conviction);
            } else {
              setSelectedOutcome('1');
              setReasoning('');
              setConviction('Banker');
            }
          }
          onToggleOpen();
        }}
        className={`w-full flex items-center justify-between gap-2.5 sm:gap-3 p-3.5 sm:p-5 text-left transition-colors ${
          myPickRecord ? 'bg-gold/5 hover:bg-gold/10' : 'hover:bg-panel-2/50'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <span className={`tabular-nums text-xs font-bold rounded-md px-2 py-1 shrink-0 ${
            myPickRecord ? 'bg-gold text-ink' : 'text-cream-dim bg-ink-2'
          }`}>
            {idx + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-cream text-xs sm:text-base truncate flex items-center gap-1.5 sm:gap-2">
              {match.homeLogo && <img src={match.homeLogo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-4 h-4 object-contain inline shrink-0" />}
              <span>{match.home}</span>
              <span className="text-cream-dim text-xs">vs</span>
              {match.awayLogo && <img src={match.awayLogo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-4 h-4 object-contain inline shrink-0" />}
              <span>{match.away}</span>
              {match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null && (
                <span className="ml-1 px-2 py-0.5 rounded bg-emerald-2/20 text-emerald-2 text-xs tabular-nums font-bold">
                  {match.homeScore} - {match.awayScore}
                </span>
              )}
            </div>
            <p className="text-xs text-cream-dim flex items-center gap-2 mt-0.5">
              <span>{match.competition} · {match.kickoff}</span>
              {match.status === 'in' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-2 bg-emerald-2/10 px-1.5 py-0.5 rounded animate-pulse">
                  LIVE {match.displayClock}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Highlighted Pick Badge */}
          {myPickRecord ? (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-bold animate-rise"
              style={{ color: outcomeColor }}
            >
              <CheckCircle2 size={13} />
              MY PICK: {myPickRecord.pick}
            </span>
          ) : (
            consensus && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-line text-cream-dim bg-ink-2">
                Consensus: {consensus.homePct}% / {consensus.drawPct}% / {consensus.awayPct}%
              </span>
            )
          )}

          {match.nonResultStatus ? (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-md">
              <AlertTriangle size={12} /> {match.nonResultStatus}
            </span>
          ) : match.result ? (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-2 bg-emerald-2/10 border border-emerald-2/30 px-2 py-1 rounded-md">
              <CheckCircle2 size={12} /> FT: {match.result}
            </span>
          ) : null}

          <ChevronDown size={18} className={`text-cream-dim transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-5 flex flex-col gap-5 animate-rise border-t border-line/40 pt-4">
          <OutcomeBar
            consensus={consensus}
            homeOdds={match.homeOdds}
            drawOdds={match.drawOdds}
            awayOdds={match.awayOdds}
            bookmaker={match.bookmaker || `${jackpot.bookie} Official Odds`}
          />

          <DiscussionPanel
            picks={allPicks}
            matchId={match.id}
            myPick={selectedOutcome}
            onPickChange={(o) => setSelectedOutcome(o)}
            myReason={reasoning}
            onReasonChange={(v) => setReasoning(v)}
            onSubmit={() => handlePostPick(match.id)}
            submitted={!!myPickRecord}
            label="Gamblers' Discussion"
            onEditPick={(_id, pick, r) => savePick(jackpot.id, match.id, pick, r, conviction)}
          />

          {jackpot.status === 'settled' && match.result && (
            <div className="flex items-center gap-2 text-xs font-semibold pt-2 border-t border-line">
              {consensus?.picks[0]?.pick === match.result ? (
                <span className="flex items-center gap-1.5 text-emerald-2"><CheckCircle2 size={14} /> Crowd nailed this leg</span>
              ) : (
                <span className="flex items-center gap-1.5 text-danger"><XCircle size={14} /> Crowd missed this leg: final result was {match.result}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
