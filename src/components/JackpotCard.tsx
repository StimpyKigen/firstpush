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
    open: { label: 'Open', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    locked: { label: 'Locked · Awaiting KO', color: 'text-amber-800 bg-amber-50 border-amber-200' },
    settled: { label: 'Settled · Archived', color: 'text-slate-600 bg-slate-100 border-slate-200' },
  }[jackpot.status];

  return (
    <Link
      to={`/room/${jackpot.id}`}
      className="animate-rise group relative flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-all active:scale-[0.985] touch-manipulation hover:-translate-y-1"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div
        className="h-1.5 w-full"
        style={{ background: theme.ring }}
      />
      <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-display font-black text-sm shrink-0 shadow-xs"
              style={{ background: theme.bg, color: theme.text }}
            >
              {jackpot.bookie.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{jackpot.bookie}</p>
              <h3 className="font-display font-black text-lg leading-tight text-slate-900 group-hover:text-[#d81e1e] transition-colors">{jackpot.name}</h3>
            </div>
          </div>
          <span className={`text-[11px] font-bold px-3 py-1 rounded-full border whitespace-nowrap shadow-xs ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
        </div>

        {/* Shared Picks Prior to Closure Highlight Badge */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5">
            <MessageSquarePlus size={13} className="text-[#d81e1e]" />
            Shared Picks Before Closure:
          </span>
          <span className="font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-full border border-slate-200 font-mono text-[11px] shadow-xs">
            {totalSharedPicks.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono flex-wrap">
          <span className="bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 font-bold text-slate-700">{jackpot.gameweek}</span>
          <span className="text-slate-300">·</span>
          <span>{jackpot.matches.length} matches</span>
        </div>

        {jackpot.syncedAt && (
          <span className="inline-flex w-fit items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full -mt-1">
            <RadioTower size={11} className="animate-pulse text-emerald-600" /> Live synced from {jackpot.bookie}
          </span>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Bookie Jackpot</p>
            <p className="font-display font-black text-amber-600 text-xl sm:text-2xl leading-tight">{jackpot.prizePool}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Room Entry</p>
            <p className="font-display font-black text-slate-900 text-xl sm:text-2xl leading-tight">Ksh {jackpot.entryFee}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span className="flex items-center gap-1.5 font-medium">
            <Users size={13} className="text-[#059669]" /> {jackpot.participants.toLocaleString()} punters
          </span>
          {jackpot.status === 'open' && jackpot.closesInHours != null && (
            <span className="flex items-center gap-1.5 text-amber-700 font-bold">
              <Clock size={13} /> closes in {jackpot.closesInHours}h
            </span>
          )}
          {jackpot.status === 'settled' && (
            <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
              <CheckCircle2 size={13} /> Winner announced
            </span>
          )}
          {jackpot.status === 'locked' && (
            <span className="flex items-center gap-1.5 text-amber-700 font-bold">
              <Clock size={13} /> {jackpot.deadline}
            </span>
          )}
        </div>

        <div
          className={`mt-auto w-full min-h-[44px] py-2.5 px-4 text-xs sm:text-sm font-bold transition-all shrink-0 rounded-full inline-flex items-center justify-center gap-2 ${
            unlocked
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 shadow-xs'
              : 'bg-[#d81e1e] hover:bg-[#b91515] text-white shadow-xs group-hover:shadow-md'
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
