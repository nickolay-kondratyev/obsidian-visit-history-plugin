// Placeholder settings — no PERSISTED settings exist yet. The plumbing
// (load/save in main.ts) is kept so future settings only need a field here.
// The settings tab (src/settingsTab/) currently exposes one-off actions only.
export interface VisitHistoryPluginSettings {
  mySetting: string;
}

export const DEFAULT_SETTINGS: VisitHistoryPluginSettings = {
  mySetting: 'default',
};
