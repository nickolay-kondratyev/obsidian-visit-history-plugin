import type { VaultNode } from '../core/data/VaultNode';

/**
 * Resolves a vault folder path (e.g. "Projects/Alpha") to the chain of folder
 * nodes from the tree root down to that folder: `[Projects, Alpha]`.
 *
 * Used to open the heatmap pre-drilled into a folder (file-tree context menu)
 * while keeping "back" navigation to every ancestor working.
 *
 * @returns The ancestor trail ending at the target folder, or `null` when the
 *          path does not resolve to a folder node (e.g. folder contains no
 *          tracked files, so it was never added to the tree).
 */
export function findFolderTrail(root: VaultNode, folderPath: string): VaultNode[] | null {
  const trail: VaultNode[] = [];
  let node = root;
  for (const part of folderPath.split('/')) {
    const child = node.children?.find(c => c.name === part && c.children);
    if (!child) return null;
    trail.push(child);
    node = child;
  }
  return trail;
}
