import { ItemView, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import { App as TreemapApp } from './components/App';
import { buildVaultTree } from '../viewModel/buildVaultTree';
import { PluginFactory } from "../core/init/PluginFactory";
import { ObsidianFileOpener } from '../viewModel/FileOpener';

// ── Constants ───────────────────────────────────────────────────────────────

export const VIEW_TYPE_TREEMAP = 'vault-heatmap';

/**
 * Body class applied while a heatmap view is ACTIVE — styles.css hides the
 * status bar under it. Toggled by the workspace-level listener in main.ts;
 * removing the class restores the status bar to whatever state other
 * plugins/themes gave it (we never touch its inline styles).
 */
export const CSS_CLASS_HEATMAP_ACTIVE = 'vault-heatmap-active';

// ── ItemView ────────────────────────────────────────────────────────────────

/**
 * Obsidian ItemView host for the vault heatmap visualization.
 *
 * This is the **only file in src/view/ that imports from 'obsidian'**.
 *
 * Responsibilities:
 * - Mounts/unmounts the React tree inside an Obsidian leaf panel.
 * - Builds the VaultNode tree from the plugin's visit tracking infrastructure.
 * - Re-renders on vault change events (create/delete/rename).
 */
export class VaultTreemapView extends ItemView {
  private root: Root | null = null;
  private readonly pluginFactory: PluginFactory;
  private refreshTimer: number | null = null;
  private readonly REFRESH_DEBOUNCE_MS = 500;
  /**
   * Vault folder the heatmap starts drilled into (from the file-tree context
   * menu), or undefined for the full vault. Persisted via getState so the
   * view survives workspace layout save/restore.
   */
  private folderPath: string | undefined;

  constructor(leaf: WorkspaceLeaf, pluginFactory: PluginFactory) {
    super(leaf);
    this.pluginFactory = pluginFactory;
  }

  getViewType(): string {
    return VIEW_TYPE_TREEMAP;
  }

  getDisplayText(): string {
    return 'Vault heatmap';
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

  // ── View state (folder targeting) ─────────────────────────────────────

  override async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const folderPath =
      state && typeof state === 'object' && 'folderPath' in state
        ? state.folderPath
        : undefined;
    this.folderPath = typeof folderPath === 'string' ? folderPath : undefined;
    await super.setState(state, result);
    // Re-render if already mounted (setState can arrive after onOpen, e.g.
    // when an existing leaf is re-targeted at a different folder).
    if (this.root) {
      await this.refresh();
    }
  }

  override getState(): Record<string, unknown> {
    return { folderPath: this.folderPath };
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
    const vaultUtil = this.pluginFactory.vaultUtil;
    // Single vault walk: visit stamps ride along on TrackedFile (LRU-cached
    // per file inside VisitHistoryService).
    const trackedFiles = await vaultUtil.getTrackedFiles();
    const data = buildVaultTree(vaultUtil.getName(), trackedFiles);

    const fileOpener = new ObsidianFileOpener(this.app);

    this.root?.render(
      // key: remount App (fresh nav state) when the target folder changes;
      // plain refreshes keep the key stable, preserving user navigation.
      <TreemapApp
        key={this.folderPath ?? ''}
        data={data}
        fileOpener={fileOpener}
        initialFolderPath={this.folderPath}
      />,
    );
  }
}
