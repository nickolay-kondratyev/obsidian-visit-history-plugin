import { HiddenFileUtil } from '../../util/file/hidden/HiddenFileUtil';
import { UserNotifier } from '../../util/userComm/UserNotifier';
import { VhUserPaths } from '../visitHistoryService/user/VhUserPaths';

/**
 * One-shot migration of the pre-July-2026 dot-hidden top dir:
 *
 *   .visit_history  →  __visit_history   (whole subtree, single rename)
 *
 * WHY: Obsidian Sync does not sync dot-hidden folders — see the
 * VhUserPaths.TOP_DIR comment for the rationale and issue link.
 *
 * Runs FIRST in onload (main.ts) — BEFORE user-name resolution and BEFORE
 * VhUserScopeMigrationService: the user-name modal lists
 * `__visit_history/user` for joinable identities, so renaming later would
 * hide the existing users from the prompt.
 *
 * When BOTH dirs exist (this vault was migrated by another synced device
 * while this one still held the legacy dir), the migration is SKIPPED:
 * `.visit_history` is LEFT IN PLACE — never merged, never deleted — and the
 * user is notified of the conflict (owner decision; not silent because it
 * needs manual resolution).
 *
 * TODO(cleanup): such one-shot layout migrations should be cleaned up after
 * 2026-October — delete this class (and its wiring in main.ts) then.
 */
export class VhTopDirRenameMigrationService {
  /** Pre-rename top dir. Dot-hidden, so Obsidian Sync never synced it. */
  private static readonly LEGACY_TOP_DIR = '.visit_history';

  constructor(
    private readonly hiddenFileUtil: HiddenFileUtil,
    private readonly userNotifier: UserNotifier,
  ) {
  }

  /** Renames the legacy top dir to the new one. No-op when it is absent. */
  async migrateIfLegacyPresent(): Promise<void> {
    const legacyDir = VhTopDirRenameMigrationService.LEGACY_TOP_DIR;
    if (!(await this.hiddenFileUtil.exists(legacyDir))) {
      return;
    }
    if (await this.hiddenFileUtil.exists(VhUserPaths.TOP_DIR)) {
      console.error(
        `[VHP][VhTopDirRenameMigration] destination already exists — legacy dir kept legacyDir=[${legacyDir}] destination=[${VhUserPaths.TOP_DIR}]`,
      );
      this.userNotifier.showError(
        `Visit History: both "${legacyDir}" and "${VhUserPaths.TOP_DIR}" folders exist. ` +
        `Migration skipped — "${legacyDir}" was left untouched. ` +
        `Please move its content into "${VhUserPaths.TOP_DIR}" (or delete it) manually.`,
      );
      return;
    }
    await this.hiddenFileUtil.rename(legacyDir, VhUserPaths.TOP_DIR);
  }
}
