import type { BuiltSlipLeg } from './betSlipStore';

/**
 * Day-name → offset from today helper.
 * Returns 0 for Today, 1 for Tomorrow, or the delta to the next occurrence
 * of a given weekday name (Mon/Tue/Wed/Thu/Fri/Sat/Sun).
 */
function dayOffsetFor(token: string): number {
  const t = token.toLowerCase();
  if (t === 'today') return 0;
  if (t === 'tomorrow') return 1;

  const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const shortDay = t.slice(0, 3);
  const targetDow = DAY_NAMES.indexOf(shortDay);
  if (targetDow === -1) return 0; // unknown — fall back to today

  const todayDow = new Date().getDay(); // 0 = Sunday
  let delta = targetDow - todayDow;
  if (delta <= 0) delta += 7; // always next occurrence
  return delta;
}

/**
 * Parse a kickoff string like:
 *   "Today 22:00 EAT"
 *   "Tomorrow 19:30 EAT"
 *   "Saturday 17:00 EAT"
 *   "Sun 15:00 EAT"
 *
 * Returns a Date in local time (EAT = UTC+3, already used across the app).
 * Returns null if the string can't be parsed.
 */
export function parseKickoffTime(kickoff: string): Date | null {
  if (!kickoff) return null;

  // Match: <DayWord> <HH:MM> [timezone]
  const match = kickoff.match(/^(\S+)\s+(\d{1,2}):(\d{2})/i);
  if (!match) return null;

  const [, dayToken, hourStr, minStr] = match;
  const hours = parseInt(hourStr, 10);
  const minutes = parseInt(minStr, 10);
  if (isNaN(hours) || isNaN(minutes)) return null;

  const offset = dayOffsetFor(dayToken);
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

/**
 * Given an array of legs, find the earliest kickoff time.
 * Returns null if no leg has a parseable kickoff.
 */
export function getEarliestKickoff(legs: BuiltSlipLeg[]): Date | null {
  let earliest: Date | null = null;
  for (const leg of legs) {
    const d = parseKickoffTime(leg.kickoff);
    if (!d) continue;
    if (!earliest || d < earliest) earliest = d;
  }
  return earliest;
}
