/** Per-file time tracking record. All values are Unix epoch milliseconds. */
export interface FileTimeMetadata {
  createdMs: number,
  modifiedMs: number,
  /** null = never visited (no visit history recorded on any device). */
  visitedMs: number | null,
}
