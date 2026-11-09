import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserCircle2 } from 'lucide-react';
import { BadgeCheck } from './animate-ui/icons/badge-check';
import { useAuthWallStore } from '../lib/authWallStore';
import { useBackToClose } from '../lib/useBackToClose';

export default function AuthWallModal() {
  const { isOpen, title, message, closeAuthWall } = useAuthWallStore();

  useBackToClose(isOpen, closeAuthWall);

  // Strictly prevent background scrolling and touch drag when modal is active
  useEffect(() => {
    if (isOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-wall-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200 touch-none select-none"
    >
      <div className="relative w-full max-w-[420px]">
        {/* Card Body with Deep Black Obsidian Canvas & Multi-Color Radial Mesh Glows */}
        <div
          className="relative w-full rounded-[28px] overflow-hidden border border-white/15 bg-[#080B09] shadow-[0_24px_70px_-10px_rgba(0,0,0,0.9)] p-6 sm:p-8 text-white select-none animate-in fade-in zoom-in-95 duration-200"
          style={{
            backgroundImage: `
              radial-gradient(circle at 10% 10%, rgba(0, 200, 83, 0.45) 0%, transparent 48%),
              radial-gradient(circle at 60% 45%, rgba(194, 24, 91, 0.40) 0%, transparent 52%),
              radial-gradient(circle at 5% 95%, rgba(2, 136, 209, 0.50) 0%, transparent 50%),
              radial-gradient(circle at 98% 50%, rgba(255, 214, 0, 0.45) 0%, transparent 55%),
              radial-gradient(circle at 90% 95%, rgba(255, 179, 0, 0.40) 0%, transparent 45%)
            `,
          }}
        >
          <div className="relative flex flex-col items-center text-center pt-1">
            <h3 id="auth-wall-title" className="text-xl sm:text-2xl font-extrabold text-white tracking-tight leading-snug">
              {title}
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed max-w-sm">
              {message}
            </p>

            {/* Member Perks List with Uniformly Animating Checkmarks */}
            <div className="w-full my-5 px-1 sm:px-2 text-left space-y-3">
              <div className="flex items-center gap-2.5 text-xs sm:text-[13px] text-slate-100 font-medium">
                <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0 drop-shadow-xs" loop={true} />
                <span>Full access to video highlights &amp; live discussions</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs sm:text-[13px] text-slate-100 font-medium">
                <BadgeCheck className="w-4 h-4 text-emerald-400 shrink-0 drop-shadow-xs" loop={true} />
                <span>Build accumulator slips with live community odds</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs sm:text-[13px] text-slate-100 font-medium">
                <BadgeCheck className="w-4 h-4 text-[#EEAA04] shrink-0 drop-shadow-xs" loop={true} />
                <span>Unlock jackpot consensus &amp; compete for top rank</span>
              </div>
            </div>

            {/* Primary Action Button: Rectangular with rounded corners in Gold with Black Text */}
            <Link
              to="/auth"
              onClick={closeAuthWall}
              className="w-full py-3 sm:py-3.5 px-4 rounded-lg sm:rounded-[10px] bg-[#FFD200] hover:bg-[#FFC000] active:scale-95 text-black font-extrabold text-sm sm:text-[15px] shadow-[0_4px_14px_rgba(255,210,0,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCircle2 size={18} />
              <span>Sign Up / Sign In</span>
            </Link>

            {/* Secondary Exit Button: Faded Ivory White with slightly reduced font weight */}
            <button
              type="button"
              onClick={closeAuthWall}
              className="mt-3.5 text-[#FAF8F2]/75 hover:text-[#FFFFF0] font-medium text-sm sm:text-[14.5px] tracking-wide transition-colors cursor-pointer active:scale-95 px-4 py-1.5 select-none"
            >
              Continue Browsing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
