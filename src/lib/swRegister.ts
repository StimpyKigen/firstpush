/**
 * Progressive Web App (PWA) Service Worker Registration, Automatic Update Detection,
 * Safe Activation, State Preservation, and Install Prompt Manager.
 */

export interface PwaUpdateDiagnostics {
  currentVersion: string | null;
  latestDetectedVersion: string | null;
  lastUpdateCheckAt: string | null;
  updateAvailable: boolean;
  waitingWorkerPresent: boolean;
  controllerPresent: boolean;
  checkCount: number;
}

const CLIENT_VERSION_STORAGE_KEY = 'mshindi_client_app_version_v1';
const LAST_RELOAD_VERSION_KEY = 'mshindi_pwa_last_reload_version_v1';
const LAST_RELOAD_TS_KEY = 'mshindi_pwa_last_reload_ts_v1';
const PRESERVED_STATE_KEY = 'mshindi_pwa_preserved_state_v1';
export const SKIP_PWA_SPLASH_KEY = 'mshindi_skip_pwa_splash';
export const CHUNK_RECOVERY_TS_KEY = 'mshindi_chunk_recovery_ts_v1';

const MIN_CHECK_INTERVAL_MS = 25_000; // Minimum 25s between foreground/visibility checks
const PERIODIC_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes during active sessions
const RELOAD_COOLDOWN_MS = 15_000; // Prevent reload loops within 15s

let deferredPrompt: any = null;
let swRegistration: ServiceWorkerRegistration | null = null;
let isRefreshing = false;
let lastUpdateCheckMs = 0;
let updateBannerElement: HTMLElement | null = null;
let idleActivationTimer: ReturnType<typeof setInterval> | null = null;

const diagnostics: PwaUpdateDiagnostics = {
  currentVersion: null,
  latestDetectedVersion: null,
  lastUpdateCheckAt: null,
  updateAvailable: false,
  waitingWorkerPresent: false,
  controllerPresent: false,
  checkCount: 0,
};

const updateChannel =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mshindi_pwa_update_sync') : null;

export function getPwaUpdateDiagnostics(): PwaUpdateDiagnostics {
  return {
    ...diagnostics,
    controllerPresent: Boolean(
      typeof navigator !== 'undefined' &&
        'serviceWorker' in navigator &&
        navigator.serviceWorker.controller
    ),
    waitingWorkerPresent: Boolean(swRegistration?.waiting),
  };
}

/**
 * Determines whether the user is actively performing a critical action that must not be interrupted
 * by an immediate page reload (e.g., typing in a form/comment, watching a playing video, open modal/bet slip checkout).
 */
export function isUserBusyWithCriticalAction(): boolean {
  if (typeof document === 'undefined') return false;

  // 1. Check if user is focused on an input, textarea, select, or contenteditable element
  const activeEl = document.activeElement as HTMLElement | null;
  if (activeEl) {
    const tag = activeEl.tagName?.toLowerCase();
    if (tag === 'textarea' || tag === 'select' || activeEl.isContentEditable) {
      return true;
    }
    if (tag === 'input') {
      const inputEl = activeEl as HTMLInputElement;
      const type = (inputEl.type || 'text').toLowerCase();
      // If user has typed text or is in a credential/number/amount field, do not interrupt
      if (['password', 'tel', 'number', 'email'].includes(type) || (inputEl.value && inputEl.value.trim().length > 0)) {
        return true;
      }
    }
  }

  // 2. Check if any video or audio element is actively playing
  const mediaElements = document.querySelectorAll('video, audio');
  for (let i = 0; i < mediaElements.length; i++) {
    const media = mediaElements[i] as HTMLMediaElement;
    if (!media.paused && !media.ended && media.readyState > 2) {
      return true;
    }
  }

  // 3. Check if an explicit critical modal / bet submission dialog is open
  if (document.querySelector('[data-critical-activity="true"], [aria-modal="true"]')) {
    return true;
  }

  return false;
}

/**
 * Preserves navigation and scroll state in sessionStorage right before applying an update reload.
 */
function saveSessionStateBeforeUpdate(): void {
  if (typeof window === 'undefined') return;
  try {
    const state = {
      path: window.location.pathname + window.location.search + window.location.hash,
      scrollY: window.scrollY || 0,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(PRESERVED_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Restores preserved scroll position after an automatic update reload completes.
 */
export function restoreSessionStateAfterUpdate(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(PRESERVED_STATE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PRESERVED_STATE_KEY);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.scrollY !== 'number') return;
    if (Date.now() - (parsed.savedAt || 0) > 30_000) return;

    if (parsed.scrollY > 0) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.scrollTo({ top: parsed.scrollY, behavior: 'instant' as ScrollBehavior });
        }, 120);
      });
    }
  } catch {
    // Ignore parse errors
  }
}

