import type { MatchConsensus } from '../lib/types';

const OUTCOMES: { key: 'homePct' | 'drawPct' | 'awayPct'; label: string; short: string; color: string; textColor: string }[] = [
  { key: 'homePct', label: 'Home Win', short: '1', color: '#006C54', textColor: '#FFFFF0' },
  { key: 'drawPct', label: 'Draw', short: 'X', color: '#8A6500', textColor: '#FFFFF0' },
  { key: 'awayPct', label: 'Away Win', short: '2', color: '#e41e3f', textColor: '#FFFFF0' },
];

export default function OutcomeBar({
  consensus,
  homeOdds,
  drawOdds,
  awayOdds,
  bookmaker,
}: {
  consensus: MatchConsensus;
  homeOdds?: number;
  drawOdds?: number;
  awayOdds?: number;
  bookmaker?: string;
}) {
  const { homePct, drawPct, awayPct, totalVotes } = consensus;
  const values = { homePct, drawPct, awayPct };
  const majority = Math.max(homePct, drawPct, awayPct);
  const majorityKey = OUTCOMES.find((o) => values[o.key] === majority)!;

  // Calculate official bookmaker odds if not provided explicitly
  const oddsMap = {
    homePct: homeOdds || +Math.max(1.05, 1.07 / (homePct / 100)).toFixed(2),
    drawPct: drawOdds || +Math.max(1.05, 1.07 / (drawPct / 100)).toFixed(2),
    awayPct: awayOdds || +Math.max(1.05, 1.07 / (Math.max(1, awayPct) / 100)).toFixed(2),
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-cream-dim font-semibold">
        <span>{totalVotes.toLocaleString()} punters picked this leg</span>
        <span className="flex items-center gap-1.5 text-gold font-bold">
          Mass pick: {majorityKey.label} · {majority}%
        </span>
      </div>

      {/* Big percentage tiles with official bookmaker odds */}
      <div className="grid grid-cols-3 gap-2">
        {OUTCOMES.map((o) => {
          const val = values[o.key];
          const oddsVal = oddsMap[o.key];
          const isMajority = val === majority;
          return (
            <div
              key={o.key}
              className="rounded-xl px-2 py-3 flex flex-col items-center justify-center gap-1 border-2 transition-transform"
              style={{
                borderColor: isMajority ? o.color : 'transparent',
                backgroundColor: isMajority ? `${o.color}18` : '#F5F5E4',
                transform: isMajority ? 'scale(1.03)' : 'scale(1)',
              }}
            >
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color: isMajority ? o.color : '#5d6c7b' }}>
                {o.short} · {o.label}
              </span>
              <span className="font-display font-extrabold text-2xl sm:text-3xl leading-none" style={{ color: isMajority ? o.color : '#1c1e21' }}>
                {val}%
              </span>
              <div className="mt-1 px-2.5 py-0.5 rounded-full bg-[#FFFFF0] border border-line flex items-center gap-1.5 text-[10px] font-mono font-bold shadow-2xs">
                <span className="text-cream-dim text-[9px] uppercase">Odds</span>
                <span className="text-[#8A6500] font-extrabold">{oddsVal.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slim proportional bar for quick visual scan */}
      <div className="flex h-3 rounded-full overflow-hidden border border-line">
        <div className="transition-all" style={{ width: `${homePct}%`, backgroundColor: '#006C54' }} />
        <div className="transition-all" style={{ width: `${drawPct}%`, backgroundColor: '#8A6500' }} />
        <div className="transition-all" style={{ width: `${awayPct}%`, backgroundColor: '#e41e3f' }} />
      </div>

      {bookmaker && (
        <div className="text-[10px] font-mono text-right text-cream-dim/70">
          Official Bookmaker Odds source: <span className="text-cream font-semibold">{bookmaker}</span>
        </div>
      )}
    </div>
  );
}
