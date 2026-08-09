import { Link } from 'react-router-dom';
import { Unlock, MessagesSquare, Trophy, ShieldCheck, Sparkles, Lock, CalendarDays, Target, Dices, Layers, Copy, Share2, CheckCircle2 } from 'lucide-react';
import StarRating from '../components/StarRating';
import SeoHead from '../components/SeoHead';

const steps = [
  {
    icon: Unlock,
    title: '1. Free Matches are always open',
    body: "UEFA Champions League, Premier League, Europa League, and top football fixtures get their own free discussion rooms: no fee, ever. Just show up, read consensus, and discuss picks with fellow punters.",
  },
  {
    icon: Dices,
    title: '2. Custom Bet Builder (100% Free)',
    body: 'Combine selections from daily fixtures into custom accumulators (1X2, Over/Under 2.5, BTTS, Double Chance). Aggregate live odds, convert into copyable bookie slip codes, and share custom slips in the community feed.',
  },
  {
    icon: Lock,
    title: '3. Jackpot Rooms are exclusive',
    body: 'For fixed 13-17 match jackpot pools (SportPesa Mega, Betika Midweek, Mozzart, Odibets), unlock live community consensus stats for a flat fee of Ksh 10 via M-Pesa or ad tokens.',
  },
  {
    icon: Trophy,
    title: '4. Leaderboards & Star Crown',
    body: 'When jackpot matches finish, slips are scored automatically. The eligible punter closest to the official winning jackpot outcome is crowned #1 on the Gameweek Leaderboard and earns Rating Points (RP)!',
  },
];

const betBuilderFeatures = [
  {
    icon: Layers,
    title: '1. Multi-Market Combinations',
    desc: 'Select outcomes across 1X2 (Home/Draw/Away), Over/Under 2.5 Goals, Both Teams To Score (BTTS), and Double Chance (1X, X2, 12).',
  },
  {
    icon: Copy,
    title: '2. Instant Bookie Code Generator',
    desc: 'One-click copyable slip codes formatted for SportPesa, Betika, MozzartBet, 22Bet, and Odibets to place directly on bookmaker sites.',
  },
  {
    icon: Share2,
    title: '3. Community Slip Feed',
    desc: 'Publish your built accumulator to the public community feed. Receive upvotes, comments, and let other punters copy your winning combinations.',
  },
  {
    icon: CheckCircle2,
    title: '4. Real-Time Odds Calculator',
    desc: 'Watch total accumulator odds auto-calculate instantly as you add or remove legs from your active builder slip.',
  },
];

const faqs = [
  {
    q: 'Is MshindiRoom an actual betting operator?',
    a: 'No. MshindiRoom is a sports analytics, consensus, and punter discussion platform. You place actual bets directly on your licensed bookie (SportPesa, Betika, etc.). We help you pool group wisdom, analyze picks, and construct smarter slips.',
  },
  {
    q: 'What is the Bet Builder and how much does it cost?',
    a: 'The Bet Builder is a 100% FREE tool that lets you build custom multi-leg accumulators across daily fixtures. You can add picks directly from Free Match cards or the Bet Builder page, view combined odds, and generate bookie codes.',
  },
  {
    q: 'What is the difference between Bet Builder and Jackpot Rooms?',
    a: 'Jackpot Rooms are pre-set 13-17 match pools defined by bookies (e.g., SportPesa Mega Jackpot or Betika Midweek) where all punters compete for the Gameweek Leaderboard Crown (Ksh 10 unlock fee). Bet Builder is a free custom tool for building your own personal multi-match accumulator slip for daily matches.',
  },
  {
    q: 'Which bookie slip codes can the Bet Builder generate?',
    a: 'The Bet Builder formats copyable codes and quick-share links for popular Kenyan bookmakers including SportPesa, Betika, MozzartBet, 22Bet, and Odibets.',
  },
  {
    q: 'Why do Jackpot Rooms require a Ksh 10 unlock fee?',
    a: 'The flat Ksh 10 fee keeps jackpot discussion rooms spam-free with serious punters, unlocks verified community consensus data percentages for all 17 legs, and qualifies your slip for the Gameweek Leaderboard ranking.',
  },
  {
    q: 'How does the Gameweek Leaderboard settlement work?',
    a: 'After all jackpot matches end, posted slips are automatically evaluated against full-time results. The eligible punter with the highest number of correct legs wins the #1 Leaderboard Crown! Ties are settled strictly by earliest submission time.',
  },
  {
    q: 'How does the 5-Star Punter Rating work?',
    a: 'Every punter carries a 5-star reputation badge. It increases as your historical prediction accuracy improves over time and receives bonus boosts when you claim #1 on a jackpot leaderboard. Ratings display in clear half-star steps.',
  },
];

