// Minimal runtime stand-in for the 'obsidian' npm package.
//
// WHY: the 'obsidian' npm package ships type declarations only — there is no
// runtime JS to import in unit tests. vitest.config.ts aliases 'obsidian' to
// this file so classes like TFile exist at runtime (incl. instanceof checks).
//
// Only contains what unit tests actually touch. Production code still compiles
// against the real 'obsidian' type declarations.

export class TAbstractFile {
  path = '';
  name = '';
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

export class TFile extends TAbstractFile {
  basename = '';
  extension = '';
  stat = { ctime: 0, mtime: 0, size: 0 };
}

/** Mirrors Obsidian's normalizePath: forward slashes, collapsed, no leading/trailing slash. */
export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\//, '')
    .replace(/\/$/, '');
}

export class Notice {
  constructor(readonly message: string) {
  }
}

/**
 * Stand-in for Obsidian's `Platform`. Defaults to desktop so code guarded by
 * `Platform.isDesktopApp` runs its desktop path in tests (matching the real
 * environment tests emulate). Mutable so a test can flip it if needed.
 */
export const Platform = {
  isDesktopApp: true,
  isMobileApp: false,
  isMobile: false,
  isDesktop: true,
};

// --- Settings-tab stand-ins ---------------------------------------------
// Just enough for the settings-tab module (and its ConfirmModal import) to
// load and for the tab to be constructed + getSettingDefinitions() called in
// tests. getSettingDefinitions() returns plain data and never touches Setting,
// so these stubs are intentionally hollow (no DOM behavior).

/** Minimal stand-in for Obsidian's `PluginSettingTab`. Stores app/plugin. */
export class PluginSettingTab {
  readonly containerEl = { empty(): void {} };

  constructor(readonly app: unknown, readonly plugin: unknown) {
  }
}

/** Chainable no-op stand-in for Obsidian's `Setting` builder. */
export class Setting {
  constructor(_containerEl?: unknown) {
  }

  setName(_name: string): this { return this; }
  setDesc(_desc: string): this { return this; }
  setHeading(): this { return this; }
  addText(_cb: unknown): this { return this; }
  addButton(_cb: unknown): this { return this; }
}

/** Minimal stand-in for Obsidian's `Modal`. */
export class Modal {
  constructor(readonly app: unknown) {
  }
}
