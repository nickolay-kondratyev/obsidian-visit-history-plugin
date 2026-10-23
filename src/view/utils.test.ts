import { describe, expect, it } from 'vitest';
import {
  fmtAgo,
  fmtBytes,
  fmtDate,
  fmtDuration,
  fmtFileCount,
  fmtTileSize,
  heatColor,
  leafFieldAgo,
} from './utils';
import { GRADIENTS } from './constants';
import type { VaultNode } from '../core/data/VaultNode';

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

  describe('fmtDuration', () => {
    it('should return null for no time at all', () => {
      expect(fmtDuration(0)).toBeNull();
    });

    it('should show <1s under a second', () => {
      expect(fmtDuration(400)).toBe('<1s');
    });

    it('should floor seconds under a minute', () => {
      expect(fmtDuration(45_900)).toBe('45s');
    });

    it('should floor minutes under an hour', () => {
      expect(fmtDuration(12 * MS_PER_MINUTE + 59_000)).toBe('12m');
    });

    it('should show hours with zero-padded minutes', () => {
      expect(fmtDuration(3 * MS_PER_HOUR + 5 * MS_PER_MINUTE)).toBe('3h 05m');
    });

    it('should keep counting in hours beyond a day', () => {
      expect(fmtDuration(30 * MS_PER_HOUR)).toBe('30h 00m');
    });
  });

  describe('fmtTileSize', () => {
    const note: VaultNode = {
      name: 'a.md', path: 'a.md', type: 'md', size: 2048, totalFocusMs: 3 * MS_PER_HOUR + 5 * MS_PER_MINUTE,
    };

    it('should show plain bytes and scale under the linear content curve', () => {
      expect(fmtTileSize(note, { sizeBy: 'contentSize', curve: 'linear', scales: { md: 1 } }))
        .toBe('2.0 KB ×1.00');
    });

    it('should wrap the bytes in sqrt under the sqrt content curve', () => {
      expect(fmtTileSize(note, { sizeBy: 'contentSize', curve: 'sqrt', scales: { md: 0.3 } }))
        .toBe('sqrt(2.0 KB) ×0.30');
    });

    it('should wrap the focus time in log under the log visit-time curve', () => {
      expect(fmtTileSize(note, { sizeBy: 'visitTime', curve: 'log', scales: {} }))
        .toBe('log(3h 05m) ×1.00');
    });

    it('should show 0s for an unvisited note in visit-time mode', () => {
      expect(fmtTileSize({ ...note, totalFocusMs: 0 }, { sizeBy: 'visitTime', curve: 'linear', scales: {} }))
        .toBe('0s ×1.00');
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

  describe('leafFieldAgo', () => {
    // GIVEN a leaf whose three stamps are each a distinct age.
    const leaf: VaultNode = {
      name: 'note.md',
      createdAt: NOW_MS - 3 * MS_PER_DAY,
      lastModifiedAt: NOW_MS - 5 * MS_PER_HOUR,
      lastVisitedAt: NOW_MS - 7 * MS_PER_MINUTE,
    };

    it('should show the created age when the field is createdAt', () => {
      expect(leafFieldAgo(leaf, 'createdAt', NOW_MS)).toBe('3d ago');
    });

    it('should show the modified age when the field is lastModifiedAt', () => {
      expect(leafFieldAgo(leaf, 'lastModifiedAt', NOW_MS)).toBe('5h ago');
    });

    it('should show the visited age when the field is lastVisitedAt', () => {
      expect(leafFieldAgo(leaf, 'lastVisitedAt', NOW_MS)).toBe('7m ago');
    });

    it('should be undefined when the active field has no stamp', () => {
      expect(leafFieldAgo({ ...leaf, lastVisitedAt: null }, 'lastVisitedAt', NOW_MS)).toBeUndefined();
    });
  });
});
