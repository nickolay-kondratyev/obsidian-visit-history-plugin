/** A commit as the history walk needs it. */
export interface GitCommit {
  readonly oid: string;
  /** Empty for a root commit; 2+ for a merge. */
  readonly parentOids: readonly string[];
  readonly treeOid: string;
  /** Committer time (epoch ms) — what `git log` sorts by. */
  readonly committedAtMs: number;
}

/** `blob` = file, `tree` = folder, `other` = anything else (e.g. a submodule commit). */
export type GitTreeEntryKind = 'blob' | 'tree' | 'other';

/** One direct child of a git tree (folder). */
export interface GitTreeEntry {
  readonly name: string;
  readonly kind: GitTreeEntryKind;
  readonly oid: string;
}

/**
 * Read-only access to the vault's git repository — the ONE seam for history
 * reading (isomorphic-git in prod, an in-memory fake in tests).
 *
 * Never writes to `.git` (no commits, index or ref changes).
 */
export interface GitHistory {
  /** The commit HEAD points at, or `undefined` when the repo has no commits yet. */
  readHeadCommitOid(): Promise<string | undefined>;

  readCommit(oid: string): Promise<GitCommit>;

  /** Direct children of a tree object. */
  readTree(oid: string): Promise<readonly GitTreeEntry[]>;

  /**
   * Commits at the shallow-clone boundary (their parents are not in the
   * repo). Empty for a full clone.
   */
  readShallowCommitOids(): Promise<ReadonlySet<string>>;

  /** The git blob id of `content` — what the file's id would be if committed as-is. */
  hashBlob(content: Uint8Array): Promise<string>;
}
