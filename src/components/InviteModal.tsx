import { useState } from 'react';
import { X, Copy, Check, Coins } from 'lucide-react';
import { WhatsApp, XformerlyTwitter, Facebook, Telegram } from './icons/SocialIcons';
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

  function handleTwitterShare() {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(inviteText)}`, '_blank');
  }

  function handleFacebookShare() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`, '_blank');
  }

  function handleTelegramShare() {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(inviteText)}`, '_blank');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-ink border border-gold/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-2 rounded-full text-cream-dim hover:text-cream bg-panel hover:bg-panel-2 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="text-center space-y-2 pt-2">
          <h2 className="font-display font-bold text-xl text-cream">Invite Friends &amp; Earn Tokens</h2>
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
            Invite <span className="font-bold text-gold">3 friends</span> = Get <span className="font-bold text-gold">1 Mshindi Token</span>!
          </p>
        </div>

        {/* Invite Link Copy Box */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-cream-dim uppercase tracking-wide">Your Personal Sharable Link</label>
          <div className="bg-ink-2 border border-line rounded-xl p-2.5 flex items-center justify-between gap-2">
            <span className="text-xs tabular-nums text-gold truncate">{inviteUrl}</span>
            <button
              onClick={handleCopy}
              className="py-1.5 px-3 rounded-lg bg-gold hover:bg-gold-2 text-ink font-bold text-xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Social Share Icons */}
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-bold text-cream-dim uppercase tracking-wide text-center">
            Or Share Directly via
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleWhatsAppShare}
              title="Share on WhatsApp"
              aria-label="Share on WhatsApp"
              className="w-11 h-11 rounded-full bg-ink-2 border border-line hover:border-emerald-2/50 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
            >
              <WhatsApp className="w-5 h-5 drop-shadow-xs" />
            </button>
            <button
              onClick={handleTwitterShare}
              title="Share on X"
              aria-label="Share on X"
              className="w-11 h-11 rounded-full bg-ink-2 border border-line hover:border-white/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
            >
              <XformerlyTwitter className="w-4 h-4 fill-white" />
            </button>
            <button
              onClick={handleFacebookShare}
              title="Share on Facebook"
              aria-label="Share on Facebook"
              className="w-11 h-11 rounded-full bg-ink-2 border border-line hover:border-[#0866ff]/50 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
            >
              <Facebook className="w-5 h-5" />
            </button>
            <button
              onClick={handleTelegramShare}
              title="Share on Telegram"
              aria-label="Share on Telegram"
              className="w-11 h-11 rounded-full bg-ink-2 border border-line hover:border-[#229ED9]/50 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
            >
              <Telegram className="w-5 h-5" />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-cream-dim text-center px-2">
          Tokens are credited automatically to your Mshindi Tokens balance as soon as your referral signs up.
        </p>
      </div>
    </Modal>
  );
}
