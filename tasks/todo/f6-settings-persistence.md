# F6: Persist Treemap Config via Plugin Settings

> **Priority:** Low (nice-to-have)
> **Effort:** Medium (~1 hr)
> **Depends on:** Phase 8 (plugin wiring done)

## Problem

Treemap config (color mode, gradient, field, thresholds, scale factors) resets to defaults every time the view is opened. The user must reconfigure each session.

## Solution

### Step 1: Add treemap settings to `VisitHistoryPluginSettings`

```typescript
export interface VisitHistoryPluginSettings {
  mySetting: string;
  // NEW:
  treemap: {
    colorMode: 'type' | 'heatmap';
    gradKey: string;
    field: string;
    hotDays: number;
    coldDays: number;
    scales: Record<string, number>;
  };
}

export const DEFAULT_SETTINGS: VisitHistoryPluginSettings = {
  mySetting: 'default',
  treemap: {
    colorMode: 'heatmap',
    gradKey: 'nature',
    field: 'lastModifiedAt',
    hotDays: 7,
    coldDays: 180,
    scales: { md: 1.0, canvas: 0.3, excalidraw: 0.2 },
  },
};
```

### Step 2: Pass settings to App as initial values

```typescript
// In VaultTreemapView.refresh():
this.root?.render(
  <TreemapApp
    data={data}
    initialConfig={this.plugin.settings.treemap}
    onConfigChange={(config) => {
      this.plugin.settings.treemap = config;
      this.plugin.saveSettings();
    }}
  />
);
```

### Step 3: Update App to use initialConfig and notify on changes

App receives optional `initialConfig` and `onConfigChange` props. Use `initialConfig` as the initial state values. Call `onConfigChange` (debounced) when config changes.

### Step 4: Add settings UI tab (optional)

Add a treemap section to the existing `SampleSettingTab` for configuring defaults.

## Deferrable

Scale factors per file type could also be persisted. The full config object above covers all state currently in App.
