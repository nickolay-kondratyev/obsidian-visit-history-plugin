/**
 * USER level of the visit-history path layout
 * (see docs/visit-history-format.md):
 *
 *   __visit_history/user/<user-name>/v3/...   (VhV3Paths)
 *
 * Per-user directories group history by the human using the vault — several
 * people syncing one vault never mix their histories. <user-name> resolution
 * is owned by UserNameProvider. A user dir may also hold a dormant legacy
 * `v2/` tree (moved there by VhUserScopeMigrationService; never read or
 * written).
 *
 * The top dir is VISIBLE to Obsidian's Vault API (file explorer, search),
 * so IsTrackedProvider excludes it from tracking and the heatmap. All VH
 * file I/O still goes through HiddenFileUtil (DataAdapter) — it predates
 * the rename and works for visible folders too.
 */
export class VhUserPaths {
  /**
   * WHY double-underscore and NOT a dot-folder: Obsidian Sync does not sync
   * dot-hidden folders, so `.visit_history` data never reached other devices.
   * https://forum.obsidian.md/t/obsidian-sync-sync-hidden-files-and-folders-as-well-start-with-a-dot/32123/26
   * (Legacy `.visit_history` dirs are renamed by VhTopDirRenameMigrationService.)
   */
  static readonly TOP_DIR = '__visit_history';
  static readonly USERS_DIR = `${VhUserPaths.TOP_DIR}/user`;

  /** Root of one user's visit history: `__visit_history/user/<user-name>`. */
  static userRootDir(userName: string): string {
    return `${VhUserPaths.USERS_DIR}/${userName}`;
  }
}
