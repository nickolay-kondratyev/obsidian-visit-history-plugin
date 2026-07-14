import { describe, expect, it, vi } from 'vitest';
import { VhV3DurationRecorder } from './VhV3DurationRecorder';
import { VhV3DurationStore } from '../service/visitHistoryService/v3/VhV3DurationStore';
import { LastVisitCache } from '../service/visitHistoryService/v3/LastVisitCache';
import { FakeHiddenFileUtil } from '../../testSupport/FakeHiddenFileUtil';
import { FixedDeviceNameProvider } from '../../testSupport/fakes';

const USER = 'alice';
const DEVICE = 'my-host';
const DOC_FILE = `.visit_history/user/${USER}/v3/focus_duration_per_device/${DEVICE}/docid_A_E.vh_v3`;

function setup(): {
  recorder: VhV3DurationRecorder;
  hidden: FakeHiddenFileUtil;
  cache: LastVisitCache;
} {
  const hidden = new FakeHiddenFileUtil();
  const cache = new LastVisitCache();
  const recorder = new VhV3DurationRecorder(
    new VhV3DurationStore(hidden, USER),
    cache,
    new FixedDeviceNameProvider(DEVICE),
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

    it('should write the session start through to the last-visit cache', async () => {
      // GIVEN a recorder
      const { recorder, cache } = setup();
      // WHEN a session is recorded and persisted
      const startMs = Date.parse('2026-07-09T22:02:15.745Z');
      recorder.recordFocusDuration('docid_A_E', startMs, 5600);
      await recorder.flush();
      // THEN the cache serves the new last visit without a disk read
      expect(cache.get('docid_A_E')).toEqual({ value: startMs });
    });

    it('should NOT update the cache when the write fails', async () => {
      // GIVEN a record whose write fails (unsafe id → store throws)
      const { recorder, cache } = setup();
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      // WHEN it is recorded
      recorder.recordFocusDuration('un/safe', 100, 1);
      await recorder.flush();
      // THEN the cache never claims a visit that failed to persist
      expect(cache.get('un/safe')).toBeUndefined();
      errorSpy.mockRestore();
    });
  });
});
