import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  Lock,
  Play,
  Dices,
  Trophy,
  MessagesSquare,
  CheckCircle2,
  UserCircle2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useAuthWallStore } from '../lib/authWallStore';
import { useBackToClose } from '../lib/useBackToClose';

export default function AuthWallModal() {
  const { isOpen, title, message, actionType, closeAuthWall } = useAuthWallStore();

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

  // Icon mapping for action types
  const renderActionIcon = () => {
    switch (actionType) {
      case 'video':
        return <Play size={24} className="text-[#EEAA04] ml-0.5" fill="currentColor" />;
      case 'builder':
      case 'builder_pick':
        return <Dices size={24} className="text-[#EEAA04]" />;
      case 'jackpot':
        return <Lock size={24} className="text-[#EEAA04]" />;
      case 'leaderboard':
        return <Trophy size={24} className="text-[#EEAA04]" />;
      case 'details':
      case 'discussion':
      default:
        return <MessagesSquare size={24} className="text-[#006C54]" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-wall-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-fade-in touch-none select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthWall();
      }}
    >
      {/* Aesthetic Auth Wall Card */}
      <div className="relative w-full max-w-[420px] bg-[#0c1417] text-white border border-[#006C54]/40 rounded-3xl p-6 sm:p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Subtle Ambient Light Halo */}
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#006C54]/25 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-16 right-0 w-36 h-36 bg-[#EEAA04]/15 rounded-full blur-2xl pointer-events-none"
          aria-hidden="true"
        />

        {/* Dismiss Close Button */}
        <button
          type="button"
          onClick={closeAuthWall}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 active:scale-95 transition-all cursor-pointer z-10"
        >
          <X size={18} />
        </button>

        <div className="relative flex flex-col items-center text-center">
          {/* Action Badge & Glow */}
          <div className="relative mb-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#006C54]/30 via-black/40 to-[#EEAA04]/20 border border-[#006C54]/50 flex items-center justify-center shadow-lg shadow-[#006C54]/20">
              {renderActionIcon()}
            </div>
            <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#006C54] border-2 border-[#0c1417] flex items-center justify-center text-white text-[10px]">
              <Lock size={11} />
            </span>
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#EEAA04] bg-[#EEAA04]/10 border border-[#EEAA04]/25 px-2.5 py-0.5 rounded-full mb-2">
            <Sparkles size={11} /> Punter Access Required
          </span>

          <h3 id="auth-wall-title" className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-snug">
            {title}
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed max-w-sm">
            {message}
          </p>

          {/* Quick Member Perks List */}
          <div className="w-full my-5 py-3 px-3.5 rounded-2xl bg-white/[0.04] border border-white/10 text-left space-y-2">
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

          {/* Secondary Dismiss Button */}
          <button
            type="button"
            onClick={closeAuthWall}
            className="mt-3 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors py-1 px-2 cursor-pointer"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
}
