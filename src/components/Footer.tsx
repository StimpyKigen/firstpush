import { Link } from 'react-router-dom';
import { Instagram, Facebook, Smartphone } from 'lucide-react';

export default function Footer() {
  function handleTriggerInstall() {
    localStorage.removeItem('mshindi_pwa_dismissed_at');
    window.location.reload();
  }

  return (
    <footer className="border-t border-line mt-16 bg-ink-2/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 pr-1">
            <span className="font-display font-extrabold text-cream text-base">Mshindi<span className="text-gold">Room</span></span>
          </div>

          {/* Social Links Group (Optimized for space - Icon Logos with embedded URLs) */}
          <div className="flex items-center gap-2">
            {/* Instagram */}
            <a
              href="https://www.instagram.com/mshindiroom?igsh=MWhxZ3B0c2UweWswaw%3D%3D&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600/20 via-pink-600/20 to-amber-500/20 border border-pink-500/30 text-pink-400 hover:text-white hover:bg-pink-600 hover:border-pink-500 transition-all flex items-center justify-center shrink-0"
              title="Follow @mshindiroom on Instagram"
              aria-label="Instagram"
            >
              <Instagram size={16} />
            </a>

            {/* X (Twitter) */}
            <a
              href="https://x.com/mshindiroom?s=21"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-xl bg-panel-2/80 border border-line text-cream-dim hover:text-cream hover:bg-black hover:border-cream/40 transition-all flex items-center justify-center shrink-0"
              title="Follow @mshindiroom on X"
              aria-label="X (Twitter)"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>

            {/* TikTok */}
            <a
              href="https://www.tiktok.com/@mshindiroom"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-xl bg-panel-2/80 border border-line text-cream-dim hover:text-white hover:bg-black hover:border-pink-500/50 transition-all flex items-center justify-center shrink-0"
              title="Follow @mshindiroom on TikTok"
              aria-label="TikTok"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                <path d="M12.525 2.25c.01 0 .02.001.03 0h3.587c.078 2.053 1.258 3.868 3.08 4.717.848.397 1.777.614 2.778.63v3.66c-1.391-.01-2.735-.39-3.92-1.085v6.524c0 4.414-3.578 7.992-7.992 7.992S2.096 21.121 2.096 16.707c0-4.322 3.433-7.85 7.734-7.987v3.693c-2.26.13-4.047 2.002-4.047 4.294 0 2.379 1.929 4.307 4.307 4.307 2.378 0 4.307-1.928 4.307-4.307V2.25z" />
              </svg>
            </a>

            {/* Facebook */}
            <a
              href="https://www.facebook.com/share/18zCYvkaYQ/?mibextid=wwXIfr"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-xl bg-panel-2/80 border border-line text-cream-dim hover:text-blue-400 hover:bg-blue-600/20 hover:border-blue-500/50 transition-all flex items-center justify-center shrink-0"
              title="Follow @mshindiroom on Facebook"
              aria-label="Facebook"
            >
              <Facebook size={16} />
            </a>
          </div>

          <button
            onClick={handleTriggerInstall}
            className="px-2.5 py-1.5 rounded-xl bg-gold/15 border border-gold/40 text-gold hover:bg-gold hover:text-ink-2 transition-all flex items-center gap-1.5 text-xs font-extrabold ml-1"
            title="Install MshindiRoom App on Mobile or Desktop"
          >
            <Smartphone size={14} />
            <span>Install App</span>
          </button>
        </div>

        <p className="text-xs text-cream-dim text-center max-w-md">
          MshindiRoom is a punter discussion community, not a licensed betting operator. Please gamble responsibly. 18+.
        </p>

        <nav className="flex flex-wrap justify-center gap-4 sm:gap-5 text-xs text-cream-dim font-semibold">
          <Link to="/free" className="hover:text-cream transition-colors">Free Matches</Link>
          <Link to="/p2p" className="hover:text-cream transition-colors">P2P Bets</Link>
          <Link to="/how-it-works" className="hover:text-cream transition-colors">How it works</Link>
          <Link to="/leaderboard" className="hover:text-cream transition-colors">Leaderboards</Link>
          <Link to="/privacy" className="hover:text-cream transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-cream transition-colors">Terms of Service</Link>
        </nav>
      </div>
    </footer>
  );
}
