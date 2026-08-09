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
      <header className="sticky top-0 z-50 border-b border-line/60 bg-ink/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2 h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <span className="font-display font-extrabold text-lg xl:text-xl tracking-tight text-cream whitespace-nowrap">
              Mshindi<span className="text-gold">Room</span>
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
            theme={theme}
            toggleTheme={toggleTheme}
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
