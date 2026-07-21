import { DesktopOsInfo } from './DesktopOsInfo';

export interface DeviceNameProvider {
  getDeviceName(): string;
}

/**
 * Resolves a stable per-device name. Desktop → OS hostname; mobile → random
 * id persisted on first use. The name keys the per-device VH directories
 * (`__visit_history/user/<user>/v3/focus_duration_per_device/<device>/`), so it MUST stay
 * stable for a device across restarts and vaults.
 */
export class DeviceNameProviderDefault implements DeviceNameProvider {
  private static readonly STORAGE_KEY = "obsidian-device-name";

  getDeviceName(): string {
    // WHY raw localStorage (not App#loadLocalStorage): the device name must be
    // DEVICE-scoped so the same machine writes to the same VH directory in
    // every vault; App#loadLocalStorage is vault-scoped.
    const cached = window.localStorage.getItem(DeviceNameProviderDefault.STORAGE_KEY);
    if (cached) return cached;

    // Existing users' VH directories are named after the hostname — do not
    // change this resolution (desktop hostname → device name; mobile → random).
    const name = DesktopOsInfo.hostname()
      ?? "mobile-" + crypto.randomUUID().slice(0, 8);

    window.localStorage.setItem(DeviceNameProviderDefault.STORAGE_KEY, name);
    return name;
  }
}
