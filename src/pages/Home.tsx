import { useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { Search, TrendingUp, Users, Sparkles, Lock, Unlock, ArrowRight, Swords, ShieldCheck, Scale, SlidersHorizontal, Flame, Archive, CheckCircle2, Play, ChevronRight } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { subscribeToJackpots, getJackpotsSnapshot } from '../lib/mockData';
import { isAdminUser, useCurrentUser } from '../lib/authStore';
import { getFreeMatchesSnapshot, getFreeMatchConsensusSnapshot, subscribeToFreeMatches } from '../lib/freeMatches';
import type { Bookie, RoomStatus } from '../lib/types';
import JackpotCard from '../components/JackpotCard';
import JackpotAdminModal from '../components/JackpotAdminModal';
import { SkeletonImage, JackpotGridSkeleton } from '../components/skeleton';

const bookies: (Bookie | 'All')[] = ['All', 'SportPesa', 'Betika', 'Odibets', 'Mozzart'];

export default function Home() {
  const [bookie, setBookie] = useState<Bookie | 'All'>('All');
  const [status, setStatus] = useState<RoomStatus | 'All'>('All');
  const [query, setQuery] = useState('');
  const [viewTab, setViewTab] = useState<'active' | 'archive'>('active');
  const [newsFilter, setNewsFilter] = useState<'HOT' | 'Trending' | 'Fresh'>('HOT');
  const [heroSlide, setHeroSlide] = useState(0);
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
      if (viewTab === 'active' && j.status === 'settled') return false;
      if (viewTab === 'archive' && j.status !== 'settled') return false;
      if (bookie !== 'All' && j.bookie !== bookie) return false;
      if (status !== 'All' && j.status !== status) return false;
      if (query && !`${j.name} ${j.bookie} ${j.gameweek}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [activeJackpots, viewTab, bookie, status, query]);

  const totalPunters = activeJackpots.reduce((a, j) => a + j.participants, 0);

  // Mock editorial news list inspired by the ESPN reference
  const editorialNews = [
    {
      id: 'news-1',
      tag: 'HOT',
      image: '/images/celebration.jpg',
      title: 'Liverpool clobber Norwich in EPL opener as front three shine',
      desc: 'Jurgen Klopp’s men fired on all cylinders to kick off their domestic campaign with dominant finishing.',
      category: 'Premier League',
      date: 'Today, 2:40 PM',
      link: '/free'
    },
    {
      id: 'news-2',
      tag: 'HOT',
      image: '/images/midfielder.jpg',
      title: 'Frenkie de Jong on leaving Ajax, joining Barcelona, hopes for season',
      desc: 'The midfield orchestrator opens up about Camp Nou ambitions, tactical adjustments, and Champions League aims.',
      category: 'La Liga',
      date: 'Today, 1:15 PM',
      link: '/free'
    },
    {
      id: 'news-3',
      tag: 'HOT',
      image: '/images/match-action.jpg',
      title: 'Transfer Talk: PSG eye Modric, Vinicius if Real Madrid want Neymar',
      desc: 'High-stakes negotiations reach boiling point as European giants prepare blockbuster swap deals.',
      category: 'Transfers',
      date: 'Today, 11:30 AM',
      link: '/slips'
    },
    {
      id: 'news-4',
      tag: 'HOT',
      image: '/images/hero-striker.jpg',
      title: 'Can Spurs afford to lose Eriksen this summer? Tactical analysis',
      desc: 'Evaluating Pochettino’s midfield balance and whether Tottenham can mount a title push without their playmaker.',
      category: 'Analysis',
      date: 'Yesterday, 8:00 PM',
      link: '/free'
    }
  ];

  return (
    <div className="bg-[#FFFFF0] text-slate-900">
      <SeoHead
        title="MshindiRoom — Kenya's Premier Sports Consensus & Jackpot Arena"
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

      {/* =========================================================================
          SECTION 1: HERO EDITORIAL SHOWCASE (DIRECTLY INSPIRED BY ESPN REFERENCE)
          Left: Striker action cutout with slide dots
          Right: Bold Crimson Red headline, lead story, red outline button & floating previews
          ========================================================================= */}
      <section className="bg-white border-b border-slate-200 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">
            
            {/* Left Column: Striker Photo & Slide Indicators */}
            <div className="lg:col-span-5 relative flex flex-col items-center justify-center">
              <div className="relative w-full max-w-md lg:max-w-none rounded-3xl overflow-hidden aspect-[4/5] sm:aspect-[3/4] bg-[#0a1317] group">
                <SkeletonImage
                  src="/images/hero-striker.jpg"
                  alt="Dynamic Football Striker in Action"
                  className="w-full h-full object-cover object-top filter contrast-105 group-hover:scale-105 transition-transform duration-500"
                  containerClassName="w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
                
                {/* Overlay match badge */}
                <div className="absolute top-4 left-4">
                  <span className="bg-[#EEAA04] text-[#0a1317] text-xs font-bold px-3 py-1 rounded-full">
                    Featured match
                  </span>
                </div>

                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <p className="text-xs uppercase tracking-widest text-slate-300 font-bold">Chelsea FC vs Arsenal</p>
                  <p className="font-display font-black text-xl leading-tight text-white mt-1">Hazard magic has Chelsea sitting pretty</p>
                  <p className="text-xs text-slate-300 mt-1">Stamford Bridge · Premier League Derby</p>
                </div>
              </div>

              {/* Slide Indicators: ● ○ ○ as in ESPN reference */}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => setHeroSlide(0)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${heroSlide === 0 ? 'bg-[#006C54] w-6' : 'bg-slate-300 hover:bg-slate-400'}`}
                  aria-label="Slide 1"
                />
                <button
                  onClick={() => setHeroSlide(1)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${heroSlide === 1 ? 'bg-[#006C54] w-6' : 'bg-slate-300 hover:bg-slate-400'}`}
                  aria-label="Slide 2"
                />
                <button
                  onClick={() => setHeroSlide(2)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${heroSlide === 2 ? 'bg-[#006C54] w-6' : 'bg-slate-300 hover:bg-slate-400'}`}
                  aria-label="Slide 3"
                />
              </div>
            </div>

            {/* Right Column: Editorial Typography, CTA Button & Floating Thumbnail Previews */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <span className="inline-block text-[#006C54] font-bold text-sm mb-2">
                Top story & consensus
              </span>

              <h1 className="font-display font-medium text-4xl sm:text-5xl lg:text-6xl text-[#0a1317] leading-[1.16]">
                Hazard magic has Chelsea sitting pretty
              </h1>

              <p className="text-[#444950] text-base sm:text-lg mt-4 leading-relaxed max-w-2xl font-normal">
                Chelsea have maintained their lead in the race for the English Premier League title with Tottenham seemingly the only team close enough to catch them. On MshindiRoom, community consensus is rallying behind another dominant weekend slate.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-8">
                <a
                  href="#rooms"
                  className="btn-primary"
                >
                  <span>Jackpot rooms</span>
                  <ArrowRight size={15} />
                </a>
                <a
                  href="#match-schedule"
                  className="btn-secondary"
                >
                  <span>Read more</span>
                </a>
              </div>

              {/* Floating Match Thumbnail Previews underneath (As seen in the ESPN reference) */}
              <div className="mt-8 pt-6 border-t border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Live Highlights &amp; Slates</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="relative rounded-xl overflow-hidden aspect-[16/10] border border-slate-200 group cursor-pointer shadow-xs">
                    <SkeletonImage
                      src="/images/celebration.jpg"
                      alt="Match 1"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      containerClassName="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <span className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white truncate z-10">Liverpool vs Man City</span>
                  </div>
                  <div className="relative rounded-xl overflow-hidden aspect-[16/10] border border-slate-200 group cursor-pointer shadow-xs">
                    <SkeletonImage
                      src="/images/midfielder.jpg"
                      alt="Match 2"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      containerClassName="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <span className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white truncate z-10">Barcelona vs Arsenal</span>
                  </div>
                  <div className="relative rounded-xl overflow-hidden aspect-[16/10] border border-slate-200 group cursor-pointer shadow-xs">
                    <SkeletonImage
                      src="/images/match-action.jpg"
                      alt="Match 3"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      containerClassName="w-full h-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <span className="absolute bottom-1.5 left-2 right-2 text-[10px] font-bold text-white truncate z-10">Everton vs Porto</span>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: FULL-WIDTH CRIMSON RED "MATCH SCHEDULE" (ESPN REFERENCE CORE)
          Full-bleed Red background with clean white rounded match cards
          ========================================================================= */}
      <section id="match-schedule" className="espn-red-banner py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left description column */}
            <div className="lg:col-span-4 text-white">
              <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight leading-tight text-white">
                Match<br />Schedule
              </h2>
              <p className="text-white/85 text-xs sm:text-sm mt-4 leading-relaxed font-normal max-w-sm">
                Follow upcoming fixtures and weekly jackpot slates. Analyze team form, preview match statistics, and explore punter consensus before kickoff.
              </p>
              <div className="mt-6">
                <Link
                  to="/free"
                  className="espn-pill-btn-white-outline text-xs sm:text-sm"
                >
                  <span>More Matches</span>
                  <ChevronRight size={15} />
                </Link>
              </div>
            </div>

            {/* Right column: White Cards with Team Crests & Match Info */}
            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                
                {/* Match Card 1: Liverpool vs Manchester City */}
                <div className="bg-white rounded-2xl p-5 text-slate-900 shadow-xl flex flex-col justify-between hover:shadow-2xl transition-all">
                  <div>
                    {/* Crests */}
                    <div className="flex items-center justify-center gap-4 py-2 border-b border-slate-100">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center font-black text-xs text-[#006C54]">
                        LIV
                      </div>
                      <span className="text-xs font-bold text-slate-400">vs</span>
                      <div className="w-12 h-12 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center font-black text-xs text-sky-600">
                        MCI
                      </div>
                    </div>

                    <div className="mt-4">
                      <h3 className="font-display font-black text-base text-slate-900">Liverpool v Manchester City</h3>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">English Premier League</p>
                    </div>

                    <div className="text-xs text-slate-400 mt-4 space-y-0.5">
                      <p>Anfield Stadium</p>
                      <p className="font-medium text-slate-600">Sunday, 18 Oct 2026</p>
                      <p className="font-mono text-slate-500">08:45 PM</p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      to="/free"
                      className="text-xs font-bold text-slate-800 hover:text-[#006C54] inline-flex items-center gap-1.5 transition-colors group"
                    >
                      <span>Preview</span>
                      <span className="w-5 h-5 rounded-full bg-[#006C54] text-white flex items-center justify-center text-[10px] group-hover:translate-x-0.5 transition-transform">
                        →
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Match Card 2: Arsenal vs Barcelona */}
                <div className="bg-white rounded-2xl p-5 text-slate-900 shadow-xl flex flex-col justify-between hover:shadow-2xl transition-all">
                  <div>
                    {/* Crests */}
                    <div className="flex items-center justify-center gap-4 py-2 border-b border-slate-100">
                      <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center font-black text-xs text-red-700">
                        ARS
                      </div>
                      <span className="text-xs font-bold text-slate-400">vs</span>
                      <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-black text-xs text-blue-700">
                        FCB
                      </div>
                    </div>

                    <div className="mt-4">
                      <h3 className="font-display font-black text-base text-slate-900">Arsenal v Barcelona</h3>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">Champions League · Semi-Final</p>
                    </div>

                    <div className="text-xs text-slate-400 mt-4 space-y-0.5">
                      <p>Wembley Stadium</p>
                      <p className="font-medium text-slate-600">Sunday, 18 Oct 2026</p>
                      <p className="font-mono text-slate-500">07:30 PM</p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      to="/free"
                      className="text-xs font-bold text-slate-800 hover:text-[#006C54] inline-flex items-center gap-1.5 transition-colors group"
                    >
                      <span>Preview</span>
                      <span className="w-5 h-5 rounded-full bg-[#006C54] text-white flex items-center justify-center text-[10px] group-hover:translate-x-0.5 transition-transform">
                        →
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Match Card 3: Everton vs Porto */}
                <div className="bg-white rounded-2xl p-5 text-slate-900 shadow-xl flex flex-col justify-between hover:shadow-2xl transition-all">
                  <div>
                    {/* Crests */}
                    <div className="flex items-center justify-center gap-4 py-2 border-b border-slate-100">
                      <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-black text-xs text-blue-800">
                        EVE
                      </div>
                      <span className="text-xs font-bold text-slate-400">vs</span>
                      <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center font-black text-xs text-indigo-700">
                        FCP
                      </div>
                    </div>

                    <div className="mt-4">
                      <h3 className="font-display font-black text-base text-slate-900">Everton v Porto</h3>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">EURO League · Semi-Final</p>
                    </div>

                    <div className="text-xs text-slate-400 mt-4 space-y-0.5">
                      <p>Goodison Park Stadium</p>
                      <p className="font-medium text-slate-600">Saturday, 17 Oct 2026</p>
                      <p className="font-mono text-slate-500">07:45 PM</p>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Link
                      to="/free"
                      className="text-xs font-bold text-slate-800 hover:text-[#006C54] inline-flex items-center gap-1.5 transition-colors group"
                    >
                      <span>Preview</span>
                      <span className="w-5 h-5 rounded-full bg-[#006C54] text-white flex items-center justify-center text-[10px] group-hover:translate-x-0.5 transition-transform">
                        →
                      </span>
                    </Link>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: "LATEST NEWS" / 4-COLUMN CONTENT GRIDS (ESPN REFERENCE)
          Clean white background, bold red title, pill tab container, vertical photo cards with red HOT badges
          ========================================================================= */}
      <section className="bg-white py-12 sm:py-16 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header Row: Bold Primary Title + Pill Tab Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <h2 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-[#006C54] tracking-tight">
              Latest News
            </h2>

            {/* Pill Container: HOT · Trending · Fresh · ••• */}
            <div className="espn-tab-container">
              <button
                onClick={() => setNewsFilter('HOT')}
                className={`espn-tab-item ${newsFilter === 'HOT' ? 'active' : ''}`}
              >
                HOT
              </button>
              <button
                onClick={() => setNewsFilter('Trending')}
                className={`espn-tab-item ${newsFilter === 'Trending' ? 'active' : ''}`}
              >
                Trending
              </button>
              <button
                onClick={() => setNewsFilter('Fresh')}
                className={`espn-tab-item ${newsFilter === 'Fresh' ? 'active' : ''}`}
              >
                Fresh
              </button>
              <span className="text-slate-400 px-2 text-xs font-black">···</span>
            </div>
          </div>

          {/* 4-Column Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {editorialNews.map((news) => (
              <Link
                key={news.id}
                to={news.link}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-lg hover:border-slate-300 transition-all flex flex-col group"
              >
                {/* Image Top */}
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-900">
                  <img
                    src={news.image}
                    alt={news.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="espn-badge-hot">
                      {news.tag}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex flex-col flex-1 justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {news.category} · {news.date}
                    </span>
                    <h3 className="font-display font-black text-sm sm:text-base text-slate-900 leading-snug mt-1 group-hover:text-[#006C54] transition-colors">
                      {news.title}
                    </h3>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-semibold text-[#006C54] group-hover:underline">Read Pick →</span>
                    <span className="text-[11px] font-mono text-slate-400">mshindi.co.ke</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 4: FULL-WIDTH CRIMSON RED "FEATURED VIDEO & DEBATES" (ESPN REFERENCE)
          Full-bleed Red background with featured play banner and horizontal video cards
          ========================================================================= */}
      <section className="espn-red-banner py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex items-center justify-between mb-8 text-white">
            <h2 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl tracking-tight text-white">
              Featured Video &amp; Debates
            </h2>
            <Link to="/slips" className="text-xs sm:text-sm font-bold text-white hover:underline flex items-center gap-1">
              <span>View All Discussions</span>
              <ChevronRight size={15} />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Main Feature Banner (Left 5 cols) */}
            <div className="lg:col-span-5 relative rounded-2xl overflow-hidden shadow-2xl border border-white/20 aspect-[16/11] lg:aspect-auto group cursor-pointer">
              <img
                src="/images/celebration.jpg"
                alt="Liverpool clobber Norwich in EPL opener"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />

              <div className="absolute inset-0 p-6 flex flex-col justify-end text-white">
                <span className="bg-[#006C54] text-[#EEAA04] border border-[#005441] text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full w-fit mb-2">
                  TOP HIGHLIGHT
                </span>
                <h3 className="font-display font-black text-xl sm:text-2xl text-white leading-tight">
                  Liverpool clobber Norwich in EPL opener
                </h3>
                
                <div className="flex items-center gap-3 mt-4">
                  <div className="w-10 h-10 rounded-full bg-white text-[#006C54] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play size={18} fill="#006C54" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Play Video</span>
                    <span className="text-[10px] text-white/70 font-mono">www.youtube.com</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Horizontal Video Cards (Right 7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4 justify-between">
              
              {/* Video Item 1 */}
              <div className="bg-white/10 hover:bg-white/15 backdrop-blur-xs border border-white/20 rounded-2xl p-3.5 flex items-center gap-4 transition-all group cursor-pointer">
                <div className="relative w-32 sm:w-40 aspect-[16/10] rounded-xl overflow-hidden shrink-0 border border-white/20">
                  <img src="/images/midfielder.jpg" alt="Video 1" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-white/90 text-[#006C54] flex items-center justify-center shadow-md">
                      <Play size={14} fill="#006C54" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0 text-white">
                  <h4 className="font-display font-black text-sm sm:text-base leading-snug group-hover:text-amber-200 transition-colors">
                    Atlético asks La Liga to block Griezmann's Barcelona transfer
                  </h4>
                  <span className="text-[11px] text-white/70 font-mono block mt-1">www.youtube.com</span>
                </div>
              </div>

              {/* Video Item 2 */}
              <div className="bg-white/10 hover:bg-white/15 backdrop-blur-xs border border-white/20 rounded-2xl p-3.5 flex items-center gap-4 transition-all group cursor-pointer">
                <div className="relative w-32 sm:w-40 aspect-[16/10] rounded-xl overflow-hidden shrink-0 border border-white/20">
                  <img src="/images/match-action.jpg" alt="Video 2" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-white/90 text-[#006C54] flex items-center justify-center shadow-md">
                      <Play size={14} fill="#006C54" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0 text-white">
                  <h4 className="font-display font-black text-sm sm:text-base leading-snug group-hover:text-amber-200 transition-colors">
                    Inter Milan fan dies after clashes with Napoli supporters
                  </h4>
                  <span className="text-[11px] text-white/70 font-mono block mt-1">www.youtube.com</span>
                </div>
              </div>

              {/* Video Item 3 */}
              <div className="bg-white/10 hover:bg-white/15 backdrop-blur-xs border border-white/20 rounded-2xl p-3.5 flex items-center gap-4 transition-all group cursor-pointer">
                <div className="relative w-32 sm:w-40 aspect-[16/10] rounded-xl overflow-hidden shrink-0 border border-white/20">
                  <img src="/images/hero-striker.jpg" alt="Video 3" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-white/90 text-[#006C54] flex items-center justify-center shadow-md">
                      <Play size={14} fill="#006C54" />
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-w-0 text-white">
                  <h4 className="font-display font-black text-sm sm:text-base leading-snug group-hover:text-amber-200 transition-colors">
                    Bayern Munich 6-0 goal torrent in Bundesliga opener
                  </h4>
                  <span className="text-[11px] text-white/70 font-mono block mt-1">www.youtube.com</span>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          SECTION 5: ALL JACKPOT ROOMS & ARCHIVE ARENA (CORE FUNCTIONALITY)
          Clean white cards with real mockData, filters, search, and admin controls
          ========================================================================= */}
      <section id="rooms" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display font-black text-2xl sm:text-3xl lg:text-4xl text-slate-900 flex items-center gap-2.5">
              <Lock size={22} className="text-[#006C54]" />
              <span>Jackpot Consensus Rooms</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {viewTab === 'active'
                ? 'Showing unplayed and ongoing jackpot rooms. Settled rooms are automatically archived.'
                : 'Jackpot Archives: Review completed rooms, final winning slips, and historical leaderboards.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {isAuthorizedAdmin && (
              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="h-10 px-4 rounded-md bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 active:scale-95 transition-all shadow-2xs cursor-pointer"
              >
                <SlidersHorizontal size={14} className="text-[#006C54]" />
                <span>Jackpot Admin Console</span>
              </button>
            )}

            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search rooms..."
                className="bg-white border border-slate-200 rounded-full pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] w-full sm:w-64 shadow-xs transition-all"
              />
            </div>
          </div>
        </div>

        {/* View Mode Navigation Tabs: Active vs Archive */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 bg-white border border-slate-200 rounded-2xl p-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => {
                setViewTab('active');
                setStatus('All');
              }}
              className={`px-5 py-2 rounded-xl font-display font-black text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 ${
                viewTab === 'active'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Flame size={15} />
              <span>Active Rooms</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                viewTab === 'active' ? 'bg-white text-[#006C54]' : 'bg-slate-100 text-slate-600'
              }`}>
                {activeRooms.length}
              </span>
            </button>

            <button
              onClick={() => {
                setViewTab('archive');
                setStatus('All');
              }}
              className={`px-5 py-2 rounded-xl font-display font-black text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 ${
                viewTab === 'archive'
                  ? 'bg-[#006C54] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Archive size={15} />
              <span>Archives</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                viewTab === 'archive' ? 'bg-white text-[#006C54]' : 'bg-slate-100 text-slate-600'
              }`}>
                {archivedRooms.length}
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-500 px-3 py-1 flex items-center gap-2 font-mono shrink-0">
            {viewTab === 'active' ? (
              <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Showing live &amp; upcoming rooms</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-600 font-bold">
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Showing completed &amp; settled archives</span>
              </span>
            )}
          </div>
        </div>

        {/* Bookie Filter Pills */}
        <div className="flex items-center gap-2 mb-3.5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 flex-nowrap sm:flex-wrap">
          {bookies.map((b) => (
            <button
              key={b}
              onClick={() => setBookie(b)}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all shrink-0 whitespace-nowrap active:scale-95 ${
                bookie === b
                  ? 'bg-[#006C54] border-[#006C54] text-white shadow-xs font-black'
                  : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 flex-nowrap sm:flex-wrap">
          {statusOptions.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-4 py-2 rounded-full text-xs font-bold border capitalize transition-all shrink-0 whitespace-nowrap active:scale-95 ${
                status === s
                  ? 'bg-slate-900 border-slate-900 text-white shadow-xs font-black'
                  : 'border-slate-200 text-slate-600 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {s === 'All' ? (viewTab === 'active' ? 'All Active' : 'All Settled') : s}
            </button>
          ))}
        </div>

        {/* Archive Banner when in Archive mode */}
        {viewTab === 'archive' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-rise">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <Archive size={20} />
              </div>
              <div>
                <h3 className="font-display font-black text-base text-slate-900">Jackpot Archives &amp; Settlement History</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Settled jackpot rooms are retained for up to 90 days. You can review verified crowd accuracy, winning leg slips, and historical gameweek leaderboards.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setViewTab('active');
                setStatus('All');
              }}
              className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold transition-all shrink-0"
            >
              ← Back to Active Rooms
            </button>
          </div>
        )}

        {activeJackpots.length === 0 ? (
          <JackpotGridSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white border border-slate-200 rounded-2xl max-w-xl mx-auto space-y-4 shadow-xs">
            <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#006C54] flex items-center justify-center mx-auto">
              <SlidersHorizontal size={24} />
            </span>
            <div>
              <h3 className="font-display font-black text-lg text-slate-900">
                {viewTab === 'active' ? 'No Active Jackpot Rooms Found' : 'No Archived Rooms Found'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#006C54] hover:bg-[#005441] text-white font-bold text-xs shadow-xs transition-all"
              >
                <Archive size={15} />
                <span>Browse {archivedRooms.length} Archived Rooms</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((j, i) => (
              <JackpotCard key={j.id} jackpot={j} index={i} />
            ))}
          </div>
        )}

      </section>

      <JackpotAdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />
    </div>
  );
}
