import { TFile } from 'obsidian';
import type { VaultNode } from '../core/data/VaultNode';
import type { TrackedFile } from '../core/util/vault/VaultUtil';

// ── File classification ────────────────────────────────────────────────────

type FileType = 'md' | 'canvas' | 'excalidraw';

function classifyFile(file: TFile): FileType | null {
  if (file.extension === 'canvas') return 'canvas';
  if (file.extension === 'excalidraw') return 'excalidraw';
  // Excalidraw plugin: .excalidraw.md naming convention
  if (file.extension === 'md' && file.basename.endsWith('.excalidraw'))
    return 'excalidraw';
  if (file.extension === 'md') return 'md';
  return null;
}

// ── Tree builder ────────────────────────────────────────────────────────────

/**
 * Builds a VaultNode tree from tracked vault files.
 *
 * Filters to supported types (md/canvas/excalidraw) and constructs a nested
 * tree matching the vault folder structure.
 *
 * @param vaultName    - Root node display name (the vault's name).
 * @param trackedFiles - Tracked files with time metadata, from
 *                       {@link VaultUtil.getTrackedFiles}.
 */
export function buildVaultTree(vaultName: string, trackedFiles: TrackedFile[]): VaultNode {
  const root: VaultNode = {name: vaultName, children: []};

  for (const trackedFile of trackedFiles) {
    const leaf = buildLeafNode(trackedFile);
    if (!leaf) continue;

    const parts = trackedFile.file.path.split('/');
    let node = root;

    // Walk/create intermediate folder nodes
    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.children!.find(
        c => c.name === parts[i] && c.children,
      );
      if (!child) {
        child = {name: parts[i]!, children: []};
        node.children!.push(child);
      }
      node = child;
    }

    node.children!.push(leaf);
  }

  return root;
}

/**
 * The heatmap leaf node for one tracked file, or undefined when its type is
 * not shown (not md/canvas/excalidraw). The ONE place file fields map onto
 * leaf fields — the public API builds its leaves here too, so its colors use
 * exactly the heatmap's type and timestamps.
 */
export function buildLeafNode({file, timeMetadata}: TrackedFile): VaultNode | undefined {
  const type = classifyFile(file);
  if (!type) return undefined;
  return {
    name: file.name,
    path: file.path,
    type,
    size: file.stat.size,
    createdAt: timeMetadata.createdMs,
    lastModifiedAt: timeMetadata.modifiedMs,
    lastVisitedAt: timeMetadata.visitedMs,
    totalFocusMs: timeMetadata.totalFocusMs,
  };
}
