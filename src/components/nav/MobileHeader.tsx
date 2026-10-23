import { Link } from 'react-router-dom';
import { Wallet, Menu, X, UserCircle2, ShieldCheck, LogOut, Settings, Bell, Swords } from 'lucide-react';
import { isAdminUser, type Account } from '../../lib/authStore';
import Avatar from '../Avatar';
import type { NavLinkItem } from './useNavData';

interface MobileHeaderControlsProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** The clean hamburger menu toggle in the header bar below `lg`, free of circular borders. */
export function MobileHeaderControls({
  open,
  setOpen,
}: MobileHeaderControlsProps) {
  return (
    <div className="flex lg:hidden items-center shrink-0">
      <button
        className="text-slate-800 p-1.5 hover:text-[#EEAA04] active:scale-95 transition-colors touch-manipulation cursor-pointer flex items-center justify-center"
        onClick={() => setOpen(!open)}
        aria-label="Toggle Menu"
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>
    </div>
  );
}

interface MobileMenuPanelProps {
  links?: NavLinkItem[];
  pathname?: string;
  currentUser: Account | null;
  balance: number;
  onNavigate: () => void;
  onOpenAdminModal: () => void;
  onLogout: () => void;
}

/** The hamburger dropdown panel, rendered below the header bar (not nested inside it). */
export function MobileMenuPanel({
  currentUser,
  balance,
  onNavigate,
  onOpenAdminModal,
  onLogout,
}: MobileMenuPanelProps) {
  return (
    <div className="lg:hidden border-b border-[#E6E6D2]/80 mobile-nav-glass px-4 py-4 flex flex-col gap-1.5 max-h-[calc(100dvh-4.5rem)] overflow-y-auto scroll-touch animate-rise shadow-xl">
      {currentUser ? (
        <div className="flex flex-col gap-2">
          {/* View Profile Card */}
          <Link
            to="/profile"
            onClick={onNavigate}
            className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#F5F5E4] border border-[#E6E6D2] text-slate-800 font-bold text-sm min-w-0 active:scale-[0.98] transition-all"
          >
            <Avatar name={currentUser.username} seed={currentUser.phone.length} size={28} avatarId={currentUser.avatarId} />
            <span className="truncate flex-1">{currentUser.username}</span>
            <span className="text-xs text-slate-500 font-normal">View Profile</span>
          </Link>

          {/* P2P Bets Placed Directly Below View Profile Card */}
          <Link
            to="/p2p"
            onClick={onNavigate}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:text-[#EEAA04] hover:bg-emerald-50/50 active:bg-emerald-50 active:scale-[0.98] font-bold text-sm transition-all touch-manipulation min-h-[44px]"
          >
            <Swords size={18} className="shrink-0 text-[#006C54]" />
            <span className="truncate">P2P Bets</span>
            <span className="text-[11px] font-bold bg-[#8A6500]/15 text-[#8A6500] border border-[#8A6500]/30 px-2 py-0.5 rounded-full shrink-0 ml-auto">
              Soon
            </span>
          </Link>

          {isAdminUser(currentUser) && (
            <button
              onClick={() => {
                onNavigate();
                onOpenAdminModal();
              }}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-full bg-emerald-50 text-[#006C54] border border-emerald-200 font-bold text-xs active:scale-98 transition-all"
            >
              <ShieldCheck size={15} /> Jackpot Admin Console
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Link
            to="/auth"
            onClick={onNavigate}
            className="bg-[#006C54] hover:bg-[#005441] text-white text-sm font-bold py-3 px-4 rounded-full whitespace-nowrap justify-center shadow-xs active:scale-98 inline-flex items-center gap-2"
          >
            <UserCircle2 size={16} /> Sign Up / Log In
          </Link>

          {/* P2P Bets */}
          <Link
            to="/p2p"
            onClick={onNavigate}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 hover:text-[#EEAA04] hover:bg-emerald-50/50 active:bg-emerald-50 active:scale-[0.98] font-bold text-sm transition-all touch-manipulation min-h-[44px]"
          >
            <Swords size={18} className="shrink-0 text-[#006C54]" />
            <span className="truncate">P2P Bets</span>
            <span className="text-[11px] font-bold bg-[#8A6500]/15 text-[#8A6500] border border-[#8A6500]/30 px-2 py-0.5 rounded-full shrink-0 ml-auto">
              Soon
            </span>
          </Link>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-2 px-4 py-3 bg-[#F5F5E4] border border-[#E6E6D2] rounded-2xl">
        <span className="flex items-center gap-2.5 text-sm tabular-nums text-slate-900 min-w-0">
          <Wallet size={16} className="text-[#006C54] shrink-0" />
          <span className="truncate font-bold">Ksh {balance.toLocaleString()}</span>
        </span>
        <Link to="/wallet" onClick={onNavigate} className="bg-[#EEAA04] hover:bg-[#d99903] text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-full shrink-0 whitespace-nowrap active:scale-95 shadow-sm">
          Top Up
        </Link>
      </div>

      {/* ── Settings Section ── */}
      <div className="mt-3 pt-3 border-t border-[#E6E6D2]">
        <p className="flex items-center gap-1.5 px-3 mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          <Settings size={11} />
          Settings
        </p>

        {/* Notification Preferences — always visible */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-[#F5F5E4] transition-all cursor-default min-h-[44px]">
          <Bell size={17} className="shrink-0" />
          <span className="text-sm font-semibold">Notifications</span>
          <span className="ml-auto text-[11px] font-bold uppercase tracking-wide bg-[#EEAA04]/20 text-[#8A6500] px-1.5 py-0.5 rounded-full shrink-0">Soon</span>
        </div>

        {/* Log Out Button at the very bottom below Notifications */}
        {currentUser && (
          <button
            onClick={onLogout}
            className="mt-2 w-full flex items-center justify-center gap-1.5 text-rose-600 text-xs font-bold px-3 py-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 active:scale-98 transition-all cursor-pointer"
          >
            <LogOut size={13} /> Log Out
          </button>
        )}
      </div>
    </div>
  );
}

