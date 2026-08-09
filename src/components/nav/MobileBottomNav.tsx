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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-ink/95 backdrop-blur-xl border-t border-line/80 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.6)] select-none">
      <Link
        to="/"
        className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
          pathname === '/'
            ? 'text-gold font-bold bg-gold/10'
            : 'text-cream-dim/75 hover:text-cream'
        }`}
      >
        {pathname === '/' && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-gold rounded-full shadow-[0_0_8px_#F59E0B]" />
        )}
        <Home size={20} className={pathname === '/' ? 'text-gold drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]' : ''} />
        <span className="text-[10px] tracking-tight font-semibold">Home</span>
      </Link>

      <Link
        to="/free"
        className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
          pathname.startsWith('/free')
            ? 'text-gold font-bold bg-gold/10'
            : 'text-cream-dim/75 hover:text-cream'
        }`}
      >
        {pathname.startsWith('/free') && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-gold rounded-full shadow-[0_0_8px_#F59E0B]" />
        )}
        <Unlock size={20} className={pathname.startsWith('/free') ? 'text-gold drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]' : ''} />
        <span className="text-[10px] tracking-tight font-semibold">Free</span>
      </Link>

      <Link
        to="/slips"
        className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
          pathname === '/slips'
            ? 'text-gold font-bold bg-gold/10'
            : 'text-cream-dim/75 hover:text-cream'
        }`}
      >
        {pathname === '/slips' && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-gold rounded-full shadow-[0_0_8px_#F59E0B]" />
        )}
        {builderLegsCount > 0 && (
          <span className="absolute top-1 right-2.5 bg-gold text-ink font-black text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center shadow-md border border-ink">
            {builderLegsCount}
          </span>
        )}
        <Dices size={20} className={pathname === '/slips' ? 'text-gold drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]' : ''} />
        <span className="text-[10px] tracking-tight font-semibold">Builder</span>
      </Link>

      <Link
        to="/leaderboard"
        className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
          pathname === '/leaderboard'
            ? 'text-gold font-bold bg-gold/10'
            : 'text-cream-dim/75 hover:text-cream'
        }`}
      >
        {pathname === '/leaderboard' && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-gold rounded-full shadow-[0_0_8px_#F59E0B]" />
        )}
        <Trophy size={20} className={pathname === '/leaderboard' ? 'text-gold drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]' : ''} />
        <span className="text-[10px] tracking-tight font-semibold">Ranks</span>
      </Link>

      <Link
        to={currentUser ? '/profile' : '/auth'}
        className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
          pathname === '/profile' || pathname === '/auth'
            ? 'text-gold font-bold bg-gold/10'
            : 'text-cream-dim/75 hover:text-cream'
        }`}
      >
        {(pathname === '/profile' || pathname === '/auth') && (
          <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-gold rounded-full shadow-[0_0_8px_#F59E0B]" />
        )}
        <User size={20} className={pathname === '/profile' || pathname === '/auth' ? 'text-gold drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]' : ''} />
        <span className="text-[10px] tracking-tight font-semibold">{currentUser ? 'Profile' : 'Log In'}</span>
      </Link>
    </nav>
  );
}
