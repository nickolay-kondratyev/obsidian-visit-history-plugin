import { describe, expect, it } from 'vitest';
import { VhV2Paths } from './VhV2Paths';

describe('VhV2Paths', () => {
  describe('focusFilePath', () => {
    it('should build the per-device doc path', () => {
      expect(VhV2Paths.focusFilePath('my-host', 'docid_ABC123_E'))
        .toBe('.visit_history/v2/focus_per_device/my-host/docid_ABC123_E.vh_v2');
    });
  });

  describe('isFilenameSafeId', () => {
    it.each([
      'docid_4n8VbFqzXKp0RtLmW2sYc_E',
      'some-legacy-uuid',
      'a',
      'a.b.c',
      'A_1-2',
    ])('should accept safe id [%s]', (id) => {
      expect(VhV2Paths.isFilenameSafeId(id)).toBe(true);
    });

    it.each([
      ['', 'empty'],
      ['a/b', 'path separator'],
      ['a\\b', 'backslash'],
      ['..', 'dot-dot traversal'],
      ['.', 'single dot'],
      ['.hidden', 'leading dot (hidden file)'],
      ['trailing.', 'trailing dot'],
      ['sp ace', 'space'],
      ['colon:id', 'colon (Windows-illegal)'],
      ['id\nx', 'newline'],
      ['x'.repeat(201), 'overlong'],
    ])('should reject unsafe id [%s] (%s)', (id, _why) => {
      expect(VhV2Paths.isFilenameSafeId(id)).toBe(false);
    });

    it('should accept an id of exactly 200 chars', () => {
      expect(VhV2Paths.isFilenameSafeId('x'.repeat(200))).toBe(true);
    });
  });
});
