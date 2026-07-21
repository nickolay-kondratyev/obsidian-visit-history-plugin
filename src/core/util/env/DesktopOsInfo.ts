import { DesktopNodeModule } from './DesktopNodeModule';

/** Minimal typed view of Node's `os` module (desktop / Electron only). */
interface DesktopOsModule {
  hostname(): string;
  userInfo(): { username: string };
}

/**
 * Shared, mobile-safe accessor for the desktop-only Node `os` module.
 *
 * WHY centralized: `DeviceNameProvider` (hostname) and `UserNameProvider` (OS
 * login name) both need the IDENTICAL mobile-safe read of Node's `os`. Reaching
 * the builtin itself goes through `DesktopNodeModule` (the shared Platform-guard
 * + typed-require rule); every reader returns null on mobile so callers fall back.
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
    const os = DesktopNodeModule.require<DesktopOsModule>('os');
    if (os === null) {
      return null;
    }
    try {
      // The require succeeded but a member call could still fail — backstop to
      // null so callers fall back rather than throw.
      return reader(os);
    } catch {
      return null;
    }
  }
}
