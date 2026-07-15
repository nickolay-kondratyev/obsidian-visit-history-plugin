import type { VaultNode } from '../core/data/VaultNode';

/**
 * Resolved heatmap include-filter, consumed by {@link filterVaultTree}.
 *
 * OR semantics across everything: a leaf is kept when its path contains ANY
 * path term (case-insensitive) OR its path is in the content-matched set.
 */
export interface HeatmapTreeFilter {
  /** Raw path terms; matching lowercases both sides. */
  pathTerms: readonly string[];
  /**
   * Vault paths matched by content terms (resolved asynchronously by
   * ContentTermMatcher). `undefined` = no content terms exist = content
   * filtering inactive — distinct from an EMPTY set (terms exist, nothing
   * matched / results still pending).
   */
  contentMatchedPaths: ReadonlySet<string> | undefined;
}

/** True when the filter would remove anything, i.e. any term is in play. */
export function isFilterActive(filter: HeatmapTreeFilter): boolean {
  return filter.pathTerms.length > 0 || filter.contentMatchedPaths !== undefined;
}

/**
 * Returns a copy of `root` keeping only leaves matching the filter
 * (OR across path terms and the content-matched set). Folders left empty are
 * dropped recursively; the root itself always survives (possibly childless).
 *
 * No active filter → returns `root` AS-IS (reference equality keeps the
 * TreemapViz layout memo cheap).
 *
 * Pure: the input tree is never mutated (it is reused across view roots).
 * Mirrors the pruneArchiveFolders pattern.
 */
export function filterVaultTree(root: VaultNode, filter: HeatmapTreeFilter): VaultNode {
  if (!isFilterActive(filter)) return root;
  const loweredTerms = filter.pathTerms.map(t => t.toLowerCase());
  return filterFolder(root, loweredTerms, filter.contentMatchedPaths);
}

function filterFolder(
  folder: VaultNode,
  loweredTerms: readonly string[],
  contentMatchedPaths: ReadonlySet<string> | undefined,
): VaultNode {
  return {
    ...folder,
    children: (folder.children ?? [])
      .map(c => (c.children ? filterFolder(c, loweredTerms, contentMatchedPaths) : c))
      .filter(c =>
        c.children ? c.children.length > 0 : keepLeaf(c, loweredTerms, contentMatchedPaths),
      ),
  };
}

function keepLeaf(
  leaf: VaultNode,
  loweredTerms: readonly string[],
  contentMatchedPaths: ReadonlySet<string> | undefined,
): boolean {
  const path = leaf.path ?? '';
  const loweredPath = path.toLowerCase();
  return (
    loweredTerms.some(t => loweredPath.includes(t)) ||
    (contentMatchedPaths?.has(path) ?? false)
  );
}
