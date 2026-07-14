import { HiddenFileUtil } from '../../util/file/hidden/HiddenFileUtil';
import { VhUserPaths } from '../visitHistoryService/user/VhUserPaths';

/**
 * One-shot migration of the pre-user-scoped layout (before July 2026):
 *
 *   .visit_history/v2  →  .visit_history/user/<user-name>/v2
 *   .visit_history/v3  →  .visit_history/user/<user-name>/v3
 *
 * Runs early in onload (main.ts), BEFORE focus tracking starts, so new
 * visits can never be written to the legacy location mid-move. Legacy data
 * is attributed to the CURRENT user — with the old layout there is no way
 * to know who produced it (owner decision).
 *
 * When a destination dir already exists (this vault was migrated by another
 * synced device while this one still held legacy dirs), the legacy dir is
 * LEFT IN PLACE and an error is logged — this migration never merges and
 * never deletes.
 *
 * Both legacy version dirs are moved — v2 data is dormant (V3 is the only
 * history read or written) but still gets organized under the user tree
 * (owner decision); its content is never touched.
 *
 * NOTE: legacy V1 lives under `_visit_history/` and is NOT migrated — it
 * stays on disk untouched (excluded from tracking via IsTrackedProvider).
 *
 * TODO(cleanup): such one-shot layout migrations should be cleaned up after
 * 2026-October — delete this class (and its wiring in main.ts) then.
 */
export class VhUserScopeMigrationService {
  /** Version dirs of the legacy layout, directly under `.visit_history/`. */
  private static readonly LEGACY_VERSION_DIRS = ['v2', 'v3'] as const;

  constructor(
    private readonly hiddenFileUtil: HiddenFileUtil,
    private readonly userName: string,
  ) {
  }

  /** Moves any legacy version dir under the current user. No-op when none exist. */
  async migrateIfLegacyPresent(): Promise<void> {
    for (const versionDir of VhUserScopeMigrationService.LEGACY_VERSION_DIRS) {
      const legacyDir = `${VhUserPaths.TOP_DIR}/${versionDir}`;
      if (!(await this.hiddenFileUtil.exists(legacyDir))) {
        continue;
      }
      const userScopedDir = `${VhUserPaths.userRootDir(this.userName)}/${versionDir}`;
      if (await this.hiddenFileUtil.exists(userScopedDir)) {
        console.error(
          `[VHP][VhUserScopeMigration] destination already exists — legacy dir kept legacyDir=[${legacyDir}] destination=[${userScopedDir}]`,
        );
        continue;
      }
      await this.hiddenFileUtil.rename(legacyDir, userScopedDir);
    }
  }
}
