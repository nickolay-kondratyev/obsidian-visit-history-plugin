import { TYPE_C, GRADIENTS, type ColorMode, type GradientDef, type GradientKey } from '../constants';

interface LegendProps {
  colorMode: ColorMode;
  gradKey: GradientKey;
}

export function Legend({ colorMode, gradKey }: LegendProps) {
  if (colorMode === 'type') {
    return (
      <div className="legend">
        {Object.entries(TYPE_C).map(([type, c]) => (
          <div key={type} className="legend-item">
            <div className="pip" style={{ background: c.fill }} />
            .{type}
          </div>
        ))}
      </div>
    );
  }

  const g: GradientDef = GRADIENTS[gradKey];
  return (
    <div className="legend">
      <span className="legend-end">new</span>
      <div
        className="legend-grad"
        style={{ background: `linear-gradient(to right, ${g.hot}, ${g.cold})` }}
      />
      <span className="legend-end">old</span>
      <div className="legend-item" style={{ marginLeft: '6px' }}>
        <div
          className="pip"
          style={{ background: g.nil, border: '1px solid var(--vt-border2)' }}
        />
        no data
      </div>
    </div>
  );
}
