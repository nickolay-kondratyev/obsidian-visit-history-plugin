import { describe, expect, it } from 'vitest';
import { ConfigProviderDefault, ConfigSettingsHost } from './ConfigProvider';
import { DevConfigOverrides } from './DevConfigOverridesReader';

function makeHost(idleTimeoutSeconds: number): ConfigSettingsHost & { settings: { idleTimeoutSeconds: number } } {
  return { settings: { idleTimeoutSeconds } };
}

describe(ConfigProviderDefault.name, () => {
  describe('getIdleTimeoutMs', () => {
    it('should return the setting in ms when no override is present', () => {
      const provider = new ConfigProviderDefault(makeHost(180), {});
      expect(provider.getIdleTimeoutMs()).toBe(180_000);
    });

    it('should return the override in ms when present', () => {
      const overrides: DevConfigOverrides = { idleTimeoutSeconds: 30 };
      const provider = new ConfigProviderDefault(makeHost(180), overrides);
      expect(provider.getIdleTimeoutMs()).toBe(30_000);
    });

    // The whole point: an override BELOW the settings floor (min 5 s) is honored,
    // never re-clamped — that is how e2e drives a fast idle close.
    it('should honor a sub-floor override without re-clamping to the 5 s floor', () => {
      const provider = new ConfigProviderDefault(makeHost(180), { idleTimeoutSeconds: 1 });
      expect(provider.getIdleTimeoutMs()).toBe(1_000);
    });

    it('should fall back to the setting when the override is zero', () => {
      const provider = new ConfigProviderDefault(makeHost(180), { idleTimeoutSeconds: 0 });
      expect(provider.getIdleTimeoutMs()).toBe(180_000);
    });

    it('should fall back to the setting when the override is negative', () => {
      const provider = new ConfigProviderDefault(makeHost(180), { idleTimeoutSeconds: -5 });
      expect(provider.getIdleTimeoutMs()).toBe(180_000);
    });

    it('should fall back to the setting when the override is NaN', () => {
      const provider = new ConfigProviderDefault(makeHost(180), { idleTimeoutSeconds: Number.NaN });
      expect(provider.getIdleTimeoutMs()).toBe(180_000);
    });

    // Live-read: the same provider reflects a later settings change (settings-tab
    // edits apply without a plugin reload).
    it('should reflect a live settings change when no override is present', () => {
      const host = makeHost(180);
      const provider = new ConfigProviderDefault(host, {});
      host.settings.idleTimeoutSeconds = 10;
      expect(provider.getIdleTimeoutMs()).toBe(10_000);
    });
  });
});
