import { useState, useSyncExternalStore } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Users, Clock, MessageSquarePlus, Trophy, ChevronDown, CheckCircle2, XCircle, RadioTower, Sparkles, Edit3, ListChecks } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { getJackpot, subscribeToJackpots, getJackpotsSnapshot } from '../lib/mockData';
import { BOOKIE_THEME, Conviction, GamblerPick, Outcome } from '../lib/types';
import { useWallet } from '../lib/store';
import { useAuth, useCurrentUser } from '../lib/authStore';
import { useUserPicks } from '../lib/userPicksStore';
import PayGate from '../components/PayGate';
import RoomAccessGate from '../components/adSystem/RoomAccessGate';
import OutcomeBar from '../components/OutcomeBar';
import PickCard from '../components/PickCard';
import DiscussionPanel from '../components/DiscussionPanel';
import GameweekLeaderboard from '../components/GameweekLeaderboard';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import { getPunterStats, getStarRating } from '../lib/punterRatings';
import { useAutoCollapse } from '../lib/useAutoCollapse';

const CONVICTIONS: Conviction[] = ['Banker', 'Value Pick', 'Long Shot'];

export default function Room() {
  const { id } = useParams();
  const activeJackpots = useSyncExternalStore(subscribeToJackpots, getJackpotsSnapshot, getJackpotsSnapshot);
  const jackpot = id ? activeJackpots.find((j) => j.id === id) || getJackpot(id) : undefined;
  const unlocked = useWallet((s) => (jackpot ? s.isRoomUnlocked(jackpot.id) : false));
  const currentUser = useCurrentUser();
  const username = currentUser?.username || 'Guest Punter';

  const { savePick, getPick, getExtraLikes } = useUserPicks();

  const [unlockedLocal, setUnlockedLocal] = useState(false);
  const [openMatch, setOpenMatch] = useState<string | null>(jackpot?.matches[0]?.id ?? null);

  // Form states per match or active match
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>('1');
  const [reasoning, setReasoning] = useState('');
  const [conviction, setConviction] = useState<Conviction>('Banker');
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!jackpot) return <Navigate to="/" replace />;

  const theme = BOOKIE_THEME[jackpot.bookie];
  const isUnlocked = unlocked || unlockedLocal;

  // Slip progress calculations
  const totalMatches = jackpot.matches.length;
  const pickedMatches = jackpot.matches.filter((m) => !!getPick(jackpot.id, m.id));
  const pickedCount = pickedMatches.length;
  const progressPct = Math.round((pickedCount / totalMatches) * 100);

  const startEdit = (matchId: string) => {
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
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
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-cream-dim hover:text-cream mb-6">
        <ArrowLeft size={15} /> All rooms
      </Link>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mb-8 shadow-xs relative">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-sm shrink-0"
              style={{ background: theme.bg, color: theme.text }}
            >
              {jackpot.bookie.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{jackpot.bookie} · {jackpot.gameweek}</p>
              <h1 className="font-display font-black text-2xl sm:text-4xl text-slate-900 uppercase tracking-tight">{jackpot.name}</h1>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-black">Bookie Jackpot</p>
            <p className="font-display font-black text-[#d81e1e] text-3xl">{jackpot.prizePool}</p>
          </div>
        </div>

        {jackpot.syncedAt && (
          <span className="inline-flex w-fit items-center gap-1.5 text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full mt-4">
            <RadioTower size={12} className="animate-pulse text-[#d81e1e]" /> Live synced from {jackpot.bookie}
          </span>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-5 border-t border-slate-100 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5"><Users size={14} className="text-[#d81e1e]" /> {jackpot.participants.toLocaleString()} punters in room</span>
          <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> {jackpot.status === 'settled' ? `Settled · ${jackpot.deadline}` : `Deadline ${jackpot.deadline}`}</span>
          <span className="flex items-center gap-1.5"><Trophy size={14} className="text-amber-500" /> Closest slip takes #1 Leaderboard Crown (earliest submission breaks ties)</span>
        </div>
      </div>

      {toastMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-sm flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600" /> {toastMessage}
        </div>
      )}

      {/* Slip Progress Header Bar */}
      {isUnlocked && (
        <div className="mb-8 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#d81e1e]/10 text-[#d81e1e] flex items-center justify-center shrink-0">
                <ListChecks size={18} />
              </div>
              <div>
                <h2 className="font-display font-black text-base sm:text-lg text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  Room Betting Slip Progress
                  {pickedCount === totalMatches && (
                    <span className="inline-flex items-center gap-1 text-xs font-black text-white bg-[#d81e1e] px-2.5 py-0.5 rounded-full">
                      <Sparkles size={12} /> 100% Complete!
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500">
                  {pickedCount} of {totalMatches} matches completed ({progressPct}%)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="font-mono text-xs font-black px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-900">
                {pickedCount} / {totalMatches} Legs
              </span>
            </div>
          </div>

          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="h-full bg-[#d81e1e] transition-all duration-500 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {jackpot.status === 'settled' && jackpot.leaderboard && (
        <div className="mb-8 bg-panel border border-emerald/40 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-gold/10 rounded-full blur-2xl" />
          <h2 className="font-display font-bold text-xl text-cream flex items-center gap-2 mb-1">
            <Trophy className="text-gold" size={20} /> Closest Gambler: Gameweek Winner
          </h2>
          <p className="text-cream-dim text-sm mb-5">This gameweek has settled. Here's who came closest to the exact winning slip (equal scores tied by earliest slip submission time):</p>
          <div className="flex flex-col gap-2">
            {jackpot.leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${
                  entry.isClosest ? 'bg-gold/10 border-gold/40' : 'bg-ink-2 border-line'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full font-display font-bold text-xs ${entry.isClosest ? 'bg-gold text-ink' : 'bg-panel-2 text-cream-dim'}`}>
                    {entry.rank}
                  </span>
                  <Avatar name={entry.username} seed={entry.colorSeed} size={34} />
                  <div>
                    <p className="text-sm font-semibold text-cream flex items-center gap-1.5">
                      {entry.username} {entry.isClosest && <Trophy size={13} className="text-gold" />}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-cream-dim">{entry.correct}/{entry.totalMatches} correct legs</p>
                      <StarRating rating={getPunterStats(entry.username).stars} size={11} showNumber={false} />
                    </div>
                  </div>
                </div>
                <span className={`text-sm font-bold ${entry.prizeWon !== ' - ' ? 'text-emerald-2' : 'text-cream-dim'}`}>{entry.prizeWon}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <RoomAccessGate jackpot={jackpot} onUnlocked={() => setUnlockedLocal(true)}>
        <div className="flex flex-col gap-4">
          {/* Gameweek Leaderboard & Shared Picks Prior to Closure Panel */}
          <GameweekLeaderboard jackpot={jackpot} totalUserPicksCount={pickedCount} />

          {jackpot.matches.map((match, idx) => {
            const consensus = jackpot.consensus[match.id];
            const open = openMatch === match.id;
            const myPickRecord = getPick(jackpot.id, match.id);

            // Outcome badge styling
            const outcomeColor = myPickRecord?.pick === '1' ? '#1fae6f' : myPickRecord?.pick === 'X' ? '#f2b705' : '#ef5b5b';

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
        </div>
      </RoomAccessGate>
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
  // Auto-collapse on scroll outside (>75px) or click outside
  const containerRef = useAutoCollapse<HTMLDivElement>(open, () => {
    onToggleOpen();
  }, 75);

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
        className={`w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left transition-colors ${
          myPickRecord ? 'bg-gold/5 hover:bg-gold/10' : 'hover:bg-panel-2/50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`font-mono text-xs font-bold rounded-md px-2 py-1 shrink-0 ${
            myPickRecord ? 'bg-gold text-ink' : 'text-cream-dim bg-ink-2'
          }`}>
            #{idx + 1}
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-cream truncate flex items-center gap-2">
              {match.homeLogo && <img src={match.homeLogo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-4 h-4 object-contain inline shrink-0" />}
              <span>{match.home}</span>
              <span className="text-cream-dim text-xs">vs</span>
              {match.awayLogo && <img src={match.awayLogo} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="w-4 h-4 object-contain inline shrink-0" />}
              <span>{match.away}</span>
              {match.homeScore !== undefined && match.homeScore !== null && match.awayScore !== undefined && match.awayScore !== null && (
                <span className="ml-1 px-2 py-0.5 rounded bg-emerald-2/20 text-emerald-2 text-xs font-mono font-bold">
                  {match.homeScore} - {match.awayScore}
                </span>
              )}
            </div>
            <p className="text-xs text-cream-dim flex items-center gap-2 mt-0.5">
              <span>{match.competition} · {match.kickoff}</span>
              {match.status === 'in' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-2 bg-emerald-2/10 px-1.5 py-0.5 rounded animate-pulse">
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
              className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-xl shadow-sm animate-rise"
              style={{
                backgroundColor: `${outcomeColor}22`,
                color: outcomeColor,
                border: `1px solid ${outcomeColor}66`,
              }}
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

          {match.result && (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-2 bg-emerald-2/10 border border-emerald-2/30 px-2 py-1 rounded-md">
              <CheckCircle2 size={12} /> FT: {match.result}
            </span>
          )}

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
            onEditPick={(id, pick, r) => savePick(jackpot.id, match.id, pick, r, conviction)}
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

