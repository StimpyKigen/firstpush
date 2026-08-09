import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';

export default function OfflineBar() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3500);
      return () => clearTimeout(timer);
    }

    function handleOffline() {
      setIsOffline(true);
      setShowRestored(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showRestored) return null;

  return (
    <div
      id="pwa-offline-bar"
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-xs font-bold flex items-center justify-between transition-all duration-300 shadow-lg ${
        isOffline
          ? 'bg-amber-600 text-ink-2 border-b border-amber-500'
          : 'bg-emerald text-ink-2 border-b border-emerald-2'
      }`}
    >
      <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
        <div className="flex items-center gap-2">
          {isOffline ? (
            <>
              <WifiOff size={16} className="animate-pulse" />
              <span>You are currently offline. Viewing cached jackpot rooms & predictions.</span>
            </>
          ) : (
            <>
              <Wifi size={16} />
              <span>Internet connection restored! Back online.</span>
            </>
          )}
        </div>

        {isOffline && (
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ink-2/30 hover:bg-ink-2/50 text-cream text-[11px] font-extrabold transition-all"
          >
            <RefreshCw size={12} /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
