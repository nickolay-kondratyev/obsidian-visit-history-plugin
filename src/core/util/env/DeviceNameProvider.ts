export interface DeviceNameProvider {
  getDeviceName(): string;
}

export class DeviceNameProviderDefault implements DeviceNameProvider {
  getDeviceName(): string {
    const key = "obsidian-device-name";
    const cached = localStorage.getItem(key);
    if (cached) return cached;

    let name: string;
    try {
      name = require("os").hostname();
    } catch {
      name = "mobile-" + crypto.randomUUID().slice(0, 8);
    }

    localStorage.setItem(key, name);
    return name;
  }
}