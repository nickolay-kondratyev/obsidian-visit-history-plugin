import { describe, expect, it } from 'vitest';
import { VhV2Paths } from './VhV2Paths';

describe('VhV2Paths', () => {
  describe('focusFilePath', () => {
    it('should build the per-device doc path', () => {
      expect(VhV2Paths.focusFilePath('my-host', 'docid_ABC123_E'))
        .toBe('.visit_history/v2/focus_per_device/my-host/docid_ABC123_E.vh_v2');
    });
  });

});
