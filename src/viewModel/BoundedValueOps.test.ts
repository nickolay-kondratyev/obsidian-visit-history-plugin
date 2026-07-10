import { describe, expect, it } from 'vitest';
import { BoundedValueOps } from './BoundedValueOps';
import type { BoundedValue } from './heatmapConfig';

const HARD_MIN = 1;
const STEP = 1;

function range(value: number, min: number, max: number): BoundedValue {
  return { value, min, max };
}

describe('BoundedValueOps', () => {
  describe('withMin', () => {
    it('should apply a valid new min as-is', () => {
      // GIVEN a range and a valid new min
      // WHEN applying it
      const result = BoundedValueOps.withMin(range(50, 1, 100), 10, HARD_MIN, STEP);
      // THEN the min is applied and nothing else moves
      expect(result).toEqual(range(50, 10, 100));
    });

    it('should clamp a min below the hard floor up to the floor', () => {
      const result = BoundedValueOps.withMin(range(50, 10, 100), -5, HARD_MIN, STEP);
      expect(result.min).toBe(HARD_MIN);
    });

    it('should clamp a min at/above max down to max - step', () => {
      // GIVEN a new min that would invert the bounds
      const result = BoundedValueOps.withMin(range(50, 1, 100), 500, HARD_MIN, STEP);
      // THEN min lands just below max
      expect(result.min).toBe(99);
    });

    it('should pull the value UP when it falls below the new min', () => {
      const result = BoundedValueOps.withMin(range(5, 1, 100), 20, HARD_MIN, STEP);
      expect(result.value).toBe(20);
    });
  });

  describe('withMax', () => {
    it('should apply a valid new max as-is', () => {
      const result = BoundedValueOps.withMax(range(50, 1, 100), 200, STEP);
      expect(result).toEqual(range(50, 1, 200));
    });

    it('should floor a max at/below min up to min + step', () => {
      // GIVEN a new max that would invert the bounds
      const result = BoundedValueOps.withMax(range(50, 10, 100), 3, STEP);
      // THEN max lands just above min
      expect(result.max).toBe(11);
    });

    it('should pull the value DOWN when it rises above the new max', () => {
      const result = BoundedValueOps.withMax(range(90, 1, 100), 40, STEP);
      expect(result.value).toBe(40);
    });
  });
});
