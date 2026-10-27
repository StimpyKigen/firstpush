import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './lib/swRegister';
import { initPwaZoomPrevention } from './lib/pwaZoomPrevention';

// Lock viewport scaling: disable pinch-to-zoom (fingers) and wheel zoom (external mouse)
initPwaZoomPrevention();

// Register PWA Service Worker for offline shell caching and fast loading
registerServiceWorker({
  onSuccess: () => console.log('[Mshindi PWA] App is ready for offline usage.'),
  onUpdate: () => console.log('[Mshindi PWA] New update available.')
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
