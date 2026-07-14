import { VhUserPaths } from '../user/VhUserPaths';

/**
 * Path layout of visit history V3 — focus DURATIONS
 * (see docs/visit-history-format.md):
 *
 *   .visit_history/user/<user-name>/v3/README__generated__vh_v3_format.md
 *   .visit_history/user/<user-name>/v3/focus_duration_per_device/<device-name>/<doc-id>.vh_v3
 *
 * User level owned by VhUserPaths (dot-folder rationale there). The doc id
 * IS the filename (survives renames; no backlink indirection). Every method
 * takes the user name explicitly: writes always target the CURRENT user,
 * while reads aggregate across ALL user dirs (owner decision — the heatmap
 * shows whole-vault activity).
 */
export class VhV3Paths {
  static readonly FOCUS_DURATION_FILE_EXTENSION = '.vh_v3';

  /** Duration file for one (user, device, doc). The doc id IS the filename. */
  static focusDurationFilePath(userName: string, deviceName: string, docId: string): string {
    return `${VhV3Paths.deviceDir(userName, deviceName)}/${docId}${VhV3Paths.FOCUS_DURATION_FILE_EXTENSION}`;
  }

  static deviceDir(userName: string, deviceName: string): string {
    return `${VhV3Paths.focusDurationPerDeviceDir(userName)}/${deviceName}`;
  }

  static focusDurationPerDeviceDir(userName: string): string {
    return `${VhUserPaths.userRootDir(userName)}/v3/focus_duration_per_device`;
  }

  static readmePath(userName: string): string {
    return `${VhUserPaths.userRootDir(userName)}/v3/README__generated__vh_v3_format.md`;
  }
}
