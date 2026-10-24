import React, { useState, useEffect, useMemo, useRef } from 'react';
import Masonry from './Masonry';
import { getShuffledClubLogos, type ClubLogoItem } from '../../lib/clubLogos';
import { isInstalledMobilePWA } from '../../lib/pwaDetection';

export { isInstalledMobilePWA };

export default function PWALoadingScreen() {
  // Check once on initial mount if this session qualifies
  const [shouldDisplay] = useState(() => isInstalledMobilePWA());
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDone, setIsDone] = useState(() => !shouldDisplay);
  const [progress, setProgress] = useState(0);

  // Shuffled club logo tiles for this launch session
  const shuffledLogos = useMemo<ClubLogoItem[]>(() => {
    if (!shouldDisplay) return [];
    return getShuffledClubLogos();
  }, [shouldDisplay]);

  // Preload logo images to eliminate flickering and partial rendering
  useEffect(() => {
    if (!shouldDisplay) return;

    shuffledLogos.forEach((logo) => {
      const img = new Image();
      img.src = logo.img;
    });
  }, [shouldDisplay, shuffledLogos]);

  // 6-Second (6,000 ms) strict timer lifecycle with graceful transition
  useEffect(() => {
    if (!shouldDisplay || isDone) return;

    const startTime = performance.now();
    const TOTAL_DURATION_MS = 6000;
    const FADE_START_MS = 5600;

    // Progress bar ticker
    const progressInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / TOTAL_DURATION_MS) * 100));
      setProgress(pct);
    }, 50);

    // Fade-out initiation timer
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, FADE_START_MS);

    // Terminal completion timer (strictly 6,000 ms)
    const completeTimer = setTimeout(() => {
      setIsDone(true);
      clearInterval(progressInterval);
    }, TOTAL_DURATION_MS);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [shouldDisplay, isDone]);

  // If not an installed mobile PWA or the 6s lifecycle has concluded, render nothing
  if (!shouldDisplay || isDone) {
    return null;
  }

  return (
    <div
      id="pwa-loading-screen"
      className={`fixed inset-0 z-[99999] flex flex-col justify-between bg-[#FFFFF0] text-slate-900 select-none overflow-hidden transition-opacity duration-400 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 16px)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 16px)',
        minHeight: '100dvh',
        height: '100dvh',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Launching MshindiRoom"
    >
      {/* 1. TOP BRANDING BAR */}
      <header className="flex flex-col items-center justify-center text-center pt-2 pb-3 shrink-0">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-8 h-8 rounded-xl bg-[#006C54] flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-sm tracking-wider">M</span>
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900">
            Mshindi<span className="text-[#006C54]">Room</span>
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
          Kenya&apos;s Premier Sports Consensus Arena
        </p>
      </header>

      {/* 2. CENTER ANIMATION CANVAS (REACT BITS MASONRY WITH SHUFFLED CLUB CRESTS) */}
      <main className="flex-1 w-full overflow-hidden relative flex items-center justify-center my-auto py-2">
        <div className="w-full max-w-sm sm:max-w-md mx-auto h-full flex flex-col justify-center">
          <Masonry
            items={shuffledLogos.map((club, idx) => ({
              id: club.id,
              img: club.img,
              width: 512,
              height: 512,
              title: club.title,
              alt: club.alt,
              // Subtle span variation for rich mosaic visual rhythm
              span: idx % 7 === 0 ? 2 : 1,
            }))}
            columns={3}
            columnWidth={96}
            gap={8}
            radius={14}
            animateFrom="bottom"
            stagger={0.035}
            duration={0.65}
            bounce={0.12}
            blurToFocus={true}
            revealOnScroll={false}
            hoverEffect="zoom"
            captions="hover"
            lightbox={false}
            draggable={false}
            className="w-full"
          />
        </div>
      </main>

      {/* 3. BOTTOM NATIVE LAUNCH INDICATOR */}
      <footer className="shrink-0 flex flex-col items-center text-center pt-2 pb-1">
        {/* Sleek loading bar */}
        <div className="w-48 sm:w-56 h-1.5 bg-slate-200/80 rounded-full overflow-hidden mb-2.5">
          <div
            className="h-full bg-[#006C54] rounded-full transition-all duration-75 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#006C54] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#006C54]" />
          </span>
          <span className="text-[11px] font-medium text-slate-500">
            Initializing matchday consensus...
          </span>
        </div>
      </footer>
    </div>
  );
}
