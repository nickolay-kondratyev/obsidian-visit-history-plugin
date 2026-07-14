// Strict stamp format. Intentionally NOT a bare Date.parse — it accepts loose
// strings ("March 2026") and would misread header/comment lines as stamps.
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Parses single visit-stamp lines to epoch ms. Used by the V3 session-line
 * parser (VhV3SessionLineParser) for the ISO part of a session line.
 * Unparseable lines yield null — callers skip them, never throw.
 */
export class StampLineParser {
  /** ISO 8601 line → epoch ms, or null. */
  static parseIsoMs(rawLine: string): number | null {
    const line = rawLine.trim();
    return ISO_8601_PATTERN.test(line) ? Date.parse(line) : null;
  }
}
