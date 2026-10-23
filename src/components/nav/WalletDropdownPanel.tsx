import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Wallet, X, Coins, ArrowUpRight } from 'lucide-react';

interface WalletDropdownPanelProps {
  balance: number;
  mshindiTokens: number;
  onClose: () => void;
  /** These three vary slightly between the desktop and mobile trigger points, so callers pass their exact classes. */
  backdropClassName: string;
  panelClassName: string;
  headerClassName: string;
}

export default function WalletDropdownPanel({
  balance,
  mshindiTokens,
  onClose,
  backdropClassName,
  panelClassName,
  headerClassName,
}: WalletDropdownPanelProps) {
  const backdropNode =
    typeof document !== 'undefined' ? (
      createPortal(<div className={backdropClassName} onClick={onClose} />, document.body)
    ) : (
      <div className={backdropClassName} onClick={onClose} />
    );

  return (
    <>
      {backdropNode}
      <div className={panelClassName}>
        <div className={headerClassName}>
          <span className="text-xs font-bold text-cream uppercase tracking-wide flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-2/15 flex items-center justify-center text-emerald-2">
              <Wallet size={13} />
            </span>
            Wallet &amp; Rewards
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-cream-dim hover:text-cream text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Cash Balance */}
        <div className="bg-ink-2/90 border border-line/70 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
          <div>
            <span className="text-[11px] text-cream-dim font-bold uppercase tracking-wide">M-Pesa Cash Balance</span>
            <p className="font-display font-bold text-2xl text-emerald-2 tracking-tight">Ksh {balance.toLocaleString()}</p>
          </div>
          <Link
            to="/wallet"
            onClick={onClose}
            className="bg-emerald-2/15 hover:bg-emerald-2/25 text-emerald-2 border border-emerald-2/40 px-3.5 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-all shrink-0 shadow-sm"
          >
            Top Up
          </Link>
        </div>

        {/* Tokens */}
        <div className="bg-ink-2/90 border border-line/70 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
          <div>
            <span className="text-[11px] text-gold font-bold uppercase tracking-wide flex items-center gap-1.5">
              <Coins size={12} /> Mshindi Tokens
            </span>
            <p className="font-display font-bold text-2xl text-gold tracking-tight">{mshindiTokens} <span className="text-xs font-normal text-cream-dim">MT</span></p>
          </div>
          <Link
            to="/wallet"
            onClick={onClose}
            className="bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 px-3.5 py-1.5 rounded-full text-xs font-bold active:scale-95 transition-all shrink-0 shadow-sm"
          >
            Earn / Redeem
          </Link>
        </div>

        <Link
          to="/wallet"
          onClick={onClose}
          className="w-full inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 text-ink font-bold text-xs py-3 rounded-full transition-all shadow-md active:scale-95"
        >
          <span>Open Full Wallet &amp; Top Up</span>
          <ArrowUpRight size={14} />
        </Link>

        <p className="text-[11px] text-cream-dim/80 text-center leading-tight">
          ⚡ Earn +4 MT cashback on every 100 Ksh top up &amp; referral invite!
        </p>
      </div>
    </>
  );
}
