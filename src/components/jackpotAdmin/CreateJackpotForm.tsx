import { Plus, Globe, Layers, DollarSign, Calendar, Bot, RefreshCw, Sparkles, Check, AlertCircle, Trash2 } from 'lucide-react';
import { KENYAN_BETTING_SITES, type MajorKenyanBookie, type ExtractedMatch } from '../../lib/useJackpotAdminForm';

interface CreateJackpotFormProps {
  selectedBookie: MajorKenyanBookie;
  setSelectedBookie: (b: MajorKenyanBookie) => void;
  jackpotName: string;
  setJackpotName: (v: string) => void;
  numLegs: number;
  setNumLegs: (n: number) => void;
  prizePool: string;
  setPrizePool: (v: string) => void;
  startDateTime: string;
  setStartDateTime: (v: string) => void;
  webpageText: string;
  setWebpageText: (v: string) => void;
  isAiProcessing: boolean;
  aiSuccessMessage: string;
  matches: ExtractedMatch[];
  onAiArrange: () => void;
  onGenerateSample: (count: number) => void;
  onUpdateMatch: (index: number, field: keyof ExtractedMatch, value: any) => void;
  onAddMatch: () => void;
  onRemoveMatch: (index: number) => void;
  onClose: () => void;
  onPublish: () => void;
}

