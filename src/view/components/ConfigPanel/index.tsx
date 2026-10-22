import { TYPE_C, type ColorMode } from '../../constants';
import {
  SCALE_HARD_MIN,
  type HeatmapConfig,
  type SizeBy,
  type SizeCurve,
  type SizeModeConfig,
} from '../../../viewModel/heatmapConfig';
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
const COLOR_MODE_OPTIONS: readonly { value: ColorMode; label: string; title: string }[] = [
  { value: 'heatmap', label: 'Heatmap', title: 'Color cells by timestamp recency' },
  { value: 'type', label: 'Type', title: 'Color cells by file type' },
];

const SIZE_BY_OPTIONS: readonly { value: SizeBy; label: string; title: string }[] = [
  { value: 'contentSize', label: 'Content size', title: 'Size cells by file size' },
  {
    value: 'visitTime',
    label: 'Visit time',
    title: 'Size cells by total time spent in the note (notes never visited are hidden)',
  },
];

const SIZE_CURVE_OPTIONS: readonly { value: SizeCurve; label: string; title: string }[] = [
  { value: 'linear', label: 'Linear', title: 'Cell area proportional to the size' },
  { value: 'sqrt', label: 'Sqrt', title: 'Square root — softens very large notes' },
  { value: 'log', label: 'Log', title: 'Logarithmic — cells come out nearly equal' },
];

const SIZE_UNIT_LABELS: Record<SizeBy, string> = {
  contentSize: 'file size',
  visitTime: 'visit time',
};

const SCALE_STEP = 0.01;

/**
 * Config panel: coloring mode toggle, heatmap options, and the "Size" section
 * (size-by toggle, size curve, per-type scale sliders of the ACTIVE mode —
 * the other mode's curve/scales stay saved, untouched).
 * Fully controlled — all state owned by App (persisted between restarts).
 * Toggles visibility via CSS display.
 */
export function ConfigPanel({ open, config, onConfigChange }: ConfigPanelProps) {
  const sizeBy = config.sizeBy;
  const active = config.sizing[sizeBy];

  /** Writes to the ACTIVE mode's sizing only. */
  function onActiveSizingChange(partial: Partial<SizeModeConfig>): void {
    onConfigChange({ sizing: { ...config.sizing, [sizeBy]: { ...active, ...partial } } });
  }

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

      <div className="cfg-h">Size</div>
      <SegmentedToggle
        ariaLabel="Size by"
        options={SIZE_BY_OPTIONS}
        value={sizeBy}
        onChange={m => onConfigChange({ sizeBy: m })}
      />
      <SegmentedToggle
        ariaLabel="Size curve"
        options={SIZE_CURVE_OPTIONS}
        value={active.curve}
        onChange={curve => onActiveSizingChange({ curve })}
      />
      {Object.entries(active.scales).map(([type, scale]) => (
        <RangeSlider
          key={type}
          label={
            <span className="cfg-label">
              <span className="cfg-pip" style={{ background: TYPE_C[type]?.fill }} />
              .{type}
            </span>
          }
          valueText={`×${scale.value.toFixed(2)}`}
          title={`Scale factor for .${type} files — multiplies their cell size (by ${SIZE_UNIT_LABELS[sizeBy]})`}
          range={scale}
          step={SCALE_STEP}
          hardMin={SCALE_HARD_MIN}
          onChange={r => onActiveSizingChange({ scales: { ...active.scales, [type]: r } })}
        />
      ))}
    </div>
  );
}
