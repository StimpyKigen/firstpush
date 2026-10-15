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
        <span className="inline-flex items-center gap-1.5 bg-[#006C54] text-[#FFD700] border border-[#005441] text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full mb-4 shadow-xs">
          <Sparkles size={13} className="text-[#FFD700]" /> Platform Guide &amp; Mechanics
        </span>
        <h1 className="font-display font-black text-3xl sm:text-5xl text-slate-900 uppercase tracking-tight">From Gut Feeling to Group Consensus.</h1>
        <p className="text-slate-600 mt-3 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Whether you&apos;re building a daily custom accumulator or analyzing 17-leg jackpots, MshindiRoom pools community insights and offers smart tools to help you bet wiser.
        </p>
      </div>

      {/* Main 4 Steps */}
      <div className="grid sm:grid-cols-2 gap-5 mb-16">
        {steps.map((s, i) => (
          <div key={s.title} className="bg-white border border-slate-200 rounded-2xl p-6 flex gap-4 hover:border-[#006C54] hover:shadow-md transition-all shadow-xs" style={{ animationDelay: `${i * 90}ms` }}>
            <div className="w-12 h-12 rounded-full bg-[#006C54]/10 text-[#006C54] flex items-center justify-center shrink-0">
              <s.icon size={22} />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-slate-900 mb-1 uppercase">{s.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Feature Deep-Dive: Bet Builder */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mb-12 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-[#006C54] text-[#FFD700] border border-[#005441] text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full mb-2 shadow-xs">
              <Dices size={13} className="text-[#FFD700]" /> 100% Free Tool
            </span>
            <h2 className="font-display font-black text-2xl sm:text-3xl text-slate-900 uppercase tracking-tight">Custom Bet Builder</h2>
            <p className="text-sm text-slate-600 mt-1">Build, calculate, export, and share custom multi-leg sports accumulators instantly.</p>
          </div>
          <Link
            to="/free"
            className="inline-flex items-center justify-center gap-2 bg-[#006C54] hover:bg-[#005441] text-white font-bold uppercase tracking-wider text-xs sm:text-sm px-6 py-3 rounded-full transition-colors shrink-0 shadow-xs"
          >
            <Dices size={16} /> Try Bet Builder
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {betBuilderFeatures.map((f) => (
            <div key={f.title} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-3.5 items-start">
              <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 text-[#006C54] mt-0.5 shadow-2xs">
                <f.icon size={18} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm mb-1">{f.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Deep-Dive: Star Rating */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mb-12 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Target size={26} className="text-amber-500" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-black text-xl sm:text-2xl text-slate-900 uppercase tracking-tight mb-1.5">Your Reputation Rating Grows With Accuracy</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every punter carries a 5-star reputation score shown next to their name in every room. Land more accurate
              picks and get crowned closest to the winning slip more often, and your rating climbs: displayed in precise
              half-star increments, maxing out at 5.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-5 pt-5 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <StarRating rating={2} size={16} />
            <span className="text-xs font-semibold text-slate-500">New punter</span>
          </div>
          <div className="flex items-center gap-2">
            <StarRating rating={3.5} size={16} />
            <span className="text-xs font-semibold text-slate-500">Solid accuracy</span>
          </div>
          <div className="flex items-center gap-2">
            <StarRating rating={5} size={16} />
            <span className="text-xs font-semibold text-slate-500">Elite: multiple closest-slip wins</span>
          </div>
        </div>
      </div>

      {/* FAQs */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 mb-14 shadow-xs">
        <h2 className="font-display font-black text-2xl text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-2">
          <ShieldCheck className="text-[#006C54]" size={22} /> Frequently Asked Questions
        </h2>
        <div className="flex flex-col divide-y divide-slate-100">
          {faqs.map((f) => (
            <div key={f.q} className="py-4">
              <p className="font-bold text-slate-900 mb-1 text-sm sm:text-base">{f.q}</p>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Call to Actions */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link to="/" className="inline-block bg-[#006C54] hover:bg-[#005441] text-white font-bold uppercase tracking-wider text-xs px-8 py-3.5 rounded-full transition-colors shadow-xs">
          Browse Jackpot Rooms
        </Link>
        <Link to="/free" className="inline-flex items-center gap-2 text-slate-800 font-bold uppercase tracking-wider text-xs px-8 py-3.5 rounded-full border border-slate-300 hover:border-[#006C54] hover:text-[#006C54] bg-white transition-colors shadow-xs">
          <CalendarDays size={16} className="text-[#006C54]" /> Free Matches &amp; Bet Builder
        </Link>
      </div>
    </div>
  );
}

