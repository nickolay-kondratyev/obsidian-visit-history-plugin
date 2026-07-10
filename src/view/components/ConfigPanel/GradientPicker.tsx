import { useId } from 'react';
import { GRADIENTS, GRADIENT_KEYS, type GradientKey } from '../../constants';

interface GradientPickerProps {
  active: GradientKey;
  onChange: (key: GradientKey) => void;
}

/**
 * Radio group over the entries in GRADIENTS — one labeled radio row per
 * gradient, with its color swatch. Real <input type="radio"> elements
 * (visually replaced by a custom dot) so keyboard/AT behavior is native.
 * Fully controlled — no internal state.
 */
export function GradientPicker({ active, onChange }: GradientPickerProps) {
  // Unique per instance — two open heatmap views must not share a radio group.
  const radioName = useId();
  return (
    <div className="grad-radios" role="radiogroup" aria-label="Gradient">
      {GRADIENT_KEYS.map(key => {
        const g = GRADIENTS[key];
        return (
          <label key={key} className={'grad-radio' + (key === active ? ' active' : '')}>
            <input
              type="radio"
              name={radioName}
              value={key}
              checked={key === active}
              onChange={() => onChange(key)}
            />
            <span className="radio-dot" aria-hidden />
            <span className="grad-radio-name">{g.label}</span>
            <span className="grad-radio-sub">{g.sub}</span>
            <span
              className="grad-swatch"
              style={{ background: `linear-gradient(to right, ${g.hot}, ${g.cold})` }}
            />
          </label>
        );
      })}
    </div>
  );
}
