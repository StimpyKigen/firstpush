import type { Jackpot } from './types';

export type DisplayRoomStatus = 'not_started' | 'live' | 'settled';

export interface RoomStatusInfo {
  status: DisplayRoomStatus;
  label: string;
  badgeClass: string;
  dotClass: string;
  description: string;
  completedCount: number;
  totalCount: number;
}

export function getRoomStatusInfo(jackpot: Jackpot): RoomStatusInfo {
  const completedCount = jackpot.matches ? jackpot.matches.filter((m) => m.result !== undefined).length : 0;
  const totalCount = (jackpot.matches && jackpot.matches.length > 0) ? jackpot.matches.length : 17;

  if (jackpot.status === 'settled' || (completedCount === totalCount && totalCount > 0)) {
    return {
      status: 'settled',
      label: 'Settled',
      badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      dotClass: 'bg-emerald-400',
      description: 'All games in this room updated & finalized',
      completedCount,
      totalCount,
    };
  }

  if (completedCount > 0 || jackpot.status === 'locked') {
    return {
      status: 'live',
      label: `Live (${completedCount}/${totalCount})`,
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse',
      dotClass: 'bg-rose-400',
      description: 'Jackpot commenced, leg results updating live',
      completedCount,
      totalCount,
    };
  }

  return {
    status: 'not_started',
    label: 'Not Started',
    badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-400',
    description: 'Kickoff pending, room consensus open for predictions',
    completedCount,
    totalCount,
  };
}
