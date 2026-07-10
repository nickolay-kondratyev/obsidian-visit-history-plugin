import { describe, expect, it } from 'vitest';
import { pruneArchiveFolders } from './pruneArchiveFolders';
import { ARCHIVE_DIR_NAME } from '../Constants';
import type { VaultNode } from '../core/data/VaultNode';

function folder(name: string, children: VaultNode[]): VaultNode {
  return { name, children };
}

function leaf(name: string): VaultNode {
  return { name, path: name, type: 'md', size: 10 };
}

function childNames(node: VaultNode): string[] {
  return (node.children ?? []).map(c => c.name);
}

describe('pruneArchiveFolders', () => {
  it('should remove a top-level _archive folder', () => {
    // GIVEN a vault root with an _archive folder next to a regular folder
    const root = folder('vault', [
      folder(ARCHIVE_DIR_NAME, [leaf('old.md')]),
      folder('notes', [leaf('a.md')]),
    ]);
    // WHEN pruning
    const pruned = pruneArchiveFolders(root);
    // THEN the _archive folder is gone
    expect(childNames(pruned)).toEqual(['notes']);
  });

  it('should remove a nested _archive folder', () => {
    // GIVEN an _archive folder deeper in the tree
    const root = folder('vault', [
      folder('projects', [
        folder(ARCHIVE_DIR_NAME, [leaf('done.md')]),
        leaf('active.md'),
      ]),
    ]);
    // WHEN pruning
    const pruned = pruneArchiveFolders(root);
    // THEN only the archive is removed, siblings survive
    expect(childNames(pruned.children![0]!)).toEqual(['active.md']);
  });

  it('should keep the root itself even when it is named _archive', () => {
    // GIVEN a view scoped INTO an archive (the archive IS the root)
    const root = folder(ARCHIVE_DIR_NAME, [leaf('old.md')]);
    // WHEN pruning
    const pruned = pruneArchiveFolders(root);
    // THEN its contents stay visible
    expect(childNames(pruned)).toEqual(['old.md']);
  });

  it('should remove an _archive nested inside an _archive root', () => {
    // GIVEN a view scoped into an archive that contains another archive
    const root = folder(ARCHIVE_DIR_NAME, [
      leaf('old.md'),
      folder(ARCHIVE_DIR_NAME, [leaf('older.md')]),
    ]);
    // WHEN pruning
    const pruned = pruneArchiveFolders(root);
    // THEN the same rule reapplies below the root
    expect(childNames(pruned)).toEqual(['old.md']);
  });

  it('should drop a folder left empty by the prune', () => {
    // GIVEN a folder whose only tracked content is its archive
    const root = folder('vault', [
      folder('old-project', [folder(ARCHIVE_DIR_NAME, [leaf('done.md')])]),
      leaf('a.md'),
    ]);
    // WHEN pruning
    const pruned = pruneArchiveFolders(root);
    // THEN the emptied folder does not render as an empty box
    expect(childNames(pruned)).toEqual(['a.md']);
  });

  it('should keep a FILE whose name is _archive-like', () => {
    // GIVEN a file (no children) named like an archive dir
    const root = folder('vault', [leaf(`${ARCHIVE_DIR_NAME}.md`)]);
    // WHEN pruning
    const pruned = pruneArchiveFolders(root);
    // THEN it is untouched — only folders named exactly _archive are pruned
    expect(childNames(pruned)).toEqual([`${ARCHIVE_DIR_NAME}.md`]);
  });

  it('should not mutate the input tree', () => {
    // GIVEN a tree with an archive
    const root = folder('vault', [
      folder(ARCHIVE_DIR_NAME, [leaf('old.md')]),
      leaf('a.md'),
    ]);
    // WHEN pruning
    pruneArchiveFolders(root);
    // THEN the original still holds both children (pure function — the
    // unpruned tree is reused for other view roots)
    expect(childNames(root)).toEqual([ARCHIVE_DIR_NAME, 'a.md']);
  });

  it('should return the same node when no archives exist', () => {
    // GIVEN an archive-free subtree
    const root = folder('vault', [folder('notes', [leaf('a.md')])]);
    // WHEN pruning
    const pruned = pruneArchiveFolders(root);
    // THEN the tree shape is preserved
    expect(childNames(pruned.children![0]!)).toEqual(['a.md']);
  });
});
