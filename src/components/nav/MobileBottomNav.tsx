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

const INSET = 6; // px of padding between the bar edge and the tabs / sliding pill

/**
 * Floating bottom tab bar shown below `lg`.
 * A green pill slides behind the active tab (gold icon, bold ivory label) and stays inside the bar.
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
  const count = tabs.length;
  const slotWidth = `calc((100% - ${INSET * 2}px) / ${count})`;

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed left-3 right-3 z-40 select-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      <div
        className="relative h-[58px] rounded-[24px] bg-[#FFFFF0] border border-[#E6E6D2]"
        style={{ boxShadow: '0 6px 16px rgba(10, 19, 23, 0.12)', padding: INSET }}
      >
        {/* Sliding active pill */}
        {hasActive && (
          <span
            aria-hidden="true"
            className="mobile-nav-pill pointer-events-none absolute rounded-[18px] bg-[#006C54]"
            style={{
              top: INSET,
              bottom: INSET,
              width: slotWidth,
              left: `calc(${INSET}px + ${activeIndex} * ${slotWidth})`,
            }}
          />
        )}

        <div className="relative grid h-full" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={tab.isActive ? 'page' : undefined}
                className="relative flex flex-col items-center justify-center gap-0.5 touch-manipulation active:scale-95 transition-transform"
              >
                <span className="relative flex items-center justify-center h-5">
                  <Icon
                    size={20}
                    className={`transition-colors duration-300 ${tab.isActive ? 'text-[#EEAA04]' : 'text-[#5d6c7b]'}`}
                  />
                  {!!tab.badge && tab.badge > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 font-bold text-[9px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center ${
                        tab.isActive ? 'bg-[#EEAA04] text-[#0a1317]' : 'bg-[#006C54] text-[#EEAA04]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[10.5px] leading-none tracking-tight max-w-full truncate px-0.5 transition-colors duration-300 ${
                    tab.isActive ? 'font-bold text-[#FFFFF0]' : 'font-medium text-[#5d6c7b]'
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
