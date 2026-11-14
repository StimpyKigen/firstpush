/**
 * Shared Server-Side Firebase Admin Initialization & Environment Isolation Module
 *
 * Centralizes:
 * 1. Preview vs Production service-account isolation (`FIREBASE_SERVICE_ACCOUNT_PREVIEW` vs
 *    `FIREBASE_SERVICE_ACCOUNT`). Non-production Vercel deployments can NEVER read or write
 *    Production Firebase using `FIREBASE_SERVICE_ACCOUNT`.
 * 2. Unified service-account JSON / base64 parsing and escaped private-key newline repair.
 * 3. Shared named Firebase Admin app, Firestore (`getAdminFirestore`), and Auth (`getAdminAuth`)
 *    accessors across all backend services.
 */

import crypto from 'node:crypto';

export const FIREBASE_DEFAULT_PROJECT_ID = 'mshindiroom-production';

interface CachedAdminBundle {
  app: any;
  firestore: any | null;
  auth: any | null;
  firestoreConfigured: boolean;
}

const adminBundleCache = new Map<string, CachedAdminBundle>();
let loggedPreviewIsolationNotice = false;

/**
 * Resets cached Firebase Admin bundles and test isolation flags.
 */
export function resetFirebaseAdminForTests(): void {
  adminBundleCache.clear();
  loggedPreviewIsolationNotice = false;
}

/**
 * Resolves the environment-scoped Firebase service-account credential string without
 * allowing Vercel preview deployments to access production credentials.
 */
export function resolveScopedServiceAccountRaw(): string | undefined {
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
  if (vercelEnv && vercelEnv !== 'production') {
    const previewRaw = process.env.FIREBASE_SERVICE_ACCOUNT_PREVIEW?.trim();
    if (!previewRaw && process.env.FIREBASE_SERVICE_ACCOUNT && !loggedPreviewIsolationNotice) {
      loggedPreviewIsolationNotice = true;
      console.info(
        `[FirebaseAdmin] Isolating VERCEL_ENV="${vercelEnv}" from Production FIREBASE_SERVICE_ACCOUNT (falling back to isolated local state unless FIREBASE_SERVICE_ACCOUNT_PREVIEW is configured).`
      );
    }
    return previewRaw || undefined;
  }
  return process.env.FIREBASE_SERVICE_ACCOUNT?.trim() || undefined;
}

/**
 * Parses either raw JSON or base64-encoded service account JSON, normalizing escaped `\n`
 * sequences in `private_key`. Returns `null` on missing or malformed input.
 */
