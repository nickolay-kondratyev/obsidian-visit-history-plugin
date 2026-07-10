import { FIELD_LABELS, type ColorMode, type GradientKey, type HeatField } from '../constants';
import { Legend } from './Legend';

interface HeaderProps {
  colorMode: ColorMode;
  gradKey: GradientKey;
  field: HeatField;
  stats: { files: number; folders: number; size: string };
  onConfigToggle: () => void;
  /** The folder path segments currently being viewed, or empty array at root. */
  breadcrumb: string[];
  /** Called when the user clicks "back" to navigate up one level. */
  onBack?: () => void;
}

/**
 * Top bar: breadcrumb navigation, title, file/folder/size stats,
 * active field indicator, legend, config toggle.
 * Pure presentational — no state.
 */
export function Header({
  colorMode,
  gradKey,
  field,
  stats,
  onConfigToggle,
  breadcrumb,
  onBack,
}: HeaderProps) {
  return (
    <div id="header">
      <span id="title">vault heatmap</span>
      {breadcrumb.length > 0 && onBack && (
        <div className="breadcrumb">
          <button className="breadcrumb-back" onClick={onBack} title="Go back up one level">
            ← back
          </button>
          <span className="breadcrumb-path">
            /{breadcrumb.join('/')}
          </span>
        </div>
      )}
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
          field: <strong>{FIELD_LABELS[field]}</strong>
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
