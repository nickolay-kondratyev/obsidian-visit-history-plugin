import { LRUCache } from 'lru-cache';

/** Cache entry. `value: null` means a cached "never visited" result. */
export interface CachedLastVisit {
  value: number | null;
}

/**
 * LRU cache of last-visit stamps keyed by doc id. Shared by the read path
 * (VisitHistoryServiceV3 — heatmap aggregation hits this for every vault
 * file) and the write path (VhV3DurationRecorder — write-through on every
 * recorded session, so the heatmap sees new visits without re-reading disk).
 */
export class LastVisitCache {
  // Values are wrapped in {value} so a cached "never visited" (null) result
  // stays distinguishable from a cache miss (LRUCache rejects nullish values).
  private readonly byDocId = new LRUCache<string, CachedLastVisit>({
    // Set to high value as it will be of most use in very high note count vaults.
    max: 10000,
  });

  /** Cached entry, or undefined on cache miss. */
  get(docId: string): CachedLastVisit | undefined {
    return this.byDocId.get(docId);
  }

  set(docId: string, lastVisitMs: number | null): void {
    this.byDocId.set(docId, { value: lastVisitMs });
  }

  /**
   * Write-through for a newly recorded focus session: raises the cached
   * last-visit to the session start, never lowers an existing value
   * (sessions can close out of start order across windows).
   */
  noteVisit(docId: string, focusStartEpochMs: number): void {
    const cachedMs = this.byDocId.get(docId)?.value ?? null;
    this.set(docId, cachedMs === null ? focusStartEpochMs : Math.max(cachedMs, focusStartEpochMs));
  }
}
