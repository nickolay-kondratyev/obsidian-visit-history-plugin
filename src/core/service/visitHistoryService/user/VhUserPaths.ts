/**
 * USER level of the visit-history path layout
 * (see docs/visit-history-format.md):
 *
 *   .visit_history/user/<user-name>/v3/...   (VhV3Paths)
 *
 * Per-user directories group history by the human using the vault — several
 * people syncing one vault never mix their histories. <user-name> resolution
 * is owned by UserNameProvider. A user dir may also hold a dormant legacy
 * `v2/` tree (moved there by VhUserScopeMigrationService; never read or
 * written).
 *
 * The top dir is a DOT-folder on purpose: invisible to Obsidian's Vault API
 * and metadata cache, so VH files never pollute search, graph, or backlinks.
 * All access goes through HiddenFileUtil.
 */
export class VhUserPaths {
  static readonly TOP_DIR = '.visit_history';
  static readonly USERS_DIR = `${VhUserPaths.TOP_DIR}/user`;

  /** Root of one user's visit history: `.visit_history/user/<user-name>`. */
  static userRootDir(userName: string): string {
    return `${VhUserPaths.USERS_DIR}/${userName}`;
  }
}
