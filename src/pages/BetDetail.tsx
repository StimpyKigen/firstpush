import { useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Swords, ShieldCheck, Copy, Check, Users, Clock, AlertTriangle,
  CheckCircle2, Ban, Trophy, Hourglass, XCircle, LifeBuoy,
} from 'lucide-react';
import { useAuth, useCurrentUser } from '../lib/authStore';
import { usePvP, type Side } from '../lib/p2pStore';
import Avatar from '../components/Avatar';
import BackNavButton from '../components/BackNavButton';

const statusMeta = {
  awaiting_opponent: { label: 'Awaiting Opponent', color: '#8A6500', icon: Hourglass },
  active: { label: 'Active: In Play', color: '#006C54', icon: Swords },
  disputed: { label: 'Disputed', color: '#e41e3f', icon: AlertTriangle },
  settled: { label: 'Settled', color: '#1876f2', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: '#5d6c7b', icon: Ban },
  declined: { label: 'Declined', color: '#5d6c7b', icon: XCircle },
} as const;

export default function BetDetail() {
  const { id } = useParams();
  const currentUser = useCurrentUser();
  const bets = usePvP((s) => s.bets);
  const cancelBet = usePvP((s) => s.cancelBet);
  const proposeWinner = usePvP((s) => s.proposeWinner);
  const [copied, setCopied] = useState(false);

  const betFound = bets.find((b) => b.id === id);

  if (!currentUser) return <Navigate to="/auth" replace />;
  if (!betFound) return <Navigate to="/p2p" replace />;
  const bet = betFound;

  const meta = statusMeta[bet.status];
  const StatusIcon = meta.icon;

  const mySide: Side | null =
    bet.creatorUsername === currentUser.username ? 'creator' :
    bet.opponentUsername === currentUser.username ? 'opponent' : null;

  const myProposal = mySide === 'creator' ? bet.proposedWinnerByCreator : mySide === 'opponent' ? bet.proposedWinnerByOpponent : null;
  const theirProposal = mySide === 'creator' ? bet.proposedWinnerByOpponent : mySide === 'opponent' ? bet.proposedWinnerByCreator : null;

  function copyCode() {
    navigator.clipboard?.writeText(bet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const pot = bet.creatorStake + bet.opponentStake;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <BackNavButton fallbackUrl="/p2p" label="All P2P Bets" />
      </div>

      <div className="bg-panel border border-line rounded-2xl p-6 sm:p-8 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-panel-2 text-cream-dim">{bet.category}</span>
          <span
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border"
            style={{ color: meta.color, borderColor: `${meta.color}55`, backgroundColor: `${meta.color}18` }}
          >
            <StatusIcon size={12} /> {meta.label}
          </span>
        </div>

        <h1 className="font-display font-bold text-2xl sm:text-3xl text-cream leading-tight">{bet.title}</h1>
        {bet.description && <p className="text-sm text-cream-dim mt-2 leading-relaxed">{bet.description}</p>}

        {bet.settleBy && (
          <p className="flex items-center gap-1.5 text-xs text-cream-dim mt-3">
            <Clock size={13} /> Settles: {bet.settleBy}
          </p>
        )}

        {bet.status === 'awaiting_opponent' && (
          <div className="mt-5 bg-ink-2 border border-gold/30 rounded-xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] text-cream-dim uppercase tracking-wide font-semibold">Invite Code: share with your opponent</p>
              <p className="tabular-nums font-bold text-2xl text-gold tracking-wide">{bet.code}</p>
            </div>
            <button onClick={copyCode} className="bg-panel-2 border border-line rounded-lg p-2.5 hover:border-gold/50 transition-colors shrink-0">
              {copied ? <Check size={18} className="text-emerald-2" /> : <Copy size={18} className="text-cream-dim" />}
            </button>
          </div>
        )}
      </div>

      {/* Sides */}
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 mb-6">
        <div className={`bg-panel border rounded-2xl p-4 sm:p-5 ${bet.winner === 'creator' ? 'border-emerald-2/50 bg-emerald-2/5' : 'border-line'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Avatar name={bet.creatorUsername} seed={bet.creatorUsername.length} size={32} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-cream truncate">{bet.creatorUsername}</p>
              <p className="text-[11px] text-cream-dim">Creator</p>
            </div>
            {bet.winner === 'creator' && <Trophy size={16} className="text-gold ml-auto shrink-0" />}
          </div>
          <p className="text-sm text-cream font-semibold mb-2">{bet.creatorSidePick}</p>
          <p className="text-xs text-cream-dim">Stake: <span className="font-bold text-gold">Ksh {bet.creatorStake}</span></p>
        </div>

        <div className={`bg-panel border rounded-2xl p-4 sm:p-5 ${bet.winner === 'opponent' ? 'border-emerald-2/50 bg-emerald-2/5' : 'border-line'}`}>
          <div className="flex items-center gap-2 mb-3">
            {bet.opponentUsername ? (
              <>
                <Avatar name={bet.opponentUsername} seed={bet.opponentUsername.length} size={32} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-cream truncate">{bet.opponentUsername}</p>
                  <p className="text-[11px] text-cream-dim">Opponent</p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-cream-dim">
                <Users size={18} />
                <p className="text-sm font-semibold">Open slot: waiting</p>
              </div>
            )}
            {bet.winner === 'opponent' && <Trophy size={16} className="text-gold ml-auto shrink-0" />}
          </div>
          <p className="text-sm text-cream font-semibold mb-2">{bet.opponentSidePick}</p>
          <p className="text-xs text-cream-dim">Stake: <span className="font-bold text-gold">Ksh {bet.opponentStake}</span></p>
        </div>
      </div>

      {/* Escrow status */}
      <div className="bg-panel border border-line rounded-2xl p-5 mb-6 flex items-center gap-3">
        <ShieldCheck size={20} className="text-emerald-2 shrink-0" />
        <div>
          <p className="text-sm font-bold text-cream">
            {bet.status === 'settled' ? `Ksh ${pot} released to the winner` : `Ksh ${bet.status === 'active' ? bet.creatorStake : bet.creatorStake} held securely in escrow`}
          </p>
          <p className="text-xs text-cream-dim">{bet.oddsLabel}</p>
        </div>
      </div>

      {/* Actions based on status + role */}
      {bet.status === 'awaiting_opponent' && mySide === 'creator' && (
        <div className="bg-panel border border-line rounded-2xl p-5 mb-6">
          <p className="text-sm text-cream-dim mb-3">Waiting for someone to accept this bet using the invite code above.</p>
          <button
            onClick={() => cancelBet(bet.id)}
            className="flex items-center gap-1.5 text-xs font-bold text-danger border border-danger/30 rounded-full px-4 py-2 hover:bg-danger/10 transition-colors"
          >
            <Ban size={13} /> Cancel & Refund My Stake
          </button>
        </div>
      )}

      {bet.status === 'active' && mySide && (
        <div className="bg-panel border border-line rounded-2xl p-5 mb-6">
          <h3 className="font-display font-bold text-cream mb-1">Confirm the Outcome</h3>
          <p className="text-xs text-cream-dim mb-4">
            Both sides must agree on the winner before funds are released. If your answers don't match, the bet becomes disputed.
          </p>

          {myProposal ? (
            <div className="bg-ink-2 border border-emerald-2/30 rounded-lg p-3 flex items-center gap-2 mb-3">
              <CheckCircle2 size={15} className="text-emerald-2" />
              <p className="text-xs text-cream-dim">
                You confirmed <span className="text-cream font-semibold">{myProposal === 'creator' ? bet.creatorSidePick : bet.opponentSidePick}</span> won.
                {theirProposal ? '' : ' Waiting for the other side to confirm…'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => proposeWinner(bet.id, mySide, 'creator')}
                className="border border-line hover:border-emerald-2/50 rounded-lg p-3 text-left transition-colors"
              >
                <p className="text-xs text-cream-dim mb-1">{bet.creatorUsername} won</p>
                <p className="text-sm font-semibold text-cream truncate">{bet.creatorSidePick}</p>
              </button>
              <button
                onClick={() => proposeWinner(bet.id, mySide, 'opponent')}
                className="border border-line hover:border-emerald-2/50 rounded-lg p-3 text-left transition-colors"
              >
                <p className="text-xs text-cream-dim mb-1">{bet.opponentUsername} won</p>
                <p className="text-sm font-semibold text-cream truncate">{bet.opponentSidePick}</p>
              </button>
            </div>
          )}
        </div>
      )}

      {bet.status === 'disputed' && (
        <div className="bg-danger/10 border border-danger/30 rounded-2xl p-5 mb-6 flex gap-3">
          <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display font-bold text-cream mb-1">This bet is disputed</h3>
            <p className="text-xs text-cream-dim leading-relaxed mb-3">
              You and your opponent proposed different winners. Funds remain safely held in escrow until this is resolved.
              Reach out to Customer Support to mediate.
            </p>
            <Link to="/profile" className="inline-flex items-center gap-1.5 text-xs font-bold text-danger hover:underline">
              <LifeBuoy size={13} /> Contact Support to Resolve
            </Link>
          </div>
        </div>
      )}

      {bet.status === 'settled' && (
        <div className="bg-emerald-2/10 border border-emerald-2/30 rounded-2xl p-5 mb-6 flex gap-3">
          <Trophy size={20} className="text-gold shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display font-bold text-cream mb-1">
              {bet.winner === 'creator' ? bet.creatorUsername : bet.opponentUsername} won this bet!
            </h3>
            <p className="text-xs text-cream-dim leading-relaxed">
              Ksh {pot} has been settled between the two sides. Settled {bet.settledAt && new Date(bet.settledAt).toLocaleString('en-KE')}.
            </p>
          </div>
        </div>
      )}

      {(bet.status === 'cancelled' || bet.status === 'declined') && (
        <div className="bg-panel border border-line rounded-2xl p-5 mb-6 flex gap-3">
          <XCircle size={20} className="text-cream-dim shrink-0 mt-0.5" />
          <p className="text-sm text-cream-dim">
            This bet was {bet.status === 'cancelled' ? 'cancelled by the creator' : 'declined'} and the creator's stake was refunded in full.
          </p>
        </div>
      )}

      {!mySide && bet.status === 'awaiting_opponent' && (
        <div className="bg-panel border border-emerald-2/30 rounded-2xl p-5 text-center">
          <p className="text-sm text-cream-dim mb-3">Have the invite code? Join this bet from the P2P Bets page.</p>
          <Link to="/p2p" className="inline-block bg-emerald-2 hover:bg-emerald text-ink font-bold px-5 py-2.5 rounded-full transition-colors">
            Go Join This Bet
          </Link>
        </div>
      )}
    </div>
  );
}
