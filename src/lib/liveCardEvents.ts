/**
 * Live Fixture-Card Event Tracker (pure, framework-free, unit-testable)
 *
 * Turns authoritative match state (scores, status, provider incidents) into the short-lived
 * notifications shown on fixture cards: goal glow + "Goal" + scorer, named cards, VAR.
 *
 * Design rules (see docs/LIVE_MATCH_UPDATES.md):
 *  - Only PROVIDER data is used. Nothing is invented: no placeholder names, no inferred VAR outcomes.
 *  - A goal is announced ONLY when a side's score exceeds the highest score ever announced/seen for
 *    that side in this match, while the match is live. Score corrections, stale snapshots going
 *    backwards-then-forwards, shootout score changes and cold mounts therefore never fire goals.
 *  - Scorers are attached by matching the provider's `scoreAfter` on goal incidents (not by
 *    "latest goalscorer", which could belong to an earlier goal). A scorer that arrives after the
 *    score enriches the SAME notification (no duplicate "Goal").
 *  - Every incident is keyed by its stable ID and remembered per match in a module-level registry,
 *    so component re-renders, remounts, SSE reconnects and live_snapshot replays never replay events.
 *  - Substitutions are consumed silently. Cards without a provider-supplied player name are
 *    consumed silently. VAR is never attributed to a team.
 */

export const CARD_NOTIFICATION_MS = 5000;

export type CardEventKind = 'goal' | 'yellow_card' | 'red_card' | 'var';

export interface CardNotification {
  id: string;
  kind: CardEventKind;
  /** Team line the notification is shown under. VAR is intentionally never attributed to a side. */
  side?: 'home' | 'away';
  player?: string;
  minute?: string;
  /** Provider-reported VAR decision text (only when supplied by SportScore). */
  decision?: string;
  /** Show the literal "Goal" label (false for a late scorer-only follow-up of an expired goal). */
  showGoalLabel?: boolean;
}

export interface GoalScorerEnrichment {
  /** ID of the goal notification this scorer belongs to. */
  notificationId: string;
  side: 'home' | 'away';
  player: string;
  minute?: string;
}

export interface TrackerMatchInput {
  id: string;
  status?: string;
  period?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  incidents?: Array<{
    id?: string;
    type?: string;
    team?: 'home' | 'away';
    side?: 'home' | 'away';
    teamSide?: 'home' | 'away';
    player?: string;
    minute?: number | string;
    time?: number | string;
    scoreAfter?: string;
    decision?: string;
  }>;
}

export interface TrackerResult {
  notifications: CardNotification[];
  enrichments: GoalScorerEnrichment[];
  glow: { home: boolean; away: boolean };
}

interface PendingGoal {
  notificationId: string;
  side: 'home' | 'away';
  score: number;
  announcedAtMs: number;
}

interface MatchState {
  maxHome: number | null;
  maxAway: number | null;
  lastStatus?: string;
  seenIncidentKeys: Set<string>;
  pendingGoals: PendingGoal[];
}

const MAX_TRACKED_MATCHES = 500;
const MAX_SEEN_KEYS_PER_MATCH = 400;
const PENDING_GOAL_TTL_MS = 5 * 60_000;

const GOAL_TYPES = new Set(['goal', 'own_goal', 'penalty_goal']);

function sideOf(inc: NonNullable<TrackerMatchInput['incidents']>[number]): 'home' | 'away' {
  return (inc.team || inc.side || inc.teamSide) === 'away' ? 'away' : 'home';
}

function incidentKey(inc: NonNullable<TrackerMatchInput['incidents']>[number], index: number): string {
  if (inc.id) return String(inc.id);
  return `${inc.type || 'x'}_${inc.minute ?? inc.time ?? ''}_${sideOf(inc)}_${inc.player || ''}_${index}`;
}

function parseScoreAfter(scoreAfter?: string): { home: number; away: number } | null {
  if (!scoreAfter) return null;
  const m = String(scoreAfter).match(/(\d+)\s*[-:]\s*(\d+)/);
  return m ? { home: Number(m[1]), away: Number(m[2]) } : null;
}

