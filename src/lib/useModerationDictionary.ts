import { useState, useSyncExternalStore, type FormEvent, type ChangeEvent } from 'react';
import type {
  DictionaryEntry,
  ModerationCategory,
  ModerationSeverity,
  ModerationAction,
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
  exportDictionaryJSON,
} from './moderationStore';
import { showToast } from './notificationStore';

export const ALL_CATEGORIES: ModerationCategory[] = [
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

export const SEVERITY_LEVELS: ModerationSeverity[] = [
  'Critical',
  'High',
  'Medium',
  'Low',
  'Review Only',
];

export const ACTIONS: ModerationAction[] = [
  'Block',
  'Flag',
  'Review',
  'Mask',
];

/** Filters, stats, and CRUD for the moderation dictionary, plus the add/edit and import modal state. */
export function useModerationDictionary() {
  const dictionary = useSyncExternalStore(
    subscribeModerationStore,
    getDictionary,
    getDictionary
  );

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

  function handleSaveEntry(e: FormEvent) {
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

  function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
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

  return {
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
  };
}
