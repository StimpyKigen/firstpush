import { Search, X, Tag, ShieldAlert, Edit2, Trash2 } from 'lucide-react';
import type { DictionaryEntry, ModerationSeverity, ModerationAction } from '../../types/moderation';
import { ALL_CATEGORIES, SEVERITY_LEVELS } from '../../lib/useModerationDictionary';

interface DictionaryPanelProps {
  dictionary: DictionaryEntry[];
  filteredEntries: DictionaryEntry[];
  totalCount: number;
  enabledCount: number;
  criticalCount: number;
  reviewOnlyCount: number;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  selectedSeverity: string;
  setSelectedSeverity: (v: string) => void;
  selectedStatus: 'ALL' | 'ENABLED' | 'DISABLED';
  setSelectedStatus: (v: 'ALL' | 'ENABLED' | 'DISABLED') => void;
  onEdit: (entry: DictionaryEntry) => void;
  onDelete: (entry: DictionaryEntry) => void;
  onToggle: (id: string) => void;
  getSeverityBadgeClass: (sev: ModerationSeverity) => string;
  getActionBadgeClass: (act: ModerationAction) => string;
}

const SEVERITY_TEXT_COLORS: Record<string, string> = {
  Critical: 'text-rose-600 dark:text-rose-400',
  High: 'text-amber-600 dark:text-amber-400',
  Medium: 'text-yellow-600 dark:text-yellow-400',
  Low: 'text-blue-600 dark:text-blue-400',
  'Review Only': 'text-purple-600 dark:text-purple-400',
};

const ACTION_TEXT_COLORS: Record<string, string> = {
  Block: 'text-rose-600 dark:text-rose-400',
  Flag: 'text-amber-600 dark:text-amber-400',
  Review: 'text-purple-600 dark:text-purple-400',
  Mask: 'text-cyan-600 dark:text-cyan-400',
};

