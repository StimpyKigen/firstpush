import { ArrowDownLeft, X, Smartphone, KeyRound, AlertCircle, CheckCircle2, Check, Copy, Loader2 } from 'lucide-react';
import { RECEIVER_MPESA_NUMBER, RECEIVER_NAME } from '../../lib/mpesa';

const depositPresets = [50, 100, 250, 500, 1000];

interface DepositPanelProps {
  depositAmount: number;
  setDepositAmount: (v: number) => void;
  depositStage: 'send' | 'verify';
  setDepositStage: (v: 'send' | 'verify') => void;
  code: string;
  setCode: (v: string) => void;
  copied: boolean;
  checking: boolean;
  depositError: string;
  depositDone: boolean;
  onCopyNumber: () => void;
  onVerify: () => void;
  onClose: () => void;
}

export default function DepositPanel({
  depositAmount,
  setDepositAmount,
  depositStage,
  setDepositStage,
  code,
  setCode,
  copied,
  checking,
  depositError,
  depositDone,
  onCopyNumber,
  onVerify,
  onClose,
}: DepositPanelProps) {
  return (
    <div className="bg-panel border border-emerald-2/30 rounded-2xl p-6 sm:p-7 mb-6 animate-rise">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-lg text-cream flex items-center gap-2">
          <ArrowDownLeft size={18} className="text-emerald-2" /> Deposit via M-Pesa
        </h2>
        <button onClick={onClose} className="text-cream-dim hover:text-cream"><X size={18} /></button>
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
                onClick={onCopyNumber}
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
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. QFT7K9L2M1"
            maxLength={12}
            className="bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono tracking-widest text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold uppercase"
          />
          {depositError && (
            <p className="flex items-center gap-1.5 text-xs text-danger font-semibold"><AlertCircle size={13} /> {depositError}</p>
          )}
          <button
            onClick={onVerify}
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
  );
}
