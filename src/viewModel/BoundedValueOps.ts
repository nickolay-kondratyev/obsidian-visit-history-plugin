import { BoundedValue } from './heatmapConfig';

/**
 * Pure edits of a {@link BoundedValue} that PRESERVE its invariants
 * (`min < max`, `min <= value <= max`). Used by RangeSlider when the user
 * edits a slider's min/max bound.
 */
export class BoundedValueOps {
  /**
   * Applies a user-typed min bound: clamped into [hardMin, max - step];
   * the value is pulled up if it fell below the new min.
   */
  static withMin(range: BoundedValue, rawMin: number, hardMin: number, step: number): BoundedValue {
    const min = Math.min(Math.max(rawMin, hardMin), range.max - step);
    return { min, max: range.max, value: Math.max(range.value, min) };
  }

  /**
   * Applies a user-typed max bound: floored at min + step;
   * the value is pulled down if it rose above the new max.
   */
  static withMax(range: BoundedValue, rawMax: number, step: number): BoundedValue {
    const max = Math.max(rawMax, range.min + step);
    return { min: range.min, max, value: Math.min(range.value, max) };
  }
}
