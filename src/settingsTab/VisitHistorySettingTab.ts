import { App, PluginSettingTab, Setting } from 'obsidian';
import VisitHistoryPlugin from '../main';
import { DocIdBackfillResult, DocIdBackfillService } from '../core/service/docId/DocIdBackfillService';
import { UserNotifier } from '../core/util/userComm/UserNotifier';
import { ConfirmModal } from './ConfirmModal';

/**
 * The plugin's settings tab (Settings → Visit History). Currently exposes
 * one-off actions only — no persisted settings (see src/settings.ts).
 */
export class VisitHistorySettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: VisitHistoryPlugin,
    private readonly docIdBackfillService: DocIdBackfillService,
    private readonly userNotifier: UserNotifier,
  ) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();

    new Setting(this.containerEl)
      .setName('File modifying actions')
      .setHeading();

    new Setting(this.containerEl)
      // "ids" not "'id' field": the sentence-case lint rule force-uppercases a
      // bare "id" to "ID", which would misrepresent the lowercase key we write.
      .setName('Add ids to all eligible files')
      .setDesc('Assigns a persistent doc id to every markdown, canvas, and '
        + 'excalidraw.md file that does not already have one — the same id '
        + 'normally assigned when a file is opened.')
      .addButton(btn => btn
        .setButtonText('Add ids')
        .onClick(() => this.confirmAndRunDocIdBackfill()));
  }

  private confirmAndRunDocIdBackfill(): void {
    new ConfirmModal(this.app, {
      title: "Add 'id' field to all eligible files",
      body: "This will add an 'id' field to all eligible files (markdown, "
        + 'canvas, excalidraw.md) in your vault that do not already have one. '
        + 'Files are modified in place and this cannot be undone. Continue?',
      ctaLabel: 'Add ids',
      onConfirm: () => {
        void this.runDocIdBackfill();
      },
    }).open();
  }

  private async runDocIdBackfill(): Promise<void> {
    this.userNotifier.showInfo('Adding ids to eligible files…');
    const result = await this.docIdBackfillService.backfillAll();
    this.notifyBackfillOutcome(result);
  }

  private notifyBackfillOutcome(result: DocIdBackfillResult): void {
    const failedCount = result.failedPaths.length;
    if (failedCount > 0) {
      this.userNotifier.showError(
        `Added ids: ${result.eligibleFileCount - failedCount} files OK, `
        + `${failedCount} failed (see developer console).`);
      return;
    }
    this.userNotifier.showInfo(`Done — ${result.eligibleFileCount} eligible files now have an id.`);
  }
}
