import { useState } from 'react';
import { Wallet as WalletIcon, CheckCircle2, ArrowUpRight, ArrowDownLeft, Loader2, Copy, Check, KeyRound, AlertCircle, Smartphone, Coins, UserPlus, Sparkles, Gift } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { useWallet } from '../lib/store';
import { RECEIVER_MPESA_NUMBER, RECEIVER_NAME, isValidMpesaCode, normalizeCode } from '../lib/mpesa';
import InviteModal from '../components/InviteModal';

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

  function verifyAndTopUp() {
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
    setTimeout(() => {
      topUpWithCode(clean, amount);
      setTxs((t) => [{ id: Date.now(), type: 'topup', label: 'M-Pesa Top Up', amount, time: 'just now' }, ...t]);
      setChecking(false);
      setDone(true);
      setCode('');
      setStage('send');
      setTimeout(() => setDone(false), 2500);
    }, 1600);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <SeoHead
        title="Wallet & M-Pesa Deposits"
        description="Manage your MshindiRoom wallet, top up via M-Pesa, view token rewards & track transaction history."
        noIndex={true}
      />
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-2/10 border border-emerald-2/30 flex items-center justify-center mb-3">
          <WalletIcon className="text-emerald-2" size={26} />
        </div>
        <h1 className="font-display font-extrabold text-3xl text-cream">Your Wallet &amp; Rewards</h1>
        <p className="text-cream-dim mt-1">Manage M-Pesa top ups and view your earned Mshindi Tokens.</p>
      </div>

      {/* Balance Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* M-Pesa Cash Balance */}
        <div
          onClick={() => setActiveTab('mpesa')}
          className={`cursor-pointer rounded-2xl p-6 border transition-all relative overflow-hidden ${
            activeTab === 'mpesa'
              ? 'bg-gradient-to-br from-panel to-ink-2 border-emerald-2/60 ring-2 ring-emerald-2/30'
              : 'bg-panel border-line hover:border-line/80'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-cream-dim uppercase tracking-wide font-semibold">M-Pesa Wallet Balance</span>
            <span className="w-8 h-8 rounded-full bg-emerald-2/10 border border-emerald-2/30 flex items-center justify-center">
              <WalletIcon size={16} className="text-emerald-2" />
            </span>
          </div>
          <p className="font-display font-extrabold text-4xl text-emerald-2">Ksh {balance.toLocaleString()}</p>
          <p className="text-[11px] text-cream-dim mt-2">Spendable for instant room unlocks &amp; P2P stakes.</p>
        </div>

        {/* Mshindi Tokens Balance */}
        <div
          onClick={() => setActiveTab('tokens')}
          className={`cursor-pointer rounded-2xl p-6 border transition-all relative overflow-hidden ${
            activeTab === 'tokens'
              ? 'bg-gradient-to-br from-panel to-ink-2 border-gold/60 ring-2 ring-gold/30'
              : 'bg-panel border-line hover:border-line/80'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gold uppercase tracking-wide font-bold flex items-center gap-1">
              <Coins size={14} /> Mshindi Tokens
            </span>
            <span className="w-8 h-8 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center">
              <Coins size={16} className="text-gold" />
            </span>
          </div>
          <p className="font-display font-extrabold text-4xl text-gold">{mshindiTokens} <span className="text-lg text-cream-dim">MT</span></p>
          <p className="text-[11px] text-cream-dim mt-2">Earned from room cashback &amp; inviting friends.</p>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex bg-panel border border-line rounded-xl p-1 mb-8">
        <button
          onClick={() => setActiveTab('mpesa')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'mpesa' ? 'bg-emerald-2 text-ink shadow-md' : 'text-cream-dim hover:text-cream'
          }`}
        >
          <Smartphone size={15} /> Top Up M-Pesa Balance
        </button>
        <button
          onClick={() => setActiveTab('tokens')}
          className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'tokens' ? 'bg-gold text-ink shadow-md' : 'text-cream-dim hover:text-cream'
          }`}
        >
          <Coins size={15} /> Mshindi Tokens &amp; Referrals
        </button>
      </div>

      {activeTab === 'mpesa' ? (
        <>
          <div className="bg-panel border border-line rounded-2xl p-6 sm:p-8 mb-8">
            <h2 className="font-display font-bold text-lg text-cream mb-4">Top Up via M-Pesa</h2>

            <div className="grid grid-cols-3 xs:grid-cols-5 gap-2 mb-5">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  className={`inline-flex items-center justify-center h-10 rounded-xl text-xs xs:text-sm font-bold border transition-all ${
                    amount === p ? 'bg-emerald-2 border-emerald-2 text-ink' : 'border-line text-cream-dim hover:border-emerald-2/50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mb-5">
              <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide">Custom Amount (Ksh)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono text-cream focus:outline-none focus:border-emerald-2"
              />
            </div>

            {stage === 'send' ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center gap-1.5">
                  <Smartphone size={13} /> Step 1: Send Money on M-Pesa
                </p>
                <div className="bg-ink-2 border border-emerald-2/40 rounded-lg p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-cream-dim">Send To</span>
                    <span className="text-[11px] text-cream-dim">{RECEIVER_NAME}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-lg text-emerald-2 tracking-wide">{RECEIVER_MPESA_NUMBER}</span>
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
                    <span className="font-mono font-bold text-sm text-gold">Ksh {amount}</span>
                  </div>
                </div>
                <button
                  onClick={() => setStage('verify')}
                  className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 text-ink font-bold text-sm h-12 rounded-xl transition-all"
                >
                  I've sent the money →
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 animate-rise">
                <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center gap-1.5">
                  <KeyRound size={13} /> Step 2: Confirm your payment
                </p>
                <p className="text-xs text-cream-dim leading-relaxed">
                  Paste the M-Pesa confirmation code from your SMS receipt to instantly credit your wallet.
                </p>
                <input
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
                  placeholder="e.g. QFT7K9L2M1"
                  maxLength={12}
                  className="bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono tracking-widest text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold uppercase"
                />
                {error && (
                  <p className="flex items-center gap-1.5 text-xs text-danger font-semibold">
                    <AlertCircle size={13} /> {error}
                  </p>
                )}
                <button
                  onClick={verifyAndTopUp}
                  disabled={checking || !code.trim()}
                  className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-70 text-ink font-bold text-sm h-12 rounded-xl transition-all"
                >
                  {checking ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Verifying with M-Pesa…
                    </>
                  ) : (
                    `Verify & Credit Ksh ${amount}`
                  )}
                </button>
                <button onClick={() => setStage('send')} className="text-xs text-cream-dim hover:text-cream text-center">
                  Back
                </button>
              </div>
            )}

            {done && (
              <p className="text-xs text-emerald-2 font-semibold mt-3 flex items-center gap-1.5 animate-rise">
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
                className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-2 text-ink font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-md"
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
              <span className="text-xs text-cream-dim font-mono">Total Referrals: <strong className="text-emerald-2">{totalReferrals}</strong></span>
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
                  <span className={`text-sm font-bold font-mono shrink-0 ${tx.amount > 0 ? 'text-gold' : 'text-cream-dim'}`}>
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
