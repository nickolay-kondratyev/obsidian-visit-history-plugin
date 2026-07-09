import { App } from 'obsidian';
import VisitHistoryPlugin from '../../main';
import { FocusTracker } from '../focusTracker/FocusTracker';
import { VisitHistoryFocusListenerDefault } from '../focusTracker/listener/VisitHistoryFocusListenerDefault';
import { LinkUtilDefault } from '../util/linkUtil/LinkUtil';
import { UserNotifier } from '../util/userComm/UserNotifier';
import { UserNotifierDefault } from '../util/userComm/impl/UserNotifierDefault';
import { NoteFileUtilDefault } from '../util/file/note/impl/NoteFileUtilDefault';
import { VHFileProvider } from '../focusTracker/listener/VHFileProvider';
import { DeviceNameProviderDefault } from '../util/env/DeviceNameProvider';
import { VisitHistoryService, VisitHistoryServiceDefault } from '../service/visitHistoryService/VisitHistoryService';
import { VaultUtil, VaultUtilDefault } from '../util/vault/VaultUtil';
import { IsTrackedProvider, IsTrackedProviderDefault } from "../util/vault/IsTrackedProvider";
import { FrontmatterUtilDefault } from '../util/file/frontmatter/impl/FrontmatterUtilDefault';
import { DocIdGeneratorDefault } from '../service/docId/DocIdGenerator';
import { DocIdService, DocIdServiceDefault } from '../service/docId/DocIdService';
import { FrontmatterDocIdStore } from '../service/docId/FrontmatterDocIdStore';
import { CanvasDocIdStore } from '../service/docId/CanvasDocIdStore';
import { DocIdFocusListener } from '../focusTracker/listener/DocIdFocusListener';
import { DocIdBackfillService, DocIdBackfillServiceDefault } from '../service/docId/DocIdBackfillService';

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

  constructor(plugin: VisitHistoryPlugin) {
    const app: App = plugin.app;

    this.userNotifier = new UserNotifierDefault(plugin);

    const linkUtil = new LinkUtilDefault(app);
    const noteFileUtil = new NoteFileUtilDefault(app);
    const deviceNameProvider = new DeviceNameProviderDefault();
    this.isTrackedProvider = new IsTrackedProviderDefault();

    const vhFileProvider = new VHFileProvider(
      linkUtil,
      this.userNotifier,
      noteFileUtil,
      deviceNameProvider,
    );
    this.visitHistoryService = new VisitHistoryServiceDefault(vhFileProvider, noteFileUtil);

    const frontmatterUtil = new FrontmatterUtilDefault(app);
    const docIdGenerator = new DocIdGeneratorDefault();
    this.docIdService = new DocIdServiceDefault(
      new FrontmatterDocIdStore(frontmatterUtil, noteFileUtil, docIdGenerator),
      new CanvasDocIdStore(noteFileUtil, docIdGenerator),
    );

    this.focusTracker = new FocusTracker(plugin, this.isTrackedProvider);
    // Doc id listener FIRST: assigning the id is the first thing that happens
    // when a file gains focus (listeners are dispatched in order).
    this.focusTracker.registerListener(new DocIdFocusListener(this.docIdService));
    this.focusTracker.registerListener(
      new VisitHistoryFocusListenerDefault(this.visitHistoryService),
    );

    this.vaultUtil = new VaultUtilDefault(app, this.visitHistoryService, this.isTrackedProvider);
    this.docIdBackfillService = new DocIdBackfillServiceDefault(this.vaultUtil, this.docIdService);
  }
}