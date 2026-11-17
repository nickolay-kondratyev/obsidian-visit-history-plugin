import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { VhV3FocusDurationListener } from './VhV3FocusDurationListener';
import { FocusEvent } from '../FocusTracker';
import {
  FocusDurationSink,
  FocusDurationTracker,
  UNFOCUS_GRACE_MS,
} from '../../focusDuration/FocusDurationTracker';
import { MinDurationFilteringSink } from '../../focusDuration/MinDurationFilteringSink';
import { VhV3DurationRecorder } from '../../focusDuration/VhV3DurationRecorder';
import { VhV3DurationStore } from '../../service/visitHistoryService/v3/VhV3DurationStore';
import { VisitStatsCache } from '../../service/visitHistoryService/v3/VisitStatsCache';
import { FakeHiddenFileUtil } from '../../../testSupport/FakeHiddenFileUtil';
import { FakeDocIdService, FixedDeviceNameProvider } from '../../../testSupport/fakes';
import { makeTFile } from '../../../testSupport/fileFactory';

// Window identity is by reference — one shared "main window" document.
const OWNER_DOC = { name: 'main-window-doc' } as unknown as Document;
const POPOUT_DOC = { name: 'popout-window-doc' } as unknown as Document;
const IDLE_MS = 180_000;
const MIN_FOCUS_MS = 2000;

function focusEventFor(file: TFile, ownerDocument: Document = OWNER_DOC): FocusEvent {
  return { type: 'markdown', title: file.basename, file, ownerDocument };
}

class RecordingSink implements FocusDurationSink<TFile> {
  /** `${path}:${durationMs}` per record. */
  readonly sessions: string[] = [];

  recordFocusDuration(file: TFile, _focusStartEpochMs: number, durationMs: number): void {
    this.sessions.push(`${file.path}:${durationMs}`);
  }
}

interface Setup {
  listener: VhV3FocusDurationListener;
  tracker: FocusDurationTracker<TFile>;
  sink: RecordingSink;
}

function setup(): Setup {
  const sink = new RecordingSink();
  // setup() is called inside each test (after vi.useFakeTimers), so this
  // shorthand captures the FAKE clock; advanceTimersByTime drives the tracker.
  const tracker = new FocusDurationTracker<TFile>(sink, () => IDLE_MS, { setTimeout, clearTimeout });
  // Mirrors WindowActivityMonitor's hasFocus() seeding at plugin load.
  tracker.onWindowFocused(OWNER_DOC);
  const listener = new VhV3FocusDurationListener(tracker);
  return { listener, tracker, sink };
}

interface RecordingChainSetup {
  listener: VhV3FocusDurationListener;
  recorder: VhV3DurationRecorder;
  docIds: FakeDocIdService;
}

/** The production sink chain: tracker → min-focus filter → recorder (record-time id). */
function setupRecordingChain(): RecordingChainSetup {
  const docIds = new FakeDocIdService();
  const recorder = new VhV3DurationRecorder(
    new VhV3DurationStore(new FakeHiddenFileUtil()),
    new VisitStatsCache(),
    new FixedDeviceNameProvider('host'),
    'alice',
    (file) => docIds.ensureDocId(file),
    () => undefined,
  );
  const tracker = new FocusDurationTracker<TFile>(
    new MinDurationFilteringSink(recorder, () => MIN_FOCUS_MS),
    () => IDLE_MS,
    { setTimeout, clearTimeout },
  );
  tracker.onWindowFocused(OWNER_DOC);
  return { listener: new VhV3FocusDurationListener(tracker), recorder, docIds };
}

