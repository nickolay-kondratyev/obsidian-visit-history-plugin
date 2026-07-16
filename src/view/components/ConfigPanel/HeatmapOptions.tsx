import {
  FIELD_OPTIONS,
  GRADIENTS,
  GRADIENT_KEYS,
  type GradientKey,
} from '../../constants';
import { DAYS_HARD_MIN, type BoundedValue, type HeatmapConfig } from '../../../viewModel/heatmapConfig';
import { RadioGroup } from './RadioGroup';
import { RangeSlider } from './RangeSlider';

interface HeatmapOptionsProps {
  config: HeatmapConfig;
  onConfigChange: (partial: Partial<HeatmapConfig>) => void;
}

/**
 * Heatmap configuration: timestamp field, gradient radio group, hot/cold
 * threshold sliders (with editable bounds). Fully controlled — no internal
 * state; changes flow up via onConfigChange.
 */
export function HeatmapOptions({ config, onConfigChange }: HeatmapOptionsProps) {
  const g = GRADIENTS[config.gradKey];
  // Mono gradient has near-white/near-black endpoints; dim for dark-bg legibility.
  const hotColor = config.gradKey === 'mono' ? '#888888' : g.hot;
  const coldColor = config.gradKey === 'mono' ? '#666666' : g.cold;

  // Cross-invariant hot < cold: clamp the moved slider's VALUE against the
  // other one (bounds stay as the user set them).
  function onHotChange(range: BoundedValue): void {
    const value = Math.max(Math.min(range.value, config.coldDays.value - 1), range.min);
    onConfigChange({ hotDays: { ...range, value } });
  }

  function onColdChange(range: BoundedValue): void {
    const value = Math.min(Math.max(range.value, config.hotDays.value + 1), range.max);
    onConfigChange({ coldDays: { ...range, value } });
  }

  return (
    <div>
      <div className="cfg-label" style={{ marginBottom: '6px' }}>
        Timestamp field
      </div>
      <RadioGroup
        ariaLabel="Timestamp field"
        options={FIELD_OPTIONS}
        value={config.field}
        onChange={f => onConfigChange({ field: f })}
      />

      <div className="cfg-label" style={{ marginBottom: '6px' }}>
        Gradient
      </div>
      <select
        className="cfg-select"
        title="Heatmap color gradient"
        aria-label="Heatmap color gradient"
        value={config.gradKey}
        // DOM boundary: <option> values are exactly GRADIENT_KEYS entries.
        onChange={e => onConfigChange({ gradKey: e.target.value as GradientKey })}
      >
        {GRADIENT_KEYS.map(key => (
          <option key={key} value={key}>
            {GRADIENTS[key].label} — {GRADIENTS[key].sub}
          </option>
        ))}
      </select>

      <RangeSlider
        label={<span style={{ color: hotColor }}>hot / new</span>}
        valueText={`${config.hotDays.value} days`}
        title="Files newer than this many days get the hot color"
        range={config.hotDays}
        step={1}
        hardMin={DAYS_HARD_MIN}
        onChange={onHotChange}
      />
      <RangeSlider
        label={<span style={{ color: coldColor }}>cold / old</span>}
        valueText={`${config.coldDays.value} days`}
        title="Files older than this many days get the cold color"
        range={config.coldDays}
        step={1}
        hardMin={DAYS_HARD_MIN}
        onChange={onColdChange}
      />

      <div
        className="grad-preview"
        style={{
          background: `linear-gradient(to right, ${g.hot}, ${g.cold})`,
        }}
      />
      <div className="grad-ends">
        <span>← newer</span>
        <span>older →</span>
      </div>
      <div className="null-row">
        <div className="null-pip" style={{ background: g.nil }} />
        <span>null / missing timestamp</span>
      </div>
    </div>
  );
}
