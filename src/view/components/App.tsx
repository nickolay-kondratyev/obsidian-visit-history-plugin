import { useState } from 'react';
import { Header } from './Header';
import { ConfigPanel } from './ConfigPanel';
import { TreemapViz } from './TreemapViz';
import type { VaultNode } from '../../core/data/VaultNode';
import type { IFileOpener } from '../../viewModel/FileOpener';

interface AppProps {
  data: VaultNode;
  fileOpener: IFileOpener;
}

/**
 * Top-level state owner for the treemap view.
 *
 * Obsidian-agnostic — receives `data` as a prop from the ItemView host.
 * All config state lives here and threads down to children.
 * Stats bubble up from TreemapViz via onStatsChange.
 */
export function App({ data, fileOpener }: AppProps) {
  const [colorMode, setColorMode] = useState<'type' | 'heatmap'>('heatmap');
  const [gradKey, setGradKey] = useState('nature');
  const [field, setField] = useState('lastModifiedAt');
  const [hotDays, setHotDays] = useState(7);
  const [coldDays, setColdDays] = useState(180);
  const [scales, setScales] = useState<Record<string, number>>({
    md: 1.0,
    canvas: 0.3,
    excalidraw: 0.2,
  });
  const [configOpen, setConfigOpen] = useState(false);
  const [stats, setStats] = useState({ files: 0, folders: 0, size: '—' });

  return (
    <>
      <Header
        colorMode={colorMode}
        gradKey={gradKey}
        field={field}
        stats={stats}
        onConfigToggle={() => setConfigOpen(o => !o)}
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
        colorMode={colorMode}
        gradKey={gradKey}
        field={field}
        hotDays={hotDays}
        coldDays={coldDays}
        scales={scales}
        onStatsChange={setStats}
        fileOpener={fileOpener}
      />
    </>
  );
}
