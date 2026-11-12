import { Plus, Globe, Layers, DollarSign, Calendar, Bot, RefreshCw, Sparkles, Check, AlertCircle, Trash2 } from 'lucide-react';
import { KENYAN_BETTING_SITES, type MajorKenyanBookie, type ExtractedMatch } from '../../lib/useJackpotAdminForm';
import { getBookieTheme } from '../../lib/bookies';
import AdminDropdown from '../admin/AdminDropdown';

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
  const currentTheme = getBookieTheme(selectedBookie);

  return (
    <div className="bg-white dark:bg-panel border border-[#E5E5EA] dark:border-line rounded-2xl p-5 space-y-6 shadow-2xs">
      {/* Section Heading */}
      <div className="pb-3 border-b border-[#E5E5EA] dark:border-line">
        <h3 className="font-semibold text-base text-slate-900 dark:text-cream flex items-center gap-2">
          <Plus size={18} className="text-[#006C54]" />
          <span>Create & Publish New Jackpot Room</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-cream-dim mt-0.5">
          Configure site, bookie jackpot prize pool, fixtures, or use the automated AI text auto-parser.
        </p>
      </div>

      {/* Bookmaker Selector Chips */}
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold text-slate-600 dark:text-cream-dim uppercase tracking-wider">
          Select Betting Provider
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {KENYAN_BETTING_SITES.slice(0, 8).map((site) => {
            const isSelected = selectedBookie === site;
            const t = getBookieTheme(site);
            return (
              <button
                key={site}
                type="button"
                onClick={() => {
                  setSelectedBookie(site);
                  if (site === 'SportPesa') setJackpotName('Mega Jackpot Pro');
                  else if (site === 'Betika') setJackpotName('Midweek Jackpot');
                  else if (site === 'MozzartBet') setJackpotName('Super Grand Jackpot');
                  else if (site === 'SportyBet') setJackpotName('Sporty 12 Jackpot');
                  else if (site === 'BetPawa') setJackpotName('pawa6 Mega Jackpot');
                  else if (site === '1xBet') setJackpotName('Toto 15 Jackpot');
                  else if (site === '22Bet') setJackpotName('Football Mania Jackpot');
                  else setJackpotName(`${site} Weekly Jackpot`);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#006C54] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-panel-2 text-slate-700 dark:text-cream hover:bg-slate-200 dark:hover:bg-panel border border-transparent dark:border-line'
                }`}
              >
                <img src={t.logo} alt={site} className="w-4 h-4 object-contain shrink-0 bg-transparent border-none rounded-[22%]" />
                <span>{site}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Grid */}
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Betting Site Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-cream mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Globe size={13} className="text-[#006C54] dark:text-emerald-400" /> Betting Site
            </span>
            <span className="text-[10px] text-slate-400 dark:text-cream-dim/60 tabular-nums uppercase font-semibold">Loaded</span>
          </label>
          <div className="flex items-center gap-2">
            <img
              src={currentTheme.logo}
              alt={selectedBookie}
              className="w-9 h-9 object-contain shrink-0 bg-transparent border-none rounded-[22%]"
            />
            <AdminDropdown
              value={selectedBookie}
              onChange={(b) => {
                const bookie = b as MajorKenyanBookie;
                setSelectedBookie(bookie);
                if (bookie === 'SportPesa') setJackpotName('Mega Jackpot Pro');
                else if (bookie === 'Betika') setJackpotName('Midweek Jackpot');
                else if (bookie === 'MozzartBet') setJackpotName('Super Grand Jackpot');
                else if (bookie === 'SportyBet') setJackpotName('Sporty 12 Jackpot');
                else if (bookie === 'BetPawa') setJackpotName('pawa6 Mega Jackpot');
                else if (bookie === '1xBet') setJackpotName('Toto 15 Jackpot');
                else if (bookie === '22Bet') setJackpotName('Football Mania Jackpot');
                else setJackpotName(`${bookie} Weekly Jackpot`);
              }}
              options={KENYAN_BETTING_SITES.map((site) => {
                const t = getBookieTheme(site);
                return {
                  value: site,
                  label: site,
                  icon: <img src={t.logo} alt={site} className="w-4 h-4 object-contain shrink-0 bg-transparent rounded-[22%]" />,
                };
              })}
              className="flex-1"
              buttonClassName="h-9"
            />
          </div>
        </div>

        {/* Number of Legs */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-cream mb-1.5 flex items-center gap-1.5">
            <Layers size={13} className="text-[#006C54] dark:text-emerald-400" /> Number of Legs
          </label>
          <AdminDropdown
            value={numLegs}
            onChange={(val) => {
              const count = Number(val);
              setNumLegs(count);
              if (matches.length > 0) onGenerateSample(count);
            }}
            options={[17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7].map((num) => ({
              value: num,
              label: `${num} Legs`,
            }))}
            buttonClassName="h-9"
          />
        </div>

        {/* Prize Pool */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-cream mb-1.5 flex items-center gap-1.5">
            <DollarSign size={13} className="text-[#006C54] dark:text-emerald-400" /> Prize Pool
          </label>
          <input
            type="text"
            value={prizePool}
            onChange={(e) => setPrizePool(e.target.value)}
            placeholder="e.g. Ksh 350,000,000"
            className="w-full h-9 bg-white dark:bg-panel border border-slate-300 dark:border-line rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-cream tabular-nums focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all shadow-2xs"
          />
        </div>

        {/* Date & Time */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-cream mb-1.5 flex items-center gap-1.5">
            <Calendar size={13} className="text-[#006C54] dark:text-emerald-400" /> Start Date & Time
          </label>
          <input
            type="datetime-local"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
            className="w-full h-9 bg-white dark:bg-panel border border-slate-300 dark:border-line rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 dark:text-cream tabular-nums focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Jackpot Title */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-cream mb-1.5 flex items-center justify-between">
          <span>
            Jackpot Room Display Title <span className="text-rose-500 font-bold">*</span>
          </span>
          <span className="text-[10px] text-slate-400 dark:text-cream-dim/60 font-medium uppercase tracking-wider">Required</span>
        </label>
        <input
          type="text"
          required
          value={jackpotName}
          onChange={(e) => setJackpotName(e.target.value)}
          placeholder="e.g. SportPesa Mega Jackpot Pro"
          className="w-full h-10 bg-white dark:bg-panel border border-slate-300 dark:border-line rounded-xl px-3.5 py-2 text-xs font-medium text-slate-900 dark:text-cream focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all shadow-2xs"
        />
      </div>

      {/* Raw Text Box & AI Parser */}
      <div className="bg-[#FBFBFA] dark:bg-panel-2 border border-[#E5E5EA] dark:border-line rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-cream flex items-center gap-2">
              <Bot size={16} className="text-[#006C54]" />
              <span>AI Jackpot Webpage Parser</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-cream-dim mt-0.5">
              Paste raw text from {selectedBookie}'s webpage below. AI extracts and structures all {numLegs} matches automatically.
            </p>
          </div>

          <button
            type="button"
            onClick={onAiArrange}
            disabled={isAiProcessing || !webpageText.trim()}
            className="inline-flex items-center justify-center gap-2 bg-[#006C54] hover:bg-[#005441] text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-all disabled:opacity-50 shrink-0 cursor-pointer shadow-xs active:scale-95"
          >
            {isAiProcessing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>AI Structuring Layout...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>AI Arrange & Set Matches ({numLegs} Legs)</span>
              </>
            )}
          </button>
        </div>

        <textarea
          rows={4}
          value={webpageText}
          onChange={(e) => setWebpageText(e.target.value)}
          placeholder={`Paste ${selectedBookie} jackpot webpage text here (e.g. copy all matches from ${selectedBookie}...)\nExample:\n1. Arsenal vs Coventry City 21/08 22:00\n2. Trabzonspor vs Al Sadd 30/07 20:00...`}
          className="w-full bg-white dark:bg-panel border border-slate-300 dark:border-line rounded-xl p-3 text-xs text-slate-900 dark:text-cream tabular-nums placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all shadow-2xs"
        />

        {aiSuccessMessage && (
          <div className="p-3 bg-[#E8F5EE] border border-emerald-200 rounded-xl text-xs font-semibold text-[#006C54] flex items-center gap-2">
            <Check size={16} />
            <span>{aiSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Match Layout Preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-cream flex items-center gap-2">
            <span>Match Layout Preview ({matches.length} / {numLegs} legs)</span>
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onGenerateSample(numLegs)}
              className="text-xs font-semibold text-slate-600 dark:text-cream-dim hover:text-[#006C54] dark:hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Load Template
            </button>
            <button
              type="button"
              onClick={onAddMatch}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006C54] dark:text-emerald-400 bg-[#E8F5EE] dark:bg-[#006C54]/20 hover:bg-[#D7EFE0] dark:hover:bg-[#006C54]/30 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Match</span>
            </button>
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-300 dark:border-line rounded-xl text-xs text-slate-500 dark:text-cream-dim">
            No matches loaded yet. Paste webpage text and click "AI Arrange & Set Matches" above.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1 no-scrollbar overscroll-contain scroll-isolated">
            {matches.map((m, idx) => (
              <div
                key={idx}
                className="bg-[#FBFBFA] dark:bg-panel-2 border border-[#E5E5EA] dark:border-line rounded-xl p-2.5 grid grid-cols-12 gap-2 items-center text-xs"
              >
                <div className="col-span-1 tabular-nums font-bold text-slate-700 dark:text-cream-dim text-center">
                  #{idx + 1}
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={m.home}
                    onChange={(e) => onUpdateMatch(idx, 'home', e.target.value)}
                    placeholder="Home Team"
                    className="w-full bg-white dark:bg-panel border border-slate-300 dark:border-line rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-cream font-medium focus:outline-none focus:border-[#006C54]"
                  />
                </div>
                <div className="col-span-1 text-center font-semibold text-slate-400">
                  vs
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={m.away}
                    onChange={(e) => onUpdateMatch(idx, 'away', e.target.value)}
                    placeholder="Away Team"
                    className="w-full bg-white dark:bg-panel border border-slate-300 dark:border-line rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-cream font-medium focus:outline-none focus:border-[#006C54]"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={m.competition}
                    onChange={(e) => onUpdateMatch(idx, 'competition', e.target.value)}
                    placeholder="League / Competition"
                    className="w-full bg-white dark:bg-panel border border-slate-300 dark:border-line rounded-lg px-2.5 py-1.5 text-xs text-slate-600 dark:text-cream-dim focus:outline-none focus:border-[#006C54]"
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => onRemoveMatch(idx)}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1.5 transition-colors cursor-pointer"
                    title="Remove Match"
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#E5E5EA] dark:border-line">
        <span className="text-xs text-slate-500 dark:text-cream-dim flex items-center gap-1.5">
          <AlertCircle size={14} className="text-[#006C54] dark:text-emerald-400" />
          <span>Publishing will immediately make this room visible to all live users.</span>
        </span>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-slate-300 dark:border-line text-slate-700 dark:text-cream hover:bg-slate-100 dark:hover:bg-panel-2 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onPublish}
            className="h-9 px-5 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer active:scale-[0.99]"
          >
            Publish Jackpot Room
          </button>
        </div>
      </div>
    </div>
  );
}
