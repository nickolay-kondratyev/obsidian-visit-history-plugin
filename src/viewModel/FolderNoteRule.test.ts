import { describe, expect, it } from 'vitest';
import { FolderNoteRule, type IsFolderPath } from './FolderNoteRule';

/** GIVEN a vault whose existing folders are exactly `folderPaths`. */
function vaultWithFolders(...folderPaths: string[]): IsFolderPath {
  const folders = new Set(folderPaths);
  return path => folders.has(path);
}

const NO_FOLDERS = vaultWithFolders();

describe('FolderNoteRule', () => {
  describe('folderPathOf', () => {
    describe('INSIDE convention (note named like its parent folder)', () => {
      it('should return the parent folder path', () => {
        expect(FolderNoteRule.folderPathOf('Projects/Alpha/Alpha.md', NO_FOLDERS)).toBe('Projects/Alpha');
      });

      it('should return a top-level parent folder path', () => {
        expect(FolderNoteRule.folderPathOf('Alpha/Alpha.md', NO_FOLDERS)).toBe('Alpha');
      });

      it('should accept a canvas', () => {
        expect(FolderNoteRule.folderPathOf('Alpha/Alpha.canvas', NO_FOLDERS)).toBe('Alpha');
      });

      it('should match case-sensitively', () => {
        expect(FolderNoteRule.folderPathOf('Alpha/alpha.md', NO_FOLDERS)).toBeUndefined();
      });

      it('should strip only the final extension', () => {
        // GIVEN a dotted folder name matched by a dotted stem
        expect(FolderNoteRule.folderPathOf('v1.2/v1.2.md', NO_FOLDERS)).toBe('v1.2');
      });

      it('should win over SIBLING when both apply', () => {
        // GIVEN Alpha/Alpha.md AND a folder Alpha/Alpha/ beside it
        const isFolder = vaultWithFolders('Alpha', 'Alpha/Alpha');
        expect(FolderNoteRule.folderPathOf('Alpha/Alpha.md', isFolder)).toBe('Alpha');
      });
    });

    describe('SIBLING convention (note named like a folder next to it)', () => {
      it('should return the sibling folder path when that folder exists', () => {
        // GIVEN Projects/Alpha.md beside Projects/Alpha/
        const isFolder = vaultWithFolders('Projects', 'Projects/Alpha');
        expect(FolderNoteRule.folderPathOf('Projects/Alpha.md', isFolder)).toBe('Projects/Alpha');
      });

      it('should return the sibling folder for a vault-root note', () => {
        // GIVEN Alpha.md beside Alpha/ at the vault root
        expect(FolderNoteRule.folderPathOf('Alpha.md', vaultWithFolders('Alpha'))).toBe('Alpha');
      });

      it('should return undefined when no such folder exists', () => {
        expect(FolderNoteRule.folderPathOf('Projects/Alpha.md', vaultWithFolders('Projects'))).toBeUndefined();
      });

      it('should match case-sensitively', () => {
        expect(FolderNoteRule.folderPathOf('alpha.md', vaultWithFolders('Alpha'))).toBeUndefined();
      });
    });
  });
});
