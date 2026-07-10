import { describe, expect, it, vi } from 'vitest';
import { VhUserScopeMigrationService } from './VhUserScopeMigrationService';
import { FakeHiddenFileUtil } from '../../../testSupport/FakeHiddenFileUtil';

const USER = 'alice';

const LEGACY_V2_FILE = '.visit_history/v2/focus_per_device/mac/doc-a.vh_v2';
const USER_V2_FILE = `.visit_history/user/${USER}/v2/focus_per_device/mac/doc-a.vh_v2`;
const LEGACY_V3_FILE = '.visit_history/v3/focus_duration_per_device/mac/doc-a.vh_v3';
const USER_V3_FILE = `.visit_history/user/${USER}/v3/focus_duration_per_device/mac/doc-a.vh_v3`;

interface Setup {
  migration: VhUserScopeMigrationService;
  hidden: FakeHiddenFileUtil;
}

function setup(): Setup {
  const hidden = new FakeHiddenFileUtil();
  return { migration: new VhUserScopeMigrationService(hidden, USER), hidden };
}

describe('VhUserScopeMigrationService', () => {
  describe('migrateIfLegacyPresent', () => {
    it('should move a legacy v2 tree under the current user, content intact', async () => {
      // GIVEN a legacy pre-user-scoped v2 tree
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V2_FILE, 'stamp\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN the file lives under the user tree with identical content
      expect(hidden.getContent(USER_V2_FILE)).toBe('stamp\n');
    });

    it('should leave no legacy v2 path behind after the move', async () => {
      // GIVEN a legacy v2 tree
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V2_FILE, 'stamp\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN the legacy location is gone
      expect(await hidden.exists('.visit_history/v2')).toBe(false);
    });

    it('should move a legacy v3 tree under the current user', async () => {
      // GIVEN a legacy v3 tree
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V3_FILE, 'session D:1\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN
      expect(hidden.getContent(USER_V3_FILE)).toBe('session D:1\n');
    });

    it('should move v2 and v3 independently in one run', async () => {
      // GIVEN both legacy trees
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V2_FILE, 'stamp\n');
      hidden.seedFile(LEGACY_V3_FILE, 'session D:1\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN both landed under the user tree
      expect({ v2: hidden.getContent(USER_V2_FILE), v3: hidden.getContent(USER_V3_FILE) })
        .toEqual({ v2: 'stamp\n', v3: 'session D:1\n' });
    });

    it('should be a no-op when no legacy dirs exist', async () => {
      // GIVEN an already user-scoped vault
      const { migration, hidden } = setup();
      hidden.seedFile(USER_V2_FILE, 'stamp\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN nothing changed
      expect(hidden.allPaths()).toEqual([USER_V2_FILE]);
    });

    it('should keep the legacy dir (never merge, never delete) when the destination exists', async () => {
      // GIVEN a legacy v2 tree AND an already-migrated user v2 tree (synced from another device)
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V2_FILE, 'legacy-stamp\n');
      hidden.seedFile(USER_V2_FILE, 'user-stamp\n');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN both survive untouched
      expect({ legacy: hidden.getContent(LEGACY_V2_FILE), user: hidden.getContent(USER_V2_FILE) })
        .toEqual({ legacy: 'legacy-stamp\n', user: 'user-stamp\n' });
      errorSpy.mockRestore();
    });

    it('should still migrate v3 when the v2 destination is blocked', async () => {
      // GIVEN v2 blocked but v3 movable
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V2_FILE, 'legacy-stamp\n');
      hidden.seedFile(USER_V2_FILE, 'user-stamp\n');
      hidden.seedFile(LEGACY_V3_FILE, 'session D:1\n');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN v3 moved despite the v2 skip
      expect(hidden.getContent(USER_V3_FILE)).toBe('session D:1\n');
      errorSpy.mockRestore();
    });
  });
});
