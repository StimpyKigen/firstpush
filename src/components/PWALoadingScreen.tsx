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
  const [isPwa] = useState(() => isPwaStandalone());
  const [isExiting, setIsExiting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const exitTriggeredRef = useRef(false);

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

  // 6. Synchronize theme-color: green on loading screen, ivory in-app
  useEffect(() => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const root = document.documentElement;
    if (isPwa && !isExiting && !isDone) {
      if (metaTheme) metaTheme.setAttribute('content', '#11492D');
      root.style.backgroundColor = '#11492D';
    } else {
      // App loaded: release the splash lock and return status bar to ivory/white
      root.removeAttribute('data-splash');
      root.style.backgroundColor = '';
      if (metaTheme) metaTheme.setAttribute('content', '#FFFFF0');
    }
  }, [isPwa, isExiting, isDone]);

  if (!isPwa || isDone) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[999999] w-screen overflow-hidden bg-[#11492D] flex items-center justify-center select-none transition-opacity duration-700 ease-out ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#11492D', height: '100dvh', minHeight: '100%' }}
      aria-label="MshindiRoom Application Loading"
      role="dialog"
      aria-modal="true"
      onClick={handleComplete}
    >
      {/* Centered Video Animation */}
      <div className="relative w-full h-full flex items-center justify-center p-0 m-0 bg-[#11492D]" style={{ backgroundColor: '#11492D' }}>
        <video
          ref={videoRef}
          src="/pwa-loading-animation.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onEnded={handleComplete}
          className="w-full h-full max-h-screen max-w-full object-contain pointer-events-none select-none bg-[#11492D]"
          style={{ backgroundColor: '#11492D' }}
        />
      </div>
    </div>
  );
}
