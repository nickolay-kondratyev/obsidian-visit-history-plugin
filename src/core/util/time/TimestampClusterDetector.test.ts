import { describe, expect, it } from 'vitest';
import { TimestampClusterDetector } from './TimestampClusterDetector';

interface Stamped {
  readonly id: string;
  readonly ms: number | undefined;
}

const BASE_MS = Date.parse('2026-10-15T10:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const { MIN_ITEMS_TO_JUDGE, WINDOW_MS } = TimestampClusterDetector;

/** `count` items, each a day apart starting at `startMs` — never two in one window. */
function spread(prefix: string, count: number, startMs: number): Stamped[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, ms: startMs + i * DAY_MS }));
}

/** `count` items at the exact same `ms`. */
function sameTime(prefix: string, count: number, ms: number): Stamped[] {
  return Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, ms }));
}

function detect(items: readonly Stamped[]) {
  return TimestampClusterDetector.detect(items, s => s.ms);
}

function memberIds(items: readonly Stamped[]): string[] | undefined {
  return detect(items)?.members.map(m => m.id).sort();
}

describe('TimestampClusterDetector', () => {
  describe('detect', () => {
    describe('GIVEN most items share one timestamp', () => {
      const items = [...sameTime('c', 30, BASE_MS), ...spread('s', 10, BASE_MS + 10 * DAY_MS)];

      it('should report a cluster', () => {
        expect(detect(items)).toBeDefined();
      });

      it('should return exactly the items sharing the timestamp as members', () => {
        expect(memberIds(items)).toEqual(sameTime('c', 30, BASE_MS).map(s => s.id).sort());
      });

      it('should judge against every timestamped item', () => {
        expect(detect(items)?.judgedCount).toBe(40);
      });
    });

    it('should report no cluster WHEN timestamps are spread out', () => {
      expect(detect(spread('s', 40, BASE_MS))).toBeUndefined();
    });

    it('should report a cluster WHEN exactly the minimum share sits in one window', () => {
      // 10 of 20 = 50% — the threshold is inclusive.
      const items = [...sameTime('c', 10, BASE_MS), ...spread('s', 10, BASE_MS + DAY_MS)];

      expect(detect(items)).toBeDefined();
    });

    it('should report no cluster WHEN one item short of the minimum share', () => {
      // 9 in the window; the 11 spread items include none near it → 9 of 20 < 50%.
      const items = [...sameTime('c', 9, BASE_MS), ...spread('s', 11, BASE_MS + DAY_MS)];

      expect(detect(items)).toBeUndefined();
    });

    it('should count items exactly WINDOW_MS apart as one window', () => {
      const items = [
        ...sameTime('a', 5, BASE_MS),
        ...sameTime('b', 5, BASE_MS + WINDOW_MS),
        ...spread('s', 10, BASE_MS + DAY_MS),
      ];

      expect(detect(items)?.members).toHaveLength(10);
    });

    it('should not join items more than WINDOW_MS apart into one window', () => {
      const items = [
        ...sameTime('a', 5, BASE_MS),
        ...sameTime('b', 5, BASE_MS + WINDOW_MS + 1),
        ...spread('s', 10, BASE_MS + DAY_MS),
      ];

      expect(detect(items)).toBeUndefined();
    });

    it('should never report a cluster WHEN fewer than the minimum items are judged', () => {
      expect(detect(sameTime('c', MIN_ITEMS_TO_JUDGE - 1, BASE_MS))).toBeUndefined();
    });

    it('should report a cluster WHEN exactly the minimum items all share a timestamp', () => {
      expect(detect(sameTime('c', MIN_ITEMS_TO_JUDGE, BASE_MS))).toBeDefined();
    });

    it('should report no cluster WHEN the input is empty', () => {
      expect(detect([])).toBeUndefined();
    });

    it('should find a cluster that is neither the earliest nor the latest value', () => {
      const items = [
        ...spread('early', 5, BASE_MS),
        ...sameTime('c', 20, BASE_MS + 100 * DAY_MS),
        ...spread('late', 5, BASE_MS + 200 * DAY_MS),
      ];

      expect(memberIds(items)).toEqual(sameTime('c', 20, 0).map(s => s.id).sort());
    });

    it('should find the cluster regardless of input order', () => {
      const items = [
        ...spread('late', 5, BASE_MS + 200 * DAY_MS),
        ...sameTime('c', 20, BASE_MS + 100 * DAY_MS),
        ...spread('early', 5, BASE_MS),
      ].reverse();

      expect(detect(items)?.members).toHaveLength(20);
    });

    describe('GIVEN some items have no usable timestamp', () => {
      const items: Stamped[] = [
        ...sameTime('c', MIN_ITEMS_TO_JUDGE, BASE_MS),
        { id: 'missing', ms: undefined },
        { id: 'nan', ms: Number.NaN },
      ];

      it('should leave them out of the judged count', () => {
        expect(detect(items)?.judgedCount).toBe(MIN_ITEMS_TO_JUDGE);
      });

      it('should never make them members', () => {
        expect(memberIds(items)).not.toContain('missing');
      });
    });

    it('should never report a cluster WHEN too few items have a usable timestamp', () => {
      const items: Stamped[] = [
        ...sameTime('c', MIN_ITEMS_TO_JUDGE - 1, BASE_MS),
        { id: 'missing', ms: undefined },
      ];

      expect(detect(items)).toBeUndefined();
    });
  });
});
