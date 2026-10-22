import { describe, expect, it } from 'vitest';
import { VhV3HistoryMerger } from './VhV3HistoryMerger';
import { VisitStatsCache } from './VisitStatsCache';
import { VisitStats } from '../VisitStats';
import { FakeHiddenFileUtil } from '../../../../testSupport/FakeHiddenFileUtil';

const NOTE0 = 'docid_note0_e';
const NOTE1 = 'docid_note1_e';
const NOTE2 = 'docid_note2_e';
const USER_ROOT = '.plugin_data/visit_history/user';
const LINE = '2026-07-09T10:00:00.000Z D:100\n';

function ownFile(user: string, device: string, docId: string): string {
  return `${USER_ROOT}/${user}/v3/focus_duration_per_device/${device}/${docId}.vh_v3`;
}

function mergedDir(user: string, device: string, receivingDocId: string): string {
  return `${USER_ROOT}/${user}/v3/merged_in_focus_duration_per_device/${device}/${receivingDocId}`;
}

function setup(): { merger: VhV3HistoryMerger; hidden: FakeHiddenFileUtil; cache: VisitStatsCache } {
  const hidden = new FakeHiddenFileUtil();
  const cache = new VisitStatsCache();
  return { merger: new VhV3HistoryMerger(hidden, cache), hidden, cache };
}

/** Rename always fails — simulates a DataAdapter IO error mid-move. */
class FailingRenameHiddenFileUtil extends FakeHiddenFileUtil {
  override async rename(_fromPath: string, _toPath: string): Promise<void> {
    throw new Error('simulated rename failure');
  }
}

