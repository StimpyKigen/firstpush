import { Link } from 'react-router-dom';
import { Wallet, Sun, Moon, Menu, X, UserCircle2, ShieldCheck, LogOut, Settings, UserCog, Bell } from 'lucide-react';
import { isAdminUser, type Account } from '../../lib/authStore';
import Avatar from '../Avatar';
import WalletDropdownPanel from './WalletDropdownPanel';
import type { NavLinkItem } from './useNavData';

interface MobileHeaderControlsProps {
  walletOpen: boolean;
  setWalletOpen: (open: boolean) => void;
  balance: number;
  mshindiTokens: number;
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** The compact icon row (wallet + hamburger) that sits inline in the header bar below `lg`. */
export function MobileHeaderControls({
  walletOpen,
  setWalletOpen,
  balance,
  mshindiTokens,
  open,
  setOpen,
}: MobileHeaderControlsProps) {
  return (
    <div className="flex lg:hidden items-center gap-2 shrink-0">
      <div className="relative shrink-0">
        <button
          onClick={() => {
            setWalletOpen(!walletOpen);
            setOpen(false);
          }}
          aria-label="Wallet and Mshindi Tokens"
          title="Wallet & Mshindi Tokens"
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border transition-all active:scale-95 ${
            walletOpen
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-[#006C54] text-[#006C54] dark:text-emerald-400 shadow-xs'
              : 'bg-[#F5F5E4] dark:bg-[#182622] hover:bg-[#E6E6D2] dark:hover:bg-[#22352f] border-[#E6E6D2] dark:border-[#2e453c] text-slate-800 dark:text-[#f0f4f1]'
          }`}
        >
          <Wallet size={15} className="text-[#006C54] dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-bold font-mono text-slate-900 dark:text-[#f0f4f1]">Ksh {balance.toLocaleString()}</span>
        </button>

        {walletOpen && (
          <WalletDropdownPanel
            balance={balance}
            mshindiTokens={mshindiTokens}
            onClose={() => setWalletOpen(false)}
            backdropClassName="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
            panelClassName="fixed top-16 right-3 left-3 xs:left-auto xs:right-4 xs:w-84 sm:absolute sm:right-0 sm:top-full sm:mt-2 bg-[#FFFFF0] dark:bg-[#131f1b] border border-[#E6E6D2] dark:border-[#2e453c] rounded-2xl shadow-xl p-4.5 z-50 animate-rise space-y-3.5"
            headerClassName="flex items-center justify-between pb-2 text-left border-b border-[#E6E6D2] dark:border-[#2e453c]"
          />
        )}
      </div>

      <button
        className="text-slate-800 dark:text-[#f0f4f1] shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F5E4] dark:bg-[#182622] hover:bg-[#E6E6D2] dark:hover:bg-[#22352f] border border-[#E6E6D2] dark:border-[#2e453c] active:scale-95 transition-all touch-manipulation cursor-pointer"
        onClick={() => setOpen(!open)}
        aria-label="Toggle Menu"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>
    </div>
  );
}

interface MobileMenuPanelProps {
  links: NavLinkItem[];
  pathname: string;
  currentUser: Account | null;
  balance: number;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  onNavigate: () => void;
  onOpenAdminModal: () => void;
  onLogout: () => void;
}

/** The hamburger dropdown panel, rendered below the header bar (not nested inside it). */
export function MobileMenuPanel({
  links,
  currentUser,
  balance,
  theme,
  toggleTheme,
  onNavigate,
  onOpenAdminModal,
  onLogout,
}: MobileMenuPanelProps) {
  return (
    <div className="lg:hidden border-b border-[#E6E6D2]/80 dark:border-[#243831] mobile-nav-glass px-4 py-4 flex flex-col gap-1.5 max-h-[calc(100dvh-4.5rem)] overflow-y-auto scroll-touch animate-rise shadow-xl">
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          onClick={onNavigate}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 dark:text-[#d1dbd5] hover:text-[#EEAA04] dark:hover:text-[#EEAA04] hover:bg-emerald-50/50 dark:hover:bg-[#182622] active:bg-emerald-50 dark:active:bg-[#182622] active:scale-[0.98] font-bold text-sm transition-all touch-manipulation min-h-[44px]"
        >
          <l.icon size={18} className="shrink-0 text-[#006C54] dark:text-[#EEAA04]" />
          <span className="truncate">{l.label}</span>
          {l.soon && (
            <span className="text-[9px] font-bold bg-[#8A6500]/15 dark:bg-[#EEAA04]/20 text-[#8A6500] dark:text-[#EEAA04] border border-[#8A6500]/30 px-2 py-0.5 rounded-full shrink-0 ml-auto">
              Soon
            </span>
          )}
        </Link>
      ))}

      {currentUser ? (
        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-[#E6E6D2] dark:border-[#2e453c]">
          <Link
            to="/profile"
            onClick={onNavigate}
            className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-[#F5F5E4] dark:bg-[#182622] border border-[#E6E6D2] dark:border-[#2e453c] text-slate-800 dark:text-[#f0f4f1] font-bold text-sm min-w-0 active:scale-[0.98] transition-all"
          >
            <Avatar name={currentUser.username} seed={currentUser.phone.length} size={28} avatarId={currentUser.avatarId} />
            <span className="truncate flex-1">{currentUser.username}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">View Profile &rarr;</span>
          </Link>
          {isAdminUser(currentUser) && (
            <button
              onClick={() => {
                onNavigate();
                onOpenAdminModal();
              }}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-[#006C54] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 font-bold text-xs active:scale-98 transition-all"
            >
              <ShieldCheck size={15} /> Jackpot Admin Console
            </button>
          )}
          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-bold px-3 py-2.5 rounded-full border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-98 transition-all"
          >
            <LogOut size={13} /> Log Out
          </button>
        </div>
      ) : (
        <Link
          to="/auth"
          onClick={onNavigate}
          className="bg-[#006C54] hover:bg-[#005441] text-white text-sm font-bold py-3 px-4 mt-2 rounded-full whitespace-nowrap justify-center shadow-xs active:scale-98 inline-flex items-center gap-2"
        >
          <UserCircle2 size={16} /> Sign Up / Log In
        </Link>
      )}

      <div className="flex items-center justify-between gap-3 mt-2 px-4 py-3 bg-[#F5F5E4] dark:bg-[#182622] border border-[#E6E6D2] dark:border-[#2e453c] rounded-2xl">
        <span className="flex items-center gap-2.5 text-sm font-mono text-slate-900 dark:text-[#f0f4f1] min-w-0">
          <Wallet size={16} className="text-[#006C54] dark:text-emerald-400 shrink-0" />
          <span className="truncate font-bold">Ksh {balance.toLocaleString()}</span>
        </span>
        <Link to="/wallet" onClick={onNavigate} className="bg-[#EEAA04] hover:bg-[#d99903] text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-full shrink-0 whitespace-nowrap active:scale-95 shadow-sm">
          Top Up
        </Link>
      </div>

      {/* ── Settings Section ── */}
      <div className="mt-3 pt-3 border-t border-line/40 dark:border-[#2e453c]">
        <p className="flex items-center gap-1.5 px-3 mb-1 text-[10px] font-extrabold uppercase tracking-widest text-cream-dim/60">
          <Settings size={11} />
          Settings
        </p>

        {/* Theme toggle */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl hover:bg-panel transition-all min-h-[44px]">
          <span className="flex items-center gap-2.5 text-sm font-semibold text-cream-dim">
            {theme === 'dark' ? <Moon size={17} className="shrink-0 text-[#EEAA04]" /> : <Sun size={17} className="shrink-0 text-slate-700" />}
            {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </span>
          <button
            onClick={toggleTheme}
            aria-label="Toggle light/dark mode"
            className={`relative inline-flex w-11 h-6 rounded-full border transition-all shrink-0 touch-manipulation cursor-pointer ${
              theme === 'dark'
                ? 'bg-[#EEAA04] border-[#d99903]'
                : 'bg-panel-2 border-line'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full shadow transition-all ${
                theme === 'dark'
                  ? 'left-[22px] bg-[#0a120f]'
                  : 'left-0.5 bg-cream-dim'
              }`}
            />
          </button>
        </div>

        {/* Profile Settings — only when logged in */}
        {currentUser && (
          <Link
            to="/profile"
            onClick={onNavigate}
            className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-cream-dim hover:text-cream hover:bg-panel active:bg-panel font-semibold text-sm transition-all touch-manipulation min-h-[44px]"
          >
            <UserCog size={17} className="shrink-0" />
            <span>Edit Profile</span>
          </Link>
        )}

        {/* Notification Preferences — always visible */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-cream-dim hover:text-cream hover:bg-panel transition-all cursor-default min-h-[44px]">
          <Bell size={17} className="shrink-0" />
          <span className="text-sm font-semibold">Notifications</span>
          <span className="ml-auto text-[9px] font-extrabold uppercase tracking-wide bg-gold/20 text-gold px-1.5 py-0.5 rounded-full shrink-0">Soon</span>
        </div>
      </div>
    </div>
  );
}
