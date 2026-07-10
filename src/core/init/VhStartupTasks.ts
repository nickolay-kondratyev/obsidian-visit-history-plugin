import { UserNotifier } from '../util/userComm/UserNotifier';
import { VhV2ReadmeWriter } from '../service/visitHistoryService/v2/VhV2ReadmeWriter';
import { VhV3ReadmeWriter } from '../service/visitHistoryService/v3/VhV3ReadmeWriter';
import { VisitHistoryServiceV2 } from '../service/visitHistoryService/v2/VisitHistoryServiceV2';
import { VhV1Migration, VhV1MigrationResult } from '../service/migration/VhV1ToV2MigrationService';

/**
 * Deferred plugin-load work, run once from main.ts via onLayoutReady (the
 * vault index must be complete before migration resolves V1 backlinks).
 * Each step is error-isolated: a failing migration must not prevent the
 * README writes and vice versa, and load never crashes the plugin.
 */
export class VhStartupTasks {
  constructor(
    private readonly vhV2ReadmeWriter: VhV2ReadmeWriter,
    private readonly vhV3ReadmeWriter: VhV3ReadmeWriter,
    private readonly migrationService: VhV1Migration,
    private readonly visitHistoryServiceV2: VisitHistoryServiceV2,
    private readonly userNotifier: UserNotifier,
  ) {
  }

  async run(): Promise<void> {
    try {
      await this.vhV2ReadmeWriter.writeReadme();
    } catch (error) {
      console.error('[VHP][VhStartupTasks] V2 README write failed', error);
    }

    try {
      await this.vhV3ReadmeWriter.writeReadme();
    } catch (error) {
      console.error('[VHP][VhStartupTasks] V3 README write failed', error);
    }

    try {
      const result = await this.migrationService.migrateIfV1Present();
      if (result !== null) {
        this.visitHistoryServiceV2.invalidateLastVisitCache();
        this.notifyMigrationOutcome(result);
      }
    } catch (error) {
      console.error('[VHP][VhStartupTasks] V1→V2 migration failed', error);
      this.userNotifier.showError('Visit history: V1 → V2 migration failed — V1 files were kept. See console.');
    }
  }

  // ── private ─────────────────────────────────────────────────────────────

  private notifyMigrationOutcome(result: VhV1MigrationResult): void {
    if (!result.validationPassed) {
      this.userNotifier.showError('Visit history: V1 → V2 migration validation failed — V1 files were kept. See console.');
      return;
    }
    const unmigratableSuffix = result.unmigratableV1FileCount > 0
      ? ` ${result.unmigratableV1FileCount} unmigratable V1 file(s) were deleted with it (see console).`
      : '';
    this.userNotifier.showInfo(
      `Visit history: migrated V1 → V2 (${result.migratedV1FileCount} V1 files → ${result.migratedDocFileCount} V2 files). V1 folder deleted.${unmigratableSuffix}`,
    );
  }
}
