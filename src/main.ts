import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, VisitHistoryPluginSettings } from './settings';
import { registerSampleCommands } from './sample/registerSampleCommands';
import { FocusTracker } from "./focusTracker/FocusTracker";
import { VisitHistoryFocusListenerDefault } from "./focusTracker/listener/VisitHistoryFocusListenerDefault";
import { LinkUtilDefault } from "./util";
import { OutFactoryConsole } from "./util/out/impl/OutConsole";
import { UserNotifier } from "./util/userComm/UserNotifier";
import { UserNotifierDefault } from "./util/userComm/impl/UserNotifierDefault";
import { NoteFileUtilDefault } from "./util/file/note/impl/NoteFileUtilDefault";
import { VHFileProvider } from "./focusTracker/listener/VHFileProvider";

// ── VisitHistoryPlugin ────────────────────────────────────────────────────────
export default class VisitHistoryPlugin extends Plugin {
  settings!: VisitHistoryPluginSettings;
  private focusTracker!: FocusTracker;
  userNotifier: UserNotifier = new UserNotifierDefault(this);

  async onload() {
    await this.loadSettings();

    const linkUtil = new LinkUtilDefault(this.app);
    const outFactory = new OutFactoryConsole();

    const noteFileUtil = new NoteFileUtilDefault(this.app);
    this.focusTracker = new FocusTracker(this);
    const vhFileProvider = new VHFileProvider(linkUtil, this.userNotifier, noteFileUtil);
    const focusListener = new VisitHistoryFocusListenerDefault(
      vhFileProvider, noteFileUtil);

    this.focusTracker.registerListener(focusListener);

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