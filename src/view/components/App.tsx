import { useState, useCallback, useMemo } from 'react';
import { Header } from './Header';
import { ConfigPanel } from './ConfigPanel';
import { TreemapViz } from './TreemapViz';
import type { GradientKey, HeatField } from '../constants';
import type { VaultNode } from '../../core/data/VaultNode';
import type { IFileOpener } from '../../viewModel/FileOpener';
import { findFolderTrail } from '../../viewModel/folderTrail';

interface AppProps {
  data: VaultNode;
  fileOpener: IFileOpener;
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
 * All config state lives here and threads down to children.
 * Stats bubble up from TreemapViz via onStatsChange.
 *
 * Folder drill-down:
 * - `currentRoot` is the subtree currently displayed (null = full vault).
 * - `navStack` is the history of ancestor nodes for "go back" navigation.
 * - Drilling into a folder pushes the previous root onto the stack.
 * - "Back" pops the stack — the popped item becomes the new currentRoot.
 */
export function App({ data, fileOpener, initialFolderPath }: AppProps) {
  const [colorMode, setColorMode] = useState<'type' | 'heatmap'>('heatmap');
  const [gradKey, setGradKey] = useState<GradientKey>('nature');
  const [field, setField] = useState<HeatField>('lastModifiedAt');
  const [hotDays, setHotDays] = useState(7);
  const [coldDays, setColdDays] = useState(180);
  const [scales, setScales] = useState<Record<string, number>>({
    md: 1.0,
    canvas: 0.3,
    excalidraw: 0.2,
  });
  const [configOpen, setConfigOpen] = useState(false);
  const [stats, setStats] = useState({ files: 0, folders: 0, size: '—' });

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

  return (
    <>
      <Header
        colorMode={colorMode}
        gradKey={gradKey}
        field={field}
        stats={stats}
        onConfigToggle={() => setConfigOpen(o => !o)}
        breadcrumb={breadcrumb}
        onBack={navStack.length > 0 ? handleBack : undefined}
      />
      <ConfigPanel
        open={configOpen}
        colorMode={colorMode}
        setColorMode={setColorMode}
        gradKey={gradKey}
        setGradKey={setGradKey}
        field={field}
        setField={setField}
        hotDays={hotDays}
        setHotDays={setHotDays}
        coldDays={coldDays}
        setColdDays={setColdDays}
        scales={scales}
        setScales={setScales}
      />
      <TreemapViz
        data={data}
        currentRoot={currentRoot}
        colorMode={colorMode}
        gradKey={gradKey}
        field={field}
        hotDays={hotDays}
        coldDays={coldDays}
        scales={scales}
        onStatsChange={setStats}
        onFolderClick={handleFolderClick}
        fileOpener={fileOpener}
      />
    </>
  );
}
