import { VhUserPaths } from '../user/VhUserPaths';

/**
 * Path layout of visit history V2 (see docs/visit-history-format.md):
 *
 *   .visit_history/user/<user-name>/v2/README__generated__vh_v2_format.md
 *   .visit_history/user/<user-name>/v2/focus_per_device/<device-name>/<doc-id>.vh_v2
 *
 * User level owned by VhUserPaths (dot-folder rationale there). Every method
 * takes the user name explicitly: writes always target the CURRENT user,
 * while reads aggregate across ALL user dirs (owner decision — the heatmap
 * shows whole-vault activity).
 */
export class VhV2Paths {
  static readonly FOCUS_FILE_EXTENSION = '.vh_v2';

  /** Focus file for one (user, device, doc). The doc id IS the filename. */
  static focusFilePath(userName: string, deviceName: string, docId: string): string {
    return `${VhV2Paths.deviceDir(userName, deviceName)}/${docId}${VhV2Paths.FOCUS_FILE_EXTENSION}`;
  }

  static deviceDir(userName: string, deviceName: string): string {
    return `${VhV2Paths.focusPerDeviceDir(userName)}/${deviceName}`;
  }

  static focusPerDeviceDir(userName: string): string {
    return `${VhUserPaths.userRootDir(userName)}/v2/focus_per_device`;
  }

  static readmePath(userName: string): string {
    return `${VhUserPaths.userRootDir(userName)}/v2/README__generated__vh_v2_format.md`;
  }
}
