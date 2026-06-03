import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, VisitHistoryPluginSettings } from './settings';
import { registerSampleCommands } from './sample/registerSampleCommands';
import { FocusTracker } from "./focusTracker/FocusTracker";
import { ConsoleFocusListener } from "./focusTracker/listener/ConsoleFocusListener";

// ── VisitHistoryPlugin ────────────────────────────────────────────────────────
export default class VisitHistoryPlugin extends Plugin {
  settings!: VisitHistoryPluginSettings;
  private focusTracker!: FocusTracker;

  async onload() {
    await this.loadSettings();

    this.focusTracker = new FocusTracker(this);
    this.focusTracker.registerListener(ConsoleFocusListener);

    registerSampleCommands(this);
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