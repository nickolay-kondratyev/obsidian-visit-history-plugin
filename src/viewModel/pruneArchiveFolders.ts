import { ARCHIVE_DIR_NAME } from '../Constants';
import type { VaultNode } from '../core/data/VaultNode';

/**
 * True when the view root (the trail's last node) is at or under an
 * `_archive` folder. Callers skip {@link pruneArchiveFolders} then: within an
 * archive ALL archived content is visible — so moving one archive under
 * another never loses visibility into it.
 *
 * @param trail - Ancestor chain from just below the vault root down to the
 *                current view root (App's navStack). Empty = full vault.
 */
export function isWithinArchive(trail: VaultNode[]): boolean {
  return trail.some(n => n.name === ARCHIVE_DIR_NAME);
}

/**
 * Returns a copy of `root` with every strict-descendant FOLDER named
 * `_archive` ({@link ARCHIVE_DIR_NAME}) removed.
 *
 * Only applied when the view root is OUTSIDE any archive (see
 * {@link isWithinArchive}) — scoping into an archive (file-explorer
 * right-click → "Open heatmap for folder") shows everything under it.
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
