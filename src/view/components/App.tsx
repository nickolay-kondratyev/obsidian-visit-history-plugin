import { useState, useCallback, useMemo } from 'react';
import { Header } from './Header';
import { ConfigPanel } from './ConfigPanel';
import { TreemapViz } from './TreemapViz';
import type { VaultNode } from '../../core/data/VaultNode';
import type { IFileOpener } from '../../viewModel/FileOpener';
import type { HeatmapConfig } from '../../viewModel/heatmapConfig';
import type { HeatmapConfigStore } from '../../viewModel/HeatmapConfigStore';
import { findFolderTrail } from '../../viewModel/folderTrail';
import { isWithinArchive } from '../../viewModel/pruneArchiveFolders';

interface AppProps {
  data: VaultNode;
  fileOpener: IFileOpener;
  /** Loads the initial config and persists every change (sticky settings). */
  configStore: HeatmapConfigStore;
  /**
   * Vault folder path to start drilled into (e.g. from the file-tree context
   * menu). Read once on mount; the host remounts App (via React key) when it
   * changes. Ignored when the path is absent from the tree.
   */
  initialFolderPath?: string;
}

/**
 * Top-level state owner for the treemap view.
 *
 * Obsidian-agnostic — receives `data` as a prop from the ItemView host.
 * All config state lives here and threads down to children. Config changes
 * are written through to the HeatmapConfigStore so they survive restarts.
 * Stats bubble up from TreemapViz via onStatsChange.
 *
 * Folder drill-down:
 * - `currentRoot` is the subtree currently displayed (null = full vault).
 * - `navStack` is the history of ancestor nodes for "go back" navigation.
 * - Drilling into a folder pushes the previous root onto the stack.
 * - "Back" pops the stack — the popped item becomes the new currentRoot.
 */
export function App({ data, fileOpener, configStore, initialFolderPath }: AppProps) {
  const [config, setConfig] = useState<HeatmapConfig>(() => configStore.load());
  const [configOpen, setConfigOpen] = useState(false);
  const [stats, setStats] = useState({ files: 0, folders: 0, size: '—' });

  /** Applies a config change AND writes it through to the persistent store. */
  function updateConfig(partial: Partial<HeatmapConfig>): void {
    const next = { ...config, ...partial };
    setConfig(next);
    configStore.save(next);
  }

  // TreemapViz consumes plain per-type factors — strip the slider bounds.
  const scaleFactors = useMemo(
    () =>
      Object.fromEntries(Object.entries(config.scales).map(([type, s]) => [type, s.value])),
    [config.scales],
  );

  // ── Folder drill-down state ──────────────────────────────────────────────

  /**
   * History of ancestor nodes for "go back". Each entry is a parent we can return to.
   * Seeded with the full ancestor trail when opened on a folder (file-tree context
   * menu), so "back" walks up parent-by-parent to the vault root.
   */
  const [navStack, setNavStack] = useState<VaultNode[]>(
    () => (initialFolderPath ? findFolderTrail(data, initialFolderPath) : null) ?? [],
  );
  /** Currently drilled-into folder subtree, or null to show full vault. */
  const [currentRoot, setCurrentRoot] = useState<VaultNode | null>(
    // Lazy initializer runs during the first render — navStack already holds
    // its seeded initial value, and its last entry IS the current root.
    () => (navStack.length > 0 ? navStack[navStack.length - 1]! : null),
  );

  const handleFolderClick = useCallback((folder: VaultNode) => {
    setNavStack(prev => [...prev, folder]);
    setCurrentRoot(folder);
  }, []);

  const handleBack = useCallback(() => {
    setNavStack(prev => {
      if (prev.length === 0) return prev;
      // The last item in the stack IS our currentRoot — we want its parent.
      // Pop the last item; the new last (if any) becomes currentRoot.
      const next = prev.slice(0, -1);
      setCurrentRoot(next.length > 0 ? next[next.length - 1]! : null);
      return next;
    });
  }, []);

  // Derive breadcrumb path segments from the nav stack for the Header display.
  const breadcrumb = useMemo(
    () => navStack.map(n => n.name),
    [navStack],
  );

  // Within an archive ALL archived content is visible (nested archives
  // included) — TreemapViz skips its _archive pruning then.
  const showArchived = useMemo(() => isWithinArchive(navStack), [navStack]);

  return (
    <>
      <Header
        colorMode={config.colorMode}
        gradKey={config.gradKey}
        field={config.field}
        stats={stats}
        onConfigToggle={() => setConfigOpen(o => !o)}
        breadcrumb={breadcrumb}
        onBack={navStack.length > 0 ? handleBack : undefined}
      />
      <ConfigPanel
        open={configOpen}
        config={config}
        onConfigChange={updateConfig}
      />
      <TreemapViz
        data={data}
        currentRoot={currentRoot}
        showArchived={showArchived}
        colorMode={config.colorMode}
        gradKey={config.gradKey}
        field={config.field}
        hotDays={config.hotDays.value}
        coldDays={config.coldDays.value}
        scales={scaleFactors}
        onStatsChange={setStats}
        onFolderClick={handleFolderClick}
        fileOpener={fileOpener}
      />
    </>
  );
}
