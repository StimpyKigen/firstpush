/**
 * Normalized Football Match Status & Score Presentation Engine
 * 
 * Centralized, authoritative logic for interpreting raw provider statuses,
 * determining whether scores should be visible, and rendering status badges.
 */

export type MatchStatus =
  | 'pre'                    // Scheduled / Not started
  | 'in'                     // Live / In progress
  | 'awaiting_confirmation'  // >115m post-kickoff without provider terminal confirmation (keep polling, never fabricate FT)
  | 'post'                   // Finished / Full Time (provider-confirmed ONLY)
  | 'postponed'              // Postponed
  | 'cancelled'              // Cancelled
  | 'abandoned'              // Abandoned
  | 'suspended'              // Suspended / Unconfirmed (>=240m without provider confirmation)
  | 'unknown';               // Safe fallback

export type MatchPeriod =
  | 'scheduled'
  | 'first_half'
  | 'halftime'
  | 'second_half'
  | 'extra_time'
  | 'extra_time_halftime'
  | 'penalties'
  | 'awaiting_confirmation'
  | 'unconfirmed'
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

/** Elapsed minutes past kickoff after which an unconfirmed live match enters non-terminal 'awaiting_confirmation'. */
export const AWAITING_CONFIRMATION_MINUTES = 115;
/** Elapsed minutes past kickoff after which a match with zero provider confirmation is marked 'suspended' / 'unconfirmed'. */
export const UNCONFIRMED_MATCH_MINUTES = 240;

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
    case 'extra_time_halftime': return 45;
    case 'penalties': return 50;
    case 'awaiting_confirmation': return 55;
    case 'unconfirmed': return 58;
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
 * Normalizes a raw minute value (e.g. 67, "67", "67'", "90+", "45+2'") into a clean display string like "67'", "90+'", "45+2'".
 */
