import { describe, expect, it, vi } from 'vitest';
import { VhV3DurationRecorder } from './VhV3DurationRecorder';
import { VhV3DurationStore } from '../service/visitHistoryService/v3/VhV3DurationStore';
import { VisitStatsCache } from '../service/visitHistoryService/v3/VisitStatsCache';
import { VisitStats } from '../service/visitHistoryService/VisitStats';
import { FakeHiddenFileUtil } from '../../testSupport/FakeHiddenFileUtil';
import { FixedDeviceNameProvider } from '../../testSupport/fakes';

const USER = 'alice';
const DEVICE = 'my-host';
const DOC_FILE = `.plugin_data/visit_history/user/${USER}/v3/focus_duration_per_device/${DEVICE}/docid_A_E.vh_v3`;

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

function setup(hidden: FakeHiddenFileUtil = new FakeHiddenFileUtil()): {
  recorder: VhV3DurationRecorder;
  hidden: FakeHiddenFileUtil;
  cache: VisitStatsCache;
} {
  const cache = new VisitStatsCache();
  const recorder = new VhV3DurationRecorder(
    new VhV3DurationStore(hidden),
    cache,
    new FixedDeviceNameProvider(DEVICE),
    USER,
  );
  return { recorder, hidden, cache };
}

describe('VhV3DurationRecorder', () => {
  describe('recordFocusDuration', () => {
    it('should persist the session under this device with the V3 line format', async () => {
      // GIVEN a recorder
      const { recorder, hidden } = setup();
      // WHEN a session is recorded
      recorder.recordFocusDuration('docid_A_E', Date.parse('2026-07-09T22:02:15.745Z'), 5600);
      await recorder.flush();
      // THEN the store holds the formatted line
      expect(hidden.getContent(DOC_FILE)).toBe('2026-07-09T22:02:15.745Z D:5600\n');
    });

    it('should serialize rapid records so both lines land in order', async () => {
      // GIVEN a recorder
      const { recorder, hidden } = setup();
      // WHEN two sessions are recorded back-to-back without awaiting
      recorder.recordFocusDuration('docid_A_E', Date.parse('2026-07-09T22:02:15.745Z'), 100);
      recorder.recordFocusDuration('docid_A_E', Date.parse('2026-07-09T22:02:16.000Z'), 200);
      await recorder.flush();
      // THEN both lines are present in call order
      expect(hidden.getContent(DOC_FILE)).toBe(
        '2026-07-09T22:02:15.745Z D:100\n2026-07-09T22:02:16.000Z D:200\n',
      );
    });

    it('should land both sessions for the SAME new doc when the append is check-then-write (racy IO)', async () => {
      // GIVEN a recorder over an append that yields between its exists-check and its write
      const { recorder, hidden } = setup(new CheckThenWriteHiddenFileUtil());
      // WHEN two sessions for a doc with no file yet are recorded back-to-back without awaiting
      recorder.recordFocusDuration('docid_A_E', Date.parse('2026-07-09T22:02:15.745Z'), 100);
      recorder.recordFocusDuration('docid_A_E', Date.parse('2026-07-09T22:02:16.000Z'), 200);
      await recorder.flush();
      // THEN neither create overwrote the other — the write chain serialized them
      expect(hidden.getContent(DOC_FILE)).toBe(
        '2026-07-09T22:02:15.745Z D:100\n2026-07-09T22:02:16.000Z D:200\n',
      );
    });

    it('should keep recording after a failed write (error isolation)', async () => {
      // GIVEN the first write fails (unsafe id → store throws)
      const { recorder, hidden } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      recorder.recordFocusDuration('un/safe', 0, 1);
      // WHEN a valid record follows
      recorder.recordFocusDuration('docid_A_E', Date.parse('2026-07-09T22:02:15.745Z'), 5600);
      await recorder.flush();
      // THEN the valid record was still written
      expect(hidden.getContent(DOC_FILE)).toBe('2026-07-09T22:02:15.745Z D:5600\n');
      errorSpy.mockRestore();
    });

    it('should merge the session into cached visit stats', async () => {
      // GIVEN cached stats for the doc
      const { recorder, cache } = setup();
      cache.setIfNoWriteSince('docid_A_E', new VisitStats(1000, 300), cache.readToken());
      // WHEN a session is recorded and persisted
      const startMs = Date.parse('2026-07-09T22:02:15.745Z');
      recorder.recordFocusDuration('docid_A_E', startMs, 5600);
      await recorder.flush();
      // THEN the cache serves the new last visit and total without a disk read
      expect(cache.get('docid_A_E')).toEqual({ lastVisitMs: startMs, totalFocusMs: 5900 });
    });

    it('should NOT create cached stats for a doc that was not cached', async () => {
      // GIVEN an empty cache
      const { recorder, cache } = setup();
      // WHEN a session is recorded and persisted
      recorder.recordFocusDuration('docid_A_E', Date.parse('2026-07-09T22:02:15.745Z'), 5600);
      await recorder.flush();
      // THEN no one-session total is invented (next lookup reads disk)
      expect(cache.get('docid_A_E')).toBeUndefined();
    });

    it('should invalidate cached stats when the write fails', async () => {
      // GIVEN cached stats for a doc whose write will fail
      const { recorder, hidden, cache } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      cache.setIfNoWriteSince('docid_A_E', new VisitStats(1000, 300), cache.readToken());
      hidden.append = async () => {
        throw new Error('disk full');
      };
      // WHEN a session is recorded
      recorder.recordFocusDuration('docid_A_E', 2000, 50);
      await recorder.flush();
      // THEN the entry is dropped — no merge of a session that failed to persist
      expect(cache.get('docid_A_E')).toBeUndefined();
      errorSpy.mockRestore();
    });

    it('should log the failed write', async () => {
      // GIVEN a write that will fail
      const { recorder, hidden } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      hidden.append = async () => {
        throw new Error('disk full');
      };
      // WHEN a session is recorded
      recorder.recordFocusDuration('docid_A_E', 2000, 50);
      await recorder.flush();
      // THEN the failure is reported
      expect(errorSpy).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
    });

    it('should accept fresh cache reads again after a failed write', async () => {
      // GIVEN a failed write (write window must not stay open)
      const { recorder, hidden, cache } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      hidden.append = async () => {
        throw new Error('disk full');
      };
      recorder.recordFocusDuration('docid_A_E', 2000, 50);
      await recorder.flush();
      // WHEN a fresh read result is offered
      // THEN it is cached
      expect(cache.setIfNoWriteSince('docid_A_E', VisitStats.EMPTY, cache.readToken())).toBe(true);
      errorSpy.mockRestore();
    });
  });
});
