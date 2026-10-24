import { LruCache } from '../../util/cache/LruCache';
import { GitCommit, GitHistory, GitTreeEntry } from './GitHistory';

/** A file to date: its vault path (= path in the repo) and the git blob id of its CURRENT bytes. */
export interface GitDatingTarget {
  readonly path: string;
  readonly currentBlobOid: string;
}

/**
 * Why a target got no commit time. All of them keep their current mtime.
 * - `changedSinceLastCommit`: its bytes differ from HEAD's version (edited
 *   since, or line endings converted by `core.autocrlf` — skipped either way,
 *   the safe direction).
 * - `notInHead`: not committed at HEAD (new, ignored, or a path that doesn't
 *   match the repo's byte-for-byte).
 * - `olderThanHistory`: its last change lies beyond the commit cap or the
 *   shallow-clone boundary.
 */
export type UndatedReason = 'changedSinceLastCommit' | 'notInHead' | 'olderThanHistory';

export interface GitDatingProgress {
  readonly commitsChecked: number;
  readonly filesDated: number;
  /** Targets the walk is looking for (excludes the ones undated up front). */
  readonly filesToDate: number;
}

export type GitDatingResult =
  | { readonly kind: 'noCommits' }
  | {
    readonly kind: 'walked';
    /** path → committer time (epoch ms) of the newest commit that produced its HEAD content. */
    readonly datedAtMs: ReadonlyMap<string, number>;
    readonly undated: ReadonlyMap<string, UndatedReason>;
  };

/**
 * Dates each target by the commit that last changed it, walking history from
 * HEAD newest → oldest (committer time; merges follow every parent).
 *
 * "Last changed" = the newest commit whose version of the file is HEAD's
 * version while NONE of its parents' is — exact for linear history, and on
 * merges it ignores changes on a side branch that HEAD didn't keep.
 *
 * Cost: a commit is diffed against its parents only along the target paths,
 * and a folder whose tree id equals a parent's is never opened — so a commit
 * costs about the size of its change, not the vault. The walk stops once
 * every target is dated, at `maxCommitsToWalk`, or at the shallow-clone
 * boundary (whose commit is NEVER used as a date: its parents are missing,
 * so it would look like it added every file).
 */
export class GitCommitTimeResolver {
  /**
   * Ceiling on commits read per run. WHY this size: a fresh full sync clusters
   * every file, so files untouched for years need a deep walk; much deeper
   * than this would keep a phone busy for minutes. Files older than the cap
   * keep their current mtime.
   */
  static readonly MAX_COMMITS_TO_WALK = 20_000;
  /**
   * Parsed trees kept per run. A commit's tree is read once as a child and
   * once more as the next commit, so a small window catches nearly all reuse.
   */
  static readonly TREE_CACHE_ENTRIES = 2_000;

  constructor(
    private readonly history: GitHistory,
    private readonly maxCommitsToWalk: number = GitCommitTimeResolver.MAX_COMMITS_TO_WALK,
    private readonly treeCacheEntries: number = GitCommitTimeResolver.TREE_CACHE_ENTRIES,
  ) {
  }

  async resolve(
    targets: readonly GitDatingTarget[],
    onProgress: (progress: GitDatingProgress) => void = () => {},
  ): Promise<GitDatingResult> {
    const headOid = await this.history.readHeadCommitOid();
    if (headOid === undefined) return { kind: 'noCommits' };

    const walk = new HistoryWalk(this.history, this.maxCommitsToWalk, this.treeCacheEntries, onProgress);
    return walk.run(headOid, targets);
  }
}

/** One run's state (tree cache, pending targets) — discarded with the run. */
class HistoryWalk {
  private readonly trees: LruCache<string, ReadonlyMap<string, GitTreeEntry>>;
  private readonly datedAtMs = new Map<string, number>();
  private readonly undated = new Map<string, UndatedReason>();
  /** path → HEAD blob oid, for targets not dated yet. */
  private readonly pending = new Map<string, string>();
  private filesToDate = 0;

  constructor(
    private readonly history: GitHistory,
    private readonly maxCommitsToWalk: number,
    treeCacheEntries: number,
    private readonly onProgress: (progress: GitDatingProgress) => void,
  ) {
    this.trees = new LruCache(treeCacheEntries);
  }

  async run(headOid: string, targets: readonly GitDatingTarget[]): Promise<GitDatingResult> {
    const head = await this.history.readCommit(headOid);
    await this.splitTargetsAgainstHead(head, targets);
    await this.walkCommits(head);
    for (const path of this.pending.keys()) this.undated.set(path, 'olderThanHistory');
    return { kind: 'walked', datedAtMs: this.datedAtMs, undated: this.undated };
  }

  /** Targets whose bytes match HEAD go pending; the rest are undated up front. */
  private async splitTargetsAgainstHead(head: GitCommit, targets: readonly GitDatingTarget[]): Promise<void> {
    const headBlobs = new Map<string, string>();
    await this.collectBlobs(head.treeOid, PathTrie.of(targets.map(t => t.path)), headBlobs);
    for (const target of targets) {
      const headBlob = headBlobs.get(target.path);
      if (headBlob === undefined) this.undated.set(target.path, 'notInHead');
      else if (headBlob !== target.currentBlobOid) this.undated.set(target.path, 'changedSinceLastCommit');
      else this.pending.set(target.path, headBlob);
    }
    this.filesToDate = this.pending.size;
  }

