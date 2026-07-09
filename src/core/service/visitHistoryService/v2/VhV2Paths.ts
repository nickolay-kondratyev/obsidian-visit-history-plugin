// Doc ids become V2 filenames, and an EXISTING id is honored in any format —
// so it must be validated before use as a path segment. Conservative
// portable-filename charset; leading/trailing dots excluded ('.', '..',
// hidden files); 200 chars keeps `<id>.vh_v2` under common 255-byte limits.
const FILENAME_SAFE_ID_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,198}[A-Za-z0-9_-]$|^[A-Za-z0-9_-]$/;

/**
 * Path layout of visit history V2 (see docs/visit-history-format.md):
 *
 *   .visit_history/v2/README__generated__vh_v2_format.md
 *   .visit_history/v2/focus_per_device/<device-name>/<doc-id>.vh_v2
 *
 * The top dir is a DOT-folder on purpose: invisible to Obsidian's Vault API
 * and metadata cache, so VH files never pollute search, graph, or backlinks.
 * All access goes through HiddenFileUtil.
 */
export class VhV2Paths {
  static readonly TOP_DIR = '.visit_history';
  static readonly FOCUS_PER_DEVICE_DIR = `${VhV2Paths.TOP_DIR}/v2/focus_per_device`;
  static readonly README_PATH = `${VhV2Paths.TOP_DIR}/v2/README__generated__vh_v2_format.md`;
  static readonly FOCUS_FILE_EXTENSION = '.vh_v2';

  /** Focus file for one (device, doc). The doc id IS the filename. */
  static focusFilePath(deviceName: string, docId: string): string {
    return `${VhV2Paths.deviceDir(deviceName)}/${docId}${VhV2Paths.FOCUS_FILE_EXTENSION}`;
  }

  static deviceDir(deviceName: string): string {
    return `${VhV2Paths.FOCUS_PER_DEVICE_DIR}/${deviceName}`;
  }

  /**
   * True when the doc id can safely be used as a filename. Ids that fail
   * (e.g. containing '/', exotic characters, or overlong) cannot get a V2
   * focus file — callers must skip such docs and report.
   */
  static isFilenameSafeId(docId: string): boolean {
    return FILENAME_SAFE_ID_PATTERN.test(docId);
  }
}
