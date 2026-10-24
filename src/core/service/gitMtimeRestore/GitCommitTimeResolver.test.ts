import { beforeEach, describe, expect, it } from 'vitest';
import { FakeGitHistory, FakeSnapshot } from '../../../testSupport/FakeGitHistory';
import { GitCommitTimeResolver, GitDatingProgress, GitDatingResult, GitDatingTarget } from './GitCommitTimeResolver';

/** Target whose current text is `text` (blob oid computed like the fake's). */
function target(path: string, text: string): GitDatingTarget {
  return { path, currentBlobOid: FakeGitHistory.blobOid(text) };
}

function datedAt(result: GitDatingResult, path: string): number | undefined {
  return result.kind === 'walked' ? result.datedAtMs.get(path) : undefined;
}

function undatedReason(result: GitDatingResult, path: string): string | undefined {
  return result.kind === 'walked' ? result.undated.get(path) : undefined;
}

describe('GitCommitTimeResolver', () => {
  let history: FakeGitHistory;

  beforeEach(() => {
    history = new FakeGitHistory();
  });

  describe('resolve — linear history', () => {
    // GIVEN a.md changed at 1000 and 3000, b.md only at 1000 (root), c.md at 2000
    const snapshots: FakeSnapshot[] = [
      { 'a.md': 'a1', 'b.md': 'b1' },
      { 'a.md': 'a1', 'b.md': 'b1', 'c.md': 'c1' },
      { 'a.md': 'a2', 'b.md': 'b1', 'c.md': 'c1' },
    ];

    it('should date a file by its newest change', async () => {
      history.commitChain(1000, 1000, snapshots);
      const result = await new GitCommitTimeResolver(history).resolve([target('a.md', 'a2')]);
      expect(datedAt(result, 'a.md')).toBe(3000);
    });

    it('should date a file added mid-history by the commit that added it', async () => {
      history.commitChain(1000, 1000, snapshots);
      const result = await new GitCommitTimeResolver(history).resolve([target('c.md', 'c1')]);
      expect(datedAt(result, 'c.md')).toBe(2000);
    });

    it('should date a file unchanged since the root commit by the root commit', async () => {
      history.commitChain(1000, 1000, snapshots);
      const result = await new GitCommitTimeResolver(history).resolve([target('b.md', 'b1')]);
      expect(datedAt(result, 'b.md')).toBe(1000);
    });

    it('should date a file reverted to older content by the revert, not the original commit', async () => {
      history.commitChain(1000, 1000, [{ 'a.md': 'x' }, { 'a.md': 'y' }, { 'a.md': 'x' }]);
      const result = await new GitCommitTimeResolver(history).resolve([target('a.md', 'x')]);
      expect(datedAt(result, 'a.md')).toBe(3000);
    });

    it('should date files in nested folders', async () => {
      history.commitChain(1000, 1000, [{ 'f/g/n.md': 'n1' }, { 'f/g/n.md': 'n2' }]);
      const result = await new GitCommitTimeResolver(history).resolve([target('f/g/n.md', 'n2')]);
      expect(datedAt(result, 'f/g/n.md')).toBe(2000);
    });
  });

  describe('resolve — early stop', () => {
    it('should stop reading commits once every target is dated', async () => {
      // GIVEN 5 commits; the target changed in the newest one
      history.commitChain(1000, 1000, [
        { 'a.md': 'a1', 'old.md': 'o1' },
        { 'a.md': 'a2', 'old.md': 'o2' },
        { 'a.md': 'a3', 'old.md': 'o3' },
        { 'a.md': 'a4', 'old.md': 'o4' },
        { 'a.md': 'a5', 'old.md': 'o4' },
      ]);
      const progress: GitDatingProgress[] = [];
      // WHEN
      await new GitCommitTimeResolver(history).resolve([target('a.md', 'a5')], p => progress.push(p));
      // THEN only HEAD was checked
      expect(progress.at(-1)?.commitsChecked).toBe(1);
    });

    it('should check no commit when no target matches HEAD', async () => {
      history.commitChain(1000, 1000, [{ 'a.md': 'a1' }]);
      const progress: GitDatingProgress[] = [];
      await new GitCommitTimeResolver(history).resolve([target('a.md', 'edited'), target('new.md', 'n')], p => progress.push(p));
      expect(progress).toHaveLength(0);
    });

    it('should report progress with files dated out of files to date', async () => {
      history.commitChain(1000, 1000, [{ 'a.md': 'a1', 'b.md': 'b1' }, { 'a.md': 'a2', 'b.md': 'b1' }]);
      const progress: GitDatingProgress[] = [];
      await new GitCommitTimeResolver(history).resolve([target('a.md', 'a2'), target('b.md', 'b1')], p => progress.push(p));
      expect(progress).toEqual([
        { commitsChecked: 1, filesDated: 1, filesToDate: 2 },
        { commitsChecked: 2, filesDated: 2, filesToDate: 2 },
      ]);
    });
  });

  describe('resolve — unchanged subtrees', () => {
    /** Tiny cache, so re-opening a folder shows up as a read instead of a cache hit. */
    const TREE_CACHE_OF_ONE = 1;

    it('should open a never-changed folder only for the HEAD lookup and in the commit that added it', async () => {
      // GIVEN big/ never changes after the root commit; hot/ changes in every commit
      const [root] = history.commitChain(1000, 1000, [
        { 'big/x.md': 'x', 'hot/a.md': 'a1' },
        { 'big/x.md': 'x', 'hot/a.md': 'a2' },
        { 'big/x.md': 'x', 'hot/a.md': 'a3' },
        { 'big/x.md': 'x', 'hot/a.md': 'a4' },
        { 'big/x.md': 'x', 'hot/a.md': 'a5' },
      ]);
      const bigTree = history.treeOidAt(root!, 'big');
      // WHEN dating big/x.md walks all the way down to the root commit
      await new GitCommitTimeResolver(history, GitCommitTimeResolver.MAX_COMMITS_TO_WALK, TREE_CACHE_OF_ONE)
        .resolve([target('big/x.md', 'x')]);
      // THEN big/ was opened twice, not once per commit
      expect(history.readTreeCalls.filter(oid => oid === bigTree)).toHaveLength(2);
    });

    it('should still date a file inside a never-changed folder by the commit that added it', async () => {
      history.commitChain(1000, 1000, [
        { 'big/x.md': 'x', 'hot/a.md': 'a1' },
        { 'big/x.md': 'x', 'hot/a.md': 'a2' },
      ]);
      const result = await new GitCommitTimeResolver(history).resolve([target('big/x.md', 'x')]);
      expect(datedAt(result, 'big/x.md')).toBe(1000);
    });
  });

  describe('resolve — commit cap', () => {
    it('should leave a file changed beyond the cap undated as older than history', async () => {
      history.commitChain(1000, 1000, [{ 'a.md': 'a', 'b.md': 'b1' }, { 'a.md': 'a', 'b.md': 'b2' }, { 'a.md': 'a', 'b.md': 'b3' }]);
      const result = await new GitCommitTimeResolver(history, 2).resolve([target('a.md', 'a')]);
      expect(undatedReason(result, 'a.md')).toBe('olderThanHistory');
    });

    it('should still date a file changed within the cap', async () => {
      history.commitChain(1000, 1000, [{ 'a.md': 'a', 'b.md': 'b1' }, { 'a.md': 'a', 'b.md': 'b2' }, { 'a.md': 'a', 'b.md': 'b3' }]);
      const result = await new GitCommitTimeResolver(history, 2).resolve([target('a.md', 'a'), target('b.md', 'b3')]);
      expect(datedAt(result, 'b.md')).toBe(3000);
    });

    it('should not check more commits than the cap', async () => {
      history.commitChain(1000, 1000, [{ 'a.md': 'a', 'b.md': 'b1' }, { 'a.md': 'a', 'b.md': 'b2' }, { 'a.md': 'a', 'b.md': 'b3' }]);
      const progress: GitDatingProgress[] = [];
      await new GitCommitTimeResolver(history, 2).resolve([target('a.md', 'a')], p => progress.push(p));
      expect(progress.at(-1)?.commitsChecked).toBe(2);
    });
  });

  describe('resolve — shallow clone boundary', () => {
    /** boundary (shallow, parent missing) at 5000 → 6000 changes b → HEAD 7000 changes c. */
    function shallowHistory(): void {
      const boundary = history.commit({
        atMs: 5000,
        parents: ['missing-parent-not-in-repo'],
        files: { 'a.md': 'a', 'b.md': 'b1', 'c.md': 'c1' },
      });
      history.markShallow(boundary);
      history.commitChain(6000, 1000, [
        { 'a.md': 'a', 'b.md': 'b2', 'c.md': 'c1' },
        { 'a.md': 'a', 'b.md': 'b2', 'c.md': 'c2' },
      ], boundary);
    }

    it('should never stamp the boundary commit time on a file unchanged since before it', async () => {
      shallowHistory();
      const result = await new GitCommitTimeResolver(history).resolve([target('a.md', 'a')]);
      expect(undatedReason(result, 'a.md')).toBe('olderThanHistory');
    });

    it('should date a file changed right above the boundary', async () => {
      shallowHistory();
      const result = await new GitCommitTimeResolver(history).resolve([target('a.md', 'a'), target('b.md', 'b2')]);
      expect(datedAt(result, 'b.md')).toBe(6000);
    });
  });

  describe('resolve — merge commits', () => {
    /**
     * base(1000) ─ main(2000: m=m2) ─────────────── merge(4000)
     *     └─ side(3000: s=s2, m=m-side) ──────────────┘
     * The merge keeps side's s2 and main's m2; e is only in the merge (evil merge).
     */
    function mergeHistory(): void {
      const base = history.commit({ atMs: 1000, files: { 'm.md': 'm1', 's.md': 's1' } });
      const main = history.commit({ atMs: 2000, parents: [base], files: { 'm.md': 'm2', 's.md': 's1' } });
      const side = history.commit({ atMs: 3000, parents: [base], files: { 'm.md': 'm-side', 's.md': 's2' } });
      history.commit({ atMs: 4000, parents: [main, side], files: { 'm.md': 'm2', 's.md': 's2', 'e.md': 'e' } });
    }

    it('should date a file by its side-branch commit when the merge kept that version', async () => {
      mergeHistory();
      const result = await new GitCommitTimeResolver(history).resolve([target('s.md', 's2')]);
      expect(datedAt(result, 's.md')).toBe(3000);
    });

    it('should ignore a newer side-branch change the merge did not keep', async () => {
      mergeHistory();
      const result = await new GitCommitTimeResolver(history).resolve([target('m.md', 'm2')]);
      expect(datedAt(result, 'm.md')).toBe(2000);
    });

    it('should date a file by the merge when its content matches no parent', async () => {
      mergeHistory();
      const result = await new GitCommitTimeResolver(history).resolve([target('e.md', 'e')]);
      expect(datedAt(result, 'e.md')).toBe(4000);
    });

    it('should check each of the 4 commits once when a target predates the merge base', async () => {
      // GIVEN o.md is unchanged since base, so the walk must reach base via both parents
      const base = history.commit({ atMs: 1000, files: { 'o.md': 'o' } });
      const main = history.commit({ atMs: 2000, parents: [base], files: { 'o.md': 'o', 'm.md': '1' } });
      const side = history.commit({ atMs: 3000, parents: [base], files: { 'o.md': 'o', 's.md': '1' } });
      history.commit({ atMs: 4000, parents: [main, side], files: { 'o.md': 'o', 'm.md': '1', 's.md': '1' } });
      const progress: GitDatingProgress[] = [];
      const result = await new GitCommitTimeResolver(history).resolve([target('o.md', 'o')], p => progress.push(p));
      expect({ checked: progress.at(-1)?.commitsChecked, o: datedAt(result, 'o.md') }).toEqual({ checked: 4, o: 1000 });
    });
  });

  describe('resolve — targets not matching HEAD', () => {
    it('should leave a file edited since the last commit undated', async () => {
      history.commitChain(1000, 1000, [{ 'a.md': 'a1' }]);
      const result = await new GitCommitTimeResolver(history).resolve([target('a.md', 'edited')]);
      expect(undatedReason(result, 'a.md')).toBe('changedSinceLastCommit');
    });

    it('should leave a file absent from HEAD undated', async () => {
      history.commitChain(1000, 1000, [{ 'a.md': 'a1' }]);
      const result = await new GitCommitTimeResolver(history).resolve([target('new.md', 'n')]);
      expect(undatedReason(result, 'new.md')).toBe('notInHead');
    });

    it('should leave a file deleted at HEAD undated even though older commits had it', async () => {
      history.commitChain(1000, 1000, [{ 'a.md': 'a1', 'gone.md': 'g' }, { 'a.md': 'a1' }]);
      const result = await new GitCommitTimeResolver(history).resolve([target('gone.md', 'g')]);
      expect(undatedReason(result, 'gone.md')).toBe('notInHead');
    });

    it('should treat a target whose path is a folder at HEAD as absent', async () => {
      history.commitChain(1000, 1000, [{ 'x.md/inner.md': 'i' }]);
      const result = await new GitCommitTimeResolver(history).resolve([target('x.md', 'i')]);
      expect(undatedReason(result, 'x.md')).toBe('notInHead');
    });
  });

  describe('resolve — empty repo', () => {
    it('should report no commits when HEAD resolves to nothing', async () => {
      history.clearHead();
      const result = await new GitCommitTimeResolver(history).resolve([target('a.md', 'a')]);
      expect(result.kind).toBe('noCommits');
    });
  });
});
