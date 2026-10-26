import { describe, expect, it } from 'vitest';
import { color as d3Color } from 'd3-color';
import { LeafColorRule, type LeafColorSettings } from './LeafColorRule';
import { GRADIENTS, TYPE_C } from '../view/constants';
import type { VaultNode } from '../core/data/VaultNode';
import { DEFAULT_HEATMAP_CONFIG } from './heatmapConfig';

const MS_PER_DAY = 86400000;
const NOW_MS = Date.UTC(2026, 9, 22, 12, 0, 0);
const HOT_DAYS = 10;
const COLD_DAYS = 30;
/** Exactly halfway between HOT_DAYS and COLD_DAYS → interpolation t = 0.5. */
const MIDPOINT_DAYS = 20;
/** nature hot #1db954 and cold #1a3a7a averaged per channel (rounded): (28, 122, 103). */
const NATURE_MIDPOINT_HEX = '#1c7a67';
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/;

function daysAgo(days: number): number {
  return NOW_MS - days * MS_PER_DAY;
}

function leaf(overrides: Partial<VaultNode> = {}): VaultNode {
  return {
    name: 'a.md',
    path: 'a.md',
    type: 'md',
    size: 1,
    createdAt: daysAgo(500),
    lastModifiedAt: daysAgo(1),
    lastVisitedAt: null,
    totalFocusMs: 0,
    ...overrides,
  };
}

const HEATMAP: LeafColorSettings = {
  colorMode: 'heatmap',
  gradKey: 'nature',
  field: 'lastModifiedAt',
  hotDays: HOT_DAYS,
  coldDays: COLD_DAYS,
};
const TYPE: LeafColorSettings = { ...HEATMAP, colorMode: 'type' };

