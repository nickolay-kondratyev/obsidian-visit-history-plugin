import { App } from 'obsidian';
import VisitHistoryPlugin from '../../main';
import { FocusTracker } from '../focusTracker/FocusTracker';
import { VisitHistoryFocusListenerDefault } from '../focusTracker/listener/VisitHistoryFocusListenerDefault';
import { LinkUtilDefault } from '../util/linkUtil/LinkUtil';
import { UserNotifier } from '../util/userComm/UserNotifier';
import { UserNotifierDefault } from '../util/userComm/impl/UserNotifierDefault';
import { NoteFileUtilDefault } from '../util/file/note/impl/NoteFileUtilDefault';
import { HiddenFileUtilDefault } from '../util/file/hidden/impl/HiddenFileUtilDefault';
import { DeviceNameProviderDefault } from '../util/env/DeviceNameProvider';
import { VisitHistoryService } from '../service/visitHistoryService/VisitHistoryService';
import { VisitHistoryServiceV2 } from '../service/visitHistoryService/v2/VisitHistoryServiceV2';
import { VhV2FocusStore } from '../service/visitHistoryService/v2/VhV2FocusStore';
import { VhV2ReadmeWriter } from '../service/visitHistoryService/v2/VhV2ReadmeWriter';
import { VhV3DurationStore } from '../service/visitHistoryService/v3/VhV3DurationStore';
import { VhV3ReadmeWriter } from '../service/visitHistoryService/v3/VhV3ReadmeWriter';
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
import { V1FocusFileRepoDefault } from '../service/migration/V1FocusFileRepo';
import { VhV1ToV2MigrationService } from '../service/migration/VhV1ToV2MigrationService';
import { VhStartupTasks } from './VhStartupTasks';

// ── PluginFactory ─────────────────────────────────────────────────────────────
// Constructs and wires all plugin dependencies.
// The plugin's onload() calls this once and reads from the resulting instance.
export class PluginFactory {
  readonly userNotifier: UserNotifier;
  readonly focusTracker: FocusTracker;
  readonly vaultUtil: VaultUtil;
  readonly visitHistoryService: VisitHistoryService;
  readonly docIdService: DocIdService;
  readonly docIdBackfillService: DocIdBackfillService;
  readonly isTrackedProvider: IsTrackedProvider;
  readonly vhStartupTasks: VhStartupTasks;
  /** V3 duration state machine — main.ts flushes it on unload (dispose()). */
  readonly focusDurationTracker: FocusDurationTracker;

  constructor(plugin: VisitHistoryPlugin) {
    const app: App = plugin.app;

    this.userNotifier = new UserNotifierDefault(plugin);

    const linkUtil = new LinkUtilDefault(app);
    const noteFileUtil = new NoteFileUtilDefault(app);
    const hiddenFileUtil = new HiddenFileUtilDefault(app);
    const deviceNameProvider = new DeviceNameProviderDefault();
    this.isTrackedProvider = new IsTrackedProviderDefault();

    const docIdGenerator = new DocIdGeneratorDefault();
    this.docIdService = new DocIdServiceDefault(
      new FrontmatterDocIdStore(noteFileUtil, docIdGenerator),
      new CanvasDocIdStore(noteFileUtil, docIdGenerator),
    );

    const vhV2FocusStore = new VhV2FocusStore(hiddenFileUtil);
    const visitHistoryServiceV2 = new VisitHistoryServiceV2(
      this.docIdService,
      vhV2FocusStore,
      deviceNameProvider,
    );
    this.visitHistoryService = visitHistoryServiceV2;

    // V3 (focus DURATIONS) is recorded alongside V2 — V2 stays the main history.
    this.focusDurationTracker = new FocusDurationTracker(
      new VhV3DurationRecorder(new VhV3DurationStore(hiddenFileUtil), deviceNameProvider),
    );
    new WindowActivityMonitor(plugin, this.focusDurationTracker);

    this.focusTracker = new FocusTracker(plugin, this.isTrackedProvider);
    // Doc id listener FIRST: assigning the id is the first thing that happens
    // when a file gains focus (listeners are dispatched in order).
    this.focusTracker.registerListener(new DocIdFocusListener(this.docIdService));
    this.focusTracker.registerListener(
      new VisitHistoryFocusListenerDefault(this.visitHistoryService),
    );
    this.focusTracker.registerListener(
      new VhV3FocusDurationListener(this.docIdService, this.focusDurationTracker),
    );

    this.vaultUtil = new VaultUtilDefault(app, this.visitHistoryService, this.isTrackedProvider);
    this.docIdBackfillService = new DocIdBackfillServiceDefault(this.vaultUtil, this.docIdService);

    const migrationService = new VhV1ToV2MigrationService(
      new V1FocusFileRepoDefault(app),
      noteFileUtil,
      linkUtil,
      this.docIdService,
      this.docIdBackfillService,
      vhV2FocusStore,
    );
    this.vhStartupTasks = new VhStartupTasks(
      new VhV2ReadmeWriter(hiddenFileUtil),
      new VhV3ReadmeWriter(hiddenFileUtil),
      migrationService,
      visitHistoryServiceV2,
      this.userNotifier,
    );
  }
}
