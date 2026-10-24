import { GitDatingProgress } from './GitCommitTimeResolver';

/** How a restore run ended, in file counts. */
export interface GitMtimeRestoreOutcome {
  readonly restored: number;
  /** Kept their mtime: changed since the last commit, not committed, or older than the available history. */
  readonly undated: number;
  /** Dated, but writing the new mtime failed. */
  readonly failedToWrite: number;
}

/** Every user-facing text of "Restore modified times from git" (user vocabulary, sentence case). */
export class GitMtimeRestoreTexts {
  static readonly ACTION_NAME = 'Restore modified times from git';
  static readonly CONFIRM_CTA = 'Restore';
  static readonly NOT_A_REPO =
    "This vault isn't a git repository (there is no .git folder at the vault root), "
    + 'so there is no history to restore modified times from.';
  static readonly UNSUPPORTED_REPO =
    'The .git at the vault root is a file, not a folder (a git worktree or submodule). '
    + "Restoring modified times from git isn't supported there.";
  static readonly NOTHING_CLUSTERED =
    "Your files' modified times aren't bunched together, so there is nothing to restore.";
  static readonly NO_COMMITS =
    'The git repository has no commits yet, so there is no history to restore modified times from. '
    + 'Nothing was changed.';
  static readonly READ_FAILED =
    "Couldn't read the git history. The repository may be damaged or use a format this plugin can't read. "
    + 'Nothing was changed.';
  static readonly ALREADY_RUNNING = 'Already restoring modified times from git. Wait for it to finish.';
  static readonly CHECKING_FILES = 'Restoring modified times from git: comparing files with the last commit…';

  static confirmBody(fileCount: number): string {
    return `${GitMtimeRestoreTexts.files(fileCount)} share the same modified time, probably from a sync. `
      + 'This sets each one\'s modified time to the time of the last git commit that changed it. '
      + 'A commit\'s time can differ from when you actually edited the file, for example when several edits '
      + 'were committed together. Files changed since their last commit keep their current time. '
      + 'File contents are not changed.';
  }

  static progress({ commitsChecked, filesDated, filesToDate }: GitDatingProgress): string {
    return `Restoring modified times from git: checked ${commitsChecked} ${commitsChecked === 1 ? 'commit' : 'commits'}, `
      + `found ${filesDated} of ${filesToDate}.`;
  }

  static result({ restored, undated, failedToWrite }: GitMtimeRestoreOutcome): string {
    let text = `Restored ${GitMtimeRestoreTexts.files(restored)}.`;
    if (undated > 0) {
      text += ` ${undated} couldn't be dated (changed since the last commit, or older than the available history).`;
    }
    if (failedToWrite > 0) {
      text += ` ${failedToWrite} couldn't be updated.`;
    }
    return text;
  }

  private static files(count: number): string {
    return count === 1 ? '1 file' : `${count} files`;
  }
}
