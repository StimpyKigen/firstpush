import { Link } from 'react-router-dom';
import { Users, Lock, Unlock, Clock, CheckCircle2, RadioTower, MessageSquarePlus } from 'lucide-react';
import type { Jackpot } from '../lib/types';
import { useWallet } from '../lib/store';
import { getTotalSharedPicksCount } from '../lib/mockData';
import { getBookieTheme } from '../lib/bookies';
import { useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';

export default function JackpotCard({ jackpot, index }: { jackpot: Jackpot; index: number; key?: any }) {
  const currentUser = useCurrentUser();
  const openAuthWall = useAuthWallStore((s) => s.openAuthWall);
  const unlocked = useWallet((s) => s.isRoomUnlocked(jackpot.id));
  const bookieTheme = getBookieTheme(jackpot.bookie);
  const totalSharedPicks = getTotalSharedPicksCount(jackpot);

  const statusBadge = {
    open: { label: 'Open', textColor: 'text-emerald-700', dotColor: 'bg-emerald-500' },
    locked: { label: 'Locked · Awaiting KO', textColor: 'text-amber-700', dotColor: 'bg-amber-500' },
    settled: { label: 'Settled · Archived', textColor: 'text-slate-500', dotColor: 'bg-slate-400' },
  }[jackpot.status];

  return (
    <Link
      to={`/room/${jackpot.id}${unlocked ? '' : '#unlock'}`}
      onClick={(e) => {
        if (!currentUser && !unlocked) {
          e.preventDefault();
          openAuthWall({
            actionType: 'jackpot',
            title: 'Sign In to Unlock Room',
            message: `Sign up or log in to unlock ${jackpot.name} consensus data, post your picks, and compete for the leaderboard crown.`,
          });
        }
      }}
      className="animate-rise group relative flex flex-col border rounded-xl overflow-hidden hover:shadow-md transition-all active:scale-[0.985] touch-manipulation hover:-translate-y-1"
      style={{
        animationDelay: `${index * 50}ms`,
        background: `linear-gradient(180deg, ${bookieTheme.fadedBg} 0%, #ffffff 50%)`,
        borderColor: bookieTheme.border,
      }}
    >
      <div className="p-5 sm:p-6 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex items-center justify-center shrink-0">
              <img
                src={bookieTheme.logo}
                alt={jackpot.bookie}
                className="w-full h-full object-contain select-none"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.parentElement.innerText = jackpot.bookie.slice(0, 2).toUpperCase();
                  }
                }}
              />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg leading-tight text-slate-900 group-hover:text-[#006C54] transition-colors">{jackpot.name}</h3>
            </div>
          </div>
          {/* Clean Informational Text Status Label (No Generic Pill) */}
          <span className={`text-[11px] font-bold uppercase tracking-wide inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${statusBadge.textColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dotColor}`} />
            {statusBadge.label}
          </span>
        </div>

        {/* Shared Picks Prior to Closure Strip */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 flex items-center justify-between text-xs font-semibold text-slate-700">
          <span className="flex items-center gap-1.5">
            <MessageSquarePlus size={13} className="text-[#006C54]" />
            Shared Picks Before Closure:
          </span>
          <span className="tabular-nums font-bold text-xs text-slate-900">
            {totalSharedPicks.toLocaleString()}
          </span>
        </div>

        {/* Clean Typographic Gameweek (No Pill Container) */}
        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
          <span className="font-bold text-slate-800 uppercase tracking-wide">{jackpot.gameweek}</span>
        </div>

        {/* Clean Live Sync Text Label */}
        {jackpot.syncedAt && (
          <span className="inline-flex w-fit items-center gap-1.5 text-[11px] font-bold text-emerald-700 uppercase tracking-wide -mt-1">
            <RadioTower size={12} className="text-emerald-600 shrink-0" /> Live synced from {jackpot.bookie}
          </span>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-[11px] text-slate-400 uppercase tracking-wide font-bold">Bookie Jackpot</p>
            <p className="font-display font-bold text-[#8A6500] text-xl sm:text-2xl leading-tight">{jackpot.prizePool}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-slate-400 uppercase tracking-wide font-bold">Room Entry</p>
            <p className="font-display font-bold text-slate-900 text-xl sm:text-2xl leading-tight">Ksh {jackpot.entryFee}</p>
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

        {/* Custom Athletic CTA Button */}
        <div
          className={`mt-auto w-full h-11 px-4 text-xs sm:text-sm font-bold uppercase tracking-wide transition-all shrink-0 rounded-md inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
            unlocked
              ? 'bg-white text-[#006C54] border border-[#006C54]/60 hover:bg-emerald-50'
              : 'bg-[#006C54] hover:bg-[#005441] text-white border border-[#005441] group-hover:shadow-md'
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
