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
      {/* Desktop nav links: with ESPN signature red active indicator */}
      <nav className="hidden lg:flex items-center gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar h-16">
        {links.map((l) => {
          const active = pathname === l.to;
          const isBuilder = l.to === '/slips';
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`relative h-16 inline-flex items-center gap-1.5 px-3.5 xl:px-4 text-xs xl:text-sm font-bold whitespace-nowrap shrink-0 transition-all ${
                active
                  ? 'text-[#d81e1e] border-b-2 border-[#d81e1e]'
                  : 'text-slate-600 hover:text-[#d81e1e]'
              }`}
            >
              <l.icon size={15} className={`shrink-0 ${active ? 'text-[#d81e1e]' : 'text-slate-400'}`} />
              <span>{l.label}</span>
              {isBuilder && builderLegsCount > 0 && (
                <span className="bg-[#d81e1e] text-white font-black text-[10px] px-1.5 py-0.2 rounded-full ml-1 shrink-0 shadow-xs">
                  {builderLegsCount}
                </span>
              )}
              {l.soon && (
                <span className="text-[9px] font-black uppercase tracking-wide bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full shrink-0 ml-1 border border-amber-200">Soon</span>
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
          className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 active:scale-95 transition-all shrink-0"
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
            className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full border transition-all active:scale-95 ${
              walletOpen
                ? 'bg-red-50 border-[#d81e1e] text-[#d81e1e] shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
            }`}
          >
            <Wallet size={15} className="text-[#059669] shrink-0" />
            <span className="text-xs font-bold font-mono text-slate-900">Ksh {balance.toLocaleString()}</span>
            <ChevronDown size={13} className={`shrink-0 transition-transform duration-200 ${walletOpen ? 'rotate-180 text-[#d81e1e]' : 'text-slate-400'}`} />
          </button>

          {walletOpen && (
            <WalletDropdownPanel
              balance={balance}
              mshindiTokens={mshindiTokens}
              onClose={() => setWalletOpen(false)}
              backdropClassName="fixed inset-0 z-40 bg-black/25 backdrop-blur-xs"
              panelClassName="absolute right-0 top-full mt-2 w-84 bg-white border border-slate-200 rounded-2xl shadow-xl p-4.5 z-50 animate-rise space-y-3.5"
              headerClassName="flex items-center justify-between pb-2.5 border-b border-slate-100"
            />
          )}
        </div>

        {currentUser ? (
          <div className="relative shrink-0">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full pl-1.5 pr-3 h-9 active:scale-95 transition-all max-w-[170px]"
            >
              <Avatar name={currentUser.username} seed={currentUser.phone.length} size={24} avatarId={currentUser.avatarId} />
              <span className="text-xs font-bold text-slate-800 truncate">{currentUser.username}</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 overflow-hidden animate-rise z-50">
                <Link
                  to="/profile"
                  onClick={() => setProfileOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <UserCog size={15} /> My Profile
                </Link>
                {isAdminUser(currentUser) && (
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenAdminModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#d81e1e] hover:bg-red-50 transition-colors"
                  >
                    <ShieldCheck size={15} /> Jackpot Admin
                  </button>
                )}
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#d81e1e] hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} /> Log Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/auth"
            className="bg-[#d81e1e] hover:bg-[#b91515] text-white text-xs font-bold px-4 h-9 rounded-full inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap shrink-0 active:scale-95 transition-all"
          >
            <UserCircle2 size={15} /> Log In
          </Link>
        )}
      </div>
    </>
  );
}
