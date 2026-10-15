import { useState, useSyncExternalStore } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Users, Clock, CheckCircle2, RadioTower, Unlock, Dices, Check } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { getFreeMatchesSnapshot, getFreeMatchConsensusSnapshot, subscribeToFreeMatches, TIER_LABEL } from '../lib/freeMatches';
import { GamblerPick, Outcome } from '../lib/types';
import { useAuth, useCurrentUser } from '../lib/authStore';
import { useUserPicks } from '../lib/userPicksStore';
import OutcomeBar from '../components/OutcomeBar';
import DiscussionPanel from '../components/DiscussionPanel';
import { useBetSlipStore } from '../lib/betSlipStore';
import QuickBetBuilderModal from '../components/QuickBetBuilderModal';

const tierColor: Record<string, string> = {
  blockbuster: '#f2b705',
  continental: '#3b82f6',
  derby: '#ef5b5b',
};

export default function FreeMatchRoom() {
  const { id } = useParams();
  const matches = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchesSnapshot, getFreeMatchesSnapshot);
  const consensusMap = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchConsensusSnapshot, getFreeMatchConsensusSnapshot);
  const match = id ? matches.find((item) => item.id === id) : undefined;

  const currentUser = useCurrentUser();
  const username = currentUser?.username || 'Guest Punter';
  const { savePick, getPick } = useUserPicks();

  const roomId = `free-${id}`;
  const myPickRecord = match ? getPick(roomId, match.id) : undefined;

  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>(myPickRecord?.pick || '1');
  const [reasoning, setReasoning] = useState(myPickRecord?.reasoning || '');
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showBuilderModal, setShowBuilderModal] = useState(false);

  const builderLegs = useBetSlipStore((s) => s.builderLegs);

  if (!match) return <Navigate to="/free" replace />;
  const consensus = consensusMap[match.id];

  const outcomeColor = myPickRecord?.pick === '1' ? '#1fae6f' : myPickRecord?.pick === 'X' ? '#f2b705' : '#ef5b5b';

  const startEdit = () => {
    if (myPickRecord) {
      if (myPickRecord.editCount >= 2) {
        setErrorMsg('You have reached the limit of 2 edits for this match pick.');
        return;
      }
      setSelectedOutcome(myPickRecord.pick);
      setReasoning(myPickRecord.reasoning);
    }
    setErrorMsg(null);
    setIsEditing(true);
  };

  const handlePostPick = () => {
    if (!reasoning.trim()) {
      setErrorMsg('Please provide your reasoning for this pick.');
      return;
    }

    const res = savePick(roomId, match.id, selectedOutcome, reasoning.trim(), 'Banker');
    if (!res.ok) {
      setErrorMsg(res.error || 'Could not save pick');
      return;
    }

    setIsEditing(false);
    setErrorMsg(null);
    setToastMsg(`Pick posted! (${2 - ((getPick(roomId, match.id)?.editCount || 0))} edits remaining)`);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Collect picks for discussion panel
  const allPicks: GamblerPick[] = [...(consensus?.picks || [])];
  if (myPickRecord && !allPicks.some((p) => p.username === username)) {
    allPicks.push({
      id: `user-pick-${roomId}-${match.id}`,
      username,
      pick: myPickRecord.pick,
      reasoning: myPickRecord.reasoning,
      conviction: 'Banker',
      likes: 0,
      timeAgo: myPickRecord.updatedAt,
      colorSeed: username.length * 7,
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <SeoHead
        title={`${match.home} vs ${match.away} (${match.competition}) Predictions & Room`}
        description={`Live prediction discussion for ${match.home} vs ${match.away} in ${match.competition}. View crowd consensus split, punter picks & match analysis.`}
        canonicalUrl={`https://mshindi.co.ke/free/${match.id}`}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "SportsEvent",
          "name": `${match.home} vs ${match.away}`,
          "sport": "Football",
          "homeTeam": { "@type": "SportsTeam", "name": match.home },
          "awayTeam": { "@type": "SportsTeam", "name": match.away },
          "startDate": match.kickoffIso || new Date().toISOString(),
          "description": match.blurb || `Free match prediction and consensus discussion room for ${match.home} vs ${match.away}`
        }}
      />
      <Link to="/free" className="inline-flex items-center gap-1.5 text-sm text-cream-dim hover:text-cream mb-6">
        <ArrowLeft size={15} /> All free matches
      </Link>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mb-6 shadow-xs">
        {/* Clean Text Informational Metadata (No Generic Pills) */}
        <div className="flex flex-wrap items-center gap-2.5 mb-3 text-xs font-bold uppercase tracking-wider">
          <span style={{ color: tierColor[match.tier] }} className="font-black">
            {TIER_LABEL[match.tier]}
          </span>
          <span className="text-slate-300 font-normal">·</span>
          <span className="text-slate-600 inline-flex items-center gap-1.5 font-bold">
            <Unlock size={13} className="text-[#d81e1e]" /> Free Match Room · Open Discussion
          </span>
          <span className="text-slate-300 font-normal">·</span>
          <span className="text-slate-400 font-semibold inline-flex items-center gap-1.5">
            <RadioTower size={12} className="animate-pulse text-[#d81e1e]" /> Synced {match.syncedAt}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-black text-2xl sm:text-4xl text-slate-900 leading-tight uppercase tracking-tight">
              {match.home} <span className="text-slate-400 font-normal">v</span> {match.away}
            </h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">{match.competition}</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
            {myPickRecord && (
              <div
                className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-md"
                style={{
                  backgroundColor: `${outcomeColor}18`,
                  color: outcomeColor,
                  border: `1px solid ${outcomeColor}44`,
                }}
              >
                <CheckCircle2 size={14} />
                YOUR PICK: {myPickRecord.pick}
              </div>
            )}

            <button
              onClick={() => setShowBuilderModal(true)}
              className={`h-10 px-4 rounded-md font-extrabold uppercase tracking-wider text-xs transition-all active:scale-[0.98] shadow-2xs flex items-center justify-center gap-2 cursor-pointer ${
                builderLegs.some((l) => l.matchId === match.id)
                  ? 'bg-[#d81e1e] hover:bg-[#b91515] text-white border border-[#b91515]'
                  : 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-900'
              }`}
            >
              {builderLegs.some((l) => l.matchId === match.id) ? (
                <>
                  <Check size={14} className="shrink-0 stroke-[3]" />
                  <span>In Bet Builder ({builderLegs.filter((l) => l.matchId === match.id).length})</span>
                </>
              ) : (
                <>
                  <Dices size={14} className="shrink-0" />
                  <span>Add to Bet Builder</span>
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-2xl">{match.blurb}</p>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-5 border-t border-slate-200 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400" /> {match.kickoff}</span>
          <span className="flex items-center gap-1.5"><Users size={14} className="text-[#d81e1e]" /> {consensus.totalVotes.toLocaleString()} punters discussing</span>
        </div>
      </div>

      {/* Shared Picks Prior to Closure Highlight Banner */}
      <div className="mb-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#d81e1e]/10 text-[#d81e1e] flex items-center justify-center font-bold shrink-0">
            <Users size={20} />
          </div>
          <div>
            <h3 className="font-display font-black text-slate-900 text-sm sm:text-base uppercase tracking-tight">
              Community Picks &amp; Consensus Split
            </h3>
            <p className="text-xs text-slate-500">
              Predictions and reasoning shared by community punters prior to kickoff closure.
            </p>
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 px-4 py-1.5 rounded-xl text-center shrink-0">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Shared Picks</span>
          <span className="font-display font-black text-[#d81e1e] text-base sm:text-lg">
            {consensus.totalVotes.toLocaleString()}
          </span>
        </div>
      </div>

      {toastMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-sm flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600" /> {toastMsg}
        </div>
      )}

      <div className="bg-panel border border-line rounded-2xl p-5 sm:p-6 flex flex-col gap-6">
        <OutcomeBar
          consensus={consensus}
          homeOdds={match.homeOdds}
          drawOdds={match.drawOdds}
          awayOdds={match.awayOdds}
          bookmaker={match.bookmaker}
        />

        {/* Suggestion & Discussion Panel */}
        <DiscussionPanel
          picks={allPicks}
          matchId={match.id}
          myPick={selectedOutcome}
          onPickChange={(o) => setSelectedOutcome(o)}
          myReason={reasoning}
          onReasonChange={(v) => setReasoning(v)}
          onSubmit={handlePostPick}
          submitted={!!myPickRecord}
          label="Fans' Discussion"
          onEditPick={(id, pick, r) => savePick(roomId, match.id, pick, r, 'Banker')}
        />
      </div>

      <QuickBetBuilderModal
        match={match}
        isOpen={showBuilderModal}
        onClose={() => setShowBuilderModal(false)}
      />
    </div>
  );
}