  private async walkCommits(head: GitCommit): Promise<void> {
    const shallow = await this.history.readShallowCommitOids();
    const frontier = new CommitFrontier(head);
    let trie = PathTrie.of([...this.pending.keys()]);
    let commitsChecked = 0;

    while (this.pending.size > 0 && commitsChecked < this.maxCommitsToWalk) {
      const commit = frontier.takeNewest();
      if (commit === undefined) break;
      commitsChecked++;
      // Shallow boundary: parents absent — never dated, never walked past.
      if (!shallow.has(commit.oid)) {
        const parents = await Promise.all(commit.parentOids.map(oid => this.history.readCommit(oid)));
        const introduced: string[] = [];
        await this.collectIntroduced(commit.treeOid, parents.map(p => p.treeOid), trie, introduced);
        if (introduced.length > 0) {
          for (const path of introduced) {
            this.datedAtMs.set(path, commit.committedAtMs);
            this.pending.delete(path);
          }
          trie = PathTrie.of([...this.pending.keys()]);
        }
        parents.forEach(parent => frontier.add(parent));
      }
      this.onProgress({ commitsChecked, filesDated: this.datedAtMs.size, filesToDate: this.filesToDate });
    }
  }

  /** Blob oids of `trie`'s paths in the tree `treeOid` (absent paths are left out). */
  private async collectBlobs(treeOid: string, trie: PathTrie, out: Map<string, string>): Promise<void> {
    const entries = await this.treeEntries(treeOid);
    for (const [name, child] of trie.children) {
      const entry = entries.get(name);
      if (entry === undefined) continue;
      if (child.targetPath !== undefined && entry.kind === 'blob') out.set(child.targetPath, entry.oid);
      if (child.children.size > 0 && entry.kind === 'tree') await this.collectBlobs(entry.oid, child, out);
    }
  }

  /**
   * Pending paths under `trie` whose HEAD version appears in `treeOid` but in
   * none of `parentTreeOids` (`undefined` = folder absent in that parent).
   * A folder identical to any parent's is skipped unopened.
   */
  private async collectIntroduced(
    treeOid: string,
    parentTreeOids: readonly (string | undefined)[],
    trie: PathTrie,
    out: string[],
  ): Promise<void> {
    if (parentTreeOids.includes(treeOid)) return;
    const entries = await this.treeEntries(treeOid);
    const parentEntries = await Promise.all(parentTreeOids.map(oid => this.treeEntriesOrEmpty(oid)));
    for (const [name, child] of trie.children) {
      const entry = entries.get(name);
      if (entry === undefined) continue;
      const parentChildEntries = parentEntries.map(p => p.get(name));
      if (child.targetPath !== undefined && this.isIntroducedHere(child.targetPath, entry, parentChildEntries)) {
        out.push(child.targetPath);
      }
      if (child.children.size > 0 && entry.kind === 'tree') {
        const parentSubtrees = parentChildEntries.map(p => (p?.kind === 'tree' ? p.oid : undefined));
        await this.collectIntroduced(entry.oid, parentSubtrees, child, out);
      }
    }
  }

  private isIntroducedHere(
    path: string,
    entry: GitTreeEntry,
    parentEntries: readonly (GitTreeEntry | undefined)[],
  ): boolean {
    return entry.kind === 'blob'
      && entry.oid === this.pending.get(path)
      && parentEntries.every(p => p?.oid !== entry.oid);
  }

  private async treeEntriesOrEmpty(oid: string | undefined): Promise<ReadonlyMap<string, GitTreeEntry>> {
    return oid === undefined ? new Map() : this.treeEntries(oid);
  }

  private async treeEntries(oid: string): Promise<ReadonlyMap<string, GitTreeEntry>> {
    const cached = this.trees.get(oid);
    if (cached !== undefined) return cached;
    const entries = new Map((await this.history.readTree(oid)).map(e => [e.name, e] as const));
    this.trees.set(oid, entries);
    return entries;
  }
}

/** Commits still to visit, newest committer time first (ties: first added first); each commit once. */
class CommitFrontier {
  private readonly queue: GitCommit[];
  private readonly seen: Set<string>;

  constructor(head: GitCommit) {
    this.queue = [head];
    this.seen = new Set([head.oid]);
  }

  add(commit: GitCommit): void {
    if (this.seen.has(commit.oid)) return;
    this.seen.add(commit.oid);
    // Insert after every commit at least as new — keeps the queue sorted, stable on ties.
    const index = this.queue.findIndex(c => c.committedAtMs < commit.committedAtMs);
    if (index === -1) this.queue.push(commit);
    else this.queue.splice(index, 0, commit);
  }

  takeNewest(): GitCommit | undefined {
    return this.queue.shift();
  }
}

/** Target paths as a folder tree, so tree diffs only descend where targets live. */
class PathTrie {
  readonly children = new Map<string, PathTrie>();
  /** Set when a target path ends at this node. */
  targetPath: string | undefined;

  static of(paths: readonly string[]): PathTrie {
    const root = new PathTrie();
    for (const path of paths) {
      let node = root;
      for (const segment of path.split('/')) {
        let child = node.children.get(segment);
        if (child === undefined) {
          child = new PathTrie();
          node.children.set(segment, child);
        }
        node = child;
      }
      node.targetPath = path;
    }
    return root;
  }
}
