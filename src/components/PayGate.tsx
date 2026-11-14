import { useState } from 'react';
import { Copy, Check, Loader2, KeyRound, Smartphone, AlertCircle, Wallet } from 'lucide-react';
import { useWallet } from '../lib/store';
import { useCurrentUser } from '../lib/authStore';
import { useAuthWallStore } from '../lib/authWallStore';
import { RECEIVER_MPESA_NUMBER, RECEIVER_NAME, MPESA_VERIFICATION_STATUS_NOTICE, isValidMpesaCode, normalizeCode } from '../lib/mpesa';
import type { Jackpot } from '../lib/types';
import { showToast } from '../lib/notificationStore';
import InlineError from './errors/InlineError';

type Step = 'intro' | 'sent' | 'verify';

export default function PayGate({ jackpot, onUnlocked }: { jackpot: Jackpot; onUnlocked: () => void }) {
  const currentUser = useCurrentUser();
  const openAuthWall = useAuthWallStore((s) => s.openAuthWall);
  const balance = useWallet((s) => s.balance);
  const mshindiTokens = useWallet((s) => s.mshindiTokens);
  const isCodeUsed = useWallet((s) => s.isCodeUsed);
  const unlockRoomWithTokensServer = useWallet((s) => s.unlockRoomWithTokensServer);
  const unlockRoomWithBalanceServer = useWallet((s) => s.unlockRoomWithBalanceServer);
  const verifyMpesaAndSyncServer = useWallet((s) => s.verifyMpesaAndSyncServer);

  const [step, setStep] = useState<Step>('intro');
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const canPayFromBalance = balance >= jackpot.entryFee;

  // Official Server-Controlled Token Rates:
  // - Standard KSh 10 room unlock = 1 Mshindi Token (1 MT)
  // - Purchase reward rate: KSh 100 = 1 Mshindi Token
  const tokenCost = Math.max(1, Math.ceil(jackpot.entryFee / 10));
  const earnedTokens = Math.floor(jackpot.entryFee / 100);
  const canPayWithTokens = mshindiTokens >= tokenCost && !checking;

  function requireAuth(): boolean {
    if (!currentUser) {
      openAuthWall({
        actionType: 'jackpot',
        title: 'Sign In to Unlock Room',
        message: `Sign up or log in to unlock ${jackpot.name} permanently via M-Pesa, Wallet Balance, or Mshindi Tokens.`,
      });
      return false;
    }
    return true;
  }

  function copyNumber() {
    navigator.clipboard?.writeText(RECEIVER_MPESA_NUMBER.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function payWithTokens() {
    if (!requireAuth()) return;
    setError('');
    setChecking(true);
    const res = await unlockRoomWithTokensServer(jackpot.id, tokenCost, jackpot.name);
    setChecking(false);
    if (res.ok) {
      showToast({
        type: 'success',
        title: '🎟️ Room Unlocked with Mshindi Tokens!',
        message: `Redeemed ${tokenCost} Mshindi Token${tokenCost === 1 ? '' : 's'} for permanent access to ${jackpot.name}.`,
      });
      onUnlocked();
    } else if (res.error) {
      setError(res.error);
    }
  }

  async function payWithBalance() {
    if (!requireAuth()) return;
    setError('');
    setChecking(true);
    const res = await unlockRoomWithBalanceServer(jackpot.id, jackpot.entryFee, jackpot.name);
    setChecking(false);
    if (!res.ok) {
      setError(res.error || 'Could not unlock room with Wallet Balance.');
      return;
    }
    const awarded = res.tokensAwarded ?? earnedTokens;
    showToast({
      type: 'success',
      title: awarded > 0 ? 'Room Unlocked & Token Credited!' : 'Room Unlocked!',
      message:
        awarded > 0
          ? `Unlocked with Wallet Balance. Earned +${awarded} Mshindi Token${awarded === 1 ? '' : 's'}!`
          : `Unlocked ${jackpot.name} with Wallet Balance.`,
    });
    onUnlocked();
  }

  async function verifyCode() {
    if (!requireAuth()) return;
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

    const res = await verifyMpesaAndSyncServer({
      code: clean,
      amount: jackpot.entryFee,
      roomId: jackpot.id,
      roomName: jackpot.name,
      purpose: jackpot.id,
    });
    setChecking(false);

    if (!res.ok) {
      setError(res.error || 'M-Pesa payment code verification failed.');
      return;
    }

    const awarded = res.tokensAwarded ?? earnedTokens;
    showToast({
      type: 'success',
      title: awarded > 0 ? 'Room Unlocked & Token Credited!' : 'Room Unlocked!',
      message:
        awarded > 0
          ? `Payment verified. Earned +${awarded} Mshindi Token${awarded === 1 ? '' : 's'}!`
          : `Payment verified. ${jackpot.name} unlocked!`,
    });
    onUnlocked();
  }

  return (
    <div className="w-full min-h-[45vh] py-6 sm:py-10 flex flex-col items-center justify-center text-center gap-5 mx-auto">
      <div>
        <h2
          className="font-display text-2xl text-cream"
          style={{ fontWeight: 800 }}
        >
          Unlock the Punter Room
        </h2>
        <p className="text-cream-dim text-sm font-semibold mt-2 max-w-md mx-auto">
          Pay a tiny fee to see how punters are leaning on every leg of the <span className="text-cream font-bold">{jackpot.name}</span>, read their reasoning,
          and get in the running to be crowned closest to the winning slip.
        </p>
      </div>

      <div className="w-full max-w-sm mx-auto flex flex-col gap-4 text-left">
        <div className="text-center">
          <span className="text-cream-dim text-sm font-bold">One-time access</span>
          <p className="font-display font-bold text-4xl text-gold mt-0.5">Ksh {jackpot.entryFee}</p>
        </div>

        {step === 'intro' && (
          <div className="w-fit max-w-full mx-auto flex flex-col gap-2.5">
            {/* Option 1: Redeem Mshindi Tokens */}
            <button
              onClick={payWithTokens}
              disabled={!canPayWithTokens}
              className="w-full inline-flex items-center justify-center px-6 bg-gold hover:bg-gold-2 dark:bg-[#FFC72C] dark:hover:bg-[#e0ad1f] disabled:opacity-50 disabled:cursor-not-allowed text-black dark:text-black text-black-force font-bold text-sm h-12 rounded-xl border border-transparent transition-all cursor-pointer"
              style={{ color: '#000000' }}
            >
              <span className="whitespace-nowrap text-black dark:text-black text-black-force" style={{ color: '#000000' }}>
                Unlock with Mshindi Tokens
              </span>
            </button>

            {/* Option 2: Pay M-Pesa */}
            <button
              onClick={() => {
                if (!requireAuth()) return;
                setStep('sent');
              }}
              className="w-full inline-flex items-center justify-center px-6 bg-emerald-2 hover:bg-emerald text-[#FFFFF0] dark:text-[#FFFFF0] font-bold text-sm h-12 rounded-xl border border-transparent transition-all cursor-pointer"
            >
              <span className="flex items-center gap-2 whitespace-nowrap">
                <Smartphone size={16} className="shrink-0 text-[#FFFFF0]" />
                <span>Pay via M-Pesa</span>
              </span>
            </button>

            {/* Option 3: Wallet Balance */}
            <button
              onClick={payWithBalance}
              disabled={!canPayFromBalance}
              className="w-full inline-flex items-center justify-center px-6 bg-[#FFFFFF] hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-black dark:text-black text-black-force font-bold text-sm h-12 rounded-xl border border-line transition-all cursor-pointer"
              style={{ color: '#000000' }}
            >
              <span className="flex items-center gap-2 whitespace-nowrap text-black dark:text-black text-black-force" style={{ color: '#000000' }}>
                <Wallet size={16} className="shrink-0 text-black dark:text-black text-black-force" style={{ color: '#000000' }} />
                <span>Use Wallet Balance</span>
              </span>
            </button>
            <InlineError message={error} domain="payment" className="mt-1" />
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
            <p className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2 leading-relaxed">
              {MPESA_VERIFICATION_STATUS_NOTICE}
            </p>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
              placeholder="e.g. QFT7K9L2M1"
              maxLength={12}
              className="bg-ink border border-line rounded-lg px-3 py-2.5 text-sm tabular-nums tracking-wide text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold uppercase"
            />
            <InlineError message={error} domain="payment" />
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
      </div>
    </div>
  );
}
