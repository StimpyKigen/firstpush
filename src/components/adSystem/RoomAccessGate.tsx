import { useState, useEffect, ReactNode } from 'react';
import { Lock, Tv, Sparkles, ShieldCheck, Clock, CheckCircle2, ChevronRight, Zap, RefreshCw, Smartphone } from 'lucide-react';
import { useAuth, useCurrentUser } from '../../lib/authStore';
import { adStore, useAdStore } from '../../lib/adSystem/adStore';
import { adRegistry } from '../../lib/adSystem/adProviders';
import { AdMedia } from '../../lib/adSystem/types';
import RewardedAdPlayer from './RewardedAdPlayer';
import AdLoadingScreen from './AdLoadingScreen';
import PayGate from '../PayGate';
import type { Jackpot } from '../../lib/types';
import { showToast } from '../../lib/notificationStore';

interface RoomAccessGateProps {
  jackpot: Jackpot;
  children: ReactNode;
  onUnlocked?: () => void;
}

export default function RoomAccessGate({ jackpot, children, onUnlocked }: RoomAccessGateProps) {
  const currentUser = useCurrentUser();
  const userId = currentUser?.phone || currentUser?.username || 'guest-punter';
  const storeSnapshot = useAdStore();

  const [mode, setMode] = useState<'selection' | 'loading_ad' | 'playing_ad' | 'pay_permanent'>('selection');
  const [currentAdMedia, setCurrentAdMedia] = useState<AdMedia | null>(null);
  const [currentChallengeId, setCurrentChallengeId] = useState<string | null>(null);
  const [activeTokenExpiry, setActiveTokenExpiry] = useState<number | null>(null);
  const [timeRemainingStr, setTimeRemainingStr] = useState<string>('');
  const [adBlockerError, setAdBlockerError] = useState<string | null>(null);

  // Check access state
  const accessCheck = adStore.canAccessRoom(userId, jackpot.id);

  // Countdown timer for active temporary token
  useEffect(() => {
    if (!accessCheck.allowed || accessCheck.reason !== 'active_token' || !accessCheck.token) {
      setActiveTokenExpiry(null);
      return;
    }

    const expiry = accessCheck.token.expiresAt;
    setActiveTokenExpiry(expiry);

    function updateRemaining() {
      const remainingMs = expiry - Date.now();
      if (remainingMs <= 0) {
        setTimeRemainingStr('Expired');
        setActiveTokenExpiry(null);
      } else {
        const mins = Math.floor(remainingMs / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        setTimeRemainingStr(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
      }
    }

    updateRemaining();
    const timer = setInterval(updateRemaining, 1000);
    return () => clearInterval(timer);
  }, [accessCheck.allowed, accessCheck.reason, accessCheck.token]);

  async function handleWatchAdClick() {
    setAdBlockerError(null);
    setMode('loading_ad');

    const config = adStore.getConfig();

    // 1. Step 1: Obtain Server-Side Challenge Session from Backend
    const challengeRes = await adStore.requestBackendChallenge(userId, jackpot.id, config.fallbackProvider);
    if (!challengeRes.success || !challengeRes.challengeId) {
      setMode('selection');
      setAdBlockerError(challengeRes.error || 'Ad challenge initialization failed. Ad blocker or rate limit detected.');
      showToast({
        title: 'Ad Access Unavailable',
        message: challengeRes.error || 'Rewarded advertisement unavailable. Ad blocker may be enabled.',
        type: 'error',
      });
      return;
    }

    setCurrentChallengeId(challengeRes.challengeId);

    // 2. Fetch ad media from provider network
    try {
      const media = await adRegistry.fetchAdWithFallbacks(config, jackpot.id);
      if (media) {
        setCurrentAdMedia(media);
        setMode('playing_ad');
      } else {
        setMode('selection');
        setAdBlockerError('Advertisement failed to load. Rewarded access is unavailable until a rewarded advertisement is completed.');
        showToast({
          title: 'Ad Fill Notice',
          message: 'No ad inventory currently available. Try again or unlock permanently.',
          type: 'info',
        });
      }
    } catch (err) {
      setMode('selection');
      setAdBlockerError('Ad request was blocked by browser or network filter. Disable ad blocker to earn access token.');
      showToast({
        title: 'Ad Service Blocked',
        message: 'Could not load advertisement. Please disable ad blocker or use permanent unlock.',
        type: 'error',
      });
    }
  }

  async function handleAdCompleted(media: AdMedia, watchDurationSeconds: number) {
    if (!currentChallengeId) {
      showToast({ title: 'Session Error', message: 'Missing challenge session ID.', type: 'error' });
      setMode('selection');
      return;
    }

    // Server-Side Verification: Submit challenge completion to backend
    showToast({ title: 'Verifying Reward...', message: 'Submitting server-side verification to backend...', type: 'info' });

    const verifyRes = await adStore.verifyBackendReward(
      userId,
      jackpot.id,
      currentChallengeId,
      watchDurationSeconds,
      media.provider
    );

    if (!verifyRes.success) {
      setMode('selection');
      setCurrentAdMedia(null);
      setCurrentChallengeId(null);
      setAdBlockerError(`Reward verification failed: ${verifyRes.error}`);
      showToast({
        title: '🚫 Verification Rejected',
        message: verifyRes.error || 'Server rejected reward claim.',
        type: 'error',
      });
      return;
    }

    // Record analytics log
    adStore.recordImpression({
      userId,
      roomId: jackpot.id,
      provider: media.provider,
      adId: media.adId,
      sponsorName: media.sponsorName,
      requestedAt: Date.now(),
      duration: media.durationSeconds,
      completed: true,
      skipped: false,
      estimatedRevenueKsh: 5.0,
      device: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
    });

    setMode('selection');
    setCurrentAdMedia(null);
    setCurrentChallengeId(null);

    if (onUnlocked) onUnlocked();

    showToast({
      title: '🎟️ Room Access Token Activated!',
      message: `Verified by backend! Granted ${storeSnapshot.config.tokenDurationMinutes}-minute signed access pass to ${jackpot.name}.`,
      type: 'success',
    });
  }

  function handleAdSkipped() {
    setMode('selection');
    setCurrentAdMedia(null);
    showToast({
      title: 'Ad Cancelled',
      message: 'You skipped the advertisement. Room access token was not generated.',
      type: 'info',
    });
  }

  // 1. Granted Access (Permanent or Active Token)
  if (accessCheck.allowed) {
    return (
      <div className="space-y-4">
        {accessCheck.reason === 'active_token' && activeTokenExpiry && (
          <div className="bg-gradient-to-r from-emerald-950/80 via-panel to-emerald-950/80 border border-emerald-500/40 rounded-2xl p-3 px-4 flex flex-wrap items-center justify-between gap-3 shadow-md animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                <Clock size={16} className="animate-spin-slow" />
              </span>
              <div>
                <p className="text-xs font-extrabold text-cream flex items-center gap-1.5">
                  Temporary Room Access Token Active
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 rounded-full font-bold uppercase">
                    Free Ad Pass
                  </span>
                </p>
                <p className="text-[11px] text-cream-dim">
                  Unlimited re-entry to {jackpot.name} for the next <strong className="text-gold font-mono">{timeRemainingStr}</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setMode('pay_permanent')}
              className="text-xs font-bold text-gold hover:text-gold-2 flex items-center gap-1 bg-gold/10 border border-gold/30 px-3 py-1.5 rounded-xl transition-all shrink-0"
            >
              <Zap size={13} /> Upgrade to Permanent
            </button>
          </div>
        )}

        {children}
      </div>
    );
  }

  // 2. Loading Ad preloader state
  if (mode === 'loading_ad') {
    return <AdLoadingScreen onCancel={() => setMode('selection')} />;
  }

  // 3. Playing Ad state
  if (mode === 'playing_ad' && currentAdMedia) {
    return (
      <RewardedAdPlayer
        adMedia={currentAdMedia}
        onComplete={handleAdCompleted}
        onSkipped={handleAdSkipped}
      />
    );
  }

  // 4. Pay Permanent Gate Override
  if (mode === 'pay_permanent') {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setMode('selection')}
          className="text-xs font-bold text-cream-dim hover:text-cream flex items-center gap-1 bg-panel border border-line px-3 py-1.5 rounded-xl transition-colors mb-2"
        >
          ← Back to Access Options
        </button>
        <PayGate jackpot={jackpot} onUnlocked={() => { if (onUnlocked) onUnlocked(); }} />
      </div>
    );
  }

  // 5. Dual Unlock Selection Gate Modal / Card
  return (
    <div className="relative rounded-3xl overflow-hidden border border-line bg-panel shadow-2xl">
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ backgroundImage: 'url(/hero-stadium.svg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      />

      <div className="relative p-6 sm:p-10 flex flex-col items-center text-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/20 via-gold/10 to-amber-500/20 border border-gold/40 flex items-center justify-center shadow-lg animate-pulse">
          <Lock className="text-gold" size={28} />
        </div>

        <div className="max-w-lg">
          <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-cream leading-tight">
            Unlock {jackpot.name}
          </h2>
          <p className="text-cream-dim text-sm mt-2 leading-relaxed">
            Choose how you want to access this room. Watch a short rewarded ad for <strong className="text-emerald-400">15-minute free access</strong> or unlock <strong className="text-gold">permanently</strong> with a one-time payment.
          </p>
        </div>

        {/* Option Cards Grid */}
        <div className="grid sm:grid-cols-2 gap-4 w-full max-w-2xl text-left">
          {/* Option 1: Free Ad Token */}
          <div className="bg-ink-2/80 border border-emerald-500/30 hover:border-emerald-500/60 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all group hover:shadow-lg hover:shadow-emerald-500/5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
                  <Tv size={18} />
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                  Free Access
                </span>
              </div>

              <div>
                <h3 className="font-display font-bold text-lg text-cream group-hover:text-emerald-400 transition-colors">
                  Watch Short Ad
                </h3>
                <p className="text-xs text-cream-dim mt-1 leading-relaxed">
                  Watch a quick ad to receive a <strong className="text-cream">15-minute room access pass</strong>.
                </p>
              </div>

              <ul className="text-[11px] text-cream-dim space-y-1 pt-1">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                  <span>100% Free · No wallet money required</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                  <span>Unlimited re-entry for 15 minutes</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleWatchAdClick}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-2"
            >
              <Tv size={15} />
              <span>Watch Short Ad (Free)</span>
            </button>
          </div>

          {/* Option 2: Permanent Unlock */}
          <div className="bg-ink-2/80 border border-gold/30 hover:border-gold/60 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all group hover:shadow-lg hover:shadow-gold/5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="w-9 h-9 rounded-xl bg-gold/20 text-gold border border-gold/40 flex items-center justify-center">
                  <Zap size={18} />
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-widest bg-gold/20 text-gold border border-gold/40 px-2.5 py-0.5 rounded-full">
                  Permanent Unlock
                </span>
              </div>

              <div>
                <h3 className="font-display font-bold text-lg text-cream group-hover:text-gold transition-colors">
                  Unlock Permanently
                </h3>
                <p className="text-xs text-cream-dim mt-1 leading-relaxed">
                  Pay a one-time fee of <strong className="text-gold font-bold">Ksh {jackpot.entryFee}</strong> to unlock this room permanently.
                </p>
              </div>

              <ul className="text-[11px] text-cream-dim space-y-1 pt-1">
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-gold shrink-0" />
                  <span>Permanent access · Zero ads forever</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="text-gold shrink-0" />
                  <span>Pay via M-Pesa or Wallet Balance</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => setMode('pay_permanent')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-gold via-amber-400 to-gold-2 hover:from-gold-2 hover:to-gold text-black font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 mt-2"
            >
              <Smartphone size={15} />
              <span>Pay Ksh {jackpot.entryFee} (Permanent)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
