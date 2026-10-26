import React, { useState, useEffect, useMemo } from 'react';
import GridMotion from './GridMotion';
import { CLUB_LOGOS, getShuffledClubLogos } from '../constants/clubLogos';

/**
 * Detects if the web app is running in standalone PWA mode
 */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    window.location.search.includes('pwa=1')
  );
}

/**
 * Fullscreen PWA Loading Screen
 *
 * Appears strictly on PWA launch in fullscreen (no navigation bars).
 * Plays the login background animation (GridMotion with shuffled club logos and stadium pitch atmosphere)
 * with strictly pure motion animation (no text overlays) for exactly 6 seconds once all assets are preloaded,
 * then smoothly transitions into the app.
 */
export default function PWALoadingScreen() {
  const [isPwa, setIsPwa] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Shuffled logos for the background motion grid
  const shuffledLogos = useMemo(() => getShuffledClubLogos(), []);

  // 1. Detect PWA standalone mode and preload all assets
  useEffect(() => {
    if (!isPwaStandalone()) {
      return;
    }
    setIsPwa(true);

    // Preload all club logo images and pitch textures
    const assetsToPreload = [
      ...CLUB_LOGOS,
      '/images/auth-pitch-bg.jpg',
    ];

    let loadedCount = 0;
    const totalAssets = assetsToPreload.length;

    const handleAssetLoad = () => {
      loadedCount++;
      if (loadedCount >= totalAssets) {
        setAssetsLoaded(true);
      }
    };

    assetsToPreload.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.onload = handleAssetLoad;
      img.onerror = handleAssetLoad;
    });

    // Safety timeout: proceed within 1200ms even if some remote asset is slow
    const safetyTimer = setTimeout(() => {
      setAssetsLoaded(true);
    }, 1200);

    return () => clearTimeout(safetyTimer);
  }, []);

  // 2. Lock body scroll while splash screen is active
  useEffect(() => {
    if (isPwa && !isDone) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isPwa, isDone]);

  // 3. Exactly 6-second timer once assets are confirmed loaded
  useEffect(() => {
    if (!isPwa || !assetsLoaded || isDone) return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        setIsDone(true);
      }, 700); // smooth fade transition before unmount
    }, 6000);

    return () => clearTimeout(timer);
  }, [isPwa, assetsLoaded, isDone]);

  if (!isPwa || isDone) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[999999] w-screen h-screen overflow-hidden bg-[#0b1015] flex flex-col items-center justify-center select-none transition-opacity duration-700 ease-out ${
        isExiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="MshindiRoom Application Loading"
      role="dialog"
      aria-modal="true"
    >
      {/* Animated Motion Grid Background with Shuffled Club Logos */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        {assetsLoaded && shuffledLogos.length > 0 && (
          <GridMotion
            items={shuffledLogos}
            rows={5}
            aspectRatio={1.0}
            gap={12}
            radius={14}
            angle={-10}
            tilt={0}
            speed={20}
            direction="alternate"
            parallax={0}
            spotlight={0.65}
            dim={0.45}
            fade={0.35}
            grayscale={false}
          />
        )}
      </div>

      {/* Atmospheric Pitch Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src="/images/auth-pitch-bg.jpg"
          alt=""
          className="w-full h-full object-cover opacity-35 mix-blend-overlay"
        />
        {/* Radial vignette spotlight */}
        <div className="absolute inset-0 bg-radial from-transparent via-[#0b1015]/50 to-[#0b1015]/95" />
      </div>
    </div>
  );
}
