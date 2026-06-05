import { FIELD_LABELS } from '../constants';
import { Legend } from './Legend';

interface HeaderProps {
  colorMode: 'type' | 'heatmap';
  gradKey: string;
  field: string;
  stats: { files: number; folders: number; size: string };
  onConfigToggle: () => void;
}

/**
 * Top bar: title, file/folder/size stats, active field indicator, legend, config toggle.
 * Pure presentational — no state.
 */
export function Header({
  colorMode,
  gradKey,
  field,
  stats,
  onConfigToggle,
}: HeaderProps) {
  return (
    <div id="header">
      <span id="title">Vault Treemap</span>
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
      {colorMode === 'heatmap' && (
        <div className="ts-indicator">
          field: <strong>{FIELD_LABELS[field] || field}</strong>
        </div>
      )}
      <div className="spacer" />
      <Legend colorMode={colorMode} gradKey={gradKey} />
      <button className="header-btn" onClick={onConfigToggle}>
        ⚙ config
      </button>
    </div>
  );
}
