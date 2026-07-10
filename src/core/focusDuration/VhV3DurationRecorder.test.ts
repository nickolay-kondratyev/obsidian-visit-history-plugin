import { describe, expect, it, vi } from 'vitest';
import { VhV3DurationRecorder } from './VhV3DurationRecorder';
import { VhV3DurationStore } from '../service/visitHistoryService/v3/VhV3DurationStore';
import { FakeHiddenFileUtil } from '../../testSupport/FakeHiddenFileUtil';
import { FixedDeviceNameProvider } from '../../testSupport/fakes';

const USER = 'alice';
const DEVICE = 'my-host';
const DOC_FILE = `.visit_history/user/${USER}/v3/focus_duration_per_device/${DEVICE}/docid_A_E.vh_v3`;

function setup(): { recorder: VhV3DurationRecorder; hidden: FakeHiddenFileUtil } {
  const hidden = new FakeHiddenFileUtil();
  const recorder = new VhV3DurationRecorder(
    new VhV3DurationStore(hidden, USER),
    new FixedDeviceNameProvider(DEVICE),
  );
  return { recorder, hidden };
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
  });
});
