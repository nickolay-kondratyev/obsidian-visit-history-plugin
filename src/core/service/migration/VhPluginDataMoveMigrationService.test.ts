import { describe, expect, it, vi } from 'vitest';
import { VhPluginDataMoveMigrationService } from './VhPluginDataMoveMigrationService';
import { FakeHiddenFileUtil } from '../../../testSupport/FakeHiddenFileUtil';

const LEGACY_TOP = '__visit_history';
const NEW_TOP = '.plugin_data/visit_history';

const REL_V3 = 'user/alice/v3/focus_duration_per_device/mac/doc-a.vh_v3';
const REL_README = 'user/alice/v3/README__generated__vh_v3_format.md';
const REL_V2 = 'user/alice/v2/focus_per_device/mac/doc-a.vh_v2';

const LEGACY_V3 = `${LEGACY_TOP}/${REL_V3}`;
const NEW_V3 = `${NEW_TOP}/${REL_V3}`;
const LEGACY_README = `${LEGACY_TOP}/${REL_README}`;
const NEW_README = `${NEW_TOP}/${REL_README}`;
const LEGACY_V2 = `${LEGACY_TOP}/${REL_V2}`;

interface Setup {
  migration: VhPluginDataMoveMigrationService;
  hidden: FakeHiddenFileUtil;
}

function setup(): Setup {
  const hidden = new FakeHiddenFileUtil();
  return { migration: new VhPluginDataMoveMigrationService(hidden), hidden };
}

function silenceErrors(): { restore: () => void } {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return { restore: () => spy.mockRestore() };
}

describe('VhPluginDataMoveMigrationService', () => {
  describe('migrateIfLegacyPresent', () => {
    it('should be a no-op when the legacy top dir is absent', async () => {
      // GIVEN only new-location data
      const { migration, hidden } = setup();
      hidden.seedFile(NEW_V3, 'session D:1\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN nothing changed
      expect(hidden.allPaths()).toEqual([NEW_V3]);
    });

    it('should move a nested .vh_v3 file preserving its relative path', async () => {
      // GIVEN a legacy nested duration file
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V3, 'session D:1\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN it lives under the new top dir with identical content
      expect(hidden.getContent(NEW_V3)).toBe('session D:1\n');
    });

    it('should leave no legacy path behind after moving a .vh_v3 file', async () => {
      // GIVEN a legacy nested duration file
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V3, 'session D:1\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN the legacy top dir is gone
      expect(await hidden.exists(LEGACY_TOP)).toBe(false);
    });

    it('should move the generated V3 README', async () => {
      // GIVEN a legacy README
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_README, '# readme\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN
      expect(hidden.getContent(NEW_README)).toBe('# readme\n');
    });

    it('should leave a dormant v2 payload in place (only .vh_v3 + README migrate)', async () => {
      // GIVEN a legacy v2 file alongside a v3 file
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V2, 'stamp\n');
      hidden.seedFile(LEGACY_V3, 'session D:1\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN v2 stays at its legacy location
      expect(hidden.getContent(LEGACY_V2)).toBe('stamp\n');
    });

    it('should leave a stray non-matching .md file in place', async () => {
      // GIVEN a stray markdown file that is not the generated README
      const { migration, hidden } = setup();
      const stray = `${LEGACY_TOP}/user/alice/v3/notes.md`;
      hidden.seedFile(stray, 'hand-written\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN it stays put
      expect(hidden.getContent(stray)).toBe('hand-written\n');
    });

    it('should keep the source (never overwrite) when the destination already exists', async () => {
      // GIVEN a legacy file AND an already-present destination (synced elsewhere)
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V3, 'legacy\n');
      hidden.seedFile(NEW_V3, 'existing\n');
      const errors = silenceErrors();
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN both survive untouched
      expect({ legacy: hidden.getContent(LEGACY_V3), dest: hidden.getContent(NEW_V3) })
        .toEqual({ legacy: 'legacy\n', dest: 'existing\n' });
      errors.restore();
    });

    it('should prune the whole legacy tree when it ends up empty', async () => {
      // GIVEN only migratable files under the legacy tree
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V3, 'session D:1\n');
      hidden.seedFile(LEGACY_README, '# readme\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN the legacy top dir no longer exists
      expect(await hidden.exists(LEGACY_TOP)).toBe(false);
    });

    it('should keep dirs that still hold leftover files', async () => {
      // GIVEN a v2 leftover next to a migrated v3 file
      const { migration, hidden } = setup();
      hidden.seedFile(LEGACY_V2, 'stamp\n');
      hidden.seedFile(LEGACY_V3, 'session D:1\n');
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN the legacy top dir survives (v2 subtree stranded, intended)
      expect(await hidden.exists(LEGACY_TOP)).toBe(true);
    });

    it('should continue moving remaining files when one move fails', async () => {
      // GIVEN two migratable files where the first rename throws
      const { migration, hidden } = setup();
      const failing = `${LEGACY_TOP}/user/alice/v3/focus_duration_per_device/mac/doc-fail.vh_v3`;
      hidden.seedFile(failing, 'boom\n');
      hidden.seedFile(LEGACY_V3, 'session D:1\n');
      const errors = silenceErrors();
      const realRename = hidden.rename.bind(hidden);
      vi.spyOn(hidden, 'rename').mockImplementation(async (from, to) => {
        if (from === failing) {
          throw new Error('simulated rename failure');
        }
        return realRename(from, to);
      });
      // WHEN
      await migration.migrateIfLegacyPresent();
      // THEN the healthy file still moved despite the failure
      expect(hidden.getContent(NEW_V3)).toBe('session D:1\n');
      errors.restore();
    });
  });
});
