import { useState } from 'react';
import { ShieldAlert, Plus, Upload, Download, RotateCcw, Flag, X, AlertTriangle } from 'lucide-react';
import type { ModerationCategory, ModerationSeverity, ModerationAction } from '../types/moderation';
import { useModerationDictionary, ALL_CATEGORIES, SEVERITY_LEVELS, ACTIONS } from '../lib/useModerationDictionary';
import { useReportsStore } from '../lib/reportsStore';
import ReportsPanel from './adminModeration/ReportsPanel';
import DictionaryPanel from './adminModeration/DictionaryPanel';
import Modal from './ui/Modal';

export default function AdminModerationDashboard() {
  const [activeTab, setActiveTab] = useState<'dictionary' | 'reports'>('dictionary');
  const reports = useReportsStore((s) => s.reports);

  const {
    dictionary,
    filteredEntries,
    totalCount,
    enabledCount,
    reviewOnlyCount,
    criticalCount,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedSeverity,
    setSelectedSeverity,
    selectedStatus,
    setSelectedStatus,
    isEditModalOpen,
    setIsEditModalOpen,
    editingEntry,
    phrase,
    setPhrase,
    category,
    setCategory,
    severity,
    setSeverity,
    action,
    setAction,
    enabled,
    setEnabled,
    notes,
    setNotes,
    isImportModalOpen,
    setIsImportModalOpen,
    importText,
    setImportText,
    importError,
    handleOpenAdd,
    handleOpenEdit,
    handleSaveEntry,
    handleDelete,
    handleToggle,
    handleRestoreDefaults,
    handleExportJSON,
    handleProcessImport,
    handleFileUpload,
    getSeverityBadgeClass,
    getActionBadgeClass,
  } = useModerationDictionary();

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
        <ReportsPanel />
      ) : (
        <DictionaryPanel
          dictionary={dictionary}
          filteredEntries={filteredEntries}
          totalCount={totalCount}
          enabledCount={enabledCount}
          criticalCount={criticalCount}
          reviewOnlyCount={reviewOnlyCount}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedSeverity={selectedSeverity}
          setSelectedSeverity={setSelectedSeverity}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
          onToggle={handleToggle}
          getSeverityBadgeClass={getSeverityBadgeClass}
          getActionBadgeClass={getActionBadgeClass}
        />
      )}

      {/* Add / Edit Entry Modal */}
      {isEditModalOpen && (
        <Modal isOpen={true} overlayClassName="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
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
        </Modal>
      )}

      {/* Import JSON Modal */}
      {isImportModalOpen && (
        <Modal isOpen={true} overlayClassName="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn">
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
        </Modal>
      )}
    </div>
  );
}