describe('LeafColorRule', () => {
  describe('baseColor', () => {
    describe('heatmap mode', () => {
      it('should color by the modified time WHEN the field is lastModifiedAt', () => {
        // GIVEN a recently modified, long-ago created leaf
        // WHEN coloring by modified time
        const color = LeafColorRule.baseColor(leaf(), HEATMAP, NOW_MS);
        // THEN it is hot
        expect(color.fill).toBe(GRADIENTS.nature.hot);
      });

      it('should color by the created time WHEN the field is createdAt', () => {
        // GIVEN a long-ago created leaf
        // WHEN coloring by created time
        const color = LeafColorRule.baseColor(leaf(), { ...HEATMAP, field: 'createdAt' }, NOW_MS);
        // THEN it is cold
        expect(color.fill).toBe(GRADIENTS.nature.cold);
      });

      it('should color by the last visit WHEN the field is lastVisitedAt', () => {
        // GIVEN a leaf visited yesterday
        const visited = leaf({ lastVisitedAt: daysAgo(1) });
        // WHEN coloring by visit time
        const color = LeafColorRule.baseColor(visited, { ...HEATMAP, field: 'lastVisitedAt' }, NOW_MS);
        // THEN it is hot
        expect(color.fill).toBe(GRADIENTS.nature.hot);
      });

      it('should use the active gradient', () => {
        // GIVEN the ember gradient
        // WHEN coloring a hot leaf
        const color = LeafColorRule.baseColor(leaf(), { ...HEATMAP, gradKey: 'ember' }, NOW_MS);
        // THEN it is ember's hot color
        expect(color.fill).toBe(GRADIENTS.ember.hot);
      });

      it('should return the nil color WHEN the field has no timestamp', () => {
        // GIVEN a never-visited leaf
        // WHEN coloring by visit time
        const color = LeafColorRule.baseColor(leaf(), { ...HEATMAP, field: 'lastVisitedAt' }, NOW_MS);
        // THEN it is the nil color
        expect(color.fill).toBe(GRADIENTS.nature.nil);
      });

      it('should report no data WHEN the field has no timestamp', () => {
        // GIVEN a never-visited leaf
        // WHEN coloring by visit time
        const color = LeafColorRule.baseColor(leaf(), { ...HEATMAP, field: 'lastVisitedAt' }, NOW_MS);
        // THEN it has no data
        expect(color.hasData).toBe(false);
      });

      it('should report data WHEN the field has a timestamp', () => {
        // GIVEN a leaf with a modified time
        // WHEN coloring by modified time
        const color = LeafColorRule.baseColor(leaf(), HEATMAP, NOW_MS);
        // THEN it has data
        expect(color.hasData).toBe(true);
      });
    });

    describe('type mode', () => {
      it('should use the type fill', () => {
        // GIVEN a canvas leaf
        // WHEN coloring by type
        const color = LeafColorRule.baseColor(leaf({ type: 'canvas' }), TYPE, NOW_MS);
        // THEN it is the canvas fill
        expect(color.fill).toBe(TYPE_C.canvas!.fill);
      });

      it('should use the unknown-type fill WHEN the leaf has no type', () => {
        // GIVEN a leaf without a type
        // WHEN coloring by type
        const color = LeafColorRule.baseColor(leaf({ type: undefined }), TYPE, NOW_MS);
        // THEN it is the unknown-type fill
        expect(color.fill).toBe(LeafColorRule.UNKNOWN_TYPE_COLORS.fill);
      });

      it('should report data even WHEN the field has no timestamp', () => {
        // GIVEN a never-visited leaf, field = visited
        // WHEN coloring by type
        const color = LeafColorRule.baseColor(leaf(), { ...TYPE, field: 'lastVisitedAt' }, NOW_MS);
        // THEN it still has data (type mode needs no timestamp)
        expect(color.hasData).toBe(true);
      });
    });
  });

  describe('heatColor', () => {
    it('should return the hot color AT exactly hotDays', () => {
      // GIVEN a stamp exactly hotDays old
      // WHEN coloring
      const fill = LeafColorRule.heatColor(daysAgo(HOT_DAYS), 'nature', HOT_DAYS, COLD_DAYS, NOW_MS);
      // THEN it is still hot (inclusive boundary)
      expect(fill).toBe(GRADIENTS.nature.hot);
    });

    it('should return the cold color AT exactly coldDays', () => {
      // GIVEN a stamp exactly coldDays old
      // WHEN coloring
      const fill = LeafColorRule.heatColor(daysAgo(COLD_DAYS), 'nature', HOT_DAYS, COLD_DAYS, NOW_MS);
      // THEN it is cold (inclusive boundary)
      expect(fill).toBe(GRADIENTS.nature.cold);
    });

    it('should return the hot color for a future stamp (clock skew)', () => {
      // GIVEN a stamp one day in the future
      // WHEN coloring
      const fill = LeafColorRule.heatColor(daysAgo(-1), 'nature', HOT_DAYS, COLD_DAYS, NOW_MS);
      // THEN it is hot
      expect(fill).toBe(GRADIENTS.nature.hot);
    });

    it('should interpolate linearly between hot and cold AT the midpoint', () => {
      // GIVEN a stamp halfway between the thresholds
      // WHEN coloring
      const fill = LeafColorRule.heatColor(daysAgo(MIDPOINT_DAYS), 'nature', HOT_DAYS, COLD_DAYS, NOW_MS);
      // THEN it is the per-channel average of hot and cold
      expect(d3Color(fill)?.formatHex()).toBe(NATURE_MIDPOINT_HEX);
    });

    it('should return the interpolated color as #rrggbb', () => {
      // GIVEN a stamp between the thresholds
      // WHEN coloring
      const fill = LeafColorRule.heatColor(daysAgo(MIDPOINT_DAYS), 'nature', HOT_DAYS, COLD_DAYS, NOW_MS);
      // THEN it is a 6-digit hex color
      expect(fill).toMatch(HEX_COLOR_RE);
    });

    it('should return the nil color for an undefined stamp', () => {
      // GIVEN no stamp at all
      // WHEN coloring
      const fill = LeafColorRule.heatColor(undefined, 'mono', HOT_DAYS, COLD_DAYS, NOW_MS);
      // THEN it is the nil color
      expect(fill).toBe(GRADIENTS.mono.nil);
    });
  });

  describe('settingsOf', () => {
    it('should take the day thresholds from the slider values', () => {
      // GIVEN a heatmap config
      // WHEN extracting its color settings
      const settings = LeafColorRule.settingsOf(DEFAULT_HEATMAP_CONFIG);
      // THEN the thresholds are the sliders' current values
      expect(settings).toEqual({
        colorMode: DEFAULT_HEATMAP_CONFIG.colorMode,
        gradKey: DEFAULT_HEATMAP_CONFIG.gradKey,
        field: DEFAULT_HEATMAP_CONFIG.field,
        hotDays: DEFAULT_HEATMAP_CONFIG.hotDays.value,
        coldDays: DEFAULT_HEATMAP_CONFIG.coldDays.value,
      });
    });
  });

  describe('hasData', () => {
    it('should be false in heatmap mode WHEN the field stamp is missing', () => {
      // GIVEN a never-visited leaf
      // WHEN asking for visit-time data
      // THEN there is none
      expect(LeafColorRule.hasData(leaf(), 'heatmap', 'lastVisitedAt')).toBe(false);
    });

    it('should be true in type mode WHEN the field stamp is missing', () => {
      // GIVEN a never-visited leaf
      // WHEN asking in type mode
      // THEN there is data
      expect(LeafColorRule.hasData(leaf(), 'type', 'lastVisitedAt')).toBe(true);
    });
  });

  describe('typeColors', () => {
    it('should return the TYPE_C colors for a known type', () => {
      // GIVEN the excalidraw type
      // WHEN resolving its colors
      // THEN its hover is the TYPE_C hover
      expect(LeafColorRule.typeColors('excalidraw').hover).toBe(TYPE_C.excalidraw!.hover);
    });

    it('should return a #rrggbb unknown-type fill', () => {
      // GIVEN no type
      // WHEN resolving colors
      // THEN the fill is a 6-digit hex color (the public API's promised format)
      expect(LeafColorRule.typeColors(undefined).fill).toMatch(HEX_COLOR_RE);
    });

    it('should return the unknown-type colors for no type', () => {
      // GIVEN no type
      // WHEN resolving colors
      // THEN the unknown-type colors come back
      expect(LeafColorRule.typeColors(undefined)).toBe(LeafColorRule.UNKNOWN_TYPE_COLORS);
    });
  });
});
