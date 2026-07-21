import { App } from 'obsidian';
import VisitHistoryPlugin from '../../main';
import { FocusTracker } from '../focusTracker/FocusTracker';
import { UserNotifier } from '../util/userComm/UserNotifier';
import { UserNotifierDefault } from '../util/userComm/impl/UserNotifierDefault';
import { NoteFileUtilDefault } from '../util/file/note/impl/NoteFileUtilDefault';
import { HiddenFileUtil } from '../util/file/hidden/HiddenFileUtil';
import { HiddenFileUtilDefault } from '../util/file/hidden/impl/HiddenFileUtilDefault';
import { DeviceNameProvider, DeviceNameProviderDefault } from '../util/env/DeviceNameProvider';
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
import { DocIdService, DocIdServices } from 'obsidian-id-lib';
import { DocIdFocusListener } from '../focusTracker/listener/DocIdFocusListener';
import { DocIdBackfillService, DocIdBackfillServiceDefault } from '../service/docId/DocIdBackfillService';
import { VhStartupTasks } from './VhStartupTasks';
import { HeatmapConfigStore, PluginHeatmapConfigStore } from '../../viewModel/HeatmapConfigStore';
import { ContentTermMatcher, ContentTermMatcherDefault } from '../../viewModel/ContentTermMatcher';
import { UserNameProvider, UserNameProviderDefault } from '../service/visitHistoryService/user/UserNameProvider';
import { ModalUserNamePrompt } from '../service/visitHistoryService/user/impl/ModalUserNamePrompt';

// ── PluginFactory ─────────────────────────────────────────────────────────────
// Constructs and wires all plugin dependencies.
// The plugin's onload() calls this once and reads from the resulting instance.
//
// Wiring is split around the user-name pin: the constructor wires everything
// NAME-INDEPENDENT (heatmap reads aggregate across all users; doc-id
// assignment is user-agnostic), while everything that writes user-scoped VH
// data waits for activateUserScopedRecording(userName) — called by main.ts
// once the human confirms a name in the user-name modal. With no pinned name
// (modal dismissed) recording machinery is simply never constructed.
export class PluginFactory {
  readonly userNotifier: UserNotifier;
  readonly focusTracker: FocusTracker;
  readonly vaultUtil: VaultUtil;
  readonly docIdService: DocIdService;
  readonly docIdBackfillService: DocIdBackfillService;
  readonly isTrackedProvider: IsTrackedProvider;
  /** Resolves the pinned user name, prompting via the modal when unpinned. */
  readonly userNameProvider: UserNameProvider;
  /** Persists the heatmap view's config panel state across restarts. */
  readonly heatmapConfigStore: HeatmapConfigStore;
  /** Resolves the heatmap's CONTENT filter terms to matching file paths. */
  readonly contentTermMatcher: ContentTermMatcher;

  // Held for activateUserScopedRecording (post-pin wiring).
  private readonly plugin: VisitHistoryPlugin;
  private readonly hiddenFileUtil: HiddenFileUtil;
  /** Concrete handle so dispose() can close a still-open user-name modal. */
  private readonly modalUserNamePrompt: ModalUserNamePrompt;
  private readonly deviceNameProvider: DeviceNameProvider;
  private readonly lastVisitCache: LastVisitCache;
  private readonly vhV3DurationStore: VhV3DurationStore;
  /** V3 duration state machine; undefined until a user name is pinned. */
  private focusDurationTracker?: FocusDurationTracker;
  /**
   * Held for explicit ownership only. The monitor self-registers ALL its DOM
   * listeners via plugin.registerDomEvent / workspace events in its ctor (kept
   * alive by the plugin's Obsidian lifecycle, not by this reference), so it
   * needs no method calls after construction — but discarding the `new` result
   * reads as a useless instantiation. Undefined until a user name is pinned.
   */
  private windowActivityMonitor?: WindowActivityMonitor;

