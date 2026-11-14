/**
 * Authoritative Server-Side Moderation Dictionary & Community Reports Service (MSH-024)
 *
 * Replaces client-only localStorage trust for moderation dictionaries and abuse reports.
 * Persists dictionary rules and user safety reports in Cloud Firestore
 * (`moderationDictionary`, `reports`) when Admin SDK is active, with local disk fallback.
 *
 * Enforces:
 *  - Public read of enabled moderation dictionary phrases for pre-check UX
 *  - Strict Administrator authorization (`verifyAdminRequest`) for viewing/managing reports
 *    and mutating moderation dictionary rules
 *  - Validated report submissions with server-assigned status (`Pending`), length bounds,
 *    session-bound reporter attribution when authenticated, and server-side text screening
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import type { DictionaryEntry, ModerationCategory, ModerationSeverity, ModerationAction, ModerationResult } from '../types/moderation.js';
import { DEFAULT_MODERATION_SEED } from './moderationSeed.js';
import { evaluateTextWithDictionary, evaluateUsernameWithDictionary } from './moderationEngine.js';
import { verifyAdminRequestAsync, ADMIN_PHONE_NORMALIZED } from './adminAuthService.js';
import { authenticateTokenRequestAsync } from './serverTokenEconomy.js';
import { getAdminFirestore, resetFirebaseAdminForTests } from './serverFirebaseAdmin.js';
import { recordSecurityEvent } from './securityAuditLogger.js';
import { extractTrustedClientIp } from './rateLimitService.js';

export type ReportStatus = 'Pending' | 'Reviewed' | 'Dismissed';

export interface ServerUserReport {
  id: string;
  postId: string;
  reportedUser: string;
  postContent?: string;
  reporterUid: string | null;
  reporterUsername: string;
  reasonCategory: string;
  description: string;
  createdAt: string;
  status: ReportStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  autoModeration?: {
    isAllowed: boolean;
    category?: string;
    severity?: string;
    flaggedPhrases?: string[];
  };
}

interface PersistedModerationState {
  dictionary: DictionaryEntry[];
  reports: ServerUserReport[];
}

const VALID_CATEGORIES = new Set<ModerationCategory>([
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
]);

const VALID_SEVERITIES = new Set<ModerationSeverity>([
  'Critical',
  'High',
  'Medium',
  'Low',
  'Review Only',
]);

const VALID_ACTIONS = new Set<ModerationAction>(['Block', 'Flag', 'Review', 'Mask']);
const VALID_REPORT_STATUSES = new Set<ReportStatus>(['Pending', 'Reviewed', 'Dismissed']);
const MAX_IMPORT_ENTRIES = 500;
const MAX_DICTIONARY_ENTRIES = 1500;
const MAX_REPORTS_STORED = 2000;

const DATA_DIR = path.join(process.cwd(), 'data');
const PRIMARY_MOD_FILE = path.join(DATA_DIR, 'moderation_state.json');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), '.mshindi-cache')
  : path.join(process.cwd(), '.cache');
const FALLBACK_MOD_FILE = path.join(CACHE_DIR, 'moderation_state.json');

let memoryState: PersistedModerationState | null = null;

export function resetModerationServerForTests(): void {
  memoryState = {
    dictionary: DEFAULT_MODERATION_SEED.map((e) => ({ ...e })),
    reports: [],
  };
  resetFirebaseAdminForTests();
}

async function getModerationFirestore(): Promise<any | null> {
  return getAdminFirestore();
}

function loadLocalModerationState(): PersistedModerationState {
  if (memoryState) return memoryState;

  for (const filePath of [PRIMARY_MOD_FILE, FALLBACK_MOD_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (parsed && typeof parsed === 'object') {
          memoryState = {
            dictionary: Array.isArray(parsed.dictionary) && parsed.dictionary.length > 0
              ? parsed.dictionary
              : DEFAULT_MODERATION_SEED.map((e) => ({ ...e })),
            reports: Array.isArray(parsed.reports) ? parsed.reports : [],
          };
          return memoryState;
        }
      }
    } catch {
      // Ignore parse error and inspect fallback
    }
  }

  memoryState = {
    dictionary: DEFAULT_MODERATION_SEED.map((e) => ({ ...e })),
    reports: [],
  };
  return memoryState;
}

function persistLocalModerationState(state: PersistedModerationState): void {
  const payload = JSON.stringify({
    dictionary: state.dictionary.slice(0, MAX_DICTIONARY_ENTRIES),
    reports: state.reports.slice(0, MAX_REPORTS_STORED),
  });
  for (const [dir, filePath] of [
    [DATA_DIR, PRIMARY_MOD_FILE],
    [CACHE_DIR, FALLBACK_MOD_FILE],
  ] as const) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, payload, 'utf-8');
      return;
    } catch {
      // Ignore read-only paths on serverless FS
    }
  }
}

async function getAuthoritativeDictionary(): Promise<DictionaryEntry[]> {
  const state = loadLocalModerationState();
  const db = await getModerationFirestore();
  if (db) {
    try {
      const snap = await db.collection('moderationDictionary').limit(MAX_DICTIONARY_ENTRIES).get();
      if (!snap.empty) {
        state.dictionary = snap.docs.map((docSnap: any) => docSnap.data() as DictionaryEntry);
      }
    } catch {
      // Fallback to local state
    }
  }
  return state.dictionary;
}

async function persistDictionaryEntryFirestore(entry: DictionaryEntry): Promise<void> {
  const db = await getModerationFirestore();
  if (!db) return;
  try {
    await db.collection('moderationDictionary').doc(entry.id).set(entry);
  } catch {
    // Non-fatal; local store remains updated
  }
}

async function deleteDictionaryEntryFirestore(id: string): Promise<void> {
  const db = await getModerationFirestore();
  if (!db) return;
  try {
    await db.collection('moderationDictionary').doc(id).delete();
  } catch {
    // Non-fatal
  }
}

async function persistReportFirestore(report: ServerUserReport): Promise<void> {
  const db = await getModerationFirestore();
  if (!db) return;
  try {
    await db.collection('reports').doc(report.id).set(report);
  } catch {
    // Non-fatal
  }
}

async function deleteReportFirestore(id: string): Promise<void> {
  const db = await getModerationFirestore();
  if (!db) return;
  try {
    await db.collection('reports').doc(id).delete();
  } catch {
    // Non-fatal
  }
}

/**
 * Evaluates text content strictly against the authoritative server moderation dictionary.
 */
