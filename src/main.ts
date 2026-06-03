import {
  Editor,
  MarkdownView,
  MarkdownFileInfo,
  Modal,
  Notice,
  Plugin,
} from 'obsidian';
import {
  DEFAULT_SETTINGS,
  MyPluginSettings,
  SampleSettingTab,
} from './settings';

// Remember to rename these classes and interfaces!

// ── registerSampleCommands ────────────────────────────────────────────────────
// Registers all boilerplate sample functionality onto the given plugin instance.
// Call from onload() after settings are ready.
function registerSampleCommands(plugin: Plugin): void {
  plugin.addRibbonIcon('dice', 'Sample', (_evt: MouseEvent) => {
    new Notice('This is a notice!');
  });

  const statusBarItemEl = plugin.addStatusBarItem();
  statusBarItemEl.setText('Status bar text');

  plugin.addCommand({
    id: 'open-modal-simple',
    name: 'Open modal (simple)',
    callback: () => {
      new SampleModal(plugin.app).open();
    },
  });

  plugin.addCommand({
    id: 'open-modal-complex',
    name: 'Open modal (complex)',
    checkCallback: (checking: boolean) => {
      const markdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (markdownView) {
        if (!checking) {
          new SampleModal(plugin.app).open();
        }
        return true;
      }
      return false;
    },
  });

  plugin.addSettingTab(new SampleSettingTab(plugin.app, plugin));

  plugin.registerDomEvent(activeDocument, 'click', (_evt: MouseEvent) => {
    new Notice('Click2');
  });

  plugin.registerInterval(
    window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000),
  );
}

// ── VisitHistoryPlugin ────────────────────────────────────────────────────────
export default class VisitHistoryPlugin extends Plugin {
  settings!: MyPluginSettings;

  async onload() {
    await this.loadSettings();
    registerSampleCommands(this);
  }

  onunload() {
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<MyPluginSettings>,
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class SampleModal extends Modal {
  onOpen() {
    const {contentEl} = this;
    contentEl.setText('Woah!');
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}
