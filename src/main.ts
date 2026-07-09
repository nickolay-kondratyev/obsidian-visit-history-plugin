import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, VisitHistoryPluginSettings } from './settings';
import { PluginFactory } from './core/init/PluginFactory';
import { UserNotifier } from './core/util/userComm/UserNotifier';
import { VaultTreemapView, VIEW_TYPE_TREEMAP } from './view/VaultTreemapView';

// ── VisitHistoryPlugin ────────────────────────────────────────────────────────
export default class VisitHistoryPlugin extends Plugin {
  settings!: VisitHistoryPluginSettings;
  userNotifier!: UserNotifier;

  async onload() {
    await this.loadSettings();

    const factory = new PluginFactory(this);
    this.userNotifier = factory.userNotifier;

    this.initVaultTreeMapView(factory);
  }

  private initVaultTreeMapView(pluginFactory: PluginFactory) {
    this.registerView(
      VIEW_TYPE_TREEMAP,
      (leaf) => new VaultTreemapView(leaf, pluginFactory),
    );

    const openHeatmap = () => {
      void this.app.workspace.getLeaf(true).setViewState({
        type: VIEW_TYPE_TREEMAP,
        active: true,
      });
    };

    this.addCommand({
      id: 'open-vault-heatmap',
      name: 'Open vault heatmap',
      callback: openHeatmap,
    });

    this.addRibbonIcon('layout-grid', 'Open vault heatmap', openHeatmap);
  }

  onunload() {
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<VisitHistoryPluginSettings>,
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
