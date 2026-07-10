import { describe, expect, it } from 'vitest';
import { DEFAULT_HEATMAP_CONFIG, HeatmapConfigSanitizer } from './heatmapConfig';

describe('HeatmapConfigSanitizer', () => {
  describe('sanitize', () => {
    it('should return the full defaults when nothing was persisted yet', () => {
      // GIVEN a fresh install (no heatmap key in data.json)
      // WHEN sanitizing
      const config = HeatmapConfigSanitizer.sanitize(undefined);
      // THEN the defaults apply
      expect(config).toEqual(DEFAULT_HEATMAP_CONFIG);
    });

    it('should keep a fully valid persisted config as-is', () => {
      // GIVEN a valid persisted config
      const persisted = {
        colorMode: 'type',
        gradKey: 'ember',
        field: 'lastVisitedAt',
        hotDays: { value: 14, min: 1, max: 100 },
        coldDays: { value: 90, min: 2, max: 400 },
        scales: {
          md: { value: 0.8, min: 0.1, max: 3 },
          canvas: { value: 0.5, min: 0.05, max: 2 },
          excalidraw: { value: 0.2, min: 0.05, max: 2 },
        },
      };
      // WHEN sanitizing
      const config = HeatmapConfigSanitizer.sanitize(persisted);
      // THEN it is kept unchanged
      expect(config).toEqual(persisted);
    });

    it('should fall back to the default color mode for an unknown value', () => {
      // GIVEN a hand-edited unknown color mode
      const config = HeatmapConfigSanitizer.sanitize({ colorMode: 'rainbow' });
      // THEN the default applies
      expect(config.colorMode).toBe(DEFAULT_HEATMAP_CONFIG.colorMode);
    });

    it('should fall back to the default gradient for an unknown key', () => {
      const config = HeatmapConfigSanitizer.sanitize({ gradKey: 'neon' });
      expect(config.gradKey).toBe(DEFAULT_HEATMAP_CONFIG.gradKey);
    });

    it('should fall back to the default field for an unknown field', () => {
      const config = HeatmapConfigSanitizer.sanitize({ field: 'deletedAt' });
      expect(config.field).toBe(DEFAULT_HEATMAP_CONFIG.field);
    });

    it('should fall back to default bounds when max <= min', () => {
      // GIVEN inverted slider bounds
      const config = HeatmapConfigSanitizer.sanitize({
        hotDays: { value: 7, min: 100, max: 10 },
      });
      // THEN the default bounds apply
      expect(config.hotDays).toEqual(DEFAULT_HEATMAP_CONFIG.hotDays);
    });

    it('should fall back to the default min when below the hard floor', () => {
      // GIVEN a scale min of 0 — cell areas would collapse to zero
      const config = HeatmapConfigSanitizer.sanitize({
        scales: { md: { value: 1, min: 0, max: 2 } },
      });
      // THEN the default min applies
      expect(config.scales['md']?.min).toBe(DEFAULT_HEATMAP_CONFIG.scales['md']?.min);
    });

    it('should clamp a value that is outside its own bounds', () => {
      // GIVEN a value above max
      const config = HeatmapConfigSanitizer.sanitize({
        hotDays: { value: 500, min: 1, max: 100 },
      });
      // THEN it is clamped to max instead of discarded
      expect(config.hotDays.value).toBe(100);
    });

    it('should fall back to the default value for a non-numeric slider value', () => {
      const config = HeatmapConfigSanitizer.sanitize({
        coldDays: { value: 'abc', min: 2, max: 730 },
      });
      expect(config.coldDays.value).toBe(DEFAULT_HEATMAP_CONFIG.coldDays.value);
    });

    it('should reset BOTH day thresholds when hot >= cold (gradient range collapses)', () => {
      // GIVEN hot at 200 and cold at 100
      const config = HeatmapConfigSanitizer.sanitize({
        hotDays: { value: 200, min: 1, max: 365 },
        coldDays: { value: 100, min: 2, max: 730 },
      });
      // THEN both are reset to defaults
      expect({ hot: config.hotDays, cold: config.coldDays }).toEqual({
        hot: DEFAULT_HEATMAP_CONFIG.hotDays,
        cold: DEFAULT_HEATMAP_CONFIG.coldDays,
      });
    });

    it('should fill in a missing scale entry with its default', () => {
      // GIVEN persisted scales missing the excalidraw key
      const config = HeatmapConfigSanitizer.sanitize({
        scales: { md: { value: 0.5, min: 0.05, max: 2 } },
      });
      // THEN the missing entry gets its default
      expect(config.scales['excalidraw']).toEqual(DEFAULT_HEATMAP_CONFIG.scales['excalidraw']);
    });

    it('should drop unknown extra scale keys', () => {
      // GIVEN a hand-added scale for an unsupported type
      const config = HeatmapConfigSanitizer.sanitize({
        scales: { pdf: { value: 1, min: 0.05, max: 2 } },
      });
      // THEN only the known types survive
      expect(Object.keys(config.scales).sort()).toEqual(
        Object.keys(DEFAULT_HEATMAP_CONFIG.scales).sort(),
      );
    });
  });
});
