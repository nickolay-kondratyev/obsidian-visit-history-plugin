import { Plugin, TFolder } from 'obsidian';
import { SettingsSanitizer, VisitHistoryPluginSettings } from './settings';
import { PluginFactory } from './core/init/PluginFactory';
import { HiddenFileUtilDefault } from './core/util/file/hidden/impl/HiddenFileUtilDefault';
import { UserNameProviderDefault } from './core/service/visitHistoryService/user/UserNameProvider';
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
    // Top-dir rename FIRST — before user-name resolution: mobile user
    // adoption lists `__visit_history/user`, so a still-dot-named dir would
    // be missed and a bogus mobile user minted.
    try {
      // TODO(cleanup): remove after 2026-October (see VhTopDirRenameMigrationService).
      await new VhTopDirRenameMigrationService(hiddenFileUtil, new UserNotifierDefault(this))
        .migrateIfLegacyPresent();
    } catch (error) {
      // Never blocks load: legacy dir stays untouched, retried on next load.
      console.error('[VHP][main] VH top-dir rename migration failed', error);
    }

    // User name next: it keys `__visit_history/user/<user-name>/` and the
    // legacy-layout move below — both must be settled before any focus
    // tracking writes (cheap: cached in localStorage after first resolution).
    const userName = await new UserNameProviderDefault(hiddenFileUtil).getUserName();
    try {
      // TODO(cleanup): remove after 2026-October (see VhUserScopeMigrationService).
      await new VhUserScopeMigrationService(hiddenFileUtil, userName).migrateIfLegacyPresent();
    } catch (error) {
      // Never blocks load: new visits go to the user-scoped layout, legacy
      // dirs stay untouched, and the migration retries on the next load.
      console.error('[VHP][main] user-scope VH migration failed', error);
    }

    const factory = new PluginFactory(this, userName);
    this.factory = factory;
    this.userNotifier = factory.userNotifier;

    this.initVaultTreeMapView(factory);

    this.addSettingTab(new VisitHistorySettingTab(
      this.app,
      this,
      factory.docIdBackfillService,
      this.userNotifier,
    ));

    // Deferred: V3 format README write — onLayoutReady keeps file IO off
    // the load path.
    this.app.workspace.onLayoutReady(() => {
      void factory.vhStartupTasks.run();
    });
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
    // session may be lost (accepted limitation).
    this.factory?.focusDurationTracker.dispose();
  }

  async loadSettings() {
    // Sanitized at the boundary: see SettingsSanitizer for WHY.
    this.settings = SettingsSanitizer.sanitize(await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
