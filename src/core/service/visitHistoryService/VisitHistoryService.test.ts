import { describe, expect, it } from 'vitest';
import { VisitHistoryServiceDefault } from './VisitHistoryService';
import { VHFileProvider } from '../../focusTracker/listener/VHFileProvider';
import { FakeNoteFileUtil } from '../../../testSupport/FakeNoteFileUtil';
import { FakeLinkUtil, FakeUserNotifier, FixedDeviceNameProvider } from '../../../testSupport/fakes';
import { makeTFile } from '../../../testSupport/fileFactory';

const ISO_STAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function givenService() {
  const linkUtil = new FakeLinkUtil();
  const noteFileUtil = new FakeNoteFileUtil();
  const vhFileProvider = new VHFileProvider(
    linkUtil,
    new FakeUserNotifier(),
    noteFileUtil,
    new FixedDeviceNameProvider('mac'),
  );
  const service = new VisitHistoryServiceDefault(vhFileProvider, noteFileUtil);
  return { service, linkUtil, noteFileUtil };
}

/** Counts recorded stamp lines across ALL VH files a note's visits went to. */
function countStamps(noteFileUtil: FakeNoteFileUtil, vhPath: string): number {
  return (noteFileUtil.getContent(vhPath) ?? '')
    .split('\n')
    .filter(line => ISO_STAMP_PATTERN.test(line))
    .length;
}

describe('VisitHistoryServiceDefault', () => {
  describe('recordVisitNowOnFocus', () => {
    it('should append an ISO 8601 stamp to the VH file', async () => {
      // GIVEN a note with no VH file yet
      const { service, noteFileUtil } = givenService();
      const note = makeTFile({ path: 'notes/a.md' });
      // WHEN recording a visit
      await service.recordVisitNowOnFocus(note);
      // THEN the (created) VH file contains exactly one ISO stamp
      const vhPath = vhPathOf(note, noteFileUtil);
      expect(countStamps(noteFileUtil, vhPath)).toBe(1);
    });

    it('should skip recording a consecutive duplicate focus on the same note', async () => {
      // GIVEN a note that was just recorded
      const { service, noteFileUtil } = givenService();
      const note = makeTFile({ path: 'notes/a.md' });
      await service.recordVisitNowOnFocus(note);
      // WHEN a duplicate focus event fires for the same note
      await service.recordVisitNowOnFocus(note);
      // THEN no second stamp is written (dedup of same-note event bursts)
      const vhPath = vhPathOf(note, noteFileUtil);
      expect(countStamps(noteFileUtil, vhPath)).toBe(1);
    });

    it('should fully record an A -> B -> A navigation pathway', async () => {
      // GIVEN two notes
      const { service, noteFileUtil } = givenService();
      const noteA = makeTFile({ path: 'notes/a.md' });
      const noteB = makeTFile({ path: 'notes/b.md' });
      // WHEN navigating A -> B -> A
      await service.recordVisitNowOnFocus(noteA);
      await service.recordVisitNowOnFocus(noteB);
      await service.recordVisitNowOnFocus(noteA);
      // THEN both visits to A are recorded — pathway data is never dropped
      const vhPathA = vhPathOf(noteA, noteFileUtil);
      expect(countStamps(noteFileUtil, vhPathA)).toBe(2);
    });
  });

  describe('getLastVisitStamp', () => {
    it('should return null for a note with no VH files', async () => {
      // GIVEN a note with no backlinks at all
      const { service } = givenService();
      // WHEN querying the last visit
      const stamp = await service.getLastVisitStamp(makeTFile({ path: 'notes/a.md' }));
      // THEN null (never visited)
      expect(stamp).toBeNull();
    });

    it('should return the max stamp across VH files from multiple devices', async () => {
      // GIVEN two devices recorded visits at different times
      const { service, linkUtil, noteFileUtil } = givenService();
      const older = '2026-01-01T00:00:00.000Z';
      const newer = '2026-06-01T00:00:00.000Z';
      seedVhFile(linkUtil, noteFileUtil, '_visit_history/v1/focus/mac/_vh_01A.md', [older]);
      seedVhFile(linkUtil, noteFileUtil, '_visit_history/v1/focus/phone/_vh_01B.md', [newer]);
      // WHEN querying the last visit
      const stamp = await service.getLastVisitStamp(makeTFile({ path: 'notes/a.md' }));
      // THEN the most recent stamp across devices wins
      expect(stamp).toBe(Date.parse(newer));
    });

    it('should ignore a header-only VH file and still use the other device stamp', async () => {
      // GIVEN one stamp-less (freshly created) VH file and one with a stamp
      const { service, linkUtil, noteFileUtil } = givenService();
      const stampIso = '2026-06-01T00:00:00.000Z';
      seedVhFile(linkUtil, noteFileUtil, '_visit_history/v1/focus/mac/_vh_01A.md', []);
      seedVhFile(linkUtil, noteFileUtil, '_visit_history/v1/focus/phone/_vh_01B.md', [stampIso]);
      // WHEN querying the last visit
      const stamp = await service.getLastVisitStamp(makeTFile({ path: 'notes/a.md' }));
      // THEN the stamp-less file does not break or poison the aggregation
      expect(stamp).toBe(Date.parse(stampIso));
    });

    it('should return null when all VH files are header-only', async () => {
      // GIVEN only a stamp-less VH file
      const { service, linkUtil, noteFileUtil } = givenService();
      seedVhFile(linkUtil, noteFileUtil, '_visit_history/v1/focus/mac/_vh_01A.md', []);
      // WHEN querying the last visit
      const stamp = await service.getLastVisitStamp(makeTFile({ path: 'notes/a.md' }));
      // THEN null instead of -Infinity or a throw
      expect(stamp).toBeNull();
    });

    it('should reflect a just-recorded visit', async () => {
      // GIVEN a visit was just recorded
      const { service } = givenService();
      const note = makeTFile({ path: 'notes/a.md' });
      const before = Date.now();
      await service.recordVisitNowOnFocus(note);
      // WHEN querying the last visit
      const stamp = await service.getLastVisitStamp(note);
      // THEN the recorded stamp is returned (write-through cache)
      expect(stamp).toBeGreaterThanOrEqual(before);
    });
  });
});

// ── helpers ─────────────────────────────────────────────────────────────────

function seedVhFile(
  linkUtil: FakeLinkUtil,
  noteFileUtil: FakeNoteFileUtil,
  vhPath: string,
  isoStamps: string[],
): void {
  linkUtil.addBacklinkFromPath(vhPath);
  noteFileUtil.seedNote(
    vhPath,
    'VISIT_HISTORY_V1_FOR:[[notes/a.md]]\n### VISIT_HISTORY_V1:\n' + isoStamps.map(s => s + '\n').join(''),
  );
}

/** Resolves the VH file path a note's visits were recorded to (created file). */
function vhPathOf(note: ReturnType<typeof makeTFile>, noteFileUtil: FakeNoteFileUtil): string {
  // The FakeNoteFileUtil has exactly the files created by the provider; find
  // the one embedding this note's backlink.
  const vhPath = noteFileUtil.findPathContaining(`VISIT_HISTORY_V1_FOR:[[${note.path}]]`);
  if (!vhPath) throw new Error(`No VH file recorded for ${note.path}`);
  return vhPath;
}
