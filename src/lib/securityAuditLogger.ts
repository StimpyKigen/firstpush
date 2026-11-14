/**
 * Structured Security Audit Logger & Anomaly Detection Service
 *
 * Persists redacted security telemetry to Cloud Firestore (`securityAuditLogs`)
 * when Admin SDK is active, alongside bounded local disk/cache storage.
 * Automatically raises `[SECURITY_ALERT]` flags when failure or abuse thresholds
 * are crossed within a sliding time window.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { getAdminFirestore, resetFirebaseAdminForTests } from './serverFirebaseAdmin.js';

export type SecurityEventCategory =
  | 'AUTH'
  | 'ADMIN'
  | 'IDOR'
  | 'RATE_LIMIT'
  | 'MODERATION'
  | 'P2P_ESCROW'
  | 'SUBSCRIPTION'
  | 'TOKEN_ECONOMY'
  | 'PDF_SECURITY'
  | 'INPUT_VALIDATION';

export type SecurityEventSeverity = 'info' | 'warning' | 'high' | 'critical';

export interface SecurityAuditEvent {
  id: string;
  timestamp: string;
  category: SecurityEventCategory;
  severity: SecurityEventSeverity;
  action: string;
  outcome: 'allowed' | 'blocked' | 'failure' | 'alert';
  actorId: string | null;
  ip: string;
  route: string;
  details: Record<string, any>;
  alertTriggered: boolean;
  burstCount: number;
}

const MAX_LOG_ENTRIES = 1000;
const ANOMALY_WINDOW_MS = 5 * 60 * 1000;
const ANOMALY_THRESHOLD = 5;

const REDACTED_KEYS = new Set([
  'pin',
  'adminpin',
  'token',
  'admintoken',
  'usertoken',
  'usersessiontoken',
  'firebaseidtoken',
  'authorization',
  'cookie',
  'secret',
  'password',
  'privatekey',
  'private_key',
  'serviceaccount',
  'pinhash',
]);

const DATA_DIR = path.join(process.cwd(), 'data');
const PRIMARY_LOG_FILE = path.join(DATA_DIR, 'security_audit_logs.json');
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const CACHE_DIR = isServerless
  ? path.join(os.tmpdir(), '.mshindi-cache')
  : path.join(process.cwd(), '.cache');
const FALLBACK_LOG_FILE = path.join(CACHE_DIR, 'security_audit_logs.json');

let memoryLogs: SecurityAuditEvent[] | null = null;
const burstTracker = new Map<string, { timestamps: number[] }>();
export function resetSecurityAuditLogsForTests(): void {
  memoryLogs = [];
  burstTracker.clear();
  resetFirebaseAdminForTests();
}

async function getAuditFirestore(): Promise<any | null> {
  return getAdminFirestore();
}

function sanitizeDetailValue(val: unknown, depth = 0): any {
  if (depth > 3) return '[truncated]';
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    return val.length > 240 ? `${val.slice(0, 237)}...` : val;
  }
  if (Array.isArray(val)) {
    return val.slice(0, 12).map((item) => sanitizeDetailValue(item, depth + 1));
  }
  if (typeof val === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      if (REDACTED_KEYS.has(k.toLowerCase())) {
        clean[k] = '[REDACTED]';
      } else {
        clean[k] = sanitizeDetailValue(v, depth + 1);
      }
    }
    return clean;
  }
  return String(val).slice(0, 120);
}

function loadLogsFromDisk(): SecurityAuditEvent[] {
  if (memoryLogs !== null) return memoryLogs;

  for (const filePath of [PRIMARY_LOG_FILE, FALLBACK_LOG_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(parsed)) {
          memoryLogs = parsed.slice(-MAX_LOG_ENTRIES);
          return memoryLogs;
        }
      }
    } catch {
      // Try next file
    }
  }

  memoryLogs = [];
  return memoryLogs;
}

function persistLogsToDisk(logs: SecurityAuditEvent[]): void {
  const payload = JSON.stringify(logs.slice(-MAX_LOG_ENTRIES));
  for (const [dir, target] of [
    [DATA_DIR, PRIMARY_LOG_FILE],
    [CACHE_DIR, FALLBACK_LOG_FILE],
  ] as const) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(target, payload, 'utf-8');
      return;
    } catch {
      // Fallback on read-only serverless filesystem
    }
  }
}

function evaluateBurstAnomaly(
  category: SecurityEventCategory,
  severity: SecurityEventSeverity,
  outcome: SecurityAuditEvent['outcome'],
  actorKey: string
): { alertTriggered: boolean; burstCount: number } {
  const isFailureOrBlocked = outcome === 'blocked' || outcome === 'failure' || outcome === 'alert';
  if (!isFailureOrBlocked) {
    return { alertTriggered: false, burstCount: 1 };
  }

  const now = Date.now();
  const compositeKey = `${category}:${actorKey || 'anon'}`;
  const existing = burstTracker.get(compositeKey) || { timestamps: [] };
  existing.timestamps = existing.timestamps.filter((t) => now - t <= ANOMALY_WINDOW_MS);
  existing.timestamps.push(now);
  burstTracker.set(compositeKey, existing);

  if (burstTracker.size > 4000) {
    const oldestKey = burstTracker.keys().next().value;
    if (oldestKey) burstTracker.delete(oldestKey);
  }

  const burstCount = existing.timestamps.length;
  const alertTriggered = severity === 'critical' || burstCount >= ANOMALY_THRESHOLD;
  return { alertTriggered, burstCount };
}

/**
 * Records a redacted structured security audit event and evaluates sliding-window anomaly alerts.
 */