export default function DictionaryPanel({
  dictionary,
  filteredEntries,
  totalCount,
  enabledCount,
  criticalCount,
  reviewOnlyCount,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedSeverity,
  setSelectedSeverity,
  selectedStatus,
  setSelectedStatus,
  onEdit,
  onDelete,
  onToggle,
  getSeverityBadgeClass,
  getActionBadgeClass,
}: DictionaryPanelProps) {
  return (
    <div className="space-y-5">
      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-panel border border-[#E5E5EA] dark:border-line p-3.5 rounded-2xl shadow-2xs">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-cream-dim uppercase tracking-wider">Total Entries</p>
          <p className="font-bold text-2xl text-slate-900 dark:text-cream mt-0.5 tabular-nums">{totalCount}</p>
        </div>
        <div className="bg-white dark:bg-panel border border-[#E5E5EA] dark:border-line p-3.5 rounded-2xl shadow-2xs">
          <p className="text-[11px] font-semibold text-[#006C54] dark:text-[#00A881] uppercase tracking-wider">Active Rules</p>
          <p className="font-bold text-2xl text-[#006C54] dark:text-[#00A881] mt-0.5 tabular-nums">{enabledCount}</p>
        </div>
        <div className="bg-white dark:bg-panel border border-[#E5E5EA] dark:border-line p-3.5 rounded-2xl shadow-2xs">
          <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Critical Rules</p>
          <p className="font-bold text-2xl text-rose-600 dark:text-rose-400 mt-0.5 tabular-nums">{criticalCount}</p>
        </div>
        <div className="bg-white dark:bg-panel border border-[#E5E5EA] dark:border-line p-3.5 rounded-2xl shadow-2xs">
          <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Review Only</p>
          <p className="font-bold text-2xl text-indigo-600 dark:text-indigo-400 mt-0.5 tabular-nums">{reviewOnlyCount}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-panel border border-[#E5E5EA] dark:border-line p-4 rounded-2xl space-y-3 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-5 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-cream-dim" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phrases or notes..."
              className="w-full bg-[#FBFBFA] dark:bg-panel-2 border border-slate-300 dark:border-line focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-cream placeholder-slate-400 dark:placeholder-cream-dim/60 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-cream-dim hover:text-slate-700 dark:hover:text-cream cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="sm:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#FBFBFA] dark:bg-panel-2 border border-slate-300 dark:border-line focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-cream focus:outline-none transition-all"
            >
              <option value="ALL">All Categories ({totalCount})</option>
              {ALL_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} ({dictionary.filter((d) => d.category === cat).length})
                </option>
              ))}
            </select>
          </div>

          {/* Severity Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full bg-[#FBFBFA] dark:bg-panel-2 border border-slate-300 dark:border-line focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-cream focus:outline-none transition-all"
            >
              <option value="ALL">All Severities</option>
              {SEVERITY_LEVELS.map((sev) => (
                <option key={sev} value={sev}>
                  {sev}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="sm:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full bg-[#FBFBFA] dark:bg-panel-2 border border-slate-300 dark:border-line focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-cream focus:outline-none transition-all"
            >
              <option value="ALL">All Status</option>
              <option value="ENABLED">Enabled</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </div>
        </div>

        {/* Category Quick Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-cream-dim uppercase tracking-wider mr-1 shrink-0">Quick Filter:</span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-[#006C54] text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-panel-2 text-slate-600 dark:text-cream-dim hover:bg-slate-200 dark:hover:bg-line border border-transparent dark:border-line/40'
            }`}
          >
            All Categories
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const count = dictionary.filter((d) => d.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#006C54] text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-panel-2 text-slate-600 dark:text-cream-dim hover:bg-slate-200 dark:hover:bg-line border border-transparent dark:border-line/40'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Dictionary Table */}
      <div className="bg-white dark:bg-panel border border-[#E5E5EA] dark:border-line rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-800 dark:text-cream">
            <thead className="bg-[#FBFBFA] dark:bg-panel-2 text-slate-500 dark:text-cream-dim font-semibold border-b border-[#E5E5EA] dark:border-line text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Word / Phrase</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5EA] dark:divide-line">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-cream-dim">
                    <ShieldAlert size={28} className="mx-auto text-slate-300 dark:text-line mb-2" />
                    <p className="font-semibold text-sm text-slate-700 dark:text-cream">No moderation entries found</p>
                    <p className="text-xs text-slate-400 dark:text-cream-dim mt-1">Try adjusting your search query or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-panel-2/50 transition-colors">
                    {/* Phrase */}
                    <td className="py-3 px-4 font-semibold tabular-nums text-slate-900 dark:text-cream">
                      {entry.phrase}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-cream-dim">
                        <Tag size={10} className="text-[#006C54] dark:text-[#00A881]" /> {entry.category}
                      </span>
                    </td>

                    {/* Severity */}
                    <td className="py-3 px-4">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${SEVERITY_TEXT_COLORS[entry.severity] || 'text-slate-600 dark:text-cream-dim'}`}>
                        {entry.severity}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${ACTION_TEXT_COLORS[entry.action] || 'text-slate-600 dark:text-cream-dim'}`}>
                        {entry.action}
                      </span>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onToggle(entry.id)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                          entry.enabled
                            ? 'bg-[#E8F5EE] dark:bg-emerald-950/40 text-[#006C54] dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-panel-2 text-slate-500 dark:text-cream-dim'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${entry.enabled ? 'bg-[#006C54] dark:bg-emerald-400' : 'bg-slate-400'}`} />
                        {entry.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-4 text-slate-500 dark:text-cream-dim max-w-xs truncate text-[11px]">
                      {entry.notes || ' - '}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => onEdit(entry)}
                        className="p-1.5 rounded-lg text-slate-500 dark:text-cream-dim hover:text-slate-900 dark:hover:text-cream hover:bg-slate-100 dark:hover:bg-panel-2 transition-colors inline-flex items-center justify-center cursor-pointer"
                        title="Edit entry"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => onDelete(entry)}
                        className="p-1.5 rounded-lg text-slate-400 dark:text-cream-dim hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors inline-flex items-center justify-center cursor-pointer"
                        title="Delete entry"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
