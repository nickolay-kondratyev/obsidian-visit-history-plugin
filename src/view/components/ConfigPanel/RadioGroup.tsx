import { useId } from 'react';

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  /** Optional dimmed secondary text after the label. */
  sub?: string;
}

interface RadioGroupProps<T extends string> {
  options: readonly RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/**
 * Vertical radio group — real <input type="radio"> elements (visually
 * replaced by a custom dot) so keyboard/AT behavior is native.
 * Fully controlled — no internal state.
 */
export function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: RadioGroupProps<T>) {
  // Unique per instance — two open heatmap views must not share a radio group.
  const name = useId();
  return (
    <div className="cfg-radios" role="radiogroup" aria-label={ariaLabel}>
      {options.map(o => (
        <label key={o.value} className={'cfg-radio' + (o.value === value ? ' active' : '')}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={o.value === value}
            onChange={() => onChange(o.value)}
          />
          <span className="radio-dot" aria-hidden />
          <span className="cfg-radio-name">{o.label}</span>
          {o.sub !== undefined && <span className="cfg-radio-sub">{o.sub}</span>}
        </label>
      ))}
    </div>
  );
}
