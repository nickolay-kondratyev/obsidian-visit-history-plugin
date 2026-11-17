import { TFile } from 'obsidian';
import { FocusDurationSink } from './FocusDurationTracker';
import { VhV3DurationStore } from '../service/visitHistoryService/v3/VhV3DurationStore';
import { VisitStatsCache } from '../service/visitHistoryService/v3/VisitStatsCache';
import { DocIdFilenameSafety } from '../service/visitHistoryService/DocIdFilenameSafety';
import { DeviceNameProvider } from '../util/env/DeviceNameProvider';

/** Told after each session is persisted (never on a failed write). Must never throw. */
export type SessionPersistedListener = () => void;

/**
 * Returns the file's doc id, ASSIGNING (writing) one when missing; null when
 * the file cannot carry one (e.g. raw `.excalidraw`, unusable id slot).
 * Production: `DocIdService.ensureDocId`.
 */
export type RecordTimeDocIdResolver = (file: TFile) => Promise<string | null>;

/**
 * FocusDurationSink that persists completed sessions to the V3 store, keyed
 * by the doc id it resolves AT RECORD TIME.
 *
 * WHY record time (not focus time): merely focusing a note must never modify
 * it — an external editor (e.g. an AI agent) creating/editing the file while
 * Obsidian shows it would otherwise race our id write. Composed AFTER the
 * min-focus filter, so a dropped (too short) session never assigns an id.
 * Accepted ceilings: a file deleted while focused that had no id yet loses
 * that session (the id write fails → dropped); the id write can still race an
 * external edit when the file is open at the moment its session closes.
 *
 * Writes — id resolution included — are SERIALIZED through one promise chain:
 * session ends are fire-and-forget (DOM/timer callbacks can't await), two
 * near-simultaneous ends for the same doc must not interleave appends to the
 * same file, and flush() must cover the id write (inline note relies on it).
 * Errors are isolated per write — a failed resolution or append never breaks
 * the chain.
 *
 * Each persisted session is also written through to the shared VisitStatsCache
 * (begin/end write-window protocol — see VisitStatsCache), so visit-stats
 * lookups see it without re-reading disk, and then announced via
 * {@link SessionPersistedListener} (open heatmaps re-render — they get no vault
 * event for VH writes, which live under a dot-folder the Vault API never sees).
 */
export class VhV3DurationRecorder implements FocusDurationSink<TFile> {
  private writeChain: Promise<void> = Promise.resolve();

  constructor(
    private readonly vhV3DurationStore: VhV3DurationStore,
    private readonly visitStatsCache: VisitStatsCache,
    private readonly deviceNameProvider: DeviceNameProvider,
    /** The PINNED user name — the recorder only exists once a name is pinned. */
    private readonly userName: string,
    private readonly resolveDocId: RecordTimeDocIdResolver,
    private readonly onSessionPersisted: SessionPersistedListener,
  ) {
  }

  recordFocusDuration(file: TFile, focusStartEpochMs: number, durationMs: number): void {
    this.writeChain = this.writeChain
      .then(() => this.persist(file, focusStartEpochMs, durationMs))
      .catch((error) => {
        console.error(`[VHP][VhV3DurationRecorder] failed to record focus duration path=[${file.path}]`, error);
      });
  }

  /** Resolves when all writes queued so far (incl. their id resolution) have settled (tests, unload, inline note). */
  flush(): Promise<void> {
    return this.writeChain;
  }

  // ── private ─────────────────────────────────────────────────────────────

  private async persist(file: TFile, focusStartEpochMs: number, durationMs: number): Promise<void> {
    const docId = await this.resolveRecordableDocId(file);
    if (docId === undefined) {
      return;
    }
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
  }

  /** The id the session is filed under, or undefined → the session is dropped. */
  private async resolveRecordableDocId(file: TFile): Promise<string | undefined> {
    let docId: string | null;
    try {
      docId = await this.resolveDocId(file);
    } catch (error) {
      console.error(`[VHP][VhV3DurationRecorder] doc id resolution failed, session dropped path=[${file.path}]`, error);
      return undefined;
    }
    if (docId === null) {
      // Expected for files that cannot carry an id (raw .excalidraw) — not a failure, so no log.
      return undefined;
    }
    if (!DocIdFilenameSafety.isFilenameSafeId(docId)) {
      // The id IS the history filename — an unsafe one would escape the device dir.
      console.error(`[VHP][VhV3DurationRecorder] doc id not filename-safe, session dropped path=[${file.path}] docId=[${docId}]`);
      return undefined;
    }
    return docId;
  }
}
