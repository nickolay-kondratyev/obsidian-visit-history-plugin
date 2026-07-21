import { afterEach, describe, expect, it } from 'vitest';
import { Platform } from 'obsidian';
import { DesktopNodeModule } from './DesktopNodeModule';

/**
 * The obsidian mock's `Platform` is a shared mutable singleton — restore the
 * desktop defaults after any test that flips it into the mobile state. The
 * desktop happy/throw paths run against vitest's real Node env, mirroring how
 * `DesktopOsInfo.test.ts` handles the boundary (no over-mocking of `require`).
 */
describe(DesktopNodeModule.name, () => {
  afterEach(() => {
    Platform.isDesktop = true;
    Platform.isDesktopApp = true;
  });

  describe('mobile (no Node builtins)', () => {
    // GIVEN the mobile app the require must return null so callers fall back,
    // never throw trying to reach a Node builtin.
    it('should return null when not the desktop app', () => {
      Platform.isDesktop = false;
      Platform.isDesktopApp = false;
      expect(DesktopNodeModule.require('os')).toBeNull();
    });

    // The operative correctness guard is `isDesktopApp`: even a desktop-sized
    // environment that is NOT the Electron app has no Node builtins.
    it('should return null when desktop-sized but not the Electron app', () => {
      Platform.isDesktop = true;
      Platform.isDesktopApp = false;
      expect(DesktopNodeModule.require('os')).toBeNull();
    });
  });

  describe('desktop (real Node env under vitest)', () => {
    it('should return the module when the builtin is available', () => {
      const os = DesktopNodeModule.require<{ hostname(): string }>('os');
      expect(os).not.toBeNull();
      expect(typeof os?.hostname).toBe('function');
    });

    // An unknown module name makes `require` throw — the try/catch backstops it
    // into null rather than propagating.
    it('should return null when the require throws (unknown module)', () => {
      expect(DesktopNodeModule.require('vhp-no-such-module-xyz')).toBeNull();
    });
  });
});