function formatMinute(raw: number | string | undefined): string | undefined {
  if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
  const s = String(raw).trim();
  return s.endsWith("'") ? s : `${s}'`;
}

function isShootoutPeriod(period?: string): boolean {
  return period === 'penalties' || period === 'after_penalties';
}

function cleanName(name: unknown): string {
  return typeof name === 'string' ? name.trim() : '';
}

export class LiveEventTracker {
  private states = new Map<string, MatchState>();

  /** Forgets all tracked matches (tests / sign-out). */
  public reset(): void {
    this.states.clear();
  }

  public hasSeen(matchId: string): boolean {
    return this.states.has(matchId);
  }

  private getState(matchId: string): MatchState | undefined {
    return this.states.get(matchId);
  }

  private seed(match: TrackerMatchInput): MatchState {
    const state: MatchState = {
      maxHome: typeof match.homeScore === 'number' ? match.homeScore : null,
      maxAway: typeof match.awayScore === 'number' ? match.awayScore : null,
      lastStatus: match.status,
      seenIncidentKeys: new Set<string>(),
      pendingGoals: [],
    };
    // Historic incidents present at first sight are history, never notifications.
    (match.incidents || []).forEach((inc, i) => state.seenIncidentKeys.add(incidentKey(inc, i)));
    this.states.set(match.id, state);
    if (this.states.size > MAX_TRACKED_MATCHES) {
      const oldest = this.states.keys().next().value;
      if (oldest !== undefined) this.states.delete(oldest);
    }
    return state;
  }

