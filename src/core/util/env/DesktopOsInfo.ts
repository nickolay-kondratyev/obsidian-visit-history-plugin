import { Platform } from 'obsidian';

/** Minimal typed view of Node's `os` module (desktop / Electron only). */
interface DesktopOsModule {
  hostname(): string;
  userInfo(): { username: string };
}

/**
 * Shared, mobile-safe accessor for the desktop-only Node `os` module.
 *
 * WHY centralized: `DeviceNameProvider` (hostname) and `UserNameProvider` (OS
 * login name) both need the IDENTICAL `Platform`-guarded, try/catch-wrapped,
 * TYPED require of Node's `os`. Every reader returns null on mobile (no Node
 * builtins) so callers fall back.
 */
export class DesktopOsInfo {
  private constructor() {}

  /** OS hostname, or null on mobile / when unavailable. */
  static hostname(): string | null {
    return DesktopOsInfo.read((os) => os.hostname());
  }

  /** OS login user name, or null on mobile / when unavailable. */
  static userName(): string | null {
    return DesktopOsInfo.read((os) => os.userInfo().username);
  }

  private static read<T>(reader: (os: DesktopOsModule) => T): T | null {
    // Node's `os` is available only in the desktop Electron app, never on
    // mobile. `isDesktop` rules out the mobile app (Node APIs are absent there —
    // and the obsidianmd guideline wants exactly this check); `isDesktopApp` is
    // the precise Electron guard Node availability actually depends on. Both
    // hold on desktop — keeping both documents intent. The try/catch is the
    // final backstop if the require still fails.
    if (!Platform.isDesktop) {
      return null;
    }
    if (!Platform.isDesktopApp) {
      return null;
    }
    try {
      // System boundary: 'os' is a desktop-only Node/Electron builtin. Assigned
      // to a TYPED const so the member calls are type-checked (no no-unsafe-*).
      // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- desktop-only Electron builtin; guarded above + try/catch for mobile
      const os = require("os") as DesktopOsModule;
      return reader(os);
    } catch {
      return null;
    }
  }
}
