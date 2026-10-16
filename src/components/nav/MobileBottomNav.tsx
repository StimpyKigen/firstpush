import { Link } from 'react-router-dom';
import { Home, Unlock, Dices, Trophy, User, type LucideIcon } from 'lucide-react';
import type { Account } from '../../lib/authStore';

interface MobileBottomNavProps {
  pathname: string;
  builderLegsCount: number;
  currentUser: Account | null;
}

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  badge?: number;
}

/**
 * Floating bottom tab bar shown below `lg`.
 * The active tab's icon lifts into a green bubble set in a concave notch cut out of the bar.
 * The bar floats above the device's gesture/home indicator via the safe-area inset.
 */
export default function MobileBottomNav({ pathname, builderLegsCount, currentUser }: MobileBottomNavProps) {
  const tabs: Tab[] = [
    { to: '/', label: 'Jackpots', icon: Home, isActive: pathname === '/' },
    { to: '/free', label: 'Matches', icon: Unlock, isActive: pathname.startsWith('/free') },
    { to: '/slips', label: 'Slips', icon: Dices, isActive: pathname === '/slips', badge: builderLegsCount },
    { to: '/leaderboard', label: 'Ranks', icon: Trophy, isActive: pathname === '/leaderboard' },
    {
      to: currentUser ? '/profile' : '/auth',
      label: currentUser ? 'Profile' : 'Log In',
      icon: User,
      isActive: pathname === '/profile' || pathname === '/auth',
    },
  ];

  const activeIndex = tabs.findIndex((t) => t.isActive);
  const hasActive = activeIndex >= 0;
  const slotPct = 100 / tabs.length;
  const centerPct = (activeIndex + 0.5) * slotPct;
  const ActiveIcon = hasActive ? tabs[activeIndex].icon : null;
  const activeBadge = hasActive ? tabs[activeIndex].badge : 0;

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed left-3 right-3 z-40 select-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      {/* Drop shadow lives on the wrapper so it follows the masked (notched) bar shape */}
      <div className="relative" style={{ filter: 'drop-shadow(0 6px 16px rgba(10, 19, 23, 0.14))' }}>
        <div
          className={`mobile-nav-bar h-[66px] rounded-[26px] bg-[#FFFFF0] border border-[#E6E6D2] ${hasActive ? 'mobile-nav-notch' : ''}`}
          style={{ ['--notch-x' as string]: `${centerPct}%` }}
        >
          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  aria-current={tab.isActive ? 'page' : undefined}
                  className="relative flex flex-col items-center justify-end gap-1 pb-2.5 touch-manipulation active:scale-95 transition-transform"
                >
                  <span className="relative flex items-center justify-center h-6">
                    <Icon
                      size={22}
                      className={`transition-opacity duration-200 ${tab.isActive ? 'opacity-0' : 'text-[#5d6c7b]'}`}
                    />
                    {!tab.isActive && !!tab.badge && tab.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 bg-[#006C54] text-[#FFD700] font-bold text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center">
                        {tab.badge}
                      </span>
                    )}
                  </span>
                  <span
                    className={`text-[11px] leading-none tracking-tight max-w-full truncate px-1 ${
                      tab.isActive ? 'font-bold text-[#0a1317]' : 'font-medium text-[#5d6c7b]'
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Raised bubble that slides to the active tab */}
        {hasActive && ActiveIcon && (
          <span
            aria-hidden="true"
            className="mobile-nav-bubble pointer-events-none absolute -top-[26px] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#006C54] text-[#FFD700] shadow-[0_4px_12px_rgba(0,108,84,0.35)]"
            style={{ left: `${centerPct}%` }}
          >
            <ActiveIcon size={24} />
            {!!activeBadge && activeBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#FFD700] text-[#0a1317] font-bold text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center">
                {activeBadge}
              </span>
            )}
          </span>
        )}
      </div>
    </nav>
  );
}
