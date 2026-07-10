import { FocusDurationSink } from './FocusDurationTracker';
import { VhV3DurationStore } from '../service/visitHistoryService/v3/VhV3DurationStore';
import { DeviceNameProvider } from '../util/env/DeviceNameProvider';

/**
 * FocusDurationSink that persists completed sessions to the V3 store.
 *
 * Writes are SERIALIZED through one promise chain: session ends are
 * fire-and-forget (DOM/timer callbacks can't await), and two near-simultaneous
 * ends for the same doc must not interleave appends to the same file.
 * Errors are isolated per write — a failed append never breaks the chain.
 */
export class VhV3DurationRecorder implements FocusDurationSink {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly vhV3DurationStore: VhV3DurationStore,
    private readonly deviceNameProvider: DeviceNameProvider,
  ) {
  }

  recordFocusDuration(docId: string, focusStartEpochMs: number, durationMs: number): void {
    this.writeChain = this.writeChain
      .then(() => this.vhV3DurationStore.appendFocusDuration(
        this.deviceNameProvider.getDeviceName(),
        docId,
        focusStartEpochMs,
        durationMs,
      ))
      .catch((error) => {
        console.error(`[VHP][VhV3DurationRecorder] failed to record focus duration docId=[${docId}]`, error);
      });
  }

  /** Resolves when all writes queued so far have settled (tests, unload). */
  flush(): Promise<void> {
    return this.writeChain;
  }
}
