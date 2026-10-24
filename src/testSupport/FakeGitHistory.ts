import { GitCommit, GitHistory, GitTreeEntry } from '../core/service/gitMtimeRestore/GitHistory';

/** Full file snapshot of a commit: vault path → file text. */
export type FakeSnapshot = Readonly<Record<string, string>>;

interface FakeCommitSpec {
  readonly atMs: number;
  readonly parents?: readonly string[];
  readonly files: FakeSnapshot;
}

/**
 * In-memory git history for walk tests. Trees are content-addressed like real
 * git (an unchanged folder keeps its tree oid across commits), so tests can
 * assert which trees were opened via `readTreeCalls`.
 *
 * Blob oid of a file = `blob:<text>`; `hashBlob` hashes the same way, so a
 * target's current text equal to the committed text ⇔ "unchanged".
 */
export class FakeGitHistory implements GitHistory {
  readonly readTreeCalls: string[] = [];
  private readonly commits = new Map<string, GitCommit>();
  private readonly trees = new Map<string, GitTreeEntry[]>();
  private readonly treeOidBySerialized = new Map<string, string>();
  private readonly shallow = new Set<string>();
  private headOid: string | undefined;

  static blobOid(text: string): string {
    return `blob:${text}`;
  }

  /** Adds a commit (its snapshot is the WHOLE tree) and points HEAD at it. Returns its oid. */
  commit(spec: FakeCommitSpec): string {
    const oid = `commit-${this.commits.size + 1}`;
    this.commits.set(oid, {
      oid,
      parentOids: spec.parents ?? [],
      treeOid: this.storeTree(spec.files, ''),
      committedAtMs: spec.atMs,
    });
    this.headOid = oid;
    return oid;
  }

  /** A linear chain: each snapshot committed on top of the previous one, `stepMs` apart. Returns the oids. */
  commitChain(firstAtMs: number, stepMs: number, snapshots: readonly FakeSnapshot[], firstParent?: string): string[] {
    const oids: string[] = [];
    snapshots.forEach((files, i) => {
      const parent = i === 0 ? firstParent : oids[i - 1];
      oids.push(this.commit({ atMs: firstAtMs + i * stepMs, parents: parent === undefined ? [] : [parent], files }));
    });
    return oids;
  }

  setHead(oid: string): void {
    this.headOid = oid;
  }

  clearHead(): void {
    this.headOid = undefined;
  }

  markShallow(oid: string): void {
    this.shallow.add(oid);
  }

  /** Tree oid of the folder `folderPath` ('' = root) at `commitOid`. */
  treeOidAt(commitOid: string, folderPath: string): string {
    let oid = this.requireCommit(commitOid).treeOid;
    for (const segment of folderPath === '' ? [] : folderPath.split('/')) {
      const entry = this.requireTree(oid).find(e => e.name === segment && e.kind === 'tree');
      if (entry === undefined) throw new Error(`no folder folderPath=[${folderPath}] at commit=[${commitOid}]`);
      oid = entry.oid;
    }
    return oid;
  }

  readHeadCommitOid(): Promise<string | undefined> {
    return Promise.resolve(this.headOid);
  }

  readCommit(oid: string): Promise<GitCommit> {
    return Promise.resolve(this.requireCommit(oid));
  }

  readTree(oid: string): Promise<readonly GitTreeEntry[]> {
    this.readTreeCalls.push(oid);
    return Promise.resolve(this.requireTree(oid));
  }

  readShallowCommitOids(): Promise<ReadonlySet<string>> {
    return Promise.resolve(this.shallow);
  }

  hashBlob(content: Uint8Array): Promise<string> {
    return Promise.resolve(FakeGitHistory.blobOid(new TextDecoder().decode(content)));
  }

  /** Stores the folder `prefix` of `files` (and its subfolders); returns its content-addressed oid. */
  private storeTree(files: FakeSnapshot, prefix: string): string {
    const blobs = new Map<string, string>();
    const subfolders = new Set<string>();
    for (const [path, text] of Object.entries(files)) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash === -1) blobs.set(rest, FakeGitHistory.blobOid(text));
      else subfolders.add(rest.slice(0, slash));
    }
    const entries: GitTreeEntry[] = [
      ...[...blobs].map(([name, oid]) => ({ name, kind: 'blob' as const, oid })),
      ...[...subfolders].map(name => ({ name, kind: 'tree' as const, oid: this.storeTree(files, `${prefix}${name}/`) })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    const serialized = JSON.stringify(entries);
    const existing = this.treeOidBySerialized.get(serialized);
    if (existing !== undefined) return existing;
    const oid = `tree-${this.treeOidBySerialized.size + 1}`;
    this.treeOidBySerialized.set(serialized, oid);
    this.trees.set(oid, entries);
    return oid;
  }

  private requireCommit(oid: string): GitCommit {
    const commit = this.commits.get(oid);
    if (commit === undefined) throw new Error(`no commit oid=[${oid}]`);
    return commit;
  }

  private requireTree(oid: string): GitTreeEntry[] {
    const tree = this.trees.get(oid);
    if (tree === undefined) throw new Error(`no tree oid=[${oid}]`);
    return tree;
  }
}
