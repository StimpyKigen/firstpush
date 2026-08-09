import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Dices, Check, ArrowRight, Sparkles, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useBetSlipStore, type BuiltSlipLeg } from '../lib/betSlipStore';
import { generateOddsForFixture, type BuilderFixture } from '../lib/builderFixtures';
import { showToast } from '../lib/notificationStore';
import Modal from './ui/Modal';

export interface MatchForBuilder {
  id: string;
  home: string;
  away: string;
  competition: string;
  kickoff: string;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  bookmaker?: string;
}

interface QuickBetBuilderModalProps {
  match: MatchForBuilder | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickBetBuilderModal({
  match,
  isOpen,
  onClose,
}: QuickBetBuilderModalProps) {
  const navigate = useNavigate();
  const builderLegs = useBetSlipStore((s) => s.builderLegs);
  const toggleBuilderLeg = useBetSlipStore((s) => s.toggleBuilderLeg);

  const fixtureAdapter: BuilderFixture | null = useMemo(() => {
    if (!match) return null;
    const hOdds = match.homeOdds || 2.10;
    const dOdds = match.drawOdds || 3.30;
    const aOdds = match.awayOdds || 3.60;
    return {
      id: match.id,
      homeTeam: match.home,
      awayTeam: match.away,
      competition: match.competition,
      kickoff: match.kickoff,
      homeOdds: hOdds,
      drawOdds: dOdds,
      awayOdds: aOdds,
      bookmaker: match.bookmaker,
      homeProb: 1 / hOdds,
      drawProb: 1 / dOdds,
      awayProb: 1 / aOdds,
    };
  }, [match]);

  const generatedMarkets = useMemo(() => {
    if (!fixtureAdapter) return null;
    return generateOddsForFixture(fixtureAdapter);
  }, [fixtureAdapter]);

  if (!isOpen || !match || !fixtureAdapter || !generatedMarkets) return null;

  const matchLegs = builderLegs.filter((l) => l.matchId === match.id);

  function handleSelectLeg(market: string, pick: string, odds: number) {
    if (!fixtureAdapter) return;
    const legId = `${fixtureAdapter.id}-${market}-${pick}`;

    const newLeg: BuiltSlipLeg = {
      id: legId,
      matchId: fixtureAdapter.id,
      homeTeam: fixtureAdapter.homeTeam,
      awayTeam: fixtureAdapter.awayTeam,
      competition: fixtureAdapter.competition,
      kickoff: fixtureAdapter.kickoff,
      market,
      pick,
      odds,
      status: 'pending',
    };

    const exists = builderLegs.some((l) => l.id === legId);
    toggleBuilderLeg(newLeg);

    if (exists) {
      showToast({ type: 'info', title: 'Pick Removed', message: `Removed ${pick} from Bet Builder` });
    } else {
      showToast({ type: 'success', title: 'Pick Added', message: `Added ${pick} (@ ${odds.toFixed(2)}x) to Bet Builder` });
    }
  }

  function isLegSelected(market: string, pick: string) {
    return builderLegs.some(
      (l) => l.matchId === match?.id && l.market === market && l.pick === pick
    );
  }

  return (
    <AnimatePresence>
      <Modal isOpen={true} overlayClassName="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-panel border-2 border-gold/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-ink-2 via-panel to-ink-2 p-4 border-b border-line flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gold/10 border border-gold/30 text-gold flex items-center justify-center shrink-0">
                <Dices size={20} />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-gold block">
                  Bet Builder Quick Selector
                </span>
                <h3 className="font-display font-bold text-base text-cream leading-tight">
                  {match.home} <span className="text-cream-dim font-normal">vs</span> {match.away}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-cream-dim hover:text-cream hover:bg-ink-2 rounded-xl transition-colors active:scale-95 touch-manipulation"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Subheader info */}
          <div className="bg-ink-2/60 px-4 py-2 border-b border-line/60 flex items-center justify-between text-xs text-cream-dim shrink-0">
            <span>{match.competition}</span>
            <span className="font-mono text-gold font-semibold">{match.kickoff}</span>
          </div>

          {/* Markets Body - Scrollable */}
          <div className="p-4 space-y-4 overflow-y-auto scroll-touch flex-1">
            {/* Match Result (1X2) */}
            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-cream-dim block mb-2">
                1. Match Result (1X2)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {generatedMarkets.matchResult.map((m) => {
                  const selected = isLegSelected('Match Result (1X2)', m.label);
                  return (
                    <button
                      key={m.code}
                      onClick={() => handleSelectLeg('Match Result (1X2)', m.label, m.odds)}
                      className={`p-2.5 rounded-xl border text-center transition-all touch-manipulation min-h-[50px] flex flex-col items-center justify-center active:scale-95 ${
                        selected
                          ? 'bg-gold text-ink font-extrabold border-gold shadow-md'
                          : 'bg-ink-2 border-line text-cream hover:border-gold/50'
                      }`}
                    >
                      <span className="text-[11px] leading-tight block font-semibold">{m.code}</span>
                      <span className={`text-xs font-mono font-black mt-0.5 ${selected ? 'text-ink' : 'text-gold'}`}>
                        {m.odds.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Double Chance */}
            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-cream-dim block mb-2">
                2. Double Chance
              </label>
              <div className="grid grid-cols-3 gap-2">
                {generatedMarkets.doubleChance.map((m) => {
                  const selected = isLegSelected('Double Chance', m.label);
                  return (
                    <button
                      key={m.code}
                      onClick={() => handleSelectLeg('Double Chance', m.label, m.odds)}
                      className={`p-2.5 rounded-xl border text-center transition-all touch-manipulation min-h-[50px] flex flex-col items-center justify-center active:scale-95 ${
                        selected
                          ? 'bg-gold text-ink font-extrabold border-gold shadow-md'
                          : 'bg-ink-2 border-line text-cream hover:border-gold/50'
                      }`}
                    >
                      <span className="text-[11px] leading-tight block font-semibold">{m.code}</span>
                      <span className={`text-xs font-mono font-black mt-0.5 ${selected ? 'text-ink' : 'text-gold'}`}>
                        {m.odds.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Both Teams To Score (BTTS) */}
            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-cream-dim block mb-2">
                3. Both Teams To Score (BTTS)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {generatedMarkets.btts.map((m) => {
                  const selected = isLegSelected('Both Teams To Score', m.label);
                  return (
                    <button
                      key={m.code}
                      onClick={() => handleSelectLeg('Both Teams To Score', m.label, m.odds)}
                      className={`p-2.5 rounded-xl border text-center transition-all touch-manipulation min-h-[48px] flex items-center justify-between px-3 active:scale-95 ${
                        selected
                          ? 'bg-gold text-ink font-extrabold border-gold shadow-md'
                          : 'bg-ink-2 border-line text-cream hover:border-gold/50'
                      }`}
                    >
                      <span className="text-xs font-semibold">{m.label}</span>
                      <span className={`text-xs font-mono font-black ${selected ? 'text-ink' : 'text-gold'}`}>
                        {m.odds.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Goals Over/Under */}
            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-cream-dim block mb-2">
                4. Goals Over/Under (2.5)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {generatedMarkets.overUnderGoals.slice(2, 4).map((m) => {
                  const selected = isLegSelected('Total Goals', m.label);
                  return (
                    <button
                      key={m.code}
                      onClick={() => handleSelectLeg('Total Goals', m.label, m.odds)}
                      className={`p-2.5 rounded-xl border text-center transition-all touch-manipulation min-h-[48px] flex items-center justify-between px-3 active:scale-95 ${
                        selected
                          ? 'bg-gold text-ink font-extrabold border-gold shadow-md'
                          : 'bg-ink-2 border-line text-cream hover:border-gold/50'
                      }`}
                    >
                      <span className="text-xs font-semibold">{m.label}</span>
                      <span className={`text-xs font-mono font-black ${selected ? 'text-ink' : 'text-gold'}`}>
                        {m.odds.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-ink-2 border-t border-line flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs">
              <span className="text-cream-dim block">In Match Slip:</span>
              <span className="font-bold text-gold">{matchLegs.length} market pick(s)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-2.5 rounded-xl border border-line text-cream-dim hover:text-cream text-xs font-bold transition-colors min-h-[40px] touch-manipulation"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onClose();
                  navigate('/slips');
                }}
                className="px-4 py-2.5 rounded-xl bg-gold text-ink font-black text-xs flex items-center gap-1.5 shadow hover:bg-amber-400 transition-all active:scale-95 min-h-[40px] touch-manipulation"
              >
                View Bet Slip <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      </Modal>
    </AnimatePresence>
  );
}
