import type { HierarchyRectangularNode } from 'd3-hierarchy';
import type { HeatField } from '../view/constants';
import { TILE_TITLE_MIN_WIDTH_PX } from '../view/utils';
import type { VaultNode } from '../core/data/VaultNode';

type RectNode = HierarchyRectangularNode<VaultNode>;

/**
 * Smallest average file-tile side worth rendering — tied to the leaf-title
 * label threshold: below it a tile can show no name and is hard to hit.
 */
export const MIN_FILE_TILE_SIDE_PX = TILE_TITLE_MIN_WIDTH_PX;

/**
 * A folder whose rect gives each of its files less than this area (on
 * average) collapses into ONE count tile instead of rendering every file.
 *
 * WHY: such files would average under ~32×32 px at the fitted (unzoomed,
 * scale 1) view — too small to label or click. It also bounds the rendered
 * file tiles to ≈ viewport area / MIN_AREA_PER_FILE_PX2 regardless of vault
 * size — the perf guarantee (one SVG node per file was the bottleneck).
 *
 * CEILING: decided once on the UNZOOMED layout — zooming in does not expand
 * collapsed folders (upgrade path: re-partition per zoom scale). The view
 * root's own direct files are never collapsed (only folders collapse).
 */
export const MIN_AREA_PER_FILE_PX2 = MIN_FILE_TILE_SIDE_PX * MIN_FILE_TILE_SIDE_PX;

/** A dense folder rendered as one tile in place of its whole subtree. */
export interface CollapsedFolder {
  node: RectNode;
  /** File leaves under the folder, at all depths. */
  fileCount: number;
  /**
   * The "most recent" file (max value of the active heat field) — the tile
   * is colored like it in BOTH color modes. All-null → the first file.
   */
  representative: RectNode;
}

/** What TreemapViz renders, in paint order: folders → collapsed → leaves. */
export interface TreemapPartition {
  /** Rendered (non-collapsed) folders below the root, parents first. */
  folders: RectNode[];
  collapsedFolders: CollapsedFolder[];
  /** File leaves NOT inside a collapsed folder. */
  leaves: RectNode[];
}

/** Per-folder aggregate gathered in the single bottom-up pass. */
interface FolderSummary {
  fileCount: number;
  /** undefined only when the subtree holds no files. */
  representative: RectNode | undefined;
}

/**
 * Splits a laid-out treemap into what to render, collapsing folders too dense
 * for their on-screen area (see MIN_AREA_PER_FILE_PX2). Pure — no DOM.
 */
export function partitionTreemapNodes(root: RectNode, field: HeatField): TreemapPartition {
  const summaries = summarizeFolders(root, field);
  const partition: TreemapPartition = { folders: [], collapsedFolders: [], leaves: [] };
  // The root (current view root) is never collapsed — always descend into it.
  for (const child of root.children ?? []) {
    visit(child, summaries, partition);
  }
  return partition;
}

/** Pre-order walk: parents are pushed before children (SVG paint order). */
function visit(node: RectNode, summaries: Map<RectNode, FolderSummary>, out: TreemapPartition): void {
  if (!isFolder(node)) {
    out.leaves.push(node);
    return;
  }
  // d3 leaves `children` undefined for an EMPTY folder — nothing to render
  // (matches the pre-collapse `d.children` folder filter).
  if (!node.children) return;

  const summary = summaries.get(node);
  // No representative ⇔ no files: a file-less folder never collapses.
  if (summary?.representative && isTooDense(node, summary.fileCount)) {
    out.collapsedFolders.push({
      node,
      fileCount: summary.fileCount,
      representative: summary.representative,
    });
    return;
  }

  out.folders.push(node);
  for (const child of node.children) {
    visit(child, summaries, out);
  }
}

function isTooDense(node: RectNode, fileCount: number): boolean {
  const area = (node.x1 - node.x0) * (node.y1 - node.y0);
  return area / fileCount < MIN_AREA_PER_FILE_PX2;
}

/**
 * ONE bottom-up pass (eachAfter) computing every folder's file count and
 * representative — O(n), unlike leaves() per folder (O(n·depth)).
 */
function summarizeFolders(root: RectNode, field: HeatField): Map<RectNode, FolderSummary> {
  const summaries = new Map<RectNode, FolderSummary>();
  root.eachAfter(node => {
    if (!isFolder(node)) return;
    let fileCount = 0;
    let representative: RectNode | undefined;
    for (const child of node.children ?? []) {
      const childSummary: FolderSummary = isFolder(child)
        ? (summaries.get(child) ?? { fileCount: 0, representative: undefined })
        : { fileCount: 1, representative: child };
      fileCount += childSummary.fileCount;
      representative = moreRecent(representative, childSummary.representative, field);
    }
    summaries.set(node, { fileCount, representative });
  });
  return summaries;
}

/**
 * The more recent of two candidates. Ties and all-null keep `best` — the
 * earlier one in d3 traversal order (children are folded in order).
 */
function moreRecent(
  best: RectNode | undefined,
  candidate: RectNode | undefined,
  field: HeatField,
): RectNode | undefined {
  if (!best) return candidate;
  if (!candidate) return best;
  const candidateTs = candidate.data[field];
  if (candidateTs == null) return best;
  const bestTs = best.data[field];
  return bestTs == null || candidateTs > bestTs ? candidate : best;
}

/** VaultNode folders carry `children` (possibly empty); files never do. */
function isFolder(node: RectNode): boolean {
  return node.data.children !== undefined;
}
