import { describe, expect, it } from 'vitest';
import { hierarchy } from 'd3-hierarchy';
import {
  hideUnvisitedFiles,
  isHiddenBySizing,
  tileValue,
  type TileSizing,
} from './tileSize';
import type { VaultNode } from '../core/data/VaultNode';
import type { SizeCurve } from './heatmapConfig';

const ONE_KB = 1024;
const TEN_SECONDS_MS = 10_000;

function folder(name: string, children: VaultNode[]): VaultNode {
  return { name, children };
}

function leaf(path: string, fields: Partial<VaultNode> = {}): VaultNode {
  const name = path.split('/').at(-1) ?? path;
  return { name, path, type: 'md', size: ONE_KB, totalFocusMs: 0, ...fields };
}

function leafPaths(node: VaultNode): string[] {
  if (!node.children) return node.path ? [node.path] : [];
  return node.children.flatMap(leafPaths);
}

function contentSizing(curve: SizeCurve, scales: Record<string, number> = {}): TileSizing {
  return { sizeBy: 'contentSize', curve, scales };
}

function visitSizing(curve: SizeCurve, scales: Record<string, number> = {}): TileSizing {
  return { sizeBy: 'visitTime', curve, scales };
}

describe('tileSize', () => {
  describe('tileValue', () => {
    describe('content size', () => {
      it('should use the byte size as-is under the linear curve', () => {
        // GIVEN a 1 KB note, linear curve
        // WHEN computing its tile value
        const value = tileValue(leaf('a.md'), contentSizing('linear'));
        // THEN it is the raw byte count
        expect(value).toBe(ONE_KB);
      });

      it('should take the square root of the bytes under the sqrt curve', () => {
        const value = tileValue(leaf('a.md'), contentSizing('sqrt'));
        expect(value).toBe(Math.sqrt(ONE_KB));
      });

      it('should take log1p of the bytes under the log curve', () => {
        const value = tileValue(leaf('a.md'), contentSizing('log'));
        expect(value).toBe(Math.log1p(ONE_KB));
      });

      it('should apply the type scale AFTER the curve', () => {
        // GIVEN a canvas scaled ×0.3 under sqrt
        const canvas = leaf('b.canvas', { type: 'canvas' });
        // WHEN computing its tile value
        const value = tileValue(canvas, contentSizing('sqrt', { canvas: 0.3 }));
        // THEN the scale multiplies the curved value (30% of the area)
        expect(value).toBe(Math.sqrt(ONE_KB) * 0.3);
      });

      it('should default to a ×1 scale for a type without a factor', () => {
        const value = tileValue(leaf('a.md'), contentSizing('linear', { canvas: 0.3 }));
        expect(value).toBe(ONE_KB);
      });

      it('should not round fractional values', () => {
        // GIVEN a 2-byte note under sqrt (√2 is irrational)
        const value = tileValue(leaf('a.md', { size: 2 }), contentSizing('sqrt'));
        // THEN the exact float survives
        expect(value).toBe(Math.SQRT2);
      });

      it.each<SizeCurve>(['linear', 'sqrt', 'log'])(
        'should keep a 0-byte note positive under the %s curve',
        curve => {
          // GIVEN an empty note
          const empty = leaf('empty.md', { size: 0 });
          // WHEN computing its tile value
          const value = tileValue(empty, contentSizing(curve));
          // THEN the 1-byte floor keeps it visible
          expect(value).toBeGreaterThan(0);
        },
      );
    });

    describe('visit time', () => {
      it('should size by focus SECONDS, not milliseconds', () => {
        // GIVEN 10 s of focus, linear curve
        const visited = leaf('a.md', { totalFocusMs: TEN_SECONDS_MS });
        // WHEN computing its tile value
        const value = tileValue(visited, visitSizing('linear'));
        // THEN the raw unit is seconds
        expect(value).toBe(10);
      });

      it('should take the square root of the seconds under the sqrt curve', () => {
        const visited = leaf('a.md', { totalFocusMs: TEN_SECONDS_MS });
        const value = tileValue(visited, visitSizing('sqrt'));
        expect(value).toBe(Math.sqrt(10));
      });

      it('should take log1p of the seconds under the log curve', () => {
        const visited = leaf('a.md', { totalFocusMs: TEN_SECONDS_MS });
        const value = tileValue(visited, visitSizing('log'));
        expect(value).toBe(Math.log1p(10));
      });

      it('should apply the type scale after the curve', () => {
        const visited = leaf('a.md', { totalFocusMs: TEN_SECONDS_MS });
        const value = tileValue(visited, visitSizing('sqrt', { md: 2 }));
        expect(value).toBe(Math.sqrt(10) * 2);
      });

      it('should ignore the byte size', () => {
        // GIVEN two notes with equal focus but different sizes
        const small = leaf('a.md', { size: 1, totalFocusMs: TEN_SECONDS_MS });
        const big = leaf('b.md', { size: 1_000_000, totalFocusMs: TEN_SECONDS_MS });
        // THEN their tiles are equal
        expect(tileValue(small, visitSizing('linear'))).toBe(tileValue(big, visitSizing('linear')));
      });
    });
  });

  describe('isHiddenBySizing', () => {
    it('should hide a never-visited note in visit-time mode', () => {
      expect(isHiddenBySizing(leaf('a.md', { totalFocusMs: 0 }), 'visitTime')).toBe(true);
    });

    it('should hide a note with undefined focus time in visit-time mode', () => {
      expect(isHiddenBySizing(leaf('a.md', { totalFocusMs: undefined }), 'visitTime')).toBe(true);
    });

    it.each([Number.NaN, -5])('should hide a note with invalid focus time %s in visit-time mode', ms => {
      expect(isHiddenBySizing(leaf('a.md', { totalFocusMs: ms }), 'visitTime')).toBe(true);
    });

    it('should keep a visited note in visit-time mode', () => {
      expect(isHiddenBySizing(leaf('a.md', { totalFocusMs: 1 }), 'visitTime')).toBe(false);
    });

    it('should never hide in content-size mode', () => {
      expect(isHiddenBySizing(leaf('a.md', { totalFocusMs: 0 }), 'contentSize')).toBe(false);
    });
  });

  describe('hideUnvisitedFiles', () => {
    // GIVEN (shared): one visited note at root, one unvisited at root, and a
    // folder holding ONLY unvisited notes
    const visited = leaf('visited.md', { totalFocusMs: TEN_SECONDS_MS });
    const unvisited = leaf('unvisited.md');
    const coldFolder = folder('cold', [leaf('cold/a.md'), leaf('cold/b.md')]);
    const root = folder('vault', [visited, unvisited, coldFolder]);

    it('should return the SAME reference in content-size mode', () => {
      expect(hideUnvisitedFiles(root, 'contentSize').tree).toBe(root);
    });

    it('should count nothing hidden in content-size mode', () => {
      expect(hideUnvisitedFiles(root, 'contentSize').hiddenCount).toBe(0);
    });

    it('should keep only visited notes in visit-time mode', () => {
      const { tree } = hideUnvisitedFiles(root, 'visitTime');
      expect(leafPaths(tree)).toEqual(['visited.md']);
    });

    it('should drop folders left empty in visit-time mode', () => {
      const { tree } = hideUnvisitedFiles(root, 'visitTime');
      expect(tree.children?.some(c => c.name === 'cold')).toBe(false);
    });

    it('should count every hidden note, nested ones included', () => {
      expect(hideUnvisitedFiles(root, 'visitTime').hiddenCount).toBe(3);
    });

    it('should keep the root even when everything is hidden', () => {
      // GIVEN a tree with no visited notes at all
      const { tree } = hideUnvisitedFiles(folder('vault', [unvisited]), 'visitTime');
      // THEN the root survives, childless
      expect(tree).toEqual({ name: 'vault', children: [] });
    });

    it('should not mutate the input tree', () => {
      hideUnvisitedFiles(root, 'visitTime');
      expect(root.children?.length).toBe(3);
    });
  });

  describe('d3 sum integration (collapsed folder area)', () => {
    it('should give a folder the sum of its files\' curved, scaled values', () => {
      // GIVEN a folder with an md and a canvas, sized by visit time under sqrt
      const sizing = visitSizing('sqrt', { md: 1, canvas: 0.5 });
      const md = leaf('f/a.md', { totalFocusMs: 9_000 });
      const canvas = leaf('f/b.canvas', { type: 'canvas', totalFocusMs: 16_000 });
      const tree = folder('vault', [folder('f', [md, canvas])]);
      // WHEN d3 sums the hierarchy the way TreemapViz does
      const summed = hierarchy(tree).sum(d => (d.children ? 0 : tileValue(d, sizing)));
      // THEN the folder value equals sqrt(9)×1 + sqrt(16)×0.5
      expect(summed.children?.[0]?.value).toBe(3 + 2);
    });
  });
});
