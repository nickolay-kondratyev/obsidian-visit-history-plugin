import { GRADIENTS, GRADIENT_KEYS, type GradientKey } from '../../constants';

interface GradientPickerProps {
  active: GradientKey;
  onChange: (key: GradientKey) => void;
}

/**
 * Renders gradient swatch buttons for each entry in GRADIENTS.
 * Fully controlled — no internal state.
 */
export function GradientPicker({ active, onChange }: GradientPickerProps) {
  return (
    <div className="grad-row">
      {GRADIENT_KEYS.map(key => {
        const g = GRADIENTS[key];
        return (
        <button
          key={key}
          className={'grad-btn' + (key === active ? ' active' : '')}
          onClick={() => onChange(key)}
        >
          <span
            className="grad-swatch"
            style={{
              background: `linear-gradient(to right, ${g.hot}, ${g.cold})`,
              display: 'block',
            }}
          />
          <span style={{ display: 'block' }}>{g.label}</span>
          <span style={{ fontSize: '8px', opacity: 0.55 }}>{g.sub}</span>
        </button>
        );
      })}
    </div>
  );
}
