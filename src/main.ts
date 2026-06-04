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
import { DeviceNameProviderDefault } from "./util/env/DeviceNameProvider";
import { VisitHistoryServiceDefault } from "./service/visitHistoryService/VisitHistoryService";
import { VaultUtilDefault } from "./util/vault/VaultUtil";

// ── VisitHistoryPlugin ────────────────────────────────────────────────────────
export default class VisitHistoryPlugin extends Plugin {
  settings!: VisitHistoryPluginSettings;
  private focusTracker!: FocusTracker;
  userNotifier: UserNotifier = new UserNotifierDefault(this);

  async onload() {
    await this.loadSettings();

    const linkUtil = new LinkUtilDefault(this.app);
    const outFactory = new OutFactoryConsole();

    const deviceNameProvider = new DeviceNameProviderDefault();
    const noteFileUtil = new NoteFileUtilDefault(this.app);
    this.focusTracker = new FocusTracker(this);
    const vhFileProvider = new VHFileProvider(linkUtil, this.userNotifier, noteFileUtil, deviceNameProvider);
    const visitHistoryService = new VisitHistoryServiceDefault(vhFileProvider, noteFileUtil);
    const focusListener = new VisitHistoryFocusListenerDefault(
      visitHistoryService);
    const vaultUtil = new VaultUtilDefault(this.app, visitHistoryService);

    this.focusTracker.registerListener(focusListener);

    registerSampleCommands(this);

    const before = Date.now();
    const trackedFiles = await vaultUtil.getTrackedFiles();
    const taken = Date.now() - before;
    console.log(`[VHP] tracked files took [${taken}]ms`, trackedFiles);

    console.log("[VHP] tracked files with visit meta1",
      trackedFiles.filter(f => f.timeMetadata.visitedMs !== null));
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