import { LEGACY_VISIBLE_VISIT_HISTORY_TOP_DIR } from '../../../Constants';
import { HiddenFileUtil } from '../../util/file/hidden/HiddenFileUtil';
import { UserNotifier } from '../../util/userComm/UserNotifier';

/**
 * One-shot migration of the pre-July-2026 dot-hidden top dir:
 *
 *   .visit_history  →  __visit_history   (whole subtree, single rename)
 *
 * This targets the INTERIM visible `__visit_history` (a literal, NOT
 * VhUserPaths.TOP_DIR, which now points at the dot-hidden
 * `.plugin_data/visit_history`): ancient vaults chain through both
 * migrations — this one lands data in `__visit_history`, then
 * VhPluginDataMoveMigrationService (next in onload) relocates the live V3
 * files into `.plugin_data/visit_history`.
 *
 * Runs FIRST in onload (main.ts) — BEFORE user-name resolution and BEFORE
 * the plugin-data move: keeping the whole subtree together here lets the
 * later move + user-scope migrations do the finer relocation.
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
  /** Rename destination: the interim visible dir, later relocated under `.plugin_data/`. */
  private static readonly DESTINATION_DIR = LEGACY_VISIBLE_VISIT_HISTORY_TOP_DIR;

  constructor(
    private readonly hiddenFileUtil: HiddenFileUtil,
    private readonly userNotifier: UserNotifier,
  ) {
  }

  /** Renames the legacy top dir to the new one. No-op when it is absent. */
  async migrateIfLegacyPresent(): Promise<void> {
    const legacyDir = VhTopDirRenameMigrationService.LEGACY_TOP_DIR;
    const destinationDir = VhTopDirRenameMigrationService.DESTINATION_DIR;
    if (!(await this.hiddenFileUtil.exists(legacyDir))) {
      return;
    }
    if (await this.hiddenFileUtil.exists(destinationDir)) {
      console.error(
        `[VHP][VhTopDirRenameMigration] destination already exists — legacy dir kept legacyDir=[${legacyDir}] destination=[${destinationDir}]`,
      );
      this.userNotifier.showError(
        `Visit History: both "${legacyDir}" and "${destinationDir}" folders exist. ` +
        `Migration skipped — "${legacyDir}" was left untouched. ` +
        `Please move its content into "${destinationDir}" (or delete it) manually.`,
      );
      return;
    }
    await this.hiddenFileUtil.rename(legacyDir, destinationDir);
  }
}
