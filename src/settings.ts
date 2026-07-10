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

export const DEFAULT_SETTINGS: VisitHistoryPluginSettings = {
  idleTimeoutSeconds: DEFAULT_IDLE_TIMEOUT_SECONDS,
};
