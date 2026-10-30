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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5E5EA] p-5 sm:p-6 rounded-2xl shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-[#006C54]" />
            <h2 className="font-semibold text-lg text-slate-900 tracking-tight">
              Moderation & Platform Safety
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
            Automated community safety filters. Guards against profanity, inappropriate media, harassment, and spam terms across chat and slips.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Phrase</span>
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Upload size={14} />
            <span>Import</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={14} />
            <span>Export</span>
          </button>
          <button
            onClick={handleRestoreDefaults}
            title="Restore default dictionary seed"
            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 pb-1">
        <button
          onClick={() => setActiveTab('dictionary')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'dictionary'
              ? 'bg-[#006C54] text-white shadow-xs'
              : 'bg-white border border-[#E5E5EA] text-slate-600 hover:bg-slate-50'
          }`}
        >
          <ShieldAlert size={14} />
          <span>Dictionary & Rules ({dictionary.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all relative cursor-pointer ${
            activeTab === 'reports'
              ? 'bg-[#006C54] text-white shadow-xs'
              : 'bg-white border border-[#E5E5EA] text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Flag size={14} />
          <span>User Reports</span>
          {reports.filter((r) => r.status === 'Pending').length > 0 && (
            <span className="text-rose-600 text-[11px] font-bold ml-1">
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
        <Modal isOpen={true} onClose={() => setIsEditModalOpen(false)} overlayClassName="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFF0] border border-[#E5E5EA] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 sm:p-7 space-y-5 text-slate-900">
            <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="text-[#006C54]" size={20} />
                <h3 className="font-semibold text-base text-slate-900">
                  {editingEntry ? 'Edit Dictionary Phrase' : 'Add Moderation Phrase'}
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-4">
              {/* Phrase input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Word or Phrase <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  placeholder="e.g. offensive word, scam link..."
                  className="w-full bg-white border border-slate-300 focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] rounded-xl px-3.5 py-2.5 text-xs text-slate-900 tabular-nums focus:outline-none transition-all shadow-2xs"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Evaluated automatically case-insensitively.
                </p>
              </div>

              {/* Category & Severity Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ModerationCategory)}
                    className="w-full bg-white border border-slate-300 focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none transition-all"
                  >
                    {ALL_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Severity Level</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as ModerationSeverity)}
                    className="w-full bg-white border border-slate-300 focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none transition-all"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Action</label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value as ModerationAction)}
                    className="w-full bg-white border border-slate-300 focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none transition-all"
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
                      className="w-4 h-4 rounded text-[#006C54] focus:ring-[#006C54] cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-slate-800">Rule Enabled</span>
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Context (Optional)</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional contextual notes or instructions..."
                  className="w-full bg-white border border-slate-300 focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none resize-none transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E5EA]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
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
        <Modal isOpen={true} onClose={() => setIsImportModalOpen(false)} overlayClassName="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFF0] border border-[#E5E5EA] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 sm:p-7 space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-3">
              <div className="flex items-center gap-2">
                <Upload className="text-[#006C54]" size={20} />
                <h3 className="font-semibold text-base text-slate-900">Import Moderation JSON</h3>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Upload a `.json` file or paste a JSON array containing custom moderation entries.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Choose JSON File</label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Or Paste JSON Content</label>
              <textarea
                rows={5}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='[ { "phrase": "example", "category": "English Profanity", "severity": "High", "action": "Block", "enabled": true } ]'
                className="w-full bg-white border border-slate-300 focus:border-[#006C54] focus:ring-1 focus:ring-[#006C54] rounded-xl p-3 text-xs text-slate-900 tabular-nums focus:outline-none transition-all shadow-2xs"
              />
            </div>

            {importError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{importError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5EA]">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessImport}
                className="px-5 py-2 rounded-xl bg-[#006C54] hover:bg-[#005441] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
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
