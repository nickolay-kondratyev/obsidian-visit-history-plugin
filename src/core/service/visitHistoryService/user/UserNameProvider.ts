import { DesktopOsInfo } from '../../../util/env/DesktopOsInfo';
import { HiddenFileUtil } from '../../../util/file/hidden/HiddenFileUtil';
import { UserNamePrompt } from './UserNamePrompt';
import { UserNameSafety } from './UserNameSafety';
import { VhUserPaths } from './VhUserPaths';

/**
 * Resolves the stable user name that keys `__visit_history/user/<user-name>/`.
 * MUST stay stable for a device across restarts — a change would split the
 * device's history across two user trees.
 */
export interface UserNameProvider {
  /**
   * The pinned (or newly confirmed) user name, or null when the human
   * dismissed the prompt — nothing is pinned then and the caller must not
   * record any visit history this session (re-prompted on next start).
   */
  getUserName(): Promise<string | null>;
}

/** System boundary: OS-level user name; null on mobile (no Node builtins). */
export interface OsUserNameLookup {
  getOsUserName(): string | null;
}

export class OsUserNameLookupDefault implements OsUserNameLookup {
  getOsUserName(): string | null {
    // OS user names cannot contain path separators on any supported OS, so the
    // name is safe as a directory segment. Desktop → OS login name; mobile → null.
    return DesktopOsInfo.userName();
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
    return window.localStorage.getItem(LocalStorageUserNameCache.STORAGE_KEY);
  }

  set(userName: string): void {
    window.localStorage.setItem(LocalStorageUserNameCache.STORAGE_KEY, userName);
  }
}

/**
 * User name resolution (owner decisions, 2026-07 confirmation-modal flow):
 *
 *   1. Cached name (device-scoped localStorage) — FIRST PIN WINS, so the
 *      name can never flip later (e.g. when another user's dir syncs in).
 *      An already-pinned device never sees the prompt.
 *   2. Otherwise ASK via UserNamePrompt: pick an existing
 *      `__visit_history/user/<name>` dir (joining that identity) or type a
 *      new name (desktop pre-filled with the SANITIZED OS login name; on
 *      mobile there is no pre-fill — Obsidian mobile exposes no
 *      user-identity API to plugins). Only an explicit confirmation pins;
 *      dismissal returns null and re-prompts on the next start.
 */
export class UserNameProviderDefault implements UserNameProvider {
  constructor(
    private readonly hiddenFileUtil: HiddenFileUtil,
    private readonly prompt: UserNamePrompt,
    private readonly osUserNameLookup: OsUserNameLookup = new OsUserNameLookupDefault(),
    private readonly cache: UserNameCache = new LocalStorageUserNameCache(),
  ) {
  }

  async getUserName(): Promise<string | null> {
    const cached = this.cache.get();
    if (cached) {
      return cached;
    }

    const existingNames = await this.hiddenFileUtil.listSubfolderNames(VhUserPaths.USERS_DIR);
    const osUserName = this.osUserNameLookup.getOsUserName();
    const chosenName = await this.prompt.promptForUserName({
      existingNames,
      defaultName: osUserName === null ? null : UserNameSafety.sanitizeToValidOrNull(osUserName),
    });
    if (chosenName === null) {
      return null;
    }
    // FIRST PIN WINS across vaults too: while our prompt was open, another
    // vault's prompt on this device may have pinned a name into the shared
    // device-scoped cache — prefer that pin over our prompt's answer.
    const pinnedWhilePromptOpen = this.cache.get();
    if (pinnedWhilePromptOpen) {
      return pinnedWhilePromptOpen;
    }
    // An EXISTING dir name is pinnable even when outside the strict charset
    // (it already is a working path segment — picking it joins that
    // identity); anything else must pass validation. Defense in depth: the
    // prompt's production impl is a thin untested Obsidian modal.
    if (!existingNames.includes(chosenName) && !UserNameSafety.isValidUserName(chosenName)) {
      console.error(`[VHP][UserNameProvider] prompt returned an invalid user name — not pinned userName=[${chosenName}]`);
      return null;
    }
    this.cache.set(chosenName);
    return chosenName;
  }
}
