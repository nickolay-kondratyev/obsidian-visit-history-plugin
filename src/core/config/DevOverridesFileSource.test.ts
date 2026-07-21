import { afterEach, describe, expect, it, vi } from 'vitest';
import { Platform } from 'obsidian';
import {
  DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR,
  DevOverridesFileSourceDefault,
} from './DevOverridesFileSource';

/**
 * The obsidian mock's `Platform` is a shared mutable singleton; `vi.stubEnv`
 * mutates process env. Both are restored after every test so cases don't leak.
 * The happy path (a readable file yields its text) is a one-line Node boundary
 * proven end-to-end by the real-Obsidian e2e test — mirrors how DesktopOsInfo
 * leaves its `os` read to the real environment.
 */
describe(DevOverridesFileSourceDefault.name, () => {
  afterEach(() => {
    Platform.isDesktop = true;
    Platform.isDesktopApp = true;
    vi.unstubAllEnvs();
  });

  // On mobile there is no `process`/`fs`, so the source returns null (callers
  // fall back to persisted settings) rather than throw reaching a Node builtin.
  it('should return null on mobile even when the env var is set', () => {
    Platform.isDesktop = false;
    Platform.isDesktopApp = false;
    vi.stubEnv(DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR, '/any/path.json');
    expect(new DevOverridesFileSourceDefault().readRawJson()).toBeNull();
  });

  it('should return null when desktop-sized but not the Electron app', () => {
    Platform.isDesktop = true;
    Platform.isDesktopApp = false;
    vi.stubEnv(DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR, '/any/path.json');
    expect(new DevOverridesFileSourceDefault().readRawJson()).toBeNull();
  });

  // The normal production case: no env var → the override mechanism is inert.
  it('should return null on desktop when the env var is unset', () => {
    expect(new DevOverridesFileSourceDefault().readRawJson()).toBeNull();
  });

  // Env var set but the file cannot be read → null (never throws) and the
  // genuine failure is logged (the path WAS provided).
  it('should return null and log when the file cannot be read', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv(DEV_OVERRIDES_FILE_JSON_PATH_ENV_VAR, '/nonexistent/vhp-overrides.json');
    expect(new DevOverridesFileSourceDefault().readRawJson()).toBeNull();
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });
});
