import type { VaultNode } from '../core/data/VaultNode';
import { TimestampClusterDetector } from '../core/util/time/TimestampClusterDetector';
import type { ColorMode, HeatField } from '../view/constants';

/**
 * Heat fields whose values a sync tool overwrites (download time). `visited`
 * is NOT one: visit history is per device and never synced.
 */
export type SyncStampedHeatField = Extract<HeatField, 'lastModifiedAt' | 'createdAt'>;

/** "The current view's recency colors are meaningless" — what the header banner shows. */
export interface ClusteredTimestamps {
  /** The field the files were checked on (the banner names it). */
  readonly field: SyncStampedHeatField;
  /** Files sharing (nearly) the same time. */
  readonly sharedCount: number;
  /** Files judged — every laid-out file with a value for `field`. */
  readonly totalCount: number;
}

/**
 * Decides when the heatmap header warns that the current view's timestamps
 * are clustered (typically: a fresh sync stamped every file with the download
 * time), so a uniform map is not mistaken for a layout bug.
 *
 * Shown only while recency colors are on screen (heatmap color mode) and
 * colored by a sync-stamped field; the clustering rule itself is
 * `TimestampClusterDetector`'s.
 */
export class ClusteredTimestampsRule {
  /**
   * The clustered-timestamps finding for `files` (the laid-out leaves of the
   * current view), or `undefined` when there is nothing to warn about.
   */
  static evaluate(
    files: readonly VaultNode[],
    field: HeatField,
    colorMode: ColorMode,
  ): ClusteredTimestamps | undefined {
    if (colorMode !== 'heatmap' || !ClusteredTimestampsRule.isSyncStamped(field)) return undefined;
    const cluster = TimestampClusterDetector.detect(files, f => f[field]);
    if (!cluster) return undefined;
    return { field, sharedCount: cluster.members.length, totalCount: cluster.judgedCount };
  }

  /**
   * `finding` when it still matches the LIVE config, else `undefined`.
   * WHY: findings bubble up from the treemap one effect late — without this
   * the banner would linger for a frame after switching field or color mode.
   */
  static forLiveConfig(
    finding: ClusteredTimestamps | undefined,
    field: HeatField,
    colorMode: ColorMode,
  ): ClusteredTimestamps | undefined {
    if (!finding || colorMode !== 'heatmap' || finding.field !== field) return undefined;
    return finding;
  }

  /**
   * Whether the banner offers "Restore from git" for `finding`: only for
   * modified times — the restore never touches created times, so offering it
   * on a created-time banner would leave that banner standing.
   */
  static offersGitRestore(finding: ClusteredTimestamps): boolean {
    return finding.field === 'lastModifiedAt';
  }

  private static isSyncStamped(field: HeatField): field is SyncStampedHeatField {
    return field === 'lastModifiedAt' || field === 'createdAt';
  }
}
