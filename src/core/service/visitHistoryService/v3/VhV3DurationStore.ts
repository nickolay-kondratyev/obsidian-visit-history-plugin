import { HiddenFileUtil } from '../../../util/file/hidden/HiddenFileUtil';
import { DocIdFilenameSafety } from '../DocIdFilenameSafety';
import { VhV3Paths } from './VhV3Paths';

/**
 * Owns the on-disk V3 focus-duration format: one file per (device, doc id)
 * under the CURRENT user's tree (injected user name), holding one completed
 * focus session per line, newline-terminated:
 *
 *   <ISO 8601 UTC ms stamp of when focus started> D:<millis spent in focus>
 *   e.g. `2026-07-09T22:02:15.745Z D:5600`
 *
 * Lines are appended when a session ENDS, in session-start order (sessions on
 * one device never overlap), so files are naturally ascending by start stamp.
 *
 * Callers must pre-validate ids with DocIdFilenameSafety.isFilenameSafeId;
 * appendFocusDuration throws on unsafe ids (programming error).
 */
export class VhV3DurationStore {
  constructor(
    private readonly hiddenFileUtil: HiddenFileUtil,
    private readonly userName: string,
  ) {
  }

  /** Appends one completed focus session (creates the file when absent). */
  async appendFocusDuration(
    deviceName: string,
    docId: string,
    focusStartEpochMs: number,
    durationMs: number,
  ): Promise<void> {
    if (!DocIdFilenameSafety.isFilenameSafeId(docId)) {
      throw new Error(`Doc id is not filename-safe docId=[${docId}]`);
    }
    await this.hiddenFileUtil.append(
      VhV3Paths.focusDurationFilePath(this.userName, deviceName, docId),
      `${new Date(focusStartEpochMs).toISOString()} D:${durationMs}\n`,
    );
  }
}
