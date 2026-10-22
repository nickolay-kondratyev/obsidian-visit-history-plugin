import { describe, expect, it } from 'vitest';
import { cornerLabelFits, fmtAgo, fmtBytes, fmtDate, fmtFileCount, heatColor } from './utils';
import { GRADIENTS } from './constants';

const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;
const NOW_MS = Date.UTC(2026, 9, 22, 12, 0, 0);

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

  describe('fmtAgo', () => {
    it('should show <1m ago under a minute', () => {
      expect(fmtAgo(NOW_MS - 59_000, NOW_MS)).toBe('<1m ago');
    });

    it('should clamp a future stamp to <1m ago', () => {
      expect(fmtAgo(NOW_MS + MS_PER_HOUR, NOW_MS)).toBe('<1m ago');
    });

    it('should show minutes at exactly one minute', () => {
      expect(fmtAgo(NOW_MS - MS_PER_MINUTE, NOW_MS)).toBe('1m ago');
    });

    it('should floor minutes under an hour', () => {
      expect(fmtAgo(NOW_MS - 33 * MS_PER_MINUTE - 59_000, NOW_MS)).toBe('33m ago');
    });

    it('should show hours at exactly one hour', () => {
      expect(fmtAgo(NOW_MS - MS_PER_HOUR, NOW_MS)).toBe('1h ago');
    });

    it('should floor hours under a day', () => {
      expect(fmtAgo(NOW_MS - 23 * MS_PER_HOUR - 59 * MS_PER_MINUTE, NOW_MS)).toBe('23h ago');
    });

    it('should show days at exactly one day', () => {
      expect(fmtAgo(NOW_MS - MS_PER_DAY, NOW_MS)).toBe('1d ago');
    });

    it('should keep counting in days beyond a year', () => {
      expect(fmtAgo(NOW_MS - 400 * MS_PER_DAY, NOW_MS)).toBe('400d ago');
    });
  });

  describe('fmtFileCount', () => {
    it('should use the singular for one file', () => {
      expect(fmtFileCount(1)).toBe('1 file');
    });

    it('should use the plural for many files', () => {
      expect(fmtFileCount(12)).toBe('12 files');
    });

    it('should use the plural for zero files', () => {
      expect(fmtFileCount(0)).toBe('0 files');
    });
  });

  describe('cornerLabelFits', () => {
    // '33m ago' = 7 chars → needs 7 * 5.5 + 2 * 3 = 44.5 wide; 3 lines * 12 = 36 tall.
    it('should fit when the tile has room for title, blank line and label', () => {
      expect(cornerLabelFits(45, 36, '33m ago')).toBe(true);
    });

    it('should not fit when the tile is one px short of three lines', () => {
      expect(cornerLabelFits(200, 35, '33m ago')).toBe(false);
    });

    it('should not fit when the tile is narrower than the label', () => {
      expect(cornerLabelFits(44, 200, '33m ago')).toBe(false);
    });

    it('should require more width for a longer label', () => {
      expect(cornerLabelFits(45, 36, '400d ago')).toBe(false);
    });
  });
});
