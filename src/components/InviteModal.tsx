import { useState } from 'react';
import { X, UserPlus, Copy, Check, MessageCircle, Sparkles, Send, Coins, Users } from 'lucide-react';
import { useCurrentUser } from '../lib/authStore';
import { useWallet } from '../lib/store';
import { showToast } from '../lib/notificationStore';
import Modal from './ui/Modal';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const currentUser = useCurrentUser();
  const mshindiTokens = useWallet((s) => s.mshindiTokens);
  const totalReferrals = useWallet((s) => s.totalReferrals);
  const [copied, setCopied] = useState(false);

  const inviterName = currentUser?.username || 'Punter';
  const inviteUrl = `${window.location.origin}/auth?ref=${encodeURIComponent(inviterName)}`;

  const inviteText = `Join me on MshindiRoom: Kenya's #1 Jackpot Consensus & Bet Slip platform! Predict 17-leg jackpots, share slips, and earn Mshindi Tokens. Sign up with my link: ${inviteUrl}`;

  function handleCopy() {
    navigator.clipboard?.writeText(inviteUrl);
    setCopied(true);
    showToast({ type: 'success', title: 'Invite link copied!', message: 'Share it with your friends or betting groups.' });
    setTimeout(() => setCopied(false), 2000);
  }

  function handleWhatsAppShare() {
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, '_blank');
  }

  function handleSmsShare() {
    window.open(`sms:?body=${encodeURIComponent(inviteText)}`, '_blank');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-ink border border-gold/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 rounded-full text-cream-dim hover:text-cream bg-panel hover:bg-panel-2 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="text-center space-y-2 pt-2">
          <div className="w-12 h-12 rounded-full bg-gold/15 border border-gold/30 text-gold flex items-center justify-center mx-auto">
            <UserPlus size={24} />
          </div>
          <h2 className="font-display font-bold text-xl text-cream">Invite Friends & Earn Tokens</h2>
          <p className="text-xs text-cream-dim leading-relaxed max-w-xs mx-auto">
            Get rewarded with <span className="text-gold font-bold">Mshindi Tokens</span> every time a punter joins using your referral link!
          </p>
        </div>

        {/* Token Referral Banner */}
        <div className="bg-gradient-to-br from-panel to-ink-2 border border-gold/40 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gold/10 rounded-full blur-2xl" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gold uppercase tracking-wide flex items-center gap-1.5">
              <Coins size={15} /> Referral Bonus
            </span>
            <span className="text-xs tabular-nums font-bold text-cream bg-panel border border-line px-2.5 py-0.5 rounded-full">
              Your Tokens: <span className="text-gold">{mshindiTokens} MT</span>
            </span>
          </div>
          <p className="text-xs text-cream leading-relaxed">
            Invite <span className="font-bold text-gold">5 friends</span> = Get <span className="font-bold text-gold">20 Mshindi Tokens</span> (Enough to unlock <span className="underline decoration-gold">1 Premium Room for FREE</span>)!
          </p>
          <div className="flex items-center justify-between text-[11px] text-cream-dim pt-1 border-t border-line/60">
            <span className="flex items-center gap-1"><Users size={12} className="text-emerald-2" /> Total Referrals: <strong className="text-cream">{totalReferrals}</strong></span>
            <span className="text-gold font-semibold">+4 MT per successful invite</span>
          </div>
        </div>

        {/* Invite Link Copy Box */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-cream-dim uppercase tracking-wide">Your Personal Sharable Link</label>
          <div className="bg-ink-2 border border-line rounded-xl p-2.5 flex items-center justify-between gap-2">
            <span className="text-xs tabular-nums text-gold truncate">{inviteUrl}</span>
            <button
              onClick={handleCopy}
              className="py-1.5 px-3 rounded-lg bg-gold hover:bg-gold-2 text-ink font-bold text-xs flex items-center gap-1 shrink-0 transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Quick Share Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={handleWhatsAppShare}
            className="py-3 px-4 rounded-xl bg-emerald-2/15 border border-emerald-2/40 text-emerald-2 hover:bg-emerald-2/25 font-bold text-xs flex items-center justify-center gap-2 transition-all"
          >
            <MessageCircle size={16} />
            Share via WhatsApp
          </button>
          <button
            onClick={handleSmsShare}
            className="py-3 px-4 rounded-xl bg-blue-500/15 border border-blue-400/40 text-blue-400 hover:bg-blue-500/25 font-bold text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Send size={16} />
            Share via SMS
          </button>
        </div>

        <div className="bg-panel border border-line rounded-xl p-3 text-[11px] text-cream-dim flex items-center gap-2">
          <Sparkles size={14} className="text-gold shrink-0" />
          <span>Tokens are credited automatically to your Mshindi Tokens balance as soon as your referral signs up.</span>
        </div>
      </div>
    </Modal>
  );
}
