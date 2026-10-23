import { useState } from 'react';
import { Wallet as WalletIcon, CheckCircle2, ArrowUpRight, ArrowDownLeft, Loader2, Copy, Check, KeyRound, AlertCircle, Smartphone, Coins, UserPlus, Sparkles, Gift } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { useWallet } from '../lib/store';
import { useCurrentUser } from '../lib/authStore';
import { RECEIVER_MPESA_NUMBER, RECEIVER_NAME, isValidMpesaCode, normalizeCode } from '../lib/mpesa';
import InviteModal from '../components/InviteModal';
import BackNavButton from '../components/BackNavButton';

const presets = [50, 100, 250, 500, 1000];

interface Tx {
  id: number;
  type: 'topup' | 'spend';
  label: string;
  amount: number;
  time: string;
}

const seedTx: Tx[] = [
  { id: 1, type: 'spend', label: 'Unlocked SportPesa Mega Jackpot GW42', amount: -10, time: '2h ago' },
  { id: 2, type: 'topup', label: 'M-Pesa Top Up', amount: 100, time: '1d ago' },
  { id: 3, type: 'spend', label: 'Unlocked Betika Grand Jackpot GW9', amount: -10, time: '3d ago' },
];

export default function WalletPage() {
  const balance = useWallet((s) => s.balance);
  const mshindiTokens = useWallet((s) => s.mshindiTokens);
  const tokenTransactions = useWallet((s) => s.tokenTransactions);
  const totalReferrals = useWallet((s) => s.totalReferrals);
  const isCodeUsed = useWallet((s) => s.isCodeUsed);
  const topUpWithCode = useWallet((s) => s.topUpWithCode);
  const currentUser = useCurrentUser();

  const [activeTab, setActiveTab] = useState<'mpesa' | 'tokens'>('mpesa');
  const [amount, setAmount] = useState(100);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [txs, setTxs] = useState<Tx[]>(seedTx);
  const [done, setDone] = useState(false);
  const [stage, setStage] = useState<'send' | 'verify'>('send');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  function copyNumber() {
    navigator.clipboard?.writeText(RECEIVER_MPESA_NUMBER.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function verifyAndTopUp() {
    setError('');
    const clean = normalizeCode(code);
    if (!isValidMpesaCode(clean)) {
      setError('Enter a valid M-Pesa confirmation code (e.g. QFT7K9L2M1).');
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
        body: JSON.stringify({
          code: clean,
          amount,
          userId: currentUser?.phone,
          roomId: 'wallet-topup',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setChecking(false);
        setError(data.error || 'Payment code verification failed.');
        return;
      }
      topUpWithCode(clean, amount);
      setTxs((t) => [{ id: Date.now(), type: 'topup', label: 'M-Pesa Top Up', amount, time: 'just now' }, ...t]);
      setChecking(false);
      setDone(true);
      setCode('');
      setStage('send');
      setTimeout(() => setDone(false), 2500);
    } catch {
      // Offline fallback
      topUpWithCode(clean, amount);
      setTxs((t) => [{ id: Date.now(), type: 'topup', label: 'M-Pesa Top Up', amount, time: 'just now' }, ...t]);
      setChecking(false);
      setDone(true);
      setCode('');
      setStage('send');
      setTimeout(() => setDone(false), 2500);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <SeoHead
        title="Wallet & M-Pesa Deposits"
        description="Manage your MshindiRoom wallet, top up via M-Pesa, view token rewards & track transaction history."
        noIndex={true}
      />
      <div className="mb-6">
        <BackNavButton fallbackUrl="/" label="Back" />
      </div>
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto rounded-full bg-[#006C54] flex items-center justify-center mb-3 text-white shadow-xs">
          <WalletIcon size={26} />
        </div>
        <h1 className="font-display font-bold text-3xl sm:text-5xl text-slate-900 tracking-tight uppercase">Your Wallet &amp; Rewards</h1>
        <p className="text-slate-600 mt-2 text-sm">Manage M-Pesa top ups and view your earned Mshindi Tokens.</p>
      </div>

      {/* Balance Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* M-Pesa Cash Balance */}
        <div
          onClick={() => setActiveTab('mpesa')}
          className={`cursor-pointer rounded-2xl p-6 border transition-all relative overflow-hidden ${
            activeTab === 'mpesa'
              ? 'bg-white border-[#006C54] ring-2 ring-[#006C54]/20 shadow-md'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide font-bold">M-Pesa Wallet Balance</span>
            <span className="w-8 h-8 rounded-full bg-[#006C54]/10 flex items-center justify-center">
              <WalletIcon size={16} className="text-[#006C54]" />
            </span>
          </div>
          <p className="font-display font-bold text-4xl text-slate-900">Ksh {balance.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-2">Spendable for instant room unlocks &amp; P2P stakes.</p>
        </div>

        {/* Mshindi Tokens Balance */}
        <div
          onClick={() => setActiveTab('tokens')}
          className={`cursor-pointer rounded-2xl p-6 border transition-all relative overflow-hidden ${
            activeTab === 'tokens'
              ? 'bg-white border-[#8A6500]/50 ring-2 ring-[#8A6500]/20 shadow-md'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wide font-bold flex items-center gap-1">
              <Coins size={14} className="text-[#8A6500]" /> Mshindi Tokens
            </span>
            <span className="w-8 h-8 rounded-full bg-[#8A6500]/10 flex items-center justify-center">
              <Coins size={16} className="text-[#8A6500]" />
            </span>
          </div>
          <p className="font-display font-bold text-4xl text-[#8A6500]">{mshindiTokens} <span className="text-lg text-slate-400 font-sans">MT</span></p>
          <p className="text-xs text-slate-500 mt-2">Earned from room cashback &amp; inviting friends.</p>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex bg-white border border-slate-300 rounded-full p-1.5 mb-8 shadow-xs max-w-lg mx-auto">
        <button
          onClick={() => setActiveTab('mpesa')}
          className={`flex-1 py-2 px-4 rounded-full text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
            activeTab === 'mpesa' ? 'bg-[#006C54] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Smartphone size={15} /> Top Up M-Pesa
        </button>
        <button
          onClick={() => setActiveTab('tokens')}
          className={`flex-1 py-2 px-4 rounded-full text-xs font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 ${
            activeTab === 'tokens' ? 'bg-[#006C54] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Coins size={15} /> Tokens &amp; Referrals
        </button>
      </div>

      {activeTab === 'mpesa' ? (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mb-8 shadow-xs">
            <h2 className="font-display font-bold text-xl text-slate-900 uppercase tracking-tight mb-4">Top Up via M-Pesa</h2>

            <div className="grid grid-cols-3 xs:grid-cols-5 gap-2 mb-5">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className={`inline-flex items-center justify-center h-10 rounded-md text-xs xs:text-sm font-bold uppercase tracking-wide border transition-all cursor-pointer ${
                    amount === p ? 'bg-[#006C54] border-[#006C54] text-white shadow-xs' : 'border-slate-200 text-slate-700 hover:border-[#006C54] hover:text-[#006C54]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mb-5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Custom Amount (Ksh)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full mt-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm tabular-nums text-slate-900 focus:outline-none focus:border-[#006C54]"
              />
            </div>

            {stage === 'send' ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Smartphone size={13} className="text-[#006C54]" /> Step 1: Send Money on M-Pesa
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold">Send To</span>
                    <span className="text-xs text-slate-800 font-bold">{RECEIVER_NAME}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="tabular-nums font-bold text-lg text-slate-900 tracking-wide">{RECEIVER_MPESA_NUMBER}</span>
                    <button
                      onClick={copyNumber}
                      className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-md px-3 py-1.5 shrink-0 shadow-2xs active:scale-95 transition-all cursor-pointer"
                    >
                      {copied ? <Check size={12} className="text-[#006C54]" /> : <Copy size={12} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold">Amount</span>
                    <span className="tabular-nums font-bold text-sm text-[#006C54]">Ksh {amount}</span>
                  </div>
                </div>
                <button
                  onClick={() => setStage('verify')}
                  className="inline-flex items-center justify-center gap-2 bg-[#006C54] hover:bg-[#005441] text-white font-bold uppercase tracking-wide text-xs h-12 rounded-md transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  I&apos;ve sent the money →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 animate-rise">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <KeyRound size={13} className="text-[#006C54]" /> Step 2: Confirm your payment
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Paste the M-Pesa confirmation code from your SMS receipt to instantly credit your wallet.
                </p>
                <input
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
                  placeholder="e.g. QFT7K9L2M1"
                  maxLength={12}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm tabular-nums tracking-wide text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] uppercase"
                />
                {error && (
                  <p className="flex items-center gap-1.5 text-xs text-rose-600 font-bold">
                    <AlertCircle size={13} /> {error}
                  </p>
                )}
                <button
                  onClick={verifyAndTopUp}
                  disabled={checking || !code.trim()}
                  className="inline-flex items-center justify-center gap-2 bg-[#006C54] hover:bg-[#005441] disabled:opacity-50 text-white font-bold uppercase tracking-wide text-xs h-12 rounded-md transition-all shadow-xs cursor-pointer"
                >
                  {checking ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Verifying with M-Pesa…
                    </>
                  ) : (
                    `Verify & Credit Ksh ${amount}`
                  )}
                </button>
                <button onClick={() => setStage('send')} className="text-xs text-slate-500 hover:text-slate-900 font-bold uppercase tracking-wide text-center pt-1">
                  Back
                </button>
              </div>
            )}

            {done && (
              <p className="text-xs text-emerald-600 font-bold mt-3 flex items-center gap-1.5 animate-rise">
                <CheckCircle2 size={13} /> Top up successful! Balance updated.
              </p>
            )}
          </div>

          <div className="bg-panel border border-line rounded-2xl p-6 sm:p-8">
            <h2 className="font-display font-bold text-lg text-cream mb-4">Cash Wallet Activity</h2>
            <div className="flex flex-col divide-y divide-line">
              {txs.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'topup' ? 'bg-emerald-2/10 text-emerald-2' : 'bg-gold/10 text-gold'}`}>
                      {tx.type === 'topup' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-cream truncate">{tx.label}</p>
                      <p className="text-xs text-cream-dim">{tx.time}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${tx.amount > 0 ? 'text-emerald-2' : 'text-cream-dim'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Mshindi Tokens Panel */
        <div className="space-y-8 animate-rise">
          {/* How To Earn Card */}
          <div className="bg-gradient-to-br from-panel to-ink-2 border border-gold/40 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-xl text-gold flex items-center gap-2">
                <Gift size={20} /> How Mshindi Tokens Work
              </h2>
              <button
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-[#8A6500] hover:bg-[#6d4f00] text-[#FFFFF0] font-bold text-xs px-3.5 py-2 rounded-full transition-all shadow-md"
              >
                <UserPlus size={14} /> Invite Friends (+4 MT)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-ink/80 border border-line rounded-xl p-4 flex flex-col gap-1.5">
                <span className="text-gold font-bold text-sm flex items-center gap-1.5">
                  <Sparkles size={15} /> 1. Room Cashback
                </span>
                <p className="text-xs text-cream-dim leading-relaxed">
                  Earn tokens automatically whenever you pay to unlock a room (+4 MT for every Ksh 100 spent).
                </p>
              </div>

              <div className="bg-ink/80 border border-line rounded-xl p-4 flex flex-col gap-1.5">
                <span className="text-emerald-2 font-bold text-sm flex items-center gap-1.5">
                  <UserPlus size={15} /> 2. Invite Punters
                </span>
                <p className="text-xs text-cream-dim leading-relaxed">
                  Get <strong className="text-gold">+4 Mshindi Tokens</strong> for every friend who joins using your sharable link.
                </p>
              </div>

              <div className="bg-ink/80 border border-line rounded-xl p-4 flex flex-col gap-1.5">
                <span className="text-gold font-bold text-sm flex items-center gap-1.5">
                  <Coins size={15} /> 3. Unlock Free Rooms
                </span>
                <p className="text-xs text-cream-dim leading-relaxed">
                  Redeem 20 MT (5 invites) to unlock any premium jackpot room for free!
                </p>
              </div>
            </div>
          </div>

          {/* Tokens Transaction History */}
          <div className="bg-panel border border-line rounded-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
                <Coins size={18} className="text-gold" /> Mshindi Token Activity
              </h2>
              <span className="text-xs text-cream-dim tabular-nums">Total Referrals: <strong className="text-emerald-2">{totalReferrals}</strong></span>
            </div>

            <div className="flex flex-col divide-y divide-line">
              {tokenTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tx.amount > 0 ? 'bg-gold/15 text-gold' : 'bg-line text-cream-dim'}`}>
                      <Coins size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-cream truncate">{tx.label}</p>
                      <p className="text-xs text-cream-dim">{tx.time}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold tabular-nums shrink-0 ${tx.amount > 0 ? 'text-gold' : 'text-cream-dim'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} MT
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <InviteModal isOpen={inviteModalOpen} onClose={() => setInviteModalOpen(false)} />
    </div>
  );
}
