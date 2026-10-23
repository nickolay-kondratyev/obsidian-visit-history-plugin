/** Items whose timestamps all fall inside one `WINDOW_MS` window. */
export interface TimestampCluster<T> {
  /** The items inside the window, ascending by timestamp. */
  readonly members: readonly T[];
  /** Items that had a timestamp — the denominator the cluster share is judged against. */
  readonly judgedCount: number;
}

/**
 * Decides whether a set of timestamps is "clustered": at least
 * `MIN_CLUSTER_SHARE` of at least `MIN_ITEMS_TO_JUDGE` items fall inside one
 * `WINDOW_MS` window. Typical cause: a sync tool stamping every downloaded
 * file with the download time, which wipes the recency information.
 *
 * Returns the cluster MEMBERS (not just a boolean) so callers can act on
 * exactly those items (e.g. pick restore targets).
 *
 * Stateless and O(n log n): one sort plus a sliding window.
 */
export class TimestampClusterDetector {
  /** Below this many timestamped items a cluster says nothing — never clustered. */
  static readonly MIN_ITEMS_TO_JUDGE = 20;
  /** Share of the judged items that must sit in one window (inclusive). */
  static readonly MIN_CLUSTER_SHARE = 0.5;
  /** Max span between the earliest and latest member of a cluster (inclusive). */
  static readonly WINDOW_MS = 60_000;

  /**
   * The largest window of items (earliest one on ties) when it is clustered,
   * else `undefined`. Items whose `timestampOf` is `undefined` or non-finite
   * are skipped — they are neither members nor judged.
   */
  static detect<T>(
    items: readonly T[],
    timestampOf: (item: T) => number | undefined,
  ): TimestampCluster<T> | undefined {
    const stamped = TimestampClusterDetector.sortedStamped(items, timestampOf);
    if (stamped.length < TimestampClusterDetector.MIN_ITEMS_TO_JUDGE) return undefined;

    const best = TimestampClusterDetector.largestWindow(stamped);
    const bestCount = best.endExclusive - best.start;
    if (bestCount < stamped.length * TimestampClusterDetector.MIN_CLUSTER_SHARE) return undefined;

    return {
      members: stamped.slice(best.start, best.endExclusive).map(s => s.item),
      judgedCount: stamped.length,
    };
  }

  private static sortedStamped<T>(
    items: readonly T[],
    timestampOf: (item: T) => number | undefined,
  ): StampedItem<T>[] {
    const stamped: StampedItem<T>[] = [];
    for (const item of items) {
      const ms = timestampOf(item);
      if (ms !== undefined && Number.isFinite(ms)) stamped.push({ item, ms });
    }
    return stamped.sort((a, b) => a.ms - b.ms);
  }

  /** Sliding window over ascending stamps; `stamped` must be non-empty. */
  private static largestWindow<T>(stamped: readonly StampedItem<T>[]): IndexRange {
    let best: IndexRange = { start: 0, endExclusive: 0 };
    let start = 0;
    for (let end = 0; end < stamped.length; end++) {
      const endMs = TimestampClusterDetector.msAt(stamped, end);
      while (endMs - TimestampClusterDetector.msAt(stamped, start) > TimestampClusterDetector.WINDOW_MS) start++;
      if (end + 1 - start > best.endExclusive - best.start) best = { start, endExclusive: end + 1 };
    }
    return best;
  }

  private static msAt<T>(stamped: readonly StampedItem<T>[], index: number): number {
    const entry = stamped[index];
    if (!entry) throw new Error(`index out of range index=[${index}] length=[${stamped.length}]`);
    return entry.ms;
  }
}

interface StampedItem<T> {
  readonly item: T;
  readonly ms: number;
}

interface IndexRange {
  readonly start: number;
  readonly endExclusive: number;
}
