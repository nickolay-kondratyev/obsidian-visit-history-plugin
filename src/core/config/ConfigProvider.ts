import { DevConfigOverrides } from './DevConfigOverridesReader';

/**
 * Single seam for EFFECTIVE runtime config values. The rest of the plugin
 * depends only on this interface — it never learns that dev overrides exist,
 * nor whether a value came from settings or an override.
 */
export interface ConfigProvider {
  /**
   * The idle timeout in milliseconds to use RIGHT NOW. Read live at each idle
   * decision so a settings-tab change applies without a plugin reload.
   */
  getIdleTimeoutMs(): number;
}

/**
 * The narrow slice of the plugin the provider needs — kept structural so tests
 * don't fake the whole Plugin. `VisitHistoryPlugin` satisfies it.
 */
export interface ConfigSettingsHost {
  readonly settings: { readonly idleTimeoutSeconds: number };
}

/**
 * Resolves effective config, letting a DEV override win over the persisted
 * setting. Crucially the override is NOT re-clamped to the settings floor
 * (min 5 s) — bypassing that hard limit for e2e is the whole point. With no
 * override present (the normal case) behavior is identical to reading the
 * sanitized setting directly.
 */
export class ConfigProviderDefault implements ConfigProvider {
  constructor(
    private readonly host: ConfigSettingsHost,
    private readonly overrides: DevConfigOverrides,
  ) {}

  getIdleTimeoutMs(): number {
    const override = this.overrides.idleTimeoutSeconds;
    // A present, sane override wins; a zero/negative/NaN override is ignored so
    // a malformed dev file can never arm an instant-fire idle timer.
    if (override !== undefined && Number.isFinite(override) && override > 0) {
      return override * 1000;
    }
    return this.host.settings.idleTimeoutSeconds * 1000;
  }
}
