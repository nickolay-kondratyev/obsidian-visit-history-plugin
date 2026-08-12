import { HiddenFileUtil } from '../../util/file/hidden/HiddenFileUtil';
import { VhUserPaths } from '../visitHistoryService/user/VhUserPaths';
import { VhV3Paths } from '../visitHistoryService/v3/VhV3Paths';

/**
 * One-shot migration of the interim VISIBLE top dir into the dot-hidden
 * plugin-data location (before 2026-August):
 *
 *   __visit_history/<rel>  →  .plugin_data/visit_history/<rel>
 *
 * WHY only some files move: the top dir is being hidden under `.plugin_data/`
 * to stop tripping plugins that react to visible-folder creation (see
 * VhUserPaths.TOP_DIR). Only the LIVE V3 payload is relocated — files ending
 * in `.vh_v3` and the generated V3 README — preserving their relative path.
 * Everything else (dormant `v2/` payloads, foreign files) is LEFT behind:
 * v2 is never read, and the interim dir stays excluded from tracking via
 * IsTrackedProvider, so stranding it is harmless (owner decision).
 *
 * Runs right after VhTopDirRenameMigrationService in onload (main.ts),
 * name-independent and BEFORE onLayoutReady — so the user-name modal lists
 * existing `user/<name>` dirs from the NEW location. The still-pre-user-scoped
 * `v3/` dir (if any) lands at `.plugin_data/visit_history/v3/`; the post-pin
 * VhUserScopeMigrationService then moves it under `user/<name>/` (it operates
 * on VhUserPaths.TOP_DIR, now the new location).
 *
 * Never merges, never overwrites: when a destination file already exists the
 * source is SKIPPED (left in place). Cleanup prunes ONLY empty directories
 * (post-order, incl. the top dir itself) — any dir still holding leftover
 * files survives. Per-file failures are logged and skipped; the walk never
 * aborts. main.ts wraps the whole call in try/catch so onload never breaks.
 *
 * TODO(cleanup): such one-shot layout migrations should be cleaned up after
 * 2027-February — delete this class (and its wiring in main.ts) then.
 */
export class VhPluginDataMoveMigrationService {
  /**
   * Interim visible top dir being retired. NOT VhUserPaths.TOP_DIR — that now
   * points at the destination (`.plugin_data/visit_history`).
   */
  private static readonly LEGACY_TOP_DIR = '__visit_history';

  constructor(private readonly hiddenFileUtil: HiddenFileUtil) {
  }

  /** Moves live V3 files out of the legacy visible dir. No-op when it is absent. */
  async migrateIfLegacyPresent(): Promise<void> {
    const legacyTop = VhPluginDataMoveMigrationService.LEGACY_TOP_DIR;
    if (!(await this.hiddenFileUtil.exists(legacyTop))) {
      return;
    }
    await this.migrateDir(legacyTop);
  }

  /**
   * Post-order recursion over one legacy dir: moves its matching files,
   * recurses into subdirs, then prunes the dir if it ends up empty.
   */
  private async migrateDir(dir: string): Promise<void> {
    for (const fileName of await this.hiddenFileUtil.listFileNames(dir)) {
      if (VhPluginDataMoveMigrationService.isMigratableFile(fileName)) {
        await this.moveFile(`${dir}/${fileName}`);
      }
    }
    for (const subfolder of await this.hiddenFileUtil.listSubfolderNames(dir)) {
      await this.migrateDir(`${dir}/${subfolder}`);
    }
    await this.hiddenFileUtil.removeFolderIfEmpty(dir);
  }

  /** Moves one legacy file to the new top dir, preserving its relative path. */
  private async moveFile(sourcePath: string): Promise<void> {
    const relativePath = sourcePath.slice(
      VhPluginDataMoveMigrationService.LEGACY_TOP_DIR.length + 1,
    );
    const destPath = `${VhUserPaths.TOP_DIR}/${relativePath}`;
    try {
      // rename() throws on an existing destination; pre-check keeps the log
      // clean and makes the skip explicit (never merges, never overwrites).
      if (await this.hiddenFileUtil.exists(destPath)) {
        console.error(
          `[VHP][VhPluginDataMove] destination exists — source kept sourcePath=[${sourcePath}] destPath=[${destPath}]`,
        );
        return;
      }
      await this.hiddenFileUtil.rename(sourcePath, destPath);
    } catch (error) {
      // Per-file failure must not abort the rest of the walk.
      console.error(
        `[VHP][VhPluginDataMove] failed to move file sourcePath=[${sourcePath}] destPath=[${destPath}]`,
        error,
      );
    }
  }

  private static isMigratableFile(fileName: string): boolean {
    return (
      fileName.endsWith(VhV3Paths.FOCUS_DURATION_FILE_EXTENSION) ||
      fileName === VhV3Paths.README_FILENAME
    );
  }
}
