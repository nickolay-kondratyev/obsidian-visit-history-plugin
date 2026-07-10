import { HiddenFileUtil } from '../../../util/file/hidden/HiddenFileUtil';
import { StampLineParser } from '../../../util/time/StampLineParser';
import { DocIdFilenameSafety } from '../DocIdFilenameSafety';
import { VhUserPaths } from '../user/VhUserPaths';
import { VhV2Paths } from './VhV2Paths';

/**
 * Owns the on-disk V2 focus format: one file per (device, doc id) holding one
 * ISO 8601 UTC stamp (millisecond precision) per line, newline-terminated,
 * sorted ascending, exact-duplicate-free.
 *
 * Writes always target the CURRENT user's tree (injected user name); reads
 * for aggregation span ALL users' trees — the heatmap shows whole-vault
 * activity (owner decision).
 *
 * Reading never throws on malformed content — unparseable lines are skipped
 * so one bad file cannot break aggregation.
 *
 * Callers must pre-validate ids with DocIdFilenameSafety.isFilenameSafeId; write
 * methods throw on unsafe ids (programming error), read methods treat them
 * as "no file".
 */
export class VhV2FocusStore {
  constructor(
    private readonly hiddenFileUtil: HiddenFileUtil,
    private readonly userName: string,
  ) {
  }

  /** Appends one visit stamp for this device's doc file (creates it when absent). */
  async appendVisit(deviceName: string, docId: string, epochMs: number): Promise<void> {
    this.assertSafeId(docId);
    await this.hiddenFileUtil.append(
      VhV2Paths.focusFilePath(this.userName, deviceName, docId),
      new Date(epochMs).toISOString() + '\n',
    );
  }

  /** Current user's stamps (epoch ms) for the doc on one device; [] when absent. */
  async readStampsMs(deviceName: string, docId: string): Promise<number[]> {
    return this.readStampsMsForUser(this.userName, deviceName, docId);
  }

  /**
   * Overwrites the doc's file for one device (current user) with the given
   * stamps, normalized to the format invariants (sorted ascending,
   * deduplicated). Used by V1→V2 migration; live recording uses appendVisit.
   */
  async writeStampsMs(deviceName: string, docId: string, epochMsList: number[]): Promise<void> {
    this.assertSafeId(docId);
    const normalized = [...new Set(epochMsList)].sort((a, b) => a - b);
    const content = normalized.map(ms => new Date(ms).toISOString() + '\n').join('');
    await this.hiddenFileUtil.write(
      VhV2Paths.focusFilePath(this.userName, deviceName, docId),
      content,
    );
  }

  /** Most recent stamp for the doc across ALL users and devices, or null if never visited. */
  async getLastVisitMsAcrossUsersAndDevices(docId: string): Promise<number | null> {
    const userNames = await this.hiddenFileUtil.listSubfolderNames(VhUserPaths.USERS_DIR);
    const stampsPerUser = await Promise.all(
      userNames.map(userName => this.readAllDeviceStampsMsForUser(userName, docId)),
    );
    const allStamps = stampsPerUser.flat();
    return allStamps.length > 0 ? Math.max(...allStamps) : null;
  }

  // ── private ─────────────────────────────────────────────────────────────

  private async readAllDeviceStampsMsForUser(userName: string, docId: string): Promise<number[]> {
    const deviceNames = await this.hiddenFileUtil.listSubfolderNames(
      VhV2Paths.focusPerDeviceDir(userName),
    );
    const stampsPerDevice = await Promise.all(
      deviceNames.map(deviceName => this.readStampsMsForUser(userName, deviceName, docId)),
    );
    return stampsPerDevice.flat();
  }

  private async readStampsMsForUser(
    userName: string,
    deviceName: string,
    docId: string,
  ): Promise<number[]> {
    if (!DocIdFilenameSafety.isFilenameSafeId(docId)) {
      return [];
    }
    const content = await this.hiddenFileUtil.readIfExists(
      VhV2Paths.focusFilePath(userName, deviceName, docId),
    );
    if (content === null) {
      return [];
    }
    return content
      .split('\n')
      .map(line => StampLineParser.parseIsoMs(line))
      .filter((ms): ms is number => ms !== null);
  }

  private assertSafeId(docId: string): void {
    if (!DocIdFilenameSafety.isFilenameSafeId(docId)) {
      throw new Error(`Doc id is not filename-safe docId=[${docId}]`);
    }
  }
}