export function parseServiceAccountCredentials(rawSa?: string | null): Record<string, any> | null {
  const trimmed = typeof rawSa === 'string' ? rawSa.trim() : '';
  if (!trimmed) return null;

  try {
    const jsonText = trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (err) {
    console.warn('[FirebaseAdmin] Invalid service account JSON/base64 configuration:', err);
    return null;
  }
}

/**
 * True when running in a non-Vercel Google Cloud runtime with explicit ADC metadata/project config.
 */
export function isCloudAdcConfigured(): boolean {
  const isVercelEnv = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  if (isVercelEnv) return false;
  return Boolean(
    process.env.K_SERVICE ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

/**
 * True when scoped service-account credentials or cloud ADC appear configured.
 */
export function isFirebaseAdminConfigured(): boolean {
  return Boolean(resolveScopedServiceAccountRaw() || isCloudAdcConfigured());
}

function buildScopeKeyAndAppName(
  rawSa: string | undefined,
  allowAdc: boolean
): { scopeKey: string; appName: string; isPreview: boolean; useAdc: boolean } {
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase();
  const isPreview = Boolean(vercelEnv && vercelEnv !== 'production');

  if (rawSa) {
    const digest = crypto.createHash('sha256').update(rawSa, 'utf-8').digest('hex').slice(0, 12);
    const scope = isPreview ? 'preview' : 'prod';
    return {
      scopeKey: `${scope}:${digest}`,
      appName: `mshindi-admin-${scope}-${digest}`,
      isPreview,
      useAdc: false,
    };
  }

  if (allowAdc && !isPreview && isCloudAdcConfigured()) {
    const project = (process.env.GOOGLE_CLOUD_PROJECT || FIREBASE_DEFAULT_PROJECT_ID).trim();
    return {
      scopeKey: `adc:${project}`,
      appName: `mshindi-admin-adc`,
      isPreview: false,
      useAdc: true,
    };
  }

  return {
    scopeKey: 'unconfigured',
    appName: '',
    isPreview,
    useAdc: false,
  };
}

async function resolveAdminBundle(options?: {
  allowAdc?: boolean;
}): Promise<CachedAdminBundle | null> {
  const allowAdc = options?.allowAdc ?? true;
  const rawSa = resolveScopedServiceAccountRaw();
  const { scopeKey, appName, useAdc } = buildScopeKeyAndAppName(rawSa, allowAdc);

  if (scopeKey === 'unconfigured' || !appName) {
    return null;
  }

  const cached = adminBundleCache.get(scopeKey);
  if (cached) {
    return cached;
  }

  let credentials: Record<string, any> | null = null;
  if (rawSa) {
    credentials = parseServiceAccountCredentials(rawSa);
    if (!credentials) {
      return null;
    }
  } else if (!useAdc) {
    return null;
  }

  try {
    const adminPkg = 'firebase-admin';
    const adminMod: any = await import(/* @vite-ignore */ adminPkg);
    const admin = adminMod.default || adminMod;

    const existing = Array.isArray(admin.apps)
      ? admin.apps.find((candidate: any) => candidate?.name === appName)
      : null;

    let app = existing;
    if (!app) {
      if (credentials) {
        app = admin.initializeApp(
          {
            credential: admin.credential.cert(credentials),
            projectId: credentials.project_id || FIREBASE_DEFAULT_PROJECT_ID,
          },
          appName
        );
      } else {
        app = admin.initializeApp(
          {
            projectId: process.env.GOOGLE_CLOUD_PROJECT || FIREBASE_DEFAULT_PROJECT_ID,
          },
          appName
        );
      }
    }

    const bundle: CachedAdminBundle = {
      app,
      firestore: null,
      auth: null,
      firestoreConfigured: false,
    };
    adminBundleCache.set(scopeKey, bundle);
    return bundle;
  } catch (err) {
    console.warn('[FirebaseAdmin] Failed to initialize Firebase Admin app:', err);
    return null;
  }
}

/**
 * Returns the initialized, environment-scoped Firebase Admin App or `null` if unconfigured/invalid.
 */
export async function getAdminApp(options?: { allowAdc?: boolean }): Promise<any | null> {
  const bundle = await resolveAdminBundle(options);
  return bundle?.app || null;
}

/**
 * Returns the initialized, environment-scoped Firebase Admin Firestore instance or `null`.
 */
export async function getAdminFirestore(options?: { allowAdc?: boolean }): Promise<any | null> {
  const bundle = await resolveAdminBundle(options);
  if (!bundle) return null;

  if (!bundle.firestore) {
    try {
      const adminPkg = 'firebase-admin';
      const adminMod: any = await import(/* @vite-ignore */ adminPkg);
      const admin = adminMod.default || adminMod;
      const db = admin.firestore(bundle.app);
      if (!bundle.firestoreConfigured && typeof db?.settings === 'function') {
        try {
          db.settings({ ignoreUndefinedProperties: true });
        } catch {
          // Ignore if Firestore settings were already locked for this app instance
        }
        bundle.firestoreConfigured = true;
      }
      bundle.firestore = db;
    } catch (err) {
      console.warn('[FirebaseAdmin] Could not acquire Firestore instance:', err);
      return null;
    }
  }

  return bundle.firestore;
}

/**
 * Returns the initialized, environment-scoped Firebase Admin Auth instance or `null`.
 */
export async function getAdminAuth(options?: { allowAdc?: boolean }): Promise<any | null> {
  const bundle = await resolveAdminBundle({ allowAdc: options?.allowAdc ?? false });
  if (!bundle) return null;

  if (!bundle.auth) {
    try {
      const adminPkg = 'firebase-admin';
      const adminMod: any = await import(/* @vite-ignore */ adminPkg);
      const admin = adminMod.default || adminMod;
      bundle.auth = admin.auth(bundle.app);
    } catch (err) {
      console.warn('[FirebaseAdmin] Could not acquire Auth instance:', err);
      return null;
    }
  }

  return bundle.auth;
}

