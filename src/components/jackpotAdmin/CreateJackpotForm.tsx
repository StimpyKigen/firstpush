import { Plus, Globe, Layers, DollarSign, Calendar, Bot, RefreshCw, Sparkles, Check, AlertCircle, Trash2 } from 'lucide-react';
import { KENYAN_BETTING_SITES, type MajorKenyanBookie, type ExtractedMatch } from '../../lib/useJackpotAdminForm';
import { getBookieTheme } from '../../lib/bookies';

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
    <div className="bg-white border border-[#E5E5EA] rounded-2xl p-5 space-y-6 shadow-2xs">
      {/* Section Heading */}
      <div className="pb-3 border-b border-[#E5E5EA]">
        <h3 className="font-semibold text-base text-slate-900 flex items-center gap-2">
          <Plus size={18} className="text-[#006C54]" />
          <span>Create & Publish New Jackpot Room</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure site, bookie jackpot prize pool, fixtures, or use the automated AI text auto-parser.
        </p>
      </div>

      {/* Bookmaker Selector Chips */}
      <div className="space-y-2">
        <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
          Select Betting Provider
        </label>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <img src={t.logo} alt={site} className="w-4 h-4 object-contain shrink-0" />
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
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Globe size={13} className="text-[#006C54]" /> Betting Site
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">Logo Loaded</span>
          </label>
          <div className="flex items-center gap-2">
            <img
              src={currentTheme.logo}
              alt={selectedBookie}
              className="w-10 h-10 object-contain shrink-0"
            />
            <select
              value={selectedBookie}
              onChange={(e) => {
                const b = e.target.value as MajorKenyanBookie;
                setSelectedBookie(b);
                if (b === 'SportPesa') setJackpotName('Mega Jackpot Pro');
                else if (b === 'Betika') setJackpotName('Midweek Jackpot');
                else if (b === 'MozzartBet') setJackpotName('Super Grand Jackpot');
                else if (b === 'SportyBet') setJackpotName('Sporty 12 Jackpot');
                else if (b === 'BetPawa') setJackpotName('pawa6 Mega Jackpot');
                else if (b === '1xBet') setJackpotName('Toto 15 Jackpot');
                else if (b === '22Bet') setJackpotName('Football Mania Jackpot');
                else setJackpotName(`${b} Weekly Jackpot`);
              }}
              className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
            >
              {KENYAN_BETTING_SITES.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Number of Legs */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Layers size={13} className="text-[#006C54]" /> Number of Legs
          </label>
          <select
            value={numLegs}
            onChange={(e) => {
              const count = Number(e.target.value);
              setNumLegs(count);
              if (matches.length > 0) onGenerateSample(count);
            }}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
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
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <DollarSign size={13} className="text-[#006C54]" /> Prize Pool
          </label>
          <input
            type="text"
            value={prizePool}
            onChange={(e) => setPrizePool(e.target.value)}
            placeholder="e.g. Ksh 350,000,000"
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
          />
        </div>

        {/* Date & Time */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Calendar size={13} className="text-[#006C54]" /> Start Date & Time
          </label>
          <input
            type="datetime-local"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all"
          />
        </div>
      </div>

      {/* Jackpot Title */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
          Jackpot Room Display Title
        </label>
        <input
          type="text"
          value={jackpotName}
          onChange={(e) => setJackpotName(e.target.value)}
          placeholder="e.g. Mega Jackpot Pro"
          className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all shadow-2xs"
        />
      </div>

      {/* Raw Text Box & AI Parser */}
      <div className="bg-[#FBFBFA] border border-[#E5E5EA] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Bot size={16} className="text-[#006C54]" />
              <span>AI Jackpot Webpage Parser</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
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
          className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 tabular-nums placeholder:text-slate-400 focus:outline-none focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] transition-all shadow-2xs"
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
          <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
            <span>Match Layout Preview ({matches.length} / {numLegs} legs)</span>
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onGenerateSample(numLegs)}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 underline cursor-pointer"
            >
              Load Template
            </button>
            <button
              type="button"
              onClick={onAddMatch}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006C54] bg-[#E8F5EE] hover:bg-[#D7EFE0] px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Match</span>
            </button>
          </div>
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
            No matches loaded yet. Paste webpage text and click "AI Arrange & Set Matches" above.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {matches.map((m, idx) => (
              <div
                key={idx}
                className="bg-[#FBFBFA] border border-[#E5E5EA] rounded-xl p-2.5 grid grid-cols-12 gap-2 items-center text-xs"
              >
                <div className="col-span-1 tabular-nums font-bold text-slate-700 text-center">
                  #{idx + 1}
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={m.home}
                    onChange={(e) => onUpdateMatch(idx, 'home', e.target.value)}
                    placeholder="Home Team"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-[#006C54]"
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
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-[#006C54]"
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={m.competition}
                    onChange={(e) => onUpdateMatch(idx, 'competition', e.target.value)}
                    placeholder="League / Competition"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:border-[#006C54]"
                  />
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => onRemoveMatch(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1.5 transition-colors cursor-pointer"
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#E5E5EA]">
        <span className="text-xs text-slate-500 flex items-center gap-1.5">
          <AlertCircle size={14} className="text-[#006C54]" />
          <span>Publishing will immediately make this room visible to all live users.</span>
        </span>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onPublish}
            className="px-5 py-2 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white font-semibold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
          >
            Publish Jackpot Room
          </button>
        </div>
      </div>
    </div>
  );
}
