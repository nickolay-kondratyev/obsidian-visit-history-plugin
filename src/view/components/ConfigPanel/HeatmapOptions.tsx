import { GRADIENTS, FIELD_LABELS } from '../../constants';
import { GradientPicker } from './GradientPicker';

interface HeatmapOptionsProps {
  field: string;
  setField: (f: string) => void;
  gradKey: string;
  setGradKey: (k: string) => void;
  hotDays: number;
  setHotDays: (d: number) => void;
  coldDays: number;
  setColdDays: (d: number) => void;
}

/**
 * Heatmap configuration: timestamp field, gradient picker, threshold sliders.
 * Fully controlled — no internal state.
 */
export function HeatmapOptions({
  field,
  setField,
  gradKey,
  setGradKey,
  hotDays,
  setHotDays,
  coldDays,
  setColdDays,
}: HeatmapOptionsProps) {
  const g = GRADIENTS[gradKey]!;
  // Mono gradient has near-white/near-black endpoints; dim for dark-bg legibility.
  const hotColor = g.hot === '#d8d8d8' ? '#888888' : g.hot;
  const coldColor = g.cold === '#1c1c1c' ? '#666666' : g.cold;

  function onHotInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.min(parseInt(e.target.value), coldDays - 1);
    setHotDays(v);
  }

  function onColdInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.max(parseInt(e.target.value), hotDays + 1);
    setColdDays(v);
  }

  return (
    <div>
      <div className="cfg-label" style={{ marginBottom: '6px' }}>
        Timestamp field
      </div>
      <select
        className="cfg-select"
        value={field}
        onChange={e => setField(e.target.value)}
      >
        {Object.entries(FIELD_LABELS).map(([val, label]) => (
          <option key={val} value={val}>
            {label}
          </option>
        ))}
      </select>

      <div className="cfg-label" style={{ marginBottom: '8px' }}>
        Gradient
      </div>
      <GradientPicker active={gradKey} onChange={setGradKey} />

      <div className="slider-wrap">
        <div className="slider-label-row">
          <span style={{ color: hotColor }}>hot / new</span>
          <span>{hotDays} days</span>
        </div>
        <input
          type="range"
          min="1"
          max="365"
          step="1"
          value={hotDays}
          onInput={onHotInput as unknown as React.FormEventHandler<HTMLInputElement>}
        />
      </div>

      <div className="slider-wrap">
        <div className="slider-label-row">
          <span style={{ color: coldColor }}>cold / old</span>
          <span>{coldDays} days</span>
        </div>
        <input
          type="range"
          min="2"
          max="730"
          step="1"
          value={coldDays}
          onInput={onColdInput as unknown as React.FormEventHandler<HTMLInputElement>}
        />
      </div>

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
