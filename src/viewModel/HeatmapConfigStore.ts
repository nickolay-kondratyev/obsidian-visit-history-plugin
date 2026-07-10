import { HeatmapConfig } from './heatmapConfig';

/**
 * Load/save boundary for the heatmap view's config panel state.
 *
 * The React components depend on this interface — never on the plugin
 * directly. Wired in PluginFactory, handed to App by VaultTreemapView.
 */
export interface HeatmapConfigStore {
  /** The config to start the view with (sanitized at plugin load). */
  load(): HeatmapConfig;
  /** Persist a config change. May write asynchronously (fire-and-forget). */
  save(config: HeatmapConfig): void;
}

/**
 * The slice of the plugin the store needs — narrow so tests don't have to
 * fake the whole Plugin. VisitHistoryPlugin satisfies it structurally.
 */
export interface HeatmapSettingsHost {
  settings: { heatmap: HeatmapConfig };
  saveSettings(): Promise<void>;
  /** Plugin/Component.register — callback runs on plugin unload. */
  register(onUnload: () => void): void;
}

/**
 * Persists heatmap config into the plugin's settings (data.json).
 *
 * Saves are DEBOUNCED: slider drags fire a change per pixel, and each
 * saveData() rewrites data.json. Pending changes are flushed on plugin
 * unload; a hard app quit inside the debounce window can lose the last
 * change (same accepted limitation as the V3 unload flush).
 */
export class PluginHeatmapConfigStore implements HeatmapConfigStore {
  private static readonly SAVE_DEBOUNCE_MS = 500;

  private saveTimer: number | null = null;
  private pending: HeatmapConfig | null = null;

  constructor(private readonly plugin: HeatmapSettingsHost) {
    plugin.register(() => this.flush());
  }

  load(): HeatmapConfig {
    return this.plugin.settings.heatmap;
  }

  save(config: HeatmapConfig): void {
    this.pending = config;
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(
      () => this.flush(),
      PluginHeatmapConfigStore.SAVE_DEBOUNCE_MS,
    );
  }

  private flush(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.pending === null) return;
    this.plugin.settings.heatmap = this.pending;
    this.pending = null;
    void this.plugin.saveSettings();
  }
}