describe('VhV3HistoryMerger', () => {
  describe('mergeInto', () => {
    it('should move the absorbed doc own file under the receiving doc merged-in dir', async () => {
      // GIVEN note2 history on one device
      const { merger, hidden } = setup();
      hidden.seedFile(ownFile('alice', 'host', NOTE2), LINE);
      // WHEN note2 is merged into note1
      await merger.mergeInto(NOTE2, NOTE1);
      // THEN the file sits unmodified under note1's merged-in dir
      expect(hidden.getContent(`${mergedDir('alice', 'host', NOTE1)}/${NOTE2}.vh_v3`)).toBe(LINE);
    });

    it('should remove the file from its old location (moved, not copied)', async () => {
      // GIVEN note2 history on one device
      const { merger, hidden } = setup();
      hidden.seedFile(ownFile('alice', 'host', NOTE2), LINE);
      // WHEN merged
      await merger.mergeInto(NOTE2, NOTE1);
      // THEN the old path is gone
      expect(hidden.getContent(ownFile('alice', 'host', NOTE2))).toBeUndefined();
    });

    it('should keep every user and device in its own merged-in dir', async () => {
      // GIVEN note2 history for two users on different devices
      const { merger, hidden } = setup();
      hidden.seedFile(ownFile('alice', 'host-a', NOTE2), 'a\n');
      hidden.seedFile(ownFile('bob', 'host-b', NOTE2), 'b\n');
      // WHEN merged
      await merger.mergeInto(NOTE2, NOTE1);
      // THEN each lands under its own user + device
      expect([
        hidden.getContent(`${mergedDir('alice', 'host-a', NOTE1)}/${NOTE2}.vh_v3`),
        hidden.getContent(`${mergedDir('bob', 'host-b', NOTE1)}/${NOTE2}.vh_v3`),
      ]).toEqual(['a\n', 'b\n']);
    });

    it('should flatten a chain: files already merged into the absorbed doc move one level up', async () => {
      // GIVEN note1 holding merged-in note2 history
      const { merger, hidden } = setup();
      hidden.seedFile(`${mergedDir('alice', 'host', NOTE1)}/${NOTE2}.vh_v3`, LINE);
      // WHEN note1 is merged into note0
      await merger.mergeInto(NOTE1, NOTE0);
      // THEN note2's file sits directly under note0's merged-in dir
      expect(hidden.getContent(`${mergedDir('alice', 'host', NOTE0)}/${NOTE2}.vh_v3`)).toBe(LINE);
    });

    it('should leave nothing under the absorbed doc merged-in dir after flattening', async () => {
      // GIVEN note1 holding merged-in note2 history
      const { merger, hidden } = setup();
      hidden.seedFile(`${mergedDir('alice', 'host', NOTE1)}/${NOTE2}.vh_v3`, LINE);
      // WHEN note1 is merged into note0
      await merger.mergeInto(NOTE1, NOTE0);
      // THEN no file remains under note1's merged-in dir
      expect(hidden.allPaths().filter(path => path.startsWith(`${mergedDir('alice', 'host', NOTE1)}/`)))
        .toEqual([]);
    });

    it('should move both own and merged-in files of the absorbed doc in a chain', async () => {
      // GIVEN note1 with own history AND merged-in note2 history
      const { merger, hidden } = setup();
      hidden.seedFile(ownFile('alice', 'host', NOTE1), 'own\n');
      hidden.seedFile(`${mergedDir('alice', 'host', NOTE1)}/${NOTE2}.vh_v3`, 'merged\n');
      // WHEN note1 is merged into note0
      const movedCount = await merger.mergeInto(NOTE1, NOTE0);
      // THEN both files moved
      expect(movedCount).toBe(2);
    });

    it('should add a numbered suffix on a name collision instead of overwriting', async () => {
      // GIVEN note1 already holding a merged-in file named after note2 (note2 inlined before)
      const { merger, hidden } = setup();
      hidden.seedFile(`${mergedDir('alice', 'host', NOTE1)}/${NOTE2}.vh_v3`, 'first\n');
      hidden.seedFile(ownFile('alice', 'host', NOTE2), 'second\n');
      // WHEN note2 is merged into note1 again
      await merger.mergeInto(NOTE2, NOTE1);
      // THEN the new file gets the __2 suffix
      expect(hidden.getContent(`${mergedDir('alice', 'host', NOTE1)}/${NOTE2}__2.vh_v3`)).toBe('second\n');
    });

    it('should keep the colliding existing file untouched', async () => {
      // GIVEN an existing merged-in file with the same name
      const { merger, hidden } = setup();
      hidden.seedFile(`${mergedDir('alice', 'host', NOTE1)}/${NOTE2}.vh_v3`, 'first\n');
      hidden.seedFile(ownFile('alice', 'host', NOTE2), 'second\n');
      // WHEN merged
      await merger.mergeInto(NOTE2, NOTE1);
      // THEN the original is unchanged
      expect(hidden.getContent(`${mergedDir('alice', 'host', NOTE1)}/${NOTE2}.vh_v3`)).toBe('first\n');
    });

    it('should pick the next free suffix when __2 is taken too', async () => {
      // GIVEN both the plain and __2 names taken
      const { merger, hidden } = setup();
      hidden.seedFile(`${mergedDir('alice', 'host', NOTE1)}/${NOTE2}.vh_v3`, 'first\n');
      hidden.seedFile(`${mergedDir('alice', 'host', NOTE1)}/${NOTE2}__2.vh_v3`, 'second\n');
      hidden.seedFile(ownFile('alice', 'host', NOTE2), 'third\n');
      // WHEN merged
      await merger.mergeInto(NOTE2, NOTE1);
      // THEN __3 is used
      expect(hidden.getContent(`${mergedDir('alice', 'host', NOTE1)}/${NOTE2}__3.vh_v3`)).toBe('third\n');
    });

    it('should not touch history of unrelated docs', async () => {
      // GIVEN another doc's file next to note2's
      const { merger, hidden } = setup();
      hidden.seedFile(ownFile('alice', 'host', NOTE2), LINE);
      hidden.seedFile(ownFile('alice', 'host', NOTE0), 'other\n');
      // WHEN note2 is merged into note1
      await merger.mergeInto(NOTE2, NOTE1);
      // THEN the unrelated file stays where it was
      expect(hidden.getContent(ownFile('alice', 'host', NOTE0))).toBe('other\n');
    });

    it('should move nothing when the absorbed doc has no history', async () => {
      // GIVEN no note2 history at all
      const { merger, hidden } = setup();
      hidden.seedFile(ownFile('alice', 'host', NOTE0), 'other\n');
      // WHEN merged
      // THEN zero files moved
      expect(await merger.mergeInto(NOTE2, NOTE1)).toBe(0);
    });

    it('should refuse to merge a doc into itself', async () => {
      const { merger } = setup();
      await expect(merger.mergeInto(NOTE1, NOTE1)).rejects.toThrow('into itself');
    });

    it('should refuse an absorbed id that is not filename-safe', async () => {
      const { merger } = setup();
      await expect(merger.mergeInto('a/b', NOTE1)).rejects.toThrow('not filename-safe');
    });

    it('should refuse a receiving id that is not filename-safe', async () => {
      const { merger } = setup();
      await expect(merger.mergeInto(NOTE2, 'a/b')).rejects.toThrow('not filename-safe');
    });

    it('should drop the receiving doc cached stats so the heatmap re-reads them', async () => {
      // GIVEN cached stats for note1
      const { merger, hidden, cache } = setup();
      cache.setIfNoWriteSince(NOTE1, new VisitStats(1, 1), cache.readToken());
      hidden.seedFile(ownFile('alice', 'host', NOTE2), LINE);
      // WHEN note2 is merged into note1
      await merger.mergeInto(NOTE2, NOTE1);
      // THEN note1's entry is gone
      expect(cache.get(NOTE1)).toBeUndefined();
    });

    it('should drop the absorbed doc cached stats', async () => {
      // GIVEN cached stats for note2
      const { merger, hidden, cache } = setup();
      cache.setIfNoWriteSince(NOTE2, new VisitStats(1, 1), cache.readToken());
      hidden.seedFile(ownFile('alice', 'host', NOTE2), LINE);
      // WHEN merged
      await merger.mergeInto(NOTE2, NOTE1);
      // THEN note2's entry is gone
      expect(cache.get(NOTE2)).toBeUndefined();
    });

    it('should still drop cached stats when a move fails', async () => {
      // GIVEN cached note1 stats and a failing file system
      const hidden = new FailingRenameHiddenFileUtil();
      const cache = new VisitStatsCache();
      cache.setIfNoWriteSince(NOTE1, new VisitStats(1, 1), cache.readToken());
      hidden.seedFile(ownFile('alice', 'host', NOTE2), LINE);
      // WHEN the merge fails
      await expect(new VhV3HistoryMerger(hidden, cache).mergeInto(NOTE2, NOTE1)).rejects.toThrow();
      // THEN nothing stale survives in the cache
      expect(cache.get(NOTE1)).toBeUndefined();
    });
  });
});
