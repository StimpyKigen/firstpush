# Progressive Web App (PWA) Specification

## 1. Overview

Mshindi Projo is fully configured as a Progressive Web App (PWA) allowing mobile users in Kenya to install the platform directly to their Android or iOS home screens with offline capabilities and push alerts.

---

## 2. Web App Manifest (`/public/manifest.json`)

```json
{
  "short_name": "Mshindi Room",
  "name": "Mshindi Projo - Kenyan Jackpot Consensus & P2P Wagers",
  "icons": [
    {
      "src": "/icon-192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "/icon-512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": "/",
  "background_color": "#0b0f19",
  "theme_color": "#1fae6f",
  "display": "standalone",
  "orientation": "portrait"
}
```

---

## 3. Service Worker Strategy (`public/sw.js` & `src/lib/swRegister.ts`)

The service worker implements a **Network First with Offline Cache Fallback** caching strategy:

1. **Static Assets Cache (`mshindi-static-v1`)**: Pre-caches HTML, JS, CSS, and SVG icons on installation.
2. **Dynamic API Cache (`mshindi-data-v1`)**: Caches jackpot fixtures and consensus snapshots for offline view.
3. **Data Bandwidth Saving Rule**: Pauses heavy background polling when the browser tab is hidden or offline.

---

## 4. PWA Installation UI (`src/components/PWAInstallPrompt.tsx`)

Detects the browser `beforeinstallprompt` event on Android Chrome and displays a custom banner guiding iOS Safari users ("Tap Share -> Add to Home Screen").
