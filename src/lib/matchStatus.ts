/**
 * Normalized Football Match Status & Score Presentation Engine
 * 
 * Centralized, authoritative logic for interpreting raw provider statuses,
 * determining whether scores should be visible, and rendering status badges.
 */

export type MatchStatus =
  | 'pre'         // Scheduled / Not started
  | 'in'          // Live / In progress
  | 'post'        // Finished / Full Time
  | 'postponed'   // Postponed
  | 'cancelled'   // Cancelled
  | 'abandoned'   // Abandoned
  | 'suspended'   // Suspended
  | 'unknown';    // Safe fallback

export type MatchPeriod =
  | 'scheduled'
  | 'first_half'
  | 'halftime'
  | 'second_half'
  | 'extra_time'
  | 'penalties'
  | 'full_time'
  | 'after_extra_time'
  | 'after_penalties'
  | 'postponed'
  | 'cancelled'
  | 'abandoned'
  | 'suspended'
  | 'delayed'
  | 'awarded'
  | 'unknown';

export interface DetailedStatusResult {
  status: MatchStatus;
  period: MatchPeriod;
  displayClock: string;
  periodSequence: number;
  isTerminal: boolean;
  rawStatus: string;
  statusText: string;
}

export interface ScorePresentation {
  /**
   * Whether numerical scores (e.g. "2 - 1") are legitimate to display.
   * STRICT INVARIANT: Always false for scheduled, postponed, cancelled, or unknown matches.
   */
  shouldShowScore: boolean;
  scoreDisplay: string | null;      // e.g. "2 - 1", "0 - 0" (if live/finished), or null
  homeScoreDisplay: string | null;  // e.g. "2", "0" (if live/finished), or null
  awayScoreDisplay: string | null;  // e.g. "1", "0" (if live/finished), or null
  badgeText: string;               // e.g. "19:45 EAT", "LIVE 62'", "HT", "FT", "POSTPONED"
  badgeVariant: 'scheduled' | 'live' | 'halftime' | 'finished' | 'alert' | 'muted';
  isLive: boolean;
  isFinished: boolean;
  isScheduled: boolean;
  isPostponedOrCancelled: boolean;
  period?: MatchPeriod;
}

/**
 * Period progression hierarchy for monotonic progression enforcement.
 * Higher sequence numbers represent later stages of match lifecycle.
 */
export function getPeriodSequence(period: MatchPeriod): number {
  switch (period) {
    case 'scheduled': return 0;
    case 'first_half': return 10;
    case 'halftime': return 20;
    case 'second_half': return 30;
    case 'extra_time': return 40;
    case 'penalties': return 50;
    case 'full_time': return 60;
    case 'after_extra_time': return 61;
    case 'after_penalties': return 62;
    case 'awarded': return 63;
    case 'delayed': return 80;
    case 'suspended': return 85;
    case 'postponed': return 90;
    case 'cancelled': return 95;
    case 'abandoned': return 96;
    default: return 0;
  }
}

/**
 * Parse raw provider status and status text into a comprehensive detailed status object
 */
