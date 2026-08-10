/**
 * Minimal bounded LRU cache (get/set only).
 *
 * Self-written replacement for the `lru-cache` npm package: the Obsidian
 * scorecard's static analyzer flagged that package's `fetch()` memoization
 * methods as a network call (false positive) — we only ever needed get/set.
 *
 * Backed by a Map, whose iteration order is insertion order: reading or
 * writing a key deletes + re-inserts it, so the first key in iteration
 * order is always the least recently used and is evicted when full.
 *
 * `undefined` is not a storable value (set throws) — it is indistinguishable
 * from a miss (same constraint as `lru-cache`, which rejects it too). Wrap
 * nullable values in an object if a cached "absent" result must be kept.
 */
export class LruCache<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(private readonly maxEntries: number) {
    if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
      throw new Error(`maxEntries must be a positive integer, got [${maxEntries}]`);
    }
  }

  /** Cached value, or undefined on miss. A hit marks the key most recently used. */
  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) {
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  /** Inserts/updates the key as most recently used, evicting the LRU entry when full. */
  set(key: K, value: V): void {
    if (value === undefined) {
      // A stored undefined would occupy a slot yet read back as a miss forever.
      throw new Error('LruCache cannot store undefined; wrap the value or skip the set');
    }
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.maxEntries) {
      const lruKey = this.entries.keys().next();
      if (!lruKey.done) {
        this.entries.delete(lruKey.value);
      }
    }
    this.entries.set(key, value);
  }

  get size(): number {
    return this.entries.size;
  }
}
