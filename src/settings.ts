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

// Persisted via loadData()/saveData() in main.ts; edited in
// src/settingsTab/VisitHistorySettingTab.ts.
export interface VisitHistoryPluginSettings {
  idleTimeoutSeconds: number;
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
    };
  }

  private static sanitizeIdleTimeoutSeconds(value: unknown): number {
    const isValid = typeof value === 'number'
      && Number.isInteger(value)
      && value >= MIN_IDLE_TIMEOUT_SECONDS;
    return isValid ? value : DEFAULT_IDLE_TIMEOUT_SECONDS;
  }
}
