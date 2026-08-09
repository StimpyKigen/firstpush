import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker } from './lib/swRegister';

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
