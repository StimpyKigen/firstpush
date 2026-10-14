import { Link } from 'react-router-dom';
import { Wallet, Sun, Moon, ChevronDown, UserCircle2, UserCog, ShieldCheck, LogOut } from 'lucide-react';
import { isAdminUser, type Account } from '../../lib/authStore';
import Avatar from '../Avatar';
import WalletDropdownPanel from './WalletDropdownPanel';
import type { NavLinkItem } from './useNavData';

interface DesktopNavProps {
  links: NavLinkItem[];
  pathname: string;
  builderLegsCount: number;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  walletOpen: boolean;
  setWalletOpen: (open: boolean) => void;
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  currentUser: Account | null;
  balance: number;
  mshindiTokens: number;
  onOpenAdminModal: () => void;
  onLogout: () => void;
}

export default function DesktopNav({
  links,
  pathname,
  builderLegsCount,
  theme,
  toggleTheme,
  walletOpen,
  setWalletOpen,
  profileOpen,
  setProfileOpen,
  currentUser,
  balance,
  mshindiTokens,
  onOpenAdminModal,
  onLogout,
}: DesktopNavProps) {
  return (
    <>
      {/* Desktop nav links: only shown once there's room for the whole bar (lg+). */}
      <nav className="hidden lg:flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto no-scrollbar py-1">
        {links.map((l) => {
          const active = pathname === l.to;
          const isBuilder = l.to === '/slips';
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`inline-flex items-center gap-1.5 px-3.5 xl:px-4 h-9 rounded-full text-xs xl:text-sm font-semibold whitespace-nowrap shrink-0 transition-all ${
                active
                  ? 'bg-white/12 dark:bg-white/12 light:bg-black/8 text-gold font-bold shadow-sm backdrop-blur-sm'
                  : 'text-cream-dim hover:text-cream hover:bg-white/6 dark:hover:bg-white/6 light:hover:bg-black/5'
              }`}
            >
              <l.icon size={15} className="shrink-0" />
              {l.label}
              {isBuilder && builderLegsCount > 0 && (
                <span className="bg-gold text-ink font-black text-[10px] px-1.5 py-0.2 rounded-full ml-1 shrink-0 shadow-sm">
                  {builderLegsCount}
                </span>
              )}
              {l.soon && (
                <span className="text-[9px] font-extrabold uppercase tracking-wide bg-gold/15 text-gold px-2 py-0.5 rounded-full shrink-0 ml-1 border border-gold/30">Soon</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Desktop right-side controls: same lg+ breakpoint as nav links */}
      <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
        <button
          onClick={toggleTheme}
          aria-label="Toggle light/dark mode"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/6 hover:bg-white/12 border border-white/10 dark:border-white/10 light:border-black/10 text-cream-dim hover:text-gold active:scale-95 transition-all shrink-0"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Integrated Wallet & Mshindi Tokens Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setWalletOpen(!walletOpen);
              setProfileOpen(false);
            }}
            aria-label="Wallet & Mshindi Tokens"
            title="Wallet & Mshindi Tokens"
            className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full border transition-all active:scale-95 ${
              walletOpen
                ? 'bg-gold/20 border-gold text-gold shadow-md'
                : 'bg-white/6 hover:bg-white/12 border-white/10 dark:border-white/10 light:border-black/10 text-cream-dim hover:text-gold'
            }`}
          >
            <Wallet size={16} className="text-emerald-2 shrink-0" />
            <span className="text-xs font-bold text-cream">Ksh {balance.toLocaleString()}</span>
            <ChevronDown size={13} className={`shrink-0 transition-transform duration-200 ${walletOpen ? 'rotate-180 text-gold' : 'text-cream-dim'}`} />
          </button>

          {walletOpen && (
            <WalletDropdownPanel
              balance={balance}
              mshindiTokens={mshindiTokens}
              onClose={() => setWalletOpen(false)}
              backdropClassName="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              panelClassName="absolute right-0 top-full mt-2 w-84 ios-dropdown p-4.5 z-50 animate-rise space-y-3.5"
              headerClassName="flex items-center justify-between pb-2.5 border-b border-line/60"
            />
          )}
        </div>

        {currentUser ? (
          <div className="relative shrink-0">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="inline-flex items-center gap-2 bg-white/6 hover:bg-white/12 border border-white/10 dark:border-white/10 light:border-black/10 rounded-full pl-1.5 pr-3 h-9 active:scale-95 transition-all max-w-[170px]"
            >
              <Avatar name={currentUser.username} seed={currentUser.phone.length} size={24} avatarId={currentUser.avatarId} />
              <span className="text-xs font-semibold text-cream truncate">{currentUser.username}</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 ios-dropdown p-1.5 overflow-hidden animate-rise z-50">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-cream-dim hover:text-cream hover:bg-white/10 transition-colors"
                >
                  <UserCog size={15} /> My Profile
                </Link>
                {isAdminUser(currentUser) && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenAdminModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-gold hover:bg-white/10 transition-colors"
                  >
                    <ShieldCheck size={15} /> Jackpot Admin
                  </button>
                )}
                <div className="my-1 border-t border-line/60" />
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-danger hover:bg-danger/10 transition-colors"
                >
                  <LogOut size={15} /> Log Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/auth"
            className="ios-pill-btn bg-gold hover:bg-gold-2 text-ink text-xs px-4 h-9 whitespace-nowrap shrink-0 shadow-sm"
          >
            <UserCircle2 size={15} /> Log In
          </Link>
        )}
      </div>
    </>
  );
}
