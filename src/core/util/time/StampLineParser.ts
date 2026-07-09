// Strict stamp formats. Intentionally NOT a bare Date.parse — it accepts loose
// strings ("March 2026") and would misread header/comment lines as stamps.
const LEGACY_EPOCH_MS_PATTERN = /^\d+$/;
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Parses single visit-stamp lines to epoch ms. Shared by the V1 parser
 * (FocusFile — migration input) and the V2 store (VhV2FocusStore).
 * Unparseable lines yield null — callers skip them, never throw.
 */
export class StampLineParser {
  /** ISO 8601 line → epoch ms, or null. The only format V2 files carry. */
  static parseIsoMs(rawLine: string): number | null {
    const line = rawLine.trim();
    return ISO_8601_PATTERN.test(line) ? Date.parse(line) : null;
  }

  /** V1 line → epoch ms, or null. V1 carries ISO or legacy epoch-ms integers. */
  static parseLegacyOrIsoMs(rawLine: string): number | null {
    const line = rawLine.trim();
    if (LEGACY_EPOCH_MS_PATTERN.test(line)) return Number(line);
    return StampLineParser.parseIsoMs(line);
  }
}
