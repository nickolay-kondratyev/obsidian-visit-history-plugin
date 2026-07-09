import { describe, expect, it } from 'vitest';
import { buildVaultTree } from './buildVaultTree';
import type { TrackedFile } from '../core/util/vault/VaultUtil';
import type { VaultNode } from '../core/data/VaultNode';
import { makeTFile } from '../testSupport/fileFactory';

const VAULT_NAME = 'my-vault';

function tracked(path: string, visitedMs: number | null = null, size = 10): TrackedFile {
  return {
    file: makeTFile({ path, size, ctime: 100, mtime: 200 }),
    timeMetadata: { createdMs: 100, modifiedMs: 200, visitedMs },
  };
}

function childNamed(node: VaultNode, name: string): VaultNode {
  const child = node.children?.find(c => c.name === name);
  if (!child) throw new Error(`No child named ${name} in ${node.name}`);
  return child;
}

describe('buildVaultTree', () => {
  it('should name the root after the vault', () => {
    // GIVEN no files
    // WHEN building the tree
    const root = buildVaultTree(VAULT_NAME, []);
    // THEN the root carries the vault name
    expect(root.name).toBe(VAULT_NAME);
  });

  it('should nest files under their folder path', () => {
    // GIVEN a file two folders deep
    const root = buildVaultTree(VAULT_NAME, [tracked('projects/alpha/overview.md')]);
    // WHEN walking the tree
    const leaf = childNamed(childNamed(childNamed(root, 'projects'), 'alpha'), 'overview.md');
    // THEN the leaf sits at the mirrored vault location
    expect(leaf.path).toBe('projects/alpha/overview.md');
  });

  it('should share one folder node between sibling files', () => {
    // GIVEN two files in the same folder
    const root = buildVaultTree(VAULT_NAME, [tracked('notes/a.md'), tracked('notes/b.md')]);
    // WHEN inspecting the folder
    const folder = childNamed(root, 'notes');
    // THEN both leaves are under a single folder node
    expect(folder.children!.length).toBe(2);
  });

  it('should classify .canvas files', () => {
    // GIVEN a canvas file
    const root = buildVaultTree(VAULT_NAME, [tracked('board.canvas')]);
    // THEN it is typed canvas
    expect(childNamed(root, 'board.canvas').type).toBe('canvas');
  });

  it('should classify .excalidraw.md files as excalidraw', () => {
    // GIVEN an Excalidraw-plugin-convention file
    const root = buildVaultTree(VAULT_NAME, [tracked('drawing.excalidraw.md')]);
    // THEN the .excalidraw.md naming convention wins over plain md
    expect(childNamed(root, 'drawing.excalidraw.md').type).toBe('excalidraw');
  });

  it('should skip files with unsupported extensions', () => {
    // GIVEN an image file slipping through
    const root = buildVaultTree(VAULT_NAME, [tracked('image.png')]);
    // THEN it is not added to the tree
    expect(root.children!.length).toBe(0);
  });

  it('should carry visit metadata onto the leaf', () => {
    // GIVEN a file visited at a known time
    const visitedMs = 1750000000000;
    const root = buildVaultTree(VAULT_NAME, [tracked('a.md', visitedMs)]);
    // THEN lastVisitedAt mirrors FileTimeMetadata.visitedMs
    expect(childNamed(root, 'a.md').lastVisitedAt).toBe(visitedMs);
  });

  it('should mark never-visited files with null lastVisitedAt', () => {
    // GIVEN a file with no visit history
    const root = buildVaultTree(VAULT_NAME, [tracked('a.md', null)]);
    // THEN lastVisitedAt is null (renders as "no data" in the heatmap)
    expect(childNamed(root, 'a.md').lastVisitedAt).toBeNull();
  });
});
