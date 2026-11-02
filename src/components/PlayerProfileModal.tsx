import React, { useEffect } from 'react';
import { X, Award, Flame, ShieldCheck } from 'lucide-react';
import { getPlayerProfile } from '../lib/punterRatings';
import { calculateStarsFromRp } from '../lib/ratingEngine';
import Avatar from './Avatar';
import Modal from './ui/Modal';

interface PlayerProfileModalProps {
  username: string | null;
  onClose: () => void;
}

export default function PlayerProfileModal({ username, onClose }: PlayerProfileModalProps) {
  useEffect(() => {
    if (username) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [username]);

  if (!username) return null;

  const profile = getPlayerProfile(username);
  const rpMeta = calculateStarsFromRp(profile.rp);

  return (
    <Modal isOpen={true} onClose={onClose} overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-panel border border-gold/30 rounded-2xl shadow-2xl overflow-hidden my-8">
        
        {/* Top Decorative Banner */}
        <div className="h-28 bg-gradient-to-r from-emerald-900/60 via-ink-2 to-gold/20 relative p-6 flex items-end justify-between">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-ink/60 border border-line text-cream-dim hover:text-cream transition-all"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-2 text-xs tabular-nums font-bold text-gold bg-ink/80 border border-gold/30 px-3 py-1 rounded-full">
            <ShieldCheck size={14} className="text-emerald-400" />
            Verified Punter Credentials
          </div>
        </div>

        <div className="px-6 pb-6 pt-0 relative">
          
          {/* Avatar & Header Identity */}
          <div className="flex items-end gap-4 -mt-12 mb-6">
            <Avatar name={profile.username} seed={profile.avatarSeed} size={56} />
            <div className="mb-1">
              <h2 className="font-display font-bold text-2xl text-cream flex items-center gap-2">
                {profile.username}
              </h2>
              <p className="text-xs font-semibold text-gold tracking-wide uppercase">
                {profile.tierName}
              </p>
            </div>
          </div>

          {/* RP Progress Bar */}
          <div className="mb-6 bg-ink-2/80 border border-line rounded-xl p-4">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-cream flex items-center gap-1.5 font-bold">
                <Award size={15} className="text-gold" />
                Reputation Points (RP): <span className="text-gold tabular-nums text-sm">{profile.rp} RP</span>
              </span>
              <span className="text-cream-dim text-[11px]">
                {profile.rp >= 700 ? 'Max Star Rank Achieved' : `Next Rank at ${rpMeta.nextTierRp} RP`}
              </span>
            </div>
            
            <div className="w-full bg-ink h-3 rounded-full overflow-hidden border border-line p-0.5">
              <div
                className="bg-gradient-to-r from-emerald-400 via-gold to-amber-400 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.min(100, Math.max(5, rpMeta.progressPct))}%` }}
              />
            </div>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            <div className="bg-ink-2/60 border border-line p-3 rounded-xl text-center">
              <span className="text-[11px] uppercase font-bold text-cream-dim block">Overall Accuracy</span>
              <span className="font-display font-bold text-lg text-cream tabular-nums">{profile.accuracyPct}%</span>
            </div>

            <div className="bg-ink-2/60 border border-line p-3 rounded-xl text-center">
              <span className="text-[11px] uppercase font-bold text-cream-dim block">Jackpots Played</span>
              <span className="font-display font-bold text-lg text-cream tabular-nums">{profile.totalJackpotsPlayed}</span>
            </div>

            <div className="bg-ink-2/60 border border-line p-3 rounded-xl text-center">
              <span className="text-[11px] uppercase font-bold text-cream-dim block">Top 3 Finishes</span>
              <span className="font-display font-bold text-lg text-gold tabular-nums">{profile.top3Finishes}</span>
            </div>
          </div>

          {/* Streaks & Rolling Performance */}
          <div className="bg-ink-2/40 border border-line rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-cream uppercase tracking-wide flex items-center gap-1.5">
                <Flame size={15} className="text-amber-400" />
                Streak & Rolling Accuracy Performance
              </h4>
              <span className="text-[11px] font-bold text-amber-300">
                Active Streak: {profile.currentStreak} (Best: {profile.longestStreak})
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-cream-dim mb-1">
                  <span>Last 10 Jackpots Accuracy</span>
                  <span className="tabular-nums text-cream">{profile.last10Accuracy}%</span>
                </div>
                <div className="w-full bg-ink h-2 rounded-full overflow-hidden border border-line">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${profile.last10Accuracy}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-cream-dim mb-1">
                  <span>Last 25 Jackpots Accuracy</span>
                  <span className="tabular-nums text-cream">{profile.last25Accuracy}%</span>
                </div>
                <div className="w-full bg-ink h-2 rounded-full overflow-hidden border border-line">
                  <div className="bg-gold h-full rounded-full" style={{ width: `${profile.last25Accuracy}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-cream-dim mb-1">
                  <span>Last 50 Jackpots Accuracy</span>
                  <span className="tabular-nums text-cream">{profile.last50Accuracy}%</span>
                </div>
                <div className="w-full bg-ink h-2 rounded-full overflow-hidden border border-line">
                  <div className="bg-blue-400 h-full rounded-full" style={{ width: `${profile.last50Accuracy}%` }} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Modal>
  );
}
