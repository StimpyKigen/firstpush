import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Smartphone, CheckCircle2, Sparkles, ShieldCheck } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone (installed) mode
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(inStandalone);

    if (inStandalone) return; // Don't prompt if already installed!

    // Check if user dismissed prompt recently
    const dismissedTimestamp = localStorage.getItem('mshindi_pwa_dismissed_at');
    if (dismissedTimestamp) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedTimestamp, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return; // Don't prompt for 7 days if dismissed
      }
    }

    // Detect iOS Safari
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    setIsIOS(isIOSDevice);

    if (isIOSDevice && isSafari && !inStandalone) {
      // Delay showing iOS guide slightly so page renders smoothly
      const timer = setTimeout(() => {
        setShowIOSModal(true);
      }, 2500);
      return () => clearTimeout(timer);
    }

    // Capture standard beforeinstallprompt for Android & Desktop Chrome/Edge/Samsung Internet
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowAndroidBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  async function handleInstallAndroid() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[Mshindi PWA] User accepted the install prompt');
    } else {
      console.log('[Mshindi PWA] User dismissed the install prompt');
    }

    setDeferredPrompt(null);
    setShowAndroidBanner(false);
  }

  function handleDismissAndroid() {
    setShowAndroidBanner(false);
    localStorage.setItem('mshindi_pwa_dismissed_at', Date.now().toString());
  }

  function handleDismissIOS() {
    setShowIOSModal(false);
    localStorage.setItem('mshindi_pwa_dismissed_at', Date.now().toString());
  }

  if (isStandalone) return null;

  return (
    <>
      {/* Android & Desktop Floating Install Banner */}
      {showAndroidBanner && (
        <div
          id="pwa-android-install-banner"
          className="fixed bottom-16 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-96 z-50 bg-panel-2 border-2 border-gold/60 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-rise"
        >
          <button
            onClick={handleDismissAndroid}
            className="absolute top-2.5 right-2.5 text-cream-dim hover:text-cream p-1 rounded-lg hover:bg-ink-2/50 transition-all"
            aria-label="Close install prompt"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-3.5 pr-6">
            <div className="w-12 h-12 rounded-xl bg-ink-2 border border-gold/40 p-1.5 flex items-center justify-center shrink-0 shadow-md">
              <img src="/pwa-192.png" alt="MshindiRoom App Icon" className="w-full h-full object-contain rounded-lg" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-gold font-extrabold text-xs tracking-wider uppercase">
                <Sparkles size={13} />
                <span>Install Mobile App</span>
              </div>
              <h4 className="font-extrabold text-cream text-sm mt-0.5">MshindiRoom</h4>
              <p className="text-xs text-cream-dim mt-1 leading-snug">
                Fast 1-tap access, zero browser bars, & offline jackpot consensus.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={handleInstallAndroid}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-gold to-gold-2 text-ink-2 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              <Download size={16} /> Install App
            </button>
            <button
              onClick={handleDismissAndroid}
              className="py-2.5 px-3 rounded-xl bg-ink-2/60 hover:bg-ink-2 text-cream-dim text-xs font-bold transition-all"
            >
              Not Now
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Custom Guide Modal */}
      {showIOSModal && (
        <div
          id="pwa-ios-install-modal"
          className="fixed inset-0 z-50 bg-ink/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-panel-2 border border-gold/50 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-rise relative">
            <button
              onClick={handleDismissIOS}
              className="absolute top-4 right-4 text-cream-dim hover:text-cream p-1.5 rounded-full bg-ink-2/60 border border-line transition-all"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-ink border border-gold/40 p-2 flex items-center justify-center shrink-0">
                <img src="/pwa-192.png" alt="MshindiRoom" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="text-[10px] font-black tracking-widest text-emerald-2 uppercase bg-emerald/15 px-2 py-0.5 rounded-md border border-emerald/30">
                  iOS Installation
                </span>
                <h3 className="text-base font-extrabold text-cream mt-0.5">Install MshindiRoom on iPhone</h3>
              </div>
            </div>

            <p className="text-xs text-cream-dim leading-relaxed">
              Enjoy a full native mobile experience without downloading from the App Store. Follow 3 easy steps:
            </p>

            <div className="space-y-3 bg-ink/60 border border-line p-4 rounded-2xl">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-black flex items-center justify-center shrink-0 border border-gold/40">
                  1
                </span>
                <p className="text-xs text-cream flex-1 pt-0.5">
                  Tap the <strong className="text-gold font-bold inline-flex items-center gap-1"><Share size={14} className="inline" /> Share button</strong> in Safari's bottom toolbar.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-black flex items-center justify-center shrink-0 border border-gold/40">
                  2
                </span>
                <p className="text-xs text-cream flex-1 pt-0.5">
                  Scroll down and tap <strong className="text-gold font-bold inline-flex items-center gap-1"><PlusSquare size={14} className="inline" /> Add to Home Screen</strong>.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-gold/20 text-gold text-xs font-black flex items-center justify-center shrink-0 border border-gold/40">
                  3
                </span>
                <p className="text-xs text-cream flex-1 pt-0.5">
                  Tap <strong className="text-emerald-2 font-bold">Add</strong> in the top-right corner to launch MshindiRoom from your home screen.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleDismissIOS}
                className="w-full py-3 rounded-xl bg-gold text-ink-2 font-extrabold text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md"
              >
                Got It, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
