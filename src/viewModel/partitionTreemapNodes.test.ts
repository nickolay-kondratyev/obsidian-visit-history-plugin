import { describe, expect, it } from 'vitest';
import { hierarchy, treemap } from 'd3-hierarchy';
import type { HierarchyRectangularNode } from 'd3-hierarchy';
import {
  MIN_FILE_TILE_SIDE_PX,
  partitionTreemapNodes,
  type TreemapPartition,
} from './partitionTreemapNodes';
import type { VaultNode } from '../core/data/VaultNode';

// ── Fixtures ────────────────────────────────────────────────────────────────

const ROOMY_SIDE_PX = 200;
const CRAMPED_SIDE_PX = 10;
const UNUSED_LAYOUT_SIZE_PX = 1000;

interface Stamps {
  lastVisitedAt?: number | null;
  createdAt?: number;
}

function folder(name: string, children: VaultNode[]): VaultNode {
  return { name, children };
}

function file(name: string, stamps: Stamps = {}): VaultNode {
  return { name, path: name, type: 'md', size: 10, lastVisitedAt: null, ...stamps };
}

interface RectSize {
  w: number;
  h: number;
}

/**
 * Lays the tree out with d3 (for correct node types), then OVERRIDES the
 * rects of the named nodes so folder areas are deterministic. Names must be
 * unique within a fixture.
 */
function layout(tree: VaultNode, sizes: Record<string, RectSize>): HierarchyRectangularNode<VaultNode> {
  const root = treemap<VaultNode>().size([UNUSED_LAYOUT_SIZE_PX, UNUSED_LAYOUT_SIZE_PX])(
    hierarchy(tree).sum(d => d.size ?? 0),
  );
  root.each(node => {
    const size = sizes[node.data.name];
    if (!size) return;
    node.x0 = 0;
    node.y0 = 0;
    node.x1 = size.w;
    node.y1 = size.h;
  });
  return root;
}

function roomy(): RectSize {
  return { w: ROOMY_SIDE_PX, h: ROOMY_SIDE_PX };
}

function cramped(): RectSize {
  return { w: CRAMPED_SIDE_PX, h: CRAMPED_SIDE_PX };
}

function names(nodes: HierarchyRectangularNode<VaultNode>[]): string[] {
  return nodes.map(n => n.data.name);
}

function collapsedNames(partition: TreemapPartition): string[] {
  return partition.collapsedFolders.map(c => c.node.data.name);
}

