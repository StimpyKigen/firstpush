import { useState, useSyncExternalStore } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Users, Clock, CheckCircle2, RadioTower, Unlock } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import {
  getFreeMatchesSnapshot,
  getFreeMatchConsensusSnapshot,
  subscribeToFreeMatches
} from '../lib/freeMatches';
import { GamblerPick, Outcome } from '../lib/types';
import { useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';
import { useUserPicks } from '../lib/userPicksStore';
import OutcomeBar from '../components/OutcomeBar';
import DiscussionPanel from '../components/DiscussionPanel';
import BackNavButton from '../components/BackNavButton';
import { RoomDetailSkeleton } from '../components/skeleton';
import SportScoreMatchCenter from '../components/SportScoreMatchCenter';
import { formatKickoffDateTime24h } from '../lib/competitionPriority';

export default function FreeMatchRoom() {
  const { id } = useParams();
  const matches = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchesSnapshot, getFreeMatchesSnapshot);
  const consensusMap = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchConsensusSnapshot, getFreeMatchConsensusSnapshot);
  const match = id ? matches.find((item) => item.id === id) : undefined;

  const currentUser = useCurrentUser();
  const openAuthWall = useAuthWallStore((s) => s.openAuthWall);
  const username = currentUser?.username || 'Guest Punter';
  const { savePick, getPick } = useUserPicks();

  // Tab indicator state: 'details' vs 'discussion'
  const [roomTab, setRoomTab] = useState<'details' | 'discussion'>('details');

  const roomId = `free-${id}`;
  const myPickRecord = match ? getPick(roomId, match.id) : undefined;

  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>(myPickRecord?.pick || '1');
  const [reasoning, setReasoning] = useState(myPickRecord?.reasoning || '');
  const [isEditing, setIsEditing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  if (!match) {
    if (matches.length === 0) {
      return <RoomDetailSkeleton />;
    }
    return <Navigate to="/free" replace />;
  }
  const consensus = consensusMap[match.id];

  const outcomeColor = myPickRecord?.pick === '1' ? '#006C54' : myPickRecord?.pick === 'X' ? '#8A6500' : '#e41e3f';

  const handlePostPick = () => {
    if (!currentUser) {
      openAuthWall({
        actionType: 'discussion',
        title: 'Sign In to Post Picks & Reasoning',
        message: 'Sign up or log in to submit your prediction and share reasoning with fellow punters.',
      });
      return;
    }

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

      {/* Back to All Free Matches Navigation */}
      <div className="mb-4">
        <BackNavButton fallbackUrl="/free" label="All free matches" />
      </div>

      {/* MATCH DETAILS & FAN DISCUSSION TAB INDICATOR (Matching Reference Photo) */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-4 sm:gap-6 py-1.5 px-4">
          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                openAuthWall({
                  actionType: 'details',
                  title: 'Sign In for Match Details',
                  message: 'Sign up or log in to view match intelligence, tactical lineups, pitch incident tracker, and H2H statistics.',
                });
                return;
              }
              setRoomTab('details');
            }}
            className={`text-sm sm:text-base transition-colors flex items-center gap-2 cursor-pointer select-none ${
              roomTab === 'details'
                ? 'font-bold text-[#006C54]'
                : 'font-semibold text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Match Details</span>
          </button>

          {/* Vertical Divider */}
          <div className="h-4 sm:h-5 w-[1px] bg-slate-300 shrink-0" aria-hidden="true" />

          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                openAuthWall({
                  actionType: 'discussion',
                  title: 'Sign In to Join Discussion',
                  message: 'Sign up or log in to participate in live match room debates and fan discussions.',
                });
                return;
              }
              setRoomTab('discussion');
            }}
            className={`text-sm sm:text-base transition-colors flex items-center gap-2 cursor-pointer select-none ${
              roomTab === 'discussion'
                ? 'font-bold text-[#006C54]'
                : 'font-semibold text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Fan Discussion</span>
            {consensus && (
              <span
                className={`text-[11px] tabular-nums font-bold transition-colors ${
                  roomTab === 'discussion'
                    ? 'text-[#006C54]'
                    : 'text-slate-500'
                }`}
              >
                {consensus.totalVotes}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* FIRST CARD: Match Title, League, and Kickoff Time (Tier text & Bet Builder button removed) */}
      <div className="bg-[#FFFFF0] border border-[#DCDCC8] rounded-2xl p-6 sm:p-8 mb-6 shadow-xs">
        {/* Header Metadata */}
        <div className="flex flex-wrap items-center gap-2.5 mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
          <span className="text-slate-700 inline-flex items-center gap-1.5 font-bold">
            <Unlock size={13} className="text-[#006C54]" /> Free Match Room
          </span>
          <span className="text-slate-300 font-normal">·</span>
          <span className="text-slate-500 font-semibold inline-flex items-center gap-1.5">
            <RadioTower size={12} className="animate-pulse text-[#006C54]" /> Live Match Centre
          </span>
        </div>

        {/* Team Names and League Name at the bottom of the teams (smaller grey font, no trophy) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-4xl text-slate-900 leading-tight uppercase tracking-tight">
              {match.home} <span className="text-slate-400 font-normal">v</span> {match.away}
            </h1>
            <div className="mt-1.5">
              <span className="text-xs sm:text-sm font-semibold text-slate-500 tracking-wide">
                {match.competition}
              </span>
            </div>
          </div>

          {/* User's Pick Badge if picked */}
          {myPickRecord && (
            <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
              <div
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-md"
                style={{
                  backgroundColor: `${outcomeColor}18`,
                  color: outcomeColor,
                  border: `1px solid ${outcomeColor}44`,
                }}
              >
                <CheckCircle2 size={14} />
                YOUR PICK: {myPickRecord.pick}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Date & Time in DD/MM HH:mm (24h system) and Punters Discussing */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4 border-t border-[#E6E6D2] text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5 tabular-nums">
            <Clock size={14} className="text-slate-400" />
            {formatKickoffDateTime24h(match.kickoffIso, match.kickoff)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={14} className="text-[#006C54]" />
            {consensus.totalVotes.toLocaleString()} punters discussing
          </span>
        </div>
      </div>

      {toastMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-sm flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-600" /> {toastMsg}
        </div>
      )}

      {/* TAB CONTENT 1: MATCH DETAILS (Lineups, Incidents, Details, Standings, Live Pitch Tracker) */}
      {roomTab === 'details' && (
        <div className="animate-in fade-in duration-200">
          <SportScoreMatchCenter match={match} />
        </div>
      )}

      {/* TAB CONTENT 2: FAN DISCUSSION (Community Pick & Consensus, Outcome Bar, Discussion Panel) */}
      {roomTab === 'discussion' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Community Picks & Consensus Split Banner (Border removed on icon before text) */}
          <div className="bg-[#FFFFF0] border border-[#DCDCC8] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-[#006C54] shrink-0" />
              <div>
                <h3 className="font-display font-bold text-slate-900 text-sm sm:text-base uppercase tracking-tight">
                  Community Picks &amp; Consensus Split
                </h3>
                <p className="text-xs text-slate-500">
                  Predictions and reasoning shared by community punters prior to kickoff closure.
                </p>
              </div>
            </div>
            <div className="bg-[#F5F5E4] border border-[#E6E6D2] px-4 py-1.5 rounded-xl text-center shrink-0">
              <span className="text-[11px] uppercase font-bold tracking-wide text-slate-400 block">Shared Picks</span>
              <span className="font-display font-bold text-[#006C54] text-base sm:text-lg">
                {consensus.totalVotes.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-[#FFFFF0] border border-[#DCDCC8] rounded-2xl p-5 sm:p-6 flex flex-col gap-6 shadow-xs">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700">
                {errorMsg}
              </div>
            )}

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
        </div>
      )}
    </div>
  );
}
