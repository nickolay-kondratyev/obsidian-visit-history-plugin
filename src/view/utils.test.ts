import { describe, expect, it } from 'vitest';
import { fmtBytes, fmtDate, heatColor } from './utils';
import { GRADIENTS } from './constants';

const MS_PER_DAY = 86400000;

function daysAgo(days: number): number {
  return Date.now() - days * MS_PER_DAY;
}

describe('view utils', () => {
  describe('heatColor', () => {
    it('should return the hot color within hotDays', () => {
      expect(heatColor(daysAgo(1), 'nature', 7, 180)).toBe(GRADIENTS.nature.hot);
    });

    it('should return the cold color beyond coldDays', () => {
      expect(heatColor(daysAgo(500), 'nature', 7, 180)).toBe(GRADIENTS.nature.cold);
    });

    it('should return the nil color for a null timestamp', () => {
      expect(heatColor(null, 'nature', 7, 180)).toBe(GRADIENTS.nature.nil);
    });

    it('should interpolate between hot and cold in the middle', () => {
      // GIVEN a timestamp between the thresholds
      const color = heatColor(daysAgo(90), 'nature', 7, 180);
      // THEN neither endpoint is returned verbatim
      expect([GRADIENTS.nature.hot, GRADIENTS.nature.cold, GRADIENTS.nature.nil]).not.toContain(color);
    });
  });

  describe('fmtBytes', () => {
    it('should format bytes', () => {
      expect(fmtBytes(512)).toBe('512 B');
    });

    it('should format kilobytes', () => {
      expect(fmtBytes(2048)).toBe('2.0 KB');
    });

    it('should format megabytes', () => {
      expect(fmtBytes(3 * 1048576)).toBe('3.00 MB');
    });
  });

  describe('fmtDate', () => {
    it('should return null for a null timestamp', () => {
      expect(fmtDate(null)).toBeNull();
    });

    it('should mark a fresh timestamp as today', () => {
      expect(fmtDate(Date.now())).toContain('(today)');
    });

    it('should render day-relative age', () => {
      expect(fmtDate(daysAgo(3))).toContain('(3d ago)');
    });
  });
});
