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
}
