import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { TFile } from 'obsidian';
import { RecordTimeDocIdResolver, VhV3DurationRecorder } from './VhV3DurationRecorder';
import { VhV3DurationStore } from '../service/visitHistoryService/v3/VhV3DurationStore';
import { VisitStatsCache } from '../service/visitHistoryService/v3/VisitStatsCache';
import { VisitStats } from '../service/visitHistoryService/VisitStats';
import { FakeHiddenFileUtil } from '../../testSupport/FakeHiddenFileUtil';
import { FakeDocIdService, FixedDeviceNameProvider } from '../../testSupport/fakes';
import { Deferred } from '../../testSupport/Deferred';
import { makeTFile } from '../../testSupport/fileFactory';

const USER = 'alice';
const DEVICE = 'my-host';
const DEVICE_DIR = `.plugin_data/visit_history/user/${USER}/v3/focus_duration_per_device/${DEVICE}`;
const DOC_ID = 'docid_A_E';
const DOC_FILE = `${DEVICE_DIR}/${DOC_ID}.vh_v3`;
const STAMP_1 = '2026-07-09T22:02:15.745Z';
const STAMP_2 = '2026-07-09T22:02:16.000Z';

/**
 * Mirrors HiddenFileUtilDefault.append's NON-atomic shape: exists-check, a
 * yield (real adapter IO), then append-or-CREATE. Two unserialized appends
 * to a new file both see "absent" and the second create overwrites the first.
 */
class CheckThenWriteHiddenFileUtil extends FakeHiddenFileUtil {
  override async append(filePath: string, content: string): Promise<void> {
    const existed = await this.exists(filePath);
    await Promise.resolve();
    if (existed) {
      await super.append(filePath, content);
    } else {
      await this.write(filePath, content);
    }
  }
}

/** Fails the FIRST append only — a transient IO failure. */
class FailFirstAppendHiddenFileUtil extends FakeHiddenFileUtil {
  private failedOnce = false;

  override async append(filePath: string, content: string): Promise<void> {
    if (!this.failedOnce) {
      this.failedOnce = true;
      throw new Error('simulated transient append failure');
    }
    await super.append(filePath, content);
  }
}

interface SetupOptions {
  hidden?: FakeHiddenFileUtil;
  /** Overrides the default resolver (FakeDocIdService.ensureDocId). */
  resolveDocId?: RecordTimeDocIdResolver;
}

/** GIVEN a recorder; `file` (notes/a.md) already carries DOC_ID. */
function setup(options: SetupOptions = {}): {
  recorder: VhV3DurationRecorder;
  hidden: FakeHiddenFileUtil;
  cache: VisitStatsCache;
  docIds: FakeDocIdService;
  file: TFile;
  onSessionPersisted: ReturnType<typeof vi.fn>;
} {
  const hidden = options.hidden ?? new FakeHiddenFileUtil();
  const cache = new VisitStatsCache();
  const docIds = new FakeDocIdService();
  const file = makeTFile({ path: 'notes/a.md' });
  docIds.seedId(file.path, DOC_ID);
  const onSessionPersisted = vi.fn();
  const recorder = new VhV3DurationRecorder(
    new VhV3DurationStore(hidden),
    cache,
    new FixedDeviceNameProvider(DEVICE),
    USER,
    options.resolveDocId ?? ((f) => docIds.ensureDocId(f)),
    onSessionPersisted,
  );
  return { recorder, hidden, cache, docIds, file, onSessionPersisted };
}