describe('VhV3FocusDurationListener', () => {
  const noteA = makeTFile({ path: 'notes/a.md' });
  const drawing = makeTFile({ path: 'draw.excalidraw' });

  beforeEach(() => {
    vi.useFakeTimers({ now: Date.parse('2026-07-09T22:00:00.000Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('onFocus / onUnfocus', () => {
    it('should record a session keyed by the focused file', async () => {
      // GIVEN a note focused for 5s
      const { listener, sink } = setup();
      await listener.onFocus(focusEventFor(noteA));
      vi.advanceTimersByTime(5000);
      // WHEN it is unfocused and the unfocus grace resolves
      await listener.onUnfocus(focusEventFor(noteA));
      vi.advanceTimersByTime(UNFOCUS_GRACE_MS);
      // THEN the session was recorded for that file
      expect(sink.sessions).toEqual(['notes/a.md:5000']);
    });

    it('should close the running session when focus moves to another doc without an unfocus event', async () => {
      // GIVEN a note session running
      const { listener, sink } = setup();
      await listener.onFocus(focusEventFor(noteA));
      vi.advanceTimersByTime(5000);
      // WHEN a same-leaf navigation lands on another doc (focus only, no unfocus)
      await listener.onFocus(focusEventFor(drawing));
      vi.advanceTimersByTime(60_000);
      // THEN the note's session was closed at the switch (not left accruing)
      expect(sink.sessions).toEqual(['notes/a.md:5000']);
    });

    it('should key the session to the event ownerDocument window (popout)', async () => {
      // GIVEN a focused popout window alongside the focused main window
      const { listener, tracker, sink } = setup();
      tracker.onWindowFocused(POPOUT_DOC);
      // WHEN a note hosted in the popout is focused for 5s and the POPOUT blurs
      await listener.onFocus(focusEventFor(noteA, POPOUT_DOC));
      vi.advanceTimersByTime(5000);
      tracker.onWindowBlurred(POPOUT_DOC);
      // THEN the session closed at the popout's blur — the tracker got the popout as the hosting window
      expect(sink.sessions).toEqual(['notes/a.md:5000']);
    });

    it('should ignore focus events without a file path', async () => {
      // GIVEN an event with no file
      const { listener, tracker, sink } = setup();
      const event = {
        type: 'markdown', title: '?', file: undefined, ownerDocument: OWNER_DOC,
      } as unknown as FocusEvent;
      // WHEN focused, and the plugin later unloads (flushing any opened session)
      await listener.onFocus(event);
      vi.advanceTimersByTime(5000);
      tracker.dispose();
      // THEN nothing happened
      expect(sink.sessions).toEqual([]);
    });
  });

  describe('with the recording sink chain (record-time doc id)', () => {
    it('should not touch the doc id while the note is focused', async () => {
      // GIVEN the production sink chain
      const { listener, recorder, docIds } = setupRecordingChain();
      // WHEN an id-less note is focused for a while (session still open)
      await listener.onFocus(focusEventFor(noteA));
      vi.advanceTimersByTime(30_000);
      await recorder.flush();
      // THEN no id was ensured — focusing must not modify the note
      expect(docIds.ensuredPaths).toEqual([]);
    });

    it('should assign the doc id once the session is recorded', async () => {
      // GIVEN an id-less note focused longer than the min focus time
      const { listener, recorder, docIds } = setupRecordingChain();
      await listener.onFocus(focusEventFor(noteA));
      vi.advanceTimersByTime(MIN_FOCUS_MS + 1000);
      // WHEN it is left and the unfocus grace resolves (session recorded)
      await listener.onUnfocus(focusEventFor(noteA));
      vi.advanceTimersByTime(UNFOCUS_GRACE_MS);
      await recorder.flush();
      // THEN its id was ensured exactly once, at record time
      expect(docIds.ensuredPaths).toEqual(['notes/a.md']);
    });

    it('should never assign a doc id for a session below the min focus time', async () => {
      // GIVEN an id-less note focused SHORTER than the min focus time
      const { listener, recorder, docIds } = setupRecordingChain();
      await listener.onFocus(focusEventFor(noteA));
      vi.advanceTimersByTime(MIN_FOCUS_MS - 1);
      // WHEN it is left and the unfocus grace resolves (session dropped)
      await listener.onUnfocus(focusEventFor(noteA));
      vi.advanceTimersByTime(UNFOCUS_GRACE_MS);
      await recorder.flush();
      // THEN no id was ensured — the quick visit leaves the note untouched
      expect(docIds.ensuredPaths).toEqual([]);
    });
  });
});
