/**
 * Deduplicates concurrent async work by key using DROP semantics.
 *
 * Problem this solves: events can fire rapidly (e.g. switching tabs, Obsidian
 * internals triggering multiple events for one user action). Each handler is
 * async and yields at awaits, so without this guard a second call can
 * interleave with the first — resulting in duplicate side effects such as
 * double-writes to the same file.
 *
 * DROP semantics: if a task is already running for a given key, a new run()
 * for that key exits immediately. We do NOT await the in-flight promise
 * because that would still trigger a second execution's side effects once the
 * first finishes. A dropped call is acceptable — the first one already did
 * the work.
 */
export class InFlightDropGuard {
  private readonly inFlight = new Map<string, Promise<void>>();

  /**
   * Runs the task unless one is already in flight for the same key.
   * Rethrows the task's error; the guard entry is cleaned up either way.
   */
  async run(key: string, task: () => Promise<void>): Promise<void> {
    if (this.inFlight.has(key)) {
      return;
    }

    // Register before the first await inside the task's async body completes
    // scheduling, so any concurrent call sees the in-flight entry immediately.
    const promise = task();
    this.inFlight.set(key, promise);
    try {
      await promise;
    } finally {
      // Always clean up so future calls for this key are processed normally,
      // regardless of whether the task succeeded or threw.
      this.inFlight.delete(key);
    }
  }
}
