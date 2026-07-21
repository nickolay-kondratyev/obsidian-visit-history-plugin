import { Platform } from 'obsidian';

/**
 * Environment variable naming a JSON file of DEV config overrides. Set ONLY by
 * the e2e harness (never by normal users), so the override mechanism is inert
 * in production. Duplicated in `e2e/constants.ts` (node-side, can't import src).
 */
export const DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR = '__VISIT_HISTORY_DEV_OVERRIDES_FILE_JSON_PATH__';

/** Minimal typed view of Node's `fs` module (desktop / Electron only). */
interface DesktopFsModule {
  readFileSync(path: string, encoding: 'utf8'): string;
}

/** Reads the raw text of the dev overrides file, or null when there is none. */
export interface DevOverridesFileSource {
  /**
   * The overrides file's raw text, or null when: the env var is unset, we're
   * on mobile (no Node builtins), or the read fails. Never throws.
   */
  readRawJson(): string | null;
}

/**
 * Boundary reader for the dev overrides file. Mirrors `DesktopOsInfo`'s
 * mobile-safe pattern: `Platform`-guarded, try/catch-wrapped, TYPED access to
 * the desktop-only Node globals (`process`, `require('fs')`). Returns null on
 * mobile or any failure so the caller falls back to persisted settings.
 */
export class DevOverridesFileSourceDefault implements DevOverridesFileSource {
  readRawJson(): string | null {
    // Node's `process`/`fs` exist only in the desktop Electron app, never on
    // mobile. Same guard rationale as DesktopOsInfo — both flags document intent;
    // the try/catch is the final backstop.
    if (!Platform.isDesktop) {
      return null;
    }
    if (!Platform.isDesktopApp) {
      return null;
    }

    const path = DevOverridesFileSourceDefault.overridesPath();
    // No env var set (the normal case) → override mechanism is inert.
    if (path === undefined || path === '') {
      return null;
    }

    try {
      // System boundary: desktop-only Node builtin. Assigned to a TYPED const so
      // the member call is type-checked (no no-unsafe-*).
      // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- desktop-only Electron builtin; guarded above + try/catch
      const fs = require('fs') as DesktopFsModule;
      return fs.readFileSync(path, 'utf8');
    } catch (err) {
      // The path WAS provided but could not be read — a genuine, unexpected
      // failure worth surfacing (only reachable in a dev/e2e run).
      console.error('[VHP][DevOverridesFileSource] failed to read dev overrides file', err);
      return null;
    }
  }

  private static overridesPath(): string | undefined {
    try {
      // System boundary: `process` is a desktop-only Node global (guarded above).
      // eslint-disable-next-line no-undef -- desktop-only Node global; guarded above + try/catch
      return process.env[DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR];
    } catch {
      return undefined;
    }
  }
}
