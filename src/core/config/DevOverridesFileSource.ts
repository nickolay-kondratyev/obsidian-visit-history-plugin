import { DesktopNodeModule } from '../util/env/DesktopNodeModule';

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
 * Boundary reader for the dev overrides file. Reaches Node's `fs` via the shared
 * `DesktopNodeModule` (Platform-guarded, mobile-safe) and reads `process.env`
 * behind a try/catch, so it returns null on mobile or any failure and the caller
 * falls back to persisted settings.
 */
export class DevOverridesFileSourceDefault implements DevOverridesFileSource {
  readRawJson(): string | null {
    const path = DevOverridesFileSourceDefault.overridesPath();
    // No env var set (the normal case) → override mechanism is inert.
    if (path === undefined || path === '') {
      return null;
    }

    const fs = DesktopNodeModule.require<DesktopFsModule>('fs');
    // Mobile / no Node builtins → fall back to persisted settings.
    if (fs === null) {
      return null;
    }

    try {
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
      // System boundary: `process` is a desktop-only Node global; the try/catch
      // backstops mobile (where the global is absent).
      // eslint-disable-next-line no-undef -- desktop-only Node global; try/catch backstops mobile
      return process.env[DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR];
    } catch {
      return undefined;
    }
  }
}
