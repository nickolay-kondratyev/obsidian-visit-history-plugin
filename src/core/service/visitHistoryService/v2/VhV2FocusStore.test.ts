import { describe, expect, it } from 'vitest';
import { VhV2FocusStore } from './VhV2FocusStore';
import { FakeHiddenFileUtil } from '../../../../testSupport/FakeHiddenFileUtil';

const DOC_ID = 'docid_4n8VbFqzXKp0RtLmW2sYc_E';
const USER = 'alice';
const DEVICE = 'my-host';
const DOC_PATH = `.visit_history/user/${USER}/v2/focus_per_device/${DEVICE}/${DOC_ID}.vh_v2`;

const T1 = Date.parse('2026-06-23T12:34:56.789Z');
const T2 = Date.parse('2026-06-24T09:01:02.345Z');

interface Setup {
  store: VhV2FocusStore;
  hidden: FakeHiddenFileUtil;
}

function setup(): Setup {
  const hidden = new FakeHiddenFileUtil();
  return { store: new VhV2FocusStore(hidden, USER), hidden };
}

describe('VhV2FocusStore', () => {
  describe('appendVisit', () => {
    it('should create the file under the user tree with one ISO line and a trailing newline', async () => {
      // GIVEN an empty store
      const { store, hidden } = setup();
      // WHEN recording a visit
      await store.appendVisit(DEVICE, DOC_ID, T1);
      // THEN the file holds exactly one newline-terminated ISO ms stamp
      expect(hidden.getContent(DOC_PATH)).toBe('2026-06-23T12:34:56.789Z\n');
    });

    it('should append subsequent visits as additional lines', async () => {
      // GIVEN a first visit
      const { store, hidden } = setup();
      await store.appendVisit(DEVICE, DOC_ID, T1);
      // WHEN a second visit is recorded
      await store.appendVisit(DEVICE, DOC_ID, T2);
      // THEN both lines are present, in order
      expect(hidden.getContent(DOC_PATH))
        .toBe('2026-06-23T12:34:56.789Z\n2026-06-24T09:01:02.345Z\n');
    });

    it('should throw on a filename-unsafe id (caller must pre-validate)', async () => {
      // GIVEN / WHEN / THEN
      await expect(setup().store.appendVisit(DEVICE, 'a/b', T1))
        .rejects.toThrow('not filename-safe');
    });
  });

  describe('readStampsMs', () => {
    it('should return all stamps as epoch ms', async () => {
      // GIVEN a file with two stamps
      const { store, hidden } = setup();
      hidden.seedFile(DOC_PATH, '2026-06-23T12:34:56.789Z\n2026-06-24T09:01:02.345Z\n');
      // WHEN / THEN
      expect(await store.readStampsMs(DEVICE, DOC_ID)).toEqual([T1, T2]);
    });

    it('should return [] when the file does not exist', async () => {
      expect(await setup().store.readStampsMs(DEVICE, DOC_ID)).toEqual([]);
    });

    it('should skip malformed lines without throwing', async () => {
      // GIVEN a file with a corrupted line between valid stamps
      const { store, hidden } = setup();
      hidden.seedFile(DOC_PATH, '2026-06-23T12:34:56.789Z\ngarbage\n2026-06-24T09:01:02.345Z\n');
      // WHEN / THEN only the valid stamps come back
      expect(await store.readStampsMs(DEVICE, DOC_ID)).toEqual([T1, T2]);
    });

    it('should return [] for a filename-unsafe id (no file can exist)', async () => {
      expect(await setup().store.readStampsMs(DEVICE, 'a/b')).toEqual([]);
    });
  });

  describe('writeStampsMs', () => {
    it('should write sorted ascending regardless of input order', async () => {
      // GIVEN stamps out of order
      const { store, hidden } = setup();
      // WHEN writing
      await store.writeStampsMs(DEVICE, DOC_ID, [T2, T1]);
      // THEN lines are sorted ascending
      expect(hidden.getContent(DOC_PATH))
        .toBe('2026-06-23T12:34:56.789Z\n2026-06-24T09:01:02.345Z\n');
    });

    it('should deduplicate exact-duplicate stamps', async () => {
      // GIVEN a duplicated stamp
      const { store, hidden } = setup();
      // WHEN writing
      await store.writeStampsMs(DEVICE, DOC_ID, [T1, T1]);
      // THEN one line remains
      expect(hidden.getContent(DOC_PATH)).toBe('2026-06-23T12:34:56.789Z\n');
    });

    it('should overwrite previous content entirely', async () => {
      // GIVEN pre-existing content
      const { store, hidden } = setup();
      hidden.seedFile(DOC_PATH, 'old-content\n');
      // WHEN writing
      await store.writeStampsMs(DEVICE, DOC_ID, [T1]);
      // THEN only the new stamps remain
      expect(hidden.getContent(DOC_PATH)).toBe('2026-06-23T12:34:56.789Z\n');
    });
  });

  describe('getLastVisitMsAcrossUsersAndDevices', () => {
    it('should return the max stamp across device directories of one user', async () => {
      // GIVEN the doc visited on two devices
      const { store, hidden } = setup();
      hidden.seedFile(
        `.visit_history/user/${USER}/v2/focus_per_device/host-a/${DOC_ID}.vh_v2`,
        '2026-06-23T12:34:56.789Z\n',
      );
      hidden.seedFile(
        `.visit_history/user/${USER}/v2/focus_per_device/host-b/${DOC_ID}.vh_v2`,
        '2026-06-24T09:01:02.345Z\n',
      );
      // WHEN / THEN the most recent across devices wins
      expect(await store.getLastVisitMsAcrossUsersAndDevices(DOC_ID)).toBe(T2);
    });

    it('should aggregate across OTHER users (heatmap shows whole-vault activity)', async () => {
      // GIVEN the doc visited by the current user and, more recently, by another user
      const { store, hidden } = setup();
      hidden.seedFile(DOC_PATH, '2026-06-23T12:34:56.789Z\n');
      hidden.seedFile(
        `.visit_history/user/bob/v2/focus_per_device/bobs-host/${DOC_ID}.vh_v2`,
        '2026-06-24T09:01:02.345Z\n',
      );
      // WHEN / THEN the other user's more recent visit wins
      expect(await store.getLastVisitMsAcrossUsersAndDevices(DOC_ID)).toBe(T2);
    });

    it('should return null when no user has a file for the doc', async () => {
      // GIVEN another doc's file only
      const { store, hidden } = setup();
      hidden.seedFile(`.visit_history/user/${USER}/v2/focus_per_device/host-a/other-doc.vh_v2`, '2026-06-23T12:34:56.789Z\n');
      // WHEN / THEN
      expect(await store.getLastVisitMsAcrossUsersAndDevices(DOC_ID)).toBeNull();
    });

    it('should return null when the focus tree does not exist at all', async () => {
      expect(await setup().store.getLastVisitMsAcrossUsersAndDevices(DOC_ID)).toBeNull();
    });
  });
});
