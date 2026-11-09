import React from 'react';

/**
 * High-fidelity vector logos for top European competitions as seen on the MshindiRoom Paywall:
 * - Row 1: UEFA Champions League, UEFA Europa League, UEFA Conference League
 * - Row 2: Premier League, LaLiga, Serie A, Bundesliga, Ligue 1
 */
export default function CompetitionLogoStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 w-full select-none ${className}`}>
      {/* Row 1: UEFA Competitions */}
      <div className="flex items-center justify-center gap-6 sm:gap-8">
        {/* UEFA Champions League */}
        <div className="flex flex-col items-center group cursor-default">
          <svg className="w-8 h-8 sm:w-9 sm:h-9 text-white drop-shadow-md" viewBox="0 0 100 100" fill="currentColor">
            {/* UCL Starball */}
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="4" />
            <polygon points="50,12 60,38 88,38 65,54 74,80 50,64 26,80 35,54 12,38 40,38" fill="currentColor" />
            <polygon points="50,22 57,40 76,40 61,51 67,70 50,58 33,70 39,51 24,40 43,40" fill="#070A08" />
            <circle cx="50" cy="50" r="14" fill="currentColor" />
            <circle cx="50" cy="50" r="7" fill="#070A08" />
          </svg>
          <div className="text-[7.5px] sm:text-[8px] font-extrabold text-white uppercase tracking-wider text-center mt-1 leading-tight">
            <span>UEFA</span><br />
            <span className="text-[7px] tracking-normal font-bold">CHAMPIONS</span><br />
            <span className="text-[6.5px] tracking-widest font-semibold text-slate-300">LEAGUE</span>
          </div>
        </div>

        {/* UEFA Europa League */}
        <div className="flex flex-col items-center group cursor-default">
          <svg className="w-8 h-8 sm:w-9 sm:h-9 drop-shadow-md" viewBox="0 0 100 100" fill="none">
            {/* Outer Orange Radiant Ring */}
            <circle cx="50" cy="50" r="44" stroke="#F97316" strokeWidth="6" strokeDasharray="6 3" />
            {/* Europa Trophy Silhouette */}
            <path
              d="M32 24 L68 24 L64 56 C64 66 58 74 50 78 C42 74 36 66 36 56 Z"
              fill="#F97316"
            />
            <rect x="44" y="78" width="12" height="10" fill="#F97316" rx="2" />
            <rect x="38" y="88" width="24" height="4" fill="#F97316" rx="1" />
            {/* Cutout details */}
            <path d="M42 30 L58 30 L56 50 C56 56 53 62 50 64 C47 62 44 56 44 50 Z" fill="#070A08" />
          </svg>
          <div className="text-[7.5px] sm:text-[8px] font-extrabold text-white uppercase tracking-wider text-center mt-1 leading-tight">
            <span>UEFA</span><br />
            <span className="text-[7px] tracking-normal font-bold text-orange-400">EUROPA</span><br />
            <span className="text-[6.5px] tracking-widest font-semibold text-slate-300">LEAGUE</span>
          </div>
        </div>

        {/* UEFA Conference League */}
        <div className="flex flex-col items-center group cursor-default">
          <svg className="w-8 h-8 sm:w-9 sm:h-9 drop-shadow-md" viewBox="0 0 100 100" fill="none">
            {/* Green Radiant Ring */}
            <circle cx="50" cy="50" r="44" stroke="#22C55E" strokeWidth="6" strokeDasharray="5 3" />
            {/* Conference Trophy Cup */}
            <path
              d="M35 22 L65 22 L61 58 C61 68 56 75 50 78 C44 75 39 68 39 58 Z"
              fill="#22C55E"
            />
            <circle cx="50" cy="42" r="10" fill="#070A08" />
            <rect x="45" y="78" width="10" height="9" fill="#22C55E" rx="1" />
            <rect x="36" y="87" width="28" height="5" fill="#22C55E" rx="2" />
          </svg>
          <div className="text-[7.5px] sm:text-[8px] font-extrabold text-white uppercase tracking-wider text-center mt-1 leading-tight">
            <span>UEFA</span><br />
            <span className="text-[6.5px] tracking-tight font-bold text-emerald-400">CONFERENCE</span><br />
            <span className="text-[6.5px] tracking-widest font-semibold text-slate-300">LEAGUE</span>
          </div>
        </div>
      </div>

      {/* Row 2: Top 5 Domestic Leagues */}
      <div className="flex items-center justify-center gap-3.5 sm:gap-5 pt-1">
        {/* Premier League */}
        <div className="flex flex-col items-center cursor-default">
          <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full bg-[#38003C] flex items-center justify-center border border-purple-400/30 shadow-xs">
            <svg className="w-5 h-5 text-white" viewBox="0 0 100 100" fill="currentColor">
              {/* Crowned Lion silhouette */}
              <path d="M50 15 L58 32 L75 25 L68 42 L85 45 L70 58 L82 75 L62 70 L50 90 L38 70 L18 75 L30 58 L15 45 L32 42 L25 25 L42 32 Z" />
            </svg>
          </div>
          <div className="text-[7px] sm:text-[7.5px] font-bold text-white text-center mt-1 leading-tight">
            <span>Premier</span><br />
            <span className="font-semibold text-slate-300">League</span>
          </div>
        </div>

        {/* LALIGA */}
        <div className="flex flex-col items-center cursor-default">
          <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#FF0046] drop-shadow-sm" viewBox="0 0 100 100" fill="currentColor">
              {/* Modern LaLiga double slash symbol */}
              <path d="M20 20 L42 20 L25 80 L8 80 Z" />
              <path d="M48 20 L70 20 L87 80 L70 80 Z" />
            </svg>
          </div>
          <div className="text-[7.5px] sm:text-[8px] font-black text-[#FF0046] tracking-wider text-center mt-1 uppercase">
            LALIGA
          </div>
        </div>

        {/* SERIE A */}
        <div className="flex flex-col items-center cursor-default">
          <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#008FD7] drop-shadow-sm" viewBox="0 0 100 100" fill="currentColor">
              {/* Serie A 3D diamond 'A' */}
              <polygon points="50,10 85,72 65,72 50,42 35,72 15,72" fill="#008FD7" />
              <polygon points="50,10 85,72 70,72 50,30" fill="#006BB5" />
            </svg>
          </div>
          <div className="text-[7.5px] sm:text-[8px] font-black text-[#008FD7] tracking-wider text-center mt-1 uppercase">
            SERIE A
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <span className="w-1.5 h-0.5 bg-green-500 rounded-xs" />
              <span className="w-1.5 h-0.5 bg-white rounded-xs" />
              <span className="w-1.5 h-0.5 bg-red-500 rounded-xs" />
            </div>
          </div>
        </div>

        {/* BUNDESLIGA */}
        <div className="flex flex-col items-center cursor-default">
          <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-sm bg-[#D20515] flex items-center justify-center shadow-xs">
            <svg className="w-5 h-5 text-white" viewBox="0 0 100 100" fill="currentColor">
              {/* Kicking player silhouette */}
              <circle cx="36" cy="28" r="8" />
              <path d="M38 38 L48 55 L32 78 L26 74 L38 56 L30 46 Z" />
              <path d="M46 42 L65 38 L80 50 L75 55 L63 46 L50 62 L44 58 Z" />
              <circle cx="76" cy="30" r="5" />
            </svg>
          </div>
          <div className="text-[6.5px] sm:text-[7px] font-extrabold text-[#D20515] tracking-tight text-center mt-1 uppercase">
            BUNDESLIGA
          </div>
        </div>

        {/* LIGUE 1 */}
        <div className="flex flex-col items-center cursor-default">
          <div className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center">
            <svg className="w-6 h-6 text-[#1E71B8] drop-shadow-sm" viewBox="0 0 100 100" fill="currentColor">
              {/* Modern angled '1' ribbon */}
              <polygon points="35,15 65,15 50,85 30,85" fill="#1E71B8" />
              <polygon points="35,15 55,15 42,70 22,70" fill="#64B5F6" />
            </svg>
          </div>
          <div className="text-[7.5px] sm:text-[8px] font-black text-[#1E71B8] tracking-wider text-center mt-1 uppercase">
            LIGUE 1
          </div>
        </div>
      </div>
    </div>
  );
}