/**
 * Checks whether a reload is safe (prevents infinite reload loops).
 */
function canSafelyReloadForVersion(targetVersion?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  if (isRefreshing) return false;

  try {
    const lastTs = Number(sessionStorage.getItem(LAST_RELOAD_TS_KEY) || '0');
    if (Date.now() - lastTs < RELOAD_COOLDOWN_MS) {
      return false;
    }
    if (targetVersion) {
      const lastReloadedVersion = sessionStorage.getItem(LAST_RELOAD_VERSION_KEY);
      if (lastReloadedVersion === targetVersion && Date.now() - lastTs < 60_000) {
        return false;
      }
    }
  } catch {
    // Ignore sessionStorage restrictions
  }
  return true;
}

/**
 * Performs a controlled reload after recording anti-loop metadata and preserving UI state.
 */
function performControlledReload(targetVersion?: string | null): void {
  if (!canSafelyReloadForVersion(targetVersion)) return;
  isRefreshing = true;

  try {
    sessionStorage.setItem(SKIP_PWA_SPLASH_KEY, '1');
    sessionStorage.setItem(LAST_RELOAD_TS_KEY, String(Date.now()));
    if (targetVersion) {
      sessionStorage.setItem(LAST_RELOAD_VERSION_KEY, targetVersion);
      localStorage.setItem(CLIENT_VERSION_STORAGE_KEY, targetVersion);
    }
  } catch {
    // Ignore storage errors
  }

  saveSessionStateBeforeUpdate();
  dismissUpdateBanner();

  try {
    updateChannel?.postMessage({
      type: 'RELOAD_APPLIED',
      version: targetVersion || diagnostics.latestDetectedVersion,
    });
  } catch {}

  window.location.reload();
}

function dismissUpdateBanner(): void {
  if (idleActivationTimer) {
    clearInterval(idleActivationTimer);
    idleActivationTimer = null;
  }
  if (updateBannerElement && updateBannerElement.parentNode) {
    updateBannerElement.parentNode.removeChild(updateBannerElement);
    updateBannerElement = null;
  }
}

/**
 * Renders a subtle, non-intrusive floating update banner when the user is busy with an activity,
 * allowing them to tap to update immediately or auto-applying once they become idle.
 */
function showSubtleUpdateBanner(onApply: () => void): void {
  if (typeof document === 'undefined' || updateBannerElement) return;

  const banner = document.createElement('div');
  banner.setAttribute('id', 'mshindi-pwa-update-banner');
  banner.style.cssText = [
    'position: fixed',
    'bottom: 76px',
    'left: 50%',
    'transform: translateX(-50%)',
    'z-index: 9999',
    'display: flex',
    'align-items: center',
    'gap: 10px',
    'padding: 10px 16px',
    'border-radius: 9999px',
    'background: rgba(15, 23, 42, 0.96)',
    'border: 1px solid rgba(16, 185, 129, 0.45)',
    'box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5)',
    'color: #f8fafc',
    'font-family: system-ui, -apple-system, sans-serif',
    'font-size: 13px',
    'font-weight: 500',
    'backdrop-filter: blur(8px)',
  ].join(';');

  const dot = document.createElement('span');
  dot.style.cssText =
    'width: 8px; height: 8px; border-radius: 50%; background: #10b981; flex-shrink: 0;';

  const label = document.createElement('span');
  label.textContent = 'New MshindiRoom update ready';

  const actionBtn = document.createElement('button');
  actionBtn.type = 'button';
  actionBtn.textContent = 'Update Now';
  actionBtn.style.cssText = [
    'background: #10b981',
    'color: #022c22',
    'border: none',
    'border-radius: 9999px',
    'padding: 4px 12px',
    'font-size: 12px',
    'font-weight: 700',
    'cursor: pointer',
  ].join(';');

  actionBtn.addEventListener('click', () => {
    dismissUpdateBanner();
    onApply();
  });

  banner.appendChild(dot);
  banner.appendChild(label);
  banner.appendChild(actionBtn);
  document.body.appendChild(banner);
  updateBannerElement = banner;

  // Poll every 3 seconds so that as soon as the user finishes typing/watching video, it applies automatically
  idleActivationTimer = setInterval(() => {
    if (!isUserBusyWithCriticalAction()) {
      dismissUpdateBanner();
      onApply();
    }
  }, 3000);
}

/**
 * Triggers activation of a waiting Service Worker or applies a detected version update safely.
 */
