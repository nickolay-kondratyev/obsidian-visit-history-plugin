import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VhV3FocusDurationListener } from './VhV3FocusDurationListener';
import { FocusEvent } from '../FocusTracker';
import {
  FocusDurationSink,
  FocusDurationTracker,
  UNFOCUS_GRACE_MS,
} from '../../focusDuration/FocusDurationTracker';
import { FakeDocIdService } from '../../../testSupport/fakes';
import { makeTFile } from '../../../testSupport/fileFactory';

// Window identity is by reference — one shared "main window" document.
const OWNER_DOC = { name: 'main-window-doc' } as unknown as Document;

function makeFocusEvent(path: string): FocusEvent {
  const file = makeTFile({ path });
  return { type: 'markdown', title: file.basename, file, ownerDocument: OWNER_DOC };
}

class RecordingSink implements FocusDurationSink {
  readonly docIds: string[] = [];

  recordFocusDuration(docId: string, _focusStartEpochMs: number, _durationMs: number): void {
    this.docIds.push(docId);
  }
}

interface Setup {
  listener: VhV3FocusDurationListener;
  docIdService: FakeDocIdService;
  sink: RecordingSink;
}

function setup(): Setup {
  const docIdService = new FakeDocIdService();
  const sink = new RecordingSink();
  const tracker = new FocusDurationTracker(sink, () => 180_000);
  // Mirrors WindowActivityMonitor's hasFocus() seeding at plugin load.
  tracker.onWindowFocused(OWNER_DOC);
  const listener = new VhV3FocusDurationListener(docIdService, tracker);
  return { listener, docIdService, sink };
}

describe('VhV3FocusDurationListener', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.parse('2026-07-09T22:00:00.000Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('onFocus / onUnfocus', () => {
    it('should record a session keyed by the resolved doc id', async () => {
      // GIVEN a note focused for 5s
      const { listener, sink } = setup();
      await listener.onFocus(makeFocusEvent('notes/a.md'));
      vi.advanceTimersByTime(5000);
      // WHEN it is unfocused and the unfocus grace resolves
      await listener.onUnfocus(makeFocusEvent('notes/a.md'));
      vi.advanceTimersByTime(UNFOCUS_GRACE_MS);
      // THEN the session was recorded under the doc id
      expect(sink.docIds).toEqual(['docid-for-notes_a.md']);
    });

    it('should record nothing for a doc that cannot carry an id', async () => {
      // GIVEN a raw .excalidraw file (no id location)
      const { listener, sink } = setup();
      await listener.onFocus(makeFocusEvent('draw.excalidraw'));
      vi.advanceTimersByTime(5000);
      // WHEN it is unfocused
      await listener.onUnfocus(makeFocusEvent('draw.excalidraw'));
      // THEN no session was recorded
      expect(sink.docIds).toEqual([]);
    });

    it('should close the running session when focus moves to an id-less doc without an unfocus event', async () => {
      // GIVEN a note session running
      const { listener, sink } = setup();
      await listener.onFocus(makeFocusEvent('notes/a.md'));
      vi.advanceTimersByTime(5000);
      // WHEN a same-leaf navigation lands on an id-less doc (focus only, no
      // unfocus) and the unfocus grace resolves
      await listener.onFocus(makeFocusEvent('draw.excalidraw'));
      vi.advanceTimersByTime(UNFOCUS_GRACE_MS);
      // THEN the note's session was closed (not left running forever)
      expect(sink.docIds).toEqual(['docid-for-notes_a.md']);
    });

    it('should skip (with console.error) a doc whose existing id is not filename-safe', async () => {
      // GIVEN a note carrying a pre-existing unsafe id
      const { listener, docIdService, sink } = setup();
      docIdService.seedId('notes/a.md', 'un/safe');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      // WHEN focused and unfocused
      await listener.onFocus(makeFocusEvent('notes/a.md'));
      await listener.onUnfocus(makeFocusEvent('notes/a.md'));
      // THEN nothing was recorded
      expect(sink.docIds).toEqual([]);
      errorSpy.mockRestore();
    });

    it('should close the running session when id resolution THROWS for the newly focused doc', async () => {
      // GIVEN a note session running
      const { listener, docIdService, sink } = setup();
      await listener.onFocus(makeFocusEvent('notes/a.md'));
      vi.advanceTimersByTime(5000);
      // WHEN focus moves (same-leaf, focus only) to a doc whose id resolution fails with an IO error
      docIdService.throwingPaths.add('notes/b.md');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await listener.onFocus(makeFocusEvent('notes/b.md'));
      vi.advanceTimersByTime(60_000);
      // THEN the note's session was closed at the focus switch — the failure
      // must not leave it accruing time while the user views the other doc
      expect(sink.docIds).toEqual(['docid-for-notes_a.md']);
      errorSpy.mockRestore();
    });

    it('should ignore focus events without a file path', async () => {
      // GIVEN an event with no file
      const { listener, sink } = setup();
      const event = {
        type: 'markdown', title: '?', file: undefined, ownerDocument: OWNER_DOC,
      } as unknown as FocusEvent;
      // WHEN focused
      await listener.onFocus(event);
      // THEN nothing happened
      expect(sink.docIds).toEqual([]);
    });
  });
});
