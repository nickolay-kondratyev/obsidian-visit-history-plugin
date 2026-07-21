import { afterEach, describe, expect, it } from 'vitest';
import { Platform } from 'obsidian';
import { DesktopOsInfo } from './DesktopOsInfo';

/**
 * The obsidian mock's `Platform` is a shared mutable singleton — restore the
 * desktop defaults after any test that flips it into the mobile state.
 */
describe(DesktopOsInfo.name, () => {
  afterEach(() => {
    Platform.isDesktop = true;
    Platform.isDesktopApp = true;
  });

  describe('mobile (no Node builtins)', () => {
    // GIVEN the mobile app (no `os` module) both accessors must return null so
    // callers fall back — never throw trying to reach a Node builtin.
    it('should return null for hostname', () => {
      Platform.isDesktop = false;
      Platform.isDesktopApp = false;
      expect(DesktopOsInfo.hostname()).toBeNull();
    });

    it('should return null for userName', () => {
      Platform.isDesktop = false;
      Platform.isDesktopApp = false;
      expect(DesktopOsInfo.userName()).toBeNull();
    });

    // The operative correctness guard is `isDesktopApp`: even a desktop-sized
    // environment that is NOT the Electron app has no Node `os`.
    it('should return null when desktop-sized but not the Electron app', () => {
      Platform.isDesktop = true;
      Platform.isDesktopApp = false;
      expect(DesktopOsInfo.hostname()).toBeNull();
    });
  });

  describe('desktop (real Node env under vitest)', () => {
    // Real machine values — assert only that a non-empty string is returned,
    // never an exact hostname/username.
    it('should return a non-empty hostname string', () => {
      const hostname = DesktopOsInfo.hostname();
      expect(typeof hostname).toBe('string');
      expect(hostname).toBeTruthy();
    });

    it('should return a non-empty userName string', () => {
      const userName = DesktopOsInfo.userName();
      expect(typeof userName).toBe('string');
      expect(userName).toBeTruthy();
    });
  });
});
