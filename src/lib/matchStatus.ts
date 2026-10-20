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
}

/**
 * Normalize provider status strings into our standard MatchStatus enum
 */
export function normalizeMatchStatus(rawStatus?: string | null, statusText?: string | null): MatchStatus {
  if (!rawStatus && !statusText) return 'pre';
  const s = String(rawStatus || '').toLowerCase().trim();
  const txt = String(statusText || '').toLowerCase().trim();

  // 1. Postponed / Cancelled / Abandoned / Suspended / Interrupted
  if (s === 'postponed' || txt.includes('postponed') || s === 'postp') return 'postponed';
  if (s === 'cancelled' || txt.includes('cancelled') || s === 'canc' || txt.includes('canceled')) return 'cancelled';
  if (s === 'abandoned' || txt.includes('abandoned') || s === 'abnd') return 'abandoned';
  if (s === 'suspended' || txt.includes('suspended') || s === 'interrupted' || s === 'susp') return 'suspended';
  if (s === 'delayed' || txt.includes('delayed')) return 'postponed';

  // 2. Live in progress
  if (
    s === 'live' || s === 'in' || s === 'inprogress' || s === '1st_half' ||
    s === '2nd_half' || s === 'halftime' || s === 'ht' || s === 'extra_time' ||
    s === 'penalties' || txt.includes('live') || txt.includes('half') || /^\d+['`]/.test(txt)
  ) {
    return 'in';
  }

  // 3. Finished / Full-Time
  if (
    s === 'finished' || s === 'ft' || s === 'post' || s === 'ended' ||
    s === 'after_extra_time' || s === 'after_penalties' || txt === 'ft' ||
    txt.includes('finished') || txt.includes('ended')
  ) {
    return 'post';
  }

  // 4. Scheduled / Upcoming
  if (
    s === 'upcoming' || s === 'notstarted' || s === 'scheduled' || s === 'pre' ||
    txt.includes('not started') || txt.includes('upcoming') || txt.includes('fixture')
  ) {
    return 'pre';
  }

  // Safe fallback: never assume a match has started without positive live evidence
  return 'pre';
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
  const normalized = normalizeMatchStatus(rawStatus, statusText);

  // 1. Abnormal non-playing statuses
  if (normalized === 'postponed') {
    return {
      shouldShowScore: false,
      scoreDisplay: null,
      homeScoreDisplay: null,
      awayScoreDisplay: null,
      badgeText: 'POSTPONED',
      badgeVariant: 'alert',
      isLive: false,
      isFinished: false,
      isScheduled: false,
      isPostponedOrCancelled: true,
    };
  }
  if (normalized === 'cancelled') {
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
    };
  }
  if (normalized === 'abandoned') {
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
    };
  }
  if (normalized === 'suspended') {
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
    };
  }

  // 2. Scheduled / Pre-match (CRITICAL FIX: Never show a 0-0 scoreline for scheduled games)
  if (normalized === 'pre' || normalized === 'unknown') {
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
    };
  }

  // 3. Live in progress
  if (normalized === 'in') {
    const isHt = (statusText || '').toLowerCase().includes('ht') ||
                 (statusText || '').toLowerCase().includes('half') ||
                 (rawStatus || '').toLowerCase().includes('half');
    
    // Legitimate live score: even if 0-0, display 0-0!
    const hScore = homeScore !== null && homeScore !== undefined ? Number(homeScore) : 0;
    const aScore = awayScore !== null && awayScore !== undefined ? Number(awayScore) : 0;

    return {
      shouldShowScore: true,
      scoreDisplay: `${hScore} - ${aScore}`,
      homeScoreDisplay: String(hScore),
      awayScoreDisplay: String(aScore),
      badgeText: isHt ? 'HT' : (statusText && statusText !== 'Live' && statusText !== 'live' ? statusText : 'LIVE'),
      badgeVariant: isHt ? 'halftime' : 'live',
      isLive: true,
      isFinished: false,
      isScheduled: false,
      isPostponedOrCancelled: false,
    };
  }

  // 4. Finished / Full-Time
  const hScore = homeScore !== null && homeScore !== undefined ? Number(homeScore) : 0;
  const aScore = awayScore !== null && awayScore !== undefined ? Number(awayScore) : 0;

  return {
    shouldShowScore: true,
    scoreDisplay: `${hScore} - ${aScore}`,
    homeScoreDisplay: String(hScore),
    awayScoreDisplay: String(aScore),
    badgeText: 'FT',
    badgeVariant: 'finished',
    isLive: false,
    isFinished: true,
    isScheduled: false,
    isPostponedOrCancelled: false,
  };
}
