import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import {
  Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, ShieldAlert, LifeBuoy,
  ImageIcon, Pencil, UserPlus, Share2, Target, Trophy as TrophyIcon, Coins, LogOut
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

      {panel === 'avatar' && (
        <AvatarPanel
          pendingAvatarId={pendingAvatarId}
          setPendingAvatarId={setPendingAvatarId}
          avatarSaved={avatarSaved}
          onSave={saveAvatar}
          onClose={() => setPanel('none')}
        />
      )}

      {panel === 'deposit' && (
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
      )}

      {panel === 'withdraw' && (
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
      )}

      {panel === 'support' && <SupportPanel onClose={() => setPanel('none')} />}

      {panel === 'close' && (
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
