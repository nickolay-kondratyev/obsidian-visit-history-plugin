import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, VisitHistoryPluginSettings } from './settings';
import { registerSampleCommands } from './core/sample/registerSampleCommands';
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

    registerSampleCommands(this);

    this.initVaultTreeMapView(factory);
  }

  private initVaultTreeMapView(pluginFactory: PluginFactory) {
    // ── Vault Treemap view ─────────────────────────────────────────────
    this.registerView(
      VIEW_TYPE_TREEMAP,
      (leaf) => new VaultTreemapView(leaf, pluginFactory),
    );

    this.addCommand({
      id: 'open-vault-treemap',
      name: 'Open vault treemap',
      callback: () => {
        this.app.workspace.getLeaf(true).setViewState({
          type: VIEW_TYPE_TREEMAP,
          active: true,
        });
      },
    });

    this.addRibbonIcon('layout-grid', 'Open vault treemap', () => {
      this.app.workspace.getLeaf(true).setViewState({
        type: VIEW_TYPE_TREEMAP,
        active: true,
      });
    });
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