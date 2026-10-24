import { FocusDurationSink } from './FocusDurationTracker';
import { VhV3DurationStore } from '../service/visitHistoryService/v3/VhV3DurationStore';
import { VisitStatsCache } from '../service/visitHistoryService/v3/VisitStatsCache';
import { DeviceNameProvider } from '../util/env/DeviceNameProvider';

/**
 * FocusDurationSink that persists completed sessions to the V3 store.
 *
 * Writes are SERIALIZED through one promise chain: session ends are
 * fire-and-forget (DOM/timer callbacks can't await), and two near-simultaneous
 * ends for the same doc must not interleave appends to the same file.
 * Errors are isolated per write — a failed append never breaks the chain.
 *
 * Each persisted session is also written through to the shared VisitStatsCache
 * (begin/end write-window protocol — see VisitStatsCache), so visit-stats
 * lookups see it without re-reading disk, and then announced via
 * {@link SessionPersistedListener} (open heatmaps re-render — they get no vault
 * event for VH writes, which live under a dot-folder the Vault API never sees).
 */
/** Told after each session is persisted (never on a failed write). Must never throw. */
export type SessionPersistedListener = () => void;

export class VhV3DurationRecorder implements FocusDurationSink {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly vhV3DurationStore: VhV3DurationStore,
    private readonly visitStatsCache: VisitStatsCache,
    private readonly deviceNameProvider: DeviceNameProvider,
    /** The PINNED user name — the recorder only exists once a name is pinned. */
    private readonly userName: string,
    private readonly onSessionPersisted: SessionPersistedListener,
  ) {
  }

  recordFocusDuration(docId: string, focusStartEpochMs: number, durationMs: number): void {
    this.writeChain = this.writeChain
      .then(async () => {
        this.visitStatsCache.beginSessionWrite(docId);
        try {
          await this.vhV3DurationStore.appendFocusDuration(
            this.userName,
            this.deviceNameProvider.getDeviceName(),
            docId,
            focusStartEpochMs,
            durationMs,
          );
        } catch (error) {
          // The append may have partially landed — drop the doc's cached
          // stats so nothing stale/partial survives (next lookup re-reads).
          this.visitStatsCache.abortSessionWrite(docId);
          throw error;
        }
        // Write-through AFTER the append succeeds: the cache must never
        // claim a visit that failed to persist.
        this.visitStatsCache.endSessionWrite(docId, focusStartEpochMs, durationMs);
        this.onSessionPersisted();
      })
      .catch((error) => {
        console.error(`[VHP][VhV3DurationRecorder] failed to record focus duration docId=[${docId}]`, error);
      });
  }

  /** Resolves when all writes queued so far have settled (tests, unload). */
  flush(): Promise<void> {
    return this.writeChain;
  }
}
