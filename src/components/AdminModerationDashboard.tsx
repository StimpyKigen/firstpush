import React, { useState, useSyncExternalStore } from 'react';
import {
  ShieldAlert,
  Plus,
  Trash2,
  Edit2,
  Search,
  Download,
  Upload,
  RotateCcw,
  Check,
  X,
  CheckCircle2,
  AlertTriangle,
  Filter,
  FileText,
  Tag,
  Sliders,
  Sparkles,
  Info,
  Flag
} from 'lucide-react';
import type {
  DictionaryEntry,
  ModerationCategory,
  ModerationSeverity,
  ModerationAction
} from '../types/moderation';
import {
  getDictionary,
  subscribeModerationStore,
  addDictionaryEntry,
  updateDictionaryEntry,
  deleteDictionaryEntry,
  toggleDictionaryEntry,
  restoreDefaultDictionary,
  importDictionaryJSON,
  exportDictionaryJSON
} from '../lib/moderationStore';
import { useReportsStore } from '../lib/reportsStore';
import { showToast } from '../lib/notificationStore';

const ALL_CATEGORIES: ModerationCategory[] = [
  'English Profanity',
  'Kiswahili Profanity',
  'Sheng / Kenyan Slang',
  'Sexual Content',
  'Violence & Threats',
  'Hate Speech',
  'Harassment & Bullying',
  'Scam & Fraud',
  'Betting Scam Keywords',
  'Spam & Promotional Content',
  'External Links',
  'Personal Information',
  'Political References',
  'Drug References',
  'Adult Content',
];

const SEVERITY_LEVELS: ModerationSeverity[] = [
  'Critical',
  'High',
  'Medium',
  'Low',
  'Review Only',
];

const ACTIONS: ModerationAction[] = [
  'Block',
  'Flag',
  'Review',
  'Mask',
];

