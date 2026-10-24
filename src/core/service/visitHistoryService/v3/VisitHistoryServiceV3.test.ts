import { describe, expect, it } from 'vitest';
import { VisitHistoryServiceV3 } from './VisitHistoryServiceV3';
import { VhV3DurationStore } from './VhV3DurationStore';
import { VisitStatsCache } from './VisitStatsCache';
import { VisitStats } from '../VisitStats';
import { VhV3DurationRecorder } from '../../../focusDuration/VhV3DurationRecorder';
import { VhV3Paths } from './VhV3Paths';
import { FakeHiddenFileUtil } from '../../../../testSupport/FakeHiddenFileUtil';
import { FakeDocIdService, FixedDeviceNameProvider } from '../../../../testSupport/fakes';
import { Deferred } from '../../../../testSupport/Deferred';
import { makeTFile } from '../../../../testSupport/fileFactory';

const USER = 'alice';
const DOC_ID = 'docid_A_E';
const FILE = makeTFile({ path: 'notes/a.md' });

function sessionLine(iso: string, durationMs: number): string {
  return `${iso} D:${durationMs}\n`;
}

function setup(): {
  service: VisitHistoryServiceV3;
  hidden: FakeHiddenFileUtil;
  docIdService: FakeDocIdService;
  recorder: VhV3DurationRecorder;
} {
  const hidden = new FakeHiddenFileUtil();
  const docIdService = new FakeDocIdService();
  const cache = new VisitStatsCache();
  const store = new VhV3DurationStore(hidden);
  const service = new VisitHistoryServiceV3(docIdService, store, cache);
  // The real writer side of the cache protocol (begin → append → end).
  const recorder = new VhV3DurationRecorder(store, cache, new FixedDeviceNameProvider('host-a'), USER, () => undefined);
  return { service, hidden, docIdService, recorder };
}

