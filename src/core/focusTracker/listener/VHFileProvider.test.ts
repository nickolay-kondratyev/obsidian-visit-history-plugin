import { describe, expect, it } from 'vitest';
import { VHFileProvider } from './VHFileProvider';
import { FakeNoteFileUtil } from '../../../testSupport/FakeNoteFileUtil';
import { FakeLinkUtil, FakeUserNotifier, FixedDeviceNameProvider } from '../../../testSupport/fakes';
import { makeTFile } from '../../../testSupport/fileFactory';

const NOTE_PATH = 'notes/target.md';
const DEVICE = 'mac';
const OWN_DEVICE_DIR = `_visit_history/v1/focus/${DEVICE}/`;

function givenProvider(device: string = DEVICE) {
  const linkUtil = new FakeLinkUtil();
  const userNotifier = new FakeUserNotifier();
  const noteFileUtil = new FakeNoteFileUtil();
  const provider = new VHFileProvider(
    linkUtil,
    userNotifier,
    noteFileUtil,
    new FixedDeviceNameProvider(device),
  );
  return { provider, linkUtil, userNotifier, noteFileUtil, note: makeTFile({ path: NOTE_PATH }) };
}

describe('VHFileProvider', () => {
  describe('getOrCreateVHFilePathForThisMachine', () => {
    it('should return the existing VH file path from this device dir', async () => {
      // GIVEN a VH backlink in this device's directory
      const { provider, linkUtil, note } = givenProvider();
      const existing = linkUtil.addBacklinkFromPath(`${OWN_DEVICE_DIR}_vh_01EXISTING.md`);
      // WHEN resolving the VH file path
      const path = await provider.getOrCreateVHFilePathForThisMachine(note);
      // THEN the existing file is reused
      expect(path).toBe(existing.path);
    });

    it('should NOT match another device whose name merely contains this device name', async () => {
      // GIVEN device "mac" and a VH backlink from device "macbook-pro"
      const { provider, linkUtil, note } = givenProvider('mac');
      linkUtil.addBacklinkFromPath('_visit_history/v1/focus/macbook-pro/_vh_01OTHER.md');
      // WHEN resolving the VH file path
      const path = await provider.getOrCreateVHFilePathForThisMachine(note);
      // THEN a new file is created under THIS device's dir (no cross-device write)
      expect(path).toMatch(new RegExp(`^${OWN_DEVICE_DIR}_vh_`));
    });

    it('should create a VH file with the backlink header when none exists', async () => {
      // GIVEN no VH backlinks
      const { provider, noteFileUtil, note } = givenProvider();
      // WHEN resolving the VH file path
      const path = await provider.getOrCreateVHFilePathForThisMachine(note);
      // THEN the created file embeds the backlink to the source note
      expect(noteFileUtil.getContent(path!)).toContain(`VISIT_HISTORY_V1_FOR:[[${NOTE_PATH}]]`);
    });

    it('should reuse the cached path for a self-created VH file on repeat calls', async () => {
      // GIVEN a first call created a VH file (backlink index not yet updated)
      const { provider, note } = givenProvider();
      const firstPath = await provider.getOrCreateVHFilePathForThisMachine(note);
      // WHEN resolving again while backlinks are still empty
      const secondPath = await provider.getOrCreateVHFilePathForThisMachine(note);
      // THEN the same file is reused (without the cache a second ulid-named
      // file would be created)
      expect(secondPath).toBe(firstPath);
    });

    it('should warn when more than one VH backlink exists for this device', async () => {
      // GIVEN two VH backlinks in this device's directory
      const { provider, linkUtil, userNotifier, note } = givenProvider();
      linkUtil.addBacklinkFromPath(`${OWN_DEVICE_DIR}_vh_01FIRST.md`);
      linkUtil.addBacklinkFromPath(`${OWN_DEVICE_DIR}_vh_01SECOND.md`);
      // WHEN resolving the VH file path
      await provider.getOrCreateVHFilePathForThisMachine(note);
      // THEN the user is warned so they can clean up
      expect(userNotifier.errors.length).toBe(1);
    });

    it('should use the first backlink when more than one VH backlink exists', async () => {
      // GIVEN two VH backlinks in this device's directory
      const { provider, linkUtil, note } = givenProvider();
      const first = linkUtil.addBacklinkFromPath(`${OWN_DEVICE_DIR}_vh_01FIRST.md`);
      linkUtil.addBacklinkFromPath(`${OWN_DEVICE_DIR}_vh_01SECOND.md`);
      // WHEN resolving the VH file path
      const path = await provider.getOrCreateVHFilePathForThisMachine(note);
      // THEN the first one wins
      expect(path).toBe(first.path);
    });
  });

  describe('getAllVHFocusFiles', () => {
    it('should return VH files across ALL devices', async () => {
      // GIVEN VH backlinks from two devices
      const { provider, linkUtil, note } = givenProvider('mac');
      linkUtil.addBacklinkFromPath(`${OWN_DEVICE_DIR}_vh_01A.md`);
      linkUtil.addBacklinkFromPath('_visit_history/v1/focus/other-device/_vh_01B.md');
      // WHEN listing all VH focus files
      const files = await provider.getAllVHFocusFiles(note);
      // THEN both devices' files are included (aggregation is cross-device)
      expect(files.length).toBe(2);
    });

    it('should exclude regular (non-VH) backlinks', async () => {
      // GIVEN a regular note linking to the target
      const { provider, linkUtil, note } = givenProvider();
      linkUtil.addBacklinkFromPath('notes/some-other-note.md');
      // WHEN listing all VH focus files
      const files = await provider.getAllVHFocusFiles(note);
      // THEN it is not treated as a VH file
      expect(files.length).toBe(0);
    });
  });
});
