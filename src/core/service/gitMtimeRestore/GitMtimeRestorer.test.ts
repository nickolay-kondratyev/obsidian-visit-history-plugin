import { TFile } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeGitHistory } from '../../../testSupport/FakeGitHistory';
import { FakeNoteFileUtil } from '../../../testSupport/FakeNoteFileUtil';
import { GitMtimeRestorer } from './GitMtimeRestorer';

describe('GitMtimeRestorer', () => {
  let notes: FakeNoteFileUtil;
  let history: FakeGitHistory;
  let restorer: GitMtimeRestorer;
  let a: TFile;
  let b: TFile;

  beforeEach(() => {
    // GIVEN a.md last committed at 2000, b.md at 1000; both unchanged on disk
    notes = new FakeNoteFileUtil();
    history = new FakeGitHistory();
    history.commitChain(1000, 1000, [{ 'a.md': 'a1', 'b.md': 'b1' }, { 'a.md': 'a2', 'b.md': 'b1' }]);
    a = notes.seedNote('a.md', 'a2');
    b = notes.seedNote('b.md', 'b1');
    restorer = new GitMtimeRestorer(notes);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('restore', () => {
    it('should set each file\'s modified time to its last commit time', async () => {
      await restorer.restore([a, b], history, () => {});
      expect(Object.fromEntries(notes.mtimeByPath)).toEqual({ 'a.md': 2000, 'b.md': 1000 });
    });

    it('should report restored and undated counts', async () => {
      notes.setContent('b.md', 'b edited');
      const run = await restorer.restore([a, b], history, () => {});
      expect(run).toEqual({ kind: 'done', outcome: { restored: 1, undated: 1, failedToWrite: 0 } });
    });

    it('should not touch a file edited since its last commit', async () => {
      notes.setContent('b.md', 'b edited');
      await restorer.restore([a, b], history, () => {});
      expect(notes.mtimeByPath.has('b.md')).toBe(false);
    });

    it('should leave content unchanged', async () => {
      await restorer.restore([a, b], history, () => {});
      expect([notes.getContent('a.md'), notes.getContent('b.md')]).toEqual(['a2', 'b1']);
    });

    it('should write nothing before the history walk has finished', async () => {
      // WHEN the walk reports progress, THEN no mtime has been written yet
      const writtenDuringWalk: number[] = [];
      await restorer.restore([a, b], history, () => writtenDuringWalk.push(notes.mtimeByPath.size));
      expect(writtenDuringWalk.every(n => n === 0)).toBe(true);
    });

    it('should skip a file edited while the history was being walked', async () => {
      // WHEN a.md is edited after hashing, mid-walk
      const run = await restorer.restore([a, b], history, () => notes.setContent('a.md', 'edited mid-walk'));
      // THEN a.md keeps its (real) new mtime and counts as undated
      expect({ written: [...notes.mtimeByPath.keys()], run }).toEqual({
        written: ['b.md'],
        run: { kind: 'done', outcome: { restored: 1, undated: 1, failedToWrite: 0 } },
      });
    });

    it('should write nothing when reading the history fails', async () => {
      vi.spyOn(history, 'readCommit').mockRejectedValue(new Error('corrupt object'));
      await expect(restorer.restore([a, b], history, () => {})).rejects.toThrow('corrupt object');
      expect(notes.mtimeByPath.size).toBe(0);
    });

    it('should report no commits for a repo without commits', async () => {
      history.clearHead();
      const run = await restorer.restore([a, b], history, () => {});
      expect(run.kind).toBe('noCommits');
    });

    it('should count a failed write and still restore the other files', async () => {
      notes.failingMtimeWrites.add('a.md');
      const run = await restorer.restore([a, b], history, () => {});
      expect({ written: [...notes.mtimeByPath.keys()], run }).toEqual({
        written: ['b.md'],
        run: { kind: 'done', outcome: { restored: 1, undated: 0, failedToWrite: 1 } },
      });
    });
  });
});
