import { ArrowUpRight, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface WithdrawPanelProps {
  balance: number;
  withdrawAmount: number;
  setWithdrawAmount: (v: number) => void;
  withdrawPhone: string;
  setWithdrawPhone: (v: string) => void;
  withdrawError: string;
  withdrawProcessing: boolean;
  withdrawDone: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export default function WithdrawPanel({
  balance,
  withdrawAmount,
  setWithdrawAmount,
  withdrawPhone,
  setWithdrawPhone,
  withdrawError,
  withdrawProcessing,
  withdrawDone,
  onSubmit,
  onClose,
}: WithdrawPanelProps) {
  return (
    <div className="bg-panel border border-gold/30 rounded-2xl p-6 sm:p-7 mb-6 animate-rise">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
          <ArrowUpRight size={18} className="text-gold" /> Withdraw to M-Pesa
        </h2>
        <button onClick={onClose} aria-label="Close" className="text-cream-dim hover:text-cream"><X size={18} /></button>
      </div>

      <p className="text-xs text-cream-dim mb-4">Available to withdraw: <span className="font-bold text-cream">Ksh {balance.toLocaleString()}</span></p>

      <div className="mb-4">
        <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide">Amount (Ksh)</label>
        <input
          type="number"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(Number(e.target.value))}
          className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2.5 text-sm tabular-nums text-cream focus:outline-none focus:border-gold"
        />
      </div>
      <div className="mb-4">
        <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide">M-Pesa Number to Receive Funds</label>
        <input
          value={withdrawPhone}
          onChange={(e) => setWithdrawPhone(e.target.value)}
          placeholder="07XX XXX XXX"
          className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2.5 text-sm tabular-nums text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold"
        />
      </div>

      {withdrawError && (
        <p className="flex items-center gap-1.5 text-xs text-danger font-semibold mb-3"><AlertCircle size={13} /> {withdrawError}</p>
      )}
      {withdrawDone && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-2 font-semibold mb-3 animate-rise"><CheckCircle2 size={13} /> Withdrawal sent! Funds are on the way to your M-Pesa.</p>
      )}

      <button
        onClick={onSubmit}
        disabled={withdrawProcessing}
        className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-70 text-ink font-bold text-sm py-3 rounded-lg transition-colors"
      >
        {withdrawProcessing ? (<><Loader2 size={16} className="animate-spin" /> Processing withdrawal…</>) : (`Withdraw Ksh ${withdrawAmount}`)}
      </button>
    </div>
  );
}
