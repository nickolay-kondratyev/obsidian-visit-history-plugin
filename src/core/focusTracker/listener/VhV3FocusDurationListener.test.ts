import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VhV3FocusDurationListener } from './VhV3FocusDurationListener';
import { FocusEvent } from '../FocusTracker';
import { FocusDurationSink, FocusDurationTracker } from '../../focusDuration/FocusDurationTracker';
import { FakeDocIdService } from '../../../testSupport/fakes';
import { makeTFile } from '../../../testSupport/fileFactory';

function makeFocusEvent(path: string): FocusEvent {
  const file = makeTFile({ path });
  return { type: 'markdown', title: file.basename, file };
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
  const listener = new VhV3FocusDurationListener(docIdService, new FocusDurationTracker(sink));
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
      // WHEN it is unfocused
      await listener.onUnfocus(makeFocusEvent('notes/a.md'));
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
      // WHEN a same-leaf navigation lands on an id-less doc (focus only, no unfocus)
      await listener.onFocus(makeFocusEvent('draw.excalidraw'));
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

    it('should ignore focus events without a file path', async () => {
      // GIVEN an event with no file
      const { listener, sink } = setup();
      const event = { type: 'markdown', title: '?', file: undefined } as unknown as FocusEvent;
      // WHEN focused
      await listener.onFocus(event);
      // THEN nothing happened
      expect(sink.docIds).toEqual([]);
    });
  });
});
