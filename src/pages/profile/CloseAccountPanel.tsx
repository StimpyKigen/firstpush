import { ShieldAlert, X, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import PinInput from '../../components/PinInput';
import type { Account } from '../../lib/authStore';

interface CloseAccountPanelProps {
  currentUser: Account;
  closePin: string;
  setClosePin: (v: string) => void;
  closeConfirmText: string;
  setCloseConfirmText: (v: string) => void;
  closeError: string;
  closeProcessing: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export default function CloseAccountPanel({
  currentUser,
  closePin,
  setClosePin,
  closeConfirmText,
  setCloseConfirmText,
  closeError,
  closeProcessing,
  onSubmit,
  onClose,
}: CloseAccountPanelProps) {
  return (
    <div className="bg-panel border border-danger/30 rounded-2xl p-6 sm:p-7 mb-6 animate-rise">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
          <ShieldAlert size={18} className="text-danger" /> Close Your Account
        </h2>
        <button onClick={onClose} className="text-cream-dim hover:text-cream"><X size={18} /></button>
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
          onChange={(e) => setCloseConfirmText(e.target.value)}
          placeholder="CLOSE"
          className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-danger uppercase"
        />
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-cream-dim uppercase tracking-wide mb-3 text-center">Enter your PIN to confirm</p>
        <PinInput value={closePin} onChange={setClosePin} />
      </div>

      {closeError && (
        <p className="flex items-center justify-center gap-1.5 text-xs text-danger font-semibold mb-3"><AlertCircle size={13} /> {closeError}</p>
      )}

      <button
        onClick={onSubmit}
        disabled={closeProcessing}
        className="w-full flex items-center justify-center gap-2 bg-danger hover:bg-danger/90 disabled:opacity-70 text-white font-bold text-sm py-3 rounded-lg transition-colors"
      >
        {closeProcessing ? (<><Loader2 size={16} className="animate-spin" /> Closing account…</>) : (<><Trash2 size={15} /> Permanently Close Account</>)}
      </button>
    </div>
  );
}
