import type { DictionaryEntry } from '../types/moderation';
import { DEFAULT_MODERATION_SEED } from './moderationSeed';

const ADMIN_TOKEN_STORAGE_KEY = 'mshindi_admin_token_v1';

// Reactive in-memory dictionary hydrated from the authoritative backend API
let dictionaryMemoryCache: DictionaryEntry[] = [...DEFAULT_MODERATION_SEED];
let hydrationPromise: Promise<DictionaryEntry[]> | null = null;
const listeners = new Set<() => void>();

function notifyModerationListeners(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

function getAdminHeaders(includeContentType = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  if (typeof window !== 'undefined') {
    const tok = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (tok) {
      headers['x-admin-token'] = tok;
    }
  }
  return headers;
}

export function subscribeModerationStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Hydrates moderation dictionary rules from `/api/moderation/dictionary`.
 */
export async function hydrateModerationDictionary(): Promise<DictionaryEntry[]> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return dictionaryMemoryCache;
  }
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    try {
      const res = await fetch('/api/moderation/dictionary', {
        method: 'GET',
        headers: getAdminHeaders(false),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.entries) && data.entries.length > 0) {
          dictionaryMemoryCache = data.entries;
          notifyModerationListeners();
        }
      }
    } catch {
      // Retain seed cache when offline
    } finally {
      hydrationPromise = null;
    }
    return dictionaryMemoryCache;
  })();

  return hydrationPromise;
}

export function getDictionary(): DictionaryEntry[] {
  return dictionaryMemoryCache;
}

export function saveDictionary(entries: DictionaryEntry[]): void {
  dictionaryMemoryCache = entries;
  notifyModerationListeners();
}

export async function addDictionaryEntry(newEntry: {
  phrase: string;
  category: DictionaryEntry['category'];
  severity: DictionaryEntry['severity'];
  action: DictionaryEntry['action'];
  enabled?: boolean;
  notes?: string;
}): Promise<{ ok: boolean; entry?: DictionaryEntry; error?: string }> {
  try {
    const res = await fetch('/api/moderation/dictionary', {
      method: 'POST',
      headers: getAdminHeaders(true),
      credentials: 'include',
      body: JSON.stringify({
        operation: 'add',
        ...newEntry,
        ruleAction: newEntry.action,
        phrase: newEntry.phrase.trim().toLowerCase(),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { ok: false, error: data?.error || 'Failed to add phrase on server.' };
    }
    if (Array.isArray(data.entries)) {
      saveDictionary(data.entries);
    }
    return { ok: true, entry: data.entry };
  } catch {
    return { ok: false, error: 'Unable to reach moderation server.' };
  }
}

export async function updateDictionaryEntry(
  id: string,
  updates: Partial<Omit<DictionaryEntry, 'id'>>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/moderation/dictionary', {
      method: 'PUT',
      headers: getAdminHeaders(true),
      credentials: 'include',
      body: JSON.stringify({
        operation: 'update',
        id,
        ...updates,
        ...(updates.action ? { ruleAction: updates.action } : {}),
        ...(typeof updates.phrase === 'string'
          ? { phrase: updates.phrase.trim().toLowerCase() }
          : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { ok: false, error: data?.error || 'Failed to update dictionary entry.' };
    }
    if (Array.isArray(data.entries)) {
      saveDictionary(data.entries);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unable to reach moderation server.' };
  }
}

export async function deleteDictionaryEntry(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/moderation/dictionary', {
      method: 'DELETE',
      headers: getAdminHeaders(true),
      credentials: 'include',
      body: JSON.stringify({ action: 'delete', id }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { ok: false, error: data?.error || 'Failed to delete dictionary entry.' };
    }
    if (Array.isArray(data.entries)) {
      saveDictionary(data.entries);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unable to reach moderation server.' };
  }
}

export async function toggleDictionaryEntry(id: string): Promise<{ ok: boolean; enabled?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/moderation/dictionary', {
      method: 'POST',
      headers: getAdminHeaders(true),
      credentials: 'include',
      body: JSON.stringify({ action: 'toggle', id }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { ok: false, error: data?.error || 'Failed to toggle dictionary entry.' };
    }
    if (Array.isArray(data.entries)) {
      saveDictionary(data.entries);
    }
    return { ok: true, enabled: Boolean(data.entry?.enabled) };
  } catch {
    return { ok: false, error: 'Unable to reach moderation server.' };
  }
}

export async function restoreDefaultDictionary(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/moderation/dictionary', {
      method: 'POST',
      headers: getAdminHeaders(true),
      credentials: 'include',
      body: JSON.stringify({ action: 'restore' }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { ok: false, error: data?.error || 'Failed to restore defaults.' };
    }
    if (Array.isArray(data.entries)) {
      saveDictionary(data.entries);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Unable to reach moderation server.' };
  }
}

export async function importDictionaryJSON(
  jsonString: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      return { success: false, count: 0, error: 'Import payload must be a JSON array of entries.' };
    }

    const res = await fetch('/api/moderation/dictionary', {
      method: 'POST',
      headers: getAdminHeaders(true),
      credentials: 'include',
      body: JSON.stringify({ action: 'import', entries: parsed }),
    });
    const data = await res.json();
    if (!res.ok || !data?.success) {
      return { success: false, count: 0, error: data?.error || 'Failed to import entries on server.' };
    }
    if (Array.isArray(data.entries)) {
      saveDictionary(data.entries);
    }
    return { success: true, count: Number(data.count || 0) };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Invalid JSON format' };
  }
}

export function exportDictionaryJSON(): string {
  return JSON.stringify(getDictionary(), null, 2);
}
