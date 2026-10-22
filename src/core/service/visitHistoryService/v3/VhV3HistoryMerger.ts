import { HiddenFileUtil } from '../../../util/file/hidden/HiddenFileUtil';
import { DocIdFilenameSafety } from '../DocIdFilenameSafety';
import { VhUserPaths } from '../user/VhUserPaths';
import { VhV3Paths } from './VhV3Paths';
import { VisitStatsCache } from './VisitStatsCache';

/**
 * Moves the V3 history of an ABSORBED doc (a note being inlined) under a
 * RECEIVING doc, so it counts towards the receiving doc from now on
 * (VhV3DurationStore reads `merged_in_focus_duration_per_device/`).
 *
 * Files are MOVED whole, never rewritten or merged line-wise (owner
 * decision), each staying under its own `user/<name>/…/<device>/`:
 *
 *   …/focus_duration_per_device/<device>/<absorbed>.vh_v3
 *     → …/merged_in_focus_duration_per_device/<device>/<receiving>/<absorbed>.vh_v3
 *
 * Chains are FLATTENED: files previously merged into the absorbed doc move
 * straight under the receiving doc, so merges are always one level deep.
 * A name collision (e.g. a note restored from trash and inlined again) gets
 * a numbered suffix (`<name>__2.vh_v3`) — nothing is ever overwritten.
 *
 * Only history present on THIS device is moved (`.plugin_data/` does not
 * sync); other devices keep the absorbed doc's files unattached — accepted.
 */
export class VhV3HistoryMerger {
  /** First suffix tried on a collision: `<name>__2.vh_v3`. */
  static readonly FIRST_COLLISION_SUFFIX = 2;
  /** Safety bound on the collision-suffix probe (never reached in practice). */
  static readonly MAX_COLLISION_SUFFIX = 1000;
  private static readonly COLLISION_SUFFIX_SEPARATOR = '__';

  constructor(
    private readonly hiddenFileUtil: HiddenFileUtil,
    private readonly visitStatsCache: VisitStatsCache,
  ) {
  }

  /**
   * Moves every local `.vh_v3` of `absorbedDocId` (own + merged-in, all users
   * and devices) under `receivingDocId`. Both docs' cached stats are dropped
   * — also on failure — so the heatmap re-reads the new layout.
   * @returns number of files moved.
   */
  async mergeInto(absorbedDocId: string, receivingDocId: string): Promise<number> {
    this.assertMergeable(absorbedDocId, receivingDocId);
    this.visitStatsCache.beginHistoryMove(absorbedDocId);
    this.visitStatsCache.beginHistoryMove(receivingDocId);
    try {
      let movedCount = 0;
      for (const userName of await this.hiddenFileUtil.listSubfolderNames(VhUserPaths.USERS_DIR)) {
        movedCount += await this.moveOwnFiles(userName, absorbedDocId, receivingDocId);
        movedCount += await this.moveMergedInFiles(userName, absorbedDocId, receivingDocId);
      }
      return movedCount;
    } finally {
      this.visitStatsCache.endHistoryMove(absorbedDocId);
      this.visitStatsCache.endHistoryMove(receivingDocId);
    }
  }

  // ── private ─────────────────────────────────────────────────────────────

  private assertMergeable(absorbedDocId: string, receivingDocId: string): void {
    for (const docId of [absorbedDocId, receivingDocId]) {
      if (!DocIdFilenameSafety.isFilenameSafeId(docId)) {
        throw new Error(`Doc id is not filename-safe docId=[${docId}]`);
      }
    }
    if (absorbedDocId === receivingDocId) {
      throw new Error(`Cannot merge a doc's history into itself docId=[${absorbedDocId}]`);
    }
  }

  private async moveOwnFiles(userName: string, absorbedDocId: string, receivingDocId: string): Promise<number> {
    let movedCount = 0;
    const deviceNames = await this.hiddenFileUtil.listSubfolderNames(VhV3Paths.focusDurationPerDeviceDir(userName));
    for (const deviceName of deviceNames) {
      const sourcePath = VhV3Paths.focusDurationFilePath(userName, deviceName, absorbedDocId);
      if (!(await this.hiddenFileUtil.exists(sourcePath))) {
        continue;
      }
      const targetDir = VhV3Paths.mergedInDocDir(userName, deviceName, receivingDocId);
      await this.moveToFreeName(sourcePath, targetDir, absorbedDocId);
      movedCount++;
    }
    return movedCount;
  }

  private async moveMergedInFiles(userName: string, absorbedDocId: string, receivingDocId: string): Promise<number> {
    let movedCount = 0;
    const deviceNames = await this.hiddenFileUtil.listSubfolderNames(VhV3Paths.mergedInPerDeviceDir(userName));
    for (const deviceName of deviceNames) {
      const sourceDir = VhV3Paths.mergedInDocDir(userName, deviceName, absorbedDocId);
      const fileNames = (await this.hiddenFileUtil.listFileNames(sourceDir))
        .filter(fileName => fileName.endsWith(VhV3Paths.FOCUS_DURATION_FILE_EXTENSION));
      const targetDir = VhV3Paths.mergedInDocDir(userName, deviceName, receivingDocId);
      for (const fileName of fileNames) {
        const baseName = fileName.slice(0, -VhV3Paths.FOCUS_DURATION_FILE_EXTENSION.length);
        await this.moveToFreeName(`${sourceDir}/${fileName}`, targetDir, baseName);
        movedCount++;
      }
      // Non-recursive: a foreign leftover file keeps the dir (and itself).
      await this.hiddenFileUtil.removeFolderIfEmpty(sourceDir);
    }
    return movedCount;
  }

  private async moveToFreeName(sourcePath: string, targetDir: string, baseName: string): Promise<void> {
    await this.hiddenFileUtil.rename(sourcePath, await this.freeTargetPath(targetDir, baseName));
  }

  /** `<dir>/<base>.vh_v3`, else the first free `<dir>/<base>__N.vh_v3`. */
  private async freeTargetPath(targetDir: string, baseName: string): Promise<string> {
    const extension = VhV3Paths.FOCUS_DURATION_FILE_EXTENSION;
    const plainPath = `${targetDir}/${baseName}${extension}`;
    if (!(await this.hiddenFileUtil.exists(plainPath))) {
      return plainPath;
    }
    for (let suffix = VhV3HistoryMerger.FIRST_COLLISION_SUFFIX; suffix <= VhV3HistoryMerger.MAX_COLLISION_SUFFIX; suffix++) {
      const candidate = `${targetDir}/${baseName}${VhV3HistoryMerger.COLLISION_SUFFIX_SEPARATOR}${suffix}${extension}`;
      if (!(await this.hiddenFileUtil.exists(candidate))) {
        return candidate;
      }
    }
    throw new Error(`No free merged-in file name targetDir=[${targetDir}] baseName=[${baseName}]`);
  }
}
