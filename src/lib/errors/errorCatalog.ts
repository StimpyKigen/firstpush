/**
 * Central catalogue of every user-facing error state in MshindiRoom.
 *
 * Copy here is the ONLY text users see for failures. Nothing in this file may
 * contain technical detail (endpoints, collection names, provider codes, ids).
 */

export type ErrorKind =
  // Connection
  | 'offline'
  | 'connection-lost'
  | 'timeout'
  // Service
  | 'server'
  | 'maintenance'
  // Access
  | 'session-expired'
  | 'access-denied'
  | 'rate-limited'
  // Content
  | 'not-found'
  | 'content-unavailable'
  // Money
  | 'payment-failed'
  | 'payment-pending'
  | 'token-failed'
  | 'subscription-delayed'
  // Application specific
  | 'upload-failed'
  | 'file-invalid'
  | 'chat-failed'
  | 'fixtures-failed'
  | 'search-failed'
  | 'update-failed'
  | 'validation'
  // Fallback
  | 'unknown';

export type ErrorIconKey =
  | 'wifi'
  | 'server'
  | 'lock'
  | 'search'
  | 'card'
  | 'warning'
  | 'upload'
  | 'file'
  | 'chat'
  | 'calendar'
  | 'clock'
  | 'coin';

export type ErrorActionId =
  | 'retry'
  | 'home'
  | 'back'
  | 'sign-in'
  | 'support'
  | 'browse-matches'
  | 'check-payment'
  | 'check-balance'
  | 'reload';

export type ErrorSeverity = 'error' | 'warning';

export interface ErrorDefinition {
  kind: ErrorKind;
  icon: ErrorIconKey;
  severity: ErrorSeverity;
  title: string;
  message: string;
  /** Ordered: the first entry is the primary button, the rest render as quiet links. */
  actions: ErrorActionId[];
  /**
   * Whether re-running the failed operation can never duplicate money, tokens or
   * messages. Retry is only ever offered when this is true (or the caller
   * explicitly asserts the operation is idempotent).
   */
  retrySafe: boolean;
  /** Optional reassurance line shown beneath the actions. */
  footnote?: string;
}

export const ACTION_LABELS: Record<ErrorActionId, string> = {
  retry: 'Try Again',
  home: 'Go Home',
  back: 'Go Back',
  'sign-in': 'Sign In',
  support: 'Contact Support',
  'browse-matches': 'Browse Matches',
  'check-payment': 'Check Payment Status',
  'check-balance': 'Check Token Balance',
  reload: 'Reload',
};

export const SUPPORT_EMAIL = 'support@mshindi.co.ke';

