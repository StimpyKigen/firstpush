import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import {
  Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, ShieldAlert, LifeBuoy,
  UserPlus, Share2, Trophy as TrophyIcon, Coins, LogOut,
  ChevronRight, Phone, Clock, ArrowLeft, Check, Sparkles, UserCheck,
  Instagram, Facebook
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { useAuth, useCurrentUser } from '../lib/authStore';
import { useWallet } from '../lib/store';
import { useFollowStore } from '../lib/followStore';
import { RECEIVER_MPESA_NUMBER, isValidMpesaCode, normalizeCode } from '../lib/mpesa';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import InviteModal from '../components/InviteModal';
import PunterProfileModal from '../components/PunterProfileModal';
import { getPunterStats } from '../lib/punterRatings';
import DepositPanel from './profile/DepositPanel';
import WithdrawPanel from './profile/WithdrawPanel';
import SupportPanel from './profile/SupportPanel';
import CloseAccountPanel from './profile/CloseAccountPanel';

type Panel = 'none' | 'deposit' | 'withdraw' | 'close' | 'support';

export default function Profile() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const logOut = useAuth((s) => s.logOut);
  const closeAccount = useAuth((s) => s.closeAccount);

  const balance = useWallet((s) => s.balance);
  const mshindiTokens = useWallet((s) => s.mshindiTokens);
  const transactions = useWallet((s) => s.transactions);
  const isCodeUsed = useWallet((s) => s.isCodeUsed);
  const topUpWithCode = useWallet((s) => s.topUpWithCode);
  const withdraw = useWallet((s) => s.withdraw);
  const resetWallet = useWallet((s) => s.resetWallet);

  const getFollowersCount = useFollowStore((s) => s.getFollowersCount);
  const getFollowingCount = useFollowStore((s) => s.getFollowingCount);

  const [panel, setPanel] = useState<Panel>('none');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMyProfileModal, setShowMyProfileModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);

  // Deposit state
  const [depositAmount, setDepositAmount] = useState(100);
  const [depositStage, setDepositStage] = useState<'send' | 'verify'>('send');
  const [code, setCodeRaw] = useState('');
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [depositDone, setDepositDone] = useState(false);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmountRaw] = useState(50);
  const [withdrawPhone, setWithdrawPhoneRaw] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawProcessing, setWithdrawProcessing] = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);

  // Close account state
  const [closePin, setClosePinRaw] = useState('');
  const [closeConfirmText, setCloseConfirmTextRaw] = useState('');
  const [closeError, setCloseError] = useState('');
  const [closeProcessing, setCloseProcessing] = useState(false);

  if (!currentUser) return <Navigate to="/auth" replace />;

  const punterStats = getPunterStats(currentUser.username);
  const followers = getFollowersCount(currentUser.username);
  const following = getFollowingCount(currentUser.username);

  function setCode(v: string) {
    setCodeRaw(v);
    setDepositError('');
  }

  function setWithdrawAmount(v: number) {
    setWithdrawAmountRaw(v);
    setWithdrawError('');
  }

  function setWithdrawPhone(v: string) {
    setWithdrawPhoneRaw(v);
    setWithdrawError('');
  }

  function setCloseConfirmText(v: string) {
    setCloseConfirmTextRaw(v);
    setCloseError('');
  }

  function setClosePin(v: string) {
    setClosePinRaw(v);
    setCloseError('');
  }

  function copyNumber() {
    navigator.clipboard?.writeText(RECEIVER_MPESA_NUMBER.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleShareProfile() {
    const url = `${window.location.origin}/punters/${encodeURIComponent(currentUser.username)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setShowMyProfileModal(true);
    }
  }

  async function verifyDeposit() {
    setDepositError('');
    const clean = normalizeCode(code);
    if (!isValidMpesaCode(clean)) {
      setDepositError('Enter a valid M-Pesa confirmation code (e.g. QFT7K9L2M1).');
      return;
    }
    if (isCodeUsed(clean)) {
      setDepositError('This confirmation code has already been redeemed.');
      return;
    }
    setChecking(true);
    try {
      const res = await fetch('/api/mpesa/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: clean,
          amount: depositAmount,
          userId: currentUser?.phone,
          roomId: 'profile-deposit',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setChecking(false);
        setDepositError(data.error || 'Payment code verification failed.');
        return;
      }
      topUpWithCode(clean, depositAmount);
      setChecking(false);
      setDepositDone(true);
      setCodeRaw('');
      setDepositStage('send');
      setTimeout(() => { setDepositDone(false); setPanel('none'); }, 1800);
    } catch {
      // Offline fallback
      topUpWithCode(clean, depositAmount);
      setChecking(false);
      setDepositDone(true);
      setCodeRaw('');
      setDepositStage('send');
      setTimeout(() => { setDepositDone(false); setPanel('none'); }, 1800);
    }
  }

  function submitWithdraw() {
    setWithdrawError('');
    if (withdrawPhone.replace(/\D/g, '').length < 9) {
      setWithdrawError('Enter the M-Pesa number to receive your withdrawal.');
      return;
    }
    setWithdrawProcessing(true);
    setTimeout(() => {
      const res = withdraw(withdrawAmount);
      setWithdrawProcessing(false);
      if (!res.ok) {
        setWithdrawError(res.error ?? 'Withdrawal failed.');
        return;
      }
      setWithdrawDone(true);
      setTimeout(() => { setWithdrawDone(false); setPanel('none'); }, 1800);
    }, 1500);
  }

  function submitCloseAccount() {
    setCloseError('');
    if (closeConfirmText.trim().toUpperCase() !== 'CLOSE') {
      setCloseError('Type CLOSE in the confirmation box to proceed.');
      return;
    }
    if (closePin.length !== 4) {
      setCloseError('Enter your 4-digit PIN to confirm.');
      return;
    }
    setCloseProcessing(true);
    setTimeout(() => {
      const res = closeAccount(closePin);
      setCloseProcessing(false);
      if (!res.ok) {
        setCloseError(res.error ?? 'Could not close account.');
        return;
      }
      resetWallet();
      navigate('/');
    }, 1200);
  }

  function handleLogout() {
    logOut();
    navigate('/');
  }

  // Cover Card Component used both standalone on mobile and left-column on desktop
  const HeroCoverCard = (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0e2c20] via-[#091a13] to-[#05100c] text-white shadow-xl border border-[#1b3d2f]">
      {/* Stadium backdrop texture & warm gradient glow */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity pointer-events-none"
        style={{ backgroundImage: 'url(/hero-stadium.svg)' }}
      />
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#EEAA04]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-[#006C54]/25 rounded-full blur-3xl pointer-events-none" />

      {/* Top action row */}
      <div className="relative z-10 flex items-center justify-between p-4 sm:p-5 pb-0">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="p-1 text-white hover:text-[#EEAA04] drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] flex items-center justify-center active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft size={22} className="stroke-[2.5]" />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleShareProfile}
            title={copiedLink ? 'Link Copied!' : 'Share Profile Link'}
            className="p-1 text-white hover:text-[#EEAA04] drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            {copiedLink ? <Check size={21} className="text-emerald-400 stroke-[2.5]" /> : <Share2 size={21} className="stroke-[2.5]" />}
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            title="Invite Friends"
            className="p-1 text-white hover:text-[#EEAA04] drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] flex items-center justify-center active:scale-95 transition-all cursor-pointer"
          >
            <UserPlus size={21} className="stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Centered Profile Identity */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 pt-2 pb-6 sm:pb-7">
        {/* Squircle Avatar without edit badge */}
        <div className="relative mb-3">
          <Avatar
            name={currentUser.username}
            seed={currentUser.phone.length}
            size={84}
            avatarId={currentUser.avatarId}
          />
        </div>

        {/* Username */}
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight flex items-center justify-center gap-1.5">
          {currentUser.username}
        </h1>

        {/* Star Rating directly below username */}
        <div className="flex items-center justify-center mt-2">
          <StarRating rating={punterStats.stars} size={15} />
        </div>

        {/* Social / Accuracy Stats Pills */}
        <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-white/10 w-full max-w-sm">
          <div className="text-center flex-1">
            <p className="font-mono font-bold text-base text-white">{followers}</p>
            <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Followers</p>
          </div>
          <div className="w-px h-6 bg-white/15" />
          <div className="text-center flex-1">
            <p className="font-mono font-bold text-base text-white">{following}</p>
            <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Following</p>
          </div>
          <div className="w-px h-6 bg-white/15" />
          <div className="text-center flex-1">
            <p className="font-mono font-bold text-base text-emerald-400">{punterStats.accuracyPct}%</p>
            <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Accuracy</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-slate-800 pb-20">
      <SeoHead
        title="My Profile & Settings"
        description="Manage your MshindiRoom profile, avatar settings, wallet & account preferences."
        noIndex={true}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8">
        {/* Desktop: 2-column layout; Mobile: Stack with hero cover at top */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* Left Column: Hero Cover Card on Desktop / Standalone Hero on Mobile */}
          <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-20 space-y-4">
            {HeroCoverCard}
          </div>

          {/* Right Column: Active Interactive Panels & iOS Grouped Cards */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-4">
            
            {/* Active Inline Drawer Panels */}
            {panel === 'deposit' && (
              <div className="animate-rise">
                <DepositPanel
                  depositAmount={depositAmount}
                  setDepositAmount={setDepositAmount}
                  depositStage={depositStage}
                  setDepositStage={setDepositStage}
                  code={code}
                  setCode={setCode}
                  copied={copied}
                  checking={checking}
                  depositError={depositError}
                  depositDone={depositDone}
                  onCopyNumber={copyNumber}
                  onVerify={verifyDeposit}
                  onClose={() => setPanel('none')}
                />
              </div>
            )}

            {panel === 'withdraw' && (
              <div className="animate-rise">
                <WithdrawPanel
                  balance={balance}
                  withdrawAmount={withdrawAmount}
                  setWithdrawAmount={setWithdrawAmount}
                  withdrawPhone={withdrawPhone}
                  setWithdrawPhone={setWithdrawPhone}
                  withdrawError={withdrawError}
                  withdrawProcessing={withdrawProcessing}
                  withdrawDone={withdrawDone}
                  onSubmit={submitWithdraw}
                  onClose={() => setPanel('none')}
                />
              </div>
            )}

            {panel === 'support' && (
              <div className="animate-rise">
                <SupportPanel onClose={() => setPanel('none')} />
              </div>
            )}

            {panel === 'close' && (
              <div className="animate-rise">
                <CloseAccountPanel
                  currentUser={currentUser}
                  closePin={closePin}
                  setClosePin={setClosePin}
                  closeConfirmText={closeConfirmText}
                  setCloseConfirmText={setCloseConfirmText}
                  closeError={closeError}
                  closeProcessing={closeProcessing}
                  onSubmit={submitCloseAccount}
                  onClose={() => setPanel('none')}
                />
              </div>
            )}

            {/* ── CARD GROUP 1: Unified Wallet, Cashout & Mshindi Tokens ── */}
            <div className="bg-white rounded-2xl border border-[#E6E6D2] shadow-xs divide-y divide-[#F2F2E6] overflow-hidden">
              {/* Wallet Balance with inline Deposit & Withdraw to M-Pesa actions */}
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <WalletIcon size={22} className="text-[#006C54] shrink-0 stroke-[2.2]" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Wallet Balance</p>
                    <p className="font-display font-extrabold text-2xl text-slate-900 tracking-tight leading-tight">
                      Ksh {balance.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    onClick={() => setPanel(panel === 'deposit' ? 'none' : 'deposit')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowDownLeft size={14} />
                    Deposit
                  </button>
                  <button
                    onClick={() => setPanel(panel === 'withdraw' ? 'none' : 'withdraw')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#F5F5E4] hover:bg-[#E6E6D2] text-slate-800 text-xs font-bold transition-all border border-[#E6E6D2] active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowUpRight size={14} />
                    Withdraw
                  </button>
                </div>
              </div>

              {/* Mshindi Tokens (MT) Row */}
              <Link
                to="/wallet"
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">Mshindi Tokens</p>
                  <p className="text-xs text-slate-500 font-normal truncate">Consensus room prediction rewards</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-xs text-[#8A6500] bg-[#EEAA04]/20 px-2.5 py-0.5 rounded-full">
                    {mshindiTokens} MT
                  </span>
                  <ChevronRight size={17} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </Link>

              {/* Expandable Recent Transactions Row */}
              <button
                onClick={() => setShowTransactions(!showTransactions)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">Recent Transactions</p>
                  <p className="text-xs text-slate-500 font-normal truncate">View wallet history and statements</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-semibold text-slate-500">{transactions.length} records</span>
                  <ChevronRight
                    size={17}
                    className={`text-slate-400 group-hover:text-slate-600 transition-transform ${
                      showTransactions ? 'rotate-90' : ''
                    }`}
                  />
                </div>
              </button>
            </div>

            {/* Expandable Transaction History List */}
            {showTransactions && (
              <div className="bg-white rounded-2xl border border-[#E6E6D2] p-5 shadow-xs animate-rise space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-[#F2F2E6]">
                  <h3 className="font-display font-bold text-sm text-slate-900">Wallet Statements</h3>
                  <span className="text-xs text-slate-500">{transactions.length} total entries</span>
                </div>

                {transactions.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No transactions recorded yet.</p>
                ) : (
                  <div className="divide-y divide-[#F2F2E6]">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              tx.type === 'topup'
                                ? 'bg-emerald-50 text-emerald-700'
                                : tx.type === 'withdraw'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {tx.type === 'topup' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{tx.label}</p>
                            <p className="text-[10px] text-slate-400">{tx.time}</p>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-mono font-bold shrink-0 ${
                            tx.amount > 0 ? 'text-[#006C54]' : 'text-slate-600'
                          }`}
                        >
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── CARD GROUP 2: Punter Performance ── */}
            <div className="bg-white rounded-2xl border border-[#E6E6D2] shadow-xs divide-y divide-[#F2F2E6] overflow-hidden">
              <button
                onClick={() => setShowMyProfileModal(true)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">Punter Performance</p>
                  <p className="text-xs text-slate-500 font-normal truncate">
                    {punterStats.accuracyPct}% accuracy • {punterStats.closestWins} closest-slip wins
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StarRating rating={punterStats.stars} size={13} />
                  <ChevronRight size={17} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </button>
            </div>

            {/* ── CARD GROUP 3: Security & Preferences ── */}
            <div className="bg-white rounded-2xl border border-[#E6E6D2] shadow-xs divide-y divide-[#F2F2E6] overflow-hidden">
              <div className="flex items-center justify-between p-4 text-left">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">Account Phone</p>
                  <p className="text-xs text-slate-500 font-normal truncate">Verified mobile credentials</p>
                </div>

                <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md shrink-0">
                  {currentUser.phone}
                </span>
              </div>

              <button
                onClick={() => setPanel(panel === 'support' ? 'none' : 'support')}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">Support & WhatsApp</p>
                  <p className="text-xs text-slate-500 font-normal truncate">Direct helpline & rule consultations</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    24/7 Care
                  </span>
                  <ChevronRight size={17} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </button>

              <button
                onClick={() => setPanel(panel === 'close' ? 'none' : 'close')}
                className="w-full flex items-center justify-between p-4 hover:bg-rose-50/40 active:bg-rose-50 transition-colors text-left group cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-rose-700 truncate">Close Account</p>
                  <p className="text-xs text-slate-500 font-normal truncate">Permanent deletion of account credentials</p>
                </div>

                <ChevronRight size={17} className="text-slate-400 group-hover:text-rose-600 transition-colors shrink-0" />
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">Log Out</p>
                  <p className="text-xs text-slate-500 font-normal truncate">Sign out of this session safely</p>
                </div>

                <ChevronRight size={17} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
              </button>
            </div>

            {/* ── Mobile-Only Policies & Legal + Social Links (Terminus of Scrolling) ── */}
            <div className="pt-6 pb-0 space-y-3.5 text-center lg:hidden -mb-4">
              {/* Policies & Legal (2 compact rows) */}
              <div className="space-y-1.5 text-[11px] font-semibold text-slate-500">
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <Link to="/terms" className="hover:text-[#006C54] transition-colors">Terms of Use</Link>
                  <span className="text-slate-300">·</span>
                  <Link to="/privacy" className="hover:text-[#006C54] transition-colors">Privacy Policy</Link>
                  <span className="text-slate-300">·</span>
                  <Link to="/how-it-works" className="hover:text-[#006C54] transition-colors">How It Works</Link>
                </div>
                <div className="flex items-center justify-center gap-3 flex-wrap text-slate-400">
                  <a href="mailto:support@mshindi.co.ke" className="hover:text-[#006C54] transition-colors">Support &amp; Inquiries</a>
                  <span className="text-slate-300">·</span>
                  <span>Responsible Gaming (18+)</span>
                </div>
              </div>

              {/* Follow Mshindi Social Icons */}
              <div className="flex flex-col items-center gap-2 pt-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Follow Mshindi</p>
                <div className="flex items-center justify-center gap-2.5">
                  {/* Instagram */}
                  <a
                    href="https://www.instagram.com/mshindiroom?igsh=MWhxZ3B0c2UweWswaw%3D%3D&utm_source=qr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-white hover:bg-[#006C54] hover:text-white border border-slate-300 text-slate-700 active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-xs"
                    title="Instagram"
                    aria-label="Instagram"
                  >
                    <Instagram size={14} />
                  </a>
                  {/* X (Twitter) */}
                  <a
                    href="https://x.com/mshindiroom?s=21"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-white hover:bg-[#006C54] hover:text-white border border-slate-300 text-slate-700 active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-xs"
                    title="X (Twitter)"
                    aria-label="X"
                  >
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  {/* TikTok */}
                  <a
                    href="https://www.tiktok.com/@mshindiroom"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-white hover:bg-[#006C54] hover:text-white border border-slate-300 text-slate-700 active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-xs"
                    title="TikTok"
                    aria-label="TikTok"
                  >
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
                      <path d="M12.525 2.25c.01 0 .02.001.03 0h3.587c.078 2.053 1.258 3.868 3.08 4.717.848.397 1.777.614 2.778.63v3.66c-1.391-.01-2.735-.39-3.92-1.085v6.524c0 4.414-3.578 7.992-7.992 7.992S2.096 21.121 2.096 16.707c0-4.322 3.433-7.85 7.734-7.987v3.693c-2.26.13-4.047 2.002-4.047 4.294 0 2.379 1.929 4.307 4.307 4.307 2.378 0 4.307-1.928 4.307-4.307V2.25z" />
                    </svg>
                  </a>
                  {/* Facebook */}
                  <a
                    href="https://www.facebook.com/share/18zCYvkaYQ/?mibextid=wwXIfr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-white hover:bg-[#006C54] hover:text-white border border-slate-300 text-slate-700 active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-xs"
                    title="Facebook"
                    aria-label="Facebook"
                  >
                    <Facebook size={14} />
                  </a>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 mb-0 pb-0">© 2026 MshindiRoom · 18+</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Invite Friends Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      {/* Public Profile Preview Modal */}
      {showMyProfileModal && (
        <PunterProfileModal
          username={currentUser.username}
          onClose={() => setShowMyProfileModal(false)}
        />
      )}
    </div>
  );
}