describe('VisitHistoryServiceV3', () => {
  describe('getVisitStats', () => {
    it('should return EMPTY stats for a file without a doc id', async () => {
      // GIVEN a file with no doc id
      const { service } = setup();
      // WHEN looked up
      // THEN it was never visited
      expect(await service.getVisitStats(FILE)).toEqual(VisitStats.EMPTY);
    });

    it('should NOT write a doc id into the file (read-only lookup)', async () => {
      // GIVEN a file with no doc id
      const { service, docIdService } = setup();
      // WHEN looked up
      await service.getVisitStats(FILE);
      // THEN ensureDocId was never called — bulk reads must not modify user files
      expect(docIdService.ensuredPaths).toEqual([]);
    });

    it('should return the session start stamp from this device', async () => {
      // GIVEN one recorded session
      const { service, hidden, docIdService } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      hidden.seedFile(
        VhV3Paths.focusDurationFilePath(USER, 'host-a', DOC_ID),
        sessionLine('2026-07-09T22:02:15.745Z', 5600),
      );
      // WHEN looked up
      // THEN the session START is the last visit
      expect((await service.getVisitStats(FILE)).lastVisitMs).toBe(Date.parse('2026-07-09T22:02:15.745Z'));
    });

    it('should return the max session start across devices', async () => {
      // GIVEN sessions on two devices, newer one on host-b
      const { service, hidden, docIdService } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      hidden.seedFile(
        VhV3Paths.focusDurationFilePath(USER, 'host-a', DOC_ID),
        sessionLine('2026-07-09T10:00:00.000Z', 100),
      );
      hidden.seedFile(
        VhV3Paths.focusDurationFilePath(USER, 'host-b', DOC_ID),
        sessionLine('2026-07-10T10:00:00.000Z', 100),
      );
      // WHEN looked up
      // THEN the newest device's stamp wins
      expect((await service.getVisitStats(FILE)).lastVisitMs).toBe(Date.parse('2026-07-10T10:00:00.000Z'));
    });

    it('should serve a cached value without re-reading disk', async () => {
      // GIVEN a first lookup cached the last visit
      const { service, hidden, docIdService } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      const path = VhV3Paths.focusDurationFilePath(USER, 'host-a', DOC_ID);
      hidden.seedFile(path, sessionLine('2026-07-09T10:00:00.000Z', 100));
      const first = await service.getVisitStats(FILE);
      // WHEN the on-disk file changes behind the cache
      hidden.seedFile(path, sessionLine('2026-07-10T10:00:00.000Z', 100));
      // THEN the second lookup still serves the cached value
      expect(await service.getVisitStats(FILE)).toEqual(first);
    });

    it('should cache a "never visited" (EMPTY) miss result too', async () => {
      // GIVEN a first lookup that found no VH files
      const { service, hidden, docIdService } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      await service.getVisitStats(FILE);
      // WHEN a session appears on disk behind the cache
      hidden.seedFile(
        VhV3Paths.focusDurationFilePath(USER, 'host-a', DOC_ID),
        sessionLine('2026-07-09T10:00:00.000Z', 100),
      );
      // THEN the cached EMPTY is served (live updates arrive via write-through)
      expect(await service.getVisitStats(FILE)).toEqual(VisitStats.EMPTY);
    });

    it('should return the total focus time summed over all sessions', async () => {
      // GIVEN two recorded sessions
      const { service, hidden, docIdService } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      hidden.seedFile(
        VhV3Paths.focusDurationFilePath(USER, 'host-a', DOC_ID),
        sessionLine('2026-07-09T10:00:00.000Z', 100) + sessionLine('2026-07-09T11:00:00.000Z', 250),
      );
      // WHEN looked up
      // THEN the durations are summed
      expect((await service.getVisitStats(FILE)).totalFocusMs).toBe(350);
    });

    it('should serve a session written through to a cached entry', async () => {
      // GIVEN a cached lookup over one session
      const { service, hidden, docIdService, recorder } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      hidden.seedFile(
        VhV3Paths.focusDurationFilePath(USER, 'host-a', DOC_ID),
        sessionLine('2026-07-09T10:00:00.000Z', 100),
      );
      await service.getVisitStats(FILE);
      // WHEN a newer session is recorded
      const newerStartMs = Date.parse('2026-07-10T10:00:00.000Z');
      recorder.recordFocusDuration(DOC_ID, newerStartMs, 50);
      await recorder.flush();
      // THEN the lookup reflects it
      expect(await service.getVisitStats(FILE)).toEqual({ lastVisitMs: newerStartMs, totalFocusMs: 150 });
    });

    it('should read the full history from disk when a session was recorded on a cache miss', async () => {
      // GIVEN one session on disk and nothing cached
      const { service, hidden, docIdService, recorder } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      hidden.seedFile(
        VhV3Paths.focusDurationFilePath(USER, 'host-a', DOC_ID),
        sessionLine('2026-07-09T10:00:00.000Z', 100),
      );
      // WHEN another session is recorded, then looked up
      recorder.recordFocusDuration(DOC_ID, Date.parse('2026-07-10T10:00:00.000Z'), 50);
      await recorder.flush();
      // THEN both sessions count (no one-session total was cached)
      expect((await service.getVisitStats(FILE)).totalFocusMs).toBe(150);
    });

    it('should not cache a disk read that overlapped a session write (next lookup sees the session)', async () => {
      // GIVEN a cache-miss lookup whose disk read snapshots the file, then stalls
      const { service, hidden, docIdService, recorder } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      hidden.seedFile(
        VhV3Paths.focusDurationFilePath(USER, 'host-a', DOC_ID),
        sessionLine('2026-07-09T10:00:00.000Z', 100),
      );
      const readStarted = new Deferred();
      const releaseRead = new Deferred();
      const originalRead = hidden.readIfExists.bind(hidden);
      hidden.readIfExists = async (filePath: string) => {
        hidden.readIfExists = originalRead; // stall only this first read
        const snapshot = await originalRead(filePath);
        readStarted.resolve();
        await releaseRead.promise;
        return snapshot;
      };
      const staleLookup = service.getVisitStats(FILE);
      await readStarted.promise;
      // WHEN a session is recorded while the read is in flight, then the read completes
      recorder.recordFocusDuration(DOC_ID, Date.parse('2026-07-10T10:00:00.000Z'), 50);
      await recorder.flush();
      releaseRead.resolve();
      await staleLookup;
      // THEN the stale result was not cached — the next lookup counts the new session exactly once
      expect((await service.getVisitStats(FILE)).totalFocusMs).toBe(150);
    });
  });
});
