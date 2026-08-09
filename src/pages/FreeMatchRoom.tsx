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

      <div className="bg-panel border border-line rounded-2xl p-6 sm:p-8 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border"
            style={{ color: tierColor[match.tier], borderColor: `${tierColor[match.tier]}55`, backgroundColor: `${tierColor[match.tier]}18` }}
          >
            {TIER_LABEL[match.tier]}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-2 bg-emerald-2/10 border border-emerald-2/30 px-2.5 py-1 rounded-full">
            <Unlock size={11} /> Free room: no payment required
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cream-dim">
            <RadioTower size={11} className="animate-pulse text-emerald-2" /> Synced {match.syncedAt}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-cream leading-tight">
              {match.home} <span className="text-cream-dim">vs</span> {match.away}
            </h1>
            <p className="text-sm text-cream-dim mt-2">{match.competition}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {myPickRecord && (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-xl shadow-sm"
                style={{
                  backgroundColor: `${outcomeColor}22`,
                  color: outcomeColor,
                  border: `1px solid ${outcomeColor}66`,
                }}
              >
                <CheckCircle2 size={14} />
                YOUR PICK: {myPickRecord.pick}
              </span>
            )}

            <button
              onClick={() => setShowBuilderModal(true)}
              className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3.5 py-2 rounded-xl transition-all shadow-sm touch-manipulation active:scale-95 ${
                builderLegs.some((l) => l.matchId === match.id)
                  ? 'bg-gold text-ink border border-gold shadow-md'
                  : 'bg-gold/15 text-gold border border-gold/40 hover:bg-gold hover:text-ink'
              }`}
            >
              {builderLegs.some((l) => l.matchId === match.id) ? (
                <>
                  <Check size={14} /> In Bet Builder ({builderLegs.filter((l) => l.matchId === match.id).length})
                </>
              ) : (
                <>
                  <Dices size={14} /> Add to Bet Builder
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-sm text-cream-dim mt-3 leading-relaxed max-w-2xl">{match.blurb}</p>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 pt-5 border-t border-dashed border-line text-sm text-cream-dim">
          <span className="flex items-center gap-1.5"><Clock size={14} /> {match.kickoff}</span>
          <span className="flex items-center gap-1.5"><Users size={14} /> {consensus.totalVotes.toLocaleString()} punters discussing</span>
        </div>
      </div>

      {/* Shared Picks Prior to Closure Highlight Banner */}
      <div className="mb-6 bg-gradient-to-r from-emerald-500/15 via-gold/15 to-emerald-500/10 border border-gold/30 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gold text-ink flex items-center justify-center font-bold shrink-0 shadow">
            <Users size={20} />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-cream text-sm sm:text-base">
              Shared Picks Before Match Closure
            </h3>
            <p className="text-xs text-cream-dim">
              Predictions and reasoning shared by community punters prior to kickoff closure.
            </p>
          </div>
        </div>
        <div className="bg-ink border border-gold/40 px-3.5 py-1.5 rounded-xl text-center shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-wider text-cream-dim block">Shared Picks</span>
          <span className="font-display font-extrabold text-gold text-base sm:text-lg">
            {consensus.totalVotes.toLocaleString()}
          </span>
        </div>
      </div>

      {toastMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-2/15 border border-emerald-2/40 text-emerald-2 font-bold text-sm flex items-center gap-2 animate-rise">
          <CheckCircle2 size={18} /> {toastMsg}
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

