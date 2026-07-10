// Doc ids become VH filenames (V2 `<id>.vh_v2`, V3 `<id>.vh_v3`), and an
// EXISTING id is honored in any format — so it must be validated before use
// as a path segment. Conservative portable-filename charset; leading/trailing
// dots excluded ('.', '..', hidden files); 200 chars keeps `<id>.vh_vN` under
// common 255-byte limits.
const FILENAME_SAFE_ID_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,198}[A-Za-z0-9_-]$|^[A-Za-z0-9_-]$/;

/**
 * Shared by all VH versions that key files by doc id (V2 focus stamps,
 * V3 focus durations).
 */
export class DocIdFilenameSafety {
  /**
   * True when the doc id can safely be used as a filename. Ids that fail
   * (e.g. containing '/', exotic characters, or overlong) cannot get a VH
   * file — callers must skip such docs and report.
   */
  static isFilenameSafeId(docId: string): boolean {
    return FILENAME_SAFE_ID_PATTERN.test(docId);
  }
}
