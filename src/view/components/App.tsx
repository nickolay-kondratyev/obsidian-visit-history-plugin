import { useState, useCallback, useMemo } from 'react';
import { Header } from './Header';
import { ConfigPanel } from './ConfigPanel';
import { TreemapViz } from './TreemapViz';
import type { VaultNode } from '../../core/data/VaultNode';
import type { IFileOpener } from '../../viewModel/FileOpener';
import type { HeatmapConfig } from '../../viewModel/heatmapConfig';
import type { HeatmapConfigStore } from '../../viewModel/HeatmapConfigStore';
import type { ContentTermMatcher } from '../../viewModel/ContentTermMatcher';
import { findFolderTrail } from '../../viewModel/folderTrail';
import { isWithinArchive } from '../../viewModel/pruneArchiveFolders';

interface AppProps {
  data: VaultNode;
  fileOpener: IFileOpener;
  /** Loads the initial config and persists every change (sticky settings). */
  configStore: HeatmapConfigStore;
  /** Resolves CONTENT filter terms to matching file paths (async, Obsidian-backed). */
  contentTermMatcher: ContentTermMatcher;
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
 * - `folderSegments` (vault-relative folder path) is the ONLY nav state;
 *   the ancestor trail / current root derive from it against the canonical
 *   `data` tree each render. WHY path-based: TreemapViz renders pruned/filtered
 *   COPIES of the tree — storing clicked nodes would pin nav to a stale copy
 *   (files removed by a filter could never come back; vault refreshes would
 *   keep showing the old subtree).
 * - Drilling appends the clicked folder's root-relative segments; "back"
 *   drops the last segment — walking up one level at a time.
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

  // ── Folder drill-down state (path-based — see component doc) ────────────

  /** Vault-relative folder path segments of the view root ([] = full vault). */
  const [folderSegments, setFolderSegments] = useState<string[]>(
    () => (initialFolderPath ? initialFolderPath.split('/') : []),
  );

  // Ancestor trail derived against the canonical tree; an unresolvable path
  // (folder deleted/renamed) falls back to the vault root — no ghost breadcrumb.
  const trail = useMemo(
    () =>
      folderSegments.length > 0
        ? (findFolderTrail(data, folderSegments.join('/')) ?? [])
        : [],
    [data, folderSegments],
  );
  const currentRoot: VaultNode | null =
    trail.length > 0 ? trail[trail.length - 1]! : null;

  const handleFolderClick = useCallback(
    (relativeSegments: string[]) => {
      // Clicked segments are RELATIVE to the RENDERED root (TreemapViz builds
      // its hierarchy over currentRoot ?? data). Append to the RESOLVED trail
      // rather than raw state so a stale unresolvable path cannot poison the
      // next click (trail is [] then — the click resolves from vault root).
      setFolderSegments([...trail.map(n => n.name), ...relativeSegments]);
    },
    [trail],
  );

  const handleBack = useCallback(() => {
    setFolderSegments(trail.slice(0, -1).map(n => n.name));
  }, [trail]);

  // Breadcrumb derives from the RESOLVED trail (not raw segments) so it
  // always names what is actually rendered.
  const breadcrumb = useMemo(() => trail.map(n => n.name), [trail]);

  // Within an archive ALL archived content is visible (nested archives
  // included) — TreemapViz skips its _archive pruning then.
  const showArchived = useMemo(() => isWithinArchive(trail), [trail]);

  return (
    <>
      <Header
        colorMode={config.colorMode}
        gradKey={config.gradKey}
        field={config.field}
        stats={stats}
        onConfigToggle={() => setConfigOpen(o => !o)}
        breadcrumb={breadcrumb}
        onBack={breadcrumb.length > 0 ? handleBack : undefined}
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
