import { describe, expect, it } from 'vitest';
import { VhV3DurationStore } from './VhV3DurationStore';
import { FakeHiddenFileUtil } from '../../../../testSupport/FakeHiddenFileUtil';

const USER = 'alice';
const DEVICE = 'my-host';
const DOC_ID = 'docid_ABC123_E';
const FILE_PATH = `.visit_history/user/${USER}/v3/focus_duration_per_device/${DEVICE}/${DOC_ID}.vh_v3`;

function setup(): { store: VhV3DurationStore; hidden: FakeHiddenFileUtil } {
  const hidden = new FakeHiddenFileUtil();
  return { store: new VhV3DurationStore(hidden, USER), hidden };
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

  describe('readSessions', () => {
    it('should round-trip appended sessions', async () => {
      // GIVEN two appended sessions
      const { store } = setup();
      await store.appendFocusDuration(DEVICE, DOC_ID, Date.parse('2026-07-09T22:02:15.745Z'), 5600);
      await store.appendFocusDuration(DEVICE, DOC_ID, Date.parse('2026-07-09T22:05:00.000Z'), 120);
      // WHEN read back
      // THEN both parse to their start + duration
      expect(await store.readSessions(DEVICE, DOC_ID)).toEqual([
        { focusStartEpochMs: Date.parse('2026-07-09T22:02:15.745Z'), durationMs: 5600 },
        { focusStartEpochMs: Date.parse('2026-07-09T22:05:00.000Z'), durationMs: 120 },
      ]);
    });

    it('should return [] when the doc has no file on the device', async () => {
      const { store } = setup();
      expect(await store.readSessions(DEVICE, DOC_ID)).toEqual([]);
    });

    it('should skip malformed lines without throwing', async () => {
      // GIVEN a file with garbage between two valid sessions
      const { store, hidden } = setup();
      hidden.seedFile(
        FILE_PATH,
        '2026-07-09T22:02:15.745Z D:5600\nnot a session\n2026-07-09T22:05:00.000Z D:120\n',
      );
      // WHEN read
      // THEN only the valid sessions survive
      expect(await store.readSessions(DEVICE, DOC_ID)).toHaveLength(2);
    });

    it('should treat an unsafe doc id as "no file"', async () => {
      const { store } = setup();
      expect(await store.readSessions(DEVICE, 'a/b')).toEqual([]);
    });
  });

  describe('getLastFocusStartMsAcrossUsersAndDevices', () => {
    const OTHER_DEVICE = 'other-host';
    const OTHER_DEVICE_FILE_PATH = `.visit_history/user/${USER}/v3/focus_duration_per_device/${OTHER_DEVICE}/${DOC_ID}.vh_v3`;
    const OTHER_USER_FILE_PATH = `.visit_history/user/bob/v3/focus_duration_per_device/bobs-host/${DOC_ID}.vh_v3`;

    it('should return null when no user folders exist at all (fresh vault)', async () => {
      const { store } = setup();
      expect(await store.getLastFocusStartMsAcrossUsersAndDevices(DOC_ID)).toBeNull();
    });

    it('should return null when devices exist but none tracked the doc', async () => {
      // GIVEN a device folder holding only another doc
      const { store, hidden } = setup();
      hidden.seedFile(
        `.visit_history/user/${USER}/v3/focus_duration_per_device/${DEVICE}/docid_OTHER_E.vh_v3`,
        '2026-07-09T22:02:15.745Z D:5600\n',
      );
      // WHEN looked up
      // THEN the doc was never focused
      expect(await store.getLastFocusStartMsAcrossUsersAndDevices(DOC_ID)).toBeNull();
    });

    it('should return null for a user dir without any device dirs', async () => {
      // GIVEN a user tree holding only the generated README (no device dirs)
      const { store, hidden } = setup();
      hidden.seedFile(
        `.visit_history/user/${USER}/v3/README__generated__vh_v3_format.md`,
        'readme\n',
      );
      // WHEN looked up
      // THEN the doc was never focused
      expect(await store.getLastFocusStartMsAcrossUsersAndDevices(DOC_ID)).toBeNull();
    });

    it('should return the max session START across devices', async () => {
      // GIVEN the doc focused on two devices, most recently on the other one
      const { store, hidden } = setup();
      hidden.seedFile(FILE_PATH, '2026-07-09T10:00:00.000Z D:100\n');
      hidden.seedFile(OTHER_DEVICE_FILE_PATH, '2026-07-10T10:00:00.000Z D:100\n');
      // WHEN looked up
      // THEN the newest start stamp wins
      expect(await store.getLastFocusStartMsAcrossUsersAndDevices(DOC_ID))
        .toBe(Date.parse('2026-07-10T10:00:00.000Z'));
    });

    it('should aggregate across OTHER users (heatmap shows whole-vault activity)', async () => {
      // GIVEN the doc focused by the current user and, more recently, by another user
      const { store, hidden } = setup();
      hidden.seedFile(FILE_PATH, '2026-07-09T10:00:00.000Z D:100\n');
      hidden.seedFile(OTHER_USER_FILE_PATH, '2026-07-10T10:00:00.000Z D:100\n');
      // WHEN looked up
      // THEN the other user's more recent focus wins
      expect(await store.getLastFocusStartMsAcrossUsersAndDevices(DOC_ID))
        .toBe(Date.parse('2026-07-10T10:00:00.000Z'));
    });

    it('should aggregate even when the doc is absent on one device', async () => {
      // GIVEN two device folders but the doc tracked on only one
      const { store, hidden } = setup();
      hidden.seedFile(FILE_PATH, '2026-07-09T10:00:00.000Z D:100\n');
      hidden.seedFile(
        `.visit_history/user/${USER}/v3/focus_duration_per_device/${OTHER_DEVICE}/docid_OTHER_E.vh_v3`,
        '2026-07-11T10:00:00.000Z D:100\n',
      );
      // WHEN looked up
      // THEN the present device's stamp is returned
      expect(await store.getLastFocusStartMsAcrossUsersAndDevices(DOC_ID))
        .toBe(Date.parse('2026-07-09T10:00:00.000Z'));
    });

    it('should skip malformed lines when aggregating', async () => {
      // GIVEN a file whose newest line is garbage
      const { store, hidden } = setup();
      hidden.seedFile(FILE_PATH, '2026-07-09T10:00:00.000Z D:100\ngarbage line\n');
      // WHEN looked up
      // THEN the valid stamp is still returned
      expect(await store.getLastFocusStartMsAcrossUsersAndDevices(DOC_ID))
        .toBe(Date.parse('2026-07-09T10:00:00.000Z'));
    });

    it('should return null for an unsafe doc id', async () => {
      // GIVEN a device folder exists
      const { store, hidden } = setup();
      hidden.seedFile(FILE_PATH, '2026-07-09T10:00:00.000Z D:100\n');
      // WHEN an unsafe id is looked up
      // THEN it reads nothing (never builds a path from it)
      expect(await store.getLastFocusStartMsAcrossUsersAndDevices('a/b')).toBeNull();
    });
  });
});
