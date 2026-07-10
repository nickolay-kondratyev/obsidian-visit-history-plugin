import { describe, expect, it } from 'vitest';
import { VhV3DurationStore } from './VhV3DurationStore';
import { FakeHiddenFileUtil } from '../../../../testSupport/FakeHiddenFileUtil';

const DEVICE = 'my-host';
const DOC_ID = 'docid_ABC123_E';
const FILE_PATH = `.visit_history/v3/focus_duration_per_device/${DEVICE}/${DOC_ID}.vh_v3`;

function setup(): { store: VhV3DurationStore; hidden: FakeHiddenFileUtil } {
  const hidden = new FakeHiddenFileUtil();
  return { store: new VhV3DurationStore(hidden), hidden };
}

describe('VhV3DurationStore', () => {
  describe('appendFocusDuration', () => {
    it('should write the session as `<ISO ms Z> D:<millis>` newline-terminated', async () => {
      // GIVEN an empty store
      const { store, hidden } = setup();
      // WHEN one session is appended
      await store.appendFocusDuration(DEVICE, DOC_ID, Date.parse('2026-07-09T22:02:15.745Z'), 5600);
      // THEN the line matches the documented format exactly
      expect(hidden.getContent(FILE_PATH)).toBe('2026-07-09T22:02:15.745Z D:5600\n');
    });

    it('should append sessions as separate lines in call order', async () => {
      // GIVEN one recorded session
      const { store, hidden } = setup();
      await store.appendFocusDuration(DEVICE, DOC_ID, Date.parse('2026-07-09T22:02:15.745Z'), 5600);
      // WHEN a later session is appended
      await store.appendFocusDuration(DEVICE, DOC_ID, Date.parse('2026-07-09T22:05:00.000Z'), 120);
      // THEN both lines are present in order
      expect(hidden.getContent(FILE_PATH)).toBe(
        '2026-07-09T22:02:15.745Z D:5600\n2026-07-09T22:05:00.000Z D:120\n',
      );
    });

    it('should record a zero-duration session as D:0', async () => {
      // GIVEN an empty store
      const { store, hidden } = setup();
      // WHEN a pass-through visit records zero millis
      await store.appendFocusDuration(DEVICE, DOC_ID, Date.parse('2026-07-09T22:02:15.745Z'), 0);
      // THEN the truthful zero is written
      expect(hidden.getContent(FILE_PATH)).toBe('2026-07-09T22:02:15.745Z D:0\n');
    });

    it('should throw on a doc id that is not filename-safe', async () => {
      // GIVEN a store
      const { store } = setup();
      // WHEN/THEN appending under an unsafe id is a programming error
      await expect(store.appendFocusDuration(DEVICE, 'a/b', 0, 1))
        .rejects.toThrow('not filename-safe');
    });
  });
});