  /**
   * Feed the latest authoritative state for a match. Returns only NEW notifications / enrichments.
   * Idempotent: calling again with identical input returns nothing.
   */
  public process(match: TrackerMatchInput, nowMs: number = Date.now()): TrackerResult {
    const result: TrackerResult = { notifications: [], enrichments: [], glow: { home: false, away: false } };
    if (!match || !match.id) return result;

    let state = this.getState(match.id);
    if (!state) {
      this.seed(match);
      return result;
    }

    const incidents = match.incidents || [];
    const keyed = incidents.map((inc, i) => ({ inc, key: incidentKey(inc, i) }));
    const isLiveNow = match.status === 'in';
    const goalsAllowed =
      (isLiveNow || (match.status === 'post' && state.lastStatus === 'in')) && !isShootoutPeriod(match.period);

    // Initialise a score baseline the first time a numeric score appears (kickoff null -> 0).
    if (state.maxHome === null && typeof match.homeScore === 'number') state.maxHome = match.homeScore;
    if (state.maxAway === null && typeof match.awayScore === 'number') state.maxAway = match.awayScore;

    // Drop expired pending goals.
    state.pendingGoals = state.pendingGoals.filter((p) => nowMs - p.announcedAtMs < PENDING_GOAL_TTL_MS);

    const unseenGoals = () =>
      keyed.filter(
        (k) => !state!.seenIncidentKeys.has(k.key) && GOAL_TYPES.has(String(k.inc.type || '')) && cleanName(k.inc.player)
      );

    // 1. SCORE INCREASES -> goal notifications (+ glow), scorer matched via provider scoreAfter.
    const curHome = typeof match.homeScore === 'number' ? match.homeScore : null;
    const curAway = typeof match.awayScore === 'number' ? match.awayScore : null;

    const announceSide = (side: 'home' | 'away', prevMax: number | null, cur: number | null) => {
      if (cur === null || prevMax === null || cur <= prevMax) return;
      for (let k = prevMax + 1; k <= cur; k++) {
        const notificationId = `goal:${match.id}:${side}:${k}`;
        const otherCur = side === 'home' ? curAway : curHome;
        const candidates = unseenGoals();
        let chosen = candidates.find((c) => {
          const sa = parseScoreAfter(c.inc.scoreAfter);
          if (!sa) return false;
          const sideScore = side === 'home' ? sa.home : sa.away;
          const otherScore = side === 'home' ? sa.away : sa.home;
          return sideScore === k && (otherCur === null || otherScore <= otherCur);
        });
        if (!chosen) {
          // No scoreAfter available: only attribute when unambiguous (exactly one unseen goal on this side).
          const sameSide = candidates.filter((c) => !parseScoreAfter(c.inc.scoreAfter) && sideOf(c.inc) === side);
          if (sameSide.length === 1) chosen = sameSide[0];
        }
        const notification: CardNotification = {
          id: notificationId,
          kind: 'goal',
          side,
          showGoalLabel: true,
        };
        if (chosen) {
          state!.seenIncidentKeys.add(chosen.key);
          notification.player = cleanName(chosen.inc.player);
          notification.minute = formatMinute(chosen.inc.minute ?? chosen.inc.time);
        } else {
          state!.pendingGoals.push({ notificationId, side, score: k, announcedAtMs: nowMs });
        }
        result.notifications.push(notification);
        result.glow[side] = true;
      }
    };

    if (goalsAllowed) {
      announceSide('home', state.maxHome, curHome);
      announceSide('away', state.maxAway, curAway);
    }
    // Baselines only ever move forward (a stale lower snapshot can't re-arm a goal), and also
    // follow shootout/corrected scores upward without announcing them.
    if (curHome !== null && (state.maxHome === null || curHome > state.maxHome)) state.maxHome = curHome;
    if (curAway !== null && (state.maxAway === null || curAway > state.maxAway)) state.maxAway = curAway;

    // 2. DELAYED SCORER: a goal incident arriving after its score was already announced.
    if (state.pendingGoals.length > 0) {
      for (const c of unseenGoals()) {
        const sa = parseScoreAfter(c.inc.scoreAfter);
        let pending: PendingGoal | undefined;
        if (sa) {
          pending = state.pendingGoals.find((p) => (p.side === 'home' ? sa.home : sa.away) === p.score);
        }
        if (!pending) {
          const sameSide = state.pendingGoals.filter((p) => p.side === sideOf(c.inc));
          if (sameSide.length === 1 && !sa) pending = sameSide[0];
        }
        if (pending) {
          state.seenIncidentKeys.add(c.key);
          state.pendingGoals = state.pendingGoals.filter((p) => p !== pending);
          result.enrichments.push({
            notificationId: pending.notificationId,
            side: pending.side,
            player: cleanName(c.inc.player),
            minute: formatMinute(c.inc.minute ?? c.inc.time),
          });
        }
      }
    }

    // 3. CARDS (named only), VAR (never attributed / never inferred), SUBSTITUTIONS (silent).
    for (const { inc, key } of keyed) {
      const type = String(inc.type || '');
      if (type === 'var') {
        const decision = cleanName(inc.decision);
        const varKey = decision ? `${key}:${decision}` : key;
        if (state.seenIncidentKeys.has(varKey)) continue;
        state.seenIncidentKeys.add(varKey);
        state.seenIncidentKeys.add(key);
        result.notifications.push({
          id: `var:${varKey}`,
          kind: 'var',
          minute: formatMinute(inc.minute ?? inc.time),
          decision: decision || undefined,
        });
        continue;
      }
      if (state.seenIncidentKeys.has(key)) continue;
      if (type === 'yellow_card' || type === 'red_card') {
        state.seenIncidentKeys.add(key);
        const player = cleanName(inc.player);
        if (!player) continue; // unidentified card: never displayed
        result.notifications.push({
          id: `card:${key}`,
          kind: type,
          side: sideOf(inc),
          player,
          minute: formatMinute(inc.minute ?? inc.time),
        });
      } else if (type === 'substitution' || type === 'other') {
        state.seenIncidentKeys.add(key); // consumed silently
      }
      // Goal incidents stay unseen until a score change / pending goal claims them.
    }

    // Keep the dedupe memory bounded.
    if (state.seenIncidentKeys.size > MAX_SEEN_KEYS_PER_MATCH) {
      const keep = Array.from(state.seenIncidentKeys).slice(-MAX_SEEN_KEYS_PER_MATCH);
      state.seenIncidentKeys = new Set(keep);
    }

    state.lastStatus = match.status;
    return result;
  }
}

/** Shared registry so events never replay across re-renders, remounts or SSE reconnections. */
export const liveEventTracker = new LiveEventTracker();

