import React from 'react';

/**
 * Official vector logos for top European competitions as seen on the MshindiRoom Paywall:
 * - Row 1: UEFA Champions League, UEFA Europa League, UEFA Conference League
 * - Row 2: Premier League, LaLiga, Serie A, Bundesliga, Ligue 1
 */
export default function CompetitionLogoStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-2.5 w-full select-none ${className}`}>
      {/* Row 1: UEFA Competitions */}
      <div className="flex items-center justify-center gap-5 sm:gap-7">
        {/* UEFA Champions League */}
        <div className="flex flex-col items-center">
          <img
            src="/images/competitions/ucl.svg"
            alt="UEFA Champions League"
            className="h-8.5 sm:h-9.5 w-auto object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>

        {/* UEFA Europa League */}
        <div className="flex flex-col items-center">
          <img
            src="/images/competitions/uel.svg"
            alt="UEFA Europa League"
            className="h-8.5 sm:h-9.5 w-auto object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>

        {/* UEFA Conference League */}
        <div className="flex flex-col items-center">
          <img
            src="/images/competitions/uecl.svg"
            alt="UEFA Conference League"
            className="h-8.5 sm:h-9.5 w-auto object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>
      </div>

      {/* Row 2: Top 5 Domestic Leagues */}
      <div className="flex items-center justify-center gap-3.5 sm:gap-4.5 pt-0.5">
        {/* Premier League */}
        <div className="flex flex-col items-center">
          <img
            src="/images/competitions/premier-league.svg"
            alt="Premier League"
            className="h-6.5 sm:h-7.5 w-auto object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>

        {/* LaLiga */}
        <div className="flex flex-col items-center">
          <img
            src="/images/competitions/laliga.svg"
            alt="LaLiga"
            className="h-6.5 sm:h-7.5 w-auto object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>

        {/* Serie A */}
        <div className="flex flex-col items-center">
          <img
            src="/images/competitions/serie-a.svg"
            alt="Serie A"
            className="h-6.5 sm:h-7.5 w-auto object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>

        {/* Bundesliga */}
        <div className="flex flex-col items-center">
          <img
            src="/images/competitions/bundesliga.svg"
            alt="Bundesliga"
            className="h-5.5 sm:h-6.5 w-auto object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>

        {/* Ligue 1 */}
        <div className="flex flex-col items-center">
          <img
            src="/images/competitions/ligue-1.svg"
            alt="Ligue 1"
            className="h-6.5 sm:h-7.5 w-auto object-contain drop-shadow-sm pointer-events-none"
            loading="eager"
          />
        </div>
      </div>
    </div>
  );
}
