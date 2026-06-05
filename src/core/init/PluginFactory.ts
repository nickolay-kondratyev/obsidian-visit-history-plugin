import { App } from 'obsidian';
import VisitHistoryPlugin from '../../main';
import { FocusTracker } from '../focusTracker/FocusTracker';
import { VisitHistoryFocusListenerDefault } from '../focusTracker/listener/VisitHistoryFocusListenerDefault';
import { LinkUtilDefault } from '../util';
import { UserNotifier } from '../util/userComm/UserNotifier';
import { UserNotifierDefault } from '../util/userComm/impl/UserNotifierDefault';
import { NoteFileUtilDefault } from '../util/file/note/impl/NoteFileUtilDefault';
import { VHFileProvider } from '../focusTracker/listener/VHFileProvider';
import { DeviceNameProviderDefault } from '../util/env/DeviceNameProvider';
import { VisitHistoryService, VisitHistoryServiceDefault } from '../service/visitHistoryService/VisitHistoryService';
import { VaultUtil, VaultUtilDefault } from '../util/vault/VaultUtil';
import { IsTrackedProvider, IsTrackerProviderDefault } from "../util/vault/IsTrackedProvider";

// ── PluginFactory ─────────────────────────────────────────────────────────────
// Constructs and wires all plugin dependencies.
// The plugin's onload() calls this once and reads from the resulting instance.
export class PluginFactory {
  readonly userNotifier: UserNotifier;
  readonly focusTracker: FocusTracker;
  readonly vaultUtil: VaultUtil;
  readonly visitHistoryService: VisitHistoryService;
  readonly isTrackedProvider: IsTrackedProvider;

  constructor(plugin: VisitHistoryPlugin) {
    const app: App = plugin.app;

    this.userNotifier = new UserNotifierDefault(plugin);

    const linkUtil = new LinkUtilDefault(app);
    const noteFileUtil = new NoteFileUtilDefault(app);
    const deviceNameProvider = new DeviceNameProviderDefault();
    this.isTrackedProvider = new IsTrackerProviderDefault();

    const vhFileProvider = new VHFileProvider(
      linkUtil,
      this.userNotifier,
      noteFileUtil,
      deviceNameProvider,
    );
    this.visitHistoryService = new VisitHistoryServiceDefault(vhFileProvider, noteFileUtil);

    this.focusTracker = new FocusTracker(plugin, this.isTrackedProvider);
    this.focusTracker.registerListener(
      new VisitHistoryFocusListenerDefault(this.visitHistoryService),
    );

    this.vaultUtil = new VaultUtilDefault(app, this.visitHistoryService, this.isTrackedProvider);
  }
}