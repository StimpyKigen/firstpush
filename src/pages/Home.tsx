import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import { SkeletonImage } from '../components/skeleton';

export default function Home() {
  const [heroSlide, setHeroSlide] = useState(0);

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
          HERO EDITORIAL SHOWCASE
          Left: Striker action cutout with slide dots
          Right: Headline, lead story, buttons & previews
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

              {/* Slide Indicators */}
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
                <Link
                  to="/leaderboard"
                  className="btn-primary"
                >
                  <span>Jackpot rooms</span>
                  <ArrowRight size={15} />
                </Link>
                <Link
                  to="/free"
                  className="btn-secondary"
                >
                  <span>Free Matches</span>
                </Link>
              </div>

              {/* Floating Match Thumbnail Previews underneath */}
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
    </div>
  );
}
