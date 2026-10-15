import { Link } from 'react-router-dom';
import { Home, Unlock, Dices, Trophy, User } from 'lucide-react';
import type { Account } from '../../lib/authStore';

interface MobileBottomNavProps {
  pathname: string;
  builderLegsCount: number;
  currentUser: Account | null;
}

/** Fixed native-app-style bottom tab bar shown below `lg`. Already handles safe-area correctly. */
export default function MobileBottomNav({ pathname, builderLegsCount, currentUser }: MobileBottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.06)] select-none">
      <Link
        to="/"
        className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
          pathname === '/'
            ? 'text-[#d81e1e] font-bold bg-red-50/70'
            : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        {pathname === '/' && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-1 bg-[#d81e1e] rounded-full" />
        )}
        <Home size={19} className={pathname === '/' ? 'text-[#d81e1e]' : ''} />
        <span className="text-[10px] tracking-tight font-bold">Jackpots</span>
      </Link>

      <Link
        to="/free"
        className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
          pathname.startsWith('/free')
            ? 'text-[#d81e1e] font-bold bg-red-50/70'
            : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        {pathname.startsWith('/free') && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-1 bg-[#d81e1e] rounded-full" />
        )}
        <Unlock size={19} className={pathname.startsWith('/free') ? 'text-[#d81e1e]' : ''} />
        <span className="text-[10px] tracking-tight font-bold">Matches</span>
      </Link>

      <Link
        to="/slips"
        className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
          pathname === '/slips'
            ? 'text-[#d81e1e] font-bold bg-red-50/70'
            : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        {pathname === '/slips' && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-1 bg-[#d81e1e] rounded-full" />
        )}
        {builderLegsCount > 0 && (
          <span className="absolute top-1 right-2.5 bg-[#d81e1e] text-white font-black text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center shadow-xs">
            {builderLegsCount}
          </span>
        )}
        <Dices size={19} className={pathname === '/slips' ? 'text-[#d81e1e]' : ''} />
        <span className="text-[10px] tracking-tight font-bold">Slips</span>
      </Link>

      <Link
        to="/leaderboard"
        className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
          pathname === '/leaderboard'
            ? 'text-[#d81e1e] font-bold bg-red-50/70'
            : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        {pathname === '/leaderboard' && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-1 bg-[#d81e1e] rounded-full" />
        )}
        <Trophy size={19} className={pathname === '/leaderboard' ? 'text-[#d81e1e]' : ''} />
        <span className="text-[10px] tracking-tight font-bold">Ranks</span>
      </Link>

      <Link
        to={currentUser ? '/profile' : '/auth'}
        className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
          pathname === '/profile' || pathname === '/auth'
            ? 'text-[#d81e1e] font-bold bg-red-50/70'
            : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        {(pathname === '/profile' || pathname === '/auth') && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-1 bg-[#d81e1e] rounded-full" />
        )}
        <User size={19} className={pathname === '/profile' || pathname === '/auth' ? 'text-[#d81e1e]' : ''} />
        <span className="text-[10px] tracking-tight font-bold">{currentUser ? 'Profile' : 'Log In'}</span>
      </Link>
    </nav>
  );
}
