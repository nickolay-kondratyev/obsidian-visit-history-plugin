/**
 * USER level of the visit-history path layout
 * (see docs/visit-history-format.md):
 *
 *   .plugin_data/visit_history/user/<user-name>/v3/...   (VhV3Paths)
 *
 * Per-user directories group history by the human using the vault — several
 * people syncing one vault never mix their histories. <user-name> resolution
 * is owned by UserNameProvider. A user dir may also hold a dormant legacy
 * `v2/` tree (moved there by VhUserScopeMigrationService; never read or
 * written).
 *
 * The top dir is a dot-hidden folder, so Obsidian's Vault API (file explorer,
 * search) never sees it — no IsTrackedProvider gate is required for it (that
 * gate still excludes legacy leftovers). All VH file I/O goes through
 * HiddenFileUtil (DataAdapter), which reaches dot-folders the Vault API can't.
 */
export class VhUserPaths {
  /**
   * WHY dot-hidden under `.plugin_data/`: a visible top dir (the interim
   * `__visit_history/`) can trip other plugins that activate on visible-folder
   * creation, and clutters the file explorer. Living under a dot-folder avoids
   * both. This is a deliberate reversal of the earlier "visible so Obsidian
   * Sync syncs it" stance.
   * WHY-NOT visible for Obsidian Sync: Obsidian Sync does not sync dot-hidden
   * folders, so VH no longer syncs across devices via Sync — accepted as the
   * lesser cost (per-device histories stay local).
   * https://forum.obsidian.md/t/obsidian-sync-sync-hidden-files-and-folders-as-well-start-with-a-dot/32123/26
   * (Legacy `.visit_history` and `__visit_history` dirs are migrated by
   * VhTopDirRenameMigrationService + VhPluginDataMoveMigrationService.)
   */
  static readonly TOP_DIR = '.plugin_data/visit_history';
  static readonly USERS_DIR = `${VhUserPaths.TOP_DIR}/user`;

  /** Root of one user's visit history: `.plugin_data/visit_history/user/<user-name>`. */
  static userRootDir(userName: string): string {
    return `${VhUserPaths.USERS_DIR}/${userName}`;
  }
}
