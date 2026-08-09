import { Link } from 'react-router-dom';
import { Users, Lock, Unlock, Clock, CheckCircle2, RadioTower, MessageSquarePlus } from 'lucide-react';
import type { Jackpot } from '../lib/types';
import { BOOKIE_THEME } from '../lib/types';
import { useWallet } from '../lib/store';
import { getTotalSharedPicksCount } from '../lib/mockData';

export default function JackpotCard({ jackpot, index }: { jackpot: Jackpot; index: number; key?: any }) {
  const unlocked = useWallet((s) => s.isRoomUnlocked(jackpot.id));
  const theme = BOOKIE_THEME[jackpot.bookie];
  const totalSharedPicks = getTotalSharedPicksCount(jackpot);

  const statusBadge = {
    open: { label: 'Open', color: 'text-emerald-2 bg-emerald-2/10 border-emerald-2/30' },
    locked: { label: 'Locked · Awaiting KO', color: 'text-gold bg-gold/10 border-gold/30' },
    settled: { label: 'Settled · Archived', color: 'text-cream-dim bg-panel-2 border-line' },
  }[jackpot.status];

  return (
    <Link
      to={`/room/${jackpot.id}`}
      className="animate-rise group relative flex flex-col bg-panel border border-line rounded-2xl overflow-hidden hover:border-gold/50 transition-all active:scale-[0.99] touch-manipulation hover:-translate-y-1 hover:shadow-[0_20px_50px_-15px_rgba(242,183,5,0.25)]"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${theme.ring}, transparent)` }}
      />
      <div className="p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-extrabold text-sm shrink-0"
              style={{ background: theme.bg, color: theme.text }}
            >
              {jackpot.bookie.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs text-cream-dim font-semibold uppercase tracking-wide">{jackpot.bookie}</p>
              <h3 className="font-display font-bold text-lg leading-tight text-cream">{jackpot.name}</h3>
            </div>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>

        {/* Shared Picks Prior to Closure Highlight Badge */}
        <div className="bg-gold/10 border border-gold/25 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs font-semibold text-gold">
          <span className="flex items-center gap-1.5">
            <MessageSquarePlus size={13} />
            Shared Picks Before Closure:
          </span>
          <span className="font-bold text-cream bg-ink px-2 py-0.5 rounded border border-gold/30">
            {totalSharedPicks.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-cream-dim font-mono flex-wrap">
          <span className="bg-ink-2 px-2 py-1 rounded-md">{jackpot.gameweek}</span>
          <span>·</span>
          <span>{jackpot.matches.length} matches</span>
        </div>

        {jackpot.syncedAt && (
          <span className="inline-flex w-fit items-center gap-1.5 text-[10px] font-bold text-emerald-2 bg-emerald-2/10 border border-emerald-2/30 px-2 py-1 rounded-full -mt-1">
            <RadioTower size={11} className="animate-pulse" /> Live synced from {jackpot.bookie}
          </span>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-[11px] text-cream-dim uppercase tracking-wide font-semibold">Bookie Jackpot</p>
            <p className="font-display font-extrabold text-gold text-xl leading-tight">{jackpot.prizePool}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-cream-dim uppercase tracking-wide font-semibold">Room Entry</p>
            <p className="font-display font-extrabold text-cream text-xl leading-tight">Ksh {jackpot.entryFee}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-cream-dim pt-2 border-t border-line/70">
          <span className="flex items-center gap-1.5">
            <Users size={13} /> {jackpot.participants.toLocaleString()} punters
          </span>
          {jackpot.status === 'open' && jackpot.closesInHours != null && (
            <span className="flex items-center gap-1.5 text-gold font-semibold">
              <Clock size={13} /> closes in {jackpot.closesInHours}h
            </span>
          )}
          {jackpot.status === 'settled' && (
            <span className="flex items-center gap-1.5 text-emerald-2 font-semibold">
              <CheckCircle2 size={13} /> Winner announced
            </span>
          )}
          {jackpot.status === 'locked' && (
            <span className="flex items-center gap-1.5 text-gold font-semibold">
              <Clock size={13} /> {jackpot.deadline}
            </span>
          )}
        </div>

        <div
          className={`mt-auto inline-flex items-center justify-center gap-1.5 w-full min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            unlocked
              ? 'bg-emerald-2/10 text-emerald-2 border border-emerald-2/30'
              : 'bg-ink-2 text-gold border border-gold/25 group-hover:bg-gold group-hover:text-ink'
          }`}
        >
          {unlocked ? (
            <>
              <Unlock size={14} /> Unlocked: View Picks
            </>
          ) : (
            <>
              <Lock size={14} /> Unlock for Ksh {jackpot.entryFee}
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
