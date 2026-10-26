/**
 * Fan-out of "colors/stats may have changed" to public-API subscribers
 * ({@link VisitHistoryApi.onChangeV1}). Consumer callbacks are foreign code:
 * each is isolated so a throw is logged and never stops the others — nor our
 * own flow that triggered the notification (config persist, session write).
 */
export class VisitHistoryChangeNotifier {
  // One entry object per subscription (not the callback itself), so the same
  // function subscribed twice yields two independent subscriptions.
  private readonly subscriptions = new Set<{ readonly callback: () => void }>();
  private disposed = false;

  /** @returns unsubscribe (idempotent). A no-op subscription once disposed. */
  subscribe(callback: () => void): () => void {
    if (this.disposed) return () => {};
    const subscription = { callback };
    this.subscriptions.add(subscription);
    return () => {
      this.subscriptions.delete(subscription);
    };
  }

  notify(): void {
    // Snapshot: a callback may (un)subscribe while we iterate.
    for (const { callback } of [...this.subscriptions]) {
      try {
        callback();
      } catch (error) {
        console.error('[VHP][VisitHistoryChangeNotifier] API change subscriber threw', error);
      }
    }
  }

  /** Drops every subscription (plugin unload); later subscribes are ignored. */
  dispose(): void {
    this.disposed = true;
    this.subscriptions.clear();
  }
}
