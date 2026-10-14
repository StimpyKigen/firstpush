import { Link } from 'react-router-dom';
import { Instagram, Facebook, Smartphone } from 'lucide-react';

export default function Footer() {
  function handleTriggerInstall() {
    localStorage.removeItem('mshindi_pwa_dismissed_at');
    window.location.reload();
  }

  return (
    <footer className="border-t border-white/[0.08] dark:border-white/[0.08] light:border-black/[0.06] mt-20 bg-ink-2/40 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 pr-1">
            <span className="font-display font-black text-cream text-lg tracking-tight">
              mshindi<span className="text-gold text-xl leading-none">.</span>
            </span>
          </div>

          {/* Social Links Group (iOS Rounded-Full Pills) */}
          <div className="flex items-center gap-2">
            {/* Instagram */}
            <a
              href="https://www.instagram.com/mshindiroom?igsh=MWhxZ3B0c2UweWswaw%3D%3D&utm_source=qr"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-white/6 hover:bg-white/12 border border-white/10 dark:border-white/10 light:border-black/10 text-cream-dim hover:text-pink-400 active:scale-95 transition-all flex items-center justify-center shrink-0"
              title="Follow @mshindiroom on Instagram"
              aria-label="Instagram"
            >
              <Instagram size={15} />
            </a>

            {/* X (Twitter) */}
            <a
              href="https://x.com/mshindiroom?s=21"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 rounded-full bg-white/6 hover:bg-white/12 border border-white/10 dark:border-white/10 light:border-black/10 text-cream-dim hover:text-white active:scale-95 transition-all flex items-center justify-center shrink-0"
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
              className="w-9 h-9 rounded-full bg-white/6 hover:bg-white/12 border border-white/10 dark:border-white/10 light:border-black/10 text-cream-dim hover:text-white active:scale-95 transition-all flex items-center justify-center shrink-0"
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
              className="w-9 h-9 rounded-full bg-white/6 hover:bg-white/12 border border-white/10 dark:border-white/10 light:border-black/10 text-cream-dim hover:text-blue-400 active:scale-95 transition-all flex items-center justify-center shrink-0"
              title="Follow @mshindiroom on Facebook"
              aria-label="Facebook"
            >
              <Facebook size={15} />
            </a>
          </div>

          <button
            onClick={handleTriggerInstall}
            className="ios-pill-btn bg-gold hover:bg-gold-2 text-ink text-xs px-3.5 py-1.5 shadow-sm active:scale-95"
            title="Install MshindiRoom App on Mobile or Desktop"
          >
            <Smartphone size={13} />
            <span>Install App</span>
          </button>
        </div>

        <p className="text-xs text-cream-dim/75 text-center max-w-md">
          MshindiRoom is a punter consensus community, not a licensed betting operator. Gamble responsibly. 18+.
        </p>

        <nav className="flex flex-wrap justify-center gap-4 sm:gap-6 text-xs text-cream-dim font-medium">
          <Link to="/free" className="hover:text-cream transition-colors">Free Matches</Link>
          <Link to="/p2p" className="hover:text-cream transition-colors">P2P Bets</Link>
          <Link to="/how-it-works" className="hover:text-cream transition-colors">How it works</Link>
          <Link to="/leaderboard" className="hover:text-cream transition-colors">Leaderboards</Link>
          <Link to="/privacy" className="hover:text-cream transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-cream transition-colors">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
