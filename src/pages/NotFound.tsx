import { Link } from 'react-router-dom';
import { Home as HomeIcon, AlertTriangle, ArrowLeft, Trophy, Dices, HelpCircle } from 'lucide-react';
import SeoHead from '../components/SeoHead';

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4 py-16">
      <SeoHead
        title="404 Page Not Found"
        description="The requested MshindiRoom page could not be found. Return to our jackpot consensus, free matches, or punter leaderboards."
        noIndex={true}
      />
      <div className="max-w-md w-full bg-panel border border-line rounded-3xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold/20 via-gold to-gold/20" />

        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-gold flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle size={32} />
        </div>

        <div className="space-y-2">
          <span className="text-xs tabular-nums font-bold uppercase tracking-wide text-gold">Error 404</span>
          <h1 className="text-2xl font-display font-bold text-cream">Page Not Found</h1>
          <p className="text-xs text-cream-dim leading-relaxed">
            The slip or page you are looking for has been moved, expired, or doesn't exist in our arena.
          </p>
        </div>

        <div className="pt-2 grid grid-cols-2 gap-2 text-left text-xs font-bold">
          <Link
            to="/"
            className="flex items-center gap-2 p-3 rounded-2xl bg-ink-2 border border-line hover:border-gold/50 text-cream transition-all group"
          >
            <HomeIcon size={16} className="text-gold group-hover:scale-110 transition-transform" />
            <span>Jackpot Rooms</span>
          </Link>

          <Link
            to="/free"
            className="flex items-center gap-2 p-3 rounded-2xl bg-ink-2 border border-line hover:border-gold/50 text-cream transition-all group"
          >
            <Dices size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>Free Matches</span>
          </Link>

          <Link
            to="/leaderboard"
            className="flex items-center gap-2 p-3 rounded-2xl bg-ink-2 border border-line hover:border-gold/50 text-cream transition-all group"
          >
            <Trophy size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span>Leaderboard</span>
          </Link>

          <Link
            to="/how-it-works"
            className="flex items-center gap-2 p-3 rounded-2xl bg-ink-2 border border-line hover:border-gold/50 text-cream transition-all group"
          >
            <HelpCircle size={16} className="text-sky-400 group-hover:scale-110 transition-transform" />
            <span>How It Works</span>
          </Link>
        </div>

        <div className="pt-4 border-t border-line">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-gold hover:underline"
          >
            <ArrowLeft size={14} />
            <span>Return to MshindiRoom Arena</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
