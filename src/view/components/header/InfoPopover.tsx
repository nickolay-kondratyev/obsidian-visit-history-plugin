import { Legend } from '../Legend';
import type { ColorMode, GradientKey } from '../../constants';

interface InfoPopoverProps {
  open: boolean;
  stats: { files: number; folders: number; size: string };
  colorMode: ColorMode;
  gradKey: GradientKey;
}

/**
 * ⓘ popover: view title + file/folder/size stats + color legend — the
 * non-actionable info collapsed out of the header row. Stats reflect the
 * FILTERED view (they bubble up from what TreemapViz actually renders).
 * Always rendered; visibility via the `.open` class (ConfigPanel pattern).
 */
export function InfoPopover({ open, stats, colorMode, gradKey }: InfoPopoverProps) {
  return (
    <div className={'hdr-pop hdr-pop--right' + (open ? ' open' : '')}>
      <div className="cfg-h">Vault heatmap</div>
      <div className="stats">
        <span className="stat">
          <strong>{stats.files}</strong> files
        </span>
        <span className="stat">
          <strong>{stats.folders}</strong> folders
        </span>
        <span className="stat">
          <strong>{stats.size}</strong> raw
        </span>
      </div>
      <div className="cfg-h">Color key</div>
      <Legend colorMode={colorMode} gradKey={gradKey} />
    </div>
  );
}
