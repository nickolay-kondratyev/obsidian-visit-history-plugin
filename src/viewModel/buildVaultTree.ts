import { Vault, TFile } from 'obsidian';
import type { VaultNode } from '../core/data/VaultNode';

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
 * Builds a VaultNode tree from all tracked vault files.
 *
 * Walks every file in the vault, filters to supported types (md/canvas/excalidraw),
 * and constructs a nested tree matching the vault folder structure.
 *
 * @param vault         - The Obsidian vault instance.
 * @param visitedMsMap  - path → last-visited Unix-ms (from FileTimeMetadata.visitedMs).
 *                        Files not in this map get `lastVisitedAt: null`.
 */
export async function buildVaultTree(
  vault: Vault,
  visitedMsMap: Record<string, number> = {},
): Promise<VaultNode> {
  const files = vault.getFiles();
  const root: VaultNode = { name: vault.getName(), children: [] };

  for (const file of files) {
    const type = classifyFile(file);
    if (!type) continue;

    const parts = file.path.split('/');
    let node = root;

    // Walk/create intermediate folder nodes
    for (let i = 0; i < parts.length - 1; i++) {
      let child = node.children!.find(
        c => c.name === parts[i] && c.children,
      );
      if (!child) {
        child = { name: parts[i]!, children: [] };
        node.children!.push(child);
      }
      node = child;
    }

    const visitedMs = visitedMsMap[file.path];

    node.children!.push({
      name: file.name,
      path: file.path,
      type,
      size: file.stat.size,
      createdAt: file.stat.ctime,
      lastModifiedAt: file.stat.mtime,
      lastVisitedAt: visitedMs !== undefined ? visitedMs : null,
    });
  }

  return root;
}