function representativeOf(partition: TreemapPartition): string | undefined {
  return partition.collapsedFolders[0]?.representative.data.name;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('partitionTreemapNodes', () => {
  describe('GIVEN a roomy folder', () => {
    const tree = folder('vault', [folder('notes', [file('a.md'), file('b.md')])]);
    const partition = partitionTreemapNodes(layout(tree, { notes: roomy() }), 'lastVisitedAt');

    it('should render its files as leaves', () => {
      expect(names(partition.leaves)).toEqual(['a.md', 'b.md']);
    });

    it('should render it as a folder', () => {
      expect(names(partition.folders)).toEqual(['notes']);
    });

    it('should not collapse it', () => {
      expect(partition.collapsedFolders).toEqual([]);
    });
  });

  describe('GIVEN a dense folder with a nested subfolder', () => {
    const tree = folder('vault', [
      folder('dense', [file('a.md'), file('b.md'), folder('sub', [file('c.md')])]),
    ]);
    const partition = partitionTreemapNodes(layout(tree, { dense: cramped() }), 'lastVisitedAt');

    it('should collapse it', () => {
      expect(collapsedNames(partition)).toEqual(['dense']);
    });

    it('should count files at all depths', () => {
      expect(partition.collapsedFolders[0]?.fileCount).toBe(3);
    });

    it('should not render its subfolders as folders', () => {
      expect(partition.folders).toEqual([]);
    });

    it('should not render its files as leaves', () => {
      expect(partition.leaves).toEqual([]);
    });
  });

  describe('GIVEN a roomy outer folder holding a dense inner folder', () => {
    const tree = folder('vault', [
      folder('outer', [folder('inner', [file('a.md'), file('b.md')]), file('x.md')]),
    ]);
    const partition = partitionTreemapNodes(
      layout(tree, { outer: roomy(), inner: cramped() }),
      'lastVisitedAt',
    );

    it('should collapse only the inner folder', () => {
      expect(collapsedNames(partition)).toEqual(['inner']);
    });

    it('should render the outer folder', () => {
      expect(names(partition.folders)).toEqual(['outer']);
    });

    it('should render the outer folder direct files as leaves', () => {
      expect(names(partition.leaves)).toEqual(['x.md']);
    });
  });

  describe('GIVEN a dense view root', () => {
    const tree = folder('vault', [file('a.md'), file('b.md'), file('c.md')]);
    const partition = partitionTreemapNodes(layout(tree, { vault: cramped() }), 'lastVisitedAt');

    it('should never collapse the root', () => {
      expect(names(partition.leaves)).toEqual(['a.md', 'b.md', 'c.md']);
    });

    it('should not list the root as a folder', () => {
      expect(partition.folders).toEqual([]);
    });
  });

  describe('GIVEN a childless view root', () => {
    const partition = partitionTreemapNodes(layout(folder('vault', []), {}), 'lastVisitedAt');

    it('should render no leaves', () => {
      expect(partition.leaves).toEqual([]);
    });
  });

  describe('GIVEN an empty folder in a cramped rect', () => {
    const tree = folder('vault', [folder('empty', []), file('a.md')]);
    const partition = partitionTreemapNodes(layout(tree, { empty: cramped() }), 'lastVisitedAt');

    it('should not collapse it', () => {
      expect(partition.collapsedFolders).toEqual([]);
    });

    it('should not render it as a folder', () => {
      expect(partition.folders).toEqual([]);
    });
  });

  describe('density threshold boundary', () => {
    it('should NOT collapse when area per file is exactly the minimum', () => {
      // GIVEN one file in a folder of exactly MIN_FILE_TILE_SIDE_PX²
      const tree = folder('vault', [folder('edge', [file('a.md')])]);
      const side = MIN_FILE_TILE_SIDE_PX;
      // WHEN partitioning
      const partition = partitionTreemapNodes(layout(tree, { edge: { w: side, h: side } }), 'lastVisitedAt');
      // THEN it stays expanded (strict <)
      expect(partition.collapsedFolders).toEqual([]);
    });

    it('should collapse when area per file is one row below the minimum', () => {
      // GIVEN one file in a folder one px shorter than the minimum square
      const tree = folder('vault', [folder('edge', [file('a.md')])]);
      const side = MIN_FILE_TILE_SIDE_PX;
      // WHEN partitioning
      const partition = partitionTreemapNodes(layout(tree, { edge: { w: side, h: side - 1 } }), 'lastVisitedAt');
      // THEN it collapses
      expect(collapsedNames(partition)).toEqual(['edge']);
    });
  });

  describe('representative', () => {
    it('should be the file with the max active-field stamp', () => {
      // GIVEN a dense folder whose middle file is the most recently visited
      const tree = folder('vault', [
        folder('dense', [
          file('a.md', { lastVisitedAt: 100 }),
          file('b.md', { lastVisitedAt: 300 }),
          file('c.md', { lastVisitedAt: 200 }),
        ]),
      ]);
      // WHEN partitioning by lastVisitedAt
      const partition = partitionTreemapNodes(layout(tree, { dense: cramped() }), 'lastVisitedAt');
      // THEN the most recent file represents the folder
      expect(representativeOf(partition)).toBe('b.md');
    });

    it('should find the most recent file in a nested subfolder', () => {
      // GIVEN the most recent file sits one level deeper
      const tree = folder('vault', [
        folder('dense', [
          file('a.md', { lastVisitedAt: 100 }),
          folder('sub', [file('deep.md', { lastVisitedAt: 500 })]),
        ]),
      ]);
      // WHEN partitioning
      const partition = partitionTreemapNodes(layout(tree, { dense: cramped() }), 'lastVisitedAt');
      // THEN the nested file represents the folder
      expect(representativeOf(partition)).toBe('deep.md');
    });

    it('should prefer a stamped file over earlier unstamped ones', () => {
      // GIVEN the first file was never visited
      const tree = folder('vault', [
        folder('dense', [file('never.md'), file('seen.md', { lastVisitedAt: 1 })]),
      ]);
      // WHEN partitioning
      const partition = partitionTreemapNodes(layout(tree, { dense: cramped() }), 'lastVisitedAt');
      // THEN the stamped file represents the folder
      expect(representativeOf(partition)).toBe('seen.md');
    });

    it('should be the first file when no file has a stamp', () => {
      // GIVEN no file in the folder was ever visited
      const tree = folder('vault', [folder('dense', [file('first.md'), file('second.md')])]);
      // WHEN partitioning
      const partition = partitionTreemapNodes(layout(tree, { dense: cramped() }), 'lastVisitedAt');
      // THEN the first file represents the folder ("no data" color)
      expect(representativeOf(partition)).toBe('first.md');
    });

    it('should be the first of tied files', () => {
      // GIVEN two files with the same stamp
      const tree = folder('vault', [
        folder('dense', [file('first.md', { lastVisitedAt: 7 }), file('second.md', { lastVisitedAt: 7 })]),
      ]);
      // WHEN partitioning
      const partition = partitionTreemapNodes(layout(tree, { dense: cramped() }), 'lastVisitedAt');
      // THEN the earlier one in traversal order wins
      expect(representativeOf(partition)).toBe('first.md');
    });

    it('should follow the active heat field', () => {
      // GIVEN one file most recently visited and another most recently created
      const tree = folder('vault', [
        folder('dense', [
          file('visited.md', { lastVisitedAt: 900, createdAt: 1 }),
          file('created.md', { lastVisitedAt: 1, createdAt: 900 }),
        ]),
      ]);
      // WHEN partitioning by createdAt
      const partition = partitionTreemapNodes(layout(tree, { dense: cramped() }), 'createdAt');
      // THEN the most recently created file represents the folder
      expect(representativeOf(partition)).toBe('created.md');
    });
  });
});