export function normalizeMinuteDisplay(rawMin?: string | number | null): string | null {
  if (rawMin === null || rawMin === undefined) return null;
  const str = String(rawMin).trim();
  if (!str) return null;
  const m = str.match(/^(\d+(?:\+\d*)?)\s*(?:min|m|['`])?$/i);
  if (m) {
    return `${m[1]}'`;
  }
  return null;
}

/**
 * Parse raw provider status, status text, and optional live_minute into a comprehensive detailed status object.
 */
export function parseDetailedMatchStatus(
  rawStatus?: string | null,
  statusText?: string | null,
  liveMinute?: string | number | null
): DetailedStatusResult {
  const s = String(rawStatus || '').toLowerCase().trim();
  const txt = String(statusText || '').toLowerCase().trim();
  const normLiveMin = normalizeMinuteDisplay(liveMinute);

  // 1. Postponed / Cancelled / Abandoned / Suspended / Interrupted / Delayed
  if (s === 'postponed' || txt.includes('postponed') || s === 'postp') {
    return { status: 'postponed', period: 'postponed', displayClock: 'POSTPONED', periodSequence: 90, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (s === 'cancelled' || s === 'canceled' || txt.includes('cancelled') || txt.includes('canceled') || s === 'canc') {
    return { status: 'cancelled', period: 'cancelled', displayClock: 'CANCELLED', periodSequence: 95, isTerminal: true, rawStatus: s, statusText: txt };
  }
  if (s === 'abandoned' || txt.includes('abandoned') || s === 'abnd') {
    return { status: 'abandoned', period: 'abandoned', displayClock: 'ABANDONED', periodSequence: 96, isTerminal: true, rawStatus: s, statusText: txt };
  }
  if (s === 'unconfirmed' || txt === 'unconfirmed') {
    return { status: 'suspended', period: 'unconfirmed', displayClock: 'UNCONFIRMED', periodSequence: 58, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (
    s === 'awaiting_confirmation' || s === 'awaiting-confirmation' || s === 'stale' ||
    txt === 'awaiting ft' || txt === 'awaiting confirmation' || txt === 'awaiting-confirmation'
  ) {
    return { status: 'awaiting_confirmation', period: 'awaiting_confirmation', displayClock: 'Awaiting FT', periodSequence: 55, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (s === 'suspended' || txt.includes('suspended') || s === 'interrupted' || txt.includes('interrupted') || s === 'susp') {
    return { status: 'suspended', period: 'suspended', displayClock: 'SUSPENDED', periodSequence: 85, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (s === 'delayed' || txt.includes('delayed')) {
    return { status: 'postponed', period: 'delayed', displayClock: 'DELAYED', periodSequence: 80, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (s === 'awarded' || s === 'walkover' || txt.includes('walkover') || txt.includes('awarded') || s === 'awr') {
    return { status: 'post', period: 'awarded', displayClock: 'AWR', periodSequence: 63, isTerminal: true, rawStatus: s, statusText: txt };
  }

  // 2. Finished / Full-Time / Terminal Post-Match
  if (
    s === 'after_penalties' || s === 'ap' ||
    txt.includes('after penalties') || txt.includes('after pen') || txt === 'ap'
  ) {
    return { status: 'post', period: 'after_penalties', displayClock: 'AP', periodSequence: 62, isTerminal: true, rawStatus: s, statusText: txt };
  }
  if (
    s === 'after_extra_time' || s === 'aet' ||
    txt.includes('after extra time') || txt.includes('after et') || txt === 'aet'
  ) {
    return { status: 'post', period: 'after_extra_time', displayClock: 'AET', periodSequence: 61, isTerminal: true, rawStatus: s, statusText: txt };
  }
  if (
    s === 'finished' || s === 'ft' || s === 'post' || s === 'ended' || s === 'full_time' || s === 'full-time' ||
    txt === 'ft' || txt === 'full-time' || txt === 'full time' || txt === 'fulltime' ||
    txt.includes('finished') || txt.includes('ended')
  ) {
    return { status: 'post', period: 'full_time', displayClock: 'FT', periodSequence: 60, isTerminal: true, rawStatus: s, statusText: txt };
  }

  // 3. Scheduled / Upcoming (check explicitly if rawStatus says upcoming/pre AND statusText does not indicate live/finished)
  if (
    (s === 'upcoming' || s === 'notstarted' || s === 'not_started' || s === 'scheduled' || s === 'pre') &&
    !txt.includes('1st half') && !txt.includes('2nd half') && !txt.includes('half-time') &&
    !txt.includes('half time') && !txt.includes('halftime') && !txt.includes('extra time') &&
    !txt.includes('penalty') && txt !== 'ht' && txt !== 'live' && !normLiveMin
  ) {
    return { status: 'pre', period: 'scheduled', displayClock: '', periodSequence: 0, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // 4. Extra Time & Penalties (Active Live Periods)
  if (
    s === 'penalties' || s === 'penalty_shootout' || s === 'p' || s === 'pen' ||
    txt.includes('penalty') || txt.includes('penalties') || txt === 'pen' || txt.includes('shootout')
  ) {
    return { status: 'in', period: 'penalties', displayClock: 'PEN', periodSequence: 50, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (
    s === 'extra_time_halftime' || s === 'et_ht' ||
    txt === 'et ht' || txt.includes('extra time half') || txt.includes('et half')
  ) {
    return { status: 'in', period: 'extra_time_halftime', displayClock: 'ET HT', periodSequence: 45, isTerminal: false, rawStatus: s, statusText: txt };
  }
  if (
    s === 'extra_time' || s === 'et' || s === '1st_et' || s === '2nd_et' ||
    txt.includes('extra time') || txt.startsWith('et') || txt.includes('overtime')
  ) {
    const clock = normLiveMin || (txt.includes('et') || txt.includes('extra') ? (statusText?.toUpperCase() || 'ET') : 'ET');
    return { status: 'in', period: 'extra_time', displayClock: clock, periodSequence: 40, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // 5. Halftime (handles "Half-time", "Half time", "Halftime", "HT", "Break")
  if (
    s === 'halftime' || s === 'half_time' || s === 'half-time' || s === 'ht' ||
    txt === 'ht' || txt === 'half time' || txt === 'half-time' || txt === 'halftime' || txt === 'break' ||
    txt.includes('half-time') || txt.includes('half time') || txt.includes('halftime')
  ) {
    return { status: 'in', period: 'halftime', displayClock: 'HT', periodSequence: 20, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // 6. Second Half
  if (s === '2nd_half' || s === 'second_half' || s === '2h' || txt.includes('2nd half') || txt.includes('second half')) {
    const embeddedMin = normalizeMinuteDisplay(txt.replace(/2nd\s*half\s*/i, '').trim());
    const clock = normLiveMin || embeddedMin || '2nd Half';
    return { status: 'in', period: 'second_half', displayClock: clock, periodSequence: 30, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // 7. First Half
  if (s === '1st_half' || s === 'first_half' || s === '1h' || txt.includes('1st half') || txt.includes('first half')) {
    const embeddedMin = normalizeMinuteDisplay(txt.replace(/1st\s*half\s*/i, '').trim());
    const clock = normLiveMin || embeddedMin || '1st Half';
    return { status: 'in', period: 'first_half', displayClock: clock, periodSequence: 10, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // 8. Check if liveMinute, statusText, or rawStatus is an authoritative minute like "86", "86'", "90+", "45+2"
  const candidateMin = normLiveMin || normalizeMinuteDisplay(txt) || normalizeMinuteDisplay(s);
  if (candidateMin) {
    const rawVal = candidateMin.replace(/'$/, '');
    const baseNum = parseInt(rawVal.split('+')[0], 10);
    let period: MatchPeriod = 'first_half';
    let periodSequence = 10;
    if (baseNum > 90) {
      period = 'extra_time';
      periodSequence = 40;
    } else if (baseNum >= 46) {
      period = 'second_half';
      periodSequence = 30;
    }
    return { status: 'in', period, displayClock: candidateMin, periodSequence, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // 9. Generic Live
  if (s === 'live' || s === 'in' || s === 'inprogress' || s === 'in_progress' || txt.includes('live')) {
    const clock = normLiveMin || (/^\d+/.test(txt) ? txt : 'LIVE');
    return { status: 'in', period: 'first_half', displayClock: clock, periodSequence: 10, isTerminal: false, rawStatus: s, statusText: txt };
  }

  // 10. Scheduled / Upcoming fallback
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
 * - Active match periods ('second_half', 'extra_time', 'penalties') can NEVER be downgraded back to 'halftime' or 'first_half'.
 */
export function isStatusTransitionValid(
  existingStatus: MatchStatus,
  existingPeriod: MatchPeriod,
  incomingStatus: MatchStatus,
  incomingPeriod: MatchPeriod,
  isAuthoritativeCorrection = false
): boolean {
  if (isAuthoritativeCorrection) return true;

  // Terminal states cannot be reverted to live, scheduled, or unconfirmed/awaiting_confirmation
  if (
    existingStatus === 'post' &&
    (incomingStatus === 'in' ||
      incomingStatus === 'pre' ||
      incomingStatus === 'awaiting_confirmation' ||
      incomingPeriod === 'unconfirmed')
  ) {
    return false;
  }

  // Active live in-play or awaiting-confirmation states cannot be reverted back to scheduled by a schedule refresh
  if (existingStatus === 'in' && incomingStatus === 'pre') {
    return false;
  }
  if (existingStatus === 'cancelled' && (incomingStatus === 'in' || incomingStatus === 'pre' || incomingStatus === 'awaiting_confirmation')) {
    return false;
  }
  if (existingStatus === 'abandoned' && (incomingStatus === 'in' || incomingStatus === 'pre' || incomingStatus === 'awaiting_confirmation')) {
    return false;
  }

  // Non-terminal unconfirmed / awaiting-confirmation states must NEVER regress to 'pre',
  // MUST accept any genuine provider 'in' or 'post' or official exceptional status when it arrives,
  // and 'unconfirmed' (>=240m) must not regress back to 'awaiting_confirmation'.
  if (existingStatus === 'awaiting_confirmation' || (existingStatus === 'suspended' && existingPeriod === 'unconfirmed')) {
    if (incomingStatus === 'pre') return false;
    if (existingPeriod === 'unconfirmed' && (incomingStatus === 'awaiting_confirmation' || incomingPeriod === 'awaiting_confirmation')) {
      return false;
    }
    return true;
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
 * Determine if a match is considered live/in-play.
 * A match is genuinely live ONLY if:
 * 1. Normalized status is explicitly 'in' (1H, HT, 2H, ET, PEN)
 * 2. OR period is an active in-play period ('first_half', 'halftime', 'second_half', 'extra_time', 'extra_time_halftime', 'penalties')
 * NEVER guess live status from elapsed clock when provider status is scheduled or terminal.
 */
export function isLiveMatch(
  fixture: { status?: any; statusText?: any; displayClock?: any; kickoffIso?: any; period?: any } | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!fixture) return false;
  if (
    fixture.status === 'post' ||
    fixture.status === 'pre' ||
    fixture.status === 'awaiting_confirmation' ||
    fixture.status === 'postponed' ||
    fixture.status === 'cancelled' ||
    fixture.status === 'abandoned' ||
    fixture.status === 'suspended'
  ) {
    return false;
  }
  // Guard against zombie live matches whose kickoff was > 165 minutes ago
  if (fixture.kickoffIso) {
    const kMs = Date.parse(fixture.kickoffIso);
    if (Number.isFinite(kMs) && (nowMs - kMs) / 60000 >= 165) {
      return false;
    }
  }
  if (fixture.status === 'in') return true;
  const norm = normalizeMatchStatus(fixture.status, fixture.displayClock || fixture.statusText);
  if (norm === 'in') return true;
  if (
    norm === 'pre' ||
    norm === 'post' ||
    norm === 'awaiting_confirmation' ||
    norm === 'postponed' ||
    norm === 'cancelled' ||
    norm === 'abandoned' ||
    norm === 'suspended'
  ) {
    return false;
  }
  if (fixture.period && ['first_half', 'halftime', 'second_half', 'extra_time', 'extra_time_halftime', 'penalties'].includes(fixture.period)) {
    return true;
  }
  return false;
}

/**
 * Determine if a match has concluded / is finished.
 * STRICT INVARIANT: Only provider-confirmed terminal post-match states return true.
 * Never fabricate completion based on elapsed time alone.
 */
export function isCompletedMatch(
  fixture: { status?: any; statusText?: any; displayClock?: any; kickoffIso?: any; period?: any } | null | undefined,
  _nowMs: number = Date.now()
): boolean {
  if (!fixture) return false;
  if (fixture.status === 'post') return true;
  if (
    fixture.status === 'in' ||
    fixture.status === 'pre' ||
    fixture.status === 'awaiting_confirmation' ||
    fixture.status === 'suspended' ||
    fixture.status === 'postponed' ||
    fixture.status === 'cancelled' ||
    fixture.status === 'abandoned'
  ) {
    return false;
  }
  const norm = normalizeMatchStatus(fixture.status, fixture.displayClock || fixture.statusText);
  if (norm === 'post') return true;
  if (fixture.period && ['full_time', 'after_extra_time', 'after_penalties', 'awarded'].includes(fixture.period)) {
    return true;
  }
  return false;
}

/**
 * Format live in-play clock to display the actual match minutes (e.g. 24', 45+2', 78')
 * instead of '1st Half' or '2nd Half'. Stops cleanly at 'HT' for halftime and 'FT'/'AET'/'AP' for finished.
 */
export function formatLiveMatchClock(
  displayClock?: string | null,
  period?: MatchPeriod,
  kickoffIso?: string | null
): string {
  const clock = String(displayClock || '').trim();
  const lower = clock.toLowerCase();

  // Stop clock on non-running states
  if (period === 'unconfirmed' || lower === 'unconfirmed') return 'UNCONFIRMED';
  if (period === 'awaiting_confirmation' || lower === 'awaiting ft' || lower === 'awaiting confirmation') return 'Awaiting FT';
  if (period === 'postponed' || lower === 'postponed') return 'POSTPONED';
  if (period === 'suspended' || lower === 'suspended') return 'SUSPENDED';
  if (period === 'abandoned' || lower === 'abandoned') return 'ABANDONED';
  if (period === 'cancelled' || lower === 'cancelled' || lower === 'canceled') return 'CANCELLED';
  if (period === 'delayed' || lower === 'delayed') return 'DELAYED';

  if (period === 'after_penalties' || lower === 'ap' || lower.includes('after pen')) return 'AP';
  if (period === 'after_extra_time' || lower === 'aet' || lower.includes('after extra')) return 'AET';
  if (
    period === 'full_time' ||
    lower === 'ft' || lower === 'full-time' || lower === 'full time' || lower === 'finished' || lower === 'ended'
  ) {
    return 'FT';
  }

  if (period === 'extra_time_halftime' || lower === 'et ht' || lower.includes('extra time half')) {
    return 'ET HT';
  }
  if (
    period === 'halftime' ||
    lower === 'ht' || lower === 'halftime' || lower === 'half-time' || lower === 'half time' || lower === 'break'
  ) {
    return 'HT';
  }
  if (period === 'penalties' || lower === 'pen' || lower.includes('penalt') || lower.includes('shootout')) {
    return 'PEN';
  }

  // If clock is already an authoritative minute string like "24", "24'", "45+2", "45+2'", "78'", "90+", "90+'", "90+4'"
  const minMatch = clock.match(/^(\d+(?:\+\d*)?)\s*['`]?$/);
  if (minMatch) {
    return `${minMatch[1]}'`;
  }

  // If clock has embedded numbers like "67 min" or "67m" or "2nd half 67'"
  const embeddedMin = clock.match(/(?:^|\s)(\d+(?:\+\d*)?)\s*(?:min|m|')/i);
  if (embeddedMin) {
    return `${embeddedMin[1]}'`;
  }

  if (period === 'extra_time' || lower.startsWith('et') || lower.includes('extra time')) {
    return 'ET';
  }

  // Fallback ONLY when provider has confirmed the match is live ('first_half' or 'second_half')
  // and only gave a generic period label ("1st half" / "2nd half") while widget detail is loading.
  // Never count past 45+' for 1st half or past 90+' for 2nd half, and never fabricate FT.
  if (kickoffIso) {
    const kMs = new Date(kickoffIso).getTime();
    if (!isNaN(kMs)) {
      const elapsedMin = Math.floor((Date.now() - kMs) / 60000);
      if (period === 'first_half' || lower.includes('1st')) {
        if (elapsedMin <= 0) return "1'";
        if (elapsedMin <= 45) return `${elapsedMin}'`;
        return "45+'";
      }
      if (period === 'second_half' || lower.includes('2nd')) {
        const adjustedMin = Math.max(46, elapsedMin - 17);
        if (adjustedMin <= 90) return `${adjustedMin}'`;
        return "90+'";
      }
      if (elapsedMin > 0) {
        if (elapsedMin <= 45) return `${elapsedMin}'`;
        if (elapsedMin <= 62) return "45+'";
        const secondHalfMin = Math.min(90, Math.max(46, elapsedMin - 17));
        if (elapsedMin <= 107) return `${secondHalfMin}'`;
        return "90+'";
      }
    }
  }

  if (period === 'first_half' || lower.includes('1st')) {
    return "1'";
  }
  if (period === 'second_half' || lower.includes('2nd')) {
    return "46'";
  }

  return clock && !['1st half', '2nd half', 'live'].includes(lower) ? clock : 'LIVE';
}

/**
 * Authoritative score and badge calculator
 */
export function getMatchScorePresentation(
  rawStatus: string | undefined | null,
  statusText: string | undefined | null,
  kickoffDisplay: string,
  homeScore?: number | null,
  awayScore?: number | null,
  kickoffIso?: string | null,
  _nowMs?: number
): ScorePresentation {
  const detailed = parseDetailedMatchStatus(rawStatus, statusText);
  // IMPORTANT:
  // 1. If rawStatus is explicitly 'post' (finished), never allow a stale statusText (like 'HT')
  //    to downgrade the presentation back to live/halftime.
  // 2. If rawStatus is explicitly 'pre' (scheduled / not started), never allow a polluted displayClock
  //    (like 'LIVE' or "1'") to promote an unstarted match to live/1'! Only terminal/exceptional overrides apply.
  const normRaw = String(rawStatus || '').toLowerCase().trim();
  const isExplicitlyFinished = normRaw === 'post' || normRaw === 'ft' || normRaw === 'finished' || normRaw === 'ended' || normRaw === 'aet' || normRaw === 'ap';
  const isExplicitlyScheduled =
    (normRaw === 'pre' || normRaw === 'scheduled' || normRaw === 'upcoming' || normRaw === 'not_started' || normRaw === 'notstarted') &&
    !['postponed', 'cancelled', 'abandoned', 'suspended', 'post'].includes(detailed.status);

  const status: MatchStatus = isExplicitlyFinished ? 'post' : isExplicitlyScheduled ? 'pre' : detailed.status;
  const period: MatchPeriod = isExplicitlyFinished && !['full_time', 'after_extra_time', 'after_penalties', 'awarded'].includes(detailed.period)
    ? 'full_time'
    : isExplicitlyScheduled
    ? 'scheduled'
    : detailed.period;
  const displayClock = isExplicitlyFinished && detailed.displayClock === 'HT'
    ? 'FT'
    : isExplicitlyScheduled
    ? ''
    : detailed.displayClock;

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
    const isUnconfirmed = period === 'unconfirmed' || displayClock === 'UNCONFIRMED';
    return {
      shouldShowScore: false,
      scoreDisplay: null,
      homeScoreDisplay: null,
      awayScoreDisplay: null,
      badgeText: isUnconfirmed ? 'UNCONFIRMED' : 'SUSPENDED',
      badgeVariant: 'alert',
      isLive: false,
      isFinished: false,
      isScheduled: false,
      isPostponedOrCancelled: true,
      period,
    };
  }

  if (status === 'awaiting_confirmation') {
    const hasConfirmedLiveScores =
      homeScore !== null &&
      homeScore !== undefined &&
      !Number.isNaN(Number(homeScore)) &&
      awayScore !== null &&
      awayScore !== undefined &&
      !Number.isNaN(Number(awayScore));

    return {
      shouldShowScore: hasConfirmedLiveScores,
      scoreDisplay: hasConfirmedLiveScores ? `${Number(homeScore)} - ${Number(awayScore)}` : null,
      homeScoreDisplay: hasConfirmedLiveScores ? String(Number(homeScore)) : null,
      awayScoreDisplay: hasConfirmedLiveScores ? String(Number(awayScore)) : null,
      badgeText: 'Awaiting FT',
      badgeVariant: 'muted',
      isLive: false,
      isFinished: false,
      isScheduled: false,
      isPostponedOrCancelled: false,
      period: 'awaiting_confirmation',
    };
  }

  // 2. Scheduled / Pre-match
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
    const isHt = period === 'halftime' || period === 'extra_time_halftime' || (displayClock && displayClock.toLowerCase() === 'ht');
    const isExtraTime = period === 'extra_time';
    const isPenalties = period === 'penalties';

    const hScore = homeScore !== null && homeScore !== undefined ? Number(homeScore) : 0;
    const aScore = awayScore !== null && awayScore !== undefined ? Number(awayScore) : 0;

    let badgeText = "1'";
    if (period === 'extra_time_halftime') {
      badgeText = 'ET HT';
    } else if (isHt) {
      badgeText = 'HT';
    } else if (isPenalties) {
      badgeText = 'PEN';
    } else if (isExtraTime) {
      badgeText = formatLiveMatchClock(displayClock, period, kickoffIso);
    } else {
      badgeText = formatLiveMatchClock(displayClock, period, kickoffIso);
    }

    if (badgeText === 'HT' || badgeText === 'ET HT') {
      return {
        shouldShowScore: true,
        scoreDisplay: `${hScore} - ${aScore}`,
        homeScoreDisplay: String(hScore),
        awayScoreDisplay: String(aScore),
        badgeText,
        badgeVariant: 'halftime',
        isLive: true,
        isFinished: false,
        isScheduled: false,
        isPostponedOrCancelled: false,
        period: period === 'extra_time_halftime' ? 'extra_time_halftime' : 'halftime',
      };
    }

    return {
      shouldShowScore: true,
      scoreDisplay: `${hScore} - ${aScore}`,
      homeScoreDisplay: String(hScore),
      awayScoreDisplay: String(aScore),
      badgeText,
      badgeVariant: 'live',
      isLive: true,
      isFinished: false,
      isScheduled: false,
      isPostponedOrCancelled: false,
      period: period === 'scheduled' ? 'first_half' : period,
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
