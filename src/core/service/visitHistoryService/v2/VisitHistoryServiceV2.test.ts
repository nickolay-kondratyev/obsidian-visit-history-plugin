import { describe, expect, it, vi } from 'vitest';
import { VisitHistoryServiceV2 } from './VisitHistoryServiceV2';
import { VhV2FocusStore } from './VhV2FocusStore';
import { FakeHiddenFileUtil } from '../../../../testSupport/FakeHiddenFileUtil';
import { FakeDocIdService, FixedDeviceNameProvider } from '../../../../testSupport/fakes';
import { makeTFile } from '../../../../testSupport/fileFactory';

const DEVICE = 'mac';
const ISO_STAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface Setup {
  service: VisitHistoryServiceV2;
  docIdService: FakeDocIdService;
  hidden: FakeHiddenFileUtil;
}

function setup(): Setup {
  const docIdService = new FakeDocIdService();
  const hidden = new FakeHiddenFileUtil();
  const service = new VisitHistoryServiceV2(
    docIdService,
    new VhV2FocusStore(hidden),
    new FixedDeviceNameProvider(DEVICE),
  );
  return { service, docIdService, hidden };
}

/** Counts recorded stamp lines in the note's V2 focus file for DEVICE. */
function countStamps(hidden: FakeHiddenFileUtil, docId: string): number {
  const content = hidden.getContent(`.visit_history/v2/focus_per_device/${DEVICE}/${docId}.vh_v2`) ?? '';
  return content.split('\n').filter(line => ISO_STAMP_PATTERN.test(line)).length;
}

describe('VisitHistoryServiceV2', () => {
  describe('recordVisitNowOnFocus', () => {
    it('should append one ISO stamp to the doc-id-keyed V2 file', async () => {
      // GIVEN a note (id gets ensured on record)
      const { service, docIdService, hidden } = setup();
      const note = makeTFile({ path: 'notes/a.md' });
      docIdService.seedId(note.path, 'doc-a');
      // WHEN recording a visit
      await service.recordVisitNowOnFocus(note);
      // THEN exactly one stamp in the per-device doc file
      expect(countStamps(hidden, 'doc-a')).toBe(1);
    });

    it('should ensure the doc id (not require it pre-assigned)', async () => {
      // GIVEN a note without a seeded id
      const { service, docIdService } = setup();
      // WHEN recording
      await service.recordVisitNowOnFocus(makeTFile({ path: 'notes/a.md' }));
      // THEN the id was ensured through the service
      expect(docIdService.ensuredPaths).toEqual(['notes/a.md']);
    });

    it('should skip recording a consecutive duplicate focus on the same note', async () => {
      // GIVEN a note that was just recorded
      const { service, docIdService, hidden } = setup();
      const note = makeTFile({ path: 'notes/a.md' });
      docIdService.seedId(note.path, 'doc-a');
      await service.recordVisitNowOnFocus(note);
      // WHEN a duplicate focus event fires for the same note
      await service.recordVisitNowOnFocus(note);
      // THEN no second stamp is written (dedup of same-note event bursts)
      expect(countStamps(hidden, 'doc-a')).toBe(1);
    });

    it('should fully record an A -> B -> A navigation pathway', async () => {
      // GIVEN two notes
      const { service, docIdService, hidden } = setup();
      const noteA = makeTFile({ path: 'notes/a.md' });
      const noteB = makeTFile({ path: 'notes/b.md' });
      docIdService.seedId(noteA.path, 'doc-a');
      docIdService.seedId(noteB.path, 'doc-b');
      // WHEN navigating A -> B -> A
      await service.recordVisitNowOnFocus(noteA);
      await service.recordVisitNowOnFocus(noteB);
      await service.recordVisitNowOnFocus(noteA);
      // THEN both visits to A are recorded — pathway data is never dropped
      expect(countStamps(hidden, 'doc-a')).toBe(2);
    });

    it('should record nothing when the doc cannot carry an id', async () => {
      // GIVEN a doc the id service cannot handle
      const { service, docIdService, hidden } = setup();
      const note = makeTFile({ path: 'notes/broken.md' });
      docIdService.failingPaths.add(note.path);
      // WHEN recording
      await service.recordVisitNowOnFocus(note);
      // THEN no V2 file was written
      expect(hidden.allPaths()).toEqual([]);
    });

    it('should skip (with console.error, no write) a filename-unsafe doc id', async () => {
      // GIVEN a note whose EXISTING id contains a path separator
      const { service, docIdService, hidden } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const note = makeTFile({ path: 'notes/a.md' });
      docIdService.seedId(note.path, 'evil/../id');
      // WHEN recording
      await service.recordVisitNowOnFocus(note);
      // THEN nothing was written and the problem was logged
      expect({ paths: hidden.allPaths(), errors: errorSpy.mock.calls.length })
        .toEqual({ paths: [], errors: 1 });
      errorSpy.mockRestore();
    });
  });

  describe('getLastVisitStamp', () => {
    it('should return null for a never-visited note', async () => {
      // GIVEN a note with an id but no V2 files
      const { service, docIdService } = setup();
      const note = makeTFile({ path: 'notes/a.md' });
      docIdService.seedId(note.path, 'doc-a');
      // WHEN / THEN
      expect(await service.getLastVisitStamp(note)).toBeNull();
    });

    it('should return null (and never write an id) for a note without an id', async () => {
      // GIVEN a note with no id
      const { service, docIdService } = setup();
      // WHEN querying
      const stamp = await service.getLastVisitStamp(makeTFile({ path: 'notes/a.md' }));
      // THEN null, via the READ-ONLY id path (ensure was never called)
      expect({ stamp, ensured: docIdService.ensuredPaths }).toEqual({ stamp: null, ensured: [] });
    });

    it('should return the max stamp across devices', async () => {
      // GIVEN visits from two devices at different times
      const { service, docIdService, hidden } = setup();
      const note = makeTFile({ path: 'notes/a.md' });
      docIdService.seedId(note.path, 'doc-a');
      const older = '2026-01-01T00:00:00.000Z';
      const newer = '2026-06-01T00:00:00.000Z';
      hidden.seedFile('.visit_history/v2/focus_per_device/mac/doc-a.vh_v2', `${older}\n`);
      hidden.seedFile('.visit_history/v2/focus_per_device/phone/doc-a.vh_v2', `${newer}\n`);
      // WHEN / THEN the most recent across devices wins
      expect(await service.getLastVisitStamp(note)).toBe(Date.parse(newer));
    });

    it('should reflect a just-recorded visit', async () => {
      // GIVEN a visit was just recorded
      const { service, docIdService } = setup();
      const note = makeTFile({ path: 'notes/a.md' });
      docIdService.seedId(note.path, 'doc-a');
      const before = Date.now();
      await service.recordVisitNowOnFocus(note);
      // WHEN querying the last visit
      const stamp = await service.getLastVisitStamp(note);
      // THEN the recorded stamp is returned (write-through cache)
      expect(stamp).toBeGreaterThanOrEqual(before);
    });
  });
});
