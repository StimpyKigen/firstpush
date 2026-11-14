/**
 * Developer-side error reporting.
 *
 * Detailed diagnostics are written here (console + bounded in-memory buffer +
 * optional external sink) AFTER redaction. The user interface never reads from
 * this module; it only sees the catalogue copy chosen by `toUserError`.
 */
import { redactForLog } from './redact';
import type { ErrorKind } from './errorCatalog';
import type { ErrorDomain } from './classifyError';

export interface ErrorReportContext {
  /** Short stable label for where this happened, e.g. 'wallet.verifyMpesa'. */
  source: string;
  domain?: ErrorDomain;
  kind?: ErrorKind;
  extra?: Record<string, unknown>;
}

export interface ErrorLogEntry {
  at: string;
  source: string;
  domain?: ErrorDomain;
  kind?: ErrorKind;
  error: unknown;
  extra?: unknown;
}

type ErrorSink = (entry: ErrorLogEntry) => void;

const MAX_BUFFER = 50;
const buffer: ErrorLogEntry[] = [];
let sink: ErrorSink | null = null;

/** Register an external monitoring hook (e.g. a future Sentry adapter). */
export function setErrorSink(next: ErrorSink | null): void {
  sink = next;
}

export function getRecentErrorLogs(): readonly ErrorLogEntry[] {
  return buffer.slice();
}

export function clearErrorLogs(): void {
  buffer.length = 0;
}

/**
 * Records an error for developers. Always safe to call: it never throws and
 * never leaks secrets because everything is redacted first.
 */
export function reportError(err: unknown, ctx: ErrorReportContext): ErrorLogEntry {
  let entry: ErrorLogEntry;
  try {
    entry = {
      at: new Date().toISOString(),
      source: ctx.source,
      domain: ctx.domain,
      kind: ctx.kind,
      error: redactForLog(err),
      extra: ctx.extra ? redactForLog(ctx.extra) : undefined,
    };
  } catch {
    entry = { at: new Date().toISOString(), source: ctx.source, error: '[unreportable error]' };
  }

  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();

  try {
    console.error(`[MshindiError] ${entry.source}`, entry);
  } catch {
    /* console unavailable */
  }
  try {
    sink?.(entry);
  } catch {
    /* monitoring must never break the app */
  }
  return entry;
}

