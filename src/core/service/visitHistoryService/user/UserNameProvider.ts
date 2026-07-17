import { HiddenFileUtil } from '../../../util/file/hidden/HiddenFileUtil';
import { VhUserPaths } from './VhUserPaths';

/**
 * Resolves the stable user name that keys `__visit_history/user/<user-name>/`.
 * MUST stay stable for a device across restarts — a change would split the
 * device's history across two user trees.
 */
export interface UserNameProvider {
  getUserName(): Promise<string>;
}

/** System boundary: OS-level user name; null on mobile (no Node builtins). */
export interface OsUserNameLookup {
  getOsUserName(): string | null;
}

export class OsUserNameLookupDefault implements OsUserNameLookup {
  getOsUserName(): string | null {
    try {
      // System boundary: Node's 'os' module is only available in the desktop
      // (Electron) app. OS user names cannot contain path separators on any
      // supported OS, so the name is safe as a directory name.
      // eslint-disable-next-line import/no-nodejs-modules, @typescript-eslint/no-require-imports, no-undef
      return (require('os') as { userInfo(): { username: string } }).userInfo().username;
    } catch {
      return null;
    }
  }
}

/**
 * Device-scoped persistent cache for the resolved user name.
 * First resolution wins — see UserNameProviderDefault.
 */
export interface UserNameCache {
  get(): string | null;
  set(userName: string): void;
}

export class LocalStorageUserNameCache implements UserNameCache {
  private static readonly STORAGE_KEY = 'obsidian-vh-user-name';

  get(): string | null {
    // WHY raw localStorage (not App#loadLocalStorage): the user name must be
    // DEVICE-scoped so the same device writes to the same VH user dir in
    // every vault; App#loadLocalStorage is vault-scoped. (Same rationale as
    // DeviceNameProviderDefault.)
    // eslint-disable-next-line no-restricted-globals
    return localStorage.getItem(LocalStorageUserNameCache.STORAGE_KEY);
  }

  set(userName: string): void {
    // eslint-disable-next-line no-restricted-globals
    localStorage.setItem(LocalStorageUserNameCache.STORAGE_KEY, userName);
  }
}

/**
 * User name resolution (owner decisions, docs/tickets/1_must-add-user-id.md):
 *
 *   1. Cached name (device-scoped localStorage) — FIRST RESOLUTION WINS, so
 *      the name can never flip later (e.g. when another user's dir syncs in).
 *   2. Desktop → OS account user name.
 *   3. Mobile → the single existing `__visit_history/user/<name>` dir, if
 *      exactly one exists (this device's history joins it).
 *   4. Mobile fallback → `mobile-user-<random>` persisted via the cache.
 *      WHY-NOT a device API: Obsidian mobile exposes no user-identity API to
 *      plugins (no Node 'os', no Capacitor Device access) — the OS lookup in
 *      step 2 IS the best available attempt and returns null there.
 */
export class UserNameProviderDefault implements UserNameProvider {
  constructor(
    private readonly hiddenFileUtil: HiddenFileUtil,
    private readonly osUserNameLookup: OsUserNameLookup = new OsUserNameLookupDefault(),
    private readonly cache: UserNameCache = new LocalStorageUserNameCache(),
  ) {
  }

  async getUserName(): Promise<string> {
    const cached = this.cache.get();
    if (cached) {
      return cached;
    }
    const resolved = await this.resolveUserName();
    this.cache.set(resolved);
    return resolved;
  }

  // ── private ─────────────────────────────────────────────────────────────

  private async resolveUserName(): Promise<string> {
    const osUserName = this.osUserNameLookup.getOsUserName();
    if (osUserName !== null) {
      return osUserName;
    }

    const existingUserNames = await this.hiddenFileUtil.listSubfolderNames(VhUserPaths.USERS_DIR);
    const [singleExisting] = existingUserNames;
    if (existingUserNames.length === 1 && singleExisting !== undefined) {
      return singleExisting;
    }

    return 'mobile-user-' + crypto.randomUUID().slice(0, 8);
  }
}
