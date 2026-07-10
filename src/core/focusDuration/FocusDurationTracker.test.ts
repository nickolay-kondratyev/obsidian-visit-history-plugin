import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusDurationSink, FocusDurationTracker } from './FocusDurationTracker';

const T0 = Date.parse('2026-07-09T22:00:00.000Z');
const IDLE_MS = FocusDurationTracker.IDLE_TIMEOUT_MS;

interface RecordedSession {
  docId: string;
  focusStartEpochMs: number;
  durationMs: number;
}

class RecordingSink implements FocusDurationSink {
  readonly records: RecordedSession[] = [];

  recordFocusDuration(docId: string, focusStartEpochMs: number, durationMs: number): void {
    this.records.push({ docId, focusStartEpochMs, durationMs });
  }
}

describe('FocusDurationTracker', () => {
  let sink: RecordingSink;
  let tracker: FocusDurationTracker;

  beforeEach(() => {
    vi.useFakeTimers({ now: T0 });
    sink = new RecordingSink();
    tracker = new FocusDurationTracker(sink);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Advances both the mocked clock and pending timers. */
  function advanceMs(ms: number): void {
    vi.advanceTimersByTime(ms);
  }

  describe('navigation', () => {
    it('should record the duration when the doc is unfocused', () => {
      // GIVEN doc A focused for 5600ms
      tracker.onDocFocused('A');
      advanceMs(5600);
      // WHEN the user navigates away
      tracker.onDocUnfocused();
      // THEN one session is recorded with the focus-start stamp and duration
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 5600 }]);
    });

    it('should close the running session when another doc is focused without an unfocus event (same-leaf navigation)', () => {
      // GIVEN doc A focused
      tracker.onDocFocused('A');
      advanceMs(1000);
      // WHEN doc B is focused directly
      tracker.onDocFocused('B');
      // THEN A's session was closed
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 1000 }]);
    });

    it('should NOT fragment the session on duplicate focus events for the same doc', () => {
      // GIVEN doc A focused
      tracker.onDocFocused('A');
      advanceMs(1000);
      // WHEN Obsidian fires a duplicate focus event for A, then A is unfocused later
      tracker.onDocFocused('A');
      advanceMs(1000);
      tracker.onDocUnfocused();
      // THEN a single unfragmented session covers the whole time
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 2000 }]);
    });

    it('should record A -> B -> A as three separate sessions', () => {
      // GIVEN a navigation pathway A -> B -> A
      tracker.onDocFocused('A');
      advanceMs(100);
      tracker.onDocUnfocused();
      tracker.onDocFocused('B');
      advanceMs(200);
      tracker.onDocUnfocused();
      tracker.onDocFocused('A');
      advanceMs(300);
      // WHEN the last doc is unfocused
      tracker.onDocUnfocused();
      // THEN all three sessions are recorded
      expect(sink.records.map(r => `${r.docId}:${r.durationMs}`)).toEqual(['A:100', 'B:200', 'A:300']);
    });
  });

  describe('window focus', () => {
    it('should record the duration when the Obsidian window loses focus', () => {
      // GIVEN doc A focused for 3000ms
      tracker.onDocFocused('A');
      advanceMs(3000);
      // WHEN the window blurs
      tracker.onWindowBlurred();
      // THEN the session is closed
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 3000 }]);
    });

    it('should start a NEW session for the same doc when the window regains focus', () => {
      // GIVEN doc A's first session was closed by a blur
      tracker.onDocFocused('A');
      advanceMs(3000);
      tracker.onWindowBlurred();
      advanceMs(10_000);
      // WHEN the window refocuses and the doc is later unfocused
      tracker.onWindowFocused();
      advanceMs(2000);
      tracker.onDocUnfocused();
      // THEN a second session exists, starting at the refocus moment
      expect(sink.records[1]).toEqual({ docId: 'A', focusStartEpochMs: T0 + 13_000, durationMs: 2000 });
    });

    it('should record nothing on blur when no doc is focused', () => {
      // GIVEN no focused doc
      // WHEN the window blurs
      tracker.onWindowBlurred();
      // THEN nothing is recorded
      expect(sink.records).toEqual([]);
    });

    it('should ignore a duplicate window-focus event (no phantom session end)', () => {
      // GIVEN doc A focused with the window already focused
      tracker.onDocFocused('A');
      advanceMs(1000);
      // WHEN a redundant window-focus event fires and the doc is unfocused later
      tracker.onWindowFocused();
      advanceMs(1000);
      tracker.onDocUnfocused();
      // THEN there is still exactly one unfragmented session
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 2000 }]);
    });

    it('should not open a session while the window is blurred even if a doc gains focus', () => {
      // GIVEN a blurred window
      tracker.onWindowBlurred();
      // WHEN a doc gains focus and is unfocused while still blurred
      tracker.onDocFocused('A');
      advanceMs(1000);
      tracker.onDocUnfocused();
      // THEN nothing is recorded
      expect(sink.records).toEqual([]);
    });

    it('should start the session at window refocus for a doc focused while blurred', () => {
      // GIVEN a doc focused while the window was blurred
      tracker.onWindowBlurred();
      tracker.onDocFocused('A');
      advanceMs(5000);
      // WHEN the window refocuses and the doc is unfocused later
      tracker.onWindowFocused();
      advanceMs(700);
      tracker.onDocUnfocused();
      // THEN the session covers only the window-focused stretch
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0 + 5000, durationMs: 700 }]);
    });
  });

  describe('idle timeout', () => {
    it('should auto-close the session after the idle timeout, ending at the LAST interaction', () => {
      // GIVEN doc A focused, last interaction 60s in
      tracker.onDocFocused('A');
      advanceMs(60_000);
      tracker.onUserActivity();
      // WHEN the full idle timeout elapses with no interaction
      advanceMs(IDLE_MS);
      // THEN the session is closed with duration up to the last interaction only
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 60_000 }]);
    });

    it('should keep the session alive while the user keeps interacting', () => {
      // GIVEN doc A focused with interaction every 2 minutes
      tracker.onDocFocused('A');
      for (let i = 0; i < 5; i++) {
        advanceMs(2 * 60_000);
        tracker.onUserActivity();
      }
      // WHEN the doc is unfocused after 10 minutes
      tracker.onDocUnfocused();
      // THEN a single 10-minute session was recorded (idle never fired)
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 10 * 60_000 }]);
    });

    it('should start a NEW session when the user interacts again after an idle auto-close', () => {
      // GIVEN doc A was auto-closed by idle
      tracker.onDocFocused('A');
      advanceMs(IDLE_MS);
      // WHEN the user interacts again and later unfocuses
      tracker.onUserActivity();
      advanceMs(30_000);
      tracker.onDocUnfocused();
      // THEN the resumed session starts at the interaction moment
      expect(sink.records[1]).toEqual({ docId: 'A', focusStartEpochMs: T0 + IDLE_MS, durationMs: 30_000 });
    });

    it('should record an idle session immediately after focus with zero duration', () => {
      // GIVEN doc A focused and never touched
      tracker.onDocFocused('A');
      // WHEN the idle timeout elapses
      advanceMs(IDLE_MS);
      // THEN the session ends at its start (last "interaction" = session start)
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 0 }]);
    });

    it('should not double-record when the doc is unfocused after an idle auto-close', () => {
      // GIVEN doc A auto-closed by idle
      tracker.onDocFocused('A');
      advanceMs(IDLE_MS);
      // WHEN an unfocus arrives later without any interaction in between
      tracker.onDocUnfocused();
      // THEN only the idle close was recorded
      expect(sink.records).toHaveLength(1);
    });
  });

  describe('dispose', () => {
    it('should flush the open session on dispose', () => {
      // GIVEN doc A focused for 42s
      tracker.onDocFocused('A');
      advanceMs(4200);
      // WHEN the plugin unloads
      tracker.dispose();
      // THEN the session was flushed
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 4200 }]);
    });

    it('should record nothing on dispose when no session is open', () => {
      // GIVEN no focused doc
      // WHEN the plugin unloads
      tracker.dispose();
      // THEN nothing is recorded
      expect(sink.records).toEqual([]);
    });
  });
});
