import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { HeatmapSettingsHost, PluginHeatmapConfigStore } from './HeatmapConfigStore';
import { DEFAULT_HEATMAP_CONFIG, HeatmapConfig } from './heatmapConfig';

describe('PluginHeatmapConfigStore', () => {
  let host: HeatmapSettingsHost;
  let saveSettings: Mock<() => Promise<void>>;
  let unloadCallbacks: Array<() => void>;

  function makeConfig(hotValue: number): HeatmapConfig {
    return {
      ...DEFAULT_HEATMAP_CONFIG,
      hotDays: { ...DEFAULT_HEATMAP_CONFIG.hotDays, value: hotValue },
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    // The store schedules via window.* (obsidianmd lint rule); the node test
    // env has no window — point it at the (fake-timer-mocked) globals.
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    saveSettings = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    unloadCallbacks = [];
    host = {
      settings: { heatmap: DEFAULT_HEATMAP_CONFIG },
      saveSettings,
      register: cb => unloadCallbacks.push(cb),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('load', () => {
    it('should return the config held in the plugin settings', () => {
      // GIVEN a store over the plugin settings
      const store = new PluginHeatmapConfigStore(host);
      // WHEN loading
      // THEN the settings' heatmap config is returned
      expect(store.load()).toBe(DEFAULT_HEATMAP_CONFIG);
    });
  });

  describe('save', () => {
    it('should NOT write immediately (debounced)', () => {
      // GIVEN a store
      const store = new PluginHeatmapConfigStore(host);
      // WHEN saving
      store.save(makeConfig(30));
      // THEN nothing is persisted yet
      expect(saveSettings).not.toHaveBeenCalled();
    });

    it('should persist the config after the debounce window', () => {
      // GIVEN a saved config
      const store = new PluginHeatmapConfigStore(host);
      store.save(makeConfig(30));
      // WHEN the debounce window elapses
      vi.runAllTimers();
      // THEN the settings hold the new config and were saved once
      expect(host.settings.heatmap.hotDays.value).toBe(30);
      expect(saveSettings).toHaveBeenCalledTimes(1);
    });

    it('should coalesce rapid saves into one write of the LAST config', () => {
      // GIVEN a burst of saves (slider drag)
      const store = new PluginHeatmapConfigStore(host);
      store.save(makeConfig(10));
      store.save(makeConfig(20));
      store.save(makeConfig(30));
      // WHEN the debounce window elapses
      vi.runAllTimers();
      // THEN only the last config was written, once
      expect(host.settings.heatmap.hotDays.value).toBe(30);
      expect(saveSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('unload flush', () => {
    it('should flush a pending save on plugin unload', () => {
      // GIVEN a save still inside its debounce window
      const store = new PluginHeatmapConfigStore(host);
      store.save(makeConfig(42));
      // WHEN the plugin unloads
      unloadCallbacks.forEach(cb => cb());
      // THEN the pending config was persisted
      expect(host.settings.heatmap.hotDays.value).toBe(42);
    });

    it('should not write on unload when nothing is pending', () => {
      // GIVEN a store with no pending save
      new PluginHeatmapConfigStore(host);
      // WHEN the plugin unloads
      unloadCallbacks.forEach(cb => cb());
      // THEN nothing was persisted
      expect(saveSettings).not.toHaveBeenCalled();
    });
  });
});
