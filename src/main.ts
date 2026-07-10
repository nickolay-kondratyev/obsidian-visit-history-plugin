import { Plugin, TFolder } from 'obsidian';
import { SettingsSanitizer, VisitHistoryPluginSettings } from './settings';
import { PluginFactory } from './core/init/PluginFactory';
import { UserNotifier } from './core/util/userComm/UserNotifier';
import { VaultTreemapView, VIEW_TYPE_TREEMAP } from './view/VaultTreemapView';
import { VisitHistorySettingTab } from './settingsTab/VisitHistorySettingTab';

// ── VisitHistoryPlugin ────────────────────────────────────────────────────────
export default class VisitHistoryPlugin extends Plugin {
  settings!: VisitHistoryPluginSettings;
  userNotifier!: UserNotifier;
  // Optional: onunload must not throw when onload failed before wiring.
  private factory?: PluginFactory;

  async onload() {
    await this.loadSettings();

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

    // Deferred: V2/V3 format README writes + V1→V2 auto migration.
    // onLayoutReady — the vault index must be complete before migration
    // resolves backlinks.
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
