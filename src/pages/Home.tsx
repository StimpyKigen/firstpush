import { useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Search, TrendingUp, Users, Sparkles, Lock, Unlock, ArrowRight, Swords, ShieldCheck, Scale, SlidersHorizontal, Flame, Archive, CheckCircle2 } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { jackpots, subscribeToJackpots, getJackpotsSnapshot } from '../lib/mockData';
import { useAuth, isAdminUser, useCurrentUser } from '../lib/authStore';
import { freeMatches, freeMatchConsensus, getFreeMatchesSnapshot, getFreeMatchConsensusSnapshot, subscribeToFreeMatches } from '../lib/freeMatches';
import type { Bookie, RoomStatus } from '../lib/types';
import JackpotCard from '../components/JackpotCard';
import JackpotAdminModal from '../components/JackpotAdminModal';

const bookies: (Bookie | 'All')[] = ['All', 'SportPesa', 'Betika', 'Odibets', 'Mozzart'];

export default function Home() {
  const [bookie, setBookie] = useState<Bookie | 'All'>('All');
  const [status, setStatus] = useState<RoomStatus | 'All'>('All');
  const [query, setQuery] = useState('');
  const [viewTab, setViewTab] = useState<'active' | 'archive'>('active');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const currentUser = useCurrentUser();
  const isAuthorizedAdmin = isAdminUser(currentUser);

  const activeJackpots = useSyncExternalStore(subscribeToJackpots, getJackpotsSnapshot, getJackpotsSnapshot);
  const matches = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchesSnapshot, getFreeMatchesSnapshot);
  const consensusMap = useSyncExternalStore(subscribeToFreeMatches, getFreeMatchConsensusSnapshot, getFreeMatchConsensusSnapshot);

  const activeRooms = useMemo(() => activeJackpots.filter((j) => j.status !== 'settled'), [activeJackpots]);
  const archivedRooms = useMemo(() => activeJackpots.filter((j) => j.status === 'settled'), [activeJackpots]);

  const statusOptions: (RoomStatus | 'All')[] = useMemo(() => {
    if (viewTab === 'active') {
      return ['All', 'open', 'locked'];
    }
    return ['All', 'settled'];
  }, [viewTab]);

  const filtered = useMemo(() => {
    return activeJackpots.filter((j) => {
      // Primary view tab filtering: Active mode hides settled rooms, Archive mode shows only settled rooms
      if (viewTab === 'active' && j.status === 'settled') return false;
      if (viewTab === 'archive' && j.status !== 'settled') return false;

      if (bookie !== 'All' && j.bookie !== bookie) return false;
      if (status !== 'All' && j.status !== status) return false;
      if (query && !`${j.name} ${j.bookie} ${j.gameweek}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [activeJackpots, viewTab, bookie, status, query]);

  const totalPunters = activeJackpots.reduce((a, j) => a + j.participants, 0);

  return (
    <div>
      <SeoHead
        title="Kenya's Premier Jackpot Consensus & P2P Bets"
        description="Pool consensus with Kenya's top punters for SportPesa Mega Jackpot, Betika Midweek & Mozzart Daily. View crowd picks, share bet slips & track bookie predictions."
        canonicalUrl="https://mshindi.co.ke/"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "MshindiRoom",
          "url": "https://mshindi.co.ke/",
          "description": "Kenya's Premier Jackpot Consensus & P2P Betting Community Platform",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://mshindi.co.ke/free?q={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line">
        <div className="absolute inset-0">
          <img src="/hero-stadium.svg" alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink to-ink" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20">
          <div className="max-w-2xl animate-rise">
            <span className="inline-flex items-center gap-1.5 bg-ink/70 backdrop-blur-sm border border-gold/25 text-gold text-xs font-semibold tracking-wide px-3.5 py-1.5 rounded-full mb-5">
              <Sparkles size={13} /> Jackpots are paid · Weekly matches are free
            </span>
            <h1 className="font-display font-extrabold text-3xl xs:text-4xl sm:text-5xl md:text-6xl leading-[1.08] sm:leading-[1.05] text-cream">
              Never punt the <span className="text-gold">jackpot</span> alone again.
            </h1>
            <p className="text-cream-dim text-sm xs:text-base sm:text-lg mt-4 sm:mt-5 leading-relaxed max-w-xl">
              Pool a few bob to unlock any bookie's jackpot room: see the mass pick on every leg, read why the crowd is
              backing it, and battle it out for who lands closest to the winning slip. Midweek's big matches? Always free
              to discuss, no paywall attached.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mt-7 sm:mt-8">
              <a href="#rooms" className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-gold hover:bg-gold-2 text-ink font-bold text-sm text-center transition-colors whitespace-nowrap">
                Browse Jackpot Rooms
              </a>
              <Link to="/free" className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-emerald-2/10 text-cream font-semibold text-sm border border-emerald-2/30 hover:border-emerald-2/60 hover:bg-emerald-2/15 transition-colors whitespace-nowrap">
                <Unlock size={16} className="text-emerald-2" /> Free Matches
              </Link>
              <Link to="/slips" className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-gold/10 text-cream font-semibold text-sm border border-gold/25 hover:border-gold/50 hover:bg-gold/15 transition-colors whitespace-nowrap">
                <Search size={16} className="text-gold" /> Parse Slip
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8 sm:mt-10 text-xs sm:text-sm">
              <div className="flex items-center gap-2 text-cream-dim">
                <Users size={16} className="text-emerald-2 shrink-0" />
                <span className="font-mono font-semibold text-cream">{totalPunters.toLocaleString()}</span> active punters
              </div>
              <div className="flex items-center gap-2 text-cream-dim">
                <TrendingUp size={16} className="text-gold shrink-0" />
                <span className="font-mono font-semibold text-cream">{activeRooms.length}</span> active jackpot rooms
              </div>
              <div className="flex items-center gap-2 text-cream-dim">
                <Archive size={16} className="text-cream-dim shrink-0" />
                <span className="font-mono font-semibold text-cream">{archivedRooms.length}</span> archived rooms
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Free vs Paid explainer strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="bg-panel border border-emerald-2/30 rounded-2xl p-6 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-emerald-2/10 rounded-full blur-2xl pointer-events-none" />
            <span className="w-10 h-10 rounded-xl bg-emerald-2/15 border border-emerald-2/30 flex items-center justify-center relative">
              <Unlock size={18} className="text-emerald-2" />
            </span>
            <h3 className="font-display font-bold text-lg text-cream">Free Matches: always open</h3>
            <p className="text-sm text-cream-dim leading-relaxed">
              UEFA Champions League, Europa League, Conference League, and highlights from football's top-flight leagues (Premier League, La Liga, Serie A, Bundesliga & more) are 100% free to discuss. See the crowd split, read reasoning, post your own pick: no fee, ever.
            </p>
            <Link to="/free" className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-2 hover:gap-2.5 transition-all">
              Explore free matches <ArrowRight size={14} />
            </Link>
          </div>
          <div className="bg-panel border border-gold/30 rounded-2xl p-6 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-32 h-32 bg-gold/10 rounded-full blur-2xl pointer-events-none" />
            <span className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center relative">
              <Lock size={18} className="text-gold" />
            </span>
            <h3 className="font-display font-bold text-lg text-cream">Jackpot Rooms: paid, exclusive</h3>
            <p className="text-sm text-cream-dim leading-relaxed">
              Real bookie jackpot slips (SportPesa, Betika & more) live behind one flat entry fee: just Ksh 10  - 
              where punters compete for top spot on the verified gameweek leaderboard.
            </p>
            <a href="#rooms" className="mt-1 inline-flex items-center gap-1.5 text-sm font-bold text-gold hover:gap-2.5 transition-all">
              Browse jackpot rooms <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* P2P Bets promo */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-gradient-to-br from-panel via-panel to-ink-2 border border-line rounded-2xl p-5 sm:p-8 relative overflow-hidden">
          <div className="absolute -left-10 -bottom-10 w-56 h-56 bg-emerald-2/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -right-10 -top-10 w-56 h-56 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-5 sm:gap-6">
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 bg-ink-2 border border-gold/30 text-gold text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                <Swords size={13} /> Coming Soon: Peer-to-Peer Bets
              </span>
              <h2 className="font-display font-bold text-xl xs:text-2xl sm:text-3xl text-cream leading-tight">
                Bet your friends directly. <span className="text-gold">You set the terms.</span>
              </h2>
              <p className="text-sm text-cream-dim mt-2 max-w-xl leading-relaxed">
                No pre-built markets: just you and someone else agreeing on what's being bet, the stake, and the odds.
                We'll securely hold both stakes in escrow until you both confirm who won.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-xs text-cream-dim">
                <span className="flex items-center gap-1.5"><Scale size={13} className="text-gold shrink-0" /> You define the odds</span>
                <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-emerald-2 shrink-0" /> Funds held in escrow</span>
                <span className="flex items-center gap-1.5"><Users size={13} className="text-[#3b82f6] shrink-0" /> Mutual settlement</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link to="/p2p" className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-gold hover:bg-gold-2 text-ink font-bold text-sm text-center transition-colors">
                Get Notified
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Free matches preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-2xl text-cream flex items-center gap-2">
            <Unlock size={20} className="text-emerald-2" /> This Week's Free Matches
          </h2>
          <Link to="/free" className="text-sm font-bold text-emerald-2 hover:underline">See all →</Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.slice(0, 3).map((m) => {
            const consensus = consensusMap[m.id];
            const majority = Math.max(consensus.homePct, consensus.drawPct, consensus.awayPct);
            const majLabel = majority === consensus.homePct ? '1' : majority === consensus.drawPct ? 'X' : '2';
            return (
              <Link
                key={m.id}
                to={`/free/${m.id}`}
                className="bg-panel border border-line rounded-xl p-4 hover:border-emerald-2/50 transition-colors flex flex-col gap-2"
              >
                <p className="text-xs text-cream-dim">{m.competition}</p>
                <p className="font-display font-bold text-cream leading-tight">{m.home} <span className="text-cream-dim">vs</span> {m.away}</p>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-cream-dim">{m.kickoff}</span>
                  <span className="font-bold text-gold">{majLabel} · {majority}%</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Filters + list */}
      <section id="rooms" className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display font-bold text-2xl text-cream flex items-center gap-2">
              <Lock size={18} className="text-gold" /> Jackpot Rooms
            </h2>
            <p className="text-xs text-cream-dim mt-1">
              {viewTab === 'active'
                ? 'Showing unplayed and ongoing jackpot rooms. Settled rooms are automatically archived.'
                : 'Jackpot Archives: Review completed rooms, final winning slips, and historical leaderboards.'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {isAuthorizedAdmin && (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-gold/15 hover:bg-gold/25 border border-gold/40 text-gold text-xs font-bold transition-all"
              >
                <SlidersHorizontal size={14} />
                Jackpot Admin Console
              </button>
            )}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-dim" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search rooms..."
                className="bg-panel border border-line rounded-full pl-9 pr-4 py-2.5 text-sm text-cream placeholder:text-cream-dim/70 focus:outline-none focus:border-emerald-2 w-full sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Main View Mode Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 bg-ink-2/80 p-1.5 rounded-2xl border border-line">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={() => {
                setViewTab('active');
                setStatus('All');
              }}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 transition-all ${
                viewTab === 'active'
                  ? 'bg-gold text-ink shadow-md font-extrabold scale-[1.01]'
                  : 'text-cream-dim hover:text-cream hover:bg-panel'
              }`}
            >
              <Flame size={16} className={viewTab === 'active' ? 'text-ink' : 'text-gold'} />
              <span>Active Jackpot Rooms</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-extrabold ${
                viewTab === 'active' ? 'bg-ink text-gold' : 'bg-panel-2 text-cream-dim border border-line'
              }`}>
                {activeRooms.length}
              </span>
            </button>

            <button
              onClick={() => {
                setViewTab('archive');
                setStatus('All');
              }}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 transition-all ${
                viewTab === 'archive'
                  ? 'bg-gold text-ink shadow-md font-extrabold scale-[1.01]'
                  : 'text-cream-dim hover:text-cream hover:bg-panel'
              }`}
            >
              <Archive size={16} className={viewTab === 'archive' ? 'text-ink' : 'text-gold'} />
              <span>Jackpot Archives</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-extrabold ${
                viewTab === 'archive' ? 'bg-ink text-gold' : 'bg-panel-2 text-cream-dim border border-line'
              }`}>
                {archivedRooms.length}
              </span>
            </button>
          </div>

          <div className="text-xs text-cream-dim px-3 py-1 flex items-center gap-2 font-mono shrink-0">
            {viewTab === 'active' ? (
              <span className="flex items-center gap-1.5 text-emerald-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Showing open &amp; ongoing rooms</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-gold">
                <CheckCircle2 size={13} />
                <span>Showing completed &amp; settled archives</span>
              </span>
            )}
          </div>
        </div>

        {/* Bookie Filter Pills */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 flex-nowrap sm:flex-wrap">
          {bookies.map((b) => (
            <button
              key={b}
              onClick={() => setBookie(b)}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-colors shrink-0 whitespace-nowrap active:scale-95 ${
                bookie === b ? 'bg-emerald-2 border-emerald-2 text-ink shadow-sm' : 'border-line text-cream-dim bg-panel/60 hover:border-emerald-2/50'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 flex-nowrap sm:flex-wrap">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-4 py-2 rounded-full text-xs font-bold border capitalize transition-colors shrink-0 whitespace-nowrap active:scale-95 ${
                status === s ? 'bg-gold border-gold text-ink shadow-sm' : 'border-line text-cream-dim bg-panel/60 hover:border-gold/50'
              }`}
            >
              {s === 'All' ? (viewTab === 'active' ? 'All Active' : 'All Settled') : s}
            </button>
          ))}
        </div>

        {/* Archive Banner when in Archive mode */}
        {viewTab === 'archive' && (
          <div className="bg-panel border border-gold/30 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-rise">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-gold shrink-0">
                <Archive size={20} />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-cream">Jackpot Archives &amp; Settlement History</h3>
                <p className="text-xs text-cream-dim mt-0.5 leading-relaxed">
                  Settled jackpot rooms are stored here for up to 90 days. You can review verified crowd accuracy, winning leg slips, and historical gameweek leaderboards.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setViewTab('active');
                setStatus('All');
              }}
              className="px-4 py-2 rounded-xl bg-ink-2 hover:bg-panel border border-line text-cream-dim hover:text-cream text-xs font-bold transition-all shrink-0"
            >
              ← Back to Active Rooms
            </button>
          </div>
        )}

        {/* 3-Month Archive Policy Active Notification */}
        <div className="bg-ink-2/80 border border-line rounded-xl p-3 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-cream-dim">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <strong className="text-cream">3-Month Archive Policy Active:</strong> Settled jackpot rooms are retained in the Archives for up to 90 days.
          </span>
          <span className="text-[11px] text-gold font-mono shrink-0">Retention: 90 Days</span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 px-4 bg-ink-2/60 border border-line rounded-2xl max-w-xl mx-auto space-y-4">
            <span className="w-12 h-12 rounded-2xl bg-gold/15 text-gold border border-gold/30 flex items-center justify-center mx-auto">
              <SlidersHorizontal size={24} />
            </span>
            <div>
              <h3 className="font-display font-bold text-lg text-cream">
                {viewTab === 'active' ? 'No Active Jackpot Rooms Active' : 'No Archived Rooms Found'}
              </h3>
              <p className="text-xs text-cream-dim mt-1 max-w-md mx-auto">
                {viewTab === 'active'
                  ? 'All active jackpot rooms have concluded or are pending publication. You can check past results in the Archives!'
                  : 'No settled jackpot rooms match your search or filter selection.'}
              </p>
            </div>
            {viewTab === 'active' && archivedRooms.length > 0 && (
              <button
                onClick={() => {
                  setViewTab('archive');
                  setStatus('All');
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold hover:bg-gold-2 text-ink font-bold text-xs shadow-lg transition-all"
              >
                <Archive size={15} />
                Browse {archivedRooms.length} Archived Rooms
              </button>
            )}
            {isAuthorizedAdmin && (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-panel hover:bg-panel-2 border border-line text-cream font-bold text-xs shadow-lg transition-all ml-2"
              >
                <SlidersHorizontal size={15} />
                Open Jackpot Admin Console
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((j, i) => (
                <JackpotCard key={j.id} jackpot={j} index={i} />
              ))}
            </div>

            {viewTab === 'active' && archivedRooms.length > 0 && (
              <div className="mt-8 text-center p-4 bg-ink-2/60 border border-line rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-cream-dim">
                <span className="flex items-center gap-2 text-left">
                  <Archive size={16} className="text-gold shrink-0" />
                  <span>Looking for past jackpot results? Settled rooms are automatically moved to the <strong>Archives</strong> to keep the homepage clean for upcoming and live jackpots.</span>
                </span>
                <button
                  onClick={() => {
                    setViewTab('archive');
                    setStatus('All');
                  }}
                  className="px-4 py-2 rounded-xl bg-gold/15 hover:bg-gold/25 border border-gold/30 text-gold font-bold transition-all shrink-0 whitespace-nowrap"
                >
                  Browse {archivedRooms.length} Archived Rooms →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <JackpotAdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />
    </div>
  );
}

