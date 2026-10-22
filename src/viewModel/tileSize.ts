import type { VaultNode } from '../core/data/VaultNode';
import type { SizeBy, SizeCurve } from './heatmapConfig';

// ── Treemap tile sizing ──────────────────────────────────────────────────────
// Pure (obsidian-free) rules for how big a leaf's tile is. The d3 layout sums
// these leaf values, so a collapsed folder's area is automatically the sum of
// its files' already-curved, already-scaled values in the active mode.

/** Resolved sizing for one render: the active mode's curve + plain per-type factors. */
export interface TileSizing {
  sizeBy: SizeBy;
  curve: SizeCurve;
  /** Per-type multipliers (slider bounds stripped), applied AFTER the curve. */
  scales: Record<string, number>;
}

const MS_PER_SECOND = 1000;
/**
 * Content-mode floor (bytes), applied BEFORE the curve: keeps 0-byte notes
 * visible under every curve (log1p(0) and sqrt(0) are 0).
 */
const MIN_CONTENT_BYTES = 1;
const DEFAULT_TYPE_SCALE = 1;

/**
 * Raw size before the curve: bytes (floored) for content, focus SECONDS for
 * visit time — seconds, not ms, so a few seconds of focus doesn't count as
 * thousands of units under the curve.
 */
export function rawTileUnits(leaf: VaultNode, sizeBy: SizeBy): number {
  return sizeBy === 'contentSize'
    ? Math.max(MIN_CONTENT_BYTES, leaf.size ?? 0)
    : (leaf.totalFocusMs ?? 0) / MS_PER_SECOND;
}

export function applySizeCurve(raw: number, curve: SizeCurve): number {
  switch (curve) {
    case 'linear':
      return raw;
    case 'sqrt':
      return Math.sqrt(raw);
    case 'log':
      return Math.log1p(raw);
  }
}

/** The per-type factor the sizing applies to this leaf (1 for unknown types). */
export function typeScale(leaf: VaultNode, sizing: TileSizing): number {
  return sizing.scales[leaf.type ?? ''] ?? DEFAULT_TYPE_SCALE;
}

/**
 * Treemap value of a leaf: `curve(raw) × typeScale`. NOT rounded — sqrt/log
 * values are small, rounding would erase their differences (d3 sums floats fine).
 */
export function tileValue(leaf: VaultNode, sizing: TileSizing): number {
  return applySizeCurve(rawTileUnits(leaf, sizing.sizeBy), sizing.curve) * typeScale(leaf, sizing);
}

/** True iff the leaf has no area in this mode: visit-time mode and no focus time. */
export function isHiddenBySizing(leaf: VaultNode, sizeBy: SizeBy): boolean {
  return sizeBy === 'visitTime' && !((leaf.totalFocusMs ?? 0) > 0);
}

/** Tree with zero-size leaves left out, plus how many were left out. */
export interface UnvisitedHidingResult {
  tree: VaultNode;
  hiddenCount: number;
}

/**
 * In visit-time mode, returns a copy of `root` without leaves that have no
 * focus time (they would be 0-area tiles); folders left empty are dropped
 * recursively, the root itself always survives (possibly childless).
 *
 * Content mode hides nothing → returns `root` AS-IS (reference equality keeps
 * the TreemapViz layout memo cheap) with a count of 0.
 *
 * Pure: the input tree is never mutated. Mirrors filterVaultTree.
 */
export function hideUnvisitedFiles(root: VaultNode, sizeBy: SizeBy): UnvisitedHidingResult {
  if (sizeBy !== 'visitTime') return { tree: root, hiddenCount: 0 };
  const counter = { hidden: 0 };
  const tree = hideInFolder(root, sizeBy, counter);
  return { tree, hiddenCount: counter.hidden };
}

function hideInFolder(folder: VaultNode, sizeBy: SizeBy, counter: { hidden: number }): VaultNode {
  const children: VaultNode[] = [];
  for (const child of folder.children ?? []) {
    if (child.children) {
      const kept = hideInFolder(child, sizeBy, counter);
      if (kept.children && kept.children.length > 0) children.push(kept);
    } else if (isHiddenBySizing(child, sizeBy)) {
      counter.hidden += 1;
    } else {
      children.push(child);
    }
  }
  return { ...folder, children };
}
