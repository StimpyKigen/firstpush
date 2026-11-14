import { Link } from 'react-router-dom';
import { Smartphone } from 'lucide-react';
import { Instagram, XformerlyTwitter, TikTok, Facebook } from './icons/SocialIcons';

export default function Footer() {
  function handleTriggerInstall() {
    localStorage.removeItem('mshindi_pwa_dismissed_at');
    window.location.reload();
  }

  return (
    <footer className="border-t border-[#E6E6D2] dark:border-[#414A43] bg-[#FFFFF0] dark:bg-[#202522] text-[#5d6c7b] dark:text-[#929D95] mt-0 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#E6E6D2] dark:border-[#414A43]">
          {/* Brand Col */}
          <div className="space-y-3">
            <Link to="/" className="inline-block group active:scale-95 transition-transform focus:outline-none" aria-label="MshindiRoom">
              {/* Light mode logo */}
              <img
                src="/images/logo.webp"
                alt="MshindiRoom"
                className="h-7 sm:h-7.5 w-auto object-contain shrink-0 dark:hidden"
                width="221"
                height="28"
                loading="lazy"
                decoding="async"
              />
              {/* Dark mode logo */}
              <img
                src="/images/logo-dark.webp"
                alt="MshindiRoom"
                className="h-7 sm:h-7.5 w-auto object-contain shrink-0 hidden dark:block"
                width="221"
                height="28"
                loading="lazy"
                decoding="async"
              />
            </Link>
            <p className="text-xs text-slate-500 dark:text-[#B5BDB6] leading-relaxed max-w-xs">
              Kenya's premier jackpot crowd consensus and sports analytics community. Powered by verified punters.
            </p>
            <button
              onClick={handleTriggerInstall}
              className="inline-flex items-center gap-2 bg-[#FFFFF0] dark:bg-[#2A312D] hover:bg-[#F5F5E4] dark:hover:bg-[#2F3732] border-2 border-[#0a1317] dark:border-[#414A43] text-[#0a1317] dark:text-[#F4F5EF] text-sm font-bold px-5 py-2 rounded-full active:scale-95 transition-colors cursor-pointer"
              title="Install MshindiRoom App on Mobile or Desktop"
            >
              <Smartphone size={13} className="text-[#006C54]" />
              <span>Install App</span>
            </button>
          </div>

          {/* Quick Links Col 1 */}
          <div className="space-y-2.5 text-xs">
            <p className="font-bold text-[#1c1e21] dark:text-[#F4F5EF] text-sm">Consensus & Matches</p>
            <ul className="space-y-2">
              <li><Link to="/" className="hover:text-[#EEAA04] transition-colors">Jackpot Rooms</Link></li>
              <li><Link to="/free" className="hover:text-[#EEAA04] transition-colors">Free Match Slate</Link></li>
              <li><Link to="/slips" className="hover:text-[#EEAA04] transition-colors">Punter Slips Feed</Link></li>
              <li><Link to="/leaderboard" className="hover:text-[#EEAA04] transition-colors">Top Punter Rankings</Link></li>
            </ul>
          </div>

          {/* Legal Links Col 2 */}
          <div className="space-y-2.5 text-xs">
            <p className="font-bold text-[#1c1e21] dark:text-[#F4F5EF] text-sm">Policies &amp; Legal</p>
            <ul className="space-y-2">
              <li><Link to="/terms" className="hover:text-[#EEAA04] transition-colors">Terms of Use</Link></li>
              <li><Link to="/privacy" className="hover:text-[#EEAA04] transition-colors">Privacy Policy</Link></li>
              <li><Link to="/how-it-works" className="hover:text-[#EEAA04] transition-colors">How Consensus Works</Link></li>
              <li><a href="mailto:support@mshindi.co.ke" className="hover:text-[#EEAA04] transition-colors">Contact &amp; Inquiries</a></li>
              <li><span className="text-slate-400 dark:text-[#929D95]">Responsible Gaming (18+)</span></li>
            </ul>
          </div>

          {/* Social Links Col */}
          <div className="space-y-3">
            <p className="font-bold text-[#1c1e21] dark:text-[#F4F5EF] text-sm">Follow Mshindi</p>
            <div className="flex items-center gap-3">
              {/* Instagram */}
              <a
                href="https://www.instagram.com/mshindiroom?igsh=MWhxZ3B0c2UweWswaw%3D%3D&utm_source=qr"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:opacity-80 active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                title="Follow @mshindiroom on Instagram"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>

              {/* X (Twitter) */}
              <a
                href="https://x.com/mshindiroom?s=21"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:opacity-80 active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                title="Follow @mshindiroom on X"
                aria-label="X (Twitter)"
              >
                <XformerlyTwitter className="w-4.5 h-4.5" />
              </a>

              {/* TikTok */}
              <a
                href="https://www.tiktok.com/@mshindiroom"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:opacity-80 active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                title="Follow @mshindiroom on TikTok"
                aria-label="TikTok"
              >
                <TikTok className="w-4.5 h-5" />
              </a>

              {/* Facebook */}
              <a
                href="https://www.facebook.com/share/18zCYvkaYQ/?mibextid=wwXIfr"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:opacity-80 active:scale-95 transition-all flex items-center justify-center shrink-0 cursor-pointer"
                title="Follow @mshindiroom on Facebook"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-[#929D95]">
              MshindiRoom is a community consensus platform. Not a bookmaker. 18+.
            </p>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-6 text-center text-xs text-slate-400 dark:text-[#929D95]">
          <p>© 2026 MshindiRoom Enterprises, Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
