import { describe, expect, it } from 'vitest';
import { filterVaultTree, isFilterActive, type HeatmapTreeFilter } from './filterVaultTree';
import type { VaultNode } from '../core/data/VaultNode';

function folder(name: string, children: VaultNode[]): VaultNode {
  return { name, children };
}

function leaf(path: string): VaultNode {
  const name = path.split('/').at(-1) ?? path;
  return { name, path, type: 'md', size: 10 };
}

function leafPaths(node: VaultNode): string[] {
  if (!node.children) return node.path ? [node.path] : [];
  return node.children.flatMap(leafPaths);
}

const NO_FILTER: HeatmapTreeFilter = { pathTerms: [], contentMatchedPaths: undefined };

function pathFilter(...terms: string[]): HeatmapTreeFilter {
  return { pathTerms: terms, contentMatchedPaths: undefined };
}

function contentFilter(...matchedPaths: string[]): HeatmapTreeFilter {
  return { pathTerms: [], contentMatchedPaths: new Set(matchedPaths) };
}

describe('filterVaultTree', () => {
  it('should return the SAME reference when no filter is active', () => {
    // GIVEN a tree and an inactive filter (no terms of either kind)
    const root = folder('vault', [leaf('a.md')]);
    // WHEN filtering
    const filtered = filterVaultTree(root, NO_FILTER);
    // THEN the identical object comes back (keeps the layout memo cheap)
    expect(filtered).toBe(root);
  });

  it('should match a path term case-insensitively against FOLDER name segments', () => {
    // GIVEN a leaf whose match is only in an ancestor folder name
    const root = folder('vault', [
      folder('Projects', [folder('Alpha', [leaf('Projects/Alpha/x.md')])]),
      leaf('other.md'),
    ]);
    // WHEN filtering by the lowercase folder name
    const filtered = filterVaultTree(root, pathFilter('alpha'));
    // THEN the leaf under the matching folder is kept
    expect(leafPaths(filtered)).toEqual(['Projects/Alpha/x.md']);
  });

  it('should prune folders left empty recursively', () => {
    // GIVEN a nested folder whose only leaf does not match
    const root = folder('vault', [
      folder('deep', [folder('deeper', [leaf('deep/deeper/other.md')])]),
      leaf('match.md'),
    ]);
    // WHEN filtering
    const filtered = filterVaultTree(root, pathFilter('match.md'));
    // THEN the emptied folder chain is gone entirely
    expect((filtered.children ?? []).map(c => c.name)).toEqual(['match.md']);
  });

  it('should keep the root even when nothing matches', () => {
    // GIVEN a filter matching no leaf
    const root = folder('vault', [leaf('a.md')]);
    // WHEN filtering
    const filtered = filterVaultTree(root, pathFilter('zzz-no-such'));
    // THEN the root survives with zero children
    expect({ name: filtered.name, children: filtered.children }).toEqual({
      name: 'vault',
      children: [],
    });
  });

  it('should OR across multiple path terms (union of matches)', () => {
    // GIVEN two disjoint path terms
    const root = folder('vault', [leaf('alpha.md'), leaf('beta.md'), leaf('gamma.md')]);
    // WHEN filtering
    const filtered = filterVaultTree(root, pathFilter('alpha', 'beta'));
    // THEN both matching leaves survive
    expect(leafPaths(filtered)).toEqual(['alpha.md', 'beta.md']);
  });

  it('should keep a content-matched leaf with zero path terms', () => {
    // GIVEN a content match on one leaf and no path terms
    const root = folder('vault', [leaf('a.md'), leaf('b.md')]);
    // WHEN filtering
    const filtered = filterVaultTree(root, contentFilter('b.md'));
    // THEN only that leaf survives
    expect(leafPaths(filtered)).toEqual(['b.md']);
  });

  it('should OR across kinds (path match OR content match keeps the leaf)', () => {
    // GIVEN a path term hitting one leaf and a content match hitting another
    const root = folder('vault', [leaf('alpha.md'), leaf('beta.md'), leaf('gamma.md')]);
    const filter: HeatmapTreeFilter = {
      pathTerms: ['alpha'],
      contentMatchedPaths: new Set(['beta.md']),
    };
    // WHEN filtering
    const filtered = filterVaultTree(root, filter);
    // THEN both survive — each matched only one kind
    expect(leafPaths(filtered)).toEqual(['alpha.md', 'beta.md']);
  });

  it('should filter by path only when contentMatchedPaths is undefined', () => {
    // GIVEN path terms with content filtering inactive
    const root = folder('vault', [leaf('alpha.md'), leaf('beta.md')]);
    // WHEN filtering
    const filtered = filterVaultTree(root, pathFilter('alpha'));
    // THEN path filtering applies alone
    expect(leafPaths(filtered)).toEqual(['alpha.md']);
  });

  it('should remove ALL leaves for an EMPTY content set with no path terms', () => {
    // GIVEN content terms exist but matched nothing (or results are pending)
    const root = folder('vault', [leaf('a.md'), leaf('b.md')]);
    // WHEN filtering
    const filtered = filterVaultTree(root, contentFilter());
    // THEN nothing survives — empty set is NOT "inactive"
    expect(leafPaths(filtered)).toEqual([]);
  });

  it('should not mutate the input tree', () => {
    // GIVEN a tree and an aggressive filter
    const root = folder('vault', [folder('sub', [leaf('sub/a.md')]), leaf('b.md')]);
    const snapshot = structuredClone(root);
    // WHEN filtering
    filterVaultTree(root, pathFilter('zzz-no-such'));
    // THEN the original tree is untouched (pure function)
    expect(root).toEqual(snapshot);
  });
});

describe('isFilterActive', () => {
  it('should be false with no path terms and inactive content filtering', () => {
    // GIVEN no terms of either kind
    expect(isFilterActive(NO_FILTER)).toBe(false);
  });

  it('should be true with a path term', () => {
    expect(isFilterActive(pathFilter('a'))).toBe(true);
  });

  it('should be true with an EMPTY content-matched set (terms exist, no hits)', () => {
    expect(isFilterActive(contentFilter())).toBe(true);
  });
});
