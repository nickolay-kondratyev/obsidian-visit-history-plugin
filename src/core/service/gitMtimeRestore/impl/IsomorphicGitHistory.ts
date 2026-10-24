// Local object-reading APIs ONLY. Never import `isomorphic-git/http/*` (or
// clone/fetch/push): the plugin is fully offline and the publish scorecard
// flags network code.
import { Errors, hashBlob, readCommit, readTree, resolveRef } from 'isomorphic-git';
import { GitCommit, GitHistory, GitTreeEntry, GitTreeEntryKind } from '../GitHistory';
import { ReadOnlyDataAdapterFs } from './ReadOnlyDataAdapterFs';

/**
 * GitHistory over isomorphic-git (pure JS — runs on mobile, where there is no
 * `git` binary). Reads the repo whose `.git` folder sits at the root of
 * `fs` (the vault root, via ReadOnlyDataAdapterFs in prod).
 *
 * One instance per restore run: `cache` holds isomorphic-git's parsed
 * packfile indexes, which makes each object read cheap but is memory we
 * release when the run ends.
 */
export class IsomorphicGitHistory implements GitHistory {
  static readonly GIT_DIR = '.git';
  /** Lists the shallow-clone boundary commits, one oid per line (absent in a full clone). */
  private static readonly SHALLOW_FILE = `${IsomorphicGitHistory.GIT_DIR}/shallow`;
  private static readonly SYMLINK_MODE = '120000';
  private static readonly MS_PER_SECOND = 1000;

  private readonly cache = {};

  constructor(private readonly fs: ReadOnlyDataAdapterFs) {
  }

  async readHeadCommitOid(): Promise<string | undefined> {
    try {
      return await resolveRef({ fs: this.fs, gitdir: IsomorphicGitHistory.GIT_DIR, ref: 'HEAD' });
    } catch (error) {
      // Unborn branch (`git init`, nothing committed yet).
      if (error instanceof Errors.NotFoundError) return undefined;
      throw error;
    }
  }

  async readCommit(oid: string): Promise<GitCommit> {
    const { commit } = await readCommit({ fs: this.fs, gitdir: IsomorphicGitHistory.GIT_DIR, oid, cache: this.cache });
    return {
      oid,
      parentOids: commit.parent,
      treeOid: commit.tree,
      committedAtMs: commit.committer.timestamp * IsomorphicGitHistory.MS_PER_SECOND,
    };
  }

  async readTree(oid: string): Promise<readonly GitTreeEntry[]> {
    const { tree } = await readTree({ fs: this.fs, gitdir: IsomorphicGitHistory.GIT_DIR, oid, cache: this.cache });
    return tree.map(entry => ({ name: entry.path, kind: IsomorphicGitHistory.kindOf(entry.type, entry.mode), oid: entry.oid }));
  }

  async readShallowCommitOids(): Promise<ReadonlySet<string>> {
    const text = await this.fs.readTextIfExists(IsomorphicGitHistory.SHALLOW_FILE);
    if (text === undefined) return new Set(); // full clone
    return new Set(text.split('\n').map(line => line.trim()).filter(line => line !== ''));
  }

  async hashBlob(content: Uint8Array): Promise<string> {
    return (await hashBlob({ object: content })).oid;
  }

  private static kindOf(type: 'commit' | 'blob' | 'tree', mode: string): GitTreeEntryKind {
    if (type === 'tree') return 'tree';
    // A symlink is a blob holding the link target, never a note's bytes.
    if (type === 'blob' && mode !== IsomorphicGitHistory.SYMLINK_MODE) return 'blob';
    return 'other';
  }
}
