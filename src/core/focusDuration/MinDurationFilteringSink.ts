import { FocusDurationSink } from './FocusDurationTracker';

/**
 * Supplies the CURRENT minimum session length in ms to record. Read at every
 * record decision so a settings change applies live, without plugin reload.
 * 0 means "record everything" (filter disabled).
 */
export type MinRecordDurationMsProvider = () => number;

/**
 * A {@link FocusDurationSink} decorator that drops sessions shorter than the
 * configured minimum BEFORE they reach the real recorder — so a sub-threshold
 * session leaves NO trace at all (no `.vh_v3` line, no LastVisitCache/heatmap
 * bump). Quick in-and-out jumps into a note are thereby not counted as visits.
 *
 * WHY a decorator (not logic inside FocusDurationTracker or VhV3DurationRecorder):
 * the tracker's SRP is session boundaries and the recorder's SRP is persistence
 * mechanics; recording POLICY is a separate concern, composed in (OCP). Dropping
 * before the recorder automatically covers "no trace at all".
 *
 * The threshold is read live per call (`>=` is inclusive: an exactly-threshold
 * session records; a minimum of 0 forwards everything, including 0 ms).
 */
export class MinDurationFilteringSink implements FocusDurationSink {
  constructor(
    private readonly delegate: FocusDurationSink,
    private readonly getMinFocusMs: MinRecordDurationMsProvider,
  ) {}

  recordFocusDuration(docId: string, focusStartEpochMs: number, durationMs: number): void {
    if (durationMs < this.getMinFocusMs()) {
      return;
    }
    this.delegate.recordFocusDuration(docId, focusStartEpochMs, durationMs);
  }
}
