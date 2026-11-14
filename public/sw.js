/**
 * MshindiRoom Production Service Worker
 *
 * Implements:
 * 1. Build-stamped versioning (`BUILD_VERSION`) so every deployment triggers byte-level SW update detection.
 * 2. Controlled activation (`SKIP_WAITING` handshake) to prevent mixed old/new JS bundle crashes during active sessions.
 * 3. Complete exclusion of all `/api/*` routes, `/api/sports/stream` SSE connections, `/version.json`, `/sw.js`, and Firebase traffic.
 * 4. Network-First HTML navigation (`cache: 'no-store'`) so new deployments serve fresh `index.html` immediately when online, with offline fallback.
 * 5. Cache-First for fingerprinted `/assets/*` bundles with strict MIME-type verification (never caching `text/html` fallback responses as JS/CSS).
 * 6. Automatic purging of all outdated `mshindiroom-*` Cache Storage entries on activation.
 */

const BUILD_VERSION = '2.4.0-20261114113547-79d11c8';
const STATIC_CACHE = `mshindiroom-static-${BUILD_VERSION}`;
const IMAGE_CACHE = `mshindiroom-images-${BUILD_VERSION}`;
// Persistent version-keyed carousel binary cache managed by carouselImageCache.ts across deployments
const CAROUSEL_MEDIA_CACHE = 'mshindi-carousel-media-v1';
const VALID_CACHES = new Set([STATIC_CACHE, IMAGE_CACHE, CAROUSEL_MEDIA_CACHE]);

const SHELL_PRECACHE_ASSETS = [
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

const NEVER_INTERCEPT_PATTERNS = [
  '/api/',
  '/sw.js',
  '/version.json',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'sportscore.com',
  'google-analytics.com',
];

function shouldBypassRequest(request, url) {
  if (request.method !== 'GET') return true;
  if (!url.protocol.startsWith('http')) return true;

  // Never intercept Server-Sent Events (SSE) streams
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('text/event-stream')) return true;

  // Never intercept cross-origin requests except fonts
  if (url.origin !== self.location.origin && !url.hostname.includes('fonts.g')) {
    return true;
  }

  // Never intercept API routes, SW script, version manifest, or auth/database endpoints
  const fullPath = url.pathname + url.search;
  if (NEVER_INTERCEPT_PATTERNS.some((pattern) => fullPath.includes(pattern) || url.href.includes(pattern))) {
    return true;
  }

  return false;
}

function isHtmlResponse(response) {
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  return contentType.includes('text/html');
}

function isValidAssetResponse(requestUrl, response) {
  if (!response || !response.ok || response.status !== 200) return false;
  const pathname = requestUrl.pathname.toLowerCase();
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  // Guard against SPA fallback returning index.html (text/html) for missing .js / .css / image assets
  if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) {
    if (contentType.includes('text/html')) return false;
  }
  if (pathname.endsWith('.css')) {
    if (contentType.includes('text/html')) return false;
  }
  if (
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.gif') ||
    pathname.endsWith('.ico')
  ) {
    if (contentType.includes('text/html')) return false;
  }

  return true;
}

// 1. INSTALL: Pre-cache core shell icons & manifest; activate immediately only on first install
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        await Promise.allSettled(
          SHELL_PRECACHE_ASSETS.map((assetUrl) =>
            fetch(new Request(assetUrl, { cache: 'reload' })).then((res) => {
              if (res && res.ok && !isHtmlResponse(res)) {
                return cache.put(assetUrl, res);
              }
            })
          )
        );
      } catch (err) {
        // Non-fatal pre-cache failure
      }

      // If no Service Worker is currently controlling the app (first install), activate immediately.
      // If an older Service Worker is active, wait for controlled SKIP_WAITING signal from client update manager
      // (or activate if no active clients exist).
      if (!self.registration.active) {
        await self.skipWaiting();
      } else {
        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (allClients.length === 0) {
          await self.skipWaiting();
        }
      }
    })()
  );
});

// 2. ACTIVATE: Purge all outdated mshindiroom-* caches (including legacy v2 caches) & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((name) => {
            if (!VALID_CACHES.has(name)) {
              return caches.delete(name);
            }
            return Promise.resolve(false);
          })
        );
      } catch (err) {
        // Ignore cache cleanup errors
      }

      await self.clients.claim();

      // Notify all controlled window clients that the new Service Worker is now active
      const windowClients = await self.clients.matchAll({ type: 'window' });
      for (const client of windowClients) {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: BUILD_VERSION,
        });
      }
    })()
  );
});

// 3. MESSAGE: Support controlled activation, version inspection, and cache reset
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: BUILD_VERSION });
    } else if (event.source && typeof event.source.postMessage === 'function') {
      event.source.postMessage({ type: 'SW_VERSION', version: BUILD_VERSION });
    }
  } else if (data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ cleared: true });
        }
      })()
    );
  }
});

// 4. FETCH: Route requests to appropriate caching strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (shouldBypassRequest(request, url)) {
    return;
  }

  // A. HTML Document Navigation: Strictly Network-First (never serve stale index.html when online)
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request, { cache: 'no-store' });
          if (networkResponse && networkResponse.ok && isHtmlResponse(networkResponse)) {
            const cache = await caches.open(STATIC_CACHE);
            await cache.put('/index.html', networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const cachedHtml = (await caches.match('/index.html')) || (await caches.match('/'));
          if (cachedHtml) return cachedHtml;
          throw err;
        }
      })()
    );
    return;
  }

  // B. Fingerprinted Static Bundles (/assets/*): Cache-First with strict MIME-type validation
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        if (cached) {
          if (isValidAssetResponse(url, cached)) {
            return cached;
          }
          // Poisoned cache entry (e.g. text/html stored for .js): delete immediately
          await cache.delete(request);
        }

        const networkResponse = await fetch(request);
        if (isValidAssetResponse(url, networkResponse)) {
          await cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      })()
    );
    return;
  }

  // C. Images, Icons, Banners, and Fonts: Stale-While-Revalidate
  const isImageOrFont =
    url.pathname.startsWith('/banners/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    /\.(png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf)$/i.test(url.pathname);

  if (isImageOrFont) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE);
        const cached = await cache.match(request);

        const fetchPromise = fetch(request)
          .then(async (networkResponse) => {
            if (isValidAssetResponse(url, networkResponse)) {
              await cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null);

        if (cached && isValidAssetResponse(url, cached)) {
          return cached;
        }
        const net = await fetchPromise;
        if (net) return net;
        if (cached) return cached;
        return new Response('', { status: 404, statusText: 'Not Found' });
      })()
    );
    return;
  }
});
