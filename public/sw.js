// MshindiRoom Production Service Worker v1.0.0
const CACHE_NAME = 'mshindiroom-v1-cache';
const DATA_CACHE_NAME = 'mshindiroom-v1-data';

// Core static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/logo.png',
  '/logo.svg',
  '/pwa-192.png',
  '/pwa-512.png',
  '/pwa-maskable.png',
  '/apple-touch-icon.png',
  '/pwa-192.svg',
  '/pwa-512.svg'
];

// URLs that MUST NOT be cached offline for security
const EXCLUDED_URL_PATTERNS = [
  /\/api\/wallet/,
  /\/api\/payment/,
  /\/api\/auth/,
  /firebase/,
  /google-analytics/,
  /telemetry/
];

// Install Event - Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Mshindi PWA SW] Pre-caching App Shell');
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[Mshindi PWA SW] Pre-cache non-critical asset warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('[Mshindi PWA SW] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Intelligent Caching Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests & chrome-extension requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Check if URL is explicitly excluded (sensitive wallet/auth)
  const isExcluded = EXCLUDED_URL_PATTERNS.some((pattern) => pattern.test(url.pathname));
  if (isExcluded) {
    return; // Bypass SW, go straight to network
  }

  // 1. Navigation Requests (HTML Page load) -> Stale-while-revalidate with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline Fallback to cached index.html
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // 2. Static Assets (JS, CSS, Images, Fonts, SVGs) -> Cache First, fallback to Network
  const isStaticAsset =
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.woff2');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Revalidate in background for update
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
              }
            })
            .catch(() => {/* Silent revalidation fail */});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. General network-first strategy
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(DATA_CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Push Notification Event Handler (FCM / Web Push Ready)
self.addEventListener('push', (event) => {
  let data = { title: 'MshindiRoom Update', body: 'New jackpot room activity or consensus result!', icon: '/pwa-192.png' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Check out the latest jackpot consensus on MshindiRoom!',
    icon: data.icon || '/pwa-192.png',
    badge: '/favicon-32.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Open MshindiRoom' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'MshindiRoom', options)
  );
});

// Notification Click Listener
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