export function parseDetailedMatchStatus(rawStatus?: string | null, statusText?: string | null): DetailedStatusResult {
  const s = String(rawStatus || '').toLowerCase().trim();
  const txt = String(statusText || '').toLowerCase().trim();

  // 1. Postponed / Cancelled / Abandoned / Suspended / Interrupted / Delayed
  if (s === 'postponed' || txt.includes('postponed') || s === 'postp') {
    return { status: 'postponed', period: 'postponed', displayClock: 'POSTPONED', periodSequence: 90, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (s === 'cancelled' || txt.includes('cancelled') || s === 'canc' || txt.includes('canceled')) {
    return { status: 'cancelled', period: 'cancelled', displayClock: 'CANCELLED', periodSequence: 95, isTerminal: true, rawStatus: s, statusText: txt };
  }
  if (s === 'abandoned' || txt.includes('abandoned') || s === 'abnd') {
    return { status: 'abandoned', period: 'abandoned', displayClock: 'ABANDONED', periodSequence: 96, isTerminal: true, rawStatus: s, statusText: txt };
  }
  if (s === 'suspended' || txt.includes('suspended') || s === 'interrupted' || s === 'susp') {
    return { status: 'suspended', period: 'suspended', displayClock: 'SUSPENDED', periodSequence: 85, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (s === 'delayed' || txt.includes('delayed')) {
    return { status: 'postponed', period: 'delayed', displayClock: 'DELAYED', periodSequence: 80, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (s === 'awarded' || s === 'walkover' || txt.includes('walkover') || txt.includes('awarded')) {
    return { status: 'post', period: 'awarded', displayClock: 'AWR', periodSequence: 63, isTerminal: true, rawStatus: s, statusText: txt };
  }

  // 2. Extra Time & Penalties (Active Live Periods)
  if (s === 'penalties' || s === 'penalty_shootout' || s === 'p' || s === 'pen' || txt.includes('penalty') || txt === 'pen' || txt.includes('shootout')) {
    return { status: 'in', period: 'penalties', displayClock: 'PEN', periodSequence: 50, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (s === 'extra_time' || s === 'et' || s === '1st_et' || s === '2nd_et' || txt.includes('extra time') || txt.startsWith('et')) {
    const clock = txt.includes('et') || txt.includes('extra') ? (statusText?.toUpperCase() || 'ET') : 'ET';
    return { status: 'in', period: 'extra_time', displayClock: clock, periodSequence: 40, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // 3. Halftime
  if (s === 'halftime' || s === 'half_time' || s === 'ht' || txt === 'ht' || txt === 'half time' || txt === 'halftime') {
    return { status: 'in', period: 'halftime', displayClock: 'HT', periodSequence: 20, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // 4. Second Half
  if (s === '2nd_half' || s === 'second_half' || s === '2h' || txt.includes('2nd half')) {
    const clock = /^\d+['`]/.test(txt) ? txt : '2nd Half';
    return { status: 'in', period: 'second_half', displayClock: clock, periodSequence: 30, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // 5. First Half / Generic Live
  if (s === '1st_half' || s === 'first_half' || s === '1h' || txt.includes('1st half')) {
    const clock = /^\d+['`]/.test(txt) ? txt : '1st Half';
    return { status: 'in', period: 'first_half', displayClock: clock, periodSequence: 10, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (s === 'live' || s === 'in' || s === 'inprogress' || txt.includes('live') || /^\d+['`]/.test(txt)) {
    // If status text is specifically a minute like 67'
    const clock = /^\d+['`]/.test(txt) ? txt : 'LIVE';
    return { status: 'in', period: 'second_half', displayClock: clock, periodSequence: 25, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // 6. Finished / Full-Time / Terminal Post-Match
  if (s === 'after_penalties' || s === 'ap' || txt.includes('after penalties') || txt === 'ap') {
    return { status: 'post', period: 'after_penalties', displayClock: 'AP', periodSequence: 62, isTerminal: true, rawStatus: s, statusText: txt };
  }
  if (s === 'after_extra_time' || s === 'aet' || txt.includes('after extra time') || txt === 'aet') {
    return { status: 'post', period: 'after_extra_time', displayClock: 'AET', periodSequence: 61, isTerminal: true, rawStatus: s, statusText: txt };
  }
  if (
    s === 'finished' || s === 'ft' || s === 'post' || s === 'ended' ||
    txt === 'ft' || txt.includes('finished') || txt.includes('ended')
  ) {
    return { status: 'post', period: 'full_time', displayClock: 'FT', periodSequence: 60, isTerminal: true, rawStatus: s, statusText: txt };
  }

  // 7. Scheduled / Upcoming
  if (
    s === 'upcoming' || s === 'notstarted' || s === 'not_started' || s === 'scheduled' || s === 'pre' ||
    txt.includes('not started') || txt.includes('upcoming') || txt.includes('fixture')
  ) {
    return { status: 'pre', period: 'scheduled', displayClock: '', periodSequence: 0, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // Safe fallback: never assume a match has started without positive live evidence
  return { status: 'pre', period: 'scheduled', displayClock: '', periodSequence: 0, isTerminal: false, rawStatus: s, statusText: txt };
}

/**
 * Normalize provider status strings into our standard MatchStatus enum (backward compatible)
 */
export function normalizeMatchStatus(rawStatus?: string | null, statusText?: string | null): MatchStatus {
  return parseDetailedMatchStatus(rawStatus, statusText).status;
}

/**
 * Validate whether a new incoming status is allowed to overwrite an existing stored status.
 * CRITICAL INVARIANT:
 * - Terminal states ('post', 'cancelled', 'abandoned') can NEVER be downgraded to 'in', 'ht', or 'pre' by an out-of-order response.
 * - Active match periods ('2nd_half', 'extra_time') can NEVER be downgraded back to 'halftime' or '1st_half'.
 */
export function isStatusTransitionValid(
  existingStatus: MatchStatus,
  existingPeriod: MatchPeriod,
  incomingStatus: MatchStatus,
  incomingPeriod: MatchPeriod,
  isAuthoritativeCorrection = false
): boolean {
  if (isAuthoritativeCorrection) return true;

  // Terminal states cannot be reverted to live or scheduled
  if (existingStatus === 'post' && (incomingStatus === 'in' || incomingStatus === 'pre')) {
    return false;
  }
  if (existingStatus === 'cancelled' && (incomingStatus === 'in' || incomingStatus === 'pre')) {
    return false;
  }
  if (existingStatus === 'abandoned' && (incomingStatus === 'in' || incomingStatus === 'pre')) {
    return false;
  }

  const existingSeq = getPeriodSequence(existingPeriod);
  const incomingSeq = getPeriodSequence(incomingPeriod);

  // If existing is already at full time (60+) and incoming is an earlier period (e.g. halftime 20), reject
  if (existingSeq >= 60 && incomingSeq < 60) {
    return false;
  }

  // If existing is in second half, extra time, or penalties, do not revert to halftime or 1st half
  if (existingSeq >= 30 && (incomingPeriod === 'halftime' || incomingPeriod === 'first_half')) {
    return false;
  }

  // If existing is at halftime (20), do not revert to 1st half (10)
  if (existingSeq === 20 && incomingPeriod === 'first_half') {
    return false;
  }

  return true;
}

/**
 * Authoritative score and badge calculator
 */
export function getMatchScorePresentation(
  rawStatus: string | undefined | null,
  statusText: string | undefined | null,
  kickoffDisplay: string,
  homeScore?: number | null,
  awayScore?: number | null
): ScorePresentation {
  const detailed = parseDetailedMatchStatus(rawStatus, statusText);
  const { status, period, displayClock } = detailed;

  // 1. Postponed / Suspended / Cancelled / Abandoned
  if (status === 'postponed') {
    return {
      shouldShowScore: false,
      scoreDisplay: null,
      homeScoreDisplay: null,
      awayScoreDisplay: null,
      badgeText: displayClock || 'POSTPONED',
      badgeVariant: 'alert',
      isLive: false,
      isFinished: false,
      isScheduled: false,
      isPostponedOrCancelled: true,
      period,
    };
  }
  if (status === 'cancelled') {
    return {
      shouldShowScore: false,
      scoreDisplay: null,
      homeScoreDisplay: null,
      awayScoreDisplay: null,
      badgeText: 'CANCELLED',
      badgeVariant: 'alert',
      isLive: false,
      isFinished: false,
      isScheduled: false,
      isPostponedOrCancelled: true,
      period,
    };
  }
  if (status === 'abandoned') {
    return {
      shouldShowScore: false,
      scoreDisplay: null,
      homeScoreDisplay: null,
      awayScoreDisplay: null,
      badgeText: 'ABANDONED',
      badgeVariant: 'alert',
      isLive: false,
      isFinished: false,
      isScheduled: false,
      isPostponedOrCancelled: true,
      period,
    };
  }
  if (status === 'suspended') {
    return {
      shouldShowScore: false,
      scoreDisplay: null,
      homeScoreDisplay: null,
      awayScoreDisplay: null,
      badgeText: 'SUSPENDED',
      badgeVariant: 'alert',
      isLive: false,
      isFinished: false,
      isScheduled: false,
      isPostponedOrCancelled: true,
      period,
    };
  }

  // 2. Scheduled / Pre-match (Never show numerical score for scheduled match)
  if (status === 'pre' || status === 'unknown') {
    return {
      shouldShowScore: false,
      scoreDisplay: null,
      homeScoreDisplay: null,
      awayScoreDisplay: null,
      badgeText: kickoffDisplay || 'Upcoming',
      badgeVariant: 'scheduled',
      isLive: false,
      isFinished: false,
      isScheduled: true,
      isPostponedOrCancelled: false,
      period: 'scheduled',
    };
  }

  // 3. Live in progress (1st half, HT, 2nd half, extra time, penalties)
  if (status === 'in') {
    const isHt = period === 'halftime';
    const isExtraTime = period === 'extra_time';
    const isPenalties = period === 'penalties';

    const hScore = homeScore !== null && homeScore !== undefined ? Number(homeScore) : 0;
    const aScore = awayScore !== null && awayScore !== undefined ? Number(awayScore) : 0;

    let badgeText = 'LIVE';
    if (isHt) {
      badgeText = 'HT';
    } else if (isPenalties) {
      badgeText = 'PEN';
    } else if (isExtraTime) {
      badgeText = displayClock || 'ET';
    } else if (displayClock && displayClock !== 'LIVE' && displayClock !== 'live') {
      badgeText = displayClock;
    }

    return {
      shouldShowScore: true,
      scoreDisplay: `${hScore} - ${aScore}`,
      homeScoreDisplay: String(hScore),
      awayScoreDisplay: String(aScore),
      badgeText,
      badgeVariant: isHt ? 'halftime' : 'live',
      isLive: true,
      isFinished: false,
      isScheduled: false,
      isPostponedOrCancelled: false,
      period,
    };
  }

  // 4. Finished / Full-Time / After Extra Time / After Penalties
  const hScore = homeScore !== null && homeScore !== undefined ? Number(homeScore) : 0;
  const aScore = awayScore !== null && awayScore !== undefined ? Number(awayScore) : 0;

  let ftBadge = 'FT';
  if (period === 'after_extra_time') ftBadge = 'AET';
  if (period === 'after_penalties') ftBadge = 'AP';
  if (period === 'awarded') ftBadge = 'AWR';

  return {
    shouldShowScore: true,
    scoreDisplay: `${hScore} - ${aScore}`,
    homeScoreDisplay: String(hScore),
    awayScoreDisplay: String(aScore),
    badgeText: ftBadge,
    badgeVariant: 'finished',
    isLive: false,
    isFinished: true,
    isScheduled: false,
    isPostponedOrCancelled: false,
    period,
  };
}
