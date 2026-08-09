import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Swords, Plus, Search, ShieldCheck, Users, Scale, Coins, ArrowRight,
  Clock, CheckCircle2, AlertTriangle, Ban, XCircle, Hourglass,
} from 'lucide-react';
import { useAuth, useCurrentUser } from '../lib/authStore';
import { usePvP } from '../lib/p2pStore';
import type { BetStatus } from '../lib/p2pStore';

const statusMeta: Record<BetStatus, { label: string; color: string; icon: typeof Clock }> = {
  awaiting_opponent: { label: 'Awaiting Opponent', color: '#f2b705', icon: Hourglass },
  active: { label: 'Active', color: '#1fae6f', icon: Swords },
  disputed: { label: 'Disputed', color: '#ef5b5b', icon: AlertTriangle },
  settled: { label: 'Settled', color: '#3b82f6', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: '#6b7280', icon: Ban },
  declined: { label: 'Declined', color: '#6b7280', icon: XCircle },
};

export default function P2PBets() {
  const currentUser = useCurrentUser();
  const bets = usePvP((s) => s.bets);
  const joinBet = usePvP((s) => s.joinBet);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  const myBets = useMemo(
    () => bets.filter((b) => b.creatorUsername === currentUser?.username || b.opponentUsername === currentUser?.username),
    [bets, currentUser?.username]
  );

  if (!currentUser) return <Navigate to="/auth" replace />;

  const visibleBets = filter === 'mine' ? myBets : bets;

  function handleJoin() {
    setJoinError('');
    setJoinSuccess('');
    if (!joinCode.trim()) { setJoinError('Enter an invite code.'); return; }
    const res = joinBet(joinCode.trim(), currentUser!.username);
    if (!res.ok) { setJoinError(res.error ?? 'Could not join bet.'); return; }
    setJoinSuccess('Joined! Scroll down to find your bet.');
    setJoinCode('');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Hero */}
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-1.5 bg-panel border border-gold/30 text-gold text-xs font-bold px-3 py-1.5 rounded-full mb-4">
          <Swords size={13} /> Peer-to-Peer Betting
        </span>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-cream">Bet Anyone, On Anything.</h1>
        <p className="text-cream-dim mt-3 max-w-2xl mx-auto leading-relaxed">
          MshindiRoom doesn't set the odds or the market: <span className="text-cream font-semibold">you and your friend do</span>.
          Agree on what you're betting on, the stake, the odds, and who wins. We just hold the funds safely until it's settled.
        </p>
      </div>

      {/* How it works strip */}
      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-panel border border-line rounded-2xl p-5 flex flex-col gap-2">
          <span className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
            <Scale size={17} className="text-gold" />
          </span>
          <h3 className="font-display font-bold text-cream text-sm">You set the terms</h3>
          <p className="text-xs text-cream-dim leading-relaxed">Pick the subject, the stake, and the odds. No pre-built markets: total freedom.</p>
        </div>
        <div className="bg-panel border border-line rounded-2xl p-5 flex flex-col gap-2">
          <span className="w-9 h-9 rounded-lg bg-emerald-2/10 border border-emerald-2/30 flex items-center justify-center">
            <ShieldCheck size={17} className="text-emerald-2" />
          </span>
          <h3 className="font-display font-bold text-cream text-sm">Funds held in escrow</h3>
          <p className="text-xs text-cream-dim leading-relaxed">Your stake is locked the moment you create a bet: no one can back out and keep the cash.</p>
        </div>
        <div className="bg-panel border border-line rounded-2xl p-5 flex flex-col gap-2">
          <span className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-400/30 flex items-center justify-center">
            <Users size={17} className="text-[#3b82f6]" />
          </span>
          <h3 className="font-display font-bold text-cream text-sm">Mutual settlement</h3>
          <p className="text-xs text-cream-dim leading-relaxed">Both sides confirm the outcome. If you disagree, the bet is flagged disputed for review.</p>
        </div>
      </div>

      {/* Action row: create + join */}
      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <Link
          to="/p2p/create"
          className="group flex items-center justify-between gap-3 bg-gradient-to-br from-gold/15 to-transparent border border-gold/30 rounded-2xl p-6 hover:border-gold/60 transition-colors"
        >
          <div>
            <h3 className="font-display font-bold text-lg text-cream flex items-center gap-2"><Plus size={18} className="text-gold" /> Create a Bet</h3>
            <p className="text-sm text-cream-dim mt-1">Set the terms, stake your side, and share an invite code with a friend.</p>
          </div>
          <ArrowRight size={20} className="text-gold shrink-0 group-hover:translate-x-1 transition-transform" />
        </Link>

        <div className="bg-panel border border-line rounded-2xl p-6">
          <h3 className="font-display font-bold text-lg text-cream flex items-center gap-2 mb-1"><Search size={18} className="text-emerald-2" /> Join a Bet</h3>
          <p className="text-sm text-cream-dim mb-3">Got an invite code from a friend? Enter it here to accept the challenge.</p>
          <div className="flex flex-col xs:flex-row gap-2">
            <input
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); setJoinSuccess(''); }}
              placeholder="e.g. 7K2QXM"
              maxLength={6}
              className="flex-1 min-w-0 bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono tracking-widest text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-emerald-2 uppercase"
            />
            <button
              onClick={handleJoin}
              className="bg-emerald-2 hover:bg-emerald text-ink font-bold text-sm px-5 py-2.5 rounded-lg transition-colors shrink-0"
            >
              Join
            </button>
          </div>
          {joinError && <p className="text-xs text-danger font-semibold mt-2">{joinError}</p>}
          {joinSuccess && <p className="text-xs text-emerald-2 font-semibold mt-2">{joinSuccess}</p>}
        </div>
      </div>

      {/* Bets list */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-xl text-cream flex items-center gap-2">
          <Coins size={19} className="text-gold" /> {filter === 'mine' ? 'My Bets' : 'All Bets'}
        </h2>
        <div className="flex bg-panel border border-line rounded-full p-1">
          <button
            onClick={() => setFilter('mine')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === 'mine' ? 'bg-gold text-ink' : 'text-cream-dim hover:text-cream'}`}
          >
            My Bets ({myBets.length})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === 'all' ? 'bg-gold text-ink' : 'text-cream-dim hover:text-cream'}`}
          >
            All ({bets.length})
          </button>
        </div>
      </div>

      {visibleBets.length === 0 ? (
        <div className="text-center py-16 bg-panel border border-dashed border-line rounded-2xl">
          <Swords size={28} className="mx-auto text-cream-dim mb-3" />
          <p className="text-cream-dim text-sm">
            {filter === 'mine' ? "You haven't created or joined any bets yet." : 'No bets have been created yet.'}
          </p>
          <Link to="/p2p/create" className="inline-flex items-center gap-1.5 mt-4 text-sm font-bold text-gold hover:underline">
            Create the first one <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {visibleBets.map((bet, i) => {
            const meta = statusMeta[bet.status];
            const StatusIcon = meta.icon;
            const isMine = bet.creatorUsername === currentUser.username || bet.opponentUsername === currentUser.username;
            return (
              <Link
                key={bet.id}
                to={`/p2p/${bet.id}`}
                className="animate-rise bg-panel border border-line rounded-2xl p-5 flex flex-col gap-3 hover:border-gold/40 hover:-translate-y-0.5 transition-all"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-panel-2 text-cream-dim">{bet.category}</span>
                  <span
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border"
                    style={{ color: meta.color, borderColor: `${meta.color}55`, backgroundColor: `${meta.color}18` }}
                  >
                    <StatusIcon size={10} /> {meta.label}
                  </span>
                </div>
                <h3 className="font-display font-bold text-cream leading-snug">{bet.title}</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-ink-2 rounded-lg px-3 py-2">
                    <p className="text-cream-dim">{bet.creatorUsername}</p>
                    <p className="text-cream font-semibold truncate">{bet.creatorSidePick}</p>
                  </div>
                  <div className="bg-ink-2 rounded-lg px-3 py-2">
                    <p className="text-cream-dim">{bet.opponentUsername ?? 'Open slot'}</p>
                    <p className="text-cream font-semibold truncate">{bet.opponentSidePick}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-line/70">
                  <span className="text-cream-dim">Stake: <span className="text-gold font-bold">Ksh {bet.creatorStake}</span> vs <span className="text-gold font-bold">Ksh {bet.opponentStake}</span></span>
                  {isMine && <span className="text-emerald-2 font-bold">Your bet</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
