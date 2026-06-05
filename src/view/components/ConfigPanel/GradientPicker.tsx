import { GRADIENTS } from '../../constants';

interface GradientPickerProps {
  active: string;
  onChange: (key: string) => void;
}

/**
 * Renders gradient swatch buttons for each entry in GRADIENTS.
 * Fully controlled — no internal state.
 */
export function GradientPicker({ active, onChange }: GradientPickerProps) {
  return (
    <div className="grad-row">
      {Object.entries(GRADIENTS).map(([key, g]) => (
        <button
          key={key}
          className={'grad-btn' + (key === active ? ' active' : '')}
          onClick={() => onChange(key)}
        >
          <span
            className="grad-swatch"
            style={{
              background: `linear-gradient(to right, ${g.hot}, ${g.cold})`,
            }}
          />
          <span style={{ display: 'block' }}>{g.label}</span>
          <span style={{ fontSize: '8px', opacity: 0.55 }}>{g.sub}</span>
        </button>
      ))}
    </div>
  );
}
