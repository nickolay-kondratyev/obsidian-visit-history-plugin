import { TFile } from 'obsidian';
import { NoteFileUtil } from '../../util/file/note/NoteFileUtil';
import { GitCommitTimeResolver, GitDatingProgress, GitDatingTarget } from './GitCommitTimeResolver';
import { GitHistory } from './GitHistory';
import { GitMtimeRestoreOutcome } from './GitMtimeRestoreTexts';

export type GitMtimeRestoreRun =
  | { readonly kind: 'noCommits' }
  | { readonly kind: 'done'; readonly outcome: GitMtimeRestoreOutcome };

/**
 * Sets each file's modified time to the commit time of its last git change.
 *
 * Order guarantees (what makes it safe to run on a user's vault):
 * 1. Read-only phase first — hash every file, walk history. Any error there
 *    propagates and NOTHING has been written.
 * 2. Write phase only after the walk finished: per file, the bytes are read
 *    again and written back unchanged with the new mtime — and only if they
 *    still hash to the version the walk dated (a file edited meanwhile keeps
 *    its new, real mtime).
 */
export class GitMtimeRestorer {
  constructor(private readonly noteFileUtil: NoteFileUtil) {
  }

  async restore(
    files: readonly TFile[],
    history: GitHistory,
    onProgress: (progress: GitDatingProgress) => void,
  ): Promise<GitMtimeRestoreRun> {
    const targets = await this.hashTargets(files, history);
    const dating = await new GitCommitTimeResolver(history).resolve(targets, onProgress);
    if (dating.kind === 'noCommits') return { kind: 'noCommits' };

    const blobOidByPath = new Map(targets.map(t => [t.path, t.currentBlobOid]));
    const outcome = { restored: 0, undated: dating.undated.size, failedToWrite: 0 };
    for (const file of files) {
      const mtimeMs = dating.datedAtMs.get(file.path);
      const datedBlobOid = blobOidByPath.get(file.path);
      if (mtimeMs === undefined || datedBlobOid === undefined) continue;
      const written = await this.writeMtime(file, mtimeMs, datedBlobOid, history);
      if (written === 'written') outcome.restored++;
      else if (written === 'changed') outcome.undated++;
      else outcome.failedToWrite++;
    }
    return { kind: 'done', outcome };
  }

  private async hashTargets(files: readonly TFile[], history: GitHistory): Promise<GitDatingTarget[]> {
    const targets: GitDatingTarget[] = [];
    for (const file of files) {
      const bytes = await this.noteFileUtil.readBinary(file);
      targets.push({ path: file.path, currentBlobOid: await history.hashBlob(bytes) });
    }
    return targets;
  }

  private async writeMtime(
    file: TFile,
    mtimeMs: number,
    datedBlobOid: string,
    history: GitHistory,
  ): Promise<'written' | 'changed' | 'failed'> {
    try {
      const written = await this.noteFileUtil.setModifiedTimeKeepingContent(
        file,
        mtimeMs,
        async bytes => (await history.hashBlob(bytes)) === datedBlobOid,
      );
      return written ? 'written' : 'changed';
    } catch (error) {
      console.error('[VHP][GitMtimeRestorer] setting the modified time failed', { path: file.path, error });
      return 'failed';
    }
  }
}
