import { Plugin, } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, } from './settings';
import { registerSampleCommands } from "./sample/registerSampleCommands";

// Remember to rename these classes and interfaces!

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