export async function evaluateServerModeration(text: string): Promise<ModerationResult> {
  const dictionary = await getAuthoritativeDictionary();
  return evaluateTextWithDictionary(text, dictionary);
}

/**
 * Evaluates a username strictly against the authoritative server moderation dictionary.
 */
export async function evaluateServerUsername(username: string): Promise<ModerationResult> {
  const dictionary = await getAuthoritativeDictionary();
  return evaluateUsernameWithDictionary(username, dictionary);
}

function validateDictionaryEntryInput(raw: any):
  | {
      ok: true;
      entry: Omit<DictionaryEntry, 'id' | 'createdAt' | 'updatedAt'>;
    }
  | {
      ok: false;
      error: string;
    } {
  const phrase = typeof raw?.phrase === 'string' ? raw.phrase.trim().toLowerCase() : '';
  if (!phrase || phrase.length < 2 || phrase.length > 120) {
    return { ok: false, error: 'Phrase must be between 2 and 120 characters.' };
  }
  const category = raw?.category as ModerationCategory;
  if (!VALID_CATEGORIES.has(category)) {
    return { ok: false, error: 'Invalid moderation category.' };
  }
  const severity = (raw?.severity || 'Medium') as ModerationSeverity;
  if (!VALID_SEVERITIES.has(severity)) {
    return { ok: false, error: 'Invalid moderation severity.' };
  }
  const candidateAction = raw?.ruleAction ?? (['Block', 'Flag', 'Review', 'Mask'].includes(raw?.action) ? raw.action : 'Block');
  const action = candidateAction as ModerationAction;
  if (!VALID_ACTIONS.has(action)) {
    return { ok: false, error: 'Invalid moderation action.' };
  }
  const enabled = typeof raw?.enabled === 'boolean' ? raw.enabled : true;
  const notes = typeof raw?.notes === 'string' ? raw.notes.trim().slice(0, 300) : '';
  return {
    ok: true,
    entry: { phrase, category, severity, action, enabled, notes },
  };
}

/**
 * HTTP request dispatcher for `/api/moderation/*` and `/api/reports*`.
 */
