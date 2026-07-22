import { describe, expect, it } from 'vitest';
import { FocusDurationSink } from './FocusDurationTracker';
import { MinDurationFilteringSink } from './MinDurationFilteringSink';

interface RecordedSession {
  readonly docId: string;
  readonly focusStartEpochMs: number;
  readonly durationMs: number;
}

class RecordingSink implements FocusDurationSink {
  readonly records: RecordedSession[] = [];
  recordFocusDuration(docId: string, focusStartEpochMs: number, durationMs: number): void {
    this.records.push({ docId, focusStartEpochMs, durationMs });
  }
}

describe(MinDurationFilteringSink.name, () => {
  describe('recordFocusDuration', () => {
    it('should delegate when the duration is above the minimum', () => {
      // GIVEN a minimum of 2000 ms and a 2001 ms session
      const delegate = new RecordingSink();
      const sink = new MinDurationFilteringSink(delegate, () => 2000);
      // WHEN recording
      sink.recordFocusDuration('doc', 100, 2001);
      // THEN the session is forwarded to the delegate
      expect(delegate.records).toHaveLength(1);
    });

    it('should delegate when the duration exactly equals the minimum (inclusive boundary)', () => {
      // GIVEN a minimum of 2000 ms and an exactly-2000 ms session
      const delegate = new RecordingSink();
      const sink = new MinDurationFilteringSink(delegate, () => 2000);
      // WHEN recording
      sink.recordFocusDuration('doc', 100, 2000);
      // THEN the at-threshold session is forwarded (>= is inclusive)
      expect(delegate.records).toHaveLength(1);
    });

    it('should drop when the duration is below the minimum', () => {
      // GIVEN a minimum of 2000 ms and a 1999 ms session
      const delegate = new RecordingSink();
      const sink = new MinDurationFilteringSink(delegate, () => 2000);
      // WHEN recording
      sink.recordFocusDuration('doc', 100, 1999);
      // THEN nothing reaches the delegate (no trace at all)
      expect(delegate.records).toHaveLength(0);
    });

    it('should delegate a zero-duration session when the minimum is zero (filter disabled)', () => {
      // GIVEN a minimum of 0 and a 0 ms session
      const delegate = new RecordingSink();
      const sink = new MinDurationFilteringSink(delegate, () => 0);
      // WHEN recording
      sink.recordFocusDuration('doc', 100, 0);
      // THEN it is forwarded (0 disables the filter — record everything)
      expect(delegate.records).toHaveLength(1);
    });

    it('should re-read the threshold on every call (live settings change)', () => {
      // GIVEN a threshold that changes between calls
      const delegate = new RecordingSink();
      let minMs = 5000;
      const sink = new MinDurationFilteringSink(delegate, () => minMs);
      // first call is below the (high) threshold → dropped
      sink.recordFocusDuration('doc', 100, 3000);
      // WHEN the threshold drops and the same duration is recorded again
      minMs = 1000;
      sink.recordFocusDuration('doc', 100, 3000);
      // THEN only the second (now above-threshold) call is forwarded
      expect(delegate.records).toHaveLength(1);
    });

    it('should pass the arguments through verbatim when delegating', () => {
      // GIVEN a delegating call
      const delegate = new RecordingSink();
      const sink = new MinDurationFilteringSink(delegate, () => 0);
      // WHEN recording with specific arguments
      sink.recordFocusDuration('doc-xyz', 1_700_000_000_000, 4242);
      // THEN the delegate receives them unchanged
      expect(delegate.records[0]).toEqual({
        docId: 'doc-xyz',
        focusStartEpochMs: 1_700_000_000_000,
        durationMs: 4242,
      });
    });
  });
});
