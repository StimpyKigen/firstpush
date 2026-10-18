import { Link } from 'react-router-dom';
import { UserCircle2, UserCog, ShieldCheck, LogOut } from 'lucide-react';
import { isAdminUser, type Account } from '../../lib/authStore';
import Avatar from '../Avatar';
import type { NavLinkItem } from './useNavData';

interface DesktopNavProps {
  links: NavLinkItem[];
  pathname: string;
  builderLegsCount: number;
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  currentUser: Account | null;
  onOpenAdminModal: () => void;
  onLogout: () => void;
}

export default function DesktopNav({
  links,
  pathname,
  builderLegsCount,
  profileOpen,
  setProfileOpen,
  currentUser,
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
                  : 'text-[#1c1e21] font-bold hover:text-[#EEAA04]'
              }`}
            >
              <l.icon
                size={14}
                className={`shrink-0 hidden xl:block transition-colors ${
                  active ? 'text-[#EEAA04]' : 'text-[#5d6c7b] group-hover:text-[#EEAA04]'
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

      {/* Desktop right-side controls: profile */}
      <div className="hidden lg:flex items-center gap-2 xl:gap-2.5 shrink-0 ml-1 sm:ml-2 xl:ml-4 z-10">
        {currentUser ? (
          <div className="relative shrink-0">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="inline-flex items-center gap-2 bg-[#F5F5E4] hover:bg-[#E6E6D2] border border-[#E6E6D2] rounded-full pl-1.5 pr-1.5 xl:pr-3 h-9 active:scale-95 transition-all max-w-[170px]"
            >
              <Avatar name={currentUser.username} seed={currentUser.phone.length} size={24} avatarId={currentUser.avatarId} />
              <span className="hidden xl:inline text-xs font-bold text-slate-800 truncate">
                {currentUser.username}
              </span>
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
            className="bg-black hover:bg-[#444950] text-white border border-transparent text-xs xl:text-sm font-bold px-4 xl:px-5 h-9 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95 transition-colors"
          >
            <UserCircle2 size={15} /> Log In
          </Link>
        )}
      </div>
    </>
  );
}