export default function AdminModerationDashboard() {
  const dictionary = useSyncExternalStore(
    subscribeModerationStore,
    getDictionary,
    getDictionary
  );

  const reports = useReportsStore((s) => s.reports);
  const updateReportStatus = useReportsStore((s) => s.updateReportStatus);
  const deleteReport = useReportsStore((s) => s.deleteReport);

  const [activeTab, setActiveTab] = useState<'dictionary' | 'reports'>('dictionary');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL');

  // Add/Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null);

  // Form State
  const [phrase, setPhrase] = useState('');
  const [category, setCategory] = useState<ModerationCategory>('English Profanity');
  const [severity, setSeverity] = useState<ModerationSeverity>('High');
  const [action, setAction] = useState<ModerationAction>('Block');
  const [enabled, setEnabled] = useState(true);
  const [notes, setNotes] = useState('');

  // Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  // Filtering Logic
  const filteredEntries = dictionary.filter((item) => {
    // Search match
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const matchPhrase = item.phrase.toLowerCase().includes(q);
      const matchNotes = item.notes ? item.notes.toLowerCase().includes(q) : false;
      if (!matchPhrase && !matchNotes) return false;
    }

    // Category match
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
      return false;
    }

    // Severity match
    if (selectedSeverity !== 'ALL' && item.severity !== selectedSeverity) {
      return false;
    }

    // Status match
    if (selectedStatus === 'ENABLED' && !item.enabled) return false;
    if (selectedStatus === 'DISABLED' && item.enabled) return false;

    return true;
  });

  // Stats
  const totalCount = dictionary.length;
  const enabledCount = dictionary.filter((e) => e.enabled).length;
  const reviewOnlyCount = dictionary.filter((e) => e.severity === 'Review Only').length;
  const criticalCount = dictionary.filter((e) => e.severity === 'Critical').length;

  // Handlers
  function handleOpenAdd() {
    setEditingEntry(null);
    setPhrase('');
    setCategory('English Profanity');
    setSeverity('High');
    setAction('Block');
    setEnabled(true);
    setNotes('');
    setIsEditModalOpen(true);
  }

  function handleOpenEdit(entry: DictionaryEntry) {
    setEditingEntry(entry);
    setPhrase(entry.phrase);
    setCategory(entry.category);
    setSeverity(entry.severity);
    setAction(entry.action);
    setEnabled(entry.enabled);
    setNotes(entry.notes || '');
    setIsEditModalOpen(true);
  }

  function handleSaveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!phrase.trim()) {
      showToast({ type: 'error', title: 'Input required', message: 'Please enter a word or phrase.' });
      return;
    }

    if (editingEntry) {
      updateDictionaryEntry(editingEntry.id, {
        phrase,
        category,
        severity,
        action,
        enabled,
        notes,
      });
      showToast({ type: 'success', title: 'Dictionary Updated', message: `Updated phrase "${phrase.trim()}" in Moderation Dictionary.` });
    } else {
      addDictionaryEntry({
        phrase,
        category,
        severity,
        action,
        enabled,
        notes,
      });
      showToast({ type: 'success', title: 'Phrase Added', message: `Added "${phrase.trim()}" to Moderation Dictionary.` });
    }

    setIsEditModalOpen(false);
  }

  function handleDelete(entry: DictionaryEntry) {
    if (confirm(`Are you sure you want to delete "${entry.phrase}" from the moderation dictionary?`)) {
      deleteDictionaryEntry(entry.id);
      showToast({ type: 'info', title: 'Entry Deleted', message: `Deleted "${entry.phrase}"` });
    }
  }

  function handleToggle(id: string) {
    const newStatus = toggleDictionaryEntry(id);
    showToast({ type: 'info', title: 'Rule Status Changed', message: `Entry ${newStatus ? 'enabled' : 'disabled'}` });
  }

  function handleRestoreDefaults() {
    if (confirm('Restore moderation dictionary to default seed dataset? Any custom additions will be reset.')) {
      restoreDefaultDictionary();
      showToast({ type: 'success', title: 'Defaults Restored', message: 'Moderation dictionary restored to defaults.' });
    }
  }

  function handleExportJSON() {
    const jsonStr = exportDictionaryJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mshindi_moderation_dictionary_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast({ type: 'success', title: 'JSON Exported', message: 'Moderation dictionary exported as JSON file.' });
  }

  function handleProcessImport() {
    setImportError('');
    if (!importText.trim()) {
      setImportError('Please paste JSON data or choose a JSON file.');
      return;
    }

    const res = importDictionaryJSON(importText);
    if (!res.success) {
      setImportError(res.error || 'Failed to import JSON data.');
      return;
    }

    showToast({ type: 'success', title: 'Import Successful', message: `Successfully imported ${res.count} moderation entries!` });
    setIsImportModalOpen(false);
    setImportText('');
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
  }

  function getSeverityBadgeClass(sev: ModerationSeverity) {
    switch (sev) {
      case 'Critical':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'High':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'Low':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'Review Only':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      default:
        return 'bg-line text-cream-dim border-line';
    }
  }

  function getActionBadgeClass(act: ModerationAction) {
    switch (act) {
      case 'Block':
        return 'bg-danger/20 text-danger border-danger/40';
      case 'Flag':
        return 'bg-gold/20 text-gold border-gold/40';
      case 'Review':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'Mask':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      default:
        return 'bg-line text-cream-dim border-line';
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-panel border border-gold/30 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert size={22} className="text-gold" />
            <h2 className="font-display font-extrabold text-xl text-cream">
              Moderation Dictionary & Safety
            </h2>
          </div>
          <p className="text-xs text-cream-dim mt-1 max-w-xl">
            Dynamic community safety rules. Prevents English curse words, Kiswahili profanity, sexual content, violence, and scam terms during username creation & posts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 rounded-xl bg-gold hover:bg-gold-2 text-ink font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus size={15} /> Add Phrase
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-panel-2 border border-line hover:border-gold/50 text-cream font-bold text-xs transition-colors flex items-center gap-1.5"
          >
            <Upload size={14} /> Import
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3 py-2 rounded-xl bg-panel-2 border border-line hover:border-gold/50 text-cream font-bold text-xs transition-colors flex items-center gap-1.5"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={handleRestoreDefaults}
            title="Restore default dictionary seed"
            className="p-2 rounded-xl bg-panel-2 border border-line hover:border-danger text-cream-dim hover:text-danger transition-colors"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <button
          onClick={() => setActiveTab('dictionary')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'dictionary'
              ? 'bg-gold text-ink shadow-md'
              : 'bg-panel border border-line text-cream-dim hover:text-cream'
          }`}
        >
          <ShieldAlert size={15} />
          <span>Dictionary & Rules ({dictionary.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
            activeTab === 'reports'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-panel border border-line text-cream-dim hover:text-cream'
          }`}
        >
          <Flag size={15} />
          <span>User Reports</span>
          {reports.filter((r) => r.status === 'Pending').length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-1 animate-pulse">
              {reports.filter((r) => r.status === 'Pending').length} Pending
            </span>
          )}
        </button>
      </div>

      {activeTab === 'reports' ? (
        /* User Reports Panel */
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-panel border border-line p-4 rounded-xl">
            <div>
              <h3 className="font-bold text-base text-cream flex items-center gap-2">
                <Flag size={18} className="text-rose-400" /> User Scam & Fraud Reports
              </h3>
              <p className="text-xs text-cream-dim mt-0.5">
                Reports submitted by community members regarding fraudulent posts, paid tips spam, or misleading slips.
              </p>
            </div>
            <div className="text-xs font-bold text-cream-dim">
              Total Reports: <span className="text-gold font-mono">{reports.length}</span>
            </div>
          </div>

          {reports.length === 0 ? (
            <div className="bg-panel border border-line rounded-2xl p-8 text-center text-cream-dim space-y-2">
              <CheckCircle2 size={32} className="mx-auto text-emerald-400 opacity-60" />
              <p className="font-bold text-sm text-cream">No Reports Submitted</p>
              <p className="text-xs">Community members have not reported any posts as fraudulent yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => (
                <div
                  key={rep.id}
                  className={`bg-panel border rounded-xl p-4 space-y-3 transition-all ${
                    rep.status === 'Pending'
                      ? 'border-rose-500/40 bg-rose-950/10'
                      : 'border-line opacity-80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/40 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                        {rep.reasonCategory}
                      </span>
                      <span className="text-xs text-cream-dim">
                        Reported by <strong className="text-cream">@{rep.reporterUsername}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-cream-dim/60 font-mono text-[11px]">
                        {new Date(rep.createdAt).toLocaleString()}
                      </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${
                          rep.status === 'Pending'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : rep.status === 'Reviewed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-line text-cream-dim'
                        }`}
                      >
                        {rep.status}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-ink-2 p-3 rounded-lg border border-line/60 space-y-1">
                      <p className="text-[10px] font-bold text-cream-dim uppercase tracking-wider">Reported User & Post</p>
                      <p className="font-bold text-gold">@{rep.reportedUser}</p>
                      {rep.postContent && (
                        <p className="text-cream-dim/80 italic text-[11px] line-clamp-2">
                          "{rep.postContent}"
                        </p>
                      )}
                    </div>
                    <div className="bg-ink-2 p-3 rounded-lg border border-line/60 space-y-1">
                      <p className="text-[10px] font-bold text-cream-dim uppercase tracking-wider">Reporter Description</p>
                      <p className="text-cream leading-relaxed">{rep.description}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {rep.status === 'Pending' && (
                      <button
                        onClick={() => {
                          updateReportStatus(rep.id, 'Reviewed');
                          showToast({ type: 'success', title: 'Marked Reviewed', message: 'Report status updated to Reviewed.' });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center gap-1"
                      >
                        <Check size={13} /> Mark Reviewed
                      </button>
                    )}
                    {rep.status !== 'Dismissed' && (
                      <button
                        onClick={() => {
                          updateReportStatus(rep.id, 'Dismissed');
                          showToast({ type: 'info', title: 'Report Dismissed', message: 'Report marked as dismissed.' });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-panel-2 border border-line text-cream-dim hover:text-cream font-semibold text-xs transition-colors"
                      >
                        Dismiss
                      </button>
                    )}
                    <button
                      onClick={() => {
                        deleteReport(rep.id);
                        showToast({ type: 'info', title: 'Report Deleted', message: 'Report removed.' });
                      }}
                      className="p-1.5 rounded-lg text-cream-dim/60 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete report entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
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
                        onClick={() => handleToggle(entry.id)}
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
                        onClick={() => handleOpenEdit(entry)}
                        className="p-1.5 rounded-lg bg-panel-2 border border-line hover:border-gold text-cream-dim hover:text-gold transition-colors inline-flex items-center justify-center"
                        title="Edit entry"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(entry)}
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
      )}

      {/* Add / Edit Entry Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-panel border border-gold/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-gold" size={20} />
                <h3 className="font-display font-bold text-lg text-cream">
                  {editingEntry ? 'Edit Dictionary Phrase' : 'Add Moderation Phrase'}
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-cream-dim hover:text-cream p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-4">
              {/* Phrase input */}
              <div>
                <label className="block text-xs font-bold text-cream-dim mb-1">
                  Word or Phrase <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder="e.g. fuck, kuma, fixed match, kys..."
                  className="w-full bg-ink-2 border border-line focus:border-gold rounded-xl px-3.5 py-2.5 text-sm text-cream font-mono focus:outline-none"
                />
                <p className="text-[11px] text-cream-dim/70 mt-1">
                  Matches will be evaluated case-insensitively.
                </p>
              </div>

              {/* Category & Severity Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-cream-dim mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ModerationCategory)}
                    className="w-full bg-ink-2 border border-line focus:border-gold rounded-xl px-3 py-2 text-xs text-cream focus:outline-none"
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-cream-dim mb-1">Severity Level</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as ModerationSeverity)}
                    className="w-full bg-ink-2 border border-line focus:border-gold rounded-xl px-3 py-2 text-xs text-cream focus:outline-none"
                  >
                    {SEVERITY_LEVELS.map((sev) => (
                      <option key={sev} value={sev}>
                        {sev}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action & Enabled Grid */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-bold text-cream-dim mb-1">Action</label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value as ModerationAction)}
                    className="w-full bg-ink-2 border border-line focus:border-gold rounded-xl px-3 py-2 text-xs text-cream focus:outline-none"
                  >
                    {ACTIONS.map((act) => (
                      <option key={act} value={act}>
                        {act}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-5">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => setEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-gold bg-ink-2 border-line focus:ring-gold"
                    />
                    <span className="text-xs font-bold text-cream">Rule Enabled</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-cream-dim mb-1">Notes / Context (Optional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional contextual details or moderation instructions..."
                  className="w-full bg-ink-2 border border-line focus:border-gold rounded-xl p-2.5 text-xs text-cream focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-panel-2 border border-line text-cream-dim hover:text-cream text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gold hover:bg-gold-2 text-ink text-xs font-extrabold shadow-md"
                >
                  {editingEntry ? 'Save Changes' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import JSON Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-panel border border-gold/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Upload className="text-gold" size={20} />
                <h3 className="font-display font-bold text-lg text-cream">Import Moderation JSON</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-cream-dim hover:text-cream p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-cream-dim">
              Upload a `.json` file or paste a JSON array containing custom moderation entries.
            </p>

            <div>
              <label className="block text-xs font-bold text-cream-dim mb-1">Choose JSON File</label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="w-full text-xs text-cream-dim file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-panel-2 file:text-gold hover:file:bg-line"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-cream-dim mb-1">Or Paste JSON Content</label>
              <textarea
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='[ { "phrase": "example", "category": "English Profanity", "severity": "High", "action": "Block", "enabled": true } ]'
                className="w-full bg-ink-2 border border-line focus:border-gold rounded-xl p-3 text-xs text-cream font-mono focus:outline-none"
              />
            </div>

            {importError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-xs text-danger font-semibold flex items-center gap-2">
                <AlertTriangle size={15} /> {importError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-panel-2 border border-line text-cream-dim hover:text-cream text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessImport}
                className="px-5 py-2 rounded-xl bg-gold hover:bg-gold-2 text-ink text-xs font-extrabold shadow-md"
              >
                Import Dictionary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
