import { describe, expect, it, vi } from 'vitest';
import { VhV2StartupTasks } from './VhV2StartupTasks';
import { VhV1Migration, VhV1MigrationResult } from '../service/migration/VhV1ToV2MigrationService';
import { VhV2ReadmeWriter } from '../service/visitHistoryService/v2/VhV2ReadmeWriter';
import { VhV2Paths } from '../service/visitHistoryService/v2/VhV2Paths';
import { VhV2FocusStore } from '../service/visitHistoryService/v2/VhV2FocusStore';
import { VisitHistoryServiceV2 } from '../service/visitHistoryService/v2/VisitHistoryServiceV2';
import { FakeHiddenFileUtil } from '../../testSupport/FakeHiddenFileUtil';
import { FakeDocIdService, FakeUserNotifier, FixedDeviceNameProvider } from '../../testSupport/fakes';

class StubMigration implements VhV1Migration {
  constructor(private readonly outcome: VhV1MigrationResult | null | Error) {
  }

  async migrateIfV1Present(): Promise<VhV1MigrationResult | null> {
    if (this.outcome instanceof Error) throw this.outcome;
    return this.outcome;
  }
}

function successResult(overrides: Partial<VhV1MigrationResult> = {}): VhV1MigrationResult {
  return {
    migratedV1FileCount: 3,
    migratedDocFileCount: 2,
    unmigratableV1FileCount: 0,
    validationPassed: true,
    ...overrides,
  };
}

interface Setup {
  tasks: VhV2StartupTasks;
  hidden: FakeHiddenFileUtil;
  notifier: FakeUserNotifier;
}

function setup(migrationOutcome: VhV1MigrationResult | null | Error): Setup {
  const hidden = new FakeHiddenFileUtil();
  const notifier = new FakeUserNotifier();
  const serviceV2 = new VisitHistoryServiceV2(
    new FakeDocIdService(),
    new VhV2FocusStore(hidden),
    new FixedDeviceNameProvider('mac'),
  );
  const tasks = new VhV2StartupTasks(
    new VhV2ReadmeWriter(hidden),
    new StubMigration(migrationOutcome),
    serviceV2,
    notifier,
  );
  return { tasks, hidden, notifier };
}

describe('VhV2StartupTasks', () => {
  describe('run', () => {
    it('should write the V2 format README on every run', async () => {
      // GIVEN nothing to migrate
      const { tasks, hidden } = setup(null);
      // WHEN
      await tasks.run();
      // THEN the README exists
      expect(hidden.getContent(VhV2Paths.README_PATH)).toContain('Visit History V2');
    });

    it('should stay silent when there was nothing to migrate', async () => {
      // GIVEN no V1 tree
      const { tasks, notifier } = setup(null);
      // WHEN
      await tasks.run();
      // THEN no notices
      expect([...notifier.infos, ...notifier.errors]).toEqual([]);
    });

    it('should notify success with counts after a validated migration', async () => {
      // GIVEN a successful migration
      const { tasks, notifier } = setup(successResult());
      // WHEN
      await tasks.run();
      // THEN the info notice carries the counts
      expect(notifier.infos[0]).toContain('3 V1 files → 2 V2 files');
    });

    it('should mention deleted unmigratable files in the success notice', async () => {
      // GIVEN a migration that dropped one orphaned file
      const { tasks, notifier } = setup(successResult({ unmigratableV1FileCount: 1 }));
      // WHEN
      await tasks.run();
      // THEN the loss is called out
      expect(notifier.infos[0]).toContain('1 unmigratable V1 file(s) were deleted');
    });

    it('should show an error (not an info) when validation failed', async () => {
      // GIVEN validation failed → V1 kept
      const { tasks, notifier } = setup(successResult({ validationPassed: false }));
      // WHEN
      await tasks.run();
      // THEN
      expect({ errors: notifier.errors.length, infos: notifier.infos.length })
        .toEqual({ errors: 1, infos: 0 });
    });

    it('should catch a migration crash, notify, and still have written the README', async () => {
      // GIVEN a migration that throws
      const { tasks, hidden, notifier } = setup(new Error('disk exploded'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      // WHEN — run() must not reject (plugin load must survive)
      await tasks.run();
      // THEN error notice shown and README written before the crash
      expect({
        errors: notifier.errors.length,
        readmeWritten: hidden.getContent(VhV2Paths.README_PATH) !== undefined,
      }).toEqual({ errors: 1, readmeWritten: true });
      errorSpy.mockRestore();
    });
  });
});
