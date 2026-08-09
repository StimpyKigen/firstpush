import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import {
  Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, ShieldAlert, LifeBuoy, Loader2, Check, Copy,
  KeyRound, AlertCircle, CheckCircle2, Smartphone, X, MessageCircle, Mail, Phone as PhoneIcon,
  ChevronRight, LogOut, Trash2, ImageIcon, Pencil, UserPlus, Share2, Target, Trophy as TrophyIcon, Coins
} from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { useAuth, useCurrentUser } from '../lib/authStore';
import { useWallet } from '../lib/store';
import { useFollowStore } from '../lib/followStore';
import { RECEIVER_MPESA_NUMBER, RECEIVER_NAME, isValidMpesaCode, normalizeCode } from '../lib/mpesa';
import Avatar from '../components/Avatar';
import PinInput from '../components/PinInput';
import AvatarPicker from '../components/AvatarPicker';
import StarRating from '../components/StarRating';
import InviteModal from '../components/InviteModal';
import PunterProfileModal from '../components/PunterProfileModal';
import { getPunterStats } from '../lib/punterRatings';

type Panel = 'none' | 'deposit' | 'withdraw' | 'close' | 'support' | 'avatar';

const depositPresets = [50, 100, 250, 500, 1000];

const faqEntries = [
  { q: 'How long does a withdrawal take?', a: 'Withdrawals are processed instantly in this demo and reflected on your balance right away. In production, M-Pesa B2C payouts typically land within a few minutes.' },
  { q: 'I sent money but my code was rejected', a: 'Double check you copied the exact confirmation code from your M-Pesa SMS (10-12 characters, letters and numbers). Codes can only be redeemed once.' },
  { q: 'Can I recover a closed account?', a: 'Closing your account is permanent and immediately frees up your username and phone number for a new registration. Make sure to withdraw your balance first.' },
];

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

  // Deposit state
  const [depositAmount, setDepositAmount] = useState(100);
  const [depositStage, setDepositStage] = useState<'send' | 'verify'>('send');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [depositError, setDepositError] = useState('');
  const [depositDone, setDepositDone] = useState(false);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState(50);
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawProcessing, setWithdrawProcessing] = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);

  // Close account state
  const [closePin, setClosePin] = useState('');
  const [closeConfirmText, setCloseConfirmText] = useState('');
  const [closeError, setCloseError] = useState('');
  const [closeProcessing, setCloseProcessing] = useState(false);

  if (!currentUser) return <Navigate to="/auth" replace />;

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

  function verifyDeposit() {
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
    setTimeout(() => {
      topUpWithCode(clean, depositAmount);
      setChecking(false);
      setDepositDone(true);
      setCode('');
      setDepositStage('send');
      setTimeout(() => { setDepositDone(false); setPanel('none'); }, 1800);
    }, 1500);
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <SeoHead
        title="My Profile & Settings"
        description="Manage your MshindiRoom profile, avatar settings, followers & account preferences."
        noIndex={true}
      />
      {/* Header */}
      <div className="bg-gradient-to-br from-panel to-ink-2 border border-line rounded-2xl p-5 sm:p-8 mb-6 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-gold/10 rounded-full blur-3xl" />
        <div className="relative flex items-center justify-between gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => { setPendingAvatarId(currentUser.avatarId); setPanel(panel === 'avatar' ? 'none' : 'avatar'); }}
              className="relative group shrink-0"
              title="Change avatar"
            >
              <Avatar name={currentUser.username} seed={currentUser.phone.length} size={56} avatarId={currentUser.avatarId} />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gold border-2 border-ink flex items-center justify-center group-hover:bg-gold-2 transition-colors">
                <Pencil size={10} className="text-ink" />
              </span>
            </button>
            <div className="min-w-0">
              <h1 className="font-display font-extrabold text-xl sm:text-3xl text-cream truncate">{currentUser.username}</h1>
              <div className="flex items-center gap-2 mt-1.5">
                <StarRating rating={getPunterStats(currentUser.username).stars} size={14} />
              </div>
            </div>
          </div>

          {/* Social followers counter */}
          <div className="flex items-center gap-4 bg-ink/60 border border-line/60 rounded-xl px-4 py-2.5">
            <div className="text-center">
              <p className="font-mono font-bold text-sm text-cream">{getFollowersCount(currentUser.username)}</p>
              <p className="text-[10px] text-cream-dim uppercase font-semibold">Followers</p>
            </div>
            <div className="w-px h-6 bg-line" />
            <div className="text-center">
              <p className="font-mono font-bold text-sm text-cream">{getFollowingCount(currentUser.username)}</p>
              <p className="text-[10px] text-cream-dim uppercase font-semibold">Following</p>
            </div>
          </div>
        </div>

        {/* Share & Invite quick action strip */}
        <div className="relative flex flex-wrap items-center gap-2.5 mt-5 pt-4 border-t border-line/60">
          <button
            onClick={() => setShowMyProfileModal(true)}
            className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-panel hover:bg-panel-2 border border-line hover:border-gold/30 text-cream text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Share2 size={13} className="text-gold" />
            Share Profile Link
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex-1 min-w-[140px] py-2 px-3 rounded-xl bg-gold hover:bg-gold-2 text-ink text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow"
          >
            <UserPlus size={13} />
            Invite Friends
          </button>
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-4 mt-5 pt-4 border-t border-dashed border-line">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[11px] text-cream-dim uppercase tracking-wide font-semibold">Wallet Balance</p>
              <p className="font-display font-extrabold text-emerald-2 text-2xl sm:text-3xl">Ksh {balance.toLocaleString()}</p>
            </div>
            <div className="w-px h-8 bg-line" />
            <Link to="/wallet" className="group">
              <p className="text-[11px] text-gold uppercase tracking-wide font-bold flex items-center gap-1">
                <Coins size={12} /> Mshindi Tokens
              </p>
              <p className="font-display font-extrabold text-gold text-2xl sm:text-3xl group-hover:underline">
                {mshindiTokens} <span className="text-xs font-normal text-cream-dim">MT</span>
              </p>
            </Link>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-bold text-cream-dim hover:text-cream border border-line rounded-full px-3 py-2 transition-colors shrink-0"
          >
            <LogOut size={13} /> Log Out
          </button>
        </div>
      </div>

      {/* Punter Rating card */}
      <div className="bg-panel border border-gold/20 rounded-2xl p-6 sm:p-7 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
            <TrophyIcon size={18} className="text-gold" /> Punter Rating
          </h2>
          <StarRating rating={getPunterStats(currentUser.username).stars} size={16} />
        </div>
        <p className="text-xs text-cream-dim leading-relaxed mb-4">
          Your star rating climbs the more accurate picks you land and every time you're crowned closest to the
          winning slip in a jackpot room: up to a maximum of 5 stars.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-ink-2 border border-line rounded-xl p-3.5 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-emerald-2/10 border border-emerald-2/30 flex items-center justify-center shrink-0">
              <Target size={16} className="text-emerald-2" />
            </span>
            <div>
              <p className="font-display font-extrabold text-cream text-lg leading-none">{getPunterStats(currentUser.username).accuracyPct}%</p>
              <p className="text-[11px] text-cream-dim mt-0.5">Pick accuracy</p>
            </div>
          </div>
          <div className="bg-ink-2 border border-line rounded-xl p-3.5 flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
              <TrophyIcon size={16} className="text-gold" />
            </span>
            <div>
              <p className="font-display font-extrabold text-cream text-lg leading-none">{getPunterStats(currentUser.username).closestWins}</p>
              <p className="text-[11px] text-cream-dim mt-0.5">Closest-slip wins</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        <button
          onClick={() => { setPendingAvatarId(currentUser.avatarId); setPanel(panel === 'avatar' ? 'none' : 'avatar'); }}
          className={`h-20 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all ${panel === 'avatar' ? 'bg-gold/10 border-gold/40' : 'bg-panel border-line hover:border-gold/40'}`}
        >
          <ImageIcon size={20} className="text-gold shrink-0" />
          <span className="text-xs font-bold text-cream">Avatar</span>
        </button>
        <button
          onClick={() => setPanel(panel === 'deposit' ? 'none' : 'deposit')}
          className={`h-20 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all ${panel === 'deposit' ? 'bg-emerald-2/10 border-emerald-2/40' : 'bg-panel border-line hover:border-emerald-2/40'}`}
        >
          <ArrowDownLeft size={20} className="text-emerald-2 shrink-0" />
          <span className="text-xs font-bold text-cream">Deposit</span>
        </button>
        <button
          onClick={() => setPanel(panel === 'withdraw' ? 'none' : 'withdraw')}
          className={`h-20 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all ${panel === 'withdraw' ? 'bg-gold/10 border-gold/40' : 'bg-panel border-line hover:border-gold/40'}`}
        >
          <ArrowUpRight size={20} className="text-gold shrink-0" />
          <span className="text-xs font-bold text-cream">Withdraw</span>
        </button>
        <button
          onClick={() => setPanel(panel === 'support' ? 'none' : 'support')}
          className={`h-20 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all ${panel === 'support' ? 'bg-blue-500/10 border-blue-400/40' : 'bg-panel border-line hover:border-blue-400/40'}`}
        >
          <LifeBuoy size={20} className="text-[#3b82f6] shrink-0" />
          <span className="text-xs font-bold text-cream">Support</span>
        </button>
        <button
          onClick={() => setPanel(panel === 'close' ? 'none' : 'close')}
          className={`h-20 flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all ${panel === 'close' ? 'bg-danger/10 border-danger/40' : 'bg-panel border-line hover:border-danger/40'}`}
        >
          <ShieldAlert size={20} className="text-danger shrink-0" />
          <span className="text-xs font-bold text-cream">Close Account</span>
        </button>
      </div>

      {/* AVATAR PANEL */}
      {panel === 'avatar' && (
        <div className="bg-panel border border-gold/30 rounded-2xl p-6 sm:p-7 mb-6 animate-rise">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
              <ImageIcon size={18} className="text-gold" /> Choose Your Avatar
            </h2>
            <button onClick={() => setPanel('none')} className="text-cream-dim hover:text-cream"><X size={18} /></button>
          </div>
          <p className="text-xs text-cream-dim mb-4">Pick a football-themed profile picture for your account.</p>
          <AvatarPicker selected={pendingAvatarId} onSelect={setPendingAvatarId} />
          {avatarSaved && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-2 font-semibold mt-4 animate-rise">
              <CheckCircle2 size={13} /> Avatar updated!
            </p>
          )}
          <button
            onClick={saveAvatar}
            disabled={!pendingAvatarId}
            className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-40 text-ink font-bold text-sm py-3 rounded-lg transition-colors mt-5"
          >
            Save Avatar
          </button>
        </div>
      )}

      {/* DEPOSIT PANEL */}
      {panel === 'deposit' && (
        <div className="bg-panel border border-emerald-2/30 rounded-2xl p-6 sm:p-7 mb-6 animate-rise">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
              <ArrowDownLeft size={18} className="text-emerald-2" /> Deposit via M-Pesa
            </h2>
            <button onClick={() => setPanel('none')} className="text-cream-dim hover:text-cream"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-3 xs:grid-cols-5 gap-2 mb-4">
            {depositPresets.map((p) => (
              <button
                key={p}
                onClick={() => setDepositAmount(p)}
                className={`py-2.5 rounded-lg text-xs xs:text-sm font-bold border transition-colors ${
                  depositAmount === p ? 'bg-emerald-2 border-emerald-2 text-ink' : 'border-line text-cream-dim hover:border-emerald-2/50'
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
              value={depositAmount}
              onChange={(e) => setDepositAmount(Number(e.target.value))}
              className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono text-cream focus:outline-none focus:border-emerald-2"
            />
          </div>

          {depositStage === 'send' ? (
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
                  <span className="font-mono font-bold text-sm text-gold">Ksh {depositAmount}</span>
                </div>
              </div>
              <button
                onClick={() => setDepositStage('verify')}
                className="flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 text-ink font-bold text-sm py-3 rounded-lg transition-colors"
              >
                I've sent the money →
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 animate-rise">
              <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide flex items-center gap-1.5">
                <KeyRound size={13} /> Step 2: Confirm your payment
              </p>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setDepositError(''); }}
                placeholder="e.g. QFT7K9L2M1"
                maxLength={12}
                className="bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono tracking-widest text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold uppercase"
              />
              {depositError && (
                <p className="flex items-center gap-1.5 text-xs text-danger font-semibold"><AlertCircle size={13} /> {depositError}</p>
              )}
              <button
                onClick={verifyDeposit}
                disabled={checking || !code.trim()}
                className="flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-70 text-ink font-bold text-sm py-3 rounded-lg transition-colors"
              >
                {checking ? (<><Loader2 size={16} className="animate-spin" /> Verifying with M-Pesa…</>) : (`Verify & Credit Ksh ${depositAmount}`)}
              </button>
              <button onClick={() => setDepositStage('send')} className="text-xs text-cream-dim hover:text-cream text-center">Back</button>
            </div>
          )}

          {depositDone && (
            <p className="text-xs text-emerald-2 font-semibold mt-3 flex items-center gap-1.5 animate-rise">
              <CheckCircle2 size={13} /> Deposit successful! Balance updated.
            </p>
          )}
        </div>
      )}

      {/* WITHDRAW PANEL */}
      {panel === 'withdraw' && (
        <div className="bg-panel border border-gold/30 rounded-2xl p-6 sm:p-7 mb-6 animate-rise">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
              <ArrowUpRight size={18} className="text-gold" /> Withdraw to M-Pesa
            </h2>
            <button onClick={() => setPanel('none')} className="text-cream-dim hover:text-cream"><X size={18} /></button>
          </div>

          <p className="text-xs text-cream-dim mb-4">Available to withdraw: <span className="font-bold text-cream">Ksh {balance.toLocaleString()}</span></p>

          <div className="mb-4">
            <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide">Amount (Ksh)</label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => { setWithdrawAmount(Number(e.target.value)); setWithdrawError(''); }}
              className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono text-cream focus:outline-none focus:border-gold"
            />
          </div>
          <div className="mb-4">
            <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide">M-Pesa Number to Receive Funds</label>
            <input
              value={withdrawPhone}
              onChange={(e) => { setWithdrawPhone(e.target.value); setWithdrawError(''); }}
              placeholder="07XX XXX XXX"
              className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold"
            />
          </div>

          {withdrawError && (
            <p className="flex items-center gap-1.5 text-xs text-danger font-semibold mb-3"><AlertCircle size={13} /> {withdrawError}</p>
          )}
          {withdrawDone && (
            <p className="flex items-center gap-1.5 text-xs text-emerald-2 font-semibold mb-3 animate-rise"><CheckCircle2 size={13} /> Withdrawal sent! Funds are on the way to your M-Pesa.</p>
          )}

          <button
            onClick={submitWithdraw}
            disabled={withdrawProcessing}
            className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-70 text-ink font-bold text-sm py-3 rounded-lg transition-colors"
          >
            {withdrawProcessing ? (<><Loader2 size={16} className="animate-spin" /> Processing withdrawal…</>) : (`Withdraw Ksh ${withdrawAmount}`)}
          </button>
        </div>
      )}

      {/* SUPPORT PANEL */}
      {panel === 'support' && (
        <div className="bg-panel border border-blue-400/30 rounded-2xl p-6 sm:p-7 mb-6 animate-rise">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
              <LifeBuoy size={18} className="text-[#3b82f6]" /> Customer Support
            </h2>
            <button onClick={() => setPanel('none')} className="text-cream-dim hover:text-cream"><X size={18} /></button>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <a href="https://wa.me/254743304579" target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-ink-2 border border-line hover:border-emerald-2/40 transition-colors text-center">
              <MessageCircle size={20} className="text-emerald-2" />
              <span className="text-xs font-bold text-cream">WhatsApp Chat</span>
              <span className="text-[11px] text-cream-dim font-mono">{RECEIVER_MPESA_NUMBER}</span>
            </a>
            <a href="mailto:support@mshindiroom.co.ke" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-ink-2 border border-line hover:border-gold/40 transition-colors text-center">
              <Mail size={20} className="text-gold" />
              <span className="text-xs font-bold text-cream">Email Us</span>
              <span className="text-[11px] text-cream-dim">support@mshindiroom.co.ke</span>
            </a>
            <a href="tel:+254743304579" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-ink-2 border border-line hover:border-blue-400/40 transition-colors text-center">
              <PhoneIcon size={20} className="text-[#3b82f6]" />
              <span className="text-xs font-bold text-cream">Call Us</span>
              <span className="text-[11px] text-cream-dim font-mono">{RECEIVER_MPESA_NUMBER}</span>
            </a>
          </div>

          <p className="text-xs font-bold text-cream-dim uppercase tracking-wide mb-3">Frequently Asked</p>
          <div className="flex flex-col divide-y divide-line">
            {faqEntries.map((f) => (
              <details key={f.q} className="py-3 group">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-semibold text-cream list-none">
                  {f.q}
                  <ChevronRight size={15} className="text-cream-dim transition-transform group-open:rotate-90" />
                </summary>
                <p className="text-sm text-cream-dim leading-relaxed mt-2">{f.a}</p>
              </details>
            ))}
          </div>
          <Link to="/how-it-works" className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-2 hover:underline mt-4">
            View full How It Works & FAQ page <ChevronRight size={13} />
          </Link>
        </div>
      )}

      {/* CLOSE ACCOUNT PANEL */}
      {panel === 'close' && (
        <div className="bg-panel border border-danger/30 rounded-2xl p-6 sm:p-7 mb-6 animate-rise">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
              <ShieldAlert size={18} className="text-danger" /> Close Your Account
            </h2>
            <button onClick={() => setPanel('none')} className="text-cream-dim hover:text-cream"><X size={18} /></button>
          </div>

          <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-5 flex gap-3">
            <AlertCircle size={18} className="text-danger shrink-0 mt-0.5" />
            <p className="text-xs text-cream-dim leading-relaxed">
              This is permanent. Your username <span className="text-cream font-semibold">{currentUser.username}</span> and phone
              number will be freed up immediately, your wallet balance will be forfeited, and you'll lose access to all
              unlocked rooms. Withdraw your balance first if you don't want to lose it.
            </p>
          </div>

          <div className="mb-4">
            <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide">Type <span className="font-mono text-danger">CLOSE</span> to confirm</label>
            <input
              value={closeConfirmText}
              onChange={(e) => { setCloseConfirmText(e.target.value); setCloseError(''); }}
              placeholder="CLOSE"
              className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-danger uppercase"
            />
          </div>

          <div className="mb-4">
            <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide mb-3 text-center">Enter your PIN to confirm</p>
            <PinInput value={closePin} onChange={(v) => { setClosePin(v); setCloseError(''); }} />
          </div>

          {closeError && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-danger font-semibold mb-3"><AlertCircle size={13} /> {closeError}</p>
          )}

          <button
            onClick={submitCloseAccount}
            disabled={closeProcessing}
            className="w-full flex items-center justify-center gap-2 bg-danger hover:bg-danger/90 disabled:opacity-70 text-white font-bold text-sm py-3 rounded-lg transition-colors"
          >
            {closeProcessing ? (<><Loader2 size={16} className="animate-spin" /> Closing account…</>) : (<><Trash2 size={15} /> Permanently Close Account</>)}
          </button>
        </div>
      )}

      {/* Transaction history */}
      <div className="bg-panel border border-line rounded-2xl p-6 sm:p-7">
        <h2 className="font-display font-bold text-lg text-cream mb-4 flex items-center gap-2">
          <WalletIcon size={18} className="text-emerald-2" /> Recent Activity
        </h2>
        <div className="flex flex-col divide-y divide-line">
          {transactions.length === 0 && <p className="text-sm text-cream-dim py-4 text-center">No activity yet.</p>}
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  tx.type === 'topup' ? 'bg-emerald-2/10 text-emerald-2' : tx.type === 'withdraw' ? 'bg-gold/10 text-gold' : 'bg-panel-2 text-cream-dim'
                }`}>
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

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      {/* Own Profile Modal */}
      {showMyProfileModal && (
        <PunterProfileModal
          username={currentUser.username}
          onClose={() => setShowMyProfileModal(false)}
        />
      )}
    </div>
  );
}
