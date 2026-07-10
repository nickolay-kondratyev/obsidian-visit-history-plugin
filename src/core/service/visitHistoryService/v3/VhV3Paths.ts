import { VhV2Paths } from '../v2/VhV2Paths';

/**
 * Path layout of visit history V3 — focus DURATIONS
 * (see docs/visit-history-format.md):
 *
 *   .visit_history/v3/README__generated__vh_v3_format.md
 *   .visit_history/v3/focus_duration_per_device/<device-name>/<doc-id>.vh_v3
 *
 * Same dot-folder rationale as V2 (invisible to the Vault API — all access
 * through HiddenFileUtil) and same doc-id-as-filename keying. V3 is recorded
 * ALONGSIDE V2 — V2 stays the main history.
 */
export class VhV3Paths {
  static readonly FOCUS_DURATION_PER_DEVICE_DIR = `${VhV2Paths.TOP_DIR}/v3/focus_duration_per_device`;
  static readonly README_PATH = `${VhV2Paths.TOP_DIR}/v3/README__generated__vh_v3_format.md`;
  static readonly FOCUS_DURATION_FILE_EXTENSION = '.vh_v3';

  /** Duration file for one (device, doc). The doc id IS the filename. */
  static focusDurationFilePath(deviceName: string, docId: string): string {
    return `${VhV3Paths.deviceDir(deviceName)}/${docId}${VhV3Paths.FOCUS_DURATION_FILE_EXTENSION}`;
  }

  static deviceDir(deviceName: string): string {
    return `${VhV3Paths.FOCUS_DURATION_PER_DEVICE_DIR}/${deviceName}`;
  }
}
