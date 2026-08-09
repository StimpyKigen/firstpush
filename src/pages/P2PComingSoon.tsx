import { Link } from 'react-router-dom';
import { Swords, ShieldCheck, Scale, Users, Bell, ArrowLeft, Sparkles } from 'lucide-react';
import { useState } from 'react';
import SeoHead from '../components/SeoHead';

export default function P2PComingSoon() {
  const [notifyEmail, setNotifyEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  function handleNotify() {
    if (!notifyEmail.trim()) return;
    setSubscribed(true);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <SeoHead
        title="Peer-to-Peer Bets (Coming Soon)"
        description="P2P betting on MshindiRoom: Challenge friends directly with custom stakes and escrow settlement."
        canonicalUrl="https://mshindi.co.ke/p2p"
      />
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-cream-dim hover:text-cream mb-8">
        <ArrowLeft size={15} /> Back home
      </Link>

      <div className="text-center mb-10 animate-rise">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center mb-5 animate-float-slow">
          <Swords className="text-gold" size={30} />
        </div>
        <span className="inline-flex items-center gap-1.5 bg-panel border border-gold/30 text-gold text-xs font-bold px-3 py-1.5 rounded-full mb-4">
          <Sparkles size={13} /> Coming Soon
        </span>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-cream leading-tight">
          Peer-to-Peer Bets are on the way.
        </h1>
        <p className="text-cream-dim mt-4 max-w-xl mx-auto leading-relaxed">
          Bet your friends directly on anything: you decide what's being bet, the stake, the odds, and who wins.
          No pre-built markets, no bookie in the middle. We'll just securely hold the funds until you both agree on the outcome.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <div className="bg-panel border border-line rounded-2xl p-5 flex flex-col gap-2">
          <span className="w-9 h-9 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
            <Scale size={17} className="text-gold" />
          </span>
          <h3 className="font-display font-bold text-cream text-sm">You set the terms</h3>
          <p className="text-xs text-cream-dim leading-relaxed">Pick the subject, the stake, and the odds. Total freedom, zero pre-built markets.</p>
        </div>
        <div className="bg-panel border border-line rounded-2xl p-5 flex flex-col gap-2">
          <span className="w-9 h-9 rounded-lg bg-emerald-2/10 border border-emerald-2/30 flex items-center justify-center">
            <ShieldCheck size={17} className="text-emerald-2" />
          </span>
          <h3 className="font-display font-bold text-cream text-sm">Funds held in escrow</h3>
          <p className="text-xs text-cream-dim leading-relaxed">Your stake locks the moment a bet is created: no backing out once someone accepts.</p>
        </div>
        <div className="bg-panel border border-line rounded-2xl p-5 flex flex-col gap-2">
          <span className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-400/30 flex items-center justify-center">
            <Users size={17} className="text-[#3b82f6]" />
          </span>
          <h3 className="font-display font-bold text-cream text-sm">Mutual settlement</h3>
          <p className="text-xs text-cream-dim leading-relaxed">Both sides confirm the outcome before the pot is released. Disagreements get flagged for support.</p>
        </div>
      </div>

      <div className="bg-panel border border-line rounded-2xl p-6 sm:p-8 text-center">
        <Bell size={22} className="mx-auto text-gold mb-3" />
        <h2 className="font-display font-bold text-lg text-cream mb-1">Get notified when it launches</h2>
        <p className="text-sm text-cream-dim mb-5">Drop your email and we'll ping you the moment P2P Bets goes live.</p>

        {subscribed ? (
          <p className="text-sm font-semibold text-emerald-2 flex items-center justify-center gap-1.5 animate-rise">
            <Bell size={15} /> You're on the list: we'll let you know!
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              className="flex-1 bg-ink border border-line rounded-lg px-3 py-2.5 text-sm text-cream placeholder:text-cream-dim/50 focus:outline-none focus:border-gold"
            />
            <button
              onClick={handleNotify}
              className="bg-gold hover:bg-gold-2 text-ink font-bold text-sm px-5 py-2.5 rounded-lg transition-colors shrink-0"
            >
              Notify Me
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
