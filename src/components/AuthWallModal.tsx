import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  UserCircle2,
  ArrowRight,
} from 'lucide-react';
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in touch-none select-none"
    >
      {/* Aesthetic Auth Wall Card */}
      <div className="relative w-full max-w-[420px] bg-[#0c1417] text-white border border-[#006C54]/40 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Subtle Ambient Light Halo */}
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#006C54]/25 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-16 right-0 w-36 h-36 bg-[#EEAA04]/15 rounded-full blur-2xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative flex flex-col items-center text-center">
          <h3 id="auth-wall-title" className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
            {title}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed max-w-sm">
            {message}
          </p>

          {/* Member Perks List (In same position, without bounding border box) */}
          <div className="w-full my-5 px-3.5 text-left space-y-2.5">
            <div className="flex items-center gap-2.5 text-xs text-slate-200">
              <CheckCircle2 size={14} className="text-[#006C54] shrink-0" />
              <span>Full access to video highlights &amp; live discussions</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-200">
              <CheckCircle2 size={14} className="text-[#006C54] shrink-0" />
              <span>Build accumulator slips with live community odds</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-200">
              <CheckCircle2 size={14} className="text-[#EEAA04] shrink-0" />
              <span>Unlock jackpot consensus &amp; compete for top rank</span>
            </div>
          </div>

          {/* Primary Action Button */}
          <Link
            to="/auth"
            onClick={closeAuthWall}
            className="w-full py-3.5 px-5 rounded-2xl bg-[#006C54] hover:bg-[#005441] active:bg-[#004737] text-white font-bold text-sm shadow-lg shadow-[#006C54]/30 hover:shadow-[#006C54]/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <UserCircle2 size={18} />
            <span>Sign Up / Sign In</span>
            <ArrowRight size={16} />
          </Link>

          {/* Secondary Exit Button */}
          <button
            type="button"
            onClick={closeAuthWall}
            className="mt-3 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors py-1.5 px-3 cursor-pointer"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
}
