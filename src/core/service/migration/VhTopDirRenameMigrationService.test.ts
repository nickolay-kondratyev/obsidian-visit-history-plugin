import { describe, expect, it, vi } from 'vitest';
import { VhTopDirRenameMigrationService } from './VhTopDirRenameMigrationService';
import { FakeHiddenFileUtil } from '../../../testSupport/FakeHiddenFileUtil';
import { UserNotifier } from '../../util/userComm/UserNotifier';

const LEGACY_FILE = '.visit_history/user/alice/v3/focus_duration_per_device/mac/doc-a.vh_v3';
const RENAMED_FILE = '__visit_history/user/alice/v3/focus_duration_per_device/mac/doc-a.vh_v3';

/** Recording UserNotifier — the service must stay Obsidian-agnostic. */
class RecordingUserNotifier implements UserNotifier {
  readonly errors: string[] = [];
  readonly infos: string[] = [];

  showError(msg: string): void {
    this.errors.push(msg);
  }

  showInfo(msg: string): void {
    this.infos.push(msg);
  }
}

interface Setup {
  migration: VhTopDirRenameMigrationService;
  hidden: FakeHiddenFileUtil;
  notifier: RecordingUserNotifier;
}

function setup(): Setup {
  const hidden = new FakeHiddenFileUtil();
  const notifier = new RecordingUserNotifier();
  return { migration: new VhTopDirRenameMigrationService(hidden, notifier), hidden, notifier };
}

describe('VhTopDirRenameMigrationService', () => {
  describe('migrateIfLegacyPresent', () => {
    it('should move the whole legacy dir to __visit_history, content intact', async () => {
      // GIVEN a legacy `.visit_history` tree
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_FILE, 'session D:1\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN the file lives under `__visit_history` with identical content
      expect(hidden.getContent(RENAMED_FILE)).toBe('session D:1\n');
    });

    it('should leave no legacy path behind after the move', async () => {
      // GIVEN a legacy `.visit_history` tree
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_FILE, 'session D:1\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN the legacy location is gone
      expect(await hidden.exists('.visit_history')).toBe(false);
    });

    it('should be a no-op when no legacy dir exists', async () => {
      // GIVEN a vault without `.visit_history`
      const { migration, hidden } = setup();
      hidden.seedFile('notes/a.md', 'note\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN nothing changed
      expect(hidden.allPaths()).toEqual(['notes/a.md']);
    });

    it('should be a no-op when the vault is already migrated', async () => {
      // GIVEN only the new `__visit_history` tree
      const { migration, hidden } = setup();
      hidden.seedFile(RENAMED_FILE, 'session D:1\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN nothing changed
      expect(hidden.allPaths()).toEqual([RENAMED_FILE]);
    });

    it('should not notify the user on a clean move', async () => {
      // GIVEN a legacy tree and no conflict
      const { migration, hidden, notifier } = setup();
      hidden.seedFile(LEGACY_FILE, 'session D:1\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN the user was not bothered
      expect(notifier.errors).toEqual([]);
    });

    it('should keep both dirs untouched (never merge, never delete) when both exist', async () => {
      // GIVEN both `.visit_history` AND `__visit_history` (another synced device already migrated)
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_FILE, 'legacy-session D:1\n');
      hidden.seedFile(RENAMED_FILE, 'new-session D:2\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN both survive untouched
      expect({ legacy: hidden.getContent(LEGACY_FILE), renamed: hidden.getContent(RENAMED_FILE) })
        .toEqual({ legacy: 'legacy-session D:1\n', renamed: 'new-session D:2\n' });
    });

    it('should notify the user of the conflict when both exist', async () => {
      // GIVEN both dirs present
      const { migration, hidden, notifier } = setup();
      hidden.seedFile(LEGACY_FILE, 'legacy-session D:1\n');
      hidden.seedFile(RENAMED_FILE, 'new-session D:2\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN a user-facing error names both dirs
      expect(notifier.errors.join('\n')).toContain('.visit_history');
    });

    it('should log a console error when both exist', async () => {
      // GIVEN both dirs present
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_FILE, 'legacy-session D:1\n');
      hidden.seedFile(RENAMED_FILE, 'new-session D:2\n');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
