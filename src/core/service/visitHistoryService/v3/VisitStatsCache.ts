import { LruCache } from '../../../util/cache/LruCache';
import { VisitStats } from '../VisitStats';

/** Snapshot of the cache's write sequence, taken BEFORE a disk read. */
export interface VisitStatsReadToken {
  readonly writeSeqAtReadStart: number;
}

/**
 * In-memory per-note {@link VisitStats} (last visit + total focus time) keyed
 * by doc id. Shared by the read path (VisitHistoryServiceV3 — heatmap
 * aggregation hits this for every vault file) and the write path
 * (VhV3DurationRecorder — write-through on every recorded session).
 *
 * WHY a write-sequence protocol (not a max-merge): a total cannot be
 * max-merged like a timestamp — a disk read racing a session append could
 * cache a total that misses the session or, after write-through, counts it
 * twice. So:
 * - Writer: beginSessionWrite → append → endSessionWrite (or
 *   abortSessionWrite on failure). Begin, end and abort each mark the doc
 *   with a fresh write seq; begin..end/abort is the doc's write window.
 * - Reader: readToken() BEFORE the disk read, then setIfNoWriteSince(), which
 *   REJECTS when the doc was marked after the token or a write is in flight.
 * Hence an entry present at endSessionWrite was cached BEFORE
 * beginSessionWrite (from a read that finished before the append), so merging
 * the session once is exact; a read overlapping the write window is never
 * cached, so neither a missed nor a double-counted session can stick (the
 * next lookup re-reads disk).
 *
 * WHY-NOT create an entry on a write-through miss: a total built from one
 * session would be wrong — the next read loads the full history from disk.
 */
export class VisitStatsCache {
  // High as it is of most use in very high note count vaults.
  static readonly MAX_ENTRIES = 10000;

  private readonly statsByDocId = new LruCache<string, VisitStats>(VisitStatsCache.MAX_ENTRIES);
  // Bounded (ceiling: a doc's mark can be evicted). Only ever `peek`ed, so
  // eviction order is mark order: evicting a mark made after a token takes
  // >= MAX_ENTRIES newer marks — setIfNoWriteSince rejects in that case.
  private readonly lastWriteSeqByDocId = new LruCache<string, number>(VisitStatsCache.MAX_ENTRIES);
  // Unbounded but self-cleaning: an entry exists only while a write is in
  // flight (the recorder serializes writes, so at most one in practice).
  private readonly inFlightWriteCountByDocId = new Map<string, number>();
  private writeSeq = 0;

  /** Cached stats, or undefined on cache miss. */
  get(docId: string): VisitStats | undefined {
    return this.statsByDocId.get(docId);
  }

  /** Take BEFORE reading disk; pass to {@link setIfNoWriteSince}. */
  readToken(): VisitStatsReadToken {
    return { writeSeqAtReadStart: this.writeSeq };
  }

  /**
   * Caches disk-read stats unless a session write for the doc began, ended or
   * aborted after `token` was taken, or is still in flight.
   * @returns true when cached.
   */
  setIfNoWriteSince(docId: string, stats: VisitStats, token: VisitStatsReadToken): boolean {
    if (this.inFlightWriteCountByDocId.has(docId) || this.hasWriteMarkSince(docId, token)) {
      return false;
    }
    this.statsByDocId.set(docId, stats);
    return true;
  }

  /** Opens the doc's write window — call BEFORE appending the session. */
  beginSessionWrite(docId: string): void {
    this.inFlightWriteCountByDocId.set(docId, (this.inFlightWriteCountByDocId.get(docId) ?? 0) + 1);
    this.markWrite(docId);
  }

  /**
   * Closes the write window after a SUCCESSFUL append; merges the session
   * into the cached stats only if an entry is present (see class doc).
   */
  endSessionWrite(docId: string, focusStartEpochMs: number, durationMs: number): void {
    this.closeWriteWindow(docId);
    const cached = this.statsByDocId.get(docId);
    if (cached !== undefined) {
      this.statsByDocId.set(docId, cached.withSession(focusStartEpochMs, durationMs));
    }
  }

  /**
   * Closes the write window after a FAILED append and drops the doc's entry,
   * so nothing stale or partial survives (the next lookup re-reads disk).
   */
  abortSessionWrite(docId: string): void {
    this.closeWriteWindow(docId);
    this.statsByDocId.delete(docId);
  }

  // ── private ─────────────────────────────────────────────────────────────

  private closeWriteWindow(docId: string): void {
    const inFlightCount = this.inFlightWriteCountByDocId.get(docId) ?? 0;
    if (inFlightCount <= 1) {
      this.inFlightWriteCountByDocId.delete(docId);
    } else {
      this.inFlightWriteCountByDocId.set(docId, inFlightCount - 1);
    }
    this.markWrite(docId);
  }

  private markWrite(docId: string): void {
    this.writeSeq += 1;
    this.lastWriteSeqByDocId.set(docId, this.writeSeq);
  }

  private hasWriteMarkSince(docId: string, token: VisitStatsReadToken): boolean {
    const lastWriteSeq = this.lastWriteSeqByDocId.peek(docId);
    if (lastWriteSeq === undefined) {
      // No mark: never written, or the mark was evicted — which needs
      // >= MAX_ENTRIES marks after it, so be conservative past that point.
      return this.writeSeq - token.writeSeqAtReadStart >= VisitStatsCache.MAX_ENTRIES;
    }
    return lastWriteSeq > token.writeSeqAtReadStart;
  }
}
