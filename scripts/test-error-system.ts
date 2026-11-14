/**
 * MshindiRoom — Unified error system verification suite.
 *
 * Covers: classification, catalogue integrity, sanitisation of technical text,
 * log redaction, payment-retry safety, component rendering (SSR), contrast of
 * the real design tokens, and source-level integration checks.
 *
 * Run: npx tsx scripts/test-error-system.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

import {
  ALL_ERROR_KINDS,
  ERROR_CATALOG,
  MONEY_ERROR_KINDS,
  ACTION_LABELS,
  classifyError,
  clientSafeServerMessage,
  looksTechnical,
  redactForLog,
  redactText,
  reportError,
  resolveServiceError,
  sanitizeUserMessage,
  toUserError,
  getRecentErrorLogs,
  clearErrorLogs,
  setErrorSink,
  type ErrorKind,
} from '../src/lib/errors';
import ErrorState from '../src/components/errors/ErrorState';
import InlineError from '../src/components/errors/InlineError';
import { ErrorBoundary } from '../src/components/ErrorBoundary';

const ROOT = process.cwd();
let passed = 0;
let failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err: any) {
    failed++;
    failures.push(name);
    console.log(`[FAIL] ${name}\n       ${String(err?.message || err).split('\n')[0]}`);
  }
}

const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Silence developer-side console noise from reportError during the run.
const realConsoleError = console.error;
console.error = () => {};

console.log('==================================================================');
console.log('MSHINDIROOM: UNIFIED ERROR SYSTEM VERIFICATION SUITE');
console.log('==================================================================');

// ───────────────────────── 1. Classification ─────────────────────────
console.log('\n--- 1. Classification ---');

const classifyCases: Array<[string, unknown, ErrorKind, any?]> = [
  ['Firestore permission-denied', { code: 'permission-denied', message: 'Missing or insufficient permissions.' }, 'access-denied'],
  ['Firestore unauthenticated', { code: 'unauthenticated' }, 'session-expired'],
  ['Firestore unavailable', { code: 'unavailable' }, 'server'],
  ['Firestore deadline-exceeded', { code: 'deadline-exceeded' }, 'timeout'],
  ['Firestore not-found', { code: 'not-found' }, 'not-found'],
  ['Firebase auth network failure', { code: 'auth/network-request-failed' }, 'connection-lost'],
  ['Firebase auth too many requests', { code: 'auth/too-many-requests' }, 'rate-limited'],
  ['Firebase auth expired token', { code: 'auth/id-token-expired' }, 'session-expired'],
  ['Firebase auth bad OTP', { code: 'auth/invalid-verification-code' }, 'validation'],
  ['Firebase auth unauthorised domain', { code: 'auth/unauthorized-domain' }, 'server'],
  ['Storage unauthorized', { code: 'storage/unauthorized' }, 'access-denied'],
  ['Storage retry limit', { code: 'storage/retry-limit-exceeded' }, 'timeout'],
  ['fetch TypeError', new TypeError('Failed to fetch'), 'connection-lost'],
  ['Safari load failed', new TypeError('Load failed'), 'connection-lost'],
  ['AbortError', Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }), 'timeout'],
  ['HTTP 401', { status: 401 }, 'session-expired'],
  ['HTTP 403', { status: 403 }, 'access-denied'],
  ['HTTP 404', { status: 404 }, 'not-found'],
  ['HTTP 413', { status: 413 }, 'file-invalid'],
  ['HTTP 429', { status: 429 }, 'rate-limited'],
  ['HTTP 500', { status: 500 }, 'server'],
  ['HTTP 503', { status: 503 }, 'maintenance'],
  ['HTTP 504', { status: 504 }, 'timeout'],
  ['string 500 text', 'HTTP 500 — Internal Server Error.', 'server'],
  ['malformed JSON', new SyntaxError('Unexpected token < in JSON at position 0'), 'unknown'],
  ['unexpected TypeError', new TypeError('Cannot read properties of undefined'), 'unknown'],
  ['null / undefined', undefined, 'unknown'],
  // Domain handling
  ['payment + network drop => outcome unknown', new TypeError('Failed to fetch'), 'payment-pending', { domain: 'payment' }],
  ['payment + 500 => outcome unknown', { status: 500 }, 'payment-pending', { domain: 'payment' }],
  ['payment + timeout => outcome unknown', { code: 'deadline-exceeded' }, 'payment-pending', { domain: 'payment' }],
  ['payment + 400 => definite failure', { status: 400 }, 'payment-failed', { domain: 'payment' }],
  ['payment + 401 stays session-expired', { status: 401 }, 'session-expired', { domain: 'payment' }],
  ['token + 500', { status: 500 }, 'token-failed', { domain: 'token' }],
  ['subscription + 503', { status: 503 }, 'subscription-delayed', { domain: 'subscription' }],
  ['upload + network', new TypeError('Failed to fetch'), 'upload-failed', { domain: 'upload' }],
  ['upload + 413 stays file-invalid', { status: 413 }, 'file-invalid', { domain: 'upload' }],
  ['chat + 500', { status: 500 }, 'chat-failed', { domain: 'chat' }],
  ['fixtures + 500', { status: 500 }, 'fixtures-failed', { domain: 'fixtures' }],
  ['search + network', new TypeError('Failed to fetch'), 'search-failed', { domain: 'search' }],
  ['update + 500', { status: 500 }, 'update-failed', { domain: 'update' }],
];
for (const [name, input, expected, ctx] of classifyCases) {
  test(`classify: ${name} -> ${expected}`, () => {
    assert.equal(classifyError(input, ctx), expected);
  });
}

test('classify: browser offline wins for unknown failures', () => {
  const prevDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    configurable: true,
    writable: true,
  });
  try {
    assert.equal(classifyError(new Error('boom')), 'offline');
    assert.equal(classifyError(new TypeError('Failed to fetch')), 'offline');
  } finally {
    if (prevDesc) {
      Object.defineProperty(globalThis, 'navigator', prevDesc);
    } else {
      delete (globalThis as any).navigator;
    }
  }
});

// ───────────────────────── 2. Catalogue integrity ─────────────────────────
console.log('\n--- 2. Catalogue integrity ---');

test('catalogue: contains at least the 6 reference states plus app-specific states', () => {
  assert.ok(ALL_ERROR_KINDS.length >= 20, `only ${ALL_ERROR_KINDS.length} kinds`);
  for (const k of ['offline', 'server', 'access-denied', 'not-found', 'payment-failed', 'unknown'] as ErrorKind[]) {
    assert.ok(ERROR_CATALOG[k], `missing ${k}`);
  }
});
test('catalogue: every entry has title, message, valid icon and known actions', () => {
  for (const def of Object.values(ERROR_CATALOG)) {
    assert.ok(def.title.length > 2 && def.message.length > 10, def.kind);
    for (const a of def.actions) assert.ok(ACTION_LABELS[a], `${def.kind}: unknown action ${a}`);
  }
});
test('catalogue: no user-facing copy looks technical', () => {
  for (const def of Object.values(ERROR_CATALOG)) {
    assert.ok(!looksTechnical(def.title), `${def.kind} title looks technical`);
    assert.ok(!looksTechnical(def.message), `${def.kind} message looks technical: ${def.message}`);
    if (def.footnote) assert.ok(!looksTechnical(def.footnote), `${def.kind} footnote`);
  }
});
test('catalogue: wording matches the brief for the headline states', () => {
  assert.equal(ERROR_CATALOG.offline.message, "You're currently offline. Check your connection and try again.");
  assert.equal(ERROR_CATALOG.server.message, "We're having trouble loading this right now. Please try again shortly.");
  assert.equal(
    ERROR_CATALOG['access-denied'].message,
    "You're unable to access this content right now. Please sign in or check your permissions.",
  );
  assert.ok(ERROR_CATALOG['not-found'].message.startsWith("We couldn't find what you're looking for."));
  assert.equal(
    ERROR_CATALOG['payment-failed'].message,
    "We couldn't complete this transaction. Please check its status before trying again.",
  );
  assert.equal(ERROR_CATALOG.unknown.message, 'Oops! Something went wrong. Please try again in a moment.');
});
test('catalogue: money states never include a blind retry action', () => {
  for (const kind of MONEY_ERROR_KINDS) {
    const def = ERROR_CATALOG[kind];
    assert.ok(!def.actions.includes('retry'), `${kind} offers retry`);
    assert.equal(def.retrySafe, false, `${kind} marked retry-safe`);
    assert.ok(
      def.actions.includes('check-payment') || def.actions.includes('check-balance'),
      `${kind} lacks a status-check action`,
    );
  }
});
test('catalogue: non-idempotent states (chat, update) are not retry-safe by default', () => {
  assert.equal(ERROR_CATALOG['chat-failed'].retrySafe, false);
  assert.equal(ERROR_CATALOG['update-failed'].retrySafe, false);
});

// ───────────────────────── 3. Sanitisation ─────────────────────────
console.log('\n--- 3. Technical text never reaches users ---');

const TECHNICAL_SAMPLES = [
  'FirebaseError: Missing or insufficient permissions at firestore.googleapis.com...',
  'Missing or insufficient permissions.',
  '7 PERMISSION_DENIED: Missing or insufficient permissions.',
  'TypeError: Cannot read properties of undefined (reading \'map\')',
  'HTTP 500 — Internal Server Error.',
  'Request failed with status code 502',
  'Failed to fetch',
  'NetworkError when attempting to fetch resource.',
  'Unexpected token < in JSON at position 0',
  'at handler (C:\\Users\\dev\\project\\server.ts:278:15)',
  'Error: ENOENT: no such file or directory, open \'/var/app/data/homepage_feed.json\'',
  'Backend API unreachable',
  'Firestore read failed',
  'Firestore write failed',
  'Failed to upload WebP photo: Storage error',
  "TOKEN_NOT_FOUND: Token ID 'mt_abc123' does not exist.",
  "UNAUTHORIZED_TOKEN_OWNERSHIP: Token 'mt_1' does not belong to user '254743304579'.",
  "Forbidden: Authenticated user '254743304579' cannot perform operations on '254700000000'.",
  'Phone Sign-In is not enabled in your Firebase Console for project "mshindiroom-production". Please enable Phone Auth in Firebase Console -> Authentication -> Sign-in method. [auth/operation-not-allowed]',
  'This domain (mshindi.co.ke) is not added to Firebase Authorized Domains.',
  'Failed to initialize reCAPTCHA verifier.',
  'User session signing secret is not configured.',
  'SECURITY_VIOLATION: Client-side spend is strictly forbidden.',
  'Unknown admin endpoint: /api/admin/secret',
  'Failed to sync comment like to database.',
  'Invalid or expired user session token. at /api/tokens/spend',
  'ECONNREFUSED 127.0.0.1:3000',
  'Request to https://api.sportscore.example/v1/matches failed',
];
for (const sample of TECHNICAL_SAMPLES) {
  test(`sanitise: strips "${sample.slice(0, 54)}${sample.length > 54 ? '…' : ''}"`, () => {
    assert.ok(looksTechnical(sample), 'not flagged as technical');
    const safe = sanitizeUserMessage(sample);
    assert.ok(!looksTechnical(safe), `still technical: ${safe}`);
    assert.notEqual(safe, sample);
  });
}

const BUSINESS_MESSAGES = [
  'This confirmation code has already been redeemed.',
  "That doesn't look like a valid M-Pesa confirmation code (e.g. QFT7K9L2M1).",
  'Insufficient wallet balance. Need KSh 100, have KSh 50.',
  'Enter a valid phone number (e.g. 0743 304 579).',
  'That username is already taken. Try another.',
  'PINs do not match.',
  'You have reached the maximum limit of 2 edits for this pick.',
  'Cooldown active. Please wait 12s before sending another message.',
  'Please enter your phone number.',
];
for (const msg of BUSINESS_MESSAGES) {
  test(`sanitise: preserves intentional message "${msg.slice(0, 48)}…"`, () => {
    assert.equal(sanitizeUserMessage(msg), msg);
  });
}

test('sanitise: empty / non-string input falls back to catalogue copy', () => {
  for (const v of [undefined, null, '', {}, 42]) {
    const safe = sanitizeUserMessage(v as any);
    assert.ok(safe.length > 10 && !looksTechnical(safe));
  }
});
test('sanitise: payment domain network text becomes the pending-payment message', () => {
  const r = resolveServiceError('Failed to fetch', { domain: 'payment' });
  assert.equal(r.kind, 'payment-pending');
  assert.ok(!r.actions.includes('retry'));
});

// Server boundary
console.log('\n--- 4. Server boundary ---');
test('server: internal token codes map to plain language', () => {
  assert.equal(
    clientSafeServerMessage("INSUFFICIENT_TOKENS: Need 5, have 2 for user '254743304579'", 400),
    "You don't have enough Mshindi Tokens for this. Check your balance and try again.",
  );
  assert.ok(!/254743304579|TOKEN/.test(clientSafeServerMessage("TOKEN_NOT_FOUND: Token ID 'x' does not exist.", 400)));
  assert.equal(
    clientSafeServerMessage("Forbidden: Authenticated user '254743304579' cannot perform operations on '254700000000'.", 403),
    "You don't have permission to do that.",
  );
});
test('server: unknown 500 text becomes the generic server message', () => {
  const msg = clientSafeServerMessage('connect ECONNREFUSED 10.0.0.5:5432', 500);
  assert.equal(msg, ERROR_CATALOG.server.message);
});
test('server: short business strings pass through (e.g. room price rule)', () => {
  const s = 'Invalid room unlock price: server enforces authoritative cost of KSh 50.';
  assert.equal(clientSafeServerMessage(s, 400), s);
});

// ───────────────────────── 5. Redaction & diagnostics ─────────────────────────
console.log('\n--- 5. Developer diagnostics are kept, but redacted ---');

test('redact: secrets, tokens, phones and codes are scrubbed from text', () => {
  const dirty =
    'Authorization: Bearer abcdef1234567890abcdef token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk ' +
    'phone +254743304579 or 0743304579 mail a.b@example.com code QFT7K9L2M1 apikey=AIzaSyA-1234567890123456789012345';
  const clean = redactText(dirty);
  for (const leak of ['abcdef1234567890abcdef', 'eyJhbGci', '254743304579', '0743304579', 'a.b@example.com', 'QFT7K9L2M1', 'AIzaSy']) {
    assert.ok(!clean.includes(leak), `leaked ${leak}: ${clean}`);
  }
});
test('redact: sensitive object keys are removed deeply, safe keys kept', () => {
  const out: any = redactForLog({
    userMessage: 'hello',
    headers: { Authorization: 'Bearer xyz', 'x-admin-token': 'adm', cookie: 'sid=1' },
    body: { pin: '1234', phone: '0743304579', otp: '123456', amount: 100, nested: { password: 'p' } },
  });
  assert.equal(out.userMessage, 'hello');
  assert.equal(out.headers.Authorization, '[REDACTED]');
  assert.equal(out.headers['x-admin-token'], '[REDACTED]');
  assert.equal(out.body.pin, '[REDACTED]');
  assert.equal(out.body.phone, '[REDACTED]');
  assert.equal(out.body.otp, '[REDACTED]');
  assert.equal(out.body.nested.password, '[REDACTED]');
  assert.equal(out.body.amount, 100);
});
test('redact: Error objects keep name/code/stack for developers (scrubbed)', () => {
  const err: any = new Error('boom for 0743304579 Bearer abcdef1234567890');
  err.code = 'permission-denied';
  const out: any = redactForLog(err);
  assert.equal(out.name, 'Error');
  assert.equal(out.code, 'permission-denied');
  assert.ok(typeof out.stack === 'string' && out.stack.length > 20, 'stack removed');
  assert.ok(!JSON.stringify(out).includes('0743304579'));
  assert.ok(!JSON.stringify(out).includes('abcdef1234567890'));
});
test('redact: circular structures do not throw', () => {
  const a: any = { x: 1 };
  a.self = a;
  assert.doesNotThrow(() => redactForLog(a));
});
test('reporter: toUserError logs full detail for developers but returns safe copy', () => {
  clearErrorLogs();
  const err: any = new Error('FirebaseError: Missing or insufficient permissions at firestore.googleapis.com');
  err.code = 'permission-denied';
  const ue = toUserError(err, { source: 'test.permission', domain: 'general' });
  assert.equal(ue.kind, 'access-denied');
  assert.ok(!looksTechnical(ue.message) && !looksTechnical(ue.title));
  const logs = getRecentErrorLogs();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].source, 'test.permission');
  assert.equal((logs[0].error as any).code, 'permission-denied');
  assert.ok(String((logs[0].error as any).message).includes('insufficient permissions'));
});
test('reporter: external sink receives redacted entries; a throwing sink cannot break the app', () => {
  clearErrorLogs();
  const received: any[] = [];
  setErrorSink((e) => received.push(e));
  reportError(new Error('secret Bearer abcdef1234567890 for 0743304579'), { source: 'sink.test' });
  assert.equal(received.length, 1);
  assert.ok(!JSON.stringify(received[0]).includes('abcdef1234567890'));
  setErrorSink(() => {
    throw new Error('sink down');
  });
  assert.doesNotThrow(() => reportError(new Error('x'), { source: 'sink.throws' }));
  setErrorSink(null);
});
test('reporter: ring buffer is bounded', () => {
  clearErrorLogs();
  for (let i = 0; i < 120; i++) reportError(new Error(`e${i}`), { source: 'bulk' });
  assert.ok(getRecentErrorLogs().length <= 50);
});

// ───────────────────────── 6. Components ─────────────────────────
console.log('\n--- 6. Component rendering ---');

const html = (el: React.ReactElement, withRouter = true) =>
  renderToStaticMarkup(withRouter ? React.createElement(MemoryRouter, null, el) : el);
const noop = () => {};
const buttonLabels = (markup: string) =>
  [...markup.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());

test('ErrorState: renders catalogue title + message for every kind (page, section, compact)', () => {
  for (const kind of ALL_ERROR_KINDS) {
    for (const variant of ['page', 'section', 'compact'] as const) {
      const out = html(React.createElement(ErrorState, { kind, variant, onRetry: noop, onCheckPayment: noop, onCheckBalance: noop }));
      const def = ERROR_CATALOG[kind];
      assert.ok(out.includes(`data-error-kind="${kind}"`), `${kind}/${variant}: marker`);
      assert.ok(out.includes(def.title.replace(/'/g, '&#x27;')), `${kind}/${variant}: title`);
      assert.ok(out.includes(`data-error-icon="${def.icon}"`), `${kind}/${variant}: icon`);
    }
  }
});
test('ErrorState: raw error input is classified but its text is NEVER rendered', () => {
  const nasty = Object.assign(
    new Error("FirebaseError: Missing or insufficient permissions at firestore.googleapis.com/v1/projects/mshindiroom-production/databases"),
    { code: 'permission-denied', stack: 'Error: x\n    at secret (C:\\repo\\src\\lib\\store.ts:10:5)' },
  );
  const out = html(React.createElement(ErrorState, { error: nasty }));
  for (const leak of ['Firebase', 'firestore', 'insufficient', 'mshindiroom-production', 'store.ts', 'C:\\']) {
    assert.ok(!out.includes(leak), `leaked: ${leak}`);
  }
  assert.ok(out.includes("You&#x27;re unable to access this content right now"));
});
test('ErrorState: shows only actions that have a working handler', () => {
  // server: retry + home. Without onRetry only the Home link may appear.
  const noRetry = html(React.createElement(ErrorState, { kind: 'server' }));
  assert.ok(!noRetry.includes('Try Again'), 'retry shown without handler');
  assert.ok(noRetry.includes('Go Home'));
  const withRetry = html(React.createElement(ErrorState, { kind: 'server', onRetry: noop }));
  assert.ok(buttonLabels(withRetry).includes('Try Again'));
});
test('ErrorState: payment states never show Try Again, even when onRetry is supplied', () => {
  for (const kind of ['payment-failed', 'payment-pending', 'token-failed', 'subscription-delayed'] as ErrorKind[]) {
    const out = html(React.createElement(ErrorState, { kind, onRetry: noop, onCheckPayment: noop, onCheckBalance: noop }));
    assert.ok(!out.includes('Try Again'), `${kind} offers Try Again`);
  }
  const pay = html(React.createElement(ErrorState, { kind: 'payment-pending', onCheckPayment: noop }));
  assert.ok(buttonLabels(pay).includes('Check Payment Status'));
  const noCheck = html(React.createElement(ErrorState, { kind: 'payment-pending' }));
  assert.ok(!noCheck.includes('Check Payment Status'), 'check-status shown without handler');
});
test('ErrorState: allowRetry opts a non-retry-safe kind in explicitly', () => {
  const out = html(React.createElement(ErrorState, { kind: 'chat-failed', onRetry: noop, allowRetry: true }));
  assert.ok(buttonLabels(out).includes('Try Again'));
  const blocked = html(React.createElement(ErrorState, { kind: 'chat-failed', onRetry: noop }));
  assert.ok(!blocked.includes('Try Again'));
});
test('ErrorState: navigation actions are real links; support is a mailto', () => {
  const nf = html(React.createElement(ErrorState, { kind: 'not-found' }));
  assert.ok(/<a [^>]*href="\/"[^>]*>Go Home<\/a>/.test(nf));
  assert.ok(/<a [^>]*href="\/free"[^>]*>Browse Matches<\/a>/.test(nf));
  const ad = html(React.createElement(ErrorState, { kind: 'access-denied' }));
  assert.ok(/href="mailto:support@mshindi\.co\.ke/.test(ad));
  assert.ok(/<a [^>]*href="\/auth"[^>]*>Sign In<\/a>/.test(ad));
});
test('ErrorState: works outside a Router (root error boundary) using plain anchors', () => {
  const out = html(React.createElement(ErrorState, { kind: 'unknown', variant: 'page', onRetry: noop }), false);
  assert.ok(out.includes('href="/"'));
  assert.ok(out.includes('Go Home'));
});
test('ErrorState: status roles + reduced-motion-safe entrance class', () => {
  assert.ok(html(React.createElement(ErrorState, { kind: 'payment-failed' })).includes('role="alert"'));
  assert.ok(html(React.createElement(ErrorState, { kind: 'offline' })).includes('role="alert"'));
  assert.ok(html(React.createElement(ErrorState, { kind: 'not-found' })).includes('role="status"'));
  assert.ok(html(React.createElement(ErrorState, { kind: 'not-found' })).includes('error-state-enter'));
  assert.ok(/prefers-reduced-motion[\s\S]*error-state-enter/.test(read('src/index.css')));
});
test('ErrorState: layout is constrained for mobile (max width, wrapping, 44px primary target)', () => {
  const out = html(React.createElement(ErrorState, { kind: 'server', variant: 'page', onRetry: noop }));
  assert.ok(out.includes('max-w-sm'));
  assert.ok(out.includes('break-words'));
  assert.ok(out.includes('min-h-11'));
  assert.ok(out.includes('safe-area-inset-bottom'));
});
test('ErrorState: very long override copy still renders within wrapping container', () => {
  const long = 'This is a very long sentence. '.repeat(30);
  const out = html(React.createElement(ErrorState, { kind: 'unknown', message: long }));
  assert.ok(out.includes('break-words') && out.includes(long.trim().slice(0, 40)));
});
test('InlineError: sanitises technical strings and renders nothing when empty', () => {
  const raw = html(React.createElement(InlineError, { message: 'FirebaseError: permission-denied at firestore.googleapis.com' }));
  assert.ok(!raw.includes('Firebase') && raw.includes('role="alert"'));
  assert.equal(html(React.createElement(InlineError, { message: '' })), '');
  assert.ok(html(React.createElement(InlineError, { message: 'PINs do not match.' })).includes('PINs do not match.'));
});

// ───────────────────────── 7. Error boundary ─────────────────────────
console.log('\n--- 7. Error boundary ---');
test('ErrorBoundary: never renders the thrown error text', () => {
  const secret = "TypeError: Cannot read properties of undefined (reading 'firestore') at /src/lib/store.ts:42";
  const boundary: any = new ErrorBoundary({ children: null });
  boundary.state = { hasError: true, error: new TypeError(secret) };
  const out = html(boundary.render(), false);
  assert.ok(!out.includes('TypeError') && !out.includes('store.ts') && !out.includes('firestore'));
  assert.ok(out.includes('Oops! Something Went Wrong'));
  assert.ok(out.includes('Try Again') || out.includes('Reload'));
});
test('ErrorBoundary: classifies connectivity failures as offline-style states', () => {
  const boundary: any = new ErrorBoundary({ children: null });
  boundary.state = { hasError: true, error: new TypeError('Failed to fetch') };
  const out = html(boundary.render(), false);
  assert.ok(out.includes('data-error-kind="connection-lost"'));
});
test('ErrorBoundary: passes children through when healthy and honours custom fallback', () => {
  const ok: any = new ErrorBoundary({ children: React.createElement('p', null, 'fine') });
  assert.ok(html(ok.render(), false).includes('fine'));
  const custom: any = new ErrorBoundary({ children: null, fallback: React.createElement('i', null, 'custom') });
  custom.state = { hasError: true, error: new Error('x') };
  assert.ok(html(custom.render(), false).includes('custom'));
});

// ───────────────────────── 8. Contrast of real design tokens ─────────────────────────
console.log('\n--- 8. Contrast (WCAG) of the real design tokens ---');
function lum(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(a: string, b: string) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
const css = read('src/index.css');
const token = (name: string, scope: 'light' | 'dark') => {
  const blocks =
    scope === 'light'
      ? [...(css.match(/:root\s*\{[^}]*\}/g) || []), ...(css.match(/@theme\s*\{[^}]*\}/g) || [])]
      : [...(css.match(/html\.dark\s*\{[^}]*\}/g) || []), ...(css.match(/@theme\s*\{[^}]*\}/g) || [])];
  const block = blocks.join('\n');
  const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `token ${name} (${scope}) not found`);
  return m![1];
};
test('contrast: title (cream) on panel >= 4.5 in light and dark', () => {
  assert.ok(ratio(token('--color-cream', 'light'), token('--color-panel', 'light')) >= 4.5);
  assert.ok(ratio(token('--color-cream', 'dark'), token('--color-panel', 'dark')) >= 4.5);
});
test('contrast: message text (cream-dim) on panel >= 4.5 in light and dark', () => {
  assert.ok(ratio(token('--color-cream-dim', 'light'), token('--color-panel', 'light')) >= 4.5);
  assert.ok(ratio(token('--color-cream-dim', 'dark'), token('--color-panel', 'dark')) >= 4.5);
});
test('contrast: white label on emerald primary button >= 4.5', () => {
  assert.ok(ratio('#FFFFFF', token('--color-emerald', 'light')) >= 4.5);
});
test('contrast: glyph colours (emerald light / cream dark) >= 3:1 against their page background', () => {
  assert.ok(ratio(token('--color-emerald', 'light'), token('--color-ink', 'light')) >= 3);
  assert.ok(ratio(token('--color-cream', 'dark'), token('--color-ink', 'dark')) >= 3);
});
test('contrast: inline error text >= 4.5 in light and dark', () => {
  assert.ok(ratio('#c8102e', token('--color-panel', 'light')) >= 4.5, 'light --text-danger');
  assert.ok(ratio('#ff8a9b', token('--color-panel', 'dark')) >= 4.5, 'dark inline error colour');
});

// ───────────────────────── 9. Source integration checks ─────────────────────────
console.log('\n--- 9. Integration (source-level) ---');

test('integration: ErrorBoundary no longer renders error.message', () => {
  const src = read('src/components/ErrorBoundary.tsx');
  assert.ok(!/\{this\.state\.error\?\.message/.test(src), 'raw message still rendered');
  assert.ok(src.includes('ErrorState'));
  assert.ok(src.includes('reportError'));
});
test('integration: NotFound page uses the shared ErrorState', () => {
  const src = read('src/pages/NotFound.tsx');
  assert.ok(src.includes('ErrorState') && src.includes("kind=\"not-found\""));
});
test('integration: Firebase phone-auth no longer shows project ids, console paths or provider codes', () => {
  const src = read('src/lib/firebasePhoneAuth.ts');
  assert.ok(!/Firebase Console/.test(src.replace(/\/\/.*$/gm, '')), 'console instructions still in user message');
  assert.ok(!/\[\$\{errCode\}\]|\(\$\{errCode/.test(src), 'provider code still interpolated');
  assert.ok(!/options\?\.projectId\}\\?"/.test(src.split('return { ok: false, formattedPhone, error: msg }')[0].split('catch (err')[1] || ''), 'project id interpolated into message');
});
test('integration: server error responses no longer echo raw exception text', () => {
  for (const f of ['server.ts', 'api/admin.ts']) {
    const src = read(f);
    assert.ok(!/error:\s*err\??\.message\s*\|\|/.test(src), `${f} still echoes err.message with ||`);
  }
});
test('integration: token spend/unlock responses are mapped before leaving the server', () => {
  const src = read('src/lib/serverTokenEconomy.ts');
  assert.ok(src.includes('clientSafeServerMessage'), 'HTTP boundary not sanitised');
});
test('integration: toasts of type error pass through the sanitiser', () => {
  const src = read('src/lib/notificationStore.ts');
  assert.ok(src.includes('sanitizeUserMessage'));
});
test('integration: Room and FreeMatchRoom use ErrorState content-unavailable for missing rooms/matches', () => {
  const roomSrc = read('src/pages/Room.tsx');
  const freeMatchSrc = read('src/pages/FreeMatchRoom.tsx');
  assert.ok(roomSrc.includes('kind="content-unavailable"'), 'Room.tsx missing content-unavailable ErrorState');
  assert.ok(freeMatchSrc.includes('kind="content-unavailable"'), 'FreeMatchRoom.tsx missing content-unavailable ErrorState');
});
test('integration: PayGate and PremiumPaywall sanitise payment/subscription errors', () => {
  const payGateSrc = read('src/components/PayGate.tsx');
  const paywallSrc = read('src/components/subscription/PremiumPaywall.tsx');
  assert.ok(payGateSrc.includes('InlineError'), 'PayGate.tsx missing InlineError');
  assert.ok(paywallSrc.includes('sanitizeUserMessage'), 'PremiumPaywall.tsx missing sanitizeUserMessage');
});
test('integration: store.ts and subscriptionStore.ts map payment/token network errors safely', () => {
  const storeSrc = read('src/lib/store.ts');
  const subSrc = read('src/lib/subscriptionStore.ts');
  assert.ok(storeSrc.includes('sanitizeUserMessage') && storeSrc.includes('toUserError'), 'store.ts missing error sanitisation');
  assert.ok(subSrc.includes('sanitizeUserMessage') && subSrc.includes('toUserError'), 'subscriptionStore.ts missing error sanitisation');
});
test('integration: carouselStorageService and engagementService do not leak raw err.message to UI', () => {
  const carouselSrc = read('src/lib/carouselStorageService.ts');
  const engageSrc = read('src/lib/engagementService.ts');
  assert.ok(!carouselSrc.includes('serverErr?.message'), 'carouselStorageService.ts still interpolates serverErr.message');
  assert.ok(!/error:\s*err\??\.message\s*\|\|/.test(engageSrc), 'engagementService.ts still returns raw err.message');
});

// ───────────────────────── Summary ─────────────────────────
console.error = realConsoleError;
console.log(`\nResults: ${passed}/${passed + failed} tests passed.`);
if (failed > 0) {
  console.log('FAILED:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('ALL ERROR-SYSTEM CHECKS PASSED');
process.exit(0);