export default function CreateJackpotForm({
  selectedBookie,
  setSelectedBookie,
  jackpotName,
  setJackpotName,
  numLegs,
  setNumLegs,
  prizePool,
  setPrizePool,
  startDateTime,
  setStartDateTime,
  webpageText,
  setWebpageText,
  isAiProcessing,
  aiSuccessMessage,
  matches,
  onAiArrange,
  onGenerateSample,
  onUpdateMatch,
  onAddMatch,
  onRemoveMatch,
  onClose,
  onPublish,
}: CreateJackpotFormProps) {
  return (
    <>
      {/* Section Heading for Publishing New Room */}
      <div className="border-t border-line pt-4">
        <h3 className="font-display font-extrabold text-base text-cream flex items-center gap-2 mb-1">
          <Plus size={18} className="text-gold" /> Create & Publish New Jackpot Room
        </h3>
        <p className="text-xs text-cream-dim">Configure site, bookie jackpot amount, fixtures, or use AI text auto-parser</p>
      </div>

      {/* Top Config Grid */}
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Dropdown for Betting Site Names */}
        <div>
          <label className="block text-xs font-bold text-cream-dim mb-1.5 flex items-center gap-1">
            <Globe size={13} className="text-gold" /> Betting Site Name
          </label>
          <select
            value={selectedBookie}
            onChange={(e) => {
              const b = e.target.value as MajorKenyanBookie;
              setSelectedBookie(b);
              if (b === 'SportPesa') setJackpotName('Mega Jackpot Pro');
              else if (b === 'Betika') setJackpotName('Midweek Jackpot');
              else if (b === 'MozzartBet') setJackpotName('Super Grand Jackpot');
              else setJackpotName(`${b} Weekly Jackpot`);
            }}
            className="w-full bg-ink-2 border border-line rounded-xl px-3 py-2.5 text-sm text-cream font-semibold focus:outline-none focus:border-gold"
          >
            {KENYAN_BETTING_SITES.map((site) => (
              <option key={site} value={site}>
                {site}
              </option>
            ))}
          </select>
        </div>

        {/* Number of legs dropdown (13 to 17) */}
        <div>
          <label className="block text-xs font-bold text-cream-dim mb-1.5 flex items-center gap-1">
            <Layers size={13} className="text-emerald-2" /> Number of Legs
          </label>
          <select
            value={numLegs}
            onChange={(e) => {
              const count = Number(e.target.value);
              setNumLegs(count);
              if (matches.length > 0) onGenerateSample(count);
            }}
            className="w-full bg-ink-2 border border-line rounded-xl px-3 py-2.5 text-sm text-cream font-semibold focus:outline-none focus:border-emerald-2"
          >
            <option value={13}>13 Games (Midweek Jackpot)</option>
            <option value={14}>14 Games (Pro Jackpot)</option>
            <option value={15}>15 Games (Betika Midweek / Shabiki)</option>
            <option value={16}>16 Games (Grand Pro)</option>
            <option value={17}>17 Games (SportPesa Mega Jackpot)</option>
          </select>
        </div>

        {/* Prize Pool */}
        <div>
          <label className="block text-xs font-bold text-cream-dim mb-1.5 flex items-center gap-1">
            <DollarSign size={13} className="text-gold" /> Bookie Jackpot Amount
          </label>
          <input
            type="text"
            value={prizePool}
            onChange={(e) => setPrizePool(e.target.value)}
            placeholder="e.g. Ksh 350,000,000"
            className="w-full bg-ink-2 border border-line rounded-xl px-3 py-2.5 text-sm text-cream font-semibold focus:outline-none focus:border-gold"
          />
        </div>

        {/* Date & Time Setting Calendar */}
        <div>
          <label className="block text-xs font-bold text-cream-dim mb-1.5 flex items-center gap-1">
            <Calendar size={13} className="text-[#3b82f6]" /> Jackpot Start Date & Time
          </label>
          <input
            type="datetime-local"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
            className="w-full bg-ink-2 border border-line rounded-xl px-3 py-2.5 text-sm text-cream focus:outline-none focus:border-[#3b82f6]"
          />
        </div>
      </div>

      {/* Jackpot Title input */}
      <div>
        <label className="block text-xs font-bold text-cream-dim mb-1.5">Jackpot Room Display Title</label>
        <input
          type="text"
          value={jackpotName}
          onChange={(e) => setJackpotName(e.target.value)}
          placeholder="e.g. Mega Jackpot Pro"
          className="w-full bg-ink-2 border border-line rounded-xl px-4 py-2.5 text-sm text-cream font-semibold focus:outline-none focus:border-gold"
        />
      </div>

      {/* Raw Text Box & AI Extension */}
      <div className="bg-ink-2 border border-line rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-cream flex items-center gap-1.5">
              <Bot size={16} className="text-gold" /> AI Jackpot Webpage Parser Extension
            </h3>
            <p className="text-xs text-cream-dim">
              Paste raw text from {selectedBookie}'s webpage below. AI will clean and format all {numLegs} matches automatically!
            </p>
          </div>

          <button
            type="button"
            onClick={onAiArrange}
            disabled={isAiProcessing || !webpageText.trim()}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-gold to-gold-2 hover:from-gold-2 hover:to-gold text-ink font-bold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 shrink-0 shadow-lg"
          >
            {isAiProcessing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                AI Structuring Layout...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                AI Arrange & Set Matches ({numLegs} Legs)
              </>
            )}
          </button>
        </div>

        <textarea
          rows={5}
          value={webpageText}
          onChange={(e) => setWebpageText(e.target.value)}
          placeholder={`Paste ${selectedBookie} jackpot webpage text here (e.g. copy all matches from ${selectedBookie}...)\nExample:\n1. Arsenal vs Coventry City 21/08 22:00\n2. Trabzonspor vs Al Sadd 30/07 20:00...`}
          className="w-full bg-panel border border-line rounded-xl p-3 text-xs text-cream font-mono placeholder:text-cream-dim/60 focus:outline-none focus:border-gold"
        />

        {aiSuccessMessage && (
          <div className="p-3 bg-emerald-2/15 border border-emerald-2/30 rounded-xl text-xs font-bold text-emerald-2 flex items-center gap-2">
            <Check size={16} />
            {aiSuccessMessage}
          </div>
        )}
      </div>

      {/* Match Fixture Layout List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-base text-cream flex items-center gap-2">
            Match Layout Preview ({matches.length} / {numLegs} legs)
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onGenerateSample(numLegs)}
              className="text-xs font-semibold text-cream-dim hover:text-cream underline"
            >
              Load Template
            </button>
            <button
              type="button"
              onClick={onAddMatch}
              className="inline-flex items-center gap-1 text-xs font-bold text-gold hover:text-gold-2 bg-gold/10 border border-gold/30 px-3 py-1.5 rounded-lg"
            >
              <Plus size={13} /> Add Match
            </button>
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-line rounded-xl text-xs text-cream-dim">
            No matches loaded yet. Paste webpage text and click "AI Arrange & Set Matches" above.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {matches.map((m, idx) => (
              <div key={idx} className="bg-ink-2 border border-line/80 rounded-xl p-3 grid grid-cols-12 gap-2 items-center text-xs">
                <div className="col-span-1 font-mono font-bold text-gold text-center">#{idx + 1}</div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={m.home}
                    onChange={(e) => onUpdateMatch(idx, 'home', e.target.value)}
                    placeholder="Home Team"
                    className="w-full bg-panel border border-line rounded px-2 py-1 text-cream font-semibold focus:border-gold"
                  />
                </div>
                <div className="col-span-1 text-center font-bold text-cream-dim">vs</div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={m.away}
                    onChange={(e) => onUpdateMatch(idx, 'away', e.target.value)}
                    placeholder="Away Team"
                    className="w-full bg-panel border border-line rounded px-2 py-1 text-cream font-semibold focus:border-gold"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={m.competition}
                    onChange={(e) => onUpdateMatch(idx, 'competition', e.target.value)}
                    placeholder="League/Comp"
                    className="w-full bg-panel border border-line rounded px-2 py-1 text-cream-dim focus:border-gold"
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => onRemoveMatch(idx)}
                    className="text-rose-400 hover:text-rose-300 p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-line">
        <span className="text-xs text-cream-dim flex items-center gap-1">
          <AlertCircle size={13} className="text-gold" /> Updating will publish this room to all live users instantly.
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-line text-cream-dim hover:text-cream text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onPublish}
            className="px-6 py-2.5 rounded-xl bg-emerald-2 hover:bg-emerald-500 text-ink font-bold text-xs shadow-lg transition-all"
          >
            Publish & Update Jackpot Room
          </button>
        </div>
      </div>
    </>
  );
}