export default function HowItWorks() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((f) => ({
      "@type": "Question",
      "name": f.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.a,
      },
    })),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
      <SeoHead
        title="How It Works — Bet Builder, Jackpot Consensus & Leaderboards"
        description="Learn how MshindiRoom works: build custom bet slips for free, join jackpot consensus rooms for SportPesa & Betika, and win the Gameweek Leaderboard Crown."
        canonicalUrl="https://mshindi.co.ke/how-it-works"
        structuredData={faqSchema}
      />
      
      {/* Header */}
      <div className="text-center mb-14">
        <span className="inline-flex items-center gap-1.5 bg-panel border border-emerald-2/30 text-emerald-2 text-xs font-bold px-3.5 py-1.5 rounded-full mb-4 shadow-sm">
          <Sparkles size={13} /> How MshindiRoom Works
        </span>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-cream">From gut feeling to group wisdom.</h1>
        <p className="text-cream-dim mt-3 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Whether you're building a daily custom accumulator or analyzing 17-leg jackpots, MshindiRoom pools community insights and offers smart tools to help you bet wiser.
        </p>
      </div>

      {/* Main 4 Steps */}
      <div className="grid sm:grid-cols-2 gap-5 mb-16">
        {steps.map((s, i) => (
          <div key={s.title} className="animate-rise bg-panel border border-line rounded-2xl p-6 flex gap-4 hover:border-gold/30 transition-colors shadow-sm" style={{ animationDelay: `${i * 90}ms` }}>
            <div className="w-11 h-11 rounded-xl bg-emerald-2/10 border border-emerald-2/30 flex items-center justify-center shrink-0">
              <s.icon size={20} className="text-emerald-2" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-cream mb-1.5">{s.title}</h3>
              <p className="text-sm text-cream-dim leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Feature Deep-Dive: Bet Builder */}
      <div className="bg-panel border border-emerald-500/30 rounded-2xl p-6 sm:p-8 mb-12 relative overflow-hidden shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-line">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold px-3 py-1 rounded-full mb-2">
              <Dices size={13} /> 100% FREE TOOL
            </span>
            <h2 className="font-display font-extrabold text-2xl text-cream">Custom Bet Builder</h2>
            <p className="text-sm text-cream-dim mt-1">Build, calculate, export, and share custom multi-leg sports accumulators instantly.</p>
          </div>
          <Link
            to="/free"
            className="inline-flex items-center justify-center gap-2 bg-emerald-500 text-ink font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl hover:bg-emerald-400 transition-colors shrink-0 shadow"
          >
            <Dices size={15} /> Try Bet Builder Now
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {betBuilderFeatures.map((f) => (
            <div key={f.title} className="bg-ink-2/60 border border-line/70 rounded-xl p-4 flex gap-3.5 items-start">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 mt-0.5">
                <f.icon size={18} />
              </div>
              <div>
                <h4 className="font-bold text-cream text-sm mb-1">{f.title}</h4>
                <p className="text-xs text-cream-dim leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Deep-Dive: Star Rating */}
      <div className="bg-panel border border-gold/20 rounded-2xl p-6 sm:p-8 mb-12 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
            <Target size={26} className="text-gold" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-xl text-cream mb-1.5">Your Star Rating Grows With Accuracy</h2>
            <p className="text-sm text-cream-dim leading-relaxed">
              Every punter carries a 5-star reputation score shown next to their name in every room. Land more accurate
              picks and get crowned closest to the winning slip more often, and your rating climbs: displayed in precise
              half-star increments, maxing out at 5.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-5 pt-5 border-t border-dashed border-line">
          <div className="flex items-center gap-2">
            <StarRating rating={2} size={16} />
            <span className="text-xs text-cream-dim">New punter</span>
          </div>
          <div className="flex items-center gap-2">
            <StarRating rating={3.5} size={16} />
            <span className="text-xs text-cream-dim">Solid accuracy</span>
          </div>
          <div className="flex items-center gap-2">
            <StarRating rating={5} size={16} />
            <span className="text-xs text-cream-dim">Elite: multiple closest-slip wins</span>
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-panel border border-line rounded-2xl p-6 sm:p-8 mb-14 shadow-md">
        <h2 className="font-display font-bold text-2xl text-cream mb-6 flex items-center gap-2">
          <ShieldCheck className="text-gold" size={22} /> Frequently Asked Questions
        </h2>
        <div className="flex flex-col divide-y divide-line">
          {faqs.map((f) => (
            <div key={f.q} className="py-4">
              <p className="font-semibold text-cream mb-1.5 text-sm sm:text-base">{f.q}</p>
              <p className="text-xs sm:text-sm text-cream-dim leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Call to Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link to="/" className="inline-block bg-gold hover:bg-gold-2 text-ink font-bold px-7 py-3 rounded-full transition-colors shadow-md">
          Browse Jackpot Rooms
        </Link>
        <Link to="/free" className="inline-flex items-center gap-2 text-cream font-bold px-7 py-3 rounded-full border border-emerald-2/40 hover:border-emerald-2 hover:bg-emerald-2/10 transition-colors shadow-sm">
          <CalendarDays size={16} className="text-emerald-2" /> Free Matches & Bet Builder
        </Link>
      </div>
    </div>
  );
}

