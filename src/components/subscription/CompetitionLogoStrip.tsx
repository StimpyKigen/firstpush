import React from 'react';

/**
 * Official competition logos matching the MshindiRoom paycard reference design:
 * - Row 1 (UEFA): Champions League, Europa League, Conference League
 * - Row 2 (Leagues): Premier League, LaLiga, Serie A, Bundesliga, Ligue 1
 */
export default function CompetitionLogoStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-3.5 sm:gap-4 w-full select-none ${className}`}>
      {/* Row 1: UEFA Competitions (Centered trio) */}
      <div className="flex items-center justify-center gap-7 sm:gap-9">
        {/* UEFA Champions League */}
        <div className="flex items-center justify-center w-12 sm:w-13.5 h-12 sm:h-13.5">
          <img
            src="/images/competitions/ucl.png"
            alt="UEFA Champions League"
            className="max-h-full max-w-full object-contain drop-shadow-md pointer-events-none"
            loading="eager"
          />
        </div>

        {/* UEFA Europa League */}
        <div className="flex items-center justify-center w-12 sm:w-13.5 h-12 sm:h-13.5">
          <img
            src="/images/competitions/uel.png"
            alt="UEFA Europa League"
            className="max-h-full max-w-full object-contain drop-shadow-md pointer-events-none"
            loading="eager"
          />
        </div>

        {/* UEFA Conference League */}
        <div className="flex items-center justify-center w-12 sm:w-13.5 h-12 sm:h-13.5">
          <img
            src="/images/competitions/uecl.png"
            alt="UEFA Conference League"
            className="max-h-full max-w-full object-contain drop-shadow-md pointer-events-none"
            loading="eager"
          />
        </div>
      </div>

      {/* Row 2: Top 5 Domestic Leagues (Evenly distributed across 5 columns) */}
      <div className="grid grid-cols-5 items-center justify-items-center w-full max-w-[340px] sm:max-w-[365px] px-1">
        {/* Premier League */}
        <div className="flex items-center justify-center w-9 sm:w-10.5 h-9 sm:h-10.5">
          <img
            src="/images/competitions/premier-league.png"
            alt="Premier League"
            className="max-h-full max-w-full object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>

        {/* LaLiga */}
        <div className="flex items-center justify-center w-9 sm:w-10.5 h-9 sm:h-10.5">
          <img
            src="/images/competitions/laliga.png"
            alt="LaLiga"
            className="max-h-full max-w-full object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>

        {/* Serie A */}
        <div className="flex items-center justify-center w-9 sm:w-10.5 h-9 sm:h-10.5">
          <img
            src="/images/competitions/serie-a.png"
            alt="Serie A"
            className="max-h-full max-w-full object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>

        {/* Bundesliga */}
        <div className="flex items-center justify-center w-9 sm:w-10.5 h-9 sm:h-10.5">
          <img
            src="/images/competitions/bundesliga.png"
            alt="Bundesliga"
            className="max-h-full max-w-full object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>

        {/* Ligue 1 */}
        <div className="flex items-center justify-center w-9 sm:w-10.5 h-9 sm:h-10.5">
          <img
            src="/images/competitions/ligue-1.png"
            alt="Ligue 1"
            className="max-h-full max-w-full object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>
      </div>

      {/* Row 3: Domestic Kenyan League (KPL centered) */}
      <div className="flex items-center justify-center w-full">
        <div className="flex items-center justify-center w-10 sm:w-11.5 h-10 sm:h-11.5">
          <img
            src="/images/competitions/kpl.png"
            alt="Kenyan Premier League"
            className="max-h-full max-w-full object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>
      </div>
    </div>
  );
}
