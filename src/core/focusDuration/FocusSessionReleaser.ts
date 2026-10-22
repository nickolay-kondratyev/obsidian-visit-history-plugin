/**
 * Lets an action that MOVES a doc's history files (inline note) first close
 * the doc's open focus session and wait for its record to land, so no
 * session line is ever written to the old path afterwards.
 */
export interface FocusSessionReleaser {
  /**
   * Closes the doc's open session now (no new one opens until the doc is
   * focused again) and resolves once every queued session write has
   * settled. No-op while recording is inactive (no pinned user name).
   */
  releaseAndFlush(docId: string): Promise<void>;
}
