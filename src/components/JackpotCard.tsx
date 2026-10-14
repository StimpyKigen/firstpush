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
      className="animate-rise group relative flex flex-col ios-card overflow-hidden hover:border-gold/50 transition-all active:scale-[0.985] touch-manipulation hover:-translate-y-1"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div
        className="h-1.5 w-full opacity-80"
        style={{ background: `linear-gradient(90deg, ${theme.ring}, transparent)` }}
      />
      <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center font-display font-extrabold text-sm shrink-0 shadow-sm"
              style={{ background: theme.bg, color: theme.text }}
            >
              {jackpot.bookie.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-[11px] text-cream-dim font-bold uppercase tracking-wider">{jackpot.bookie}</p>
              <h3 className="font-display font-extrabold text-lg leading-tight text-cream group-hover:text-gold transition-colors">{jackpot.name}</h3>
            </div>
          </div>
          <span className={`text-[11px] font-bold px-3 py-1 rounded-full border whitespace-nowrap shadow-sm ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>

        {/* Shared Picks Prior to Closure Highlight Badge */}
        <div className="bg-gold/10 border border-gold/20 rounded-2xl px-3.5 py-2 flex items-center justify-between text-xs font-semibold text-gold">
          <span className="flex items-center gap-1.5">
            <MessageSquarePlus size={13} />
            Shared Picks Before Closure:
          </span>
          <span className="font-bold text-cream bg-ink px-2.5 py-0.5 rounded-full border border-gold/30 font-mono text-[11px]">
            {totalSharedPicks.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-cream-dim font-mono flex-wrap">
          <span className="bg-ink-2/80 px-2.5 py-1 rounded-full border border-line/60 font-semibold">{jackpot.gameweek}</span>
          <span className="text-cream-dim/50">·</span>
          <span>{jackpot.matches.length} matches</span>
        </div>

        {jackpot.syncedAt && (
          <span className="inline-flex w-fit items-center gap-1.5 text-[10px] font-bold text-emerald-2 bg-emerald-2/10 border border-emerald-2/30 px-2.5 py-1 rounded-full -mt-1 shadow-sm">
            <RadioTower size={11} className="animate-pulse" /> Live synced from {jackpot.bookie}
          </span>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-[10px] text-cream-dim uppercase tracking-wider font-bold">Bookie Jackpot</p>
            <p className="font-display font-extrabold text-gold text-xl sm:text-2xl leading-tight">{jackpot.prizePool}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-cream-dim uppercase tracking-wider font-bold">Room Entry</p>
            <p className="font-display font-extrabold text-cream text-xl sm:text-2xl leading-tight">Ksh {jackpot.entryFee}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-cream-dim pt-2 border-t border-line/60">
          <span className="flex items-center gap-1.5 font-medium">
            <Users size={13} className="text-emerald-2" /> {jackpot.participants.toLocaleString()} punters
          </span>
          {jackpot.status === 'open' && jackpot.closesInHours != null && (
            <span className="flex items-center gap-1.5 text-gold font-bold">
              <Clock size={13} /> closes in {jackpot.closesInHours}h
            </span>
          )}
          {jackpot.status === 'settled' && (
            <span className="flex items-center gap-1.5 text-emerald-2 font-bold">
              <CheckCircle2 size={13} /> Winner announced
            </span>
          )}
          {jackpot.status === 'locked' && (
            <span className="flex items-center gap-1.5 text-gold font-bold">
              <Clock size={13} /> {jackpot.deadline}
            </span>
          )}
        </div>

        <div
          className={`mt-auto ios-pill-btn w-full min-h-[44px] py-2.5 px-4 text-xs sm:text-sm font-bold transition-all shrink-0 ${
            unlocked
              ? 'bg-emerald-2/15 text-emerald-2 border border-emerald-2/40 hover:bg-emerald-2/25'
              : 'bg-gold hover:bg-gold-2 text-ink shadow-md group-hover:shadow-lg'
          }`}
        >
          {unlocked ? (
            <>
              <Unlock size={14} /> Unlocked: View Picks &rarr;
            </>
          ) : (
            <>
              <Lock size={14} /> Unlock for Ksh {jackpot.entryFee} &rarr;
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
