import React from 'react';
import { X, Award, Flame, Target, TrendingUp, ShieldCheck, Zap, HelpCircle, Activity } from 'lucide-react';
import { getPlayerProfile } from '../lib/punterRatings';
import { calculateStarsFromRp } from '../lib/ratingEngine';
import Avatar from './Avatar';
import StarRating from './StarRating';
import Modal from './ui/Modal';

interface PlayerProfileModalProps {
  username: string | null;
  onClose: () => void;
}

export default function PlayerProfileModal({ username, onClose }: PlayerProfileModalProps) {
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
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-gold bg-ink/80 border border-gold/30 px-3 py-1 rounded-full">
            <ShieldCheck size={14} className="text-emerald-400" />
            Verified Punter Credentials
          </div>
        </div>

        <div className="px-6 pb-6 pt-0 relative">
          
          {/* Avatar & Header Identity */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-12 mb-6">
            <div className="flex items-end gap-4">
              <div className="p-1 rounded-2xl bg-panel border-2 border-gold shadow-xl">
                <Avatar name={profile.username} seed={profile.avatarSeed} size={56} />
              </div>
              <div className="mb-1">
                <h2 className="font-display font-extrabold text-2xl text-cream flex items-center gap-2">
                  {profile.username}
                </h2>
                <p className="text-xs font-semibold text-gold tracking-wide uppercase">
                  {profile.tierName}
                </p>
              </div>
            </div>

            <div className="bg-ink-2 border border-line rounded-xl px-4 py-2.5 flex items-center gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-cream-dim block">Public Rating</span>
                <StarRating rating={profile.stars} size={16} showNumber={true} />
              </div>
            </div>
          </div>

          {/* RP Progress Bar */}
          <div className="mb-6 bg-ink-2/80 border border-line rounded-xl p-4">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-cream flex items-center gap-1.5 font-bold">
                <Award size={15} className="text-gold" />
                Reputation Points (RP): <span className="text-gold font-mono text-sm">{profile.rp} RP</span>
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
            <div className="flex justify-between items-center text-[10px] text-cream-dim mt-1.5 font-mono">
              <span>{rpMeta.progressPct}% Progress to Next Tier</span>
              <span>Top 2% Elite Punter Ladder</span>
            </div>
          </div>

          {/* Dual Skill Metrics: Hidden MMR & Consistency Score */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="p-3.5 rounded-xl bg-ink/80 border border-gold/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-cream-dim uppercase tracking-wider block">Hidden MMR (Skill Rating)</span>
                <span className="font-display font-extrabold text-xl text-cream font-mono">{profile.mmr} MMR</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center font-bold">
                <Zap size={18} />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-ink/80 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-cream-dim uppercase tracking-wider block">Consistency Index</span>
                <span className="font-display font-extrabold text-xl text-emerald-300 font-mono">{profile.consistencyRating}/100</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold">
                <Activity size={18} />
              </div>
            </div>
          </div>

          {/* Key Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
            <div className="bg-ink-2/60 border border-line p-3 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-cream-dim block">Overall Accuracy</span>
              <span className="font-display font-extrabold text-lg text-cream font-mono">{profile.accuracyPct}%</span>
            </div>

            <div className="bg-ink-2/60 border border-line p-3 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-cream-dim block">Jackpots Played</span>
              <span className="font-display font-extrabold text-lg text-cream font-mono">{profile.totalJackpotsPlayed}</span>
            </div>

            <div className="bg-ink-2/60 border border-line p-3 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-cream-dim block">Top 3 Finishes</span>
              <span className="font-display font-extrabold text-lg text-gold font-mono">{profile.top3Finishes}</span>
            </div>

            <div className="bg-ink-2/60 border border-line p-3 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-cream-dim block">Perfect Slips</span>
              <span className="font-display font-extrabold text-lg text-emerald-300 font-mono">{profile.perfectSlips}</span>
            </div>
          </div>

          {/* Streaks & Rolling Performance */}
          <div className="bg-ink-2/40 border border-line rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-cream uppercase tracking-wide flex items-center gap-1.5">
                <Flame size={15} className="text-amber-400" />
                Streak & Rolling Accuracy Performance
              </h4>
              <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                Active Streak: {profile.currentStreak} 🔥 (Best: {profile.longestStreak})
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-cream-dim mb-1">
                  <span>Last 10 Jackpots Accuracy</span>
                  <span className="font-mono text-cream">{profile.last10Accuracy}%</span>
                </div>
                <div className="w-full bg-ink h-2 rounded-full overflow-hidden border border-line">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${profile.last10Accuracy}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-cream-dim mb-1">
                  <span>Last 25 Jackpots Accuracy</span>
                  <span className="font-mono text-cream">{profile.last25Accuracy}%</span>
                </div>
                <div className="w-full bg-ink h-2 rounded-full overflow-hidden border border-line">
                  <div className="bg-gold h-full rounded-full" style={{ width: `${profile.last25Accuracy}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-cream-dim mb-1">
                  <span>Last 50 Jackpots Accuracy</span>
                  <span className="font-mono text-cream">{profile.last50Accuracy}%</span>
                </div>
                <div className="w-full bg-ink h-2 rounded-full overflow-hidden border border-line">
                  <div className="bg-blue-400 h-full rounded-full" style={{ width: `${profile.last50Accuracy}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* System Rules Brief */}
          <div className="p-3.5 rounded-xl bg-ink/90 border border-line text-[11px] text-cream-dim leading-relaxed flex items-start gap-2">
            <HelpCircle size={16} className="text-gold shrink-0 mt-0.5" />
            <div>
              <strong className="text-cream font-semibold">How Stars are Calculated:</strong> Stars represent sustained accuracy over time.
              RP is awarded based on final rank (+50 max), pick accuracy (+10 max), near-miss mastery (up to +25 RP for 1 match off), odds difficulty scaling (up to 2.0x), and rolling consistency streaks. Missing a jackpot reduces streak progress by only 20% rather than resetting to zero.
            </div>
          </div>

        </div>
      </div>
    </Modal>
  );
}
