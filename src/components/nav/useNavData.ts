import { useNavigate } from 'react-router-dom';
import { Home, Unlock, Dices, Swords, Trophy, type LucideIcon } from 'lucide-react';
import { useWallet } from '../../lib/store';
import { useAuth, useCurrentUser } from '../../lib/authStore';
import { useBetSlipStore } from '../../lib/betSlipStore';

export interface NavLinkItem {
  to: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
}

export const NAV_LINKS: NavLinkItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/free', label: 'Free Matches', icon: Unlock },
  { to: '/slips', label: 'Bet Builder', icon: Dices },
  { to: '/p2p', label: 'P2P Bets', icon: Swords, soon: true },
  { to: '/leaderboard', label: 'Jackpot Room', icon: Trophy },
];

/** Consolidates the store reads Navbar and its desktop/mobile presentations need. */
export function useNavData() {
  const navigate = useNavigate();
  const balance = useWallet((s) => s.balance);
  const mshindiTokens = useWallet((s) => s.mshindiTokens);
  const currentUser = useCurrentUser();
  const logOut = useAuth((s) => s.logOut);
  const builderLegsCount = useBetSlipStore((s) => s.builderLegs.length);

  return {
    links: NAV_LINKS,
    balance,
    mshindiTokens,
    currentUser,
    logOut,
    navigate,
    builderLegsCount,
  };
}

