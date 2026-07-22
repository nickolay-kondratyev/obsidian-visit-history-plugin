import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IDLE_TIMEOUT_SECONDS,
  DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD,
  IdleTimeoutSeconds,
  MIN_IDLE_TIMEOUT_SECONDS,
  MinFocusSecondsToRecord,
  SettingsSanitizer,
} from './settings';
import { DEFAULT_HEATMAP_CONFIG } from './viewModel/heatmapConfig';

describe('IdleTimeoutSeconds', () => {
  describe('isValid', () => {
    it('should reject a value below the minimum', () => {
      // GIVEN a value one below the minimum
      // WHEN validating
      // THEN it is rejected
      expect(IdleTimeoutSeconds.isValid(MIN_IDLE_TIMEOUT_SECONDS - 1)).toBe(false);
    });

    it('should reject a non-integer value', () => {
      // GIVEN a fractional value above the minimum
      // WHEN validating
      // THEN it is rejected (only whole seconds are accepted)
      expect(IdleTimeoutSeconds.isValid(MIN_IDLE_TIMEOUT_SECONDS + 0.5)).toBe(false);
    });

    it('should accept the minimum integer', () => {
      // GIVEN exactly the minimum
      // WHEN validating
      // THEN it is accepted
      expect(IdleTimeoutSeconds.isValid(MIN_IDLE_TIMEOUT_SECONDS)).toBe(true);
    });
  });
});

describe('MinFocusSecondsToRecord', () => {
  describe('isValid', () => {
    it('should accept zero (the filter is disabled)', () => {
      // GIVEN zero — the documented "record everything" value
      // WHEN validating
      // THEN it is accepted (0 is a legitimate minimum here)
      expect(MinFocusSecondsToRecord.isValid(0)).toBe(true);
    });

    it('should reject a negative value', () => {
      // GIVEN a negative number
      // WHEN validating
      // THEN it is rejected
      expect(MinFocusSecondsToRecord.isValid(-1)).toBe(false);
    });

    it('should reject a non-integer value', () => {
      // GIVEN a fractional value
      // WHEN validating
      // THEN it is rejected (only whole seconds are accepted)
      expect(MinFocusSecondsToRecord.isValid(2.5)).toBe(false);
    });

    it('should accept a positive whole number', () => {
      // GIVEN a whole positive number
      // WHEN validating
      // THEN it is accepted
      expect(MinFocusSecondsToRecord.isValid(3)).toBe(true);
    });
  });
});

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

    it('should default the min focus time when nothing was persisted yet (loadData returns null)', () => {
      // GIVEN a fresh install
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize(null);
      // THEN the default min focus time applies
      expect(settings.minFocusSecondsToRecord).toBe(DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD);
    });

    it('should keep a valid persisted min focus time', () => {
      // GIVEN a valid persisted value
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ minFocusSecondsToRecord: 5 });
      // THEN it is kept as-is
      expect(settings.minFocusSecondsToRecord).toBe(5);
    });

    it('should keep a persisted min focus time of zero (filter disabled)', () => {
      // GIVEN zero — a legitimate "record everything" value, must NOT fall back
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ minFocusSecondsToRecord: 0 });
      // THEN it is kept as zero
      expect(settings.minFocusSecondsToRecord).toBe(0);
    });

    it('should fall back to the default min focus time for a NON-NUMERIC value', () => {
      // GIVEN a corrupt string value (hand-edited data.json)
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ minFocusSecondsToRecord: 'abc' });
      // THEN the default applies
      expect(settings.minFocusSecondsToRecord).toBe(DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD);
    });

    it('should fall back to the default min focus time for NaN', () => {
      // GIVEN NaN
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ minFocusSecondsToRecord: Number.NaN });
      // THEN the default applies
      expect(settings.minFocusSecondsToRecord).toBe(DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD);
    });

    it('should fall back to the default min focus time for a negative value', () => {
      // GIVEN a negative number
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ minFocusSecondsToRecord: -1 });
      // THEN the default applies
      expect(settings.minFocusSecondsToRecord).toBe(DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD);
    });

    it('should fall back to the default min focus time for a non-integer value', () => {
      // GIVEN a fractional value
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ minFocusSecondsToRecord: 1.5 });
      // THEN the default applies
      expect(settings.minFocusSecondsToRecord).toBe(DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD);
    });

    it('should fall back to the default min focus time when the key is missing (older data.json)', () => {
      // GIVEN persisted data without the key
      // WHEN sanitizing
      const settings = SettingsSanitizer.sanitize({ idleTimeoutSeconds: 600 });
      // THEN the default applies
      expect(settings.minFocusSecondsToRecord).toBe(DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD);
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
