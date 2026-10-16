import { Link } from 'react-router-dom';
import { Wallet, Sun, Moon, ChevronDown, UserCircle2, UserCog, ShieldCheck, LogOut, Search } from 'lucide-react';
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
      {/* Meta button-pill-tab / button-pill-tab-active category navigation */}
      <nav className="hidden lg:flex items-center justify-center gap-0.5 xl:gap-1.5 min-w-0 flex-1 h-16">
        {links.map((l) => {
          const active = pathname === l.to;
          const isBuilder = l.to === '/slips';
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`group inline-flex items-center gap-1.5 px-2 xl:px-3.5 py-2 text-[13px] xl:text-sm font-bold whitespace-nowrap shrink-0 rounded-full border transition-colors ${
                active
                  ? 'bg-[#0a1317] text-white border-[#0a1317]'
                  : 'bg-transparent text-[#1c1e21] border-transparent active:bg-[#0a1317] active:text-white active:border-[#0a1317]'
              }`}
            >
              <l.icon size={15} className={`shrink-0 hidden xl:block ${active ? 'text-[#FFD700]' : 'text-[#5d6c7b] group-active:text-[#FFD700]'}`} />
              <span>{l.label}</span>
              {isBuilder && builderLegsCount > 0 && (
                <span className="bg-[#006C54] text-[#FFD700] font-bold text-[11px] px-2 rounded-full ml-0.5 shrink-0">
                  {builderLegsCount}
                </span>
              )}
              {l.soon && (
                <span className="text-[10px] xl:text-[11px] font-bold bg-[#8A6500] text-[#FFFFF0] px-1.5 xl:px-2 py-0.5 rounded-full shrink-0 ml-0.5">Soon</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Desktop right-side controls: search, theme, wallet, profile */}
      <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
        <Link
          to="/free"
          aria-label="Search fixtures and jackpots"
          title="Search fixtures & jackpots"
          className="hidden xl:inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#F5F5E4] hover:bg-[#E6E6D2] text-[#5d6c7b] active:scale-95 transition-colors shrink-0"
        >
          <Search size={17} />
        </Link>

        {/* Integrated Wallet & Mshindi Tokens Dropdown */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setWalletOpen(!walletOpen);
              setProfileOpen(false);
            }}
            aria-label="Wallet & Mshindi Tokens"
            title="Wallet & Mshindi Tokens"
            className={`inline-flex items-center gap-1.5 xl:gap-2 h-9 px-2.5 xl:px-3.5 rounded-full border transition-all active:scale-95 ${
              walletOpen
                ? 'bg-emerald-50 border-[#006C54] text-[#006C54] shadow-xs'
                : 'bg-[#F5F5E4] hover:bg-[#E6E6D2] border-[#E6E6D2] text-slate-700 hover:text-slate-900'
            }`}
          >
            <Wallet size={15} className="text-[#006C54] shrink-0" />
            <span className="text-xs font-bold font-mono text-slate-900">Ksh {balance.toLocaleString()}</span>
            <ChevronDown size={13} className={`hidden xl:block shrink-0 transition-transform duration-200 ${walletOpen ? 'rotate-180 text-[#006C54]' : 'text-slate-400'}`} />
          </button>

          {walletOpen && (
            <WalletDropdownPanel
              balance={balance}
              mshindiTokens={mshindiTokens}
              onClose={() => setWalletOpen(false)}
              backdropClassName="fixed inset-0 z-40 bg-black/25 backdrop-blur-xs"
              panelClassName="absolute right-0 top-full mt-2 w-84 bg-[#FFFFF0] border border-[#E6E6D2] rounded-2xl shadow-xl p-4.5 z-50 animate-rise space-y-3.5"
              headerClassName="flex items-center justify-between pb-2.5 border-b border-[#E6E6D2]"
            />
          )}
        </div>

        {currentUser ? (
          <div className="relative shrink-0">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="inline-flex items-center gap-2 bg-[#F5F5E4] hover:bg-[#E6E6D2] border border-[#E6E6D2] rounded-full pl-1.5 pr-1.5 xl:pr-3 h-9 active:scale-95 transition-all max-w-[170px]"
            >
              <Avatar name={currentUser.username} seed={currentUser.phone.length} size={24} avatarId={currentUser.avatarId} />
              <span className="hidden xl:inline text-xs font-bold text-slate-800 truncate">{currentUser.username}</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#FFFFF0] border border-[#E6E6D2] rounded-2xl shadow-xl p-1.5 overflow-hidden animate-rise z-50">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-[#F5F5E4] transition-colors"
                >
                  <UserCog size={15} /> My Profile
                </Link>
                {isAdminUser(currentUser) && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenAdminModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#006C54] hover:bg-emerald-50 transition-colors"
                  >
                    <ShieldCheck size={15} /> Jackpot Admin
                  </button>
                )}
                <div className="my-1 border-t border-[#E6E6D2]" />
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut size={15} /> Log Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/auth"
            className="bg-black hover:bg-[#444950] text-white text-sm font-bold px-6 h-10 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95 transition-colors"
          >
            <UserCircle2 size={15} /> Log In
          </Link>
        )}
      </div>
    </>
  );
}
