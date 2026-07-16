import { TYPE_C, type ColorMode } from '../../constants';
import { SCALE_HARD_MIN, type HeatmapConfig } from '../../../viewModel/heatmapConfig';
import { HeatmapOptions } from './HeatmapOptions';
import { RangeSlider } from './RangeSlider';
import { SegmentedToggle } from './SegmentedToggle';

interface ConfigPanelProps {
  open: boolean;
  config: HeatmapConfig;
  /** Merges the partial into the config AND persists it (see App). */
  onConfigChange: (partial: Partial<HeatmapConfig>) => void;
}

// Heatmap first — it is the view's primary mode (owner-requested order).
const COLOR_MODE_OPTIONS: readonly { value: ColorMode; label: string }[] = [
  { value: 'heatmap', label: 'Heatmap' },
  { value: 'type', label: 'Type' },
];

const SCALE_STEP = 0.01;

/**
 * Config panel: coloring mode toggle, heatmap options, per-type scale sliders.
 * Fully controlled — all state owned by App (persisted between restarts).
 * Toggles visibility via CSS display.
 */
export function ConfigPanel({ open, config, onConfigChange }: ConfigPanelProps) {
  return (
    <div id="config" className={open ? 'open' : ''}>
      <div className="cfg-h">Coloring</div>
      <SegmentedToggle
        ariaLabel="Coloring"
        options={COLOR_MODE_OPTIONS}
        value={config.colorMode}
        onChange={m => onConfigChange({ colorMode: m })}
      />

      {config.colorMode === 'heatmap' && (
        <HeatmapOptions config={config} onConfigChange={onConfigChange} />
      )}

      <hr className="cfg-sep" />

      <div className="cfg-h">Scale factors</div>
      {Object.entries(config.scales).map(([type, scale]) => (
        <RangeSlider
          key={type}
          label={
            <span className="cfg-label">
              <span className="cfg-pip" style={{ background: TYPE_C[type]?.fill }} />
              .{type}
            </span>
          }
          valueText={`×${scale.value.toFixed(2)}`}
          range={scale}
          step={SCALE_STEP}
          hardMin={SCALE_HARD_MIN}
          onChange={r => onConfigChange({ scales: { ...config.scales, [type]: r } })}
        />
      ))}
    </div>
  );
}
