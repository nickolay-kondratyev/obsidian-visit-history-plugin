import { Plugin, TFolder } from 'obsidian';
import { SettingsSanitizer, VisitHistoryPluginSettings } from './settings';
import { PluginFactory } from './core/init/PluginFactory';
import { HiddenFileUtil } from './core/util/file/hidden/HiddenFileUtil';
import { HiddenFileUtilDefault } from './core/util/file/hidden/impl/HiddenFileUtilDefault';
import { VhTopDirRenameMigrationService } from './core/service/migration/VhTopDirRenameMigrationService';
import { VhUserScopeMigrationService } from './core/service/migration/VhUserScopeMigrationService';
import { UserNotifier } from './core/util/userComm/UserNotifier';
import { UserNotifierDefault } from './core/util/userComm/impl/UserNotifierDefault';
import { CSS_CLASS_HEATMAP_ACTIVE, VaultTreemapView, VIEW_TYPE_TREEMAP } from './view/VaultTreemapView';
import { VisitHistorySettingTab } from './settingsTab/VisitHistorySettingTab';

// ── VisitHistoryPlugin ────────────────────────────────────────────────────────
export default class VisitHistoryPlugin extends Plugin {
  settings!: VisitHistoryPluginSettings;
  userNotifier!: UserNotifier;
  // Optional: onunload must not throw when onload failed before wiring.
  private factory?: PluginFactory;

  async onload() {
    await this.loadSettings();

    const hiddenFileUtil = new HiddenFileUtilDefault(this.app);
    // Top-dir rename FIRST — before user-name resolution: the user-name
    // modal lists `__visit_history/user` for joinable identities, so a
    // still-dot-named dir would hide them. (onLayoutReady fires after
    // onload completes, so this await settles before the modal opens.)
    try {
      // TODO(cleanup): remove after 2026-October (see VhTopDirRenameMigrationService).
      await new VhTopDirRenameMigrationService(hiddenFileUtil, new UserNotifierDefault(this))
        .migrateIfLegacyPresent();
    } catch (error) {
      // Never blocks load: legacy dir stays untouched, retried on next load.
      console.error('[VHP][main] VH top-dir rename migration failed', error);
    }

    // The factory wires only NAME-INDEPENDENT parts (heatmap reads, doc-id
    // assignment) — the plugin fully loads without a pinned user name.
    const factory = new PluginFactory(this);
    this.factory = factory;
    this.userNotifier = factory.userNotifier;

    this.initVaultTreeMapView(factory);

    this.addSettingTab(new VisitHistorySettingTab(
      this.app,
      this,
      factory.docIdBackfillService,
      this.userNotifier,
    ));

    // Deferred: user-name pin (modal on unpinned devices) + everything that
    // writes user-scoped VH data — onLayoutReady keeps UI and file IO off
    // the load path.
    this.app.workspace.onLayoutReady(() => {
      void this.pinUserNameAndStartRecording(factory, hiddenFileUtil);
    });
  }

  /**
   * Resolves the user name (already-pinned devices resolve silently; others
   * get the confirmation modal) and activates VH recording. A dismissed
   * modal pins nothing: no VH is recorded this session and the modal shows
   * again on the next plugin start.
   */
  private async pinUserNameAndStartRecording(
    factory: PluginFactory,
    hiddenFileUtil: HiddenFileUtil,
  ): Promise<void> {
    try {
      const userName = await factory.userNameProvider.getUserName();
      if (userName === null) {
        return;
      }
      try {
        // Legacy-layout move BEFORE recording activates, so new visits can
        // never be written to the legacy location mid-move.
        // TODO(cleanup): remove after 2026-October (see VhUserScopeMigrationService).
        await new VhUserScopeMigrationService(hiddenFileUtil, userName).migrateIfLegacyPresent();
      } catch (error) {
        // Never blocks recording: new visits go to the user-scoped layout,
        // legacy dirs stay untouched, and the migration retries on next load.
        console.error('[VHP][main] user-scope VH migration failed', error);
      }
      factory.activateUserScopedRecording(userName);
    } catch (error) {
      console.error('[VHP][main] user-name resolution failed — no VH recording this session', error);
    }
  }

  private initVaultTreeMapView(pluginFactory: PluginFactory) {
    this.registerView(
      VIEW_TYPE_TREEMAP,
      (leaf) => new VaultTreemapView(leaf, pluginFactory),
    );

    /** Opens the heatmap in a new leaf, optionally drilled into a folder. */
    const openHeatmap = (folderPath?: string) => {
      void this.app.workspace.getLeaf(true).setViewState({
        type: VIEW_TYPE_TREEMAP,
        active: true,
        state: { folderPath },
      });
    };

    this.addCommand({
      id: 'open-vault-heatmap',
      name: 'Open vault heatmap',
      callback: () => openHeatmap(),
    });

    this.addRibbonIcon('layout-grid', 'Open vault heatmap', () => openHeatmap());

    // Hide the status bar while the heatmap view is the ACTIVE view.
    // CSS-only (body class → styles.css): removing the class restores the
    // status bar to whatever state it had before entering the heatmap.
    const updateStatusBarVisibility = () => {
      const heatmapActive = this.app.workspace.getActiveViewOfType(VaultTreemapView) !== null;
      document.body.toggleClass(CSS_CLASS_HEATMAP_ACTIVE, heatmapActive);
    };
    this.registerEvent(this.app.workspace.on('active-leaf-change', updateStatusBarVisibility));
    // Plugin unload must not leave the status bar hidden.
    this.register(() => document.body.removeClass(CSS_CLASS_HEATMAP_ACTIVE));
    updateStatusBarVisibility();

    // File-tree context menu: open the heatmap drilled into the folder.
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFolder)) return;
        menu.addItem(item =>
          item
            .setTitle('Open heatmap for folder')
            .setIcon('layout-grid')
            .onClick(() => openHeatmap(file.path)),
        );
      }),
    );
  }

  onunload() {
    // Best-effort flush of an in-progress V3 focus session. The append is
    // async and unload cannot await it — on a hard app quit the last open
    // session may be lost (accepted limitation). Safe with no pinned name
    // (recording never activated).
    this.factory?.dispose();
  }

  async loadSettings() {
    // Sanitized at the boundary: see SettingsSanitizer for WHY.
    this.settings = SettingsSanitizer.sanitize(await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
