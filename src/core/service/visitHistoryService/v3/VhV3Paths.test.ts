import { describe, expect, it } from 'vitest';
import { VhV3Paths } from './VhV3Paths';

describe('VhV3Paths', () => {
  describe('focusDurationFilePath', () => {
    it('should build the per-user per-device doc path', () => {
      expect(VhV3Paths.focusDurationFilePath('alice', 'my-host', 'docid_ABC123_E'))
        .toBe('__visit_history/user/alice/v3/focus_duration_per_device/my-host/docid_ABC123_E.vh_v3');
    });
  });

  describe('readmePath', () => {
    it('should live under the user root', () => {
      expect(VhV3Paths.readmePath('alice'))
        .toBe('__visit_history/user/alice/v3/README__generated__vh_v3_format.md');
    });
  });
});
