import React, { useState, useEffect, useRef } from 'react';

/**
 * Detects if the web app is running in standalone PWA mode or simulation preview
 */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    window.location.search.includes('pwa=1') ||
    window.location.search.includes('splash=1') ||
    window.location.search.includes('loading=1') ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Fullscreen PWA Loading Screen
 *
 * Appears on PWA launch in true fullscreen (no navigation bars, pure black backdrop).
 * Plays the official Mshindi silhouette and text fade video animation positioned dead-center.
 * Once the animation completes (or upon user tap / safety timer), it smoothly fades out into the app.
 */
export default function PWALoadingScreen() {
  const [skipSplash] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem('mshindi_skip_pwa_splash') === '1';
    } catch {
      return false;
    }
  });
  const [isPwa] = useState(() => !skipSplash && isPwaStandalone());
  const [isExiting, setIsExiting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const exitTriggeredRef = useRef(false);

  // Consume the one-time skip-splash flag after mount so future cold launches show the loading screen normally
  useEffect(() => {
    if (skipSplash) {
      try {
        sessionStorage.removeItem('mshindi_skip_pwa_splash');
      } catch {}
    }
  }, [skipSplash]);

  // 1. Mark splash active so other code (themeStore) doesn't override the green status bar
  useEffect(() => {
    if (!isPwa) return;
    document.documentElement.setAttribute('data-splash', 'active');
  }, [isPwa]);

  // 2. Lock body scroll while loading screen is active
  useEffect(() => {
    if (isPwa && !isDone) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isPwa, isDone]);

  // 3. Smooth exit transition
  const handleComplete = () => {
    if (exitTriggeredRef.current) return;
    exitTriggeredRef.current = true;
    setIsExiting(true);
    setTimeout(() => {
      setIsDone(true);
    }, 700); // 700ms smooth fade transition
  };

  // 4. Safety fallback timer (animation duration is ~7.85s)
  useEffect(() => {
    if (!isPwa || isDone) return;

    const safetyTimer = setTimeout(() => {
      handleComplete();
    }, 8500);

    return () => clearTimeout(safetyTimer);
  }, [isPwa, isDone]);

  // 5. Ensure video auto-plays reliably
  useEffect(() => {
    if (!isPwa || isDone) return;
    const vid = videoRef.current;
    if (vid) {
      vid.play().catch(() => {
        // Autoplay policy fallback
      });
    }
  }, [isPwa, isDone]);

  // 6. Synchronize theme-color: green (#11492D) on loading screen, then transition to active theme (#FFFFF0 or #202522)
  useEffect(() => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const root = document.documentElement;
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
    const isDark = root.classList.contains('dark');

    if (isAndroid) {
      if (isPwa && !isExiting && !isDone) {
        // Android PWA Loading: fullscreen logo green accent (#11492D) across top status bar, viewport & bottom nav bar
        root.setAttribute('data-splash', 'active');
        document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
          el.setAttribute('content', '#11492D');
        });
        root.style.backgroundColor = '#11492D';
        if (document.body) {
          document.body.style.backgroundColor = '#11492D';
        }
      } else {
        // Android PWA Loaded: release splash and transition top & bottom system bars to app accents (#FFFFF0 in light, #202522 in dark)
        root.removeAttribute('data-splash');
        const androidColor = isDark ? '#202522' : '#FFFFF0';
        document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
          el.setAttribute('content', androidColor);
        });
        root.style.backgroundColor = androidColor;
        if (document.body) {
          document.body.style.backgroundColor = androidColor;
        }
      }
      return;
    }

    // iOS / WebKit & Desktop PWA: completely untouched
    if (isPwa && !isExiting && !isDone) {
      if (metaTheme) metaTheme.setAttribute('content', '#11492D');
      root.style.backgroundColor = '#11492D';
    } else {
      // App loaded: release the splash lock and return status bar to ivory/white
      root.removeAttribute('data-splash');
      root.style.backgroundColor = '';
      if (metaTheme) metaTheme.setAttribute('content', isDark ? '#202522' : '#FFFFF0');
    }
  }, [isPwa, isExiting, isDone]);

  if (!isPwa || isDone) {
    return null;
  }

  const splashBackdropColor = '#11492D';

  return (
    <div
      className={`fixed inset-0 z-[999999] w-screen overflow-hidden  flex items-center justify-center select-none transition-opacity duration-700 ease-out ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: splashBackdropColor, height: '100dvh', minHeight: '100%' }}
      aria-label="MshindiRoom Application Loading"
      role="dialog"
      aria-modal="true"
      onClick={handleComplete}
    >
      {/* Centered Video Animation */}
      <div className="relative w-full h-full flex items-center justify-center p-0 m-0 " style={{ backgroundColor: splashBackdropColor }}>
        <video
          ref={videoRef}
          src="/pwa-loading-animation.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onEnded={handleComplete}
          className="w-full h-full max-h-screen max-w-full object-contain pointer-events-none select-none "
          style={{ backgroundColor: splashBackdropColor }}
        />
      </div>
    </div>
  );
}
