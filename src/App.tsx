import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { initTheme } from './lib/themeStore';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBar from './components/OfflineBar';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import PWALoadingScreen from './components/PWALoadingScreen';
import AvaChatSupport from './components/AvaChatSupport';
import AuthWallModal from './components/AuthWallModal';
import { refreshFreeMatches } from './lib/freeMatches';
import { syncJackpotsFromApi } from './lib/mockData';
import { startDailyHighlightSync } from './lib/footballApi';

import { useCurrentUser } from './lib/authStore';

// Primary Home Route loaded immediately
import Home from './pages/Home';

// Lazy-loaded secondary routes for optimal code splitting & Core Web Vitals
const Room = lazy(() => import('./pages/Room'));
const Leaderboard = lazy(() => import('./pages/Leaderboard'));
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const FreeMatches = lazy(() => import('./pages/FreeMatches'));
const FreeMatchRoom = lazy(() => import('./pages/FreeMatchRoom'));
const Auth = lazy(() => import('./pages/Auth'));
const Profile = lazy(() => import('./pages/Profile'));
const BetSlipRoom = lazy(() => import('./pages/BetSlipRoom'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const NotFound = lazy(() => import('./pages/NotFound'));

import {
  PageSkeleton,
  RoomDetailSkeleton,
  LeaderboardSkeleton,
  WalletSkeleton,
  MatchListSkeleton,
  BetSlipFeedSkeleton,
  Skeleton,
} from './components/skeleton';

function RouteLoadingFallback({ pathname }: { pathname: string }) {
  if (pathname.startsWith('/room/') || pathname.startsWith('/free/')) {
    return <RoomDetailSkeleton />;
  }
  if (pathname === '/free') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="text-center mb-8 sm:mb-10 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-24 h-4 rounded-full" />
            <span className="text-slate-300">·</span>
            <Skeleton className="w-28 h-4 rounded-full" />
          </div>
          <Skeleton className="w-72 sm:w-96 h-10 sm:h-12 rounded-lg mb-3" />
          <Skeleton className="w-full max-w-2xl h-4 rounded" />
        </div>
        <MatchListSkeleton count={6} />
      </div>
    );
  }
  if (pathname === '/leaderboard') {
    return <LeaderboardSkeleton />;
  }
  if (pathname === '/wallet') {
    return <WalletSkeleton />;
  }
  if (pathname === '/slips') {
    return (
      <div className="max-w-4xl lg:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <Skeleton className="w-32 h-4 rounded-full mb-3" />
          <Skeleton className="w-64 h-10 rounded-lg mb-2" />
          <Skeleton className="w-full max-w-xl h-4 rounded" />
        </div>
        <BetSlipFeedSkeleton count={3} />
      </div>
    );
  }
  return <PageSkeleton />;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<RouteLoadingFallback pathname={location.pathname} />}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="w-full flex-1"
        >
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/room/:id" element={<Room />} />
            <Route path="/free" element={<FreeMatches />} />
            <Route path="/free/:id" element={<FreeMatchRoom />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/jackpot" element={<Leaderboard />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/slips" element={<BetSlipRoom />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/p2p" element={<Navigate to="/" replace />} />
            <Route path="/p2p/*" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}

function MainContent() {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

  return (
    <main
      className={`flex-1 flex flex-col w-full overflow-x-hidden ${
        isHomePage
          ? 'pb-0 lg:pb-0'
          : 'pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:pb-12'
      }`}
    >
      <AnimatedRoutes />
    </main>
  );
}

function ConditionalFooter() {
  const location = useLocation();
  const currentUser = useCurrentUser();

  // The original footer is only to be on the home page of desktop view and mobile (when not logged in)
  if (location.pathname !== '/') {
    return null;
  }

  if (currentUser) {
    return (
      <div className="hidden lg:block">
        <Footer />
      </div>
    );
  }

  return <Footer />;
}

function App() {
  // Ensure light theme is strictly enforced across all client sessions
  useEffect(() => {
    initTheme();
  }, []);

  // Initial data sync and background updates (runs strictly once)
  useEffect(() => {
    const syncAll = async () => {
      await refreshFreeMatches();
      await syncJackpotsFromApi();
    };
    void syncAll();
    startDailyHighlightSync(() => {
      void syncAll();
    });
  }, []);

  return (
    <ErrorBoundary>
      <PWALoadingScreen />
      <BrowserRouter>
        <ScrollToTop />
        <OfflineBar />
        <PWAInstallPrompt />
        <AvaChatSupport />
        <AuthWallModal />
        {/*
          Outer frame: fills the full viewport with warm ivory background
        */}
        <div className="min-h-dvh w-full flex flex-col font-body bg-[#FFFFF0] dark:bg-[#202522] text-slate-900 dark:text-[#F4F5EF] antialiased selection:bg-[#006C54]/20 transition-colors duration-200">
          {/*
            App shell: full responsive container spanning edge-to-edge on phones,
            and expansive desktop canvas on larger displays.
          */}
          <div className="app-shell w-full flex-1 flex flex-col">
            <Navbar />
            <MainContent />
            <ConditionalFooter />
          </div>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
