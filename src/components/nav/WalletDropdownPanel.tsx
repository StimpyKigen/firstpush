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
  return (
    <>
      <div className={backdropClassName} onClick={onClose} />
      <div className={panelClassName}>
        <div className={headerClassName}>
          <span className="text-xs font-bold text-cream uppercase tracking-wider flex items-center gap-1.5">
            <Wallet size={15} className="text-emerald-2" /> Wallet &amp; Rewards
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-cream-dim hover:text-cream text-xs font-bold p-1 rounded-lg hover:bg-line/50 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Cash Balance */}
        <div className="bg-ink/80 border border-line/80 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-cream-dim font-bold uppercase tracking-wide">M-Pesa Cash Balance</span>
            <p className="font-display font-extrabold text-xl text-emerald-2">Ksh {balance.toLocaleString()}</p>
          </div>
          <Link
            to="/wallet"
            onClick={onClose}
            className="bg-emerald-2/15 hover:bg-emerald-2/25 text-emerald-2 border border-emerald-2/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
          >
            Top Up
          </Link>
        </div>

        {/* Tokens */}
        <div className="bg-ink/80 border border-line/80 rounded-xl p-3 flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] text-gold font-bold uppercase tracking-wide flex items-center gap-1">
              <Coins size={12} /> Mshindi Tokens
            </span>
            <p className="font-display font-extrabold text-xl text-gold">{mshindiTokens} <span className="text-xs font-normal text-cream-dim">MT</span></p>
          </div>
          <Link
            to="/wallet"
            onClick={onClose}
            className="bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
          >
            Earn / Redeem
          </Link>
        </div>

        <Link
          to="/wallet"
          onClick={onClose}
          className="w-full inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 text-ink font-bold text-xs py-2.5 rounded-xl transition-all shadow-md"
        >
          <span>Open Full Wallet &amp; Top Up</span>
          <ArrowUpRight size={14} />
        </Link>

        <p className="text-[10px] text-cream-dim text-center leading-tight">
          ⚡ Earn +4 MT cashback on every 100 Ksh top up &amp; referral invite!
        </p>
      </div>
    </>
  );
}
