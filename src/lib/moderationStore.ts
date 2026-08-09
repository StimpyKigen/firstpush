import type { DictionaryEntry, ModerationCategory, ModerationSeverity, ModerationAction } from '../types/moderation';
import { DEFAULT_MODERATION_SEED } from './moderationSeed';

const STORAGE_KEY = 'mshindi_moderation_dictionary_v1';

let dictionaryMemoryCache: DictionaryEntry[] | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function getDictionary(): DictionaryEntry[] {
  if (dictionaryMemoryCache) {
    return dictionaryMemoryCache;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        dictionaryMemoryCache = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse moderation dictionary from localStorage:', err);
  }

  // Fallback to default seed
  dictionaryMemoryCache = [...DEFAULT_MODERATION_SEED];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dictionaryMemoryCache));
  } catch (_) {}

  return dictionaryMemoryCache;
}

export function saveDictionary(entries: DictionaryEntry[]) {
  dictionaryMemoryCache = entries;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to save moderation dictionary to localStorage:', err);
  }
  notifyListeners();
}

export function subscribeModerationStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addDictionaryEntry(newEntry: {
  phrase: string;
  category: ModerationCategory;
  severity: ModerationSeverity;
  action: ModerationAction;
  enabled?: boolean;
  notes?: string;
}): DictionaryEntry {
  const current = getDictionary();
  const entry: DictionaryEntry = {
    id: `mod-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    phrase: newEntry.phrase.trim().toLowerCase(),
    category: newEntry.category,
    severity: newEntry.severity,
    action: newEntry.action,
    enabled: newEntry.enabled ?? true,
    notes: newEntry.notes ?? '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updated = [entry, ...current];
  saveDictionary(updated);
  return entry;
}

export function updateDictionaryEntry(id: string, updates: Partial<Omit<DictionaryEntry, 'id'>>): boolean {
  const current = getDictionary();
  let found = false;
  const updated = current.map((item) => {
    if (item.id === id) {
      found = true;
      return {
        ...item,
        ...updates,
        phrase: updates.phrase ? updates.phrase.trim().toLowerCase() : item.phrase,
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });

  if (found) {
    saveDictionary(updated);
  }
  return found;
}

export function deleteDictionaryEntry(id: string): boolean {
  const current = getDictionary();
  const updated = current.filter((item) => item.id !== id);
  if (updated.length !== current.length) {
    saveDictionary(updated);
    return true;
  }
  return false;
}

export function toggleDictionaryEntry(id: string): boolean {
  const current = getDictionary();
  let newStatus = false;
  const updated = current.map((item) => {
    if (item.id === id) {
      newStatus = !item.enabled;
      return {
        ...item,
        enabled: newStatus,
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });

  saveDictionary(updated);
  return newStatus;
}

export function restoreDefaultDictionary(): DictionaryEntry[] {
  const restored = [...DEFAULT_MODERATION_SEED];
  saveDictionary(restored);
  return restored;
}

export function importDictionaryJSON(jsonString: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      return { success: false, count: 0, error: 'Import payload must be a JSON array of entries.' };
    }

    const validEntries: DictionaryEntry[] = [];
    for (const item of parsed) {
      if (item && typeof item.phrase === 'string' && item.category && item.severity) {
        validEntries.push({
          id: item.id || `imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          phrase: item.phrase.trim().toLowerCase(),
          category: item.category,
          severity: item.severity || 'Medium',
          action: item.action || 'Block',
          enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
          notes: item.notes || '',
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (validEntries.length === 0) {
      return { success: false, count: 0, error: 'No valid dictionary entries found in JSON.' };
    }

    saveDictionary(validEntries);
    return { success: true, count: validEntries.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Invalid JSON format' };
  }
}

export function exportDictionaryJSON(): string {
  const current = getDictionary();
  return JSON.stringify(current, null, 2);
}
