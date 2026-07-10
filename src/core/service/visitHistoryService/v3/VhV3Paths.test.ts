import { describe, expect, it } from 'vitest';
import { VhV3Paths } from './VhV3Paths';

describe('VhV3Paths', () => {
  describe('focusDurationFilePath', () => {
    it('should build the per-device doc path', () => {
      expect(VhV3Paths.focusDurationFilePath('my-host', 'docid_ABC123_E'))
        .toBe('.visit_history/v3/focus_duration_per_device/my-host/docid_ABC123_E.vh_v3');
    });
  });

  describe('README_PATH', () => {
    it('should live under the v3 folder', () => {
      expect(VhV3Paths.README_PATH).toBe('.visit_history/v3/README__generated__vh_v3_format.md');
    });
  });
});
