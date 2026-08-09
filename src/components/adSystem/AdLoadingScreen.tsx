import { Loader2, Sparkles, Tv } from 'lucide-react';

interface AdLoadingScreenProps {
  sponsorName?: string;
  onCancel?: () => void;
}

export default function AdLoadingScreen({ sponsorName = 'Ad Network Partner', onCancel }: AdLoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/90 backdrop-blur-md animate-fade-in">
      <div className="bg-panel border border-line rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-gold/10 rounded-full blur-2xl pointer-events-none" />

        <div className="w-14 h-14 rounded-2xl bg-gold/15 border border-gold/40 text-gold flex items-center justify-center mx-auto shadow-inner">
          <Tv size={28} className="animate-pulse" />
        </div>

        <div>
          <h3 className="font-display font-extrabold text-lg text-cream flex items-center justify-center gap-2">
            Loading Rewarded Ad
            <Sparkles size={16} className="text-gold" />
          </h3>
          <p className="text-xs text-cream-dim mt-1">
            Requesting shortest eligible ad from <span className="text-gold font-semibold">{sponsorName}</span>...
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 py-2 text-gold">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-xs font-mono font-bold tracking-wider">PRELOADING STREAM</span>
        </div>

        <p className="text-[11px] text-cream-dim/80 leading-relaxed border-t border-line/60 pt-3">
          Preparing your 15-minute temporary room access pass. Please do not close this window.
        </p>

        {onCancel && (
          <button
            onClick={onCancel}
            className="text-xs font-semibold text-cream-dim hover:text-cream pt-1 underline"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
