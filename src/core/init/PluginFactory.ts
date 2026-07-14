import { App } from 'obsidian';
import VisitHistoryPlugin from '../../main';
import { FocusTracker } from '../focusTracker/FocusTracker';
import { UserNotifier } from '../util/userComm/UserNotifier';
import { UserNotifierDefault } from '../util/userComm/impl/UserNotifierDefault';
import { NoteFileUtilDefault } from '../util/file/note/impl/NoteFileUtilDefault';
import { HiddenFileUtilDefault } from '../util/file/hidden/impl/HiddenFileUtilDefault';
import { DeviceNameProviderDefault } from '../util/env/DeviceNameProvider';
import { VhV3DurationStore } from '../service/visitHistoryService/v3/VhV3DurationStore';
import { VhV3ReadmeWriter } from '../service/visitHistoryService/v3/VhV3ReadmeWriter';
import { VisitHistoryServiceV3 } from '../service/visitHistoryService/v3/VisitHistoryServiceV3';
import { LastVisitCache } from '../service/visitHistoryService/v3/LastVisitCache';
import { FocusDurationTracker } from '../focusDuration/FocusDurationTracker';
import { VhV3DurationRecorder } from '../focusDuration/VhV3DurationRecorder';
import { WindowActivityMonitor } from '../focusDuration/WindowActivityMonitor';
import { VhV3FocusDurationListener } from '../focusTracker/listener/VhV3FocusDurationListener';
import { VaultUtil, VaultUtilDefault } from '../util/vault/VaultUtil';
import { IsTrackedProvider, IsTrackedProviderDefault } from "../util/vault/IsTrackedProvider";
import { DocIdGeneratorDefault } from '../service/docId/DocIdGenerator';
import { DocIdService, DocIdServiceDefault } from '../service/docId/DocIdService';
import { FrontmatterDocIdStore } from '../service/docId/FrontmatterDocIdStore';
import { CanvasDocIdStore } from '../service/docId/CanvasDocIdStore';
import { DocIdFocusListener } from '../focusTracker/listener/DocIdFocusListener';
import { DocIdBackfillService, DocIdBackfillServiceDefault } from '../service/docId/DocIdBackfillService';
import { VhStartupTasks } from './VhStartupTasks';
import { HeatmapConfigStore, PluginHeatmapConfigStore } from '../../viewModel/HeatmapConfigStore';

// ── PluginFactory ─────────────────────────────────────────────────────────────
// Constructs and wires all plugin dependencies.
// The plugin's onload() calls this once and reads from the resulting instance.
export class PluginFactory {
  readonly userNotifier: UserNotifier;
  readonly focusTracker: FocusTracker;
  readonly vaultUtil: VaultUtil;
  readonly docIdService: DocIdService;
  readonly docIdBackfillService: DocIdBackfillService;
  readonly isTrackedProvider: IsTrackedProvider;
  readonly vhStartupTasks: VhStartupTasks;
  /** V3 duration state machine — main.ts flushes it on unload (dispose()). */
  readonly focusDurationTracker: FocusDurationTracker;
  /** Persists the heatmap view's config panel state across restarts. */
  readonly heatmapConfigStore: HeatmapConfigStore;

  /** userName: resolved once in main.ts (UserNameProvider) before wiring. */
  constructor(plugin: VisitHistoryPlugin, userName: string) {
    const app: App = plugin.app;

    this.userNotifier = new UserNotifierDefault(plugin);
    this.heatmapConfigStore = new PluginHeatmapConfigStore(plugin);

    const noteFileUtil = new NoteFileUtilDefault(app);
    const hiddenFileUtil = new HiddenFileUtilDefault(app);
    const deviceNameProvider = new DeviceNameProviderDefault();
    this.isTrackedProvider = new IsTrackedProviderDefault();

    const docIdGenerator = new DocIdGeneratorDefault();
    this.docIdService = new DocIdServiceDefault(
      new FrontmatterDocIdStore(noteFileUtil, docIdGenerator),
      new CanvasDocIdStore(noteFileUtil, docIdGenerator),
    );

    // Shared by the V3 read path (heatmap last-visit lookups) and the write
    // path (recorder write-through on every recorded session).
    const lastVisitCache = new LastVisitCache();
    const vhV3DurationStore = new VhV3DurationStore(hiddenFileUtil, userName);

    this.focusDurationTracker = new FocusDurationTracker(
      new VhV3DurationRecorder(vhV3DurationStore, lastVisitCache, deviceNameProvider),
      // Live read: a settings-tab change applies without plugin reload.
      () => plugin.settings.idleTimeoutSeconds * 1000,
    );
    // WHY-NOT activeDocument: the monitor needs the MAIN window specifically;
    // it registers popout windows itself.
    // eslint-disable-next-line obsidianmd/prefer-active-doc
    new WindowActivityMonitor(plugin, this.focusDurationTracker, window, document);

    this.focusTracker = new FocusTracker(plugin, this.isTrackedProvider);
    // Doc id listener FIRST: assigning the id is the first thing that happens
    // when a file gains focus (listeners are dispatched in order).
    this.focusTracker.registerListener(new DocIdFocusListener(this.docIdService));
    this.focusTracker.registerListener(
      new VhV3FocusDurationListener(this.docIdService, this.focusDurationTracker),
    );

    const lastVisitProvider = new VisitHistoryServiceV3(
      this.docIdService,
      vhV3DurationStore,
      lastVisitCache,
    );
    this.vaultUtil = new VaultUtilDefault(app, lastVisitProvider, this.isTrackedProvider);
    this.docIdBackfillService = new DocIdBackfillServiceDefault(this.vaultUtil, this.docIdService);

    this.vhStartupTasks = new VhStartupTasks(new VhV3ReadmeWriter(hiddenFileUtil, userName));
  }
}
