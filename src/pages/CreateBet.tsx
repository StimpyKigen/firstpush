import { useState, useMemo } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Swords, AlertCircle, ShieldCheck, Copy, Check, PartyPopper } from 'lucide-react';
import { useAuth, useCurrentUser } from '../lib/authStore';
import { usePvP, type BetCategory } from '../lib/p2pStore';
import { useWallet } from '../lib/store';
import { moderateText } from '../lib/contentModeration';
import ModerationWarningBox from '../components/ModerationWarningBox';

const categories: BetCategory[] = ['Sports', 'Politics', 'Gaming', 'Weather', 'Pop Culture', 'Custom'];

export default function CreateBet() {
  const currentUser = useCurrentUser();
  const balance = useWallet((s) => s.balance);
  const createBet = usePvP((s) => s.createBet);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BetCategory>('Sports');
  const [creatorSidePick, setCreatorSidePick] = useState('');
  const [opponentSidePick, setOpponentSidePick] = useState('');
  const [creatorStake, setCreatorStake] = useState(100);
  const [opponentStake, setOpponentStake] = useState(100);
  const [settleBy, setSettleBy] = useState('');
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const betModResult = useMemo(
    () => moderateText(`${title} ${description} ${creatorSidePick} ${opponentSidePick} ${settleBy}`),
    [title, description, creatorSidePick, opponentSidePick, settleBy]
  );

  if (!currentUser) return <Navigate to="/auth" replace />;

  const impliedOdds = creatorStake > 0 ? (opponentStake / creatorStake) : 0;
  const oddsLabel = creatorStake > 0 && opponentStake > 0
    ? `${impliedOdds.toFixed(2)}x return for you if you win (opponent risks Ksh ${opponentStake} vs your Ksh ${creatorStake})`
    : '';

  function copyCode() {
    if (!createdCode) return;
    navigator.clipboard?.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleCreate() {
    setError('');
    if (!title.trim()) { setError('Describe what you\'re betting on.'); return; }
    if (!creatorSidePick.trim() || !opponentSidePick.trim()) { setError('Fill in both sides of the bet.'); return; }
    if (creatorStake <= 0 || opponentStake <= 0) { setError('Both stakes must be greater than zero.'); return; }
    if (creatorStake > balance) { setError(`Insufficient balance. You have Ksh ${balance} available.`); return; }

    const modResult = moderateText(`${title} ${description} ${creatorSidePick} ${opponentSidePick} ${settleBy}`);
    if (!modResult.isAllowed) {
      setError(modResult.reason || 'Text contains prohibited or misleading terms.');
      return;
    }

    const res = createBet({
      creatorUsername: currentUser!.username,
      title: title.trim(),
      description: description.trim(),
      category,
      creatorSidePick: creatorSidePick.trim(),
      opponentSidePick: opponentSidePick.trim(),
      creatorStake,
      opponentStake,
      oddsLabel,
      settleBy: settleBy.trim() || undefined,
    });

    if (!res.ok || !res.bet) { setError(res.error ?? 'Could not create bet.'); return; }
    setCreatedCode(res.bet.code);
  }

  if (createdCode) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-2/10 border border-emerald-2/30 flex items-center justify-center mb-5 animate-pulse-ring">
          <PartyPopper className="text-emerald-2" size={28} />
        </div>
        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-cream mb-2">Bet Created!</h1>
        <p className="text-cream-dim text-sm mb-6">
          Your stake of <span className="text-gold font-bold">Ksh {creatorStake}</span> is now held securely in escrow.
          Share this invite code with your friend so they can accept the challenge.
        </p>

        <div className="bg-panel border border-gold/30 rounded-2xl p-6 mb-6">
          <p className="text-xs text-cream-dim uppercase tracking-wide font-semibold mb-2">Invite Code</p>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono font-extrabold text-4xl tracking-[0.2em] text-gold">{createdCode}</span>
            <button onClick={copyCode} className="bg-panel-2 border border-line rounded-lg p-2.5 hover:border-gold/50 transition-colors">
              {copied ? <Check size={18} className="text-emerald-2" /> : <Copy size={18} className="text-cream-dim" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/p2p')}
            className="bg-gold hover:bg-gold-2 text-ink font-bold px-6 py-3 rounded-full transition-colors"
          >
            View All Bets
          </button>
          <Link to="/p2p/create" onClick={() => setCreatedCode(null)} className="border border-line text-cream font-semibold px-6 py-3 rounded-full hover:border-emerald-2 transition-colors">
            Create Another Bet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <Link to="/p2p" className="inline-flex items-center gap-1.5 text-sm text-cream-dim hover:text-cream mb-6">
        <ArrowLeft size={15} /> All P2P Bets
      </Link>

      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-1.5 bg-panel border border-gold/30 text-gold text-xs font-bold px-3 py-1.5 rounded-full mb-4">
          <Swords size={13} /> Create a Peer-to-Peer Bet
        </span>
        <h1 className="font-display font-extrabold text-3xl text-cream">You Set The Terms</h1>
        <p className="text-cream-dim text-sm mt-2">No pre-built markets: decide exactly what you're betting on, the odds, and the stake.</p>
      </div>

      <div className="bg-panel border border-line rounded-2xl p-6 sm:p-7 flex flex-col gap-5">
        <div>
          <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide mb-2 block">What are you betting on?</label>
          <input
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(''); }}
            placeholder="e.g. Arsenal beats Chelsea this Sunday"
            maxLength={100}
            className="w-full bg-ink border border-line rounded-lg px-3 py-3 text-sm text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide mb-2 block">Extra details / terms (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any conditions, e.g. must be a full-time result, extra time doesn't count..."
            rows={2}
            className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold resize-none"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide mb-2 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  category === c ? 'bg-gold border-gold text-ink' : 'border-line text-cream-dim hover:border-gold/50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-dashed border-line">
          <div>
            <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide mb-2 block">Your side (you win if...)</label>
            <input
              value={creatorSidePick}
              onChange={(e) => { setCreatorSidePick(e.target.value); setError(''); }}
              placeholder="e.g. Arsenal win"
              className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-emerald-2"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide mb-2 block">Opponent's side (they win if...)</label>
            <input
              value={opponentSidePick}
              onChange={(e) => { setOpponentSidePick(e.target.value); setError(''); }}
              placeholder="e.g. Arsenal don't win"
              className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-danger"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide mb-2 block">Your stake (Ksh)</label>
            <input
              type="number"
              value={creatorStake}
              onChange={(e) => { setCreatorStake(Number(e.target.value)); setError(''); }}
              className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono text-cream focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide mb-2 block">Opponent's stake (Ksh)</label>
            <input
              type="number"
              value={opponentStake}
              onChange={(e) => { setOpponentStake(Number(e.target.value)); setError(''); }}
              className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-sm font-mono text-cream focus:outline-none focus:border-gold"
            />
          </div>
        </div>

        {oddsLabel && (
          <div className="bg-ink-2 border border-line rounded-lg p-3">
            <p className="text-xs text-cream-dim">Implied odds: <span className="text-gold font-bold">{oddsLabel}</span></p>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-cream-dim uppercase tracking-wide mb-2 block">When should this settle? (optional)</label>
          <input
            value={settleBy}
            onChange={(e) => setSettleBy(e.target.value)}
            placeholder="e.g. After full-time whistle this Sunday"
            className="w-full bg-ink border border-line rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold"
          />
        </div>

        <div className="bg-emerald-2/10 border border-emerald-2/30 rounded-lg p-3 flex gap-2.5">
          <ShieldCheck size={16} className="text-emerald-2 shrink-0 mt-0.5" />
          <p className="text-xs text-cream-dim leading-relaxed">
            Your stake of <span className="text-cream font-semibold">Ksh {creatorStake || 0}</span> will be locked in escrow the
            moment you create this bet. You currently have <span className="text-cream font-semibold">Ksh {balance.toLocaleString()}</span> available.
          </p>
        </div>

        <ModerationWarningBox result={betModResult} text={`${title} ${description} ${creatorSidePick} ${opponentSidePick}`} />

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-danger font-semibold"><AlertCircle size={13} /> {error}</p>
        )}

        <button
          onClick={handleCreate}
          disabled={!betModResult.isAllowed}
          className="flex items-center justify-center gap-2 bg-gold hover:bg-gold-2 disabled:opacity-40 disabled:cursor-not-allowed text-ink font-bold text-sm py-3.5 rounded-lg transition-colors"
        >
          <Swords size={16} /> Lock Stake & Create Bet
        </button>
      </div>
    </div>
  );
}