  constructor(plugin: VisitHistoryPlugin) {
    const app: App = plugin.app;
    this.plugin = plugin;

    this.userNotifier = new UserNotifierDefault(plugin);
    this.heatmapConfigStore = new PluginHeatmapConfigStore(plugin);

    const noteFileUtil = new NoteFileUtilDefault(app);
    this.hiddenFileUtil = new HiddenFileUtilDefault(app);
    this.deviceNameProvider = new DeviceNameProviderDefault();
    this.isTrackedProvider = new IsTrackedProviderDefault();
    this.modalUserNamePrompt = new ModalUserNamePrompt(app);
    this.userNameProvider = new UserNameProviderDefault(this.hiddenFileUtil, this.modalUserNamePrompt);

    // obsidian-id-lib default wiring: generator + stores + the cross-plugin
    // per-path window lock guarding ensureDocId.
    this.docIdService = DocIdServices.createDefault(app.vault);

    // Shared by the V3 read path (heatmap last-visit lookups) and the write
    // path (recorder write-through on every recorded session).
    this.lastVisitCache = new LastVisitCache();
    // Name-free store: the aggregate read spans ALL users, so the heatmap
    // works even before (or without) a pinned user name.
    this.vhV3DurationStore = new VhV3DurationStore(this.hiddenFileUtil);

    this.focusTracker = new FocusTracker(plugin, this.isTrackedProvider);
    // Doc id listener FIRST: assigning the id is the first thing that happens
    // when a file gains focus (listeners are dispatched in order). The V3
    // duration listener joins LATE, in activateUserScopedRecording — its
    // registration order relative to this one is preserved by the push.
    this.focusTracker.registerListener(new DocIdFocusListener(this.docIdService));

    const lastVisitProvider = new VisitHistoryServiceV3(
      this.docIdService,
      this.vhV3DurationStore,
      this.lastVisitCache,
    );
    this.vaultUtil = new VaultUtilDefault(app, lastVisitProvider, this.isTrackedProvider);
    this.docIdBackfillService = new DocIdBackfillServiceDefault(this.vaultUtil, this.docIdService);
    this.contentTermMatcher = new ContentTermMatcherDefault(this.vaultUtil, noteFileUtil);
  }

  /**
   * Wires everything that writes user-scoped VH data. Called ONCE by main.ts
   * after a user name is pinned (never with a dismissed modal). From here on
   * focus sessions are tracked and recorded; the V3 README write is kicked
   * off fire-and-forget (VhStartupTasks is error-isolated).
   */
  activateUserScopedRecording(userName: string): void {
    if (this.focusDurationTracker !== undefined) {
      console.error('[VHP][PluginFactory] recording already activated — ignoring repeat activation');
      return;
    }

    // The MAIN Obsidian window — rootSplit is ready by onLayoutReady (when this
    // runs). WHY-NOT activeDocument: both the tracker's timers and the monitor
    // need the MAIN window specifically; the monitor registers popouts itself.
    const mainWindow = this.plugin.app.workspace.rootSplit.win;
    const mainDocument = this.plugin.app.workspace.rootSplit.doc;

    this.focusDurationTracker = new FocusDurationTracker(
      new VhV3DurationRecorder(this.vhV3DurationStore, this.lastVisitCache, this.deviceNameProvider, userName),
      // Live read: a settings-tab change applies without plugin reload.
      () => this.plugin.settings.idleTimeoutSeconds * 1000,
      mainWindow,
    );
    this.windowActivityMonitor = new WindowActivityMonitor(this.plugin, this.focusDurationTracker, mainWindow, mainDocument);
    const durationListener = new VhV3FocusDurationListener(this.docIdService, this.focusDurationTracker);
    this.focusTracker.registerListener(durationListener);
    // Replay: this listener registers AFTER workspace-layout restore (and
    // after any time the user-name modal was open), so the currently focused
    // doc's focus event already fired — replay it so its session opens.
    this.focusTracker.replayLastFocusTo(durationListener);

    void new VhStartupTasks(new VhV3ReadmeWriter(this.hiddenFileUtil, userName)).run();
  }

  /**
   * Best-effort flush of an in-progress V3 focus session (main.ts onunload).
   * Safe when recording was never activated (no pinned name this session).
   * Also closes a still-open user-name modal — it must not outlive the
   * plugin (a post-unload confirm would pin and activate on a dead plugin).
   */
  dispose(): void {
    this.modalUserNamePrompt.closeOpenPrompt();
    this.focusDurationTracker?.dispose();
  }
}
