import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusDurationSink, FocusDurationTracker, WindowHandle } from './FocusDurationTracker';

const T0 = Date.parse('2026-07-09T22:00:00.000Z');
// Test default mirroring DEFAULT_IDLE_TIMEOUT_SECONDS (3 minutes).
const IDLE_MS = 180_000;

// Window identity is by reference — named objects keep the tests readable.
const MAIN_WIN: WindowHandle = { name: 'main-window' };
const POPOUT_1: WindowHandle = { name: 'popout-1' };
const POPOUT_2: WindowHandle = { name: 'popout-2' };

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
  // Mutable so tests can change the timeout mid-run (settings are live-read).
  let idleTimeoutMs: number;

  beforeEach(() => {
    vi.useFakeTimers({ now: T0 });
    sink = new RecordingSink();
    idleTimeoutMs = IDLE_MS;
    tracker = new FocusDurationTracker(sink, () => idleTimeoutMs);
    // Mirrors WindowActivityMonitor's hasFocus() seeding at plugin load.
    tracker.onWindowFocused(MAIN_WIN);
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
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(5600);
      // WHEN the user navigates away
      tracker.onDocUnfocused();
      // THEN one session is recorded with the focus-start stamp and duration
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 5600 }]);
    });

    it('should close the running session when another doc is focused without an unfocus event (same-leaf navigation)', () => {
      // GIVEN doc A focused
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(1000);
      // WHEN doc B is focused directly
      tracker.onDocFocused('B', MAIN_WIN);
      // THEN A's session was closed
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 1000 }]);
    });

    it('should NOT fragment the session on duplicate focus events for the same doc', () => {
      // GIVEN doc A focused
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(1000);
      // WHEN Obsidian fires a duplicate focus event for A, then A is unfocused later
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(1000);
      tracker.onDocUnfocused();
      // THEN a single unfragmented session covers the whole time
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 2000 }]);
    });

    it('should record A -> B -> A as three separate sessions', () => {
      // GIVEN a navigation pathway A -> B -> A
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(100);
      tracker.onDocUnfocused();
      tracker.onDocFocused('B', MAIN_WIN);
      advanceMs(200);
      tracker.onDocUnfocused();
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(300);
      // WHEN the last doc is unfocused
      tracker.onDocUnfocused();
      // THEN all three sessions are recorded
      expect(sink.records.map(r => `${r.docId}:${r.durationMs}`)).toEqual(['A:100', 'B:200', 'A:300']);
    });
  });

  describe('window focus (single window)', () => {
    it('should record the duration when the Obsidian window loses focus', () => {
      // GIVEN doc A focused for 3000ms
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(3000);
      // WHEN the window blurs
      tracker.onWindowBlurred(MAIN_WIN);
      // THEN the session is closed
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 3000 }]);
    });

    it('should start a NEW session for the same doc when the window regains focus', () => {
      // GIVEN doc A's first session was closed by a blur
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(3000);
      tracker.onWindowBlurred(MAIN_WIN);
      advanceMs(10_000);
      // WHEN the window refocuses and the doc is later unfocused
      tracker.onWindowFocused(MAIN_WIN);
      advanceMs(2000);
      tracker.onDocUnfocused();
      // THEN a second session exists, starting at the refocus moment
      expect(sink.records[1]).toEqual({ docId: 'A', focusStartEpochMs: T0 + 13_000, durationMs: 2000 });
    });

    it('should record nothing on blur when no doc is focused', () => {
      // GIVEN no focused doc
      // WHEN the window blurs
      tracker.onWindowBlurred(MAIN_WIN);
      // THEN nothing is recorded
      expect(sink.records).toEqual([]);
    });

    it('should ignore a duplicate window-focus event (no phantom session end)', () => {
      // GIVEN doc A focused with the window already focused
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(1000);
      // WHEN a redundant window-focus event fires and the doc is unfocused later
      tracker.onWindowFocused(MAIN_WIN);
      advanceMs(1000);
      tracker.onDocUnfocused();
      // THEN there is still exactly one unfragmented session
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 2000 }]);
    });

    it('should not open a session while the window is blurred even if a doc gains focus', () => {
      // GIVEN a blurred window
      tracker.onWindowBlurred(MAIN_WIN);
      // WHEN a doc gains focus and is unfocused while still blurred
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(1000);
      tracker.onDocUnfocused();
      // THEN nothing is recorded
      expect(sink.records).toEqual([]);
    });

    it('should start the session at window refocus for a doc focused while blurred', () => {
      // GIVEN a doc focused while the window was blurred
      tracker.onWindowBlurred(MAIN_WIN);
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(5000);
      // WHEN the window refocuses and the doc is unfocused later
      tracker.onWindowFocused(MAIN_WIN);
      advanceMs(700);
      tracker.onDocUnfocused();
      // THEN the session covers only the window-focused stretch
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0 + 5000, durationMs: 700 }]);
    });
  });

  describe('popout windows', () => {
    it('should close the session when the doc\'s popout blurs because focus moved to ANOTHER popout', () => {
      // GIVEN doc X focused in popout 1 for 4s
      tracker.onWindowFocused(POPOUT_1);
      tracker.onDocFocused('X', POPOUT_1);
      advanceMs(4000);
      // WHEN OS focus moves to popout 2 (blur fires on popout 1)
      tracker.onWindowBlurred(POPOUT_1);
      tracker.onWindowFocused(POPOUT_2);
      // THEN X's session was recorded at the blur — the popout is unfocused
      expect(sink.records).toEqual([{ docId: 'X', focusStartEpochMs: T0, durationMs: 4000 }]);
    });

    it('should NOT revive the old doc when an unrelated window gains focus (no spurious session)', () => {
      // GIVEN doc X's popout-1 session was closed by blur
      tracker.onWindowFocused(POPOUT_1);
      tracker.onDocFocused('X', POPOUT_1);
      advanceMs(4000);
      tracker.onWindowBlurred(POPOUT_1);
      // WHEN popout 2 gains focus and its doc Y becomes active, then unfocuses
      tracker.onWindowFocused(POPOUT_2);
      tracker.onDocFocused('Y', POPOUT_2);
      advanceMs(2500);
      tracker.onDocUnfocused();
      // THEN exactly [X, Y] — no spurious X session at the switch moment
      expect(sink.records.map(r => `${r.docId}:${r.durationMs}`)).toEqual(['X:4000', 'Y:2500']);
    });

    it('should close the session even when the new window\'s focus event arrives BEFORE the old one\'s blur', () => {
      // GIVEN doc X focused in popout 1
      tracker.onWindowFocused(POPOUT_1);
      tracker.onDocFocused('X', POPOUT_1);
      advanceMs(4000);
      // WHEN events arrive reordered: focus(popout 2) first, then blur(popout 1)
      tracker.onWindowFocused(POPOUT_2);
      tracker.onWindowBlurred(POPOUT_1);
      // THEN X still closed at ITS window's blur
      expect(sink.records).toEqual([{ docId: 'X', focusStartEpochMs: T0, durationMs: 4000 }]);
    });

    it('should reopen the session when the doc\'s OWN popout regains focus', () => {
      // GIVEN doc X in popout 1, session closed by switching to popout 2
      tracker.onWindowFocused(POPOUT_1);
      tracker.onDocFocused('X', POPOUT_1);
      advanceMs(1000);
      tracker.onWindowBlurred(POPOUT_1);
      tracker.onWindowFocused(POPOUT_2);
      advanceMs(9000);
      // WHEN focus returns to popout 1 (X still its active doc) and X unfocuses later
      tracker.onWindowBlurred(POPOUT_2);
      tracker.onWindowFocused(POPOUT_1);
      advanceMs(600);
      tracker.onDocUnfocused();
      // THEN a second X session starts at the popout's refocus
      expect(sink.records[1]).toEqual({ docId: 'X', focusStartEpochMs: T0 + 10_000, durationMs: 600 });
    });

    it('should keep the session running when the doc is MOVED to another window (tab dragged out)', () => {
      // GIVEN doc A focused in the main window
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(1000);
      // WHEN A is dragged out to a popout (same doc, new window) and the main
      // window subsequently blurs
      tracker.onWindowFocused(POPOUT_1);
      tracker.onDocFocused('A', POPOUT_1);
      tracker.onWindowBlurred(MAIN_WIN);
      advanceMs(2000);
      tracker.onDocUnfocused();
      // THEN one continuous session — the main window's blur did not cut it
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 3000 }]);
    });

    it('should close the session when a closing popout reports blur (window-close)', () => {
      // GIVEN doc X focused in popout 1
      tracker.onWindowFocused(POPOUT_1);
      tracker.onDocFocused('X', POPOUT_1);
      advanceMs(7000);
      // WHEN the popout window is closed (monitor forwards it as a blur)
      tracker.onWindowBlurred(POPOUT_1);
      // THEN the duration was recorded
      expect(sink.records).toEqual([{ docId: 'X', focusStartEpochMs: T0, durationMs: 7000 }]);
    });

    it('should not reopen on user activity while the doc\'s window is unfocused', () => {
      // GIVEN doc X's popout-1 session closed by switching to popout 2
      tracker.onWindowFocused(POPOUT_1);
      tracker.onDocFocused('X', POPOUT_1);
      tracker.onWindowBlurred(POPOUT_1);
      tracker.onWindowFocused(POPOUT_2);
      sink.records.length = 0;
      // WHEN the user is active in popout 2 (no leaf change yet) and time passes
      tracker.onUserActivity();
      advanceMs(1000);
      tracker.onUserActivity();
      // THEN no session was revived for X
      expect(sink.records).toEqual([]);
    });
  });

  describe('idle timeout', () => {
    it('should auto-close the session after the idle timeout, ending at the LAST interaction', () => {
      // GIVEN doc A focused, last interaction 60s in
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(60_000);
      tracker.onUserActivity();
      // WHEN the full idle timeout elapses with no interaction
      advanceMs(IDLE_MS);
      // THEN the session is closed with duration up to the last interaction only
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 60_000 }]);
    });

    it('should keep the session alive while the user keeps interacting', () => {
      // GIVEN doc A focused with interaction every 2 minutes
      tracker.onDocFocused('A', MAIN_WIN);
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
      tracker.onDocFocused('A', MAIN_WIN);
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
      tracker.onDocFocused('A', MAIN_WIN);
      // WHEN the idle timeout elapses
      advanceMs(IDLE_MS);
      // THEN the session ends at its start (last "interaction" = session start)
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 0 }]);
    });

    it('should not double-record when the doc is unfocused after an idle auto-close', () => {
      // GIVEN doc A auto-closed by idle
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(IDLE_MS);
      // WHEN an unfocus arrives later without any interaction in between
      tracker.onDocUnfocused();
      // THEN only the idle close was recorded
      expect(sink.records).toHaveLength(1);
    });

    it('should honor a custom (shorter) configured idle timeout', () => {
      // GIVEN the idle timeout is configured to 10s
      idleTimeoutMs = 10_000;
      tracker.onDocFocused('A', MAIN_WIN);
      // WHEN 10s pass without interaction
      advanceMs(10_000);
      // THEN the session was auto-closed already
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 0 }]);
    });

    it('should apply a settings change to an ALREADY-RUNNING session (live read)', () => {
      // GIVEN a session started under the default timeout, active 60s in
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(60_000);
      tracker.onUserActivity();
      // WHEN the user shortens the timeout to 10s and goes idle
      idleTimeoutMs = 10_000;
      advanceMs(IDLE_MS);
      // THEN the session still closed at the last interaction (idle enforced
      // with the new threshold as soon as a timer check runs)
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 60_000 }]);
    });
  });

  describe('OS sleep (clock jumps past the idle timer without it firing)', () => {
    /** Simulates suspend: the clock jumps but NO timers fire during the gap. */
    function sleepMs(ms: number): void {
      vi.setSystemTime(Date.now() + ms);
    }

    it('should end the pre-sleep session at the last interaction when the user interacts after waking', () => {
      // GIVEN doc A focused, last interaction 60s in, then the machine sleeps 8h
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(60_000);
      tracker.onUserActivity();
      sleepMs(8 * 60 * 60_000);
      // WHEN the user interacts on wake (before the stale idle timer fires)
      tracker.onUserActivity();
      // THEN the pre-sleep session was closed at the last interaction — the
      // sleep gap is NOT counted
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 60_000 }]);
    });

    it('should start a NEW session at the wake interaction', () => {
      // GIVEN doc A focused, then the machine sleeps 8h
      tracker.onDocFocused('A', MAIN_WIN);
      sleepMs(8 * 60 * 60_000);
      const wakeMs = Date.now();
      // WHEN the user interacts on wake and unfocuses 30s later
      tracker.onUserActivity();
      advanceMs(30_000);
      tracker.onDocUnfocused();
      // THEN the resumed session starts at the wake interaction
      expect(sink.records[1]).toEqual({ docId: 'A', focusStartEpochMs: wakeMs, durationMs: 30_000 });
    });

    it('should cap the duration at the last interaction when the doc is unfocused right after waking', () => {
      // GIVEN doc A focused, last interaction 45s in, then the machine sleeps 8h
      tracker.onDocFocused('A', MAIN_WIN);
      advanceMs(45_000);
      tracker.onUserActivity();
      sleepMs(8 * 60 * 60_000);
      // WHEN the first post-wake event is navigation away (no interaction first)
      tracker.onDocUnfocused();
      // THEN the sleep gap is NOT counted
      expect(sink.records).toEqual([{ docId: 'A', focusStartEpochMs: T0, durationMs: 45_000 }]);
    });
  });

  describe('dispose', () => {
    it('should flush the open session on dispose', () => {
      // GIVEN doc A focused for 42s
      tracker.onDocFocused('A', MAIN_WIN);
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
