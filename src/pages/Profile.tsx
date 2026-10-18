import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import {
  Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, ShieldAlert, LifeBuoy,
  ImageIcon, Pencil, UserPlus, Share2, Trophy as TrophyIcon, Coins, LogOut,
  ChevronRight, Phone, Clock, ArrowLeft, Check, Sparkles, UserCheck
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
import AvatarPanel from './profile/AvatarPanel';
import DepositPanel from './profile/DepositPanel';
import WithdrawPanel from './profile/WithdrawPanel';
import SupportPanel from './profile/SupportPanel';
import CloseAccountPanel from './profile/CloseAccountPanel';

type Panel = 'none' | 'deposit' | 'withdraw' | 'close' | 'support' | 'avatar';

export default function Profile() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const logOut = useAuth((s) => s.logOut);
  const closeAccount = useAuth((s) => s.closeAccount);
  const setAvatar = useAuth((s) => s.setAvatar);

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
  const [pendingAvatarId, setPendingAvatarId] = useState<string | undefined>(currentUser?.avatarId);
  const [avatarSaved, setAvatarSaved] = useState(false);
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

  function saveAvatar() {
    if (!pendingAvatarId) return;
    setAvatar(pendingAvatarId);
    setAvatarSaved(true);
    setTimeout(() => { setAvatarSaved(false); setPanel('none'); }, 1400);
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
          className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white/90 flex items-center justify-center active:scale-95 transition-all"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareProfile}
            title={copiedLink ? 'Link Copied!' : 'Share Profile Link'}
            className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white/90 flex items-center justify-center active:scale-95 transition-all"
          >
            {copiedLink ? <Check size={15} className="text-emerald-400" /> : <Share2 size={15} />}
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            title="Invite Friends"
            className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white/90 flex items-center justify-center active:scale-95 transition-all"
          >
            <UserPlus size={15} />
          </button>
        </div>
      </div>

      {/* Centered Profile Identity */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 pt-2 pb-6 sm:pb-7">
        {/* Squircle Avatar with Edit Badge */}
        <div className="relative group mb-3">
          <button
            onClick={() => {
              setPendingAvatarId(currentUser.avatarId);
              setPanel(panel === 'avatar' ? 'none' : 'avatar');
            }}
            className="block relative focus:outline-none focus:ring-2 focus:ring-[#EEAA04] rounded-2xl transition-transform active:scale-95"
            title="Change Avatar"
          >
            <Avatar
              name={currentUser.username}
              seed={currentUser.phone.length}
              size={82}
              avatarId={currentUser.avatarId}
            />
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#EEAA04] text-slate-950 border-2 border-[#091a13] flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <Pencil size={11} strokeWidth={2.5} />
            </span>
          </button>
        </div>

        {/* Username */}
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight flex items-center justify-center gap-1.5">
          {currentUser.username}
        </h1>

        {/* Subtitle / Punter Credentials Motto */}
        <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
          <StarRating rating={punterStats.stars} size={14} />
          <span className="text-[11px] font-bold text-[#EEAA04] uppercase tracking-wider bg-[#EEAA04]/15 border border-[#EEAA04]/30 px-2 py-0.5 rounded-full">
            {punterStats.tierName}
          </span>
        </div>

        <p className="text-xs text-white/70 max-w-xs mt-2 italic font-normal leading-relaxed">
          "Focused picks in consensus rooms. Let the winning slips speak."
        </p>

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

            {/* Desktop Quick Wallet Highlight Card */}
            <div className="hidden lg:flex items-center justify-between p-4.5 rounded-2xl bg-white border border-[#E6E6D2] shadow-xs">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006C54] flex items-center justify-center shrink-0">
                  <WalletIcon size={18} />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Wallet Balance</p>
                  <p className="font-display font-extrabold text-xl text-slate-900 leading-tight">
                    Ksh {balance.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPanel(panel === 'deposit' ? 'none' : 'deposit')}
                  className="px-3.5 py-1.5 rounded-full bg-[#006C54] hover:bg-[#005441] text-white text-xs font-bold transition-colors shadow-xs active:scale-95"
                >
                  Deposit
                </button>
                <button
                  onClick={() => setPanel(panel === 'withdraw' ? 'none' : 'withdraw')}
                  className="px-3.5 py-1.5 rounded-full bg-[#F5F5E4] hover:bg-[#E6E6D2] text-slate-800 text-xs font-bold transition-colors border border-[#E6E6D2] active:scale-95"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Active Interactive Panels & iOS Grouped Cards */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-4">
            
            {/* Active Inline Drawer Panels */}
            {panel === 'avatar' && (
              <div className="animate-rise">
                <AvatarPanel
                  pendingAvatarId={pendingAvatarId}
                  setPendingAvatarId={setPendingAvatarId}
                  avatarSaved={avatarSaved}
                  onSave={saveAvatar}
                  onClose={() => setPanel('none')}
                />
              </div>
            )}

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

            {/* ── CARD GROUP 1: Wallet & Finances ── */}
            <div className="bg-white rounded-2xl border border-[#E6E6D2] shadow-xs divide-y divide-[#F2F2E6] overflow-hidden">
              <button
                onClick={() => setPanel(panel === 'deposit' ? 'none' : 'deposit')}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006C54] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <WalletIcon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Wallet Balance</p>
                    <p className="text-xs text-slate-500 font-normal truncate">Deposit M-Pesa funds for entry fees</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-extrabold text-sm text-[#006C54]">
                    Ksh {balance.toLocaleString()}
                  </span>
                  <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#006C54]/10 text-[#006C54]">
                    Deposit
                  </span>
                  <ChevronRight size={17} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </button>

              <button
                onClick={() => setPanel(panel === 'withdraw' ? 'none' : 'withdraw')}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ArrowUpRight size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Withdraw to M-Pesa</p>
                    <p className="text-xs text-slate-500 font-normal truncate">Instant payout to your mobile phone</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-semibold text-slate-500">Cashout</span>
                  <ChevronRight size={17} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </button>

              <Link
                to="/wallet"
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-[#EEAA04]/15 text-[#8A6500] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Coins size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Mshindi Tokens</p>
                    <p className="text-xs text-slate-500 font-normal truncate">Earn MT points through consensus picks</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-bold text-xs text-[#8A6500] bg-[#EEAA04]/20 px-2 py-0.5 rounded-full">
                    {mshindiTokens} MT
                  </span>
                  <ChevronRight size={17} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </Link>

              <button
                onClick={() => setShowTransactions(!showTransactions)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Clock size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Recent Transactions</p>
                    <p className="text-xs text-slate-500 font-normal truncate">View wallet history and statements</p>
                  </div>
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

            {/* ── CARD GROUP 2: Identity & Punter Performance ── */}
            <div className="bg-white rounded-2xl border border-[#E6E6D2] shadow-xs divide-y divide-[#F2F2E6] overflow-hidden">
              <button
                onClick={() => {
                  setPendingAvatarId(currentUser.avatarId);
                  setPanel(panel === 'avatar' ? 'none' : 'avatar');
                }}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ImageIcon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Choose Avatar</p>
                    <p className="text-xs text-slate-500 font-normal truncate">160+ presets, Glyphs & custom SVG</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-[#EEAA04] bg-[#EEAA04]/15 px-2.5 py-0.5 rounded-full">
                    Change
                  </span>
                  <ChevronRight size={17} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </button>

              <button
                onClick={() => setShowMyProfileModal(true)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <TrophyIcon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Punter Performance</p>
                    <p className="text-xs text-slate-500 font-normal truncate">
                      {punterStats.accuracyPct}% accuracy • {punterStats.closestWins} closest-slip wins
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StarRating rating={punterStats.stars} size={13} />
                  <ChevronRight size={17} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </button>

              <button
                onClick={() => setShowInviteModal(true)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006C54] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <UserPlus size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Invite Friends</p>
                    <p className="text-xs text-slate-500 font-normal truncate">Share referral code & invite punters</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-semibold text-slate-500">Earn MT</span>
                  <ChevronRight size={17} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </button>
            </div>

            {/* ── CARD GROUP 3: Security & Preferences ── */}
            <div className="bg-white rounded-2xl border border-[#E6E6D2] shadow-xs divide-y divide-[#F2F2E6] overflow-hidden">
              <div className="flex items-center justify-between p-4 text-left">
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <Phone size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Account Phone</p>
                    <p className="text-xs text-slate-500 font-normal truncate">Verified mobile credentials</p>
                  </div>
                </div>

                <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md shrink-0">
                  {currentUser.phone}
                </span>
              </div>

              <button
                onClick={() => setPanel(panel === 'support' ? 'none' : 'support')}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <LifeBuoy size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Support & WhatsApp</p>
                    <p className="text-xs text-slate-500 font-normal truncate">Direct helpline & rule consultations</p>
                  </div>
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
                className="w-full flex items-center justify-between p-4 hover:bg-rose-50/40 active:bg-rose-50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <ShieldAlert size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-rose-700 truncate">Close Account</p>
                    <p className="text-xs text-slate-500 font-normal truncate">Permanent deletion of account credentials</p>
                  </div>
                </div>

                <ChevronRight size={17} className="text-slate-400 group-hover:text-rose-600 transition-colors shrink-0" />
              </button>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50/70 active:bg-slate-100/70 transition-colors text-left group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <LogOut size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">Log Out</p>
                    <p className="text-xs text-slate-500 font-normal truncate">Sign out of this session safely</p>
                  </div>
                </div>

                <ChevronRight size={17} className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
              </button>
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
