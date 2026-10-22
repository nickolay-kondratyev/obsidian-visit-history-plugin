import { TFile } from 'obsidian';
import { VisitStatsProvider } from '../VisitStatsProvider';
import { VisitStats } from '../VisitStats';
import { DocIdService } from 'stable-ids-for-obsidian';
import { VhV3DurationStore } from './VhV3DurationStore';
import { VisitStatsCache } from './VisitStatsCache';

/**
 * VisitStatsProvider backed by V3 focus-duration files: stats aggregate ALL
 * users and devices (last visit = most recent session START, matching the old
 * V2 stamp-at-focus-time semantics; total = sum of session durations).
 */
export class VisitHistoryServiceV3 implements VisitStatsProvider {
  constructor(
    private readonly docIdService: DocIdService,
    private readonly vhV3DurationStore: VhV3DurationStore,
    private readonly visitStatsCache: VisitStatsCache,
  ) {
  }

  async getVisitStats(file: TFile): Promise<VisitStats> {
    // READ-ONLY id lookup: this runs for every vault file when the heatmap
    // aggregates — it must never write into user files.
    const docId = await this.docIdService.getDocId(file);
    if (docId === null) {
      return VisitStats.EMPTY;
    }

    const cached = this.visitStatsCache.get(docId);
    if (cached !== undefined) {
      return cached;
    }

    // Token BEFORE the disk read: a session write overlapping the read makes
    // the cache reject this result (see VisitStatsCache) — it is still
    // returned, just not cached, so the next lookup re-reads disk.
    const token = this.visitStatsCache.readToken();
    const diskStats = await this.vhV3DurationStore.getVisitStatsAcrossUsersAndDevices(docId);
    // "Never visited" (EMPTY) is cached too — absence of files is just as
    // expensive to establish as presence.
    this.visitStatsCache.setIfNoWriteSince(docId, diskStats, token);
    return diskStats;
  }
}
