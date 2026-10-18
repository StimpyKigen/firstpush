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
      {/* Desktop navigation: golden accent text on active item without black pill */}
      <nav className="hidden lg:flex items-center justify-center gap-1 xl:gap-2 min-w-0 flex-1 px-1 xl:px-2">
        {links.map((l) => {
          const active = pathname === l.to;
          const isBuilder = l.to === '/slips';
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`group inline-flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 text-xs xl:text-[13px] whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'text-[#EEAA04] font-extrabold'
                  : 'text-[#1c1e21] dark:text-[#d1dbd5] font-bold hover:text-[#EEAA04] dark:hover:text-[#EEAA04]'
              }`}
            >
              <l.icon
                size={14}
                className={`shrink-0 hidden xl:block transition-colors ${
                  active ? 'text-[#EEAA04]' : 'text-[#5d6c7b] dark:text-[#8ba296] group-hover:text-[#EEAA04]'
                }`}
              />
              <span className="transition-colors">{l.label}</span>
              {isBuilder && builderLegsCount > 0 && (
                <span className="bg-[#006C54] text-[#EEAA04] font-bold text-[10px] xl:text-[11px] px-1.5 xl:px-2 rounded-full ml-0.5 shrink-0">
                  {builderLegsCount}
                </span>
              )}
              {l.soon && (
                <span className="text-[10px] xl:text-[11px] font-bold bg-[#EEAA04] text-[#0a1317] px-1.5 xl:px-2 py-0.5 rounded-full shrink-0 ml-0.5">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Desktop right-side controls: theme toggle, wallet, profile */}
      <div className="hidden lg:flex items-center gap-2 xl:gap-2.5 shrink-0 ml-1 sm:ml-2 xl:ml-4 z-10">
        {/* Sleek Sun/Moon Theme Toggle replacing the old search button */}
        <button
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#F5F5E4] dark:bg-[#182622] hover:bg-[#E6E6D2] dark:hover:bg-[#22352f] border border-[#E6E6D2] dark:border-[#2e453c] text-slate-700 dark:text-amber-300 active:scale-95 transition-all shrink-0 cursor-pointer shadow-2xs"
        >
          {theme === 'dark' ? (
            <Sun size={16} className="text-[#EEAA04] transition-transform duration-300 rotate-0 hover:rotate-45" />
          ) : (
            <Moon size={16} className="text-slate-700 transition-transform duration-300 -rotate-12 hover:rotate-0" />
          )}
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
            className={`inline-flex items-center gap-1.5 xl:gap-2 h-9 px-2.5 xl:px-3 rounded-full border transition-all active:scale-95 ${
              walletOpen
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-[#006C54] text-[#006C54] dark:text-emerald-400 shadow-xs'
                : 'bg-[#F5F5E4] dark:bg-[#182622] hover:bg-[#E6E6D2] dark:hover:bg-[#22352f] border-[#E6E6D2] dark:border-[#2e453c] text-slate-700 dark:text-[#d1dbd5] hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wallet size={15} className="text-[#006C54] dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-bold font-mono text-slate-900 dark:text-[#f0f4f1]">
              Ksh {balance.toLocaleString()}
            </span>
            <ChevronDown
              size={13}
              className={`hidden xl:block shrink-0 transition-transform duration-200 ${
                walletOpen ? 'rotate-180 text-[#006C54]' : 'text-slate-400 dark:text-slate-500'
              }`}
            />
          </button>

          {walletOpen && (
            <WalletDropdownPanel
              balance={balance}
              mshindiTokens={mshindiTokens}
              onClose={() => setWalletOpen(false)}
              backdropClassName="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
              panelClassName="absolute right-0 top-full mt-2 w-84 bg-[#FFFFF0] dark:bg-[#131f1b] border border-[#E6E6D2] dark:border-[#2e453c] rounded-2xl shadow-xl p-4.5 z-50 animate-rise space-y-3.5"
              headerClassName="flex items-center justify-between pb-2.5 border-b border-[#E6E6D2] dark:border-[#2e453c]"
            />
          )}
        </div>

        {currentUser ? (
          <div className="relative shrink-0">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="inline-flex items-center gap-2 bg-[#F5F5E4] dark:bg-[#182622] hover:bg-[#E6E6D2] dark:hover:bg-[#22352f] border border-[#E6E6D2] dark:border-[#2e453c] rounded-full pl-1.5 pr-1.5 xl:pr-3 h-9 active:scale-95 transition-all max-w-[170px]"
            >
              <Avatar name={currentUser.username} seed={currentUser.phone.length} size={24} avatarId={currentUser.avatarId} />
              <span className="hidden xl:inline text-xs font-bold text-slate-800 dark:text-[#f0f4f1] truncate">
                {currentUser.username}
              </span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#FFFFF0] dark:bg-[#131f1b] border border-[#E6E6D2] dark:border-[#2e453c] rounded-2xl shadow-xl p-1.5 overflow-hidden animate-rise z-50">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-[#d1dbd5] hover:text-slate-900 dark:hover:text-white hover:bg-[#F5F5E4] dark:hover:bg-[#182622] transition-colors"
                >
                  <UserCog size={15} /> My Profile
                </Link>
                {isAdminUser(currentUser) && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenAdminModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#006C54] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                  >
                    <ShieldCheck size={15} /> Jackpot Admin
                  </button>
                )}
                <div className="my-1 border-t border-[#E6E6D2] dark:border-[#2e453c]" />
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <LogOut size={15} /> Log Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/auth"
            className="bg-black dark:bg-[#182622] hover:bg-[#444950] dark:hover:bg-[#22352f] text-white dark:text-[#f0f4f1] border border-transparent dark:border-[#2e453c] text-xs xl:text-sm font-bold px-4 xl:px-5 h-9 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95 transition-colors"
          >
            <UserCircle2 size={15} /> Log In
          </Link>
        )}
      </div>
    </>
  );
}
