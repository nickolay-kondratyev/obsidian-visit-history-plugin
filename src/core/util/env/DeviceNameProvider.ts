export interface DeviceNameProvider {
  getDeviceName(): string;
}

/**
 * Resolves a stable per-device name. Desktop → OS hostname; mobile → random
 * id persisted on first use. The name keys the per-device VH directories
 * (`.visit_history/user/<user>/v3/focus_duration_per_device/<device>/`), so it MUST stay
 * stable for a device across restarts and vaults.
 */
export class DeviceNameProviderDefault implements DeviceNameProvider {
  private static readonly STORAGE_KEY = "obsidian-device-name";

  getDeviceName(): string {
    // WHY raw localStorage (not App#loadLocalStorage): the device name must be
    // DEVICE-scoped so the same machine writes to the same VH directory in
    // every vault; App#loadLocalStorage is vault-scoped.
    // eslint-disable-next-line no-restricted-globals
    const cached = localStorage.getItem(DeviceNameProviderDefault.STORAGE_KEY);
    if (cached) return cached;

    const name = DeviceNameProviderDefault.desktopHostname()
      ?? "mobile-" + crypto.randomUUID().slice(0, 8);

    // eslint-disable-next-line no-restricted-globals
    localStorage.setItem(DeviceNameProviderDefault.STORAGE_KEY, name);
    return name;
  }

  /** OS hostname, or null on mobile where Node builtins don't exist. */
  private static desktopHostname(): string | null {
    try {
      // System boundary: Node's 'os' module is only available in the desktop
      // (Electron) app. Existing users' VH directories are named after the
      // hostname — do not change this resolution order.
      // eslint-disable-next-line import/no-nodejs-modules, @typescript-eslint/no-require-imports, no-undef
      return (require("os") as { hostname(): string }).hostname();
    } catch {
      return null;
    }
  }
}
