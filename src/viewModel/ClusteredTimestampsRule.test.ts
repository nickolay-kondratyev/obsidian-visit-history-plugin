import { describe, expect, it } from 'vitest';
import { ClusteredTimestampsRule, type ClusteredTimestamps } from './ClusteredTimestampsRule';
import type { VaultNode } from '../core/data/VaultNode';

const SYNC_MS = Date.parse('2026-10-15T10:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const SYNCED_COUNT = 30;
const ORIGINAL_COUNT = 10;

function file(name: string, stamps: Partial<VaultNode>): VaultNode {
  return { name, path: name, type: 'md', size: 10, lastVisitedAt: null, ...stamps };
}

/** A freshly synced vault: most files share the download time on BOTH sync-stamped fields. */
function freshlySyncedFiles(): VaultNode[] {
  const synced = Array.from({ length: SYNCED_COUNT }, (_, i) =>
    file(`synced${i}.md`, { lastModifiedAt: SYNC_MS, createdAt: SYNC_MS, lastVisitedAt: SYNC_MS }),
  );
  const original = Array.from({ length: ORIGINAL_COUNT }, (_, i) => {
    const ms = SYNC_MS - (i + 1) * DAY_MS;
    return file(`original${i}.md`, { lastModifiedAt: ms, createdAt: ms, lastVisitedAt: ms });
  });
  return [...synced, ...original];
}

/** Every file a day apart on every field. */
function spreadFiles(): VaultNode[] {
  return Array.from({ length: SYNCED_COUNT + ORIGINAL_COUNT }, (_, i) => {
    const ms = SYNC_MS - i * DAY_MS;
    return file(`f${i}.md`, { lastModifiedAt: ms, createdAt: ms, lastVisitedAt: ms });
  });
}

const FINDING: ClusteredTimestamps = { field: 'lastModifiedAt', sharedCount: 30, totalCount: 40 };

describe('ClusteredTimestampsRule', () => {
  describe('evaluate', () => {
    it('should report how many files share the modified time WHEN coloring by modified', () => {
      expect(ClusteredTimestampsRule.evaluate(freshlySyncedFiles(), 'lastModifiedAt', 'heatmap')).toEqual({
        field: 'lastModifiedAt',
        sharedCount: SYNCED_COUNT,
        totalCount: SYNCED_COUNT + ORIGINAL_COUNT,
      });
    });

    it('should report the created field WHEN coloring by created', () => {
      expect(ClusteredTimestampsRule.evaluate(freshlySyncedFiles(), 'createdAt', 'heatmap')?.field).toBe('createdAt');
    });

    it('should report nothing WHEN coloring by visited, even with clustered visit times', () => {
      expect(ClusteredTimestampsRule.evaluate(freshlySyncedFiles(), 'lastVisitedAt', 'heatmap')).toBeUndefined();
    });

    it('should report nothing WHEN coloring by file type', () => {
      expect(ClusteredTimestampsRule.evaluate(freshlySyncedFiles(), 'lastModifiedAt', 'type')).toBeUndefined();
    });

    it('should report nothing WHEN timestamps are spread out', () => {
      expect(ClusteredTimestampsRule.evaluate(spreadFiles(), 'lastModifiedAt', 'heatmap')).toBeUndefined();
    });

    it('should report nothing WHEN the view has no files', () => {
      expect(ClusteredTimestampsRule.evaluate([], 'lastModifiedAt', 'heatmap')).toBeUndefined();
    });
  });

  describe('forLiveConfig', () => {
    it('should keep the finding WHEN it was computed for the live field in heatmap mode', () => {
      expect(ClusteredTimestampsRule.forLiveConfig(FINDING, 'lastModifiedAt', 'heatmap')).toBe(FINDING);
    });

    it('should drop the finding WHEN the live field differs (stale by one effect)', () => {
      expect(ClusteredTimestampsRule.forLiveConfig(FINDING, 'lastVisitedAt', 'heatmap')).toBeUndefined();
    });

    it('should drop the finding WHEN the live color mode is file type', () => {
      expect(ClusteredTimestampsRule.forLiveConfig(FINDING, 'lastModifiedAt', 'type')).toBeUndefined();
    });

    it('should report nothing WHEN there is no finding', () => {
      expect(ClusteredTimestampsRule.forLiveConfig(undefined, 'lastModifiedAt', 'heatmap')).toBeUndefined();
    });
  });
});
