import { describe, expect, it } from 'vitest';
import { VisitStats } from './VisitStats';

const OLDER_MS = Date.parse('2026-07-09T10:00:00.000Z');
const NEWER_MS = Date.parse('2026-07-10T10:00:00.000Z');

describe('VisitStats', () => {
  describe('EMPTY', () => {
    it('should mean never visited with zero focus time', () => {
      expect(VisitStats.EMPTY).toEqual({ lastVisitMs: null, totalFocusMs: 0 });
    });
  });

  describe('fromSessions', () => {
    it('should return EMPTY stats when there are no sessions', () => {
      expect(VisitStats.fromSessions([])).toEqual(VisitStats.EMPTY);
    });

    it('should take start and duration of a single session', () => {
      // GIVEN one session
      const sessions = [{ focusStartEpochMs: OLDER_MS, durationMs: 500 }];
      // WHEN folded
      // THEN its start is the last visit and its duration the total
      expect(VisitStats.fromSessions(sessions)).toEqual({ lastVisitMs: OLDER_MS, totalFocusMs: 500 });
    });

    it('should take the max session START even when it is not the last session', () => {
      // GIVEN the newest session listed first (e.g. another device's file read first)
      const sessions = [
        { focusStartEpochMs: NEWER_MS, durationMs: 1 },
        { focusStartEpochMs: OLDER_MS, durationMs: 1 },
      ];
      // WHEN folded
      // THEN the newest start wins
      expect(VisitStats.fromSessions(sessions).lastVisitMs).toBe(NEWER_MS);
    });

    it('should sum the durations of all sessions', () => {
      // GIVEN three sessions
      const sessions = [
        { focusStartEpochMs: OLDER_MS, durationMs: 100 },
        { focusStartEpochMs: NEWER_MS, durationMs: 250 },
        { focusStartEpochMs: OLDER_MS, durationMs: 0 },
      ];
      // WHEN folded
      // THEN the total is the sum
      expect(VisitStats.fromSessions(sessions).totalFocusMs).toBe(350);
    });

    it('should fold a very long history without blowing the call stack', () => {
      // GIVEN more sessions than a Math.max(...spread) could take as arguments
      const sessionCount = 200_000;
      const sessions = Array.from({ length: sessionCount }, (_, i) => ({ focusStartEpochMs: i, durationMs: 1 }));
      // WHEN folded
      // THEN the total counts every session
      expect(VisitStats.fromSessions(sessions).totalFocusMs).toBe(sessionCount);
    });
  });

  describe('withSession', () => {
    it('should turn EMPTY into the session stats', () => {
      expect(VisitStats.EMPTY.withSession(OLDER_MS, 300)).toEqual({ lastVisitMs: OLDER_MS, totalFocusMs: 300 });
    });

    it('should never lower the last visit (out-of-order session close)', () => {
      // GIVEN stats whose last visit is newer than the added session
      const stats = new VisitStats(NEWER_MS, 100);
      // WHEN an older session is added
      // THEN the newer last visit is kept
      expect(stats.withSession(OLDER_MS, 50).lastVisitMs).toBe(NEWER_MS);
    });

    it('should add the session duration to the total', () => {
      expect(new VisitStats(OLDER_MS, 100).withSession(NEWER_MS, 50).totalFocusMs).toBe(150);
    });
  });
});
