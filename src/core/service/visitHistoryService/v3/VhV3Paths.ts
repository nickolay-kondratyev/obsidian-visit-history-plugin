import { VhUserPaths } from '../user/VhUserPaths';

/**
 * Path layout of visit history V3 — focus DURATIONS
 * (see docs/visit-history-format.md):
 *
 *   .visit_history/user/<user-name>/v3/README__generated__vh_v3_format.md
 *   .visit_history/user/<user-name>/v3/focus_duration_per_device/<device-name>/<doc-id>.vh_v3
 *
 * Same user level (VhUserPaths) and doc-id-as-filename keying as V2. V3 is
 * recorded ALONGSIDE V2 — V2 stays the main history.
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
