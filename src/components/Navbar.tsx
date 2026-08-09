import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Wallet, Trophy, Home, TrendingUp, Menu, X, Unlock, UserCircle2, LogOut, UserCog, Swords, Sun, Moon, Search, ShieldCheck, User, Coins, ChevronDown, ArrowUpRight, Dices } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWallet } from '../lib/store';
import { useAuth, isAdminUser, useCurrentUser } from '../lib/authStore';
import { useTheme } from '../lib/themeStore';
import { useBetSlipStore } from '../lib/betSlipStore';
import Avatar from './Avatar';
import JackpotAdminModal from './JackpotAdminModal';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const balance = useWallet((s) => s.balance);
  const mshindiTokens = useWallet((s) => s.mshindiTokens);
  const currentUser = useCurrentUser();
  const logOut = useAuth((s) => s.logOut);
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggleTheme);
  const builderLegsCount = useBetSlipStore((s) => s.builderLegs.length);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  // Close menus on route change
  useEffect(() => {
    setOpen(false);
    setProfileOpen(false);
    setWalletOpen(false);
  }, [location.pathname]);

  const links = [
    { to: '/', label: 'Jackpots', icon: Home },
    { to: '/free', label: 'Free Matches', icon: Unlock },
    { to: '/slips', label: 'Bet Builder', icon: Dices },
    { to: '/p2p', label: 'P2P Bets', icon: Swords, soon: true },
    { to: '/leaderboard', label: 'Leaderboards', icon: Trophy },
  ];

  function handleLogout() {
    logOut();
    setProfileOpen(false);
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-ink/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2 h-16">
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <span className="font-display font-extrabold text-lg xl:text-xl tracking-tight text-cream whitespace-nowrap">
            Mshindi<span className="text-gold">Room</span>
          </span>
        </Link>

        {/* Desktop nav links: only shown once there's room for the whole bar (lg+). */}
        <nav className="hidden lg:flex items-center gap-1 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          {links.map((l) => {
            const active = location.pathname === l.to;
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
              <>
                <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={() => setWalletOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-panel border border-line rounded-2xl shadow-2xl p-4.5 z-50 animate-rise space-y-3.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-line/60">
                    <span className="text-xs font-bold text-cream uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet size={15} className="text-emerald-2" /> Wallet &amp; Rewards
                    </span>
                    <button
                      onClick={() => setWalletOpen(false)}
                      className="text-cream-dim hover:text-cream text-xs font-bold p-1 rounded-lg hover:bg-line/50 transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Cash Balance */}
                  <div className="bg-ink/80 border border-line/80 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-cream-dim font-bold uppercase tracking-wide">M-Pesa Cash Balance</span>
                      <p className="font-display font-extrabold text-xl text-emerald-2">Ksh {balance.toLocaleString()}</p>
                    </div>
                    <Link
                      to="/wallet"
                      onClick={() => setWalletOpen(false)}
                      className="bg-emerald-2/15 hover:bg-emerald-2/25 text-emerald-2 border border-emerald-2/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
                    >
                      Top Up
                    </Link>
                  </div>

                  {/* Tokens */}
                  <div className="bg-ink/80 border border-line/80 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-gold font-bold uppercase tracking-wide flex items-center gap-1">
                        <Coins size={12} /> Mshindi Tokens
                      </span>
                      <p className="font-display font-extrabold text-xl text-gold">{mshindiTokens} <span className="text-xs font-normal text-cream-dim">MT</span></p>
                    </div>
                    <Link
                      to="/wallet"
                      onClick={() => setWalletOpen(false)}
                      className="bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
                    >
                      Earn / Redeem
                    </Link>
                  </div>

                  <Link
                    to="/wallet"
                    onClick={() => setWalletOpen(false)}
                    className="w-full inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 text-ink font-bold text-xs py-2.5 rounded-xl transition-all shadow-md"
                  >
                    <span>Open Full Wallet &amp; Top Up</span>
                    <ArrowUpRight size={14} />
                  </Link>

                  <p className="text-[10px] text-cream-dim text-center leading-tight">
                    ⚡ Earn +4 MT cashback on every 100 Ksh top up &amp; referral invite!
                  </p>
                </div>
              </>
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
                        setAdminModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gold hover:bg-ink-2 transition-colors border-t border-line/60"
                    >
                      <ShieldCheck size={15} /> Jackpot Admin
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
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

        {/* Mobile / tablet: compact wallet + controls + hamburger */}
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
              <>
                <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={() => setWalletOpen(false)} />
                <div className="fixed top-16 right-3 left-3 xs:left-auto xs:right-4 xs:w-80 sm:absolute sm:right-0 sm:top-full sm:mt-2 bg-panel border border-line rounded-2xl shadow-2xl p-4.5 z-50 animate-rise space-y-3.5">
                  <div className="flex items-center justify-between pb-2 text-left border-b border-line/60">
                    <span className="text-xs font-bold text-cream uppercase tracking-wider flex items-center gap-1.5">
                      <Wallet size={15} className="text-emerald-2" /> Wallet &amp; Rewards
                    </span>
                    <button
                      onClick={() => setWalletOpen(false)}
                      className="text-cream-dim hover:text-cream text-xs font-bold p-1 rounded-lg hover:bg-line/50 transition-colors"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Cash Balance */}
                  <div className="bg-ink/80 border border-line/80 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-cream-dim font-bold uppercase tracking-wide">M-Pesa Cash Balance</span>
                      <p className="font-display font-extrabold text-xl text-emerald-2">Ksh {balance.toLocaleString()}</p>
                    </div>
                    <Link
                      to="/wallet"
                      onClick={() => setWalletOpen(false)}
                      className="bg-emerald-2/15 hover:bg-emerald-2/25 text-emerald-2 border border-emerald-2/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
                    >
                      Top Up
                    </Link>
                  </div>

                  {/* Tokens */}
                  <div className="bg-ink/80 border border-line/80 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-gold font-bold uppercase tracking-wide flex items-center gap-1">
                        <Coins size={12} /> Mshindi Tokens
                      </span>
                      <p className="font-display font-extrabold text-xl text-gold">{mshindiTokens} <span className="text-xs font-normal text-cream-dim">MT</span></p>
                    </div>
                    <Link
                      to="/wallet"
                      onClick={() => setWalletOpen(false)}
                      className="bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
                    >
                      Earn / Redeem
                    </Link>
                  </div>

                  <Link
                    to="/wallet"
                    onClick={() => setWalletOpen(false)}
                    className="w-full inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 text-ink font-bold text-xs py-2.5 rounded-xl transition-all shadow-md"
                  >
                    <span>Open Full Wallet &amp; Top Up</span>
                    <ArrowUpRight size={14} />
                  </Link>

                  <p className="text-[10px] text-cream-dim text-center leading-tight">
                    ⚡ Earn +4 MT cashback on every 100 Ksh top up &amp; referral invite!
                  </p>
                </div>
              </>
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
      </div>

      {open && (
        <div className="lg:hidden border-t border-line bg-ink-2 px-4 py-3 flex flex-col gap-1 max-h-[calc(100vh-4rem)] overflow-y-auto scroll-touch animate-rise">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
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
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg bg-panel text-cream font-semibold text-sm min-w-0"
              >
                <Avatar name={currentUser.username} seed={currentUser.phone.length} size={24} avatarId={currentUser.avatarId} />
                <span className="truncate">{currentUser.username}</span>
              </Link>
              {isAdminUser(currentUser) && (
                <button
                  onClick={() => {
                    setOpen(false);
                    setAdminModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gold/15 text-gold border border-gold/40 font-semibold text-sm"
                >
                  <ShieldCheck size={16} /> Jackpot Admin Console
                </button>
              )}
              <button onClick={handleLogout} className="flex items-center justify-center gap-1.5 text-danger text-xs font-bold px-3 py-2 rounded-lg border border-danger/30">
                <LogOut size={12} /> Log Out
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
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
            <Link to="/wallet" onClick={() => setOpen(false)} className="bg-gold text-ink font-bold text-xs px-3 py-1.5 rounded-full shrink-0 whitespace-nowrap">
              Top Up
            </Link>
          </div>
        </div>
      )}

      <JackpotAdminModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />

      {/* Mobile Fixed Native App-Style Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-ink/95 backdrop-blur-xl border-t border-line/80 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.6)] select-none">
        <Link
          to="/"
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
            location.pathname === '/'
              ? 'text-gold font-bold bg-gold/10'
              : 'text-cream-dim/75 hover:text-cream'
          }`}
        >
          {location.pathname === '/' && (
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-gold rounded-full shadow-[0_0_8px_#F59E0B]" />
          )}
          <Home size={20} className={location.pathname === '/' ? 'text-gold drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]' : ''} />
          <span className="text-[10px] tracking-tight font-semibold">Jackpots</span>
        </Link>

        <Link
          to="/free"
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
            location.pathname.startsWith('/free')
              ? 'text-gold font-bold bg-gold/10'
              : 'text-cream-dim/75 hover:text-cream'
          }`}
        >
          {location.pathname.startsWith('/free') && (
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-gold rounded-full shadow-[0_0_8px_#F59E0B]" />
          )}
          <Unlock size={20} className={location.pathname.startsWith('/free') ? 'text-gold drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]' : ''} />
          <span className="text-[10px] tracking-tight font-semibold">Free</span>
        </Link>

        <Link
          to="/slips"
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
            location.pathname === '/slips'
              ? 'text-gold font-bold bg-gold/10'
              : 'text-cream-dim/75 hover:text-cream'
          }`}
        >
          {location.pathname === '/slips' && (
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-gold rounded-full shadow-[0_0_8px_#F59E0B]" />
          )}
          {builderLegsCount > 0 && (
            <span className="absolute top-1 right-2.5 bg-gold text-ink font-black text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center shadow-md border border-ink">
              {builderLegsCount}
            </span>
          )}
          <Dices size={20} className={location.pathname === '/slips' ? 'text-gold drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]' : ''} />
          <span className="text-[10px] tracking-tight font-semibold">Builder</span>
        </Link>

        <Link
          to="/leaderboard"
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
            location.pathname === '/leaderboard'
              ? 'text-gold font-bold bg-gold/10'
              : 'text-cream-dim/75 hover:text-cream'
          }`}
        >
          {location.pathname === '/leaderboard' && (
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-gold rounded-full shadow-[0_0_8px_#F59E0B]" />
          )}
          <Trophy size={20} className={location.pathname === '/leaderboard' ? 'text-gold drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]' : ''} />
          <span className="text-[10px] tracking-tight font-semibold">Ranks</span>
        </Link>

        <Link
          to={currentUser ? '/profile' : '/auth'}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-2xl transition-all duration-150 active:scale-95 min-h-[48px] min-w-[56px] touch-manipulation ${
            location.pathname === '/profile' || location.pathname === '/auth'
              ? 'text-gold font-bold bg-gold/10'
              : 'text-cream-dim/75 hover:text-cream'
          }`}
        >
          {(location.pathname === '/profile' || location.pathname === '/auth') && (
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-1 bg-gold rounded-full shadow-[0_0_8px_#F59E0B]" />
          )}
          <User size={20} className={location.pathname === '/profile' || location.pathname === '/auth' ? 'text-gold drop-shadow-[0_2px_6px_rgba(245,158,11,0.4)]' : ''} />
          <span className="text-[10px] tracking-tight font-semibold">{currentUser ? 'Profile' : 'Log In'}</span>
        </Link>
      </nav>
    </header>
  );
}
