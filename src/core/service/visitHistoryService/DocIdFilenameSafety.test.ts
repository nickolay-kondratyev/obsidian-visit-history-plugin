import { describe, expect, it } from 'vitest';
import { DocIdFilenameSafety } from './DocIdFilenameSafety';

describe('DocIdFilenameSafety', () => {
  describe('isFilenameSafeId', () => {
    it.each([
      'docid_4n8VbFqzXKp0RtLmW2sYc_E',
      'some-legacy-uuid',
      'a',
      'a.b.c',
      'A_1-2',
    ])('should accept safe id [%s]', (id) => {
      expect(DocIdFilenameSafety.isFilenameSafeId(id)).toBe(true);
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
      expect(DocIdFilenameSafety.isFilenameSafeId(id)).toBe(false);
    });

    it('should accept an id of exactly 200 chars', () => {
      expect(DocIdFilenameSafety.isFilenameSafeId('x'.repeat(200))).toBe(true);
    });
  });
});
