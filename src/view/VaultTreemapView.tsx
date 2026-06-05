import { ItemView, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import { App as TreemapApp } from './components/App';
import { buildVaultTree } from '../viewModel/buildVaultTree';
import type { VaultNode } from '../core/data/VaultNode';
import type VisitHistoryPlugin from '../main';
import { VaultUtilDefault } from '../core/util/vault/VaultUtil';
import { VisitHistoryServiceDefault } from '../core/service/visitHistoryService/VisitHistoryService';
import { VHFileProvider } from '../core/focusTracker/listener/VHFileProvider';
import { LinkUtilDefault } from '../core/util';
import { NoteFileUtilDefault } from '../core/util/file/note/impl/NoteFileUtilDefault';
import { DeviceNameProviderDefault } from '../core/util/env/DeviceNameProvider';
import { PluginFactory } from "../core/init/PluginFactory";
import { ObsidianFileOpener } from '../viewModel/FileOpener';

// ── Constants ───────────────────────────────────────────────────────────────

export const VIEW_TYPE_TREEMAP = 'vault-heatmap';

// ── ItemView ────────────────────────────────────────────────────────────────

/**
 * Obsidian ItemView host for the vault heatmap visualization.
 *
 * This is the **only file in src/view/ that imports from 'obsidian'**.
 *
 * Responsibilities:
 * - Mounts/unmounts the React tree inside an Obsidian leaf panel.
 * - Calls buildVaultTree() with visited timestamps from the plugin's existing
 *   visit tracking infrastructure.
 * - Re-renders on vault change events (create/delete/rename).
 */
export class VaultTreemapView extends ItemView {
  private root: Root | null = null;
  private readonly pluginFactory: PluginFactory;
  private refreshTimer: number | null = null;
  private readonly REFRESH_DEBOUNCE_MS = 500;

  constructor(leaf: WorkspaceLeaf, pluginFactory: PluginFactory) {
    super(leaf);
    this.pluginFactory = pluginFactory;
  }

  getViewType(): string {
    return VIEW_TYPE_TREEMAP;
  }

  getDisplayText(): string {
    return 'vault heatmap';
  }

  getIcon(): string {
    return 'layout-grid';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    if (!container) {
      throw new Error('VaultTreemapView: container element not found');
    }
    container.addClass('vault-heatmap-view');
    this.root = createRoot(container);
    await this.refresh();

    // Re-render on vault file changes (debounced to avoid excessive rebuilds
    // during batch operations like template expansion or bulk renames).
    this.registerEvent(this.app.vault.on('create', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('delete', () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on('rename', () => this.scheduleRefresh()));
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Schedules a debounced refresh. Multiple rapid vault events (e.g. batch
   * rename, template expansion) are coalesced into a single refresh that
   * fires after {@link REFRESH_DEBOUNCE_MS} ms of inactivity.
   */
  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refresh().catch(console.error);
    }, this.REFRESH_DEBOUNCE_MS);
  }

  private async refresh(): Promise<void> {
    const visitedMsMap = await this.getVisitedTimestamps();
    const data: VaultNode = await buildVaultTree(this.pluginFactory.vaultUtil, visitedMsMap);

    const fileOpener = new ObsidianFileOpener(this.app);

    this.root?.render(<TreemapApp data={data} fileOpener={fileOpener}/>);
  }

  /**
   * Builds the visited-timestamp map from existing visit history infrastructure.
   *
   * Uses VaultUtilDefault.getTrackedFiles() which calls
   * VisitHistoryService.getLastVisitStamp() per file (with LRU caching).
   * Files with no visit history are excluded from the map → VaultNode.lastVisitedAt = null.
   */
  private async getVisitedTimestamps(): Promise<Record<string, number>> {
    const trackedFiles = await this.pluginFactory.vaultUtil.getTrackedFiles();

    const result: Record<string, number> = {};
    for (const tf of trackedFiles) {
      if (tf.timeMetadata.visitedMs !== null) {
        result[tf.file.path] = tf.timeMetadata.visitedMs.valueOf();
      }
    }

    return result;
  }
}