function activateUpdateSafely(
  registration: ServiceWorkerRegistration | null,
  onUpdateCallback?: () => void,
  targetVersion?: string | null
): void {
  diagnostics.updateAvailable = true;
  diagnostics.waitingWorkerPresent = Boolean(registration?.waiting);
  if (onUpdateCallback) {
    try {
      onUpdateCallback();
    } catch {}
  }

  const executeActivation = () => {
    const waiting = registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
      // Fallback reload if controllerchange does not fire within 1.5s
      setTimeout(() => {
        performControlledReload(targetVersion || diagnostics.latestDetectedVersion);
      }, 1500);
    } else {
      performControlledReload(targetVersion || diagnostics.latestDetectedVersion);
    }
  };

  if (isUserBusyWithCriticalAction()) {
    showSubtleUpdateBanner(executeActivation);
  } else {
    executeActivation();
  }
}

/**
 * Fetches `/version.json` bypassing all HTTP and SW caches to verify whether a new deployment
 * has been published on Vercel/production (essential for iOS standalone PWAs and fast resume).
 */
async function checkVersionManifest(
  registration: ServiceWorkerRegistration | null,
  onUpdateCallback?: () => void
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;

  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) return false;

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) return false;

    const data = await res.json();
    const remoteVersion = typeof data?.version === 'string' ? data.version.trim() : '';
    if (!remoteVersion) return false;

    diagnostics.latestDetectedVersion = remoteVersion;

    const storedVersion = localStorage.getItem(CLIENT_VERSION_STORAGE_KEY);
    if (!storedVersion) {
      diagnostics.currentVersion = remoteVersion;
      localStorage.setItem(CLIENT_VERSION_STORAGE_KEY, remoteVersion);
      return false;
    }

    diagnostics.currentVersion = storedVersion;

    if (remoteVersion !== storedVersion) {
      // A newer build version is live on the server!
      if (registration) {
        try {
          await registration.update();
        } catch {}
      }

      // If a waiting worker is now ready, activate it through the controlled lifecycle;
      // otherwise clear outdated caches and transition to the new version cleanly.
      if (registration?.waiting) {
        activateUpdateSafely(registration, onUpdateCallback, remoteVersion);
      } else {
        // Clear old caches before reloading so the fresh assets & index.html are guaranteed
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(
              keys
                .filter((k) => k.startsWith('mshindiroom-') && !k.endsWith(remoteVersion))
                .map((k) => caches.delete(k))
            );
          } catch {}
        }
        activateUpdateSafely(registration, onUpdateCallback, remoteVersion);
      }
      return true;
    }
  } catch {
    // Offline or network hiccup — ignore quietly
  }
  return false;
}

/**
 * Actively checks both the Service Worker registration and `/version.json` for new deployments.
 */
export async function checkForAppUpdate(
  reason: 'launch' | 'visibilitychange' | 'online' | 'periodic' | 'manual' = 'manual',
  onUpdateCallback?: () => void
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;

  const now = Date.now();
  if (reason !== 'manual' && reason !== 'online' && now - lastUpdateCheckMs < MIN_CHECK_INTERVAL_MS) {
    return false;
  }
  lastUpdateCheckMs = now;
  diagnostics.lastUpdateCheckAt = new Date(now).toISOString();
  diagnostics.checkCount += 1;

  // 1. If a waiting Service Worker is already sitting in `waiting`, activate it safely
  if (swRegistration?.waiting && navigator.serviceWorker?.controller) {
    activateUpdateSafely(swRegistration, onUpdateCallback, diagnostics.latestDetectedVersion);
    return true;
  }

  // 2. Ask browser to check `/sw.js` byte-for-byte with `updateViaCache: 'none'`
  if (swRegistration) {
    try {
      await swRegistration.update();
      if (swRegistration.waiting && navigator.serviceWorker?.controller) {
        activateUpdateSafely(swRegistration, onUpdateCallback, diagnostics.latestDetectedVersion);
        return true;
      }
    } catch {
      // Transient network error during SW check
    }
  }

  // 3. Verify `/version.json` for deterministic deployment detection (especially on iOS Safari PWA)
  return checkVersionManifest(swRegistration, onUpdateCallback);
}

/**
 * Triggers an immediate splash-free cache-clearing reload when a lazy route chunk is missing
 * after a new deployment, guarded against infinite loops (max once every 8 seconds).
 */
export function triggerStaleChunkRecovery(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const lastRecovery = Number(sessionStorage.getItem(CHUNK_RECOVERY_TS_KEY) || '0');
    if (Date.now() - lastRecovery < 8_000) {
      return false;
    }
    sessionStorage.setItem(CHUNK_RECOVERY_TS_KEY, String(Date.now()));
  } catch {
    // Ignore sessionStorage restrictions
  }
  void hardRefreshPwa();
  return true;
}

/**
 * Attaches global handlers to recover automatically if a deployment removes a lazy-loaded chunk
 * while an older session tries to dynamically import it.
 */