export async function handleModerationHttpRequest(params: {
  method: string;
  pathname: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, any>;
  body: any;
}): Promise<{ statusCode: number; payload: any }> {
  const method = (params.method || 'GET').toUpperCase();
  const pathname = (params.pathname || '').replace(/\/+$/, '').toLowerCase();
  const headers = params.headers || {};
  const query = params.query || {};
  const body = params.body || {};
  const ip = extractTrustedClientIp(headers);

  // 1. SERVER-SIDE MODERATION CHECK (/api/moderation/check)
  if (pathname.endsWith('/check')) {
    if (method !== 'POST') {
      return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
    }
    const text = typeof body.text === 'string' ? body.text.slice(0, 4000) : '';
    const result = await evaluateServerModeration(text);
    return { statusCode: 200, payload: { success: true, result } };
  }

  // 2. MODERATION DICTIONARY ENDPOINTS (/api/moderation/dictionary)
  if (pathname.endsWith('/dictionary') || pathname === '/api/moderation') {
    const dictionary = await getAuthoritativeDictionary();

    if (method === 'GET') {
      const adminAuth = await verifyAdminRequestAsync(headers, body);
      const entries = adminAuth.authorized
        ? dictionary
        : dictionary
            .filter((e) => e.enabled)
            .map((e) => ({
              id: e.id,
              phrase: e.phrase,
              category: e.category,
              severity: e.severity,
              action: e.action,
              enabled: e.enabled,
            }));
      return {
        statusCode: 200,
        payload: {
          success: true,
          count: entries.length,
          entries,
        },
      };
    }

    // All mutations strictly require admin auth
    const adminAuth = await verifyAdminRequestAsync(headers, body);
    if (!adminAuth.authorized) {
      await recordSecurityEvent({
        category: 'MODERATION',
        severity: 'high',
        action: 'unauthorized_dictionary_mutation',
        outcome: 'blocked',
        ip,
        route: pathname,
        details: { method, reason: adminAuth.reason },
      });
      return {
        statusCode: adminAuth.storeUnavailable ? 503 : 403,
        payload: { success: false, error: adminAuth.reason || 'Forbidden: Administrator permissions required.' },
      };
    }

    const state = loadLocalModerationState();
    const op = String(body.operation || body.op || (!VALID_ACTIONS.has(body.action) ? body.action : '') || '').trim().toLowerCase();
    const now = new Date().toISOString();

    if (method === 'POST' && (!op || op === 'add')) {
      const validated = validateDictionaryEntryInput(body);
      if (validated.ok === false) {
        return { statusCode: 400, payload: { success: false, error: validated.error } };
      }
      if (state.dictionary.some((d) => d.phrase.toLowerCase() === validated.entry.phrase)) {
        return { statusCode: 409, payload: { success: false, error: 'Phrase already exists in moderation dictionary.' } };
      }
      const created: DictionaryEntry = {
        ...validated.entry,
        id: `mod-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
        createdAt: now,
        updatedAt: now,
      };
      state.dictionary = [created, ...state.dictionary].slice(0, MAX_DICTIONARY_ENTRIES);
      persistLocalModerationState(state);
      await persistDictionaryEntryFirestore(created);
      await recordSecurityEvent({
        category: 'MODERATION',
        severity: 'info',
        action: 'dictionary_entry_added',
        outcome: 'allowed',
        actorId: `ADMIN:${ADMIN_PHONE_NORMALIZED}`,
        ip,
        route: pathname,
        details: { entryId: created.id, category: created.category },
      });
      return { statusCode: 201, payload: { success: true, entry: created, entries: state.dictionary } };
    }

    if (op === 'toggle') {
      const targetId = String(body.id || '').trim();
      const target = state.dictionary.find((d) => d.id === targetId);
      if (!target) {
        return { statusCode: 404, payload: { success: false, error: 'Dictionary entry not found.' } };
      }
      target.enabled = !target.enabled;
      target.updatedAt = now;
      persistLocalModerationState(state);
      await persistDictionaryEntryFirestore(target);
      return { statusCode: 200, payload: { success: true, entry: target, entries: state.dictionary } };
    }

    if (method === 'PUT' || method === 'PATCH' || op === 'update') {
      const targetId = String(body.id || query.id || '').trim();
      const idx = state.dictionary.findIndex((d) => d.id === targetId);
      if (idx === -1) {
        return { statusCode: 404, payload: { success: false, error: 'Dictionary entry not found.' } };
      }
      const merged = { ...state.dictionary[idx], ...body };
      const validated = validateDictionaryEntryInput(merged);
      if (validated.ok === false) {
        return { statusCode: 400, payload: { success: false, error: validated.error } };
      }
      const updated: DictionaryEntry = {
        ...state.dictionary[idx],
        ...validated.entry,
        updatedAt: now,
      };
      state.dictionary[idx] = updated;
      persistLocalModerationState(state);
      await persistDictionaryEntryFirestore(updated);
      return { statusCode: 200, payload: { success: true, entry: updated, entries: state.dictionary } };
    }

    if (op === 'restore') {
      state.dictionary = DEFAULT_MODERATION_SEED.map((e) => ({ ...e }));
      persistLocalModerationState(state);
      return { statusCode: 200, payload: { success: true, entries: state.dictionary } };
    }

    if (op === 'import') {
      const rawEntries = Array.isArray(body.entries) ? body.entries : null;
      if (!rawEntries || rawEntries.length === 0 || rawEntries.length > MAX_IMPORT_ENTRIES) {
        return {
          statusCode: 400,
          payload: { success: false, error: `Import must be an array with 1 to ${MAX_IMPORT_ENTRIES} valid entries.` },
        };
      }
      const validEntries: DictionaryEntry[] = [];
      for (const item of rawEntries) {
        const res = validateDictionaryEntryInput(item);
        if (res.ok) {
          validEntries.push({
            ...res.entry,
            id: typeof item.id === 'string' && item.id.trim() ? item.id.trim().slice(0, 80) : `imp-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
            updatedAt: now,
          });
        }
      }
      if (validEntries.length === 0) {
        return { statusCode: 400, payload: { success: false, error: 'No valid dictionary entries found in import.' } };
      }
      state.dictionary = validEntries;
      persistLocalModerationState(state);
      return { statusCode: 200, payload: { success: true, count: validEntries.length, entries: state.dictionary } };
    }

    if (method === 'DELETE' || op === 'delete') {
      const targetId = String(body.id || query.id || '').trim();
      const before = state.dictionary.length;
      state.dictionary = state.dictionary.filter((d) => d.id !== targetId);
      if (state.dictionary.length === before) {
        return { statusCode: 404, payload: { success: false, error: 'Dictionary entry not found.' } };
      }
      persistLocalModerationState(state);
      await deleteDictionaryEntryFirestore(targetId);
      return { statusCode: 200, payload: { success: true, entries: state.dictionary } };
    }

    return { statusCode: 405, payload: { success: false, error: 'Unsupported moderation dictionary action.' } };
  }

  // 3. USER SAFETY & ABUSE REPORTS (/api/moderation/reports*)
  if (pathname.endsWith('/reports') || pathname.endsWith('/reports/status')) {
    const state = loadLocalModerationState();

    // Update status (admin only)
    if (pathname.endsWith('/reports/status') || method === 'PATCH') {
      if (method !== 'POST' && method !== 'PATCH') {
        return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
      }
      const adminAuth = await verifyAdminRequestAsync(headers, body);
      if (!adminAuth.authorized) {
        await recordSecurityEvent({
          category: 'MODERATION',
          severity: 'high',
          action: 'unauthorized_report_status_update',
          outcome: 'blocked',
          ip,
          route: pathname,
        });
        return {
          statusCode: adminAuth.storeUnavailable ? 503 : 403,
          payload: { success: false, error: adminAuth.reason || 'Forbidden: Administrator permissions required.' },
        };
      }

      const reportId = String(body.id || '').trim();
      const status = String(body.status || '').trim() as ReportStatus;
      if (!reportId || !VALID_REPORT_STATUSES.has(status)) {
        return { statusCode: 400, payload: { success: false, error: 'Valid report id and status are required.' } };
      }
      const report = state.reports.find((r) => r.id === reportId);
      if (!report) {
        return { statusCode: 404, payload: { success: false, error: 'Report not found.' } };
      }
      report.status = status;
      report.reviewedBy = `ADMIN:${ADMIN_PHONE_NORMALIZED}`;
      report.reviewedAt = new Date().toISOString();
      persistLocalModerationState(state);
      await persistReportFirestore(report);
      return { statusCode: 200, payload: { success: true, report } };
    }

    // List reports (STRICTLY ADMIN ONLY)
    if (method === 'GET') {
      const adminAuth = await verifyAdminRequestAsync(headers, body);
      if (!adminAuth.authorized) {
        await recordSecurityEvent({
          category: 'MODERATION',
          severity: 'high',
          action: 'unauthorized_reports_read',
          outcome: 'blocked',
          ip,
          route: pathname,
          details: { reason: adminAuth.reason },
        });
        return {
          statusCode: adminAuth.storeUnavailable ? 503 : 403,
          payload: { success: false, error: adminAuth.reason || 'Forbidden: Administrator permissions required.' },
        };
      }

      let reports = state.reports;
      const db = await getModerationFirestore();
      if (db) {
        try {
          const snap = await db.collection('reports').orderBy('createdAt', 'desc').limit(500).get();
          if (!snap.empty) {
            reports = snap.docs.map((docSnap: any) => docSnap.data() as ServerUserReport);
            state.reports = reports;
          }
        } catch {
          // Use local state
        }
      }
      return { statusCode: 200, payload: { success: true, count: reports.length, reports } };
    }

    // Delete report (STRICTLY ADMIN ONLY)
    if (method === 'DELETE') {
      const adminAuth = await verifyAdminRequestAsync(headers, body);
      if (!adminAuth.authorized) {
        await recordSecurityEvent({
          category: 'MODERATION',
          severity: 'high',
          action: 'unauthorized_report_delete',
          outcome: 'blocked',
          ip,
          route: pathname,
        });
        return {
          statusCode: adminAuth.storeUnavailable ? 503 : 403,
          payload: { success: false, error: adminAuth.reason || 'Forbidden: Administrator permissions required.' },
        };
      }
      const targetId = String(body.id || query.id || '').trim();
      const before = state.reports.length;
      state.reports = state.reports.filter((r) => r.id !== targetId);
      if (state.reports.length === before) {
        return { statusCode: 404, payload: { success: false, error: 'Report not found.' } };
      }
      persistLocalModerationState(state);
      await deleteReportFirestore(targetId);
      return { statusCode: 200, payload: { success: true, reports: state.reports } };
    }

    // Submit new abuse report (authenticated OR controlled rate-limited community user)
    if (method === 'POST') {
      const postId = typeof body.postId === 'string' ? body.postId.trim().slice(0, 128) : '';
      const reportedUser = typeof body.reportedUser === 'string' ? body.reportedUser.trim().slice(0, 64) : '';
      const reasonCategory = typeof body.reasonCategory === 'string' ? body.reasonCategory.trim().slice(0, 120) : '';
      const description = typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : '';
      const postContent = typeof body.postContent === 'string' ? body.postContent.trim().slice(0, 1000) : '';

      if (!postId || !reportedUser || !reasonCategory) {
        return { statusCode: 400, payload: { success: false, error: 'postId, reportedUser, and reasonCategory are required.' } };
      }
      if (description.length < 5) {
        return { statusCode: 400, payload: { success: false, error: 'Report description must be at least 5 characters.' } };
      }

      // Bind identity cryptographically if signed in; never allow spoofed uid overrides
      const authCheck = await authenticateTokenRequestAsync(headers, body);
      if (authCheck.statusCode === 403) {
        await recordSecurityEvent({
          category: 'IDOR',
          severity: 'high',
          action: 'report_identity_spoof_attempt',
          outcome: 'blocked',
          ip,
          route: pathname,
        });
        return { statusCode: 403, payload: { success: false, error: authCheck.error || 'Forbidden identity mismatch.' } };
      }

      const reporterUid = authCheck.authenticated ? authCheck.userUid || null : null;
      const reporterUsername = authCheck.authenticated
        ? (typeof body.reporterUsername === 'string' && body.reporterUsername.trim()
            ? body.reporterUsername.trim().slice(0, 32)
            : `Punter_${(reporterUid || '0000').slice(-4)}`)
        : 'Anonymous';

      const autoMod = await evaluateServerModeration(`${postContent} ${description}`.trim());

      const report: ServerUserReport = {
        id: `rep-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
        postId,
        reportedUser,
        postContent,
        reporterUid,
        reporterUsername,
        reasonCategory,
        description,
        createdAt: new Date().toISOString(),
        status: 'Pending', // Strictly server-enforced; ignores client status overrides
        autoModeration: {
          isAllowed: autoMod.isAllowed,
          category: autoMod.category,
          severity: autoMod.severity,
          flaggedPhrases: autoMod.flaggedPhrases?.slice(0, 10),
        },
      };

      state.reports = [report, ...state.reports].slice(0, MAX_REPORTS_STORED);
      persistLocalModerationState(state);
      await persistReportFirestore(report);
      await recordSecurityEvent({
        category: 'MODERATION',
        severity: autoMod.isAllowed ? 'info' : 'warning',
        action: 'user_report_submitted',
        outcome: 'allowed',
        actorId: reporterUid || `ANON:${ip}`,
        ip,
        route: pathname,
        details: { reportId: report.id, reasonCategory, autoBlocked: !autoMod.isAllowed },
      });

      return {
        statusCode: 201,
        payload: {
          success: true,
          report: {
            id: report.id,
            postId: report.postId,
            reasonCategory: report.reasonCategory,
            status: report.status,
            createdAt: report.createdAt,
          },
        },
      };
    }

    return { statusCode: 405, payload: { success: false, error: 'Method not allowed.' } };
  }

  return { statusCode: 404, payload: { success: false, error: `Unknown moderation route: ${pathname}` } };
}

