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

// ── Constants ───────────────────────────────────────────────────────────────

export const VIEW_TYPE_TREEMAP = 'vault-treemap';

// ── ItemView ────────────────────────────────────────────────────────────────

/**
 * Obsidian ItemView host for the vault treemap visualization.
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
  private plugin: VisitHistoryPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: VisitHistoryPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_TREEMAP;
  }

  getDisplayText(): string {
    return 'Vault Treemap';
  }

  getIcon(): string {
    return 'layout-grid';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    if (!container) {
      throw new Error('VaultTreemapView: container element not found');
    }
    container.addClass('vault-treemap-view');
    this.root = createRoot(container);
    await this.refresh();

    // Re-render on vault file changes
    this.registerEvent(this.app.vault.on('create', () => this.refresh()));
    this.registerEvent(this.app.vault.on('delete', () => this.refresh()));
    this.registerEvent(this.app.vault.on('rename', () => this.refresh()));
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private async refresh(): Promise<void> {
    const visitedMsMap = await this.getVisitedTimestamps();
    const data: VaultNode = await buildVaultTree(this.app.vault, visitedMsMap);
    this.root?.render(<TreemapApp data={data} />);
  }

  /**
   * Builds the visited-timestamp map from existing visit history infrastructure.
   *
   * Uses VaultUtilDefault.getTrackedFiles() which calls
   * VisitHistoryService.getLastVisitStamp() per file (with LRU caching).
   * Files with no visit history are excluded from the map → VaultNode.lastVisitedAt = null.
   *
   * TODO: refactor to use a single service instance from the plugin rather than
   * constructing the dependency chain inline. The plugin already creates these
   * in onload() — they should be stored as instance properties.
   */
  private async getVisitedTimestamps(): Promise<Record<string, number>> {
    const linkUtil = new LinkUtilDefault(this.app);
    const noteFileUtil = new NoteFileUtilDefault(this.app);
    const deviceNameProvider = new DeviceNameProviderDefault();
    const vhFileProvider = new VHFileProvider(
      linkUtil,
      this.plugin.userNotifier,
      noteFileUtil,
      deviceNameProvider,
    );
    const visitHistoryService = new VisitHistoryServiceDefault(
      vhFileProvider,
      noteFileUtil,
    );
    const vaultUtil = new VaultUtilDefault(this.app, visitHistoryService);

    const trackedFiles = await vaultUtil.getTrackedFiles();
    const result: Record<string, number> = {};
    for (const tf of trackedFiles) {
      if (tf.timeMetadata.visitedMs !== null) {
        result[tf.file.path] = tf.timeMetadata.visitedMs.valueOf();
      }
    }
    return result;
  }
}
