import { Link } from 'react-router-dom';
import { Instagram, Facebook, Smartphone } from 'lucide-react';

export default function Footer() {
  function handleTriggerInstall() {
    localStorage.removeItem('mshindi_pwa_dismissed_at');
    window.location.reload();
  }

  return (
    <footer className="border-t border-[#E6E6D2] bg-[#FFFFF0] text-[#5d6c7b] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#E6E6D2]">
          {/* Brand Col */}
          <div className="space-y-3">
            <Link to="/" className="inline-block" aria-label="MshindiRoom">
              <span className="font-display font-bold text-2xl tracking-tight text-[#0a1317] flex items-center">
                Mshindi<span className="text-[#006C54]">.</span>
                <span className="ml-2 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#006C54] text-[#FFD700]">Room</span>
              </span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              Kenya's premier jackpot crowd consensus and sports analytics community. Powered by verified punters.
            </p>
            <button
              onClick={handleTriggerInstall}
              className="inline-flex items-center gap-2 bg-[#FFFFF0] hover:bg-[#F5F5E4] border-2 border-[#0a1317] text-[#0a1317] text-sm font-bold px-5 py-2 rounded-full active:scale-95 transition-colors"
              title="Install MshindiRoom App on Mobile or Desktop"
            >
              <Smartphone size={13} className="text-[#006C54]" />
              <span>Install App</span>
            </button>
          </div>

          {/* Quick Links Col 1 */}
          <div className="space-y-2.5 text-xs">
            <p className="font-bold text-[#1c1e21] text-sm">Consensus & Matches</p>
            <ul className="space-y-2">
              <li><Link to="/" className="hover:text-[#006C54] transition-colors">Jackpot Rooms</Link></li>
              <li><Link to="/free" className="hover:text-[#006C54] transition-colors">Free Match Slate</Link></li>
              <li><Link to="/slips" className="hover:text-[#006C54] transition-colors">Punter Slips Feed</Link></li>
              <li><Link to="/leaderboard" className="hover:text-[#006C54] transition-colors">Top Punter Rankings</Link></li>
              <li><Link to="/p2p" className="hover:text-[#006C54] transition-colors">P2P Challenges</Link></li>
            </ul>
          </div>

          {/* Legal Links Col 2 (As modeled in the reference) */}
          <div className="space-y-2.5 text-xs">
            <p className="font-bold text-[#1c1e21] text-sm">Policies &amp; Legal</p>
            <ul className="space-y-2">
              <li><Link to="/terms" className="hover:text-[#006C54] transition-colors">Terms of Use</Link></li>
              <li><Link to="/privacy" className="hover:text-[#006C54] transition-colors">Privacy Policy</Link></li>
              <li><Link to="/how-it-works" className="hover:text-[#006C54] transition-colors">How Consensus Works</Link></li>
              <li><a href="mailto:support@mshindi.co.ke" className="hover:text-[#006C54] transition-colors">Interest-Based Ads &amp; Inquiries</a></li>
              <li><span className="text-slate-400">Responsible Gaming (18+)</span></li>
            </ul>
          </div>

          {/* Social Links Col */}
          <div className="space-y-3">
            <p className="font-bold text-[#1c1e21] text-sm">Follow Mshindi</p>
            <div className="flex items-center gap-2">
              {/* Instagram */}
              <a
                href="https://www.instagram.com/mshindiroom?igsh=MWhxZ3B0c2UweWswaw%3D%3D&utm_source=qr"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white hover:bg-[#006C54] hover:text-white border border-slate-300 text-slate-700 active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-xs"
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
                className="w-9 h-9 rounded-full bg-white hover:bg-[#006C54] hover:text-white border border-slate-300 text-slate-700 active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-xs"
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
                className="w-9 h-9 rounded-full bg-[#FFFFF0] hover:bg-[#006C54] hover:text-white border border-[#D4D4C0] text-slate-700 active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-xs"
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
                className="w-9 h-9 rounded-full bg-[#FFFFF0] hover:bg-[#006C54] hover:text-white border border-[#D4D4C0] text-slate-700 active:scale-95 transition-all flex items-center justify-center shrink-0 shadow-xs"
                title="Follow @mshindiroom on Facebook"
                aria-label="Facebook"
              >
                <Facebook size={15} />
              </a>
            </div>
            <p className="text-[11px] text-slate-400">
              MshindiRoom is a community consensus platform. Not a bookmaker. 18+.
            </p>
          </div>
        </div>

        {/* Bottom Copyright matching reference footer */}
        <div className="pt-6 text-center text-xs text-slate-400">
          <p>© 2026 MshindiRoom Enterprises, Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
