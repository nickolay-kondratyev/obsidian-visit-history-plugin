import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IDLE_TIMEOUT_SECONDS,
  MIN_IDLE_TIMEOUT_SECONDS,
  SettingsSanitizer,
} from './settings';
import { DEFAULT_HEATMAP_CONFIG } from './viewModel/heatmapConfig';

describe('SettingsSanitizer', () => {
  describe('sanitize', () => {
    it('should return defaults when nothing was persisted yet (loadData returns null)', () => {
      // GIVEN a fresh install
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize(null);
      // THEN the default idle timeout applies
      expect(settings.idleTimeoutSeconds).toBe(DEFAULT_IDLE_TIMEOUT_SECONDS);
    });

    it('should keep a valid persisted idle timeout', () => {
      // GIVEN a valid persisted value
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ idleTimeoutSeconds: 600 });
      // THEN it is kept as-is
      expect(settings.idleTimeoutSeconds).toBe(600);
    });

    it('should keep the minimum idle timeout (boundary)', () => {
      // GIVEN the exact minimum
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ idleTimeoutSeconds: MIN_IDLE_TIMEOUT_SECONDS });
      // THEN it is kept
      expect(settings.idleTimeoutSeconds).toBe(MIN_IDLE_TIMEOUT_SECONDS);
    });

    it('should fall back to the default for a NON-NUMERIC idle timeout (hand-edited data.json)', () => {
      // GIVEN a corrupt string value — NaN here would arm the idle timer with
      // NaN and spin it in an immediate-fire loop
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ idleTimeoutSeconds: 'abc' });
      // THEN the default applies
      expect(settings.idleTimeoutSeconds).toBe(DEFAULT_IDLE_TIMEOUT_SECONDS);
    });

    it('should fall back to the default for an idle timeout below the minimum', () => {
      // GIVEN a zero timeout — every session would instantly close as D:0
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ idleTimeoutSeconds: 0 });
      // THEN the default applies
      expect(settings.idleTimeoutSeconds).toBe(DEFAULT_IDLE_TIMEOUT_SECONDS);
    });

    it('should fall back to the default for a non-integer idle timeout', () => {
      // GIVEN a fractional value
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ idleTimeoutSeconds: 7.5 });
      // THEN the default applies
      expect(settings.idleTimeoutSeconds).toBe(DEFAULT_IDLE_TIMEOUT_SECONDS);
    });

    it('should fall back to the default when the key is missing (older data.json)', () => {
      // GIVEN persisted data without the key
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({});
      // THEN the default applies
      expect(settings.idleTimeoutSeconds).toBe(DEFAULT_IDLE_TIMEOUT_SECONDS);
    });

    it('should apply the default heatmap config when missing (pre-heatmap data.json)', () => {
      // GIVEN persisted data from before heatmap settings existed
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ idleTimeoutSeconds: 600 });
      // THEN the heatmap defaults apply
      expect(settings.heatmap).toEqual(DEFAULT_HEATMAP_CONFIG);
    });

    it('should keep a valid persisted heatmap gradient (heatmap delegation wired)', () => {
      // GIVEN a persisted heatmap section — deep validation is covered by
      // HeatmapConfigSanitizer's own tests; this asserts the delegation only
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ heatmap: { gradKey: 'ember' } });
      // THEN the value survives
      expect(settings.heatmap.gradKey).toBe('ember');
    });
  });
});
