// Service Worker Registration Engine for MshindiRoom PWA
export interface SWRegistrationCallbacks {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: any) => void;
}

export function registerServiceWorker(callbacks?: SWRegistrationCallbacks) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[Mshindi PWA] SW registered successfully with scope:', registration.scope);

          if (callbacks?.onSuccess) {
            callbacks.onSuccess(registration);
          }

          // Check for SW updates on navigation / page focus
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) return;

            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  console.log('[Mshindi PWA] New content available; update pending.');
                  if (callbacks?.onUpdate) {
                    callbacks.onUpdate(registration);
                  }
                } else {
                  console.log('[Mshindi PWA] Content is cached for offline use.');
                }
              }
            };
          };
        })
        .catch((error) => {
          console.error('[Mshindi PWA] SW registration failed:', error);
          if (callbacks?.onError) {
            callbacks.onError(error);
          }
        });
    });
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('[Mshindi PWA] SW unregister failed:', error.message);
      });
  }
}
