import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useTheme, applyThemeClass } from './lib/themeStore';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineBar from './components/OfflineBar';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import AvaChatSupport from './components/AvaChatSupport';
import { refreshFreeMatches } from './lib/freeMatches';
import { syncJackpotsFromApi } from './lib/mockData';
import { startDailyHighlightSync } from './lib/footballApi';

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
const P2PComingSoon = lazy(() => import('./pages/P2PComingSoon'));
const BetSlipRoom = lazy(() => import('./pages/BetSlipRoom'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const NotFound = lazy(() => import('./pages/NotFound'));

function LoadingFallback() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-cream-dim">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-mono font-medium tracking-wide">Loading arena...</span>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<LoadingFallback />}>
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
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/slips" element={<BetSlipRoom />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/p2p" element={<P2PComingSoon />} />
            <Route path="/p2p/create" element={<P2PComingSoon />} />
            <Route path="/p2p/:id" element={<P2PComingSoon />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </Suspense>
  );
}

function App() {
  const theme = useTheme((s) => s.theme);

  // Synchronize theme changes
  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

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
      <BrowserRouter>
        <ScrollToTop />
        <OfflineBar />
        <PWAInstallPrompt />
        <AvaChatSupport />
        {/*
          Outer frame: fills the full viewport with the dark emerald-tinted
          background that acts as the "surround" on larger screens.
          On small phones this is invisible (app-shell is 100% wide).
        */}
        <div className="min-h-dvh w-full flex flex-col font-body bg-[#FFFFF0] text-slate-900 antialiased selection:bg-[#006C54]/20">
          {/*
            App shell: full responsive container spanning edge-to-edge on phones,
            and expansive desktop canvas on larger displays.
          */}
          <div className="app-shell w-full flex-1 flex flex-col">
            <Navbar />
            <main className="flex-1 flex flex-col w-full pb-24 lg:pb-12 overflow-x-hidden">
              <AnimatedRoutes />
            </main>
            <Footer />
          </div>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