export const ERROR_CATALOG: Record<ErrorKind, ErrorDefinition> = {
  // ───────────────────────────── Connection ─────────────────────────────
  offline: {
    kind: 'offline',
    icon: 'wifi',
    severity: 'error',
    title: 'No Internet Connection',
    message: "You're currently offline. Check your connection and try again.",
    actions: ['retry', 'home'],
    retrySafe: true,
  },
  'connection-lost': {
    kind: 'connection-lost',
    icon: 'wifi',
    severity: 'warning',
    title: 'Connection Interrupted',
    message: 'Your connection dropped while loading this. Check your network and try again.',
    actions: ['retry', 'home'],
    retrySafe: true,
  },
  timeout: {
    kind: 'timeout',
    icon: 'clock',
    severity: 'warning',
    title: 'Taking Too Long',
    message: 'This is taking longer than expected. Please try again in a moment.',
    actions: ['retry', 'home'],
    retrySafe: true,
  },

  // ───────────────────────────── Service ─────────────────────────────
  server: {
    kind: 'server',
    icon: 'server',
    severity: 'warning',
    title: 'Something Went Wrong',
    message: "We're having trouble loading this right now. Please try again shortly.",
    actions: ['retry', 'home'],
    retrySafe: true,
    footnote: "We'll be back soon",
  },
  maintenance: {
    kind: 'maintenance',
    icon: 'server',
    severity: 'warning',
    title: 'Back Shortly',
    message: "We're making a few improvements. Please check back in a few minutes.",
    actions: ['retry', 'home'],
    retrySafe: true,
    footnote: "We'll be back soon",
  },

  // ───────────────────────────── Access ─────────────────────────────
  'session-expired': {
    kind: 'session-expired',
    icon: 'lock',
    severity: 'warning',
    title: 'Session Expired',
    message: 'For your security, please sign in again to continue.',
    actions: ['sign-in', 'home'],
    retrySafe: false,
  },
  'access-denied': {
    kind: 'access-denied',
    icon: 'lock',
    severity: 'warning',
    title: 'Access Denied',
    message: "You're unable to access this content right now. Please sign in or check your permissions.",
    actions: ['sign-in', 'back', 'support'],
    retrySafe: false,
  },
  'rate-limited': {
    kind: 'rate-limited',
    icon: 'clock',
    severity: 'warning',
    title: 'Slow Down a Moment',
    message: "You're doing that a little too quickly. Please wait a moment and try again.",
    actions: ['retry', 'home'],
    retrySafe: true,
  },

  // ───────────────────────────── Content ─────────────────────────────
  'not-found': {
    kind: 'not-found',
    icon: 'search',
    severity: 'warning',
    title: 'Page Not Found',
    message: "We couldn't find what you're looking for. It may have been moved or removed.",
    actions: ['home', 'browse-matches'],
    retrySafe: false,
  },
  'content-unavailable': {
    kind: 'content-unavailable',
    icon: 'search',
    severity: 'warning',
    title: 'No Longer Available',
    message: 'This content is no longer available. It may have ended or been removed.',
    actions: ['browse-matches', 'home'],
    retrySafe: false,
  },

  // ───────────────────────────── Money ─────────────────────────────
  'payment-failed': {
    kind: 'payment-failed',
    icon: 'card',
    severity: 'error',
    title: 'Payment Unsuccessful',
    message: "We couldn't complete this transaction. Please check its status before trying again.",
    actions: ['check-payment', 'support'],
    retrySafe: false,
  },
  'payment-pending': {
    kind: 'payment-pending',
    icon: 'card',
    severity: 'warning',
    title: 'Confirming Your Payment',
    message:
      "We couldn't confirm this payment yet. Please check its status before trying again so you aren't charged twice.",
    actions: ['check-payment', 'support'],
    retrySafe: false,
  },
  'token-failed': {
    kind: 'token-failed',
    icon: 'coin',
    severity: 'error',
    title: 'Token Transaction Unsuccessful',
    message: "We couldn't complete this token transaction. Please check your balance before trying again.",
    actions: ['check-balance', 'support'],
    retrySafe: false,
  },
  'subscription-delayed': {
    kind: 'subscription-delayed',
    icon: 'clock',
    severity: 'warning',
    title: 'Activation Taking Longer',
    message: "Your subscription hasn't activated yet. Please check its status before trying again.",
    actions: ['check-payment', 'support'],
    retrySafe: false,
  },

  // ───────────────────────────── Application specific ─────────────────────────────
  'upload-failed': {
    kind: 'upload-failed',
    icon: 'upload',
    severity: 'error',
    title: 'Upload Unsuccessful',
    message: "We couldn't upload your file. Check your connection and try again.",
    actions: ['retry'],
    retrySafe: true,
  },
  'file-invalid': {
    kind: 'file-invalid',
    icon: 'file',
    severity: 'warning',
    title: "That File Can't Be Used",
    message: 'Please choose a supported image under the size limit and try again.',
    actions: ['retry'],
    retrySafe: true,
  },
  'chat-failed': {
    kind: 'chat-failed',
    icon: 'chat',
    severity: 'warning',
    title: 'Message Not Sent',
    message: "Your message didn't go through. Check your connection and send it again.",
    actions: ['retry'],
    // Re-sending creates a new message, so callers must opt in explicitly.
    retrySafe: false,
  },
  'fixtures-failed': {
    kind: 'fixtures-failed',
    icon: 'calendar',
    severity: 'warning',
    title: "Couldn't Load Matches",
    message: "We couldn't load the latest fixtures right now. Please try again in a moment.",
    actions: ['retry', 'home'],
    retrySafe: true,
  },
  'search-failed': {
    kind: 'search-failed',
    icon: 'search',
    severity: 'warning',
    title: 'Search Unavailable',
    message: "We couldn't complete your search right now. Please try again.",
    actions: ['retry'],
    retrySafe: true,
  },
  'update-failed': {
    kind: 'update-failed',
    icon: 'warning',
    severity: 'error',
    title: "Changes Weren't Saved",
    message: "We couldn't save your changes. Please try again.",
    actions: ['retry'],
    retrySafe: false,
  },
  validation: {
    kind: 'validation',
    icon: 'warning',
    severity: 'warning',
    title: 'Please Check Your Details',
    message: 'Some of the information provided looks incorrect. Please review it and try again.',
    actions: [],
    retrySafe: true,
  },

  // ───────────────────────────── Fallback ─────────────────────────────
  unknown: {
    kind: 'unknown',
    icon: 'warning',
    severity: 'error',
    title: 'Oops! Something Went Wrong',
    message: 'Oops! Something went wrong. Please try again in a moment.',
    actions: ['retry', 'home'],
    retrySafe: true,
  },
};

export const ALL_ERROR_KINDS = Object.keys(ERROR_CATALOG) as ErrorKind[];

/** Kinds that concern money / tokens and therefore never offer a blind retry. */
export const MONEY_ERROR_KINDS: ReadonlySet<ErrorKind> = new Set<ErrorKind>([
  'payment-failed',
  'payment-pending',
  'token-failed',
  'subscription-delayed',
]);

