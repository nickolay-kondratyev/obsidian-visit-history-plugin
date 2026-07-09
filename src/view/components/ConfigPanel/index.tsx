import { TYPE_C, type GradientKey, type HeatField } from '../../constants';
import { HeatmapOptions } from './HeatmapOptions';

interface ConfigPanelProps {
  open: boolean;
  colorMode: 'type' | 'heatmap';
  setColorMode: (m: 'type' | 'heatmap') => void;
  gradKey: GradientKey;
  setGradKey: (k: GradientKey) => void;
  field: HeatField;
  setField: (f: HeatField) => void;
  hotDays: number;
  setHotDays: (d: number) => void;
  coldDays: number;
  setColdDays: (d: number) => void;
  scales: Record<string, number>;
  setScales: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
}

/**
 * Config panel with scale factors, color mode toggle, and heatmap options.
 * Fully controlled — all state owned by App.
 * Toggles visibility via CSS display.
 */
export function ConfigPanel({
  open,
  colorMode,
  setColorMode,
  gradKey,
  setGradKey,
  field,
  setField,
  hotDays,
  setHotDays,
  coldDays,
  setColdDays,
  scales,
  setScales,
}: ConfigPanelProps) {
  function updateScale(type: string, val: string) {
    setScales(prev => ({ ...prev, [type]: parseFloat(val) || 1 }));
  }

  return (
    <div id="config" className={open ? 'open' : ''}>
      <div className="cfg-h">Scale factors</div>
      {Object.entries(TYPE_C).map(([type, c]) => (
        <div key={type} className="cfg-row">
          <span className="cfg-label">
            <span className="cfg-pip" style={{ background: c.fill }} />
            .{type}
          </span>
          <input
            className="cfg-input"
            type="number"
            value={scales[type] ?? 1}
            min="0.01"
            step="0.05"
            onChange={e => updateScale(type, e.target.value)}
          />
        </div>
      ))}

      <hr className="cfg-sep" />

      <div className="cfg-h">Coloring</div>
      <div className="mode-row">
        <button
          className={'mode-btn' + (colorMode === 'type' ? ' active' : '')}
          onClick={() => setColorMode('type')}
        >
          By type
        </button>
        <button
          className={'mode-btn' + (colorMode === 'heatmap' ? ' active' : '')}
          onClick={() => setColorMode('heatmap')}
        >
          Heatmap
        </button>
      </div>

      {colorMode === 'heatmap' && (
        <HeatmapOptions
          field={field}
          setField={setField}
          gradKey={gradKey}
          setGradKey={setGradKey}
          hotDays={hotDays}
          setHotDays={setHotDays}
          coldDays={coldDays}
          setColdDays={setColdDays}
        />
      )}
    </div>
  );
}
