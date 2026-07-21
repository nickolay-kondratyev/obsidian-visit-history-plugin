import { App, PluginSettingTab, Setting, SettingDefinitionItem } from 'obsidian';
import type VisitHistoryPlugin from '../main';
import { DEFAULT_IDLE_TIMEOUT_SECONDS, MIN_IDLE_TIMEOUT_SECONDS } from '../settings';
import type { DocIdBackfillResult, DocIdBackfillService } from '../core/service/docId/DocIdBackfillService';
import type { UserNotifier } from '../core/util/userComm/UserNotifier';
import { ConfirmModal } from './ConfirmModal';

/**
 * The plugin's settings tab (Settings → Visit History): persisted settings
 * (see src/settings.ts) plus one-off actions.
 *
 * Renders declaratively on Obsidian 1.13+ (via getSettingDefinitions(), so the
 * settings appear in the built-in settings search) and imperatively (display())
 * as the pre-1.13 fallback. Both representations share the copy constants and
 * the isValidIdleTimeoutSeconds predicate below so they can never drift.
 */
export class VisitHistorySettingTab extends PluginSettingTab {
  private static readonly IDLE_TIMEOUT_NAME = 'Idle timeout (seconds)';
  private static readonly IDLE_TIMEOUT_DESC =
    'Seconds without any interaction before the focused note is '
    + 'treated as idle: its visit-duration session is closed, ending at '
    + `the last interaction. Minimum ${MIN_IDLE_TIMEOUT_SECONDS}; `
    + `default ${DEFAULT_IDLE_TIMEOUT_SECONDS} (3 minutes). `
    + 'Applies immediately.';
  private static readonly IDLE_TIMEOUT_ERROR =
    `Enter a whole number ≥ ${MIN_IDLE_TIMEOUT_SECONDS}.`;
  private static readonly BACKFILL_HEADING = 'File modifying actions';
  // "ids" not "'id' field": the sentence-case lint rule force-uppercases a
  // bare "id" to "ID", which would misrepresent the lowercase key we write.
  private static readonly BACKFILL_NAME = 'Add ids to all eligible files';
  private static readonly BACKFILL_DESC =
    'Assigns a persistent doc id to every markdown, canvas, and '
    + 'excalidraw.md file that does not already have one — the same id '
    + 'normally assigned when a file is opened.';
  private static readonly BACKFILL_BUTTON_LABEL = 'Add ids';

  constructor(
    app: App,
    private readonly visitHistoryPlugin: VisitHistoryPlugin,
    private readonly docIdBackfillService: DocIdBackfillService,
    private readonly userNotifier: UserNotifier,
  ) {
    super(app, visitHistoryPlugin);
  }

  /** Whether a candidate idle-timeout is a whole number at or above the minimum. */
  static isValidIdleTimeoutSeconds(seconds: number): boolean {
    return Number.isInteger(seconds) && seconds >= MIN_IDLE_TIMEOUT_SECONDS;
  }

  /**
   * Declarative settings (Obsidian 1.13+): rendered from this AND indexed for
   * settings search. When non-empty, Obsidian does NOT call display().
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: VisitHistorySettingTab.IDLE_TIMEOUT_NAME,
        desc: VisitHistorySettingTab.IDLE_TIMEOUT_DESC,
        control: {
          type: 'number',
          key: 'idleTimeoutSeconds',
          defaultValue: DEFAULT_IDLE_TIMEOUT_SECONDS,
          min: MIN_IDLE_TIMEOUT_SECONDS,
          step: 1,
          placeholder: String(DEFAULT_IDLE_TIMEOUT_SECONDS),
          // Mirrors display()'s silent reject, but surfaces an inline error
          // (invalid input is not persisted either way).
          validate: (value) => VisitHistorySettingTab.isValidIdleTimeoutSeconds(value)
            ? undefined
            : VisitHistorySettingTab.IDLE_TIMEOUT_ERROR,
        },
      },
      {
        type: 'group',
        heading: VisitHistorySettingTab.BACKFILL_HEADING,
        items: [
          {
            name: VisitHistorySettingTab.BACKFILL_NAME,
            desc: VisitHistorySettingTab.BACKFILL_DESC,
            // No declarative button control exists — use the imperative render
            // escape hatch to reuse the exact ConfirmModal + backfill flow.
            render: (setting) => {
              setting.addButton(btn => btn
                .setButtonText(VisitHistorySettingTab.BACKFILL_BUTTON_LABEL)
                .onClick(() => this.confirmAndRunDocIdBackfill()));
            },
          },
        ],
      },
    ];
  }

  /**
   * Persist a declarative control value through the plugin's own save path
   * (single, explicit save; live-applied because FocusDurationTracker reads
   * settings.idleTimeoutSeconds live). `idleTimeoutSeconds` is the only key.
   */
  async setControlValue(key: string, value: unknown): Promise<void> {
    // Boundary: Obsidian's declarative persistence contract is generic
    // (string key / unknown value) over our typed settings object.
    (this.visitHistoryPlugin.settings as unknown as Record<string, unknown>)[key] = value;
    await this.visitHistoryPlugin.saveSettings();
  }

  /** Imperative fallback for Obsidian < 1.13 (not called on 1.13+). */
  display(): void {
    this.containerEl.empty();

    this.displayIdleTimeoutSetting();

    new Setting(this.containerEl)
      .setName(VisitHistorySettingTab.BACKFILL_HEADING)
      .setHeading();

    new Setting(this.containerEl)
      .setName(VisitHistorySettingTab.BACKFILL_NAME)
      .setDesc(VisitHistorySettingTab.BACKFILL_DESC)
      .addButton(btn => btn
        .setButtonText(VisitHistorySettingTab.BACKFILL_BUTTON_LABEL)
        .onClick(() => this.confirmAndRunDocIdBackfill()));
  }

  private displayIdleTimeoutSetting(): void {
    new Setting(this.containerEl)
      .setName(VisitHistorySettingTab.IDLE_TIMEOUT_NAME)
      .setDesc(VisitHistorySettingTab.IDLE_TIMEOUT_DESC)
      .addText(text => text
        .setPlaceholder(String(DEFAULT_IDLE_TIMEOUT_SECONDS))
        .setValue(String(this.visitHistoryPlugin.settings.idleTimeoutSeconds))
        .onChange(async (value) => {
          const seconds = Number(value);
          // Invalid/too-small input is simply not persisted — the previous
          // valid value stays in effect (and reappears when the tab reopens).
          if (!VisitHistorySettingTab.isValidIdleTimeoutSeconds(seconds)) {
            return;
          }
          this.visitHistoryPlugin.settings.idleTimeoutSeconds = seconds;
          await this.visitHistoryPlugin.saveSettings();
        }));
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
