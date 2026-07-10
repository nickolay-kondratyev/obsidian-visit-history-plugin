import type { ReactNode } from 'react';
import type { BoundedValue } from '../../../viewModel/heatmapConfig';
import { BoundedValueOps } from '../../../viewModel/BoundedValueOps';
import { BoundInput } from './BoundInput';

interface RangeSliderProps {
  label: ReactNode;
  /** Formatted current value shown to the right of the label (e.g. "×0.30"). */
  valueText: string;
  range: BoundedValue;
  step: number;
  /** Absolute floor the editable min bound can never go below. */
  hardMin: number;
  onChange: (range: BoundedValue) => void;
}

/**
 * Slider with USER-EDITABLE min/max bounds — small inputs flank the track.
 * Bound edits keep the invariants: hardMin <= min < max, value stays inside.
 * Fully controlled — the committed range comes back via onChange.
 */
export function RangeSlider({ label, valueText, range, step, hardMin, onChange }: RangeSliderProps) {
  function onSliderInput(raw: string): void {
    onChange({ ...range, value: parseFloat(raw) });
  }

  function commitMin(raw: number): number {
    const next = BoundedValueOps.withMin(range, raw, hardMin, step);
    onChange(next);
    return next.min;
  }

  function commitMax(raw: number): number {
    const next = BoundedValueOps.withMax(range, raw, step);
    onChange(next);
    return next.max;
  }

  return (
    <div className="slider-wrap">
      <div className="slider-label-row">
        {label}
        <span className="slider-value">{valueText}</span>
      </div>
      <div className="slider-track-row">
        <BoundInput value={range.min} onCommit={commitMin} ariaLabel="Slider minimum" />
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={step}
          value={range.value}
          onChange={e => onSliderInput(e.target.value)}
        />
        <BoundInput value={range.max} onCommit={commitMax} ariaLabel="Slider maximum" />
      </div>
    </div>
  );
}
