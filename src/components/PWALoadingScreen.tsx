import React, { useState, useEffect, useMemo } from 'react';
import GridMotion from './GridMotion';
import { CLUB_LOGOS, getShuffledClubLogos } from '../constants/clubLogos';
import { Trophy, Shield } from 'lucide-react';

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
 * for exactly 6 seconds once all assets are preloaded, then smoothly transitions into the app.
 */
export default function PWALoadingScreen() {
  const [isPwa, setIsPwa] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [progress, setProgress] = useState(0);

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

    const startTime = Date.now();
    const duration = 6000; // 6 seconds

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);

      if (elapsed >= duration) {
        clearInterval(interval);
        setIsExiting(true);
        setTimeout(() => {
          setIsDone(true);
        }, 650); // smooth fade transition before unmount
      }
    }, 50);

    return () => clearInterval(interval);
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
        <div className="absolute inset-0 bg-radial from-transparent via-[#0b1015]/60 to-[#0b1015]/95" />
      </div>

      {/* Central Brand Emblem & 6-Second Progress Indicator */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center max-w-sm">
        {/* Glowing Crest */}
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#006C54] via-[#054d3c] to-[#02241b] border border-[#4ADE80]/30 shadow-[0_0_36px_rgba(74,222,128,0.35)] flex items-center justify-center">
            <Trophy size={36} className="text-[#D4AF37] drop-shadow-md" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#D4AF37] text-[#0b1015] flex items-center justify-center shadow-md">
            <Shield size={15} className="fill-current" />
          </div>
        </div>

        {/* Brand Typography */}
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-1.5 flex items-center gap-1.5 drop-shadow-sm">
          <span>MSHINDI</span>
          <span className="text-[#D4AF37]">ROOM</span>
        </h1>
        <p className="text-xs text-slate-300 font-medium tracking-wide mb-8">
          Kenya's Premier Consensus Arena
        </p>

        {/* 6-Second Progress Bar */}
        <div className="w-48 sm:w-56 h-1.5 bg-white/15 rounded-full overflow-hidden shadow-inner mb-3">
          <div
            className="h-full bg-gradient-to-r from-[#006C54] via-[#4ADE80] to-[#D4AF37] rounded-full transition-all duration-75 ease-out shadow-[0_0_10px_#4ADE80]"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Status text */}
        <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
          Entering Arena... {Math.ceil((6000 - (progress / 100) * 6000) / 1000)}s
        </span>
      </div>
    </div>
  );
}
