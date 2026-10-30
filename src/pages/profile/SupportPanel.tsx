import { Link } from 'react-router-dom';
import { X, MessageCircle, Mail, Phone as PhoneIcon, ChevronRight } from 'lucide-react';
import { RECEIVER_MPESA_NUMBER } from '../../lib/mpesa';

const faqEntries = [
  { q: 'How long does a withdrawal take?', a: 'Withdrawals are processed instantly in this demo and reflected on your balance right away. In production, M-Pesa B2C payouts typically land within a few minutes.' },
  { q: 'I sent money but my code was rejected', a: 'Double check you copied the exact confirmation code from your M-Pesa SMS (10-12 characters, letters and numbers). Codes can only be redeemed once.' },
  { q: 'Can I recover a closed account?', a: 'Closing your account is permanent and immediately frees up your username and phone number for a new registration. Make sure to withdraw your balance first.' },
];

interface SupportPanelProps {
  onClose: () => void;
}

export default function SupportPanel({ onClose }: SupportPanelProps) {
  return (
    <div className="bg-panel border border-blue-400/30 rounded-2xl p-6 sm:p-7 mb-6 animate-rise">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
          Customer Support
        </h2>
        <button onClick={onClose} aria-label="Close" className="text-cream-dim hover:text-cream"><X size={18} /></button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <a href="https://wa.me/254743304579" target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-ink-2 border border-line hover:border-emerald-2/40 transition-colors text-center">
          <MessageCircle size={20} className="text-emerald-2" />
          <span className="text-xs font-bold text-cream">WhatsApp Chat</span>
          <span className="text-[11px] text-cream-dim tabular-nums">{RECEIVER_MPESA_NUMBER}</span>
        </a>
        <a href="mailto:support@mshindiroom.co.ke" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-ink-2 border border-line hover:border-gold/40 transition-colors text-center">
          <Mail size={20} className="text-gold" />
          <span className="text-xs font-bold text-cream">Email Us</span>
          <span className="text-[11px] text-cream-dim">support@mshindiroom.co.ke</span>
        </a>
        <a href="tel:+254743304579" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-ink-2 border border-line hover:border-blue-400/40 transition-colors text-center">
          <PhoneIcon size={20} className="text-[#3b82f6]" />
          <span className="text-xs font-bold text-cream">Call Us</span>
          <span className="text-[11px] text-cream-dim tabular-nums">{RECEIVER_MPESA_NUMBER}</span>
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
  );
}
