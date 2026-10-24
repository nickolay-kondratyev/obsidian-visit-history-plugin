import { describe, expect, it } from 'vitest';
import { GitMtimeRestoreTexts } from './GitMtimeRestoreTexts';

describe('GitMtimeRestoreTexts', () => {
  describe('result', () => {
    it('should name restored and undated counts', () => {
      expect(GitMtimeRestoreTexts.result({ restored: 523, undated: 85, failedToWrite: 0 })).toBe(
        "Restored 523 files. 85 couldn't be dated (changed since the last commit, or older than the available history).",
      );
    });

    it('should leave out the undated sentence when every file was dated', () => {
      expect(GitMtimeRestoreTexts.result({ restored: 2, undated: 0, failedToWrite: 0 })).toBe('Restored 2 files.');
    });

    it('should use the singular for one file', () => {
      expect(GitMtimeRestoreTexts.result({ restored: 1, undated: 0, failedToWrite: 0 })).toBe('Restored 1 file.');
    });

    it('should mention files whose new time could not be written', () => {
      expect(GitMtimeRestoreTexts.result({ restored: 0, undated: 0, failedToWrite: 3 })).toBe(
        "Restored 0 files. 3 couldn't be updated.",
      );
    });
  });

  describe('confirmBody', () => {
    it('should state how many files will be updated', () => {
      expect(GitMtimeRestoreTexts.confirmBody(608)).toMatch(/^608 files share the same modified time/);
    });

    it('should say the git commit time is used as the modified time', () => {
      expect(GitMtimeRestoreTexts.confirmBody(608)).toContain('time of the last git commit that changed it');
    });
  });

  describe('progress', () => {
    it('should show commits checked and files found so far', () => {
      expect(GitMtimeRestoreTexts.progress({ commitsChecked: 1200, filesDated: 40, filesToDate: 600 })).toBe(
        'Restoring modified times from git: checked 1200 commits, found 40 of 600.',
      );
    });

    it('should use the singular for one commit', () => {
      expect(GitMtimeRestoreTexts.progress({ commitsChecked: 1, filesDated: 0, filesToDate: 5 })).toContain('checked 1 commit,');
    });
  });
});
