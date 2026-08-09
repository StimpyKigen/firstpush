import { Link } from 'react-router-dom';
import { Wallet, Sun, Moon, Menu, X, UserCircle2, ShieldCheck, LogOut } from 'lucide-react';
import { isAdminUser, type Account } from '../../lib/authStore';
import Avatar from '../Avatar';
import WalletDropdownPanel from './WalletDropdownPanel';
import type { NavLinkItem } from './useNavData';

interface MobileHeaderControlsProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  walletOpen: boolean;
  setWalletOpen: (open: boolean) => void;
  balance: number;
  mshindiTokens: number;
  open: boolean;
  setOpen: (open: boolean) => void;
}

/** The compact icon row (wallet, theme, hamburger) that sits inline in the header bar below `lg`. */
export function MobileHeaderControls({
  theme,
  toggleTheme,
  walletOpen,
  setWalletOpen,
  balance,
  mshindiTokens,
  open,
  setOpen,
}: MobileHeaderControlsProps) {
  return (
    <div className="flex lg:hidden items-center gap-1.5 sm:gap-2 shrink-0">
      <div className="relative shrink-0">
        <button
          onClick={() => {
            setWalletOpen(!walletOpen);
            setOpen(false);
          }}
          aria-label="Wallet and Mshindi Tokens"
          title="Wallet & Mshindi Tokens"
          className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition-all ${
            walletOpen
              ? 'bg-gold/20 border-gold text-gold shadow-md'
              : 'bg-panel border-line hover:border-gold/50 text-cream-dim hover:text-gold'
          }`}
        >
          <Wallet size={16} className="text-emerald-2 shrink-0" />
        </button>

        {walletOpen && (
          <WalletDropdownPanel
            balance={balance}
            mshindiTokens={mshindiTokens}
            onClose={() => setWalletOpen(false)}
            backdropClassName="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            panelClassName="fixed top-16 right-3 left-3 xs:left-auto xs:right-4 xs:w-80 sm:absolute sm:right-0 sm:top-full sm:mt-2 bg-panel border border-line rounded-2xl shadow-2xl p-4.5 z-50 animate-rise space-y-3.5"
            headerClassName="flex items-center justify-between pb-2 text-left border-b border-line/60"
          />
        )}
      </div>

      <button
        onClick={toggleTheme}
        aria-label="Toggle light/dark mode"
        className="flex items-center justify-center w-10 h-10 rounded-full bg-panel border border-line text-cream-dim hover:text-gold active:scale-95 transition-all shrink-0 touch-manipulation"
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <button
        className="text-cream shrink-0 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl active:bg-panel transition-colors touch-manipulation"
        onClick={() => setOpen(!open)}
        aria-label="Toggle Menu"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>
    </div>
  );
}

interface MobileMenuPanelProps {
  links: NavLinkItem[];
  pathname: string;
  currentUser: Account | null;
  balance: number;
  onNavigate: () => void;
  onOpenAdminModal: () => void;
  onLogout: () => void;
}

/** The hamburger dropdown panel, rendered below the header bar (not nested inside it). */
export function MobileMenuPanel({
  links,
  currentUser,
  balance,
  onNavigate,
  onOpenAdminModal,
  onLogout,
}: MobileMenuPanelProps) {
  return (
    <div className="lg:hidden border-t border-line bg-ink-2 px-4 py-3 flex flex-col gap-1 max-h-[calc(100vh-4rem)] overflow-y-auto scroll-touch animate-rise">
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          onClick={onNavigate}
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-cream-dim hover:text-cream hover:bg-panel active:bg-panel font-semibold text-sm transition-all touch-manipulation min-h-[44px]"
        >
          <l.icon size={18} className="shrink-0" />
          <span className="truncate">{l.label}</span>
          {l.soon && (
            <span className="text-[9px] font-extrabold uppercase tracking-wide bg-gold/20 text-gold px-1.5 py-0.5 rounded-full shrink-0 ml-auto">Soon</span>
          )}
        </Link>
      ))}

      {currentUser ? (
        <>
          <Link
            to="/profile"
            onClick={onNavigate}
            className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg bg-panel text-cream font-semibold text-sm min-w-0"
          >
            <Avatar name={currentUser.username} seed={currentUser.phone.length} size={24} avatarId={currentUser.avatarId} />
            <span className="truncate">{currentUser.username}</span>
          </Link>
          {isAdminUser(currentUser) && (
            <button
              onClick={() => {
                onNavigate();
                onOpenAdminModal();
              }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gold/15 text-gold border border-gold/40 font-semibold text-sm"
            >
              <ShieldCheck size={16} /> Jackpot Admin Console
            </button>
          )}
          <button onClick={onLogout} className="flex items-center justify-center gap-1.5 text-danger text-xs font-bold px-3 py-2 rounded-lg border border-danger/30">
            <LogOut size={12} /> Log Out
          </button>
        </>
      ) : (
        <Link
          to="/auth"
          onClick={onNavigate}
          className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg bg-panel text-cream font-bold text-sm"
        >
          <UserCircle2 size={16} /> Sign Up / Log In
        </Link>
      )}

      <div className="flex items-center justify-between gap-2 mt-2 px-3 py-2.5 bg-panel rounded-lg">
        <span className="flex items-center gap-2 text-sm font-mono text-cream min-w-0">
          <Wallet size={15} className="text-emerald-2 shrink-0" />
          <span className="truncate">Ksh {balance.toLocaleString()}</span>
        </span>
        <Link to="/wallet" onClick={onNavigate} className="bg-gold text-ink font-bold text-xs px-3 py-1.5 rounded-full shrink-0 whitespace-nowrap">
          Top Up
        </Link>
      </div>
    </div>
  );
}
