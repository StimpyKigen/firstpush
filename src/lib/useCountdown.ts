import { useState, useEffect } from 'react';

export interface CountdownState {
  /** Human-readable label, e.g. "Starts in 1h 23m 41s" or "⚡ LIVE" */
  label: string;
  /** True when the earliest kickoff has passed */
  isLive: boolean;
  /** True when target is null (unparseable) */
  isUnknown: boolean;
  /** Seconds remaining (negative when live) */
  secondsLeft: number;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '⚡ LIVE — Match in Progress';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `Starts in ${h}h ${m}m ${String(s).padStart(2, '0')}s`;
  if (m > 0) return `Starts in ${m}m ${String(s).padStart(2, '0')}s`;
  return `Starts in ${s}s`;
}

/**
 * Real-time countdown hook.
 *
 * @param target  The Date to count down to. Pass null if the kickoff is unknown.
 * @returns       A CountdownState object that updates every second.
 */
export function useCountdown(target: Date | null): CountdownState {
  function compute(): CountdownState {
    if (!target) {
      return { label: 'Kickoff time unknown', isLive: false, isUnknown: true, secondsLeft: 0 };
    }
    const diff = Math.floor((target.getTime() - Date.now()) / 1000);
    const isLive = diff <= 0;
    return {
      label: isLive ? '⚡ LIVE — Match in Progress' : formatCountdown(diff),
      isLive,
      isUnknown: false,
      secondsLeft: diff,
    };
  }

  const [state, setState] = useState<CountdownState>(compute);

  useEffect(() => {
    if (!target) return;
    setState(compute());
    const id = setInterval(() => setState(compute()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.getTime()]);

  return state;
}
