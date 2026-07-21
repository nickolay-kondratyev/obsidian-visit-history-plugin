import { describe, expect, it, vi } from 'vitest';
import { DevConfigOverridesReader } from './DevConfigOverridesReader';
import { DevOverridesFileSource } from './DevOverridesFileSource';

/** Fake source returning a fixed raw payload — the fs/env boundary is not touched. */
function sourceReturning(rawJson: string | null): DevOverridesFileSource {
  return { readRawJson: () => rawJson };
}

describe(DevConfigOverridesReader.name, () => {
  describe('overrides', () => {
    it('should be empty when the source has no file', () => {
      const reader = new DevConfigOverridesReader(sourceReturning(null));
      expect(reader.overrides).toEqual({});
    });

    it('should parse idleTimeoutSeconds from valid JSON', () => {
      const reader = new DevConfigOverridesReader(sourceReturning('{"idleTimeoutSeconds": 1}'));
      expect(reader.overrides.idleTimeoutSeconds).toBe(1);
    });

    it('should ignore a non-number idleTimeoutSeconds', () => {
      const reader = new DevConfigOverridesReader(sourceReturning('{"idleTimeoutSeconds": "1"}'));
      expect(reader.overrides.idleTimeoutSeconds).toBeUndefined();
    });

    it('should be empty (never throw) on malformed JSON', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const reader = new DevConfigOverridesReader(sourceReturning('{ not json'));
      expect(reader.overrides).toEqual({});
      errorSpy.mockRestore();
    });

    it('should log once on malformed JSON (the file WAS provided)', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      new DevConfigOverridesReader(sourceReturning('{ not json'));
      expect(errorSpy).toHaveBeenCalledOnce();
      errorSpy.mockRestore();
    });

    it('should ignore a JSON value that is not an object', () => {
      const reader = new DevConfigOverridesReader(sourceReturning('42'));
      expect(reader.overrides.idleTimeoutSeconds).toBeUndefined();
    });

    it('should read the source exactly once at construction', () => {
      const readRawJson = vi.fn<() => string | null>().mockReturnValue(null);
      new DevConfigOverridesReader({ readRawJson });
      expect(readRawJson).toHaveBeenCalledOnce();
    });
  });
});
