import { describe, expect, it } from 'vitest';
import { VhV3Paths } from './VhV3Paths';

describe('VhV3Paths', () => {
  describe('focusDurationFilePath', () => {
    it('should build the per-user per-device doc path', () => {
      expect(VhV3Paths.focusDurationFilePath('alice', 'my-host', 'docid_ABC123_E'))
        .toBe('.plugin_data/visit_history/user/alice/v3/focus_duration_per_device/my-host/docid_ABC123_E.vh_v3');
    });
  });

  describe('mergedInDocDir', () => {
    it('should nest the receiving doc id under the per-user per-device merged-in dir', () => {
      expect(VhV3Paths.mergedInDocDir('alice', 'my-host', 'docid_note1_e'))
        .toBe('.plugin_data/visit_history/user/alice/v3/merged_in_focus_duration_per_device/my-host/docid_note1_e');
    });
  });

  describe('readmePath', () => {
    it('should live under the user root', () => {
      expect(VhV3Paths.readmePath('alice'))
        .toBe('.plugin_data/visit_history/user/alice/v3/README__generated__vh_v3_format.md');
    });
  });
});
