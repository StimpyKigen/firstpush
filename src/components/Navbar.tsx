import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import JackpotAdminModal from './JackpotAdminModal';
import DesktopNav from './nav/DesktopNav';
import { MobileHeaderControls, MobileMenuPanel } from './nav/MobileHeader';
import MobileBottomNav from './nav/MobileBottomNav';
import { useNavData } from './nav/useNavData';

export default function Navbar() {
  const location = useLocation();
  const { links, balance, mshindiTokens, currentUser, logOut, navigate, theme, toggleTheme, builderLegsCount } = useNavData();
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

  function handleLogout() {
    logOut();
    setProfileOpen(false);
    navigate('/');
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/[0.08] dark:border-white/[0.08] light:border-black/[0.06] bg-ink/75 backdrop-blur-2xl transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0 group active:scale-95 transition-transform">
            <span className="font-display font-black text-xl tracking-tight text-cream whitespace-nowrap flex items-center">
              mshindi<span className="text-gold text-2xl leading-none">.</span>
              <span className="ml-1.5 text-[9px] tracking-widest uppercase font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-2/15 text-emerald-2 border border-emerald-2/30">ROOM</span>
            </span>
          </Link>

          <DesktopNav
            links={links}
            pathname={location.pathname}
            builderLegsCount={builderLegsCount}
            theme={theme}
            toggleTheme={toggleTheme}
            walletOpen={walletOpen}
            setWalletOpen={setWalletOpen}
            profileOpen={profileOpen}
            setProfileOpen={setProfileOpen}
            currentUser={currentUser}
            balance={balance}
            mshindiTokens={mshindiTokens}
            onOpenAdminModal={() => setAdminModalOpen(true)}
            onLogout={handleLogout}
          />

          <MobileHeaderControls
            walletOpen={walletOpen}
            setWalletOpen={setWalletOpen}
            balance={balance}
            mshindiTokens={mshindiTokens}
            open={open}
            setOpen={setOpen}
          />
        </div>

        {open && (
          <MobileMenuPanel
            links={links}
            pathname={location.pathname}
            currentUser={currentUser}
            balance={balance}
            theme={theme}
            toggleTheme={toggleTheme}
            onNavigate={() => setOpen(false)}
            onOpenAdminModal={() => setAdminModalOpen(true)}
            onLogout={handleLogout}
          />
        )}
      </header>

      {/*
        These two are deliberately siblings of <header>, not children of it: <header> has
        backdrop-blur-md, and backdrop-filter creates a CSS containing block for `position: fixed`
        descendants. Nested here, they'd anchor to the header's box instead of the viewport.
      */}
      <JackpotAdminModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />

      <MobileBottomNav
        pathname={location.pathname}
        builderLegsCount={builderLegsCount}
        currentUser={currentUser}
      />
    </>
  );
}
