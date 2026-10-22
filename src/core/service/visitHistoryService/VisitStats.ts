import { VhV3FocusSession } from './v3/VhV3SessionLineParser';

/**
 * Per-note visit stats aggregated over CLOSED focus sessions (all users and
 * devices). Immutable value; the ONE owner of the aggregation rule:
 * last visit = max session START, total focus = sum of session durations.
 * Shared by the disk fold (VhV3DurationStore) and the cache write-through
 * (VisitStatsCache), so both can never disagree.
 */
export class VisitStats {
  /** Never visited: no session recorded anywhere. */
  static readonly EMPTY = new VisitStats(null, 0);

  constructor(
    /** Most recent session START (epoch ms), or null if never visited. */
    readonly lastVisitMs: number | null,
    /** Sum of all session durations (ms). */
    readonly totalFocusMs: number,
  ) {
  }

  static fromSessions(sessions: readonly VhV3FocusSession[]): VisitStats {
    // reduce, not Math.max(...spread): spreading a years-long history
    // (100k+ sessions) can blow the call stack and kill the whole heatmap refresh.
    return sessions.reduce<VisitStats>(
      (stats, session) => stats.withSession(session.focusStartEpochMs, session.durationMs),
      VisitStats.EMPTY,
    );
  }

  /** These stats plus one more closed session (order-independent). */
  withSession(focusStartEpochMs: number, durationMs: number): VisitStats {
    const lastVisitMs = this.lastVisitMs === null
      ? focusStartEpochMs
      : Math.max(this.lastVisitMs, focusStartEpochMs);
    return new VisitStats(lastVisitMs, this.totalFocusMs + durationMs);
  }
}
