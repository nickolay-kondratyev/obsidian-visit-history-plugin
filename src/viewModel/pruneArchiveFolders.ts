import { ARCHIVE_DIR_NAME } from '../Constants';
import type { VaultNode } from '../core/data/VaultNode';

/**
 * Returns a copy of `root` with every strict-descendant FOLDER named
 * `_archive` ({@link ARCHIVE_DIR_NAME}) removed.
 *
 * The root itself is always kept — so a heatmap view scoped INTO an archive
 * (file-explorer right-click → "Open heatmap for folder") shows its contents,
 * while any view rooted above it hides it. Nested archives below the root are
 * hidden by the same rule reapplied.
 *
 * Folders left EMPTY by the prune are dropped too — buildVaultTree only
 * creates folders along tracked-file paths, so a folder whose only content
 * was its archive would otherwise render as an empty box.
 *
 * Pure: the input tree is never mutated (it is reused across view roots).
 */
export function pruneArchiveFolders(root: VaultNode): VaultNode {
  if (!root.children) return root;
  return {
    ...root,
    children: root.children
      .filter(c => !(c.children && c.name === ARCHIVE_DIR_NAME))
      .map(pruneArchiveFolders)
      .filter(c => !c.children || c.children.length > 0),
  };
}
