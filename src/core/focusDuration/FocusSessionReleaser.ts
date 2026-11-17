import { TFile } from 'obsidian';

/**
 * Lets an action that MOVES a doc's history files (inline note) first close
 * the doc's open focus session and wait for its record to land, so no
 * session line is ever written to the old path afterwards.
 */
export interface FocusSessionReleaser {
  /**
   * Closes the file's open session now (no new one opens until it is
   * focused again) and resolves once every queued session write has
   * settled — including the record-time doc id assignment, so a file that
   * had no id yet carries one afterwards if its session was recorded.
   * No-op while recording is inactive (no pinned user name).
   */
  releaseAndFlush(file: TFile): Promise<void>;
}
