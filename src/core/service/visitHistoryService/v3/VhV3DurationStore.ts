import { HiddenFileUtil } from '../../../util/file/hidden/HiddenFileUtil';
import { DocIdFilenameSafety } from '../DocIdFilenameSafety';
import { VhUserPaths } from '../user/VhUserPaths';
import { VhV3Paths } from './VhV3Paths';
import { VhV3FocusSession, VhV3SessionLineParser } from './VhV3SessionLineParser';

/**
 * Owns the on-disk V3 focus-duration format: one file per (device, doc id)
 * holding one completed focus session per line, newline-terminated:
 *
 *   <ISO 8601 UTC ms stamp of when focus started> D:<millis spent in focus>
 *   e.g. `2026-07-09T22:02:15.745Z D:5600`
 *
 * (Line grammar is parsed by VhV3SessionLineParser.)
 *
 * Writes always target the CURRENT user's tree (injected user name); reads
 * for aggregation span ALL users' trees — the heatmap shows whole-vault
 * activity (owner decision).
 *
 * Lines are appended when a session ENDS, in session-start order (sessions on
 * one device never overlap), so files are naturally ascending by start stamp.
 *
 * Reading never throws on malformed content — unparseable lines are skipped
 * so one bad file cannot break aggregation.
 *
 * Callers must pre-validate ids with DocIdFilenameSafety.isFilenameSafeId;
 * appendFocusDuration throws on unsafe ids (programming error), read methods
 * treat them as "no file".
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

  /** Current user's completed sessions for the doc on one device; [] when absent. */
  async readSessions(deviceName: string, docId: string): Promise<VhV3FocusSession[]> {
    return this.readSessionsForUser(this.userName, deviceName, docId);
  }

  /**
   * Most recent session START stamp for the doc across ALL users and devices,
   * or null if never focused. Session start (not end) is the "last visited"
   * stamp — it matches the old V2 semantics of stamping at focus time.
   */
  async getLastFocusStartMsAcrossUsersAndDevices(docId: string): Promise<number | null> {
    const userNames = await this.hiddenFileUtil.listSubfolderNames(VhUserPaths.USERS_DIR);
    const sessionsPerUser = await Promise.all(
      userNames.map(userName => this.readAllDeviceSessionsForUser(userName, docId)),
    );
    // reduce, not Math.max(...spread): spreading a years-long history
    // (100k+ sessions) can blow the call stack and kill the whole heatmap refresh.
    return sessionsPerUser
      .flat()
      .reduce<number | null>(
        (maxMs, session) => (maxMs === null ? session.focusStartEpochMs : Math.max(maxMs, session.focusStartEpochMs)),
        null,
      );
  }

  // ── private ─────────────────────────────────────────────────────────────

  private async readAllDeviceSessionsForUser(
    userName: string,
    docId: string,
  ): Promise<VhV3FocusSession[]> {
    const deviceNames = await this.hiddenFileUtil.listSubfolderNames(
      VhV3Paths.focusDurationPerDeviceDir(userName),
    );
    const sessionsPerDevice = await Promise.all(
      deviceNames.map(deviceName => this.readSessionsForUser(userName, deviceName, docId)),
    );
    return sessionsPerDevice.flat();
  }

  private async readSessionsForUser(
    userName: string,
    deviceName: string,
    docId: string,
  ): Promise<VhV3FocusSession[]> {
    if (!DocIdFilenameSafety.isFilenameSafeId(docId)) {
      return [];
    }
    const content = await this.hiddenFileUtil.readIfExists(
      VhV3Paths.focusDurationFilePath(userName, deviceName, docId),
    );
    if (content === null) {
      return [];
    }
    return content
      .split('\n')
      .map(line => VhV3SessionLineParser.parseSession(line))
      .filter((session): session is VhV3FocusSession => session !== null);
  }
}
