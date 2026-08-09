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
    <div className="space-y-6">
      {/* Overview Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-panel/80 border border-line p-3.5 rounded-xl">
          <p className="text-[11px] font-bold text-cream-dim uppercase tracking-wider">Total Entries</p>
          <p className="font-display font-extrabold text-2xl text-cream mt-0.5">{totalCount}</p>
        </div>
        <div className="bg-panel/80 border border-line p-3.5 rounded-xl">
          <p className="text-[11px] font-bold text-emerald-2 uppercase tracking-wider">Active Rules</p>
          <p className="font-display font-extrabold text-2xl text-emerald-2 mt-0.5">{enabledCount}</p>
        </div>
        <div className="bg-panel/80 border border-line p-3.5 rounded-xl">
          <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">Critical Rules</p>
          <p className="font-display font-extrabold text-2xl text-red-400 mt-0.5">{criticalCount}</p>
        </div>
        <div className="bg-panel/80 border border-line p-3.5 rounded-xl">
          <p className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Political Review</p>
          <p className="font-display font-extrabold text-2xl text-purple-300 mt-0.5">{reviewOnlyCount}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-panel border border-line p-4 rounded-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search */}
          <div className="sm:col-span-5 relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream-dim" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phrases or notes..."
              className="w-full bg-ink-2 border border-line focus:border-gold rounded-xl pl-9 pr-3 py-2 text-xs text-cream focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cream-dim hover:text-cream"
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
              className="w-full bg-ink-2 border border-line focus:border-gold rounded-xl px-3 py-2 text-xs text-cream focus:outline-none"
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
              className="w-full bg-ink-2 border border-line focus:border-gold rounded-xl px-3 py-2 text-xs text-cream focus:outline-none"
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
              className="w-full bg-ink-2 border border-line focus:border-gold rounded-xl px-3 py-2 text-xs text-cream focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ENABLED">Enabled</option>
              <option value="DISABLED">Disabled</option>
            </select>
          </div>
        </div>

        {/* Category Quick Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <span className="text-[10px] font-bold text-cream-dim uppercase mr-1 shrink-0">Quick Filter:</span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === 'ALL'
                ? 'bg-gold text-ink font-bold'
                : 'bg-panel-2 text-cream-dim hover:text-cream border border-line'
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
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-gold text-ink font-bold'
                    : 'bg-panel-2 text-cream-dim hover:text-cream border border-line'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Dictionary Table */}
      <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-cream">
            <thead className="bg-ink-2 text-cream-dim font-bold border-b border-line text-[11px] uppercase tracking-wider">
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
            <tbody className="divide-y divide-line/60">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-cream-dim">
                    <ShieldAlert size={32} className="mx-auto text-cream-dim/40 mb-2" />
                    <p className="font-semibold text-sm">No moderation entries found</p>
                    <p className="text-xs text-cream-dim/70 mt-1">Try adjusting your search query or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-ink-2/50 transition-colors">
                    {/* Phrase */}
                    <td className="py-3 px-4 font-bold font-mono text-gold">
                      {entry.phrase}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 bg-panel-2 border border-line px-2 py-0.5 rounded-md text-[11px] text-cream-dim">
                        <Tag size={10} className="text-gold" /> {entry.category}
                      </span>
                    </td>

                    {/* Severity */}
                    <td className="py-3 px-4">
                      <span className={`inline-block border px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${getSeverityBadgeClass(entry.severity)}`}>
                        {entry.severity}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4">
                      <span className={`inline-block border px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getActionBadgeClass(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onToggle(entry.id)}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${
                          entry.enabled
                            ? 'bg-emerald-2/15 border-emerald-2/40 text-emerald-2'
                            : 'bg-line/40 border-line text-cream-dim/60'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${entry.enabled ? 'bg-emerald-2 animate-pulse' : 'bg-cream-dim/40'}`} />
                        {entry.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-4 text-cream-dim max-w-xs truncate text-[11px]">
                      {entry.notes || ' - '}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => onEdit(entry)}
                        className="p-1.5 rounded-lg bg-panel-2 border border-line hover:border-gold text-cream-dim hover:text-gold transition-colors inline-flex items-center justify-center"
                        title="Edit entry"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => onDelete(entry)}
                        className="p-1.5 rounded-lg bg-panel-2 border border-line hover:border-danger text-cream-dim hover:text-danger transition-colors inline-flex items-center justify-center"
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
