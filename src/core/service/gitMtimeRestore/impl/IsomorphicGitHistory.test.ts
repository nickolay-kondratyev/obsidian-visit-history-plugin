import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodeFsGitDirReader } from '../../../../testSupport/NodeFsGitDirReader';
import { GitCommitTimeResolver, GitDatingResult } from '../GitCommitTimeResolver';
import { IsomorphicGitHistory } from './IsomorphicGitHistory';
import { ReadOnlyDataAdapterFs } from './ReadOnlyDataAdapterFs';

/**
 * Integration: the REAL isomorphic-git, through ReadOnlyDataAdapterFs, over a
 * temp repo built with the git CLI at fixed commit dates.
 */

/** Fixed commit dates (epoch seconds) — whole seconds, as git stores them. */
const T1 = 1_700_000_000;
const T2 = 1_700_100_000;
const T3 = 1_700_200_000;
const MS = 1000;

class TempRepo {
  readonly dir = mkdtempSync(join(tmpdir(), 'vh-git-it-'));

  git(...args: string[]): string {
    return this.gitAt(0, ...args);
  }

  /** Runs git with author + committer date pinned to `epochSeconds`. */
  gitAt(epochSeconds: number, ...args: string[]): string {
    const date = `@${epochSeconds} +0000`;
    return execFileSync('git', args, {
      cwd: this.dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
        GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date,
        GIT_CONFIG_NOSYSTEM: '1', HOME: this.dir,
      },
    });
  }

  write(path: string, text: string): void {
    mkdirSync(dirname(join(this.dir, path)), { recursive: true });
    writeFileSync(join(this.dir, path), text);
  }

  commitAll(epochSeconds: number): void {
    this.git('add', '-A');
    this.gitAt(epochSeconds, 'commit', '-q', '-m', `at ${epochSeconds}`);
  }

  history(): IsomorphicGitHistory {
    return new IsomorphicGitHistory(new ReadOnlyDataAdapterFs(new NodeFsGitDirReader(this.dir)));
  }

  /** Git's own blob id for `text` — the reference our hashing must match. */
  cliBlobOid(text: string): string {
    return execFileSync('git', ['hash-object', '--stdin'], { input: text, encoding: 'utf8' }).trim();
  }

  remove(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

/** a.md: T1 → changed T3. notes/b.md: T1 only. notes/c.md: added T2. */
function buildThreeCommitHistory(repo: TempRepo): void {
  repo.git('init', '-q', '-b', 'main');
  repo.write('a.md', 'a1\n');
  repo.write('notes/b.md', 'b1\n');
  repo.commitAll(T1);
  repo.write('notes/c.md', 'c1\n');
  repo.commitAll(T2);
  repo.write('a.md', 'a2\n');
  repo.commitAll(T3);
}

async function dateAll(history: IsomorphicGitHistory, files: Record<string, string>): Promise<GitDatingResult> {
  const targets = await Promise.all(Object.entries(files).map(async ([path, text]) => ({
    path,
    currentBlobOid: await history.hashBlob(new TextEncoder().encode(text)),
  })));
  return new GitCommitTimeResolver(history).resolve(targets);
}

function datedAtMs(result: GitDatingResult): Record<string, number> {
  return result.kind === 'walked' ? Object.fromEntries(result.datedAtMs) : {};
}

describe('IsomorphicGitHistory (integration, real git repo)', () => {
  let repo: TempRepo;

  beforeEach(() => {
    repo = new TempRepo();
  });

  afterEach(() => {
    repo.remove();
  });

  describe('dating via GitCommitTimeResolver', () => {
    it('should date each file by its last commit in a repo of loose objects', async () => {
      buildThreeCommitHistory(repo);
      const result = await dateAll(repo.history(), { 'a.md': 'a2\n', 'notes/b.md': 'b1\n', 'notes/c.md': 'c1\n' });
      expect(datedAtMs(result)).toEqual({ 'a.md': T3 * MS, 'notes/b.md': T1 * MS, 'notes/c.md': T2 * MS });
    });

    it('should date each file by its last commit in a packed repo', async () => {
      buildThreeCommitHistory(repo);
      repo.git('gc', '-q', '--aggressive');
      const result = await dateAll(repo.history(), { 'a.md': 'a2\n', 'notes/b.md': 'b1\n', 'notes/c.md': 'c1\n' });
      expect(datedAtMs(result)).toEqual({ 'a.md': T3 * MS, 'notes/b.md': T1 * MS, 'notes/c.md': T2 * MS });
    });

    it('should leave a file edited since its last commit undated', async () => {
      buildThreeCommitHistory(repo);
      const result = await dateAll(repo.history(), { 'a.md': 'a2 edited\n' });
      expect(result.kind === 'walked' ? result.undated.get('a.md') : undefined).toBe('changedSinceLastCommit');
    });

    it('should not date a file older than a shallow clone boundary with the boundary time', async () => {
      // GIVEN a depth-2 clone: boundary = T2 commit; notes/b.md last changed at T1 (beyond it)
      buildThreeCommitHistory(repo);
      const clone = new TempRepo();
      try {
        clone.git('clone', '-q', '--depth', '2', `file://${repo.dir}`, '.');
        const result = await dateAll(clone.history(), { 'a.md': 'a2\n', 'notes/b.md': 'b1\n' });
        expect(result).toEqual({
          kind: 'walked',
          datedAtMs: new Map([['a.md', T3 * MS]]),
          undated: new Map([['notes/b.md', 'olderThanHistory']]),
        });
      } finally {
        clone.remove();
      }
    });

    it('should report no commits for a freshly initialized repo', async () => {
      repo.git('init', '-q', '-b', 'main');
      const result = await dateAll(repo.history(), { 'a.md': 'a\n' });
      expect(result.kind).toBe('noCommits');
    });
  });

  describe('hashBlob', () => {
    it('should match git hash-object for the same bytes', async () => {
      const text = 'line one\r\nline two\n';
      const oid = await repo.history().hashBlob(new TextEncoder().encode(text));
      expect(oid).toBe(repo.cliBlobOid(text));
    });
  });

  describe('readShallowCommitOids', () => {
    it('should be empty for a full clone', async () => {
      buildThreeCommitHistory(repo);
      expect((await repo.history().readShallowCommitOids()).size).toBe(0);
    });
  });
});