describe('VhV3DurationRecorder', () => {
  describe('recordFocusDuration', () => {
    it('should persist the session under this device with the V3 line format', async () => {
      // GIVEN a recorder
      const { recorder, hidden, file } = setup();
      // WHEN a session is recorded
      recorder.recordFocusDuration(file, Date.parse(STAMP_1), 5600);
      await recorder.flush();
      // THEN the store holds the formatted line
      expect(hidden.getContent(DOC_FILE)).toBe(`${STAMP_1} D:5600\n`);
    });

    it('should serialize rapid records so both lines land in order', async () => {
      // GIVEN a recorder
      const { recorder, hidden, file } = setup();
      // WHEN two sessions are recorded back-to-back without awaiting
      recorder.recordFocusDuration(file, Date.parse(STAMP_1), 100);
      recorder.recordFocusDuration(file, Date.parse(STAMP_2), 200);
      await recorder.flush();
      // THEN both lines are present in call order
      expect(hidden.getContent(DOC_FILE)).toBe(`${STAMP_1} D:100\n${STAMP_2} D:200\n`);
    });

    it('should land both sessions for the SAME new doc when the append is check-then-write (racy IO)', async () => {
      // GIVEN a recorder over an append that yields between its exists-check and its write
      const { recorder, hidden, file } = setup({ hidden: new CheckThenWriteHiddenFileUtil() });
      // WHEN two sessions for a doc with no file yet are recorded back-to-back without awaiting
      recorder.recordFocusDuration(file, Date.parse(STAMP_1), 100);
      recorder.recordFocusDuration(file, Date.parse(STAMP_2), 200);
      await recorder.flush();
      // THEN neither create overwrote the other — the write chain serialized them
      expect(hidden.getContent(DOC_FILE)).toBe(`${STAMP_1} D:100\n${STAMP_2} D:200\n`);
    });

    it('should keep recording after a failed write (error isolation)', async () => {
      // GIVEN the first append fails
      const { recorder, hidden, file } = setup({ hidden: new FailFirstAppendHiddenFileUtil() });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      recorder.recordFocusDuration(file, 0, 1);
      // WHEN a record follows
      recorder.recordFocusDuration(file, Date.parse(STAMP_1), 5600);
      await recorder.flush();
      // THEN the following record was still written
      expect(hidden.getContent(DOC_FILE)).toBe(`${STAMP_1} D:5600\n`);
      errorSpy.mockRestore();
    });

    it('should merge the session into cached visit stats', async () => {
      // GIVEN cached stats for the doc
      const { recorder, cache, file } = setup();
      cache.setIfNoWriteSince(DOC_ID, new VisitStats(1000, 300), cache.readToken());
      // WHEN a session is recorded and persisted
      const startMs = Date.parse(STAMP_1);
      recorder.recordFocusDuration(file, startMs, 5600);
      await recorder.flush();
      // THEN the cache serves the new last visit and total without a disk read
      expect(cache.get(DOC_ID)).toEqual({ lastVisitMs: startMs, totalFocusMs: 5900 });
    });

    it('should NOT create cached stats for a doc that was not cached', async () => {
      // GIVEN an empty cache
      const { recorder, cache, file } = setup();
      // WHEN a session is recorded and persisted
      recorder.recordFocusDuration(file, Date.parse(STAMP_1), 5600);
      await recorder.flush();
      // THEN no one-session total is invented (next lookup reads disk)
      expect(cache.get(DOC_ID)).toBeUndefined();
    });

    it('should invalidate cached stats when the write fails', async () => {
      // GIVEN cached stats for a doc whose write will fail
      const { recorder, hidden, cache, file } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      cache.setIfNoWriteSince(DOC_ID, new VisitStats(1000, 300), cache.readToken());
      hidden.append = async () => {
        throw new Error('disk full');
      };
      // WHEN a session is recorded
      recorder.recordFocusDuration(file, 2000, 50);
      await recorder.flush();
      // THEN the entry is dropped — no merge of a session that failed to persist
      expect(cache.get(DOC_ID)).toBeUndefined();
      errorSpy.mockRestore();
    });

    it('should log the failed write', async () => {
      // GIVEN a write that will fail
      const { recorder, hidden, file } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      hidden.append = async () => {
        throw new Error('disk full');
      };
      // WHEN a session is recorded
      recorder.recordFocusDuration(file, 2000, 50);
      await recorder.flush();
      // THEN the failure is reported
      expect(errorSpy).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
    });

    it('should notify once the session is persisted', async () => {
      // GIVEN a recorder
      const { recorder, onSessionPersisted, file } = setup();
      // WHEN a session is recorded and persisted
      recorder.recordFocusDuration(file, Date.parse(STAMP_1), 5600);
      await recorder.flush();
      // THEN the persisted-session listener is told (e.g. so open heatmaps re-render)
      expect(onSessionPersisted).toHaveBeenCalledTimes(1);
    });

    it('should NOT notify when the write fails', async () => {
      // GIVEN a write that will fail
      const { recorder, hidden, onSessionPersisted, file } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      hidden.append = async () => {
        throw new Error('disk full');
      };
      // WHEN a session is recorded
      recorder.recordFocusDuration(file, 2000, 50);
      await recorder.flush();
      // THEN no listener is told about a visit that never landed
      expect(onSessionPersisted).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should accept fresh cache reads again after a failed write', async () => {
      // GIVEN a failed write (write window must not stay open)
      const { recorder, hidden, cache, file } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      hidden.append = async () => {
        throw new Error('disk full');
      };
      recorder.recordFocusDuration(file, 2000, 50);
      await recorder.flush();
      // WHEN a fresh read result is offered
      // THEN it is cached
      expect(cache.setIfNoWriteSince(DOC_ID, VisitStats.EMPTY, cache.readToken())).toBe(true);
      errorSpy.mockRestore();
    });
  });

  describe('recordFocusDuration — record-time doc id', () => {
    it('should assign a missing doc id when the session is recorded', async () => {
      // GIVEN a file with no doc id yet
      const { recorder, docIds } = setup();
      const idLess = makeTFile({ path: 'notes/new.md' });
      // WHEN a session for it is recorded
      recorder.recordFocusDuration(idLess, Date.parse(STAMP_1), 100);
      await recorder.flush();
      // THEN the id was ensured (assigned) for that file
      expect(docIds.ensuredPaths).toEqual(['notes/new.md']);
    });

    it('should append the session under the id assigned at record time', async () => {
      // GIVEN a file with no doc id yet (the fake assigns `docid-for-<path>`)
      const { recorder, hidden } = setup();
      const idLess = makeTFile({ path: 'notes/new.md' });
      // WHEN a session for it is recorded
      recorder.recordFocusDuration(idLess, Date.parse(STAMP_1), 100);
      await recorder.flush();
      // THEN the line landed in the file named by the new id
      expect(hidden.getContent(`${DEVICE_DIR}/docid-for-notes_new.md.vh_v3`)).toBe(`${STAMP_1} D:100\n`);
    });

    it('should drop the session when the file cannot carry an id', async () => {
      // GIVEN a raw .excalidraw file (no id location → null id)
      const { recorder, hidden } = setup();
      const drawing = makeTFile({ path: 'draw.excalidraw' });
      // WHEN a session for it is recorded
      recorder.recordFocusDuration(drawing, Date.parse(STAMP_1), 100);
      await recorder.flush();
      // THEN nothing was written
      expect(hidden.allPaths()).toEqual([]);
    });

    it('should keep recording after a failed id resolution (chain not broken)', async () => {
      // GIVEN id resolution throws for one file
      const { recorder, hidden, docIds, file } = setup();
      docIds.throwingPaths.add('notes/broken.md');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      recorder.recordFocusDuration(makeTFile({ path: 'notes/broken.md' }), 0, 1);
      // WHEN a session for a healthy file follows
      recorder.recordFocusDuration(file, Date.parse(STAMP_1), 5600);
      await recorder.flush();
      // THEN only the healthy session landed
      expect(hidden.allPaths()).toEqual([DOC_FILE]);
      errorSpy.mockRestore();
    });

    it('should preserve record order when an earlier id resolution is slower', async () => {
      // GIVEN the first session's id resolution stalls until released
      const firstResolution = new Deferred<string | null>();
      const { recorder, hidden, file } = setup({
        resolveDocId: (f) => (f.path === 'notes/slow.md' ? firstResolution.promise : Promise.resolve(DOC_ID)),
      });
      recorder.recordFocusDuration(makeTFile({ path: 'notes/slow.md' }), Date.parse(STAMP_1), 100);
      recorder.recordFocusDuration(file, Date.parse(STAMP_2), 200);
      // WHEN the stalled resolution completes with the SAME id
      firstResolution.resolve(DOC_ID);
      await recorder.flush();
      // THEN the lines landed in record order, not resolution order
      expect(hidden.getContent(DOC_FILE)).toBe(`${STAMP_1} D:100\n${STAMP_2} D:200\n`);
    });

    it('should not settle flush until a pending id resolution and its append complete', async () => {
      // GIVEN a session whose id resolution stalls
      const resolution = new Deferred<string | null>();
      const { recorder, hidden, file } = setup({ resolveDocId: () => resolution.promise });
      recorder.recordFocusDuration(file, Date.parse(STAMP_1), 100);
      const flushed = recorder.flush().then(() => hidden.getContent(DOC_FILE));
      // WHEN the resolution completes
      resolution.resolve(DOC_ID);
      // THEN by the time flush settles, the line has landed
      expect(await flushed).toBe(`${STAMP_1} D:100\n`);
    });

    describe('when id resolution throws', () => {
      let errorSpy: MockInstance<typeof console.error>;
      let hidden: FakeHiddenFileUtil;

      beforeEach(async () => {
        // GIVEN id resolution fails with an IO error
        const rig = setup();
        hidden = rig.hidden;
        rig.docIds.throwingPaths.add(rig.file.path);
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        // WHEN a session is recorded
        rig.recorder.recordFocusDuration(rig.file, Date.parse(STAMP_1), 100);
        await rig.recorder.flush();
      });

      afterEach(() => {
        errorSpy.mockRestore();
      });

      it('should drop the session', () => {
        // THEN nothing was written
        expect(hidden.allPaths()).toEqual([]);
      });

      it('should report the failure via console.error', () => {
        // THEN the drop is reported
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('doc id resolution failed'), expect.any(Error));
      });
    });

    describe('when the existing id is not filename-safe', () => {
      let errorSpy: MockInstance<typeof console.error>;
      let hidden: FakeHiddenFileUtil;

      beforeEach(async () => {
        // GIVEN a file carrying a pre-existing unsafe id
        const rig = setup();
        hidden = rig.hidden;
        rig.docIds.seedId(rig.file.path, 'un/safe');
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        // WHEN a session is recorded
        rig.recorder.recordFocusDuration(rig.file, Date.parse(STAMP_1), 100);
        await rig.recorder.flush();
      });

      afterEach(() => {
        errorSpy.mockRestore();
      });

      it('should drop the session', () => {
        // THEN nothing was written
        expect(hidden.allPaths()).toEqual([]);
      });

      it('should report the unsafe id via console.error', () => {
        // THEN the skip is reported
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not filename-safe'));
      });
    });
  });
});