function installChunkErrorRecovery(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('vite:preloadError', () => {
    // Do NOT call event.preventDefault() blindly without recovering, because Vite resolves
    // prevented preload errors with `undefined`, causing React.lazy (`j._result.default`) to crash.
    triggerStaleChunkRecovery();
  });

  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event?.reason?.message || event?.reason || '');
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('_result.default')
    ) {
      triggerStaleChunkRecovery();
    }
  });
}

export interface SwRegistrationCallbacks {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
}

export function registerServiceWorker(
  configOrOnUpdate?: (() => void) | SwRegistrationCallbacks
) {
  if (typeof window === 'undefined') return;

  const onUpdate =
    typeof configOrOnUpdate === 'function'
      ? configOrOnUpdate
      : configOrOnUpdate?.onUpdate
      ? () => {
          if (swRegistration && configOrOnUpdate.onUpdate) {
            configOrOnUpdate.onUpdate(swRegistration);
          }
        }
      : undefined;

  const onSuccess =
    typeof configOrOnUpdate === 'object' && configOrOnUpdate !== null
      ? configOrOnUpdate.onSuccess
      : undefined;

  // Restore any preserved scroll position if we just reloaded for an update
  restoreSessionStateAfterUpdate();
  installChunkErrorRecovery();

  if (!('serviceWorker' in navigator)) return;

  // When the new Service Worker takes control via clients.claim(), reload cleanly once
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    performControlledReload(diagnostics.latestDetectedVersion);
  });

  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'SW_ACTIVATED' && typeof data.version === 'string') {
      diagnostics.latestDetectedVersion = data.version;
      try {
        localStorage.setItem(CLIENT_VERSION_STORAGE_KEY, data.version);
      } catch {}
    }
  });

  const performRegistration = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      swRegistration = registration;
      diagnostics.controllerPresent = Boolean(navigator.serviceWorker.controller);

      // If a waiting Service Worker is already present on load
      if (registration.waiting && navigator.serviceWorker.controller) {
        activateUpdateSafely(registration, onUpdate, diagnostics.latestDetectedVersion);
      }

      // Listen for newly discovered Service Worker installations
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            // Only treat as an update if there was already an active controller (not initial install)
            if (navigator.serviceWorker.controller) {
              activateUpdateSafely(registration, onUpdate, diagnostics.latestDetectedVersion);
            } else if (onSuccess) {
              try {
                onSuccess(registration);
              } catch {}
            }
          }
        });
      });

      // A. Application Launch Update Check (non-blocking after initial render)
      setTimeout(() => {
        void checkForAppUpdate('launch', onUpdate);
      }, 1500);
    } catch (error) {
      console.warn('[Mshindi PWA] ServiceWorker registration notice:', error);
    }
  };

  if (document.readyState === 'complete') {
    void performRegistration();
  } else {
    window.addEventListener('load', () => {
      void performRegistration();
    });
  }

  // B. Application Visibility Update Check (when user brings installed PWA to foreground)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void checkForAppUpdate('visibilitychange', onUpdate);
      }
    });
  }

  // C. Network Reconnection Update Check
  window.addEventListener('online', () => {
    void checkForAppUpdate('online', onUpdate);
  });

  // D. Extended Session Periodic Update Check (every 5 minutes while visible)
  setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      void checkForAppUpdate('periodic', onUpdate);
    }
  }, PERIODIC_CHECK_INTERVAL_MS);

  // Capture Android/Desktop native install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-installed'));
  });
}

export function canInstallPWA(): boolean {
  return Boolean(deferredPrompt);
}

export async function promptInstallPWA(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    deferredPrompt = null;
    return true;
  }
  return false;
}

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * User-initiated hard refresh for the installed PWA.
 * Purges runtime/shell Cache Storage, checks/activates any waiting Service Worker,
 * sets `mshindi_skip_pwa_splash = '1'` so the 8s green loading screen is skipped,
 * preserves current scroll/navigation state, and reloads the app immediately.
 */
export async function hardRefreshPwa(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(SKIP_PWA_SPLASH_KEY, '1');
    sessionStorage.setItem(LAST_RELOAD_TS_KEY, String(Date.now()));
  } catch {
    // Ignore sessionStorage restrictions
  }

  saveSessionStateBeforeUpdate();
  dismissUpdateBanner();

  // 1. Check Service Worker registration & activate any waiting worker
  try {
    const reg =
      swRegistration ||
      ('serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined);
    if (reg) {
      await reg.update().catch(() => {});
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  } catch {
    // Ignore SW errors during manual refresh
  }

  // 2. Purge Cache Storage so fresh bundles and data are fetched cleanly
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      // Ignore cache deletion errors
    }
  }

  window.location.reload();
}
