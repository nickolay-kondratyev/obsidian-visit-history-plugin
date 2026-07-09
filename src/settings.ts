// Placeholder settings — no user-facing settings exist yet. The plumbing
// (load/save in main.ts) is kept so future settings only need a field here.
export interface VisitHistoryPluginSettings {
  mySetting: string;
}

export const DEFAULT_SETTINGS: VisitHistoryPluginSettings = {
  mySetting: 'default',
};
