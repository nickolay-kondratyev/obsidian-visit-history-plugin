import { describe, expect, it } from 'vitest';
import { PlainNoteCheck } from './PlainNoteCheck';
import { makeTFile } from '../../../testSupport/fileFactory';

describe('PlainNoteCheck', () => {
  describe('isPlainMarkdownNote', () => {
    it('should accept a markdown note', () => {
      expect(PlainNoteCheck.isPlainMarkdownNote(makeTFile({ path: 'a/note.md' }), '# hi')).toBe(true);
    });

    it('should refuse a canvas', () => {
      expect(PlainNoteCheck.isPlainMarkdownNote(makeTFile({ path: 'board.canvas' }), '{}')).toBe(false);
    });

    it('should refuse an .excalidraw.md drawing', () => {
      expect(PlainNoteCheck.isPlainMarkdownNote(makeTFile({ path: 'Drawing.excalidraw.md' }), '')).toBe(false);
    });

    it('should refuse a markdown file marked as an Excalidraw drawing', () => {
      const content = '---\nexcalidraw-plugin: parsed\n---\n';
      expect(PlainNoteCheck.isPlainMarkdownNote(makeTFile({ path: 'Drawing.md' }), content)).toBe(false);
    });
  });
});
