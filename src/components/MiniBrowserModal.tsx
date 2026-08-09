import { useState } from 'react';
import {
  X, ExternalLink, RefreshCw, Lock, Copy, Check, AlertCircle,
} from 'lucide-react';
import { motion } from 'motion/react';

interface MiniBrowserModalProps {
  url: string;
  title?: string;
  bookmaker?: string;
  onClose: () => void;
}

export default function MiniBrowserModal({
  url,
  bookmaker = 'Sportsbook',
  onClose,
}: MiniBrowserModalProps) {
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [key, setKey] = useState(0);

  function handleReload() {
    setLoading(true);
    setKey((prev) => prev + 1);
  }

  function handleCopy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18 }}
        className="relative z-10 bg-[#12161f] border border-line/80 rounded-2xl w-full max-w-2xl h-[460px] sm:h-[500px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Compact Top Window Bar */}
        <div className="bg-[#1a202c] border-b border-line px-3 py-2 flex items-center justify-between gap-2 shrink-0">
          {/* Window control dots */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-[#ff5f56] hover:opacity-80 transition-opacity flex items-center justify-center group"
              title="Close window"
            >
              <X size={8} className="opacity-0 group-hover:opacity-100 text-black font-bold" />
            </button>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
          </div>

          {/* Minimal URL Address Bar */}
          <div className="flex-1 flex items-center gap-1.5 bg-ink border border-line/80 rounded-lg px-2.5 py-1 text-xs min-w-0">
            <Lock size={11} className="text-emerald-2 shrink-0" />
            <span className="flex-1 text-cream-dim truncate font-mono text-[11px] select-all">
              {url}
            </span>
            <button
              onClick={handleCopy}
              className="p-1 text-cream-dim hover:text-gold transition-colors shrink-0"
              title="Copy link"
            >
              {copied ? <Check size={12} className="text-emerald-2" /> : <Copy size={12} />}
            </button>
            <button
              onClick={handleReload}
              className="p-1 text-cream-dim hover:text-cream transition-colors shrink-0"
              title="Reload page"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin text-gold' : ''} />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 bg-gold/10 hover:bg-gold/20 border border-gold/30 text-gold text-[11px] font-bold px-2 py-1 rounded-lg transition-colors"
              title="Open full site in tab"
            >
              <ExternalLink size={11} />
              <span className="hidden sm:inline">Open Tab</span>
            </a>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-cream-dim hover:text-cream hover:bg-panel transition-colors"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Main Viewport */}
        <div className="relative flex-1 bg-ink w-full h-full overflow-hidden">
          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-ink/90 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
              <RefreshCw size={22} className="animate-spin text-gold" />
              <p className="text-xs text-cream font-medium">Loading {bookmaker}...</p>
            </div>
          )}

          {/* Iframe Viewport */}
          <iframe
            key={key}
            src={url}
            title={`${bookmaker} Preview`}
            className="w-full h-full border-0 bg-white"
            onLoad={() => setLoading(false)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />

          {/* Ultra-compact bottom floating bar */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 bg-[#161a23]/90 backdrop-blur-sm border border-line rounded-full px-3 py-1 flex items-center gap-2 shadow-lg max-w-[95%]">
            <AlertCircle size={12} className="text-gold shrink-0" />
            <span className="text-[11px] text-cream-dim truncate">
              <span className="hidden sm:inline">If page is restricted by site, </span>
              <a href={url} target="_blank" rel="noreferrer" className="text-gold font-bold hover:underline">
                Open in Browser <ExternalLink size={10} className="inline ml-0.5" />
              </a>
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
