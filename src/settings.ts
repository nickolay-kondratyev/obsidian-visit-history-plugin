import { HeatmapConfig, HeatmapConfigSanitizer } from './viewModel/heatmapConfig';

/**
 * Seconds without any user interaction before the focused document's V3
 * duration session is auto-closed (the recorded duration then ends at the
 * last interaction). 3 minutes by default.
 */
export const DEFAULT_IDLE_TIMEOUT_SECONDS = 180;

/**
 * Floor for the idle timeout. Guards the duration state machine: a timeout
 * of ~0 would close every session instantly at its last interaction.
 */
export const MIN_IDLE_TIMEOUT_SECONDS = 5;

/**
 * Single source of truth for the idle-timeout validity rule. Consumed by BOTH
 * the load boundary (SettingsSanitizer) and the settings tab (declarative
 * validate + the pre-1.13 text-field reject) so the rule can never drift.
 */
export class IdleTimeoutSeconds {
  /** Whether a candidate idle-timeout is a whole number at or above the minimum. */
  static isValid(seconds: number): boolean {
    return Number.isInteger(seconds) && seconds >= MIN_IDLE_TIMEOUT_SECONDS;
  }
}

/**
 * A focus session shorter than this many seconds records NO trace at all —
 * no `.vh_v3` line AND no heatmap last-visit bump — so quick in-and-out jumps
 * into a note are not counted as visits. 2 seconds by default; 0 disables the
 * filter (record everything, including zero-duration pass-through navigation).
 */
export const DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD = 2;

/**
 * Single source of truth for the min-focus validity rule. Consumed by BOTH the
 * load boundary (SettingsSanitizer) and the settings tab (declarative validate
 * + the pre-1.13 text-field reject) so the rule can never drift. 0 is valid and
 * means "disabled" — unlike the idle timeout there is no state-machine floor.
 */
export class MinFocusSecondsToRecord {
  /** Whether a candidate minimum is a whole number of seconds at or above zero. */
  static isValid(seconds: number): boolean {
    return Number.isInteger(seconds) && seconds >= 0;
  }
}

// Persisted via loadData()/saveData() in main.ts; edited in
// src/settingsTab/VisitHistorySettingTab.ts (idle timeout, min focus time) and
// the heatmap view's config panel (heatmap — persisted through
// HeatmapConfigStore).
export interface VisitHistoryPluginSettings {
  idleTimeoutSeconds: number;
  minFocusSecondsToRecord: number;
  heatmap: HeatmapConfig;
}

/**
 * Boundary validation for loadData(): data.json is user-editable, and the
 * settings tab is not the only writer of it. A corrupt idleTimeoutSeconds
 * would degrade the V3 idle timer (NaN arms setTimeout(NaN) → an
 * immediate-fire loop; 0/negative instantly closes every session as D:0).
 * Invalid values fall back to the default.
 */
export class SettingsSanitizer {
  static sanitize(loadedData: unknown): VisitHistoryPluginSettings {
    const raw = (loadedData ?? {}) as Partial<Record<keyof VisitHistoryPluginSettings, unknown>>;
    return {
      idleTimeoutSeconds: SettingsSanitizer.sanitizeIdleTimeoutSeconds(raw.idleTimeoutSeconds),
      minFocusSecondsToRecord: SettingsSanitizer.sanitizeMinFocusSecondsToRecord(raw.minFocusSecondsToRecord),
      heatmap: HeatmapConfigSanitizer.sanitize(raw.heatmap),
    };
  }

  private static sanitizeIdleTimeoutSeconds(value: unknown): number {
    return typeof value === 'number' && IdleTimeoutSeconds.isValid(value)
      ? value
      : DEFAULT_IDLE_TIMEOUT_SECONDS;
  }

  private static sanitizeMinFocusSecondsToRecord(value: unknown): number {
    return typeof value === 'number' && MinFocusSecondsToRecord.isValid(value)
      ? value
      : DEFAULT_MIN_FOCUS_SECONDS_TO_RECORD;
  }
}
