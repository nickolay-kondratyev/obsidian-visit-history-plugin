import { describe, expect, it } from 'vitest';
import { VisitHistoryServiceV3 } from './VisitHistoryServiceV3';
import { VhV3DurationStore } from './VhV3DurationStore';
import { LastVisitCache } from './LastVisitCache';
import { VhV3Paths } from './VhV3Paths';
import { FakeHiddenFileUtil } from '../../../../testSupport/FakeHiddenFileUtil';
import { FakeDocIdService } from '../../../../testSupport/fakes';
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
  cache: LastVisitCache;
} {
  const hidden = new FakeHiddenFileUtil();
  const docIdService = new FakeDocIdService();
  const cache = new LastVisitCache();
  const service = new VisitHistoryServiceV3(
    docIdService,
    new VhV3DurationStore(hidden, USER),
    cache,
  );
  return { service, hidden, docIdService, cache };
}

describe('VisitHistoryServiceV3', () => {
  describe('getLastVisitStamp', () => {
    it('should return null for a file without a doc id', async () => {
      // GIVEN a file with no doc id
      const { service } = setup();
      // WHEN looked up
      // THEN it was never visited
      expect(await service.getLastVisitStamp(FILE)).toBeNull();
    });

    it('should NOT write a doc id into the file (read-only lookup)', async () => {
      // GIVEN a file with no doc id
      const { service, docIdService } = setup();
      // WHEN looked up
      await service.getLastVisitStamp(FILE);
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
      expect(await service.getLastVisitStamp(FILE)).toBe(Date.parse('2026-07-09T22:02:15.745Z'));
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
      expect(await service.getLastVisitStamp(FILE)).toBe(Date.parse('2026-07-10T10:00:00.000Z'));
    });

    it('should serve a cached value without re-reading disk', async () => {
      // GIVEN a first lookup cached the last visit
      const { service, hidden, docIdService } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      const path = VhV3Paths.focusDurationFilePath(USER, 'host-a', DOC_ID);
      hidden.seedFile(path, sessionLine('2026-07-09T10:00:00.000Z', 100));
      const first = await service.getLastVisitStamp(FILE);
      // WHEN the on-disk file changes behind the cache
      hidden.seedFile(path, sessionLine('2026-07-10T10:00:00.000Z', 100));
      // THEN the second lookup still serves the cached value
      expect(await service.getLastVisitStamp(FILE)).toBe(first);
    });

    it('should cache a "never visited" (null) miss result too', async () => {
      // GIVEN a first lookup that found no VH files
      const { service, hidden, docIdService } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      await service.getLastVisitStamp(FILE);
      // WHEN a session appears on disk behind the cache
      hidden.seedFile(
        VhV3Paths.focusDurationFilePath(USER, 'host-a', DOC_ID),
        sessionLine('2026-07-09T10:00:00.000Z', 100),
      );
      // THEN the cached null is served (live updates arrive via write-through)
      expect(await service.getLastVisitStamp(FILE)).toBeNull();
    });

    it('should not lose a write-through that lands during the disk read (merge by max)', async () => {
      // GIVEN a cache-miss lookup whose disk read is in flight when a newer
      // write-through lands
      const { service, hidden, docIdService, cache } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      const diskStampMs = Date.parse('2026-07-09T10:00:00.000Z');
      hidden.seedFile(
        VhV3Paths.focusDurationFilePath(USER, 'host-a', DOC_ID),
        sessionLine('2026-07-09T10:00:00.000Z', 100),
      );
      const originalRead = hidden.readIfExists.bind(hidden);
      hidden.readIfExists = async (filePath: string) => {
        cache.noteVisit(DOC_ID, diskStampMs + 1); // write-through mid-read
        return originalRead(filePath);
      };
      // WHEN the lookup completes
      // THEN the newer write-through wins over the older disk value
      expect(await service.getLastVisitStamp(FILE)).toBe(diskStampMs + 1);
    });

    it('should see a recorder write-through without any disk data', async () => {
      // GIVEN a write-through landed before the first lookup
      const { service, docIdService, cache } = setup();
      docIdService.seedId(FILE.path, DOC_ID);
      cache.noteVisit(DOC_ID, 5000);
      // WHEN looked up
      // THEN the written-through visit is served
      expect(await service.getLastVisitStamp(FILE)).toBe(5000);
    });
  });
});
