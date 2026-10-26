import { describe, expect, it } from 'vitest';
import { FolderNoteRule } from './FolderNoteRule';

describe('FolderNoteRule', () => {
  describe('folderPathOf', () => {
    it('should return the folder path when the note is named like its folder', () => {
      // GIVEN Projects/Alpha/Alpha.md
      // WHEN resolving its folder
      // THEN it is the folder note of Projects/Alpha
      expect(FolderNoteRule.folderPathOf('Projects/Alpha/Alpha.md')).toBe('Projects/Alpha');
    });

    it('should return the folder path for a top-level folder note', () => {
      expect(FolderNoteRule.folderPathOf('Alpha/Alpha.md')).toBe('Alpha');
    });

    it('should return the folder path for a canvas folder note', () => {
      expect(FolderNoteRule.folderPathOf('Alpha/Alpha.canvas')).toBe('Alpha');
    });

    it('should return undefined when the note name differs from its folder name', () => {
      expect(FolderNoteRule.folderPathOf('Alpha/Beta.md')).toBeUndefined();
    });

    it('should return undefined for a vault-root file', () => {
      // GIVEN a root file (no parent folder)
      expect(FolderNoteRule.folderPathOf('Alpha.md')).toBeUndefined();
    });

    it('should return undefined for a sibling note next to its folder (unsupported convention)', () => {
      // GIVEN Projects/Alpha.md beside Projects/Alpha/ — its parent is Projects
      expect(FolderNoteRule.folderPathOf('Projects/Alpha.md')).toBeUndefined();
    });

    it('should match case-sensitively', () => {
      expect(FolderNoteRule.folderPathOf('Alpha/alpha.md')).toBeUndefined();
    });

    it('should strip only the final extension', () => {
      // GIVEN a dotted folder name matched by a dotted stem
      expect(FolderNoteRule.folderPathOf('v1.2/v1.2.md')).toBe('v1.2');
    });
  });
});
