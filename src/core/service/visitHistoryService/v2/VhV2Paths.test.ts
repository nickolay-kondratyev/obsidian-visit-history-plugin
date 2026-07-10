import { describe, expect, it } from 'vitest';
import { VhV2Paths } from './VhV2Paths';

describe('VhV2Paths', () => {
  describe('focusFilePath', () => {
    it('should build the per-user per-device doc path', () => {
      expect(VhV2Paths.focusFilePath('alice', 'my-host', 'docid_ABC123_E'))
        .toBe('.visit_history/user/alice/v2/focus_per_device/my-host/docid_ABC123_E.vh_v2');
    });
  });

  describe('readmePath', () => {
    it('should live under the user root', () => {
      expect(VhV2Paths.readmePath('alice'))
        .toBe('.visit_history/user/alice/v2/README__generated__vh_v2_format.md');
    });
  });
});
