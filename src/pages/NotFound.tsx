import { Link } from 'react-router-dom';
import { Trophy, Dices, HelpCircle, Home as HomeIcon } from 'lucide-react';
import SeoHead from '../components/SeoHead';
import ErrorState from '../components/errors/ErrorState';

export default function NotFound() {
  return (
    <div className="min-h-[70dvh] flex flex-col items-center justify-center px-4 py-10">
      <SeoHead
        title="404 Page Not Found"
        description="The requested MshindiRoom page could not be found. Return to our jackpot consensus, free matches, or punter leaderboards."
        noIndex={true}
      />

      <ErrorState kind="not-found" variant="page" className="!min-h-0 !pb-6" />

      {/* Helpful destinations, kept from the previous 404 page. */}
      <nav
        aria-label="Popular pages"
        className="grid w-full max-w-sm grid-cols-2 gap-2 text-left text-xs font-bold"
      >
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
      </nav>
    </div>
  );
}
