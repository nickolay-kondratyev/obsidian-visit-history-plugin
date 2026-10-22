/** Per-file time tracking record. Timestamps are Unix epoch milliseconds. */
export interface FileTimeMetadata {
  createdMs: number,
  modifiedMs: number,
  /** null = never visited (no visit history recorded on any device). */
  visitedMs: number | null,
  /**
   * Sum of all CLOSED focus session durations (ms), across all users and
   * devices. 0 = never visited.
   */
  totalFocusMs: number,
}