export async function recordSecurityEvent(params: {
  category: SecurityEventCategory;
  severity?: SecurityEventSeverity;
  action: string;
  outcome: SecurityAuditEvent['outcome'];
  actorId?: string | null;
  ip?: string;
  route?: string;
  details?: Record<string, any>;
}): Promise<SecurityAuditEvent> {
  const severity: SecurityEventSeverity = params.severity || 'warning';
  const ip = String(params.ip || 'unknown').slice(0, 64);
  const actorId = params.actorId ? String(params.actorId).slice(0, 80) : null;
  const route = String(params.route || '/').slice(0, 140);
  const { alertTriggered, burstCount } = evaluateBurstAnomaly(
    params.category,
    severity,
    params.outcome,
    actorId || ip
  );

  const event: SecurityAuditEvent = {
    id: `sec-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString(),
    category: params.category,
    severity: alertTriggered && severity === 'warning' ? 'high' : severity,
    action: String(params.action || 'unknown').slice(0, 100),
    outcome: alertTriggered ? 'alert' : params.outcome,
    actorId,
    ip,
    route,
    details: sanitizeDetailValue(params.details || {}) || {},
    alertTriggered,
    burstCount,
  };

  const logs = loadLogsFromDisk();
  logs.push(event);
  if (logs.length > MAX_LOG_ENTRIES) {
    logs.splice(0, logs.length - MAX_LOG_ENTRIES);
  }
  persistLogsToDisk(logs);

  if (alertTriggered) {
    console.warn('[SECURITY_ALERT]', JSON.stringify(event));
  }

  const db = await getAuditFirestore();
  if (db) {
    try {
      await db.collection('securityAuditLogs').doc(event.id).set(event);
    } catch {
      // Disk log already captured the event
    }
  }

  return event;
}

/**
 * Queries recent security audit logs (admin endpoint use only).
 */
export async function querySecurityEvents(filters?: {
  limit?: number;
  severity?: SecurityEventSeverity;
  category?: SecurityEventCategory;
  onlyAlerts?: boolean;
}): Promise<{ logs: SecurityAuditEvent[]; total: number; alertCount: number }> {
  const limit = Math.min(200, Math.max(1, Number(filters?.limit) || 50));
  let sourceLogs = [...loadLogsFromDisk()].reverse();

  const db = await getAuditFirestore();
  if (db) {
    try {
      const snap = await db
        .collection('securityAuditLogs')
        .orderBy('timestamp', 'desc')
        .limit(limit * 2)
        .get();
      if (!snap.empty) {
        const merged = new Map<string, SecurityAuditEvent>();
        for (const docSnap of snap.docs) {
          const item = docSnap.data() as SecurityAuditEvent;
          if (item?.id) merged.set(item.id, item);
        }
        for (const localItem of sourceLogs) {
          if (!merged.has(localItem.id)) merged.set(localItem.id, localItem);
        }
        sourceLogs = Array.from(merged.values()).sort((a, b) =>
          b.timestamp.localeCompare(a.timestamp)
        );
      }
    } catch {
      // Fallback to local log list
    }
  }

  const filtered = sourceLogs.filter((entry) => {
    if (filters?.severity && entry.severity !== filters.severity) return false;
    if (filters?.category && entry.category !== filters.category) return false;
    if (filters?.onlyAlerts && !entry.alertTriggered) return false;
    return true;
  });

  const alertCount = sourceLogs.filter((entry) => entry.alertTriggered).length;
  return {
    logs: filtered.slice(0, limit),
    total: filtered.length,
    alertCount,
  };
}

