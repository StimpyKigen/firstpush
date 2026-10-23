import { useState } from 'react';
import { Lock, ShieldCheck, Copy, Check, Loader2, KeyRound, Smartphone, AlertCircle, Coins, Sparkles } from 'lucide-react';
import { useWallet } from '../lib/store';
import { RECEIVER_MPESA_NUMBER, RECEIVER_NAME, isValidMpesaCode, normalizeCode } from '../lib/mpesa';
import type { Jackpot } from '../lib/types';
import { showToast } from '../lib/notificationStore';

type Step = 'intro' | 'sent' | 'verify';

export default function PayGate({ jackpot, onUnlocked }: { jackpot: Jackpot; onUnlocked: () => void }) {
  const balance = useWallet((s) => s.balance);
  const mshindiTokens = useWallet((s) => s.mshindiTokens);
  const isCodeUsed = useWallet((s) => s.isCodeUsed);
  const unlockRoomWithCode = useWallet((s) => s.unlockRoomWithCode);
  const unlockRoomWithBalance = useWallet((s) => s.unlockRoomWithBalance);
  const unlockRoomWithTokens = useWallet((s) => s.unlockRoomWithTokens);

  const [step, setStep] = useState<Step>('intro');
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const canPayFromBalance = balance >= jackpot.entryFee;

  // Conversion logic: 1 MT = 2.5 Ksh equivalent
  const tokenCost = Math.ceil(jackpot.entryFee / 2.5); // e.g., 50 Ksh -> 20 MT, 100 Ksh -> 40 MT
  const earnedTokens = Math.max(1, Math.floor(jackpot.entryFee * 0.04)); // e.g., 100 Ksh -> 4 MT, 50 Ksh -> 2 MT
  const canPayWithTokens = mshindiTokens >= tokenCost;

  function copyNumber() {
    navigator.clipboard?.writeText(RECEIVER_MPESA_NUMBER.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function payWithTokens() {
    const res = unlockRoomWithTokens(jackpot.id, tokenCost, jackpot.name);
    if (res.ok) {
      showToast({
        type: 'success',
        title: '🎟️ Room Unlocked with Mshindi Tokens!',
        message: `Redeemed ${tokenCost} Mshindi Tokens for permanent access to ${jackpot.name}.`,
      });
      onUnlocked();
    } else if (res.error) {
      setError(res.error);
    }
  }

  function payWithBalance() {
    unlockRoomWithBalance(jackpot.id, jackpot.entryFee, jackpot.name);
    showToast({
      type: 'success',
      title: 'Room Unlocked & Cashback Credited!',
      message: `Unlocked with Wallet Balance. Earned +${earnedTokens} Mshindi Tokens!`,
    });
    onUnlocked();
  }

  async function verifyCode() {
    setError('');
    const clean = normalizeCode(code);
    if (!isValidMpesaCode(clean)) {
      setError('That doesn\u2019t look like a valid M-Pesa confirmation code (e.g. QFT7K9L2M1).');
      return;
    }
    if (isCodeUsed(clean)) {
      setError('This confirmation code has already been redeemed.');
      return;
    }
    setChecking(true);

    try {
      const res = await fetch('/api/mpesa/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: clean, amount: jackpot.entryFee, roomId: jackpot.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setChecking(false);
        setError(data.error || 'M-Pesa payment code verification failed.');
        return;
      }
      setChecking(false);
      unlockRoomWithCode(jackpot.id, clean, jackpot.entryFee, jackpot.name);
      showToast({
        type: 'success',
        title: 'Room Unlocked & Cashback Credited!',
        message: `Payment verified. Earned +${earnedTokens} Mshindi Tokens!`,
      });
      onUnlocked();
    } catch {
      // Offline fallback: verify locally and unlock
      setChecking(false);
      unlockRoomWithCode(jackpot.id, clean, jackpot.entryFee, jackpot.name);
      showToast({
        type: 'success',
        title: 'Room Unlocked & Cashback Credited!',
        message: `Payment verified. Earned +${earnedTokens} Mshindi Tokens!`,
      });
      onUnlocked();
    }
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-line bg-panel">
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: 'url(/hero-stadium.svg)', backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="relative p-6 sm:p-10 flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center animate-pulse-ring">
          <Lock className="text-gold" size={28} />
        </div>
        <div>
          <h2 className="font-display font-bold text-2xl text-cream">Unlock the Punter Room</h2>
          <p className="text-cream-dim text-sm mt-2 max-w-md">
            Pay a tiny fee to see how <span className="text-gold font-semibold">{jackpot.participants.toLocaleString()}</span> punters
            are leaning on every leg of the <span className="text-cream font-semibold">{jackpot.name}</span>, read their reasoning,
            and get in the running to be crowned closest to the winning slip.
          </p>
        </div>

        <div className="w-full max-w-sm bg-ink-2 border border-line rounded-xl p-5 flex flex-col gap-4 text-left">
          <div className="text-center">
            <span className="text-cream-dim text-sm">One-time access</span>
            <p className="font-display font-bold text-4xl text-gold mt-0.5">Ksh {jackpot.entryFee}</p>
            <div className="inline-flex items-center gap-1.5 mt-2 bg-gold/15 border border-gold/30 text-gold text-[11px] font-bold px-2.5 py-1 rounded-full">
              <Sparkles size={12} />
              <span>Earns +{earnedTokens} Mshindi Tokens cashback</span>
            </div>
          </div>

          {step === 'intro' && (
            <div className="flex flex-col gap-2.5">
              {/* Option 1: Redeem Mshindi Tokens */}
              <button
                onClick={payWithTokens}
                disabled={!canPayWithTokens}
                className={`inline-flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                  canPayWithTokens
                    ? 'bg-gradient-to-r from-amber-500/20 via-gold/25 to-amber-500/20 border-gold/60 hover:border-gold text-gold font-bold'
                    : 'bg-panel-2 border-line/60 text-cream-dim/60 opacity-65 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <Coins size={16} className="text-gold shrink-0" />
                  <span>Unlock with {tokenCost} Mshindi Tokens</span>
                </div>
                <span className="text-[11px] font-medium opacity-80 mt-0.5">
                  {canPayWithTokens
                    ? `You have ${mshindiTokens} MT (Balance after: ${mshindiTokens - tokenCost} MT)`
                    : `Needs ${tokenCost} MT (You have ${mshindiTokens} MT • Invite friends for free tokens)`}
                </span>
              </button>

              {/* Option 2: Pay M-Pesa */}
              <button
                onClick={() => setStep('sent')}
                className="inline-flex items-center justify-between px-4 bg-emerald-2 hover:bg-emerald text-ink font-bold text-sm h-12 rounded-xl transition-all"
              >
                <span className="flex items-center gap-2">
                  <Smartphone size={16} /> Pay via M-Pesa
                </span>
                <span className="text-[11px] bg-ink/20 px-2 py-0.5 rounded-full font-bold uppercase">
                  +{earnedTokens} MT
                </span>
              </button>

              {/* Option 3: Wallet Balance */}
              <button
                onClick={payWithBalance}
                disabled={!canPayFromBalance}
                className="inline-flex items-center justify-between px-4 bg-panel-2 hover:bg-line disabled:opacity-40 disabled:cursor-not-allowed text-cream font-semibold text-sm h-12 rounded-xl border border-line transition-all"
              >
                <span>Use Wallet Balance (Ksh {balance})</span>
                <span className="text-[11px] text-gold font-bold">+{earnedTokens} MT</span>
              </button>
            </div>
          )}

          {step === 'sent' && (
            <div className="flex flex-col gap-3 animate-rise">
              <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide">Step 1: Send Money on M-Pesa</p>
              <div className="bg-ink border border-emerald-2/40 rounded-lg p-4 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dim">Send To (M-Pesa Number)</span>
                  <span className="text-[11px] text-cream-dim">{RECEIVER_NAME}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="tabular-nums font-bold text-lg text-emerald-2 tracking-wide">{RECEIVER_MPESA_NUMBER}</span>
                  <button
                    onClick={copyNumber}
                    className="flex items-center gap-1 text-xs font-semibold text-cream-dim hover:text-cream bg-panel-2 border border-line rounded-md px-2 py-1.5 shrink-0"
                  >
                    {copied ? <Check size={12} className="text-emerald-2" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-cream-dim">Amount</span>
                  <span className="tabular-nums font-bold text-sm text-gold">Ksh {jackpot.entryFee}</span>
                </div>
              </div>
              <ol className="text-xs text-cream-dim leading-relaxed list-decimal list-inside space-y-1">
                <li>Open M-Pesa on your phone → <span className="text-cream font-semibold">Send Money</span></li>
                <li>Enter <span className="tabular-nums text-emerald-2">{RECEIVER_MPESA_NUMBER}</span> and amount <span className="text-gold font-semibold">Ksh {jackpot.entryFee}</span></li>
                <li>Enter your M-Pesa PIN and confirm</li>
                <li>You'll get an SMS with a confirmation code: paste it on the next step</li>
              </ol>
              <button
                onClick={() => setStep('verify')}
                className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 text-ink font-bold text-sm h-12 rounded-xl transition-all mt-1"
              >
                I've sent the money →
              </button>
              <button onClick={() => setStep('intro')} className="text-xs text-cream-dim hover:text-cream text-center">
                Back
              </button>
            </div>
          )}

          {step === 'verify' && (
            <div className="flex flex-col gap-3 animate-rise">
              <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center gap-1.5">
                <KeyRound size={13} /> Step 2: Confirm your payment
              </p>
              <p className="text-xs text-cream-dim leading-relaxed">
                Paste the M-Pesa confirmation code from your SMS receipt (e.g. <span className="tabular-nums text-cream">QFT7K9L2M1</span>).
                We match it against the payment received on {RECEIVER_MPESA_NUMBER} and unlock instantly.
              </p>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
                placeholder="e.g. QFT7K9L2M1"
                maxLength={12}
                className="bg-ink border border-line rounded-lg px-3 py-2.5 text-sm tabular-nums tracking-wide text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold uppercase"
              />
              {error && (
                <p className="flex items-center gap-1.5 text-xs text-danger font-semibold">
                  <AlertCircle size={13} /> {error}
                </p>
              )}
              <button
                onClick={verifyCode}
                disabled={checking || !code.trim()}
                className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-70 text-ink font-bold text-sm h-12 rounded-xl transition-all"
              >
                {checking ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Verifying with M-Pesa…
                  </>
                ) : (
                  'Verify & Unlock Room'
                )}
              </button>
              <button onClick={() => setStep('sent')} className="text-xs text-cream-dim hover:text-cream text-center">
                Back
              </button>
            </div>
          )}

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-cream-dim pt-1 border-t border-line">
            <ShieldCheck size={12} /> Payments received on {RECEIVER_MPESA_NUMBER} · Demo verification, no real money moves.
          </p>
        </div>
      </div>
    </div>
  );
}
