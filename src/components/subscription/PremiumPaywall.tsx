import React, { useState, useEffect } from 'react';
import {
  X, Copy, Check, ArrowLeft, Loader2, Sparkles, CheckCircle2
} from 'lucide-react';
import CompetitionLogoStrip from './CompetitionLogoStrip';
import { BadgeCheck } from '@/components/animate-ui/icons/badge-check';
import { useSubscription } from '../../hooks/useSubscription';
import { RECEIVER_MPESA_NUMBER, MPESA_VERIFICATION_STATUS_NOTICE, isValidMpesaCode, normalizeCode } from '../../lib/mpesa';

interface PremiumPaywallProps {
  onCloseOverride?: () => void;
}

export default function PremiumPaywall({ onCloseOverride }: PremiumPaywallProps) {
  const {
    isPaywallOpen,
    closePaywall,
    startTrial,
    verifyPayment,
    isLoading,
    isProcessingPayment,
    error: storeError,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly' | null>(null);
  const [mpesaCode, setMpesaCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [trialSuccessMsg, setTrialSuccessMsg] = useState<string | null>(null);

  // Prevent background scrolling while paywall is open
  useEffect(() => {
    if (!isPaywallOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isPaywallOpen]);

  if (!isPaywallOpen) return null;

  const handleClose = () => {
    setSelectedPlan(null);
    setMpesaCode('');
    setLocalError(null);
    setTrialSuccessMsg(null);
    if (onCloseOverride) {
      onCloseOverride();
    } else {
      closePaywall();
    }
  };

  const handleCopyReceiver = () => {
    const rawNumber = RECEIVER_MPESA_NUMBER.replace(/\s+/g, '');
    navigator.clipboard?.writeText(rawNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartTrial = async () => {
    setLocalError(null);
    const res = await startTrial();
    if (res.ok) {
      setTrialSuccessMsg('🎉 3-day free trial activated! Enjoy uninterrupted MshindiRoom.');
      setTimeout(() => {
        handleClose();
      }, 1500);
    } else {
      setLocalError(res.error || 'Failed to start free trial.');
    }
  };

  const handleVerifyMpesa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const clean = normalizeCode(mpesaCode);
    if (!isValidMpesaCode(clean)) {
      setLocalError('Please enter a valid 10-character M-Pesa transaction code.');
      return;
    }

    if (!selectedPlan) return;

    const res = await verifyPayment({
      plan: selectedPlan,
      mpesaCode: clean,
      amountKsh: selectedPlan === 'weekly' ? 20 : 75,
    });

    if (res.ok) {
      setTrialSuccessMsg(`🎉 Payment verified! ${selectedPlan === 'weekly' ? 'Weekly' : 'Monthly'} plan active.`);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } else {
      setLocalError(res.error || 'Payment verification failed.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="MshindiRoom Premium Subscription"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto"
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
      }}
    >
      {/* ── UNIFIED CARD MODAL CONTAINER (Centered as one cohesive unit) ── */}
      <div className="relative w-full max-w-[400px] sm:max-w-[410px] flex flex-col items-center my-auto py-2">
        {/* ── TOP RIGHT CLOSE BUTTON (Nicely spaced immediately above top-right of pay card) ── */}
        <div className="w-full flex justify-end mb-2.5 sm:mb-3">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close subscription paywall"
            className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer shadow-sm"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* ── MAIN SUBSCRIPTION CARD ── */}
        <div className="relative w-full">
          {/* Colorful Glow Effect Behind the Card Borders */}
          <div className="absolute -inset-1 rounded-[36px] bg-gradient-to-r from-emerald-500/30 via-fuchsia-500/25 to-amber-400/35 blur-xl -z-10 pointer-events-none" />

          {/* Card Body with Deep Black Obsidian Canvas & Multi-Color Radial Mesh Glows */}
          <div
            className={[
              'relative w-full rounded-[32px] overflow-hidden border border-white/15',
              'bg-[#080B09] shadow-[0_24px_70px_-10px_rgba(0,0,0,0.9)] p-5 sm:p-6.5 text-white select-none',
            ].join(' ')}
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
            {/* Success Banner */}
            {trialSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in zoom-in-95 duration-150">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{trialSuccessMsg}</span>
              </div>
            )}

            {/* Error Banner */}
            {(localError || storeError) && !trialSuccessMsg && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-200 text-xs font-semibold animate-in zoom-in-95 duration-150">
                {localError || storeError}
              </div>
            )}

            {selectedPlan === null ? (
              /* ── VIEW A: STANDARD SUBSCRIPTION OFFERING ── */
              <>
                {/* Official Competition Logos Strip */}
                <CompetitionLogoStrip className="mb-5 sm:mb-6" />

                {/* 5 Feature Bullet Points with animated BadgeCheck icons that loop when card is active */}
                <div className="space-y-3 sm:space-y-3.5 mb-6 sm:mb-7 px-1">
                  {/* Point 1 */}
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="pt-0.5 shrink-0">
                      <BadgeCheck animateOnHover />
                    </div>
                    <p className="text-white font-semibold sm:font-bold text-[13.5px] sm:text-[14.5px] leading-snug">
                      Enjoy an uninterrupted Ad-free MshindiRoom experience.
                    </p>
                  </div>

                  {/* Point 2 */}
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="pt-0.5 shrink-0">
                      <BadgeCheck animateOnHover />
                    </div>
                    <p className="text-white font-semibold sm:font-bold text-[13.5px] sm:text-[14.5px] leading-snug">
                      Explore shared betting insights and a growing library of betslips.
                    </p>
                  </div>

                  {/* Point 3 */}
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="pt-0.5 shrink-0">
                      <BadgeCheck animateOnHover />
                    </div>
                    <p className="text-white font-semibold sm:font-bold text-[13.5px] sm:text-[14.5px] leading-snug">
                      Connect with fellow punters in live chat rooms.
                    </p>
                  </div>

                  {/* Point 4 */}
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="pt-0.5 shrink-0">
                      <BadgeCheck animateOnHover />
                    </div>
                    <p className="text-white font-semibold sm:font-bold text-[13.5px] sm:text-[14.5px] leading-snug">
                      Access a variety of powerful betting tools.
                    </p>
                  </div>

                  {/* Point 5 */}
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="pt-0.5 shrink-0">
                      <BadgeCheck animateOnHover />
                    </div>
                    <p className="text-white font-semibold sm:font-bold text-[13.5px] sm:text-[14.5px] leading-snug">
                      Get detailed match information, live scores and football updates.
                    </p>
                  </div>
                </div>

                {/* Subscription Buttons: Ksh 20/week & Ksh 75/month (Rectangular with Aesthetic Rounded Corners & Uniform Gold) */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan('weekly')}
                    className={[
                      'w-full py-3 sm:py-3.5 px-3 rounded-lg sm:rounded-[10px]',
                      'bg-[#FFD200] hover:bg-[#FFC000] active:scale-95',
                      'text-black font-extrabold text-[13.5px] sm:text-[15px]',
                      'shadow-[0_4px_14px_rgba(255,210,0,0.35)] transition-all cursor-pointer text-center',
                    ].join(' ')}
                  >
                    Ksh 20/week
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPlan('monthly')}
                    className={[
                      'w-full py-3 sm:py-3.5 px-3 rounded-lg sm:rounded-[10px]',
                      'bg-[#FFD200] hover:bg-[#FFC000] active:scale-95',
                      'text-black font-extrabold text-[13.5px] sm:text-[15px]',
                      'shadow-[0_4px_14px_rgba(255,210,0,0.35)] transition-all cursor-pointer text-center',
                    ].join(' ')}
                  >
                    Ksh 75/month
                  </button>
                </div>
              </>
            ) : (
              /* ── VIEW B: INTEGRATED M-PESA PAYMENT VERIFICATION ── */
              <form onSubmit={handleVerifyMpesa} className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPlan(null);
                      setLocalError(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={14} /> Back to plans
                  </button>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {selectedPlan === 'weekly' ? 'Ksh 20 / Week' : 'Ksh 75 / Month'}
                  </span>
                </div>

                {/* Step 1: Send via M-Pesa */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 font-semibold">1. Send M-Pesa to Number:</span>
                    <button
                      type="button"
                      onClick={handleCopyReceiver}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-white font-medium cursor-pointer transition-colors"
                    >
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  <div className="text-base font-extrabold text-amber-300 tracking-wider font-mono">
                    {RECEIVER_MPESA_NUMBER}
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Send exactly <strong className="text-white">Ksh {selectedPlan === 'weekly' ? '20' : '75'}</strong> using Send Money.
                  </p>
                </div>

                {/* Step 2: Confirm Transaction Code */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-200">
                    2. Enter M-Pesa Confirmation Code:
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="e.g. QK12345678"
                    value={mpesaCode}
                    onChange={(e) => setMpesaCode(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 text-sm font-mono tracking-wider focus:outline-hidden focus:border-amber-400 transition-colors uppercase"
                    autoFocus
                  />
                  <p className="text-[10px] text-slate-400">
                    Found in your official Safaricom confirmation SMS.
                  </p>
                  <p className="text-[10px] text-amber-200/90 bg-amber-500/10 border border-amber-400/20 rounded-lg px-2.5 py-1.5 leading-relaxed">
                    {MPESA_VERIFICATION_STATUS_NOTICE}
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isProcessingPayment || !mpesaCode.trim()}
                  className={[
                    'w-full py-3.5 rounded-lg sm:rounded-[10px] font-extrabold text-sm',
                    'bg-[#FFD200] hover:bg-[#FFC000] text-black',
                    'hover:brightness-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
                    'shadow-[0_4px_14px_rgba(255,210,0,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2',
                  ].join(' ')}
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Verifying Payment...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Verify &amp; Activate {selectedPlan === 'weekly' ? 'Weekly' : 'Monthly'}
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── 3-DAY FREE TRIAL (Shifted way up, nicely spaced immediately below the paycard) ── */}
        <div className="w-full text-center pt-3.5 sm:pt-4">
          <button
            type="button"
            onClick={handleStartTrial}
            disabled={isLoading || isProcessingPayment}
            className="text-[#FAF8F2]/75 hover:text-[#FFFFF0] font-bold text-sm sm:text-[15px] tracking-wide transition-colors cursor-pointer active:scale-95 px-4 py-1.5 select-none disabled:opacity-50"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Activating trial...
              </span>
            ) : (
              'Start your 3-day trial'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
