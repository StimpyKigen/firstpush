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
 * Full-width, TikTok-style fixed bottom navigation bar shown below `lg`.
 * Sits flush against the bottom edge of the display, respecting iOS safe areas.
 * Features 5 evenly distributed tabs with active indicator and badges.
 */
export default function MobileBottomNav({ pathname, builderLegsCount, currentUser }: MobileBottomNavProps) {
  const tabs: Tab[] = [
    { to: '/', label: 'Home', icon: Home, isActive: pathname === '/' },
    { to: '/free', label: 'Matches', icon: Unlock, isActive: pathname.startsWith('/free') },
    { to: '/slips', label: 'Slips', icon: Dices, isActive: pathname.startsWith('/slips'), badge: builderLegsCount },
    { to: '/leaderboard', label: 'Ranks', icon: Trophy, isActive: pathname.startsWith('/leaderboard') },
    {
      to: currentUser ? '/profile' : '/auth',
      label: currentUser ? 'Profile' : 'Log In',
      icon: User,
      isActive: pathname.startsWith('/profile') || pathname.startsWith('/auth'),
    },
  ];

  const activeIndex = tabs.findIndex((t) => t.isActive);
  const hasActive = activeIndex >= 0;
  const count = tabs.length;

  return (
    <nav
      aria-label="Primary Mobile Navigation"
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 select-none mobile-bottom-nav w-full"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="relative h-[52px] w-full max-w-lg mx-auto">
        {/* Sleek top active indicator line gliding to active tab */}
        {hasActive && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 h-[2.5px] w-8 rounded-full bg-[#006C54] dark:bg-[#EEAA04] transition-all duration-300 ease-out z-10"
            style={{
              left: `calc((${activeIndex} + 0.5) * (100% / ${count}) - 16px)`,
            }}
          />
        )}

        <div
          className="grid h-full w-full"
          style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={tab.isActive ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center h-full pt-1.5 pb-1 touch-manipulation active:scale-95 transition-transform group"
              >
                <span className="relative flex items-center justify-center">
                  <Icon
                    size={20}
                    className={`transition-colors duration-200 ${
                      tab.isActive
                        ? 'text-[#006C54] dark:text-[#EEAA04] stroke-[2.35]'
                        : 'text-[#5d6c7b] dark:text-[#8ba296] group-hover:text-[#0a1317] dark:group-hover:text-[#f0f4f1]'
                    }`}
                  />
                  {!!tab.badge && tab.badge > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 font-black text-[9px] h-3.5 min-w-[15px] px-1 rounded-full flex items-center justify-center shadow-xs border border-[#FFFFF0] dark:border-[#0a120f] ${
                        tab.isActive ? 'bg-[#EEAA04] text-[#0a1317]' : 'bg-[#006C54] text-[#EEAA04]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[10px] leading-tight tracking-tight mt-0.5 truncate max-w-full px-0.5 transition-colors duration-200 ${
                    tab.isActive
                      ? 'font-bold text-[#006C54] dark:text-[#EEAA04]'
                      : 'font-medium text-[#5d6c7b] dark:text-[#8ba296] group-hover:text-[#0a1317] dark:group-hover:text-[#f0f4f1]'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
