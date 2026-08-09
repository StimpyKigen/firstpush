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
      <nav className="hidden lg:flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar">
        {links.map((l) => {
          const active = pathname === l.to;
          const isBuilder = l.to === '/slips';
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`inline-flex items-center gap-1.5 px-3 xl:px-4 h-9 rounded-full text-xs xl:text-sm font-semibold whitespace-nowrap shrink-0 transition-all ${
                active ? 'bg-panel-2 text-gold' : 'text-cream-dim hover:text-cream hover:bg-panel/60'
              }`}
            >
              <l.icon size={15} className="shrink-0" />
              {l.label}
              {isBuilder && builderLegsCount > 0 && (
                <span className="bg-gold text-ink font-extrabold text-[10px] px-1.5 py-0.2 rounded-full ml-1 shrink-0">
                  {builderLegsCount}
                </span>
              )}
              {l.soon && (
                <span className="text-[9px] font-extrabold uppercase tracking-wide bg-gold/20 text-gold px-1.5 py-0.5 rounded-full shrink-0 ml-1">Soon</span>
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
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-panel border border-line hover:border-gold/50 text-cream-dim hover:text-gold transition-colors shrink-0"
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
            className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full border transition-all ${
              walletOpen
                ? 'bg-gold/20 border-gold text-gold shadow-md'
                : 'bg-panel border-line hover:border-gold/50 text-cream-dim hover:text-gold'
            }`}
          >
            <Wallet size={18} className="text-emerald-2 shrink-0" />
            <ChevronDown size={13} className={`shrink-0 transition-transform duration-200 ${walletOpen ? 'rotate-180 text-gold' : 'text-cream-dim'}`} />
          </button>

          {walletOpen && (
            <WalletDropdownPanel
              balance={balance}
              mshindiTokens={mshindiTokens}
              onClose={() => setWalletOpen(false)}
              backdropClassName="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              panelClassName="absolute right-0 top-full mt-2 w-80 bg-panel border border-line rounded-2xl shadow-2xl p-4.5 z-50 animate-rise space-y-3.5"
              headerClassName="flex items-center justify-between pb-2.5 border-b border-line/60"
            />
          )}
        </div>

        {currentUser ? (
          <div className="relative shrink-0">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="inline-flex items-center gap-2 bg-panel border border-line hover:border-emerald-2/50 rounded-full pl-1.5 pr-3.5 h-9 transition-colors max-w-[160px]"
            >
              <Avatar name={currentUser.username} seed={currentUser.phone.length} size={24} avatarId={currentUser.avatarId} />
              <span className="text-sm font-semibold text-cream truncate">{currentUser.username}</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-panel border border-line rounded-xl shadow-xl overflow-hidden animate-rise z-50">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-cream-dim hover:text-cream hover:bg-ink-2 transition-colors"
                >
                  <UserCog size={15} /> My Profile
                </Link>
                {isAdminUser(currentUser) && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenAdminModal();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gold hover:bg-ink-2 transition-colors border-t border-line/60"
                  >
                    <ShieldCheck size={15} /> Jackpot Admin
                  </button>
                )}
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-cream-dim hover:text-danger hover:bg-ink-2 transition-colors border-t border-line"
                >
                  <LogOut size={15} /> Log Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/auth"
            className="inline-flex items-center justify-center gap-1.5 bg-panel-2 hover:bg-line border border-line text-cream font-bold text-sm px-4 h-9 rounded-full whitespace-nowrap transition-colors shrink-0"
          >
            <UserCircle2 size={15} /> Log In
          </Link>
        )}
      </div>
    </>
  );
}
