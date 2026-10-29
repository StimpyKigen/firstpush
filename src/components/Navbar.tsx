import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import JackpotAdminModal from './JackpotAdminModal';
import DesktopNav from './nav/DesktopNav';
import { MobileHeaderControls, MobileMenuPanel } from './nav/MobileHeader';
import MobileBottomNav from './nav/MobileBottomNav';
import { useNavData } from './nav/useNavData';
import { useBackToClose } from '../lib/useBackToClose';

export default function Navbar() {
  const location = useLocation();
  const { links, balance, currentUser, logOut, navigate, builderLegsCount } = useNavData();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const isAuthPage = location.pathname.startsWith('/auth') || location.pathname === '/login';
  const isProfilePage = location.pathname.startsWith('/profile');
  const isLoggedOutPrimaryPage =
    !currentUser &&
    (location.pathname === '/' ||
      location.pathname.startsWith('/free') ||
      location.pathname.startsWith('/slips') ||
      location.pathname.startsWith('/leaderboard') ||
      location.pathname.startsWith('/jackpot') ||
      location.pathname.startsWith('/room'));
  const hideMobileMenu = isAuthPage || isLoggedOutPrimaryPage || (Boolean(currentUser) && isProfilePage);

  // Close menus on route or auth state change
  useEffect(() => {
    setOpen(false);
    setProfileOpen(false);
  }, [location.pathname, currentUser]);

  // Intercept back button to dismiss mobile hamburger menu and desktop dropdown first
  useBackToClose(open, () => setOpen(false));
  useBackToClose(profileOpen, () => setProfileOpen(false));

  // Lock background scroll when mobile hamburger is open
  useEffect(() => {
    if (open && !hideMobileMenu) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [open, hideMobileMenu]);

  function handleLogout() {
    logOut();
    setProfileOpen(false);
    navigate('/');
  }

  return (
    <>
      <header
        className="sticky top-0 z-50 border-b mobile-nav-glass lg:bg-[#FFFFF0] lg:border-[#E6E6D2] transition-colors"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 h-16">
          <Link
            to="/"
            className="flex items-center shrink-0 mr-1 sm:mr-2 xl:mr-4 group active:scale-95 transition-transform focus:outline-none z-10"
            aria-label="MshindiRoom Home"
          >
            <img
              src="/images/logo.png"
              alt="MshindiRoom"
              className="h-6 sm:h-6.5 lg:h-7 w-auto max-w-[165px] xs:max-w-[195px] sm:max-w-none object-contain shrink-0"
              width="210"
              height="28"
              loading="eager"
              decoding="async"
            />
          </Link>

          <DesktopNav
            links={links}
            pathname={location.pathname}
            builderLegsCount={builderLegsCount}
            profileOpen={profileOpen}
            setProfileOpen={setProfileOpen}
            currentUser={currentUser}
            onOpenAdminModal={() => setAdminModalOpen(true)}
            onLogout={handleLogout}
          />

          {!hideMobileMenu && (
            <MobileHeaderControls
              open={open}
              setOpen={setOpen}
            />
          )}
        </div>

        {!hideMobileMenu && open && (
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

      {/* Mobile menu backdrop: blocks scroll and interaction on everything behind the menu */}
      {!hideMobileMenu && open && (
        <div
          className="fixed inset-0 top-16 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

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
